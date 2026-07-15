import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.join(root, 'scripts', 'sellersprite-integrated-runner.user.js');

function loadCore(transform) {
  let source = fs.readFileSync(runnerPath, 'utf8');
  if (transform) source = transform(source);
  const sandbox = { console, globalThis: {} };
  vm.runInNewContext(source, sandbox, { filename: runnerPath });
  return { core: sandbox.globalThis.SSIntegratedRunnerCore, source };
}

const expectedInvariantHashes = {
  buildDimensions: '7380339c52db4b88aefa2972431897b288be1ea17c6a59f788dedc36f2bb6cff',
  buildPriceTrend: '104313ad789500ff978b45665c80c99b668a575db3e7a8a4744a084314e55a13',
  classifyPriceSamples: 'a746860bb66fc7633ead415914151c4334c55c03aa5e667464dd7bc7675878a7',
  normalizeAsin: '732a6a011f438812d9a0cbd5025e8294f78861878eff1bce61aa188b873e04fe',
  parsePriceTooltip: 'cedec301e2aecc8d4f96037fa042acf79bb9089f0303de9dbbbf4ec229fb178e',
  parseTrafficCollector: 'd992f17453212a4552a3eb270cb8d4ec7db347bb9806a9b6af93fc3a85cc3c01',
  evaluateTrafficGate: '463d879d8750f40f5d5b2f0208af61dd130a00b8be74b0fc8527ca1bee5fb9f4',
  collectorHasKnownTrafficFailure: 'c5b8183935321798c553ab6edde4f2a064821938fe9d21ad2078fa13c2591b8a',
  legacyCollectorRetryReason: 'fe3ffaad003eddd0876533fe2bfebb90b7c82a736a20e2ef5f7bb44eedd5cdce',
  collectorRetryReason: 'e3c972e99aa18bb8a634b586e96c2b41f4b59441105775e0dc4f8a4f703c3ec1',
  shouldRetryCollector: '7016dbf650edac2d95658ecef59c89e1c3e1c49bb5ab65d4eb6b56762680be54',
  evaluateDimensionsGate: '3351925c5989119fd6820c5b6c591abb21b6025e82ce79bcab77fcedf8b35f16',
  evaluatePriceGate: 'cb51b65c4a0ccefedf50db3708bee61e884b602c4183dccb3dd297440fab6a9f',
  currentPriceFromSamples: '99830e4cc6c4d18542c68dcc27ce090105d65c18b4b7c9f642d4813bc8a9305f',
  isQualifiedResult: 'bace53cc53729d6e30da00560f9cc293f6e3443361521e7eaa8c880ab27ead0f',
  summarizeResults: '06da1216f07cd0828d4088b62edf9695d656d8c242f04e4182f2e67e3d34c8e2',
  buildRunnerGateLogRow: '381720a697cf83a31ad6a9810581a052e8d19bc71b5b151c00bb2f12e8cb2749',
  buildHistorySkipGateLogRow: '640ace4dbc169e580c1b3179abc17d4967dfb47125a4b6d6815da8ed78e4531b',
  buildRunnerTimingLogRow: '5ccb4ed2c86ddfa0cf945662be7e4e4817c894c57a11ba6fe2fc9bac24257852',
  buildHistorySkipTimingLogRow: '483f5594d7f1f2c8b22d02c03a7990130a997454f5177a63b179bfa5b056a695',
  attachRunnerTelemetry: '037a616ebf0e29ca28c7eb2ef76e6521d21a65d63660590a48456e3b5b469498',
  rowsToTsv: '1c648916319773211f76ce1ef1705ca43d57360e02d8b565b16cd0a3f9d4fb20',
  uniqueAsins: '7041a21880dce295bd77293ed35110fad766482440e6a11dacb8368dee8380e2',
  filterHistoricalQueue: '5e70aa593571024849e7bb8663553c08aad35e56b5908e3893f5da74daf762a8',
  valueAfterLabel: '61897df026b9ee2e32014f2e49bd275f04b11fef70dd58e60c98d9e9d8109939',
};

const current = loadCore();
const disabled = loadCore((source) => source
  .replace('var ENABLE_P1_CUMULATIVE_TARGET_CONTROL = true;', 'var ENABLE_P1_CUMULATIVE_TARGET_CONTROL = false;')
  .replace('var ENABLE_TIER0_GRANULAR_TELEMETRY = true;', 'var ENABLE_TIER0_GRANULAR_TELEMETRY = false;'));

assert.ok(current.core);
assert.equal(current.core.cumulativeTargetControlEnabled, true);
assert.equal(current.core.granularTelemetryEnabled, true);
assert.equal(current.core.targetControlVersion, 'p1-cumulative-remaining-v1');
assert.equal(current.core.granularTelemetryVersion, 'tier0.2-granular-v1');
assert.equal(disabled.core.cumulativeTargetControlEnabled, false);
assert.equal(disabled.core.granularTelemetryEnabled, false);

