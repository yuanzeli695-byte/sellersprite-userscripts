import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing function ${name}`);
  const open = source.indexOf("{", start);
  assert.ok(open >= 0, `missing body for ${name}`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`unterminated function ${name}`);
}

function loadFunctions(source, names) {
  const context = {};
  vm.createContext(context);
  const declarations = names.map((name) => extractFunction(source, name)).join("\n");
  vm.runInContext(`${declarations}\nthis.api = { ${names.join(", ")} };`, context);
  return context.api;
}

function loadCore(source, key, transform) {
  const executable = transform ? transform(source) : source;
  const context = {
    console,
    URL,
    location: {
      href: "https://www.amazon.com/dp/B012345678",
      hostname: "www.amazon.com",
      pathname: "/dp/B012345678"
    }
  };
  vm.createContext(context);
  vm.runInContext(executable, context);
  assert.ok(context[key], `missing exported core ${key}`);
  return context[key];
}

function samples(prices) {
  return prices.map((price, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    price
  }));
}

const integratedSource = await readFile(path.join(root, "scripts/sellersprite-integrated-runner.user.js"), "utf8");
const integrated = loadFunctions(integratedSource, [
  "oneLine",
  "numberOrNull",
  "normalizeAsin",
  "evaluateTrafficGate",
  "collectorHasKnownTrafficFailure",
  "evaluateDimensionsGate",
  "evaluatePriceGate",
  "applyStepUpdate",
  "normalizePriceSamples",
  "average",
  "classifyPriceSamples"
]);
const integratedCore = loadCore(integratedSource, "SSIntegratedRunnerCore");
const integratedConditionalRetryCore = loadCore(
  integratedSource,
  "SSIntegratedRunnerCore",
  (source) => source.replace(
    /var ENABLE_TIER2_2_CONDITIONAL_RETRY = (?:true|false);/,
    "var ENABLE_TIER2_2_CONDITIONAL_RETRY = true;"
  )
);
const integratedLegacyRetryCore = loadCore(
  integratedSource,
  "SSIntegratedRunnerCore",
  (source) => source.replace(
    /var ENABLE_TIER2_2_CONDITIONAL_RETRY = (?:true|false);/,
    "var ENABLE_TIER2_2_CONDITIONAL_RETRY = false;"
  )
);
const trafficThreshold = integratedCore.trafficMinPct;
const minimumTrafficWeeks = integratedCore.minRequiredTrafficWeeks;
const maximumTrafficWeeks = integratedCore.maxRecentTrafficWeeks;
const priceMinimum = integratedCore.priceMinUsd;
const priceMaximum = integratedCore.priceMaxUsd;
const priceMiddle = (priceMinimum + priceMaximum) / 2;
const allowedPriceTrends = Array.from(integratedCore.priceTrendAllowlist);
assert.ok(allowedPriceTrends.length > 0, "price trend allowlist must not be empty");
const allowedPriceTrend = allowedPriceTrends[0];
const disallowedPriceTrend = "__test_disallowed__";
assert.ok(!allowedPriceTrends.includes(disallowedPriceTrend), "test fixture must remain outside the price trend allowlist");

assert.equal(integratedCore.normalizeAsin("asin=b012345678"), "B012345678");
assert.equal(integrated.numberOrNull("1,234.50 units"), 1234.5);

const passingTraffic = {
  status: "ok",
  decision: "pass",
  pass70: true,
  weeksRead: minimumTrafficWeeks,
  latestNaturalSharePct: trafficThreshold,
  recent4AvgNaturalSharePct: trafficThreshold,
  recent4MinNaturalSharePct: trafficThreshold
};
assert.equal(integratedCore.evaluateTrafficGate(passingTraffic, false).pass, true);
assert.equal(integratedCore.evaluateTrafficGate(passingTraffic, true).rule, "asin_mismatch");
assert.equal(integratedCore.evaluateTrafficGate({ ...passingTraffic, weeksRead: minimumTrafficWeeks - 1 }, false).rule, "traffic_weeks_insufficient");
assert.equal(integratedCore.evaluateTrafficGate({ ...passingTraffic, weeksRead: 1, latestNaturalSharePct: 0, recent4AvgNaturalSharePct: 0, recent4MinNaturalSharePct: 0 }, false).rule, "traffic_latest_below_70");
assert.equal(integratedCore.evaluateTrafficGate({ ...passingTraffic, recent4MinNaturalSharePct: trafficThreshold - 0.01 }, false).rule, "traffic_recent4_min_below_70");
assert.equal(integratedCore.evaluateTrafficGate({ ...passingTraffic, decision: "sample_low_review", pass70: false }, false).rule, "traffic_collector_not_pass");
assert.equal(integratedCore.collectorHasKnownTrafficFailure({ latest: { naturalSharePct: trafficThreshold - 0.1 } }), true);
assert.equal(integratedCore.evaluateDimensionsGate("").pass, false);
assert.equal(integratedCore.evaluateDimensionsGate("10 x 8 x 4 inches").pass, true);
assert.equal(integratedCore.evaluatePriceGate(allowedPriceTrend, priceMinimum).pass, true);
assert.equal(integratedCore.evaluatePriceGate(allowedPriceTrend, priceMaximum).pass, true);
assert.equal(integratedCore.evaluatePriceGate(allowedPriceTrend, priceMinimum - 0.01).rule, "price_current_out_of_range");
assert.equal(integratedCore.evaluatePriceGate(allowedPriceTrend, priceMaximum + 0.01).rule, "price_current_out_of_range");
assert.equal(integratedCore.evaluatePriceGate(allowedPriceTrend, null).rule, "price_current_missing");
assert.equal(integratedCore.evaluatePriceGate(disallowedPriceTrend, priceMiddle).pass, false);
const qualifyingResult = { strictDecision: "pass", priceTrendClass: allowedPriceTrend, currentPrice: priceMiddle, status: "ok", decision: "pass", pass70: true, weeksRead: minimumTrafficWeeks, latestNaturalSharePct: trafficThreshold, recent4AvgNaturalSharePct: trafficThreshold, recent4MinNaturalSharePct: trafficThreshold, dimensions: "10 x 8 x 4 inches" };
assert.equal(integratedCore.isQualifiedResult(qualifyingResult), true);
assert.equal(integratedCore.isQualifiedResult({ ...qualifyingResult, currentPrice: null, priceSamples: samples([priceMiddle, priceMiddle, priceMiddle]) }), true);
assert.equal(integratedCore.isQualifiedResult({ strictDecision: "pass", priceTrendClass: "stable", currentPrice: null }), false);
assert.deepEqual(
  JSON.parse(JSON.stringify(integratedCore.filterHistoricalQueue(["B012345678", "B087654321", "B012345678"], { B012345678: { source: "fixture" } }))),
  { queue: ["B087654321"], skipped: ["B012345678", "B012345678"] }
);
assert.equal(integratedCore.strictHistorySchemaVersion, "strictQualifiedHistory/v2");
assert.ok(integratedCore.strictGateProfile.includes(`traffic=${minimumTrafficWeeks}-${maximumTrafficWeeks}x${trafficThreshold}`));
assert.ok(integratedCore.strictGateProfile.includes(`price=${priceMinimum}-${priceMaximum}`));
const migratedHistory = JSON.parse(JSON.stringify(integratedCore.normalizeStrictHistory({
  schemaVersion: "strictQualifiedHistory/v1",
  asins: { B012345678: { qualifiedAt: "legacy" } }
})));
assert.equal(migratedHistory.changed, true);
assert.deepEqual(
  Object.keys(migratedHistory.history.asins).sort(),
  Array.from(integratedCore.bootstrapStrictQualifiedAsins).sort()
);
const configuredHistoryAsins = Object.fromEntries(Array.from(integratedCore.bootstrapStrictQualifiedAsins).map((asin) => [
  asin,
  { qualifiedAt: "preloaded", source: "preloaded_deliveries", gateProfile: integratedCore.strictGateProfile }
]));
configuredHistoryAsins.B012345678 = { qualifiedAt: "current", gateProfile: integratedCore.strictGateProfile };
const currentHistory = JSON.parse(JSON.stringify(integratedCore.normalizeStrictHistory({
  schemaVersion: integratedCore.strictHistorySchemaVersion,
  gateProfile: integratedCore.strictGateProfile,
  asins: configuredHistoryAsins
})));
assert.equal(currentHistory.changed, false);
assert.ok(currentHistory.history.asins.B012345678);
assert.equal(integratedConditionalRetryCore.tier22ConditionalRetryEnabled, true);
assert.equal(integratedLegacyRetryCore.tier22ConditionalRetryEnabled, false);
assert.equal(integratedConditionalRetryCore.shouldRetryCollector({ status: "no_chart_loaded" }), true);
assert.equal(integratedConditionalRetryCore.shouldRetryCollector({ status: "ok", decision: "fail", pass70: false, latest: { naturalSharePct: trafficThreshold - 1 } }), false);
const partialTraffic = { status: "ok", weeksRead: Math.max(0, minimumTrafficWeeks - 1), details: [{ naturalSharePct: trafficThreshold + 5 }] };
assert.equal(integratedConditionalRetryCore.shouldRetryCollector(partialTraffic), false);
assert.equal(integratedLegacyRetryCore.shouldRetryCollector(partialTraffic), true);
const gateRow = integratedCore.buildRunnerGateLogRow({ strictDecision: "pass", targetAsin: "B012345678", status: "ok", currentPrice: 20, priceTrendClass: "stable" }, { batchName: "fixture", queueHash: "abcd" });
assert.equal(gateRow.outcome, "pass");
const timingRow = integratedCore.buildRunnerTimingLogRow({ targetAsin: "B012345678", startedAt: "start", finishedAt: "finish" }, { totalMs: 12 }, { batchName: "fixture", queueHash: "abcd" });
assert.equal(timingRow.totalMs, 12);
assert.match(integratedCore.rowsToTsv([gateRow], integratedCore.gateLogColumns), /outcome/);
assert.equal(integratedCore.rowsToTsv([{ cell: "=1+1" }], ["cell"]), "cell\n'=1+1");
assert.equal(integratedCore.rowsToTsv([{ cell: " @SUM(A1:A2)" }], ["cell"]), "cell\n' @SUM(A1:A2)");
const runningState = { status: "running", currentStep: "idle", message: "" };
assert.equal(integratedCore.applyStepUpdate(runningState, "traffic", "collecting"), true);
assert.equal(runningState.currentStep, "traffic");
const pausedState = { status: "paused", currentStep: "paused", message: "pause requested" };
assert.equal(integratedCore.applyStepUpdate(pausedState, "dimensions", "reading"), false);
assert.equal(pausedState.currentStep, "paused");
assert.equal(integratedCore.classifyPriceSamples(samples([100, 101, 100, 102])), "stable");
assert.equal(integratedCore.classifyPriceSamples(samples([100, 105, 110, 115])), "rising");
assert.equal(integratedCore.classifyPriceSamples(samples([120, 115, 110, 100])), "declining");
assert.equal(integratedCore.classifyPriceSamples(samples([100, 140, 90, 135, 100])), "volatile");
assert.equal(integratedCore.classifyPriceSamples(samples([100, 101])), "no_data");

const collectorSource = await readFile(path.join(root, "scripts/sellersprite-traffic-collector.user.js"), "utf8");
const collector = loadFunctions(collectorSource, ["safeText", "parseNumber", "weekSortKey"]);
const collectorCore = loadCore(collectorSource, "SSTrafficCollectorCore");
const collectorWithZeroDerivation = loadCore(
  collectorSource,
  "SSTrafficCollectorCore",
  (source) => source.replace(
    /var ENABLE_TIER2_1_ZERO_SHARE_DERIVATION = (?:true|false);/,
    "var ENABLE_TIER2_1_ZERO_SHARE_DERIVATION = true;"
  )
);
const collectorWithoutZeroDerivation = loadCore(
  collectorSource,
  "SSTrafficCollectorCore",
  (source) => source.replace(
    /var ENABLE_TIER2_1_ZERO_SHARE_DERIVATION = (?:true|false);/,
    "var ENABLE_TIER2_1_ZERO_SHARE_DERIVATION = false;"
  )
);
assert.equal(collectorCore.trafficMinPct, integratedCore.trafficMinPct);
assert.equal(collectorCore.minRequiredWeeks, integratedCore.minRequiredTrafficWeeks);
assert.equal(collectorCore.maxRecentWeeks, integratedCore.maxRecentTrafficWeeks);
assert.equal(collector.parseNumber("1,234.5"), 1234.5);
assert.equal(collector.parseNumber("no data"), null);
assert.equal(typeof collector.weekSortKey("2026-07-01"), "number");
assert.deepEqual(JSON.parse(JSON.stringify(collectorCore.explicitMetricValue(["总流量 100"], "总流量"))), { state: "number", value: 100, raw: "100" });
assert.deepEqual(JSON.parse(JSON.stringify(collectorCore.explicitMetricValue(["自然流量 0"], "自然流量"))), { state: "number", value: 0, raw: "0" });
assert.equal(collectorCore.explicitMetricValue(["自然流量 --"], "自然流量").state, "missing");
assert.equal(collectorCore.explicitMetricValue(["自然流量 0/0"], "自然流量").state, "ambiguous");
const explicitZeroText = "2026第26周(06/21~06/27)\n总流量\n100\n自然流量\n0\nSP广告流量\n100\n占比100%";
const explicitZero = collectorWithZeroDerivation.parseTip(explicitZeroText);
assert.equal(explicitZero.totalTraffic, 100);
assert.equal(explicitZero.naturalTraffic, 0);
assert.equal(explicitZero.naturalSharePct, 0);
assert.equal(explicitZero.naturalShareDerived, true);
assert.equal(explicitZero.naturalShareSource, "derived_explicit_zero_over_positive_total");
assert.equal(collectorWithoutZeroDerivation.parseTip(explicitZeroText).naturalSharePct, null);
const missingNatural = collectorWithZeroDerivation.parseTip("2026第26周(06/21~06/27)\n总流量\n100\n自然流量\n--\nSP广告流量\n100\n占比100%");
assert.equal(missingNatural.naturalTraffic, null);
assert.equal(missingNatural.naturalSharePct, null);
const zeroOverZero = collectorWithZeroDerivation.parseTip("2026第26周(06/21~06/27)\n总流量\n0\n自然流量\n0\nSP广告流量\n0");
assert.equal(zeroOverZero.naturalSharePct, null);
const ambiguousNatural = collectorWithZeroDerivation.parseTip("2026第26周(06/21~06/27)\n总流量\n100\n自然流量\n0?\nSP广告流量\n100\n占比100%");
assert.equal(ambiguousNatural.naturalSharePct, null);
const passingDetails = Array.from({ length: collectorCore.minRequiredWeeks }, (_, index) => ({
  week: `2026-week-${index + 1}`,
  weekSort: 202600 + index,
  naturalSharePct: collectorCore.trafficMinPct + index
}));
assert.equal(collectorCore.summarize(passingDetails, "fixture").decision, "pass");
const reviewRow = collectorCore.buildGateLogRow({ status: "no_chart_loaded", decision: "review" });
assert.equal(reviewRow.outcome, "review");
assert.equal(collectorCore.buildGateLogRow({ status: "ok", decision: "fail", pass70: false }).outcome, "reject");
assert.match(collectorCore.rowsToTsv([reviewRow], collectorCore.gateLogColumns), /review/);
assert.equal(collectorCore.rowsToTsv([{ cell: "+1+1" }], ["cell"]), "cell\n'+1+1");

console.log("core logic tests passed");
