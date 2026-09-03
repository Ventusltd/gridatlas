import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = process.cwd();
export const SCOPE_DIR = path.join(ROOT, 'scope-of-works');
export const MASTER_NAME = '202608301321-scope-of-works.md';
export const CURRENT_RELEASE = '202608300453-atlas-v9';
export const SHARED_400KV_CARTRIDGE = '5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993';
export const EXPECTED_RELEASES = Object.freeze([
  '202608291237-atlas-v9',
  '202608291239-atlas-v9',
  '202608291430-atlas-v9',
  '202608291758-atlas-v9',
  '202608291818-atlas-v9',
  '202608292126-atlas-v9',
  '202608292311-atlas-v9',
  '202608300453-atlas-v9'
]);
// The budget exists because this repository once accumulated one-off
// workflows faster than it retired them -- 21 sit in the archive. It is a cap
// on sprawl, not a ban on automation, so adding to it is a decision that gets
// written down rather than a number that gets nudged.
//
// 202608312212-cartridge-proof.yml earns its place: the scope loop is retired
// and fires only on workflow_dispatch, and verify-live triggers on a path list
// that excludes atlas/, so a cartridge could be composed, hashed, pushed and
// served with nobody having run its proof. It is node-only and takes seconds,
// so there is never a reason to skip it.
//
// rollback-composition.yml earns its place because every other entry on this
// list can only move the live pointer FORWARD. Ten generations were cut in
// three hours on 2026-09-03, each one repointing the live route, and undoing
// any of them meant hand-editing atlas/current.json at whatever hour it was
// noticed -- the hand-editing habit tools/recompose.mjs exists to end. v9.83
// pinned the runtime products so a bad product cannot reach a shipped
// release; this is the other half, so a bad release cannot stay on the
// pointer. It is the only entry with no 12-digit prefix, and deliberately: it
// belongs to no release, it is a perpetual single-purpose path like the scope
// loop, and stamping it for one night would make a permanent mechanism look
// like the per-release sprawl this budget exists to cap.
export const ACTIVE_WORKFLOWS = Object.freeze([
  '202608301321-scope-loop.yml',
  '202608301321-verify-live.yml',
  '202608310015-gridatlas-overnight-next-versions.yml',
  '202608310050-gridatlas-next-version-builders.yml',
  '202608312212-cartridge-proof.yml',
  'rollback-composition.yml'
]);

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function normaliseNewlines(value) {
  return String(value).replace(/\r\n/g, '\n');
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    if (value.startsWith('"')) return JSON.parse(value);
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function serialiseScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

export function parseFrontMatterText(text, file = '<memory>') {
  const source = normaliseNewlines(text);
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  invariant(match, `${file}: missing YAML front matter`);
  const data = {};
  const order = [];
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf(':');
    invariant(index > 0, `${file}: malformed front-matter line ${JSON.stringify(line)}`);
    const key = line.slice(0, index).trim();
    invariant(/^[a-z][a-z0-9_]*$/i.test(key), `${file}: invalid front-matter key ${key}`);
    invariant(!(key in data), `${file}: duplicate front-matter key ${key}`);
    data[key] = parseScalar(line.slice(index + 1));
    order.push(key);
  }
  return { data, body: source.slice(match[0].length), order };
}

export function readFrontMatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return { ...parseFrontMatterText(text, path.relative(ROOT, filePath)), text };
}

export function writeFrontMatter(filePath, patch) {
  const current = readFrontMatter(filePath);
  const data = { ...current.data, ...patch };
  const preferred = ['schema', 'generation', 'status', 'scope', 'active_scope', 'parent', 'next', 'closure_generation'];
  const keys = [...preferred.filter(key => key in data), ...current.order.filter(key => !preferred.includes(key) && key in data)];
  for (const key of Object.keys(data)) if (!keys.includes(key)) keys.push(key);
  const header = keys.map(key => `${key}: ${serialiseScalar(data[key])}`).join('\n');
  writeText(filePath, `---\n${header}\n---\n${current.body.replace(/^\n+/, '')}`);
}

