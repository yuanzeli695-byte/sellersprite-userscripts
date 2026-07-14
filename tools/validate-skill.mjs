import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'amazon-us-strict-selection';
const skillDir = join(root, 'skills', skillName);

const requiredFiles = [
  'SKILL.md',
  'agents/openai.yaml',
  'references/browser-userscripts.md',
  'references/engineering-governance.md',
  'references/handoffs.md',
  'references/hard-gates.md',
  'references/runbook.md',
  'references/workbook-delivery.md',
  'scripts/preflight.py',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(join(skillDir, relativePath), 'utf8');
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...listFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function metadataVersion(source) {
  return source.match(/^\s*\/\/\s*@version\s+([^\s]+)/m)?.[1] ?? null;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert(match, 'SKILL.md must start with YAML frontmatter');
  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    assert(separator > 0, `invalid frontmatter line: ${line}`);
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return fields;
}

function findPython() {
  const candidates = process.platform === 'win32' ? ['python'] : ['python3', 'python'];
  for (const command of candidates) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) return command;
  }
  throw new Error('Python 3.10 or newer is required to validate the Skill preflight');
}

function runPython(python, args) {
  return spawnSync(python, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
}

for (const relativePath of requiredFiles) {
  assert(existsSync(join(skillDir, relativePath)), `missing Skill file: ${relativePath}`);
}

const skill = read('SKILL.md');
const frontmatter = parseFrontmatter(skill);
assert(
  [...frontmatter.keys()].sort().join(',') === 'description,name',
  'SKILL.md frontmatter may contain only name and description',
);
assert(frontmatter.get('name') === skillName, 'Skill name must match its directory');
assert((frontmatter.get('description') ?? '').length >= 80, 'Skill description is too vague');
assert(skill.split(/\r?\n/).length < 500, 'SKILL.md must stay below 500 lines');

const allSkillFiles = listFiles(skillDir);
const markdownFiles = allSkillFiles.filter((file) => file.endsWith('.md'));
for (const markdownFile of markdownFiles) {
  const markdown = readFileSync(markdownFile, 'utf8');
  const linkPattern = /\[[^\]]*\]\((?!https?:\/\/|mailto:|#)([^)#]+)(?:#[^)]*)?\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const target = resolve(dirname(markdownFile), match[1]);
    assert(existsSync(target), `broken Skill link in ${relative(root, markdownFile)}: ${match[1]}`);
  }
}

const openaiYaml = read('agents/openai.yaml');
assert(openaiYaml.includes('display_name: "Amazon US Strict Selection"'), 'display_name is stale');
assert(
  openaiYaml.includes('$amazon-us-strict-selection'),
  'default_prompt must explicitly invoke $amazon-us-strict-selection',
);
const shortDescription = openaiYaml.match(/short_description:\s*"([^"]+)"/)?.[1] ?? '';
assert(
  shortDescription.length >= 25 && shortDescription.length <= 64,
  'short_description must be 25-64 characters',
);

const publicText = allSkillFiles
  .filter((file) => /\.(?:md|py|ya?ml)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
for (const [pattern, label] of [
  [/C:\\Users\\/i, 'Windows user profile path'],
  [/\b13045\b/, 'local username'],
  [/\bB0[A-Z0-9]{8}\b/, 'real-looking ASIN'],
  [/(?:api[_-]?key|password|cookie)\s*[:=]\s*["'][^"']+/i, 'credential-like value'],
]) {
  assert(!pattern.test(publicText), `Skill contains a publish-unsafe ${label}`);
}

const collectorSource = readFileSync(join(root, 'scripts', 'sellersprite-traffic-collector.user.js'), 'utf8');
const runnerSource = readFileSync(join(root, 'scripts', 'sellersprite-integrated-runner.user.js'), 'utf8');
const collectorVersion = metadataVersion(collectorSource);
const runnerVersion = metadataVersion(runnerSource);
const browserReference = read('references/browser-userscripts.md');
const preflight = read('scripts/preflight.py');
assert(browserReference.includes(`version ${collectorVersion}`), 'Collector version is stale in Skill docs');
assert(browserReference.includes(`version ${runnerVersion}`), 'Runner version is stale in Skill docs');
assert(preflight.includes(`"version": "${collectorVersion}"`), 'Collector version is stale in preflight');
assert(preflight.includes(`"version": "${runnerVersion}"`), 'Runner version is stale in preflight');
for (const filename of [
  'scripts/sellersprite-traffic-collector.user.js',
  'scripts/sellersprite-integrated-runner.user.js',
]) {
  assert(browserReference.includes(filename), `Skill docs omit stable filename: ${filename}`);
  assert(preflight.includes(filename), `preflight omits stable filename: ${filename}`);
}

const python = findPython();
const preflightPath = join(skillDir, 'scripts', 'preflight.py');
const help = runPython(python, [preflightPath, '--help']);
assert(help.status === 0, `preflight --help failed: ${help.stderr || help.stdout}`);

const repoPreflight = runPython(python, [
  preflightPath,
  '--project-root',
  root,
  '--mode',
  'userscripts',
]);
assert(repoPreflight.status === 0, `userscript repository preflight failed: ${repoPreflight.stderr || repoPreflight.stdout}`);
const repoReport = JSON.parse(repoPreflight.stdout);
assert(repoReport.ok === true, 'userscript repository preflight must pass');
assert(repoReport.mode === 'userscripts', 'userscript repository preflight selected the wrong mode');

const emptyRoot = mkdtempSync(join(tmpdir(), 'amazon-strict-selection-'));
try {
  const failure = runPython(python, [
    preflightPath,
    '--project-root',
    emptyRoot,
    '--mode',
    'auto',
  ]);
  assert(failure.status !== 0, 'preflight must fail closed for an incompatible project root');
  const failureReport = JSON.parse(failure.stdout);
  assert(failureReport.ok === false, 'failed preflight must report ok=false');
} finally {
  rmSync(emptyRoot, { recursive: true, force: true });
}

console.log(`validated skills/${skillName}`);
