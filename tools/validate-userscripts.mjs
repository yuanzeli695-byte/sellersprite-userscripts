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
      "option.textContent = item.batchName"
    ],
    forbiddenText: ["liyuanze", "picker.innerHTML", "status && /Collecting/i"]
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
      "weeksRead: shares.length"
    ],
    forbiddenText: [
      "querySelectorAll(\"body *\")",
      "localStorage.setItem(\"ssTraffic:",
      "weeksRead: details.length"
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

  for (const text of config.requiredText) {
    assert.ok(source.includes(text), `${config.file}: missing required contract text ${text}`);
  }
  for (const text of config.forbiddenText) {
    assert.ok(!source.includes(text), `${config.file}: forbidden text found: ${text}`);
  }

  console.log(`validated ${config.file} v${runtimeVersion[1]}`);
}