export function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const next = normaliseNewlines(content).replace(/\s*$/, '\n');
  if (fs.existsSync(filePath) && normaliseNewlines(fs.readFileSync(filePath, 'utf8')) === next) return false;
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

export function writeJson(filePath, value) {
  return writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function listScopeDocuments() {
  invariant(fs.existsSync(SCOPE_DIR), 'scope-of-works/ is missing');
  const files = fs.readdirSync(SCOPE_DIR)
    .filter(name => /^\d{12}-(?:\d{2}-[a-z0-9-]+|scope-of-works)\.md$/.test(name))
    .sort();
  return files.map(name => {
    const filePath = path.join(SCOPE_DIR, name);
    const parsed = readFrontMatter(filePath);
    return { name, filePath, ...parsed };
  });
}

export function masterDocument(documents = listScopeDocuments()) {
  const master = documents.find(item => item.name === MASTER_NAME);
  invariant(master, `${MASTER_NAME} is missing`);
  return master;
}

export function numberedScopes(documents = listScopeDocuments()) {
  return documents.filter(item => Number(item.data.scope) > 0).sort((a, b) => Number(a.data.scope) - Number(b.data.scope));
}

export function activeScope(documents = listScopeDocuments()) {
  const active = numberedScopes(documents).filter(item => item.data.status === 'active');
  invariant(active.length <= 1, `expected at most one active numbered scope, found ${active.map(item => item.name).join(', ')}`);
  return active[0] || null;
}

export function sha256Buffer(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

// Text assets in this repository are hashed as they are PUBLISHED, which is LF:
// the sums were generated from git blob content and GitHub Pages serves those
// same bytes. A Windows checkout with core.autocrlf=true writes CRLF into the
// working copy, so hashing the file on disk disagrees with every published
// digest and the release verifier fails on a tree nobody has touched.
//
// This is the same defect that made pipelinenews .sha256 sidecars attest bytes
// that were never served. Normalising here makes the check answer the question
// that matters -- do the bytes we publish match what we said we published --
// instead of a question about the reader's line-ending settings.
const LF_NORMALISED_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.css', '.html', '.htm', '.json', '.geojson',
  '.txt', '.md', '.yml', '.yaml', '.svg'
]);

export function sha256PublishedFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (!LF_NORMALISED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return sha256Buffer(bytes);
  }
  const normalised = Buffer.from(
    bytes.toString('binary').replace(/\r\n/g, '\n'), 'binary');
  return sha256Buffer(normalised);
}

export function londonGeneration(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value;
  return `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}`;
}

function addMinute(generation) {
  invariant(/^\d{12}$/.test(generation), `invalid generation ${generation}`);
  const date = new Date(Date.UTC(
    Number(generation.slice(0, 4)),
    Number(generation.slice(4, 6)) - 1,
    Number(generation.slice(6, 8)),
    Number(generation.slice(8, 10)),
    Number(generation.slice(10, 12))
  ));
  date.setUTCMinutes(date.getUTCMinutes() + 1);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}

export function nextGeneration(previous) {
  const now = londonGeneration();
  return Number(now) > Number(previous) ? now : addMinute(previous);
}

export function scopeFileName(generation, scope, slug) {
  invariant(/^\d{12}$/.test(generation), `invalid scope generation ${generation}`);
  invariant(Number.isInteger(scope) && scope > 0 && scope < 100, `invalid scope number ${scope}`);
  invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), `invalid scope slug ${slug}`);
  return `${generation}-${String(scope).padStart(2, '0')}-${slug}.md`;
}

export function scopeMarkdown({ generation, scope, parent, title, body }) {
  return `---\nschema: "gridatlas.scope-of-works.v1"\ngeneration: "${generation}"\nstatus: "active"\nscope: ${scope}\nparent: "${parent}"\nnext: null\n---\n# ${title}\n\n${body.trim()}\n`;
}

export function githubOutput(values) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value).replaceAll('\n', '%0A')}`);
  fs.appendFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

export function relativePosix(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}