for (const [name, expectedHash] of Object.entries(expectedInvariantHashes)) {
  const actualHash = crypto.createHash('sha256').update(current.core[name].toString()).digest('hex');
  assert.equal(actualHash, expectedHash, `${name} changed from the published 0.3.7 gate baseline`);
}

const qualifiedResult = {
  strictDecision: 'pass',
  status: 'ok',
  decision: 'pass',
  pass70: true,
  weeksRead: 3,
  latestNaturalSharePct: 80,
  recent4AvgNaturalSharePct: 80,
  recent4MinNaturalSharePct: 80,
  dimensions: '1 x 1 x 1 inches',
  currentPrice: 20,
  priceTrendClass: 'stable',
};
const cumulative = {
  targetQualified: 10,
  requestedFinalTargetAtStart: 10,
  remainingTargetAtStart: 2,
  targetControlVersion: 'p1-cumulative-remaining-v1',
  results: [qualifiedResult, { strictDecision: 'reject' }],
};
assert.equal(current.core.effectiveStopBudget(cumulative), 2);
assert.equal(current.core.browserPassesThisBatch(cumulative), 1);
assert.equal(current.core.stopDecision(cumulative).stop, false);
cumulative.results.push({ ...qualifiedResult });
assert.equal(current.core.stopDecision(cumulative).reason, 'target_reached');

const invalid = {
  targetQualified: 2,
  targetControlVersion: 'p1-cumulative-remaining-v1',
  remainingTargetAtStart: 'bad',
  results: [],
};
assert.equal(current.core.stopDecision(invalid).reason, 'invalid_target_control');

const inFlightState = {
  queueHash: 'control-hash',
  queue: ['TEST-ASIN-0001'],
  results: [],
  currentIndex: 0,
  status: 'running',
  currentStep: 'traffic',
};
assert.equal(current.core.isCurrentAutoRowInFlight(inFlightState), true);
current.core.mergeLatestControlState(inFlightState, {
  queueHash: 'control-hash',
  status: 'paused',
  stopAfterCurrentRowRequested: true,
  stopAction: 'operator_stop_after_current_row',
  pauseId: 'pause-1',
  pausedFromStatus: 'running',
  pausedFromStep: 'traffic',
});
assert.equal(inFlightState.status, 'paused');
assert.equal(inFlightState.stopAfterCurrentRowRequested, true);
inFlightState.currentStep = 'paused';
assert.equal(current.core.isCurrentAutoRowInFlight(inFlightState), true);
inFlightState.results[0] = { strictDecision: 'reject' };
assert.equal(current.core.isCurrentAutoRowInFlight(inFlightState), false);

const fallbackSidecar = {
  schemaVersion: 'sellerSpriteGranularTelemetry/v1',
  queueHash: 'abc123',
  batchCreatedAt: '2026-07-15T00:00:00Z',
  rowsByIndex: {},
  controlEvents: [],
};
const latestSidecar = {
  ...fallbackSidecar,
  rowsByIndex: {},
  controlEvents: [{ event: 'pause_requested' }],
};
const mergedSidecar = current.core.mergeGranularRowSidecar(
  latestSidecar,
  fallbackSidecar,
  3,
  { asin: 'TEST-ASIN-0002' },
);
assert.equal(mergedSidecar.controlEvents.length, 1);
assert.equal(mergedSidecar.rowsByIndex['3'].asin, 'TEST-ASIN-0002');

assert.match(current.source, /^\/\/ @name\s+SellerSprite Integrated Runner$/m);
assert.match(current.source, /^\/\/ @version\s+0\.3\.8$/m);
assert.ok(current.source.includes('@updateURL    https://raw.githubusercontent.com/yuanzeli695-byte/sellersprite-userscripts/main/scripts/sellersprite-integrated-runner.user.js'));
assert.ok(current.source.includes("var BOOTSTRAP_STRICT_QUALIFIED_ASINS = [];"));
assert.ok(current.source.includes('<input id="ss-v3-operator" value="">'));
assert.ok(current.source.includes('picker.replaceChildren();'));
assert.ok(current.source.includes('url: sanitizedPageUrl()'));
assert.ok(current.source.includes("handshakeMode: 'dom_run_id_v1_observed'"));
assert.ok(current.source.includes("data-ss-protocol-version"));
assert.ok(current.source.includes("data-ss-result-run-id"));
assert.ok(current.source.includes('}, 95000, 250);'));
assert.ok(!current.source.includes('status_text_v1_observed'));
assert.ok(!/\bB0[A-Z0-9]{8}\b/.test(current.source));

console.log('Runner 0.3.8 P1 tests passed');
