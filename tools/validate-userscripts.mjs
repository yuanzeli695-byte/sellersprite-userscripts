import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "https://github.com/yuanzeli695-byte/sellersprite-userscripts";

const scripts = [
  {
    file: "scripts/sellersprite-integrated-runner.user.js",
    name: "SellerSprite Integrated Runner",
    namespace: "amazon-products",
    requiredText: [
      "#ss-collector-run",
      "#ss-collector-json",
      "data-ss-protocol-version",
      "data-ss-result-run-id",
      "sellerSpriteTraffic/v1",
      "applyStepUpdate",
      "picker.replaceChildren()",
      "option.textContent = item.batchName",
      "var BOOTSTRAP_STRICT_QUALIFIED_ASINS = [",
      "var PRICE_MIN_USD =",
      "var PRICE_MAX_USD =",
      "var ENABLE_TIER0_TELEMETRY =",
      "var ENABLE_TIER2_2_CONDITIONAL_RETRY =",
      "collectorTelemetry: payload.telemetry || null",
      "strict-qualified-history",
      "strictQualifiedHistory/v2",
      "gateProfile: STRICT_GATE_PROFILE",
      "Copy gate log TSV",
      "url: sanitizedPageUrl()"
    ],
    forbiddenText: [
      "liyuanze",
      "picker.innerHTML",
      "status && /Collecting/i",
      "url: location.href",
      "B0G13L54YJ",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket"
    ]
  },
  {
    file: "scripts/sellersprite-traffic-collector.user.js",
    name: "SellerSprite Traffic Collector MVP",
    namespace: "codex.amazon.product-selection",
    requiredText: [
      "id=\"ss-collector-run\"",
      "id=\"ss-collector-status\"",
      "id=\"ss-collector-json\"",
      "data-ss-protocol-version",
      "data-ss-result-run-id",
      "sellerSpriteTraffic/v1",
      "collectorErrorResult",
      "ownerDocument.defaultView",
      "weeksRead: shares.length",
      "var ENABLE_TIER0_TELEMETRY =",
      "var ENABLE_TIER2_1_ZERO_SHARE_DERIVATION =",
      "var TRAFFIC_MIN_PCT =",
      "sellerSpriteTelemetry/v1",
      "explicitMetricValue",
      "naturalShareDerived",
      "Copy Gate TSV",
      "Copy Timing TSV"
    ],
    forbiddenText: [
      "querySelectorAll(\"body *\")",
      "localStorage.setItem(\"ssTraffic:",
      "weeksRead: details.length",
      "localStorage.",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket"
    ]
  }
];

