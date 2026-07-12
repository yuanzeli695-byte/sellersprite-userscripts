import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = {
  integrated: "scripts/sellersprite-integrated-runner.user.js",
  collector: "scripts/sellersprite-traffic-collector.user.js"
};

const [target, version] = process.argv.slice(2);
assert.ok(targets[target], `target must be one of: ${Object.keys(targets).join(", ")}`);
assert.match(version || "", /^\d+\.\d+\.\d+$/, "version must use x.y.z format");

const file = path.join(root, targets[target]);
const source = await readFile(file, "utf8");
const updated = source
  .replace(/^(\/\/\s+@version\s+)[^\r\n]+/m, `$1${version}`)
  .replace(/(\bvar VERSION = ["'])[^"']+(["'];)/, `$1${version}$2`);

assert.notEqual(updated, source, "version was not changed");
await writeFile(file, updated, "utf8");
console.log(`updated ${targets[target]} to ${version}`);
