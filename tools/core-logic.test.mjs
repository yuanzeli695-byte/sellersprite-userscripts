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

assert.equal(integrated.normalizeAsin("asin=b012345678"), "B012345678");
assert.equal(integrated.numberOrNull("1,234.50 units"), 1234.5);

const passingTraffic = {
  status: "ok",
  decision: "pass",
  pass70: true,
  weeksRead: 3,
  latestNaturalSharePct: 70,
  recent4AvgNaturalSharePct: 70,
  recent4MinNaturalSharePct: 70
};
assert.equal(integrated.evaluateTrafficGate(passingTraffic, false).pass, true);
assert.equal(integrated.evaluateTrafficGate(passingTraffic, true).rule, "asin_mismatch");
assert.equal(integrated.evaluateTrafficGate({ ...passingTraffic, weeksRead: 2 }, false).rule, "traffic_weeks_insufficient");
assert.equal(integrated.evaluateTrafficGate({ ...passingTraffic, recent4MinNaturalSharePct: 69.99 }, false).rule, "traffic_recent4_min_below_70");
assert.equal(integrated.evaluateTrafficGate({ ...passingTraffic, decision: "sample_low_review", pass70: false }, false).rule, "traffic_collector_not_pass");
assert.equal(integrated.collectorHasKnownTrafficFailure({ latest: { naturalSharePct: 69.9 } }), true);
assert.equal(integrated.evaluateDimensionsGate("").pass, false);
assert.equal(integrated.evaluateDimensionsGate("10 x 8 x 4 inches").pass, true);
assert.equal(integrated.evaluatePriceGate("stable").pass, true);
assert.equal(integrated.evaluatePriceGate("rising").pass, true);
assert.equal(integrated.evaluatePriceGate("declining").pass, false);
const runningState = { status: "running", currentStep: "idle", message: "" };
assert.equal(integrated.applyStepUpdate(runningState, "traffic", "collecting"), true);
assert.equal(runningState.currentStep, "traffic");
const pausedState = { status: "paused", currentStep: "paused", message: "pause requested" };
assert.equal(integrated.applyStepUpdate(pausedState, "dimensions", "reading"), false);
assert.equal(pausedState.currentStep, "paused");
assert.equal(integrated.classifyPriceSamples(samples([100, 101, 100, 102])), "stable");
assert.equal(integrated.classifyPriceSamples(samples([100, 105, 110, 115])), "rising");
assert.equal(integrated.classifyPriceSamples(samples([120, 115, 110, 100])), "declining");
assert.equal(integrated.classifyPriceSamples(samples([100, 140, 90, 135, 100])), "volatile");
assert.equal(integrated.classifyPriceSamples(samples([100, 101])), "no_data");

const collectorSource = await readFile(path.join(root, "scripts/sellersprite-traffic-collector.user.js"), "utf8");
const collector = loadFunctions(collectorSource, ["safeText", "parseNumber", "weekSortKey"]);
assert.equal(collector.parseNumber("1,234.5"), 1234.5);
assert.equal(collector.parseNumber("no data"), null);
assert.equal(typeof collector.weekSortKey("2026-07-01"), "number");

console.log("core logic tests passed");