function parseMetadata(source, file) {
  const block = source.match(/\/\/ ==UserScript==\r?\n([\s\S]*?)\/\/ ==\/UserScript==/);
  assert.ok(block, `${file}: missing userscript metadata block`);

  const metadata = new Map();
  for (const line of block[1].split(/\r?\n/)) {
    const match = line.match(/^\/\/\s+@(\S+)\s+(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    const values = metadata.get(key) || [];
    values.push(value.trim());
    metadata.set(key, values);
  }
  return metadata;
}

function one(metadata, key, file) {
  const values = metadata.get(key) || [];
  assert.equal(values.length, 1, `${file}: expected one @${key}`);
  return values[0];
}

function numericConstant(source, name, file) {
  const match = source.match(new RegExp(`\\bvar ${name} = (-?\\d+(?:\\.\\d+)?);`));
  assert.ok(match, `${file}: missing numeric constant ${name}`);
  return Number(match[1]);
}

function booleanConstant(source, name, file) {
  const match = source.match(new RegExp(`\\bvar ${name} = (true|false);`));
  assert.ok(match, `${file}: missing boolean constant ${name}`);
  return match[1] === "true";
}

function stringArrayConstant(source, name, file) {
  const match = source.match(new RegExp(`\\bvar ${name} = \\[([^\\]]*)\\];`));
  assert.ok(match, `${file}: missing string-array constant ${name}`);
  const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  assert.ok(values.length > 0, `${file}: ${name} must not be empty`);
  assert.equal(new Set(values).size, values.length, `${file}: ${name} contains duplicate values`);
  return values;
}

const validatedVersions = new Map();
const validatedSources = new Map();

for (const config of scripts) {
  const absolute = path.join(root, config.file);
  const source = await readFile(absolute, "utf8");
  const metadata = parseMetadata(source, config.file);

  new vm.Script(source, { filename: config.file });

  assert.equal(one(metadata, "name", config.file), config.name);
  assert.equal(one(metadata, "namespace", config.file), config.namespace);
  assert.match(one(metadata, "version", config.file), /^\d+\.\d+\.\d+$/);
  assert.equal(one(metadata, "homepageURL", config.file), repository);
  assert.equal(one(metadata, "supportURL", config.file), `${repository}/issues`);

  const rawUrl = `https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/${config.file}`;
  assert.equal(one(metadata, "updateURL", config.file), rawUrl);
  assert.equal(one(metadata, "downloadURL", config.file), rawUrl);

  const runtimeVersion = source.match(/\bvar VERSION = ["']([^"']+)["']/);
  assert.ok(runtimeVersion, `${config.file}: missing runtime VERSION`);
  assert.equal(runtimeVersion[1], one(metadata, "version", config.file), `${config.file}: runtime and metadata versions differ`);
  validatedVersions.set(config.file, runtimeVersion[1]);
  validatedSources.set(config.file, source);

  for (const text of config.requiredText) {
    assert.ok(source.includes(text), `${config.file}: missing required contract text ${text}`);
  }
  for (const text of config.forbiddenText) {
    assert.ok(!source.includes(text), `${config.file}: forbidden text found: ${text}`);
  }

  console.log(`validated ${config.file} v${runtimeVersion[1]}`);
}

const runnerVersion = validatedVersions.get("scripts/sellersprite-integrated-runner.user.js");
const collectorVersion = validatedVersions.get("scripts/sellersprite-traffic-collector.user.js");
const runnerSource = validatedSources.get("scripts/sellersprite-integrated-runner.user.js");
const collectorSource = validatedSources.get("scripts/sellersprite-traffic-collector.user.js");
const runnerTrafficMin = numericConstant(runnerSource, "TRAFFIC_MIN_PCT", "runner");
const collectorTrafficMin = numericConstant(collectorSource, "TRAFFIC_MIN_PCT", "collector");
const runnerTrafficWeeks = numericConstant(runnerSource, "MIN_REQUIRED_TRAFFIC_WEEKS", "runner");
const runnerTrafficMaxWeeks = numericConstant(runnerSource, "MAX_RECENT_TRAFFIC_WEEKS", "runner");
const collectorTrafficWeeks = numericConstant(collectorSource, "MIN_REQUIRED_WEEKS", "collector");
const collectorTrafficMaxWeeks = numericConstant(collectorSource, "MAX_RECENT_WEEKS", "collector");
const priceMin = numericConstant(runnerSource, "PRICE_MIN_USD", "runner");
const priceMax = numericConstant(runnerSource, "PRICE_MAX_USD", "runner");
const priceTrendAllowlist = stringArrayConstant(runnerSource, "PRICE_TREND_ALLOWLIST", "runner");
const runnerTelemetry = booleanConstant(runnerSource, "ENABLE_TIER0_TELEMETRY", "runner");
const runnerConditionalRetry = booleanConstant(runnerSource, "ENABLE_TIER2_2_CONDITIONAL_RETRY", "runner");
const collectorTelemetry = booleanConstant(collectorSource, "ENABLE_TIER0_TELEMETRY", "collector");
const collectorZeroDerivation = booleanConstant(collectorSource, "ENABLE_TIER2_1_ZERO_SHARE_DERIVATION", "collector");

assert.equal(runnerTrafficMin, collectorTrafficMin, "Runner and Collector traffic thresholds differ");
assert.equal(runnerTrafficWeeks, collectorTrafficWeeks, "Runner and Collector minimum traffic weeks differ");
assert.equal(runnerTrafficMaxWeeks, collectorTrafficMaxWeeks, "Runner and Collector maximum traffic weeks differ");
assert.equal(runnerTrafficMin, 70, "sellerSpriteTraffic/v1 requires the 70% pass70 threshold");
assert.ok(Number.isInteger(runnerTrafficWeeks) && runnerTrafficWeeks > 0, "minimum traffic weeks must be a positive integer");
assert.equal(runnerTrafficMaxWeeks, 4, "sellerSpriteTraffic/v1 recent4 fields require a four-week maximum");
assert.ok(runnerTrafficMaxWeeks >= runnerTrafficWeeks, "maximum traffic weeks must be >= minimum weeks");
assert.ok(priceMin > 0 && priceMax >= priceMin, "price range is invalid");

const priceRange = `$${priceMin.toFixed(2)}-$${priceMax.toFixed(2)}`;
const documentation = [
  {
    file: "README.md",
    requiredText: [
      `Runner-${runnerVersion}`,
      `Collector-${collectorVersion}`,
      "docs/CONFIGURATION.md",
      priceRange,
      "本地历史排重",
      "Copy gate log TSV"
    ]
  },
  {
    file: "docs/CONFIGURATION.md",
    requiredText: [
      `Runner \`${runnerVersion}\``,
      `Collector \`${collectorVersion}\``,
      "ENABLE_TIER0_TELEMETRY",
      "ENABLE_TIER2_1_ZERO_SHARE_DERIVATION",
      "ENABLE_TIER2_2_CONDITIONAL_RETRY",
      "BOOTSTRAP_STRICT_QUALIFIED_ASINS",
      "STRICT_GATE_PROFILE",
      "PRICE_MIN_USD",
      "PRICE_MAX_USD",
      `| \`ENABLE_TIER0_TELEMETRY\` | \`${runnerTelemetry}\``,
      `| \`ENABLE_TIER0_TELEMETRY\` | \`${collectorTelemetry}\``,
      `| \`ENABLE_TIER2_2_CONDITIONAL_RETRY\` | \`${runnerConditionalRetry}\``,
      `| \`PRICE_MIN_USD\` | \`${priceMin}\``,
      `| \`PRICE_MAX_USD\` | \`${priceMax}\``,
      `| \`MIN_REQUIRED_TRAFFIC_WEEKS\` | \`${runnerTrafficWeeks}\``,
      `| \`MAX_RECENT_TRAFFIC_WEEKS\` | \`${runnerTrafficMaxWeeks}\``,
      `| \`ENABLE_TIER2_1_ZERO_SHARE_DERIVATION\` | \`${collectorZeroDerivation}\``,
      `| \`TRAFFIC_MIN_PCT\` | \`${runnerTrafficMin}\``,
      `| \`MIN_REQUIRED_WEEKS\` | \`${collectorTrafficWeeks}\``,
      `| \`MAX_RECENT_WEEKS\` | \`${collectorTrafficMaxWeeks}\``,
      `| \`PRICE_TREND_ALLOWLIST\` | \`${priceTrendAllowlist.join(", ")}\``
    ]
  },
  {
    file: "CHANGELOG.md",
    requiredText: [
      `## Integrated Runner ${runnerVersion}`,
      `## Traffic Collector ${collectorVersion}`
    ]
  }
];

for (const config of documentation) {
  const source = await readFile(path.join(root, config.file), "utf8");
  for (const text of config.requiredText) {
    assert.ok(source.includes(text), `${config.file}: missing documentation text ${text}`);
  }
}
