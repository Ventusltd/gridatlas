import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, SCOPE_DIR, MASTER_NAME, CURRENT_RELEASE, SHARED_400KV_CARTRIDGE,
  EXPECTED_RELEASES, ACTIVE_WORKFLOWS, invariant, listScopeDocuments,
  masterDocument, numberedScopes, activeScope, readJson, sha256File,
  writeText, githubOutput, relativePosix
} from './lib.mjs';

const RELEASE_PATTERN = /^\d{12}-atlas-v9$/;
const ALLOWED_STATUS = new Set(['active', 'done', 'blocked']);

function existingDirectories(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function existingFiles(directory, pattern = null) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && (!pattern || pattern.test(entry.name)))
    .map(entry => entry.name)
    .sort();
}

function verifyReleaseChecksums(releaseDirectory) {
  const sumsPath = path.join(releaseDirectory, 'sha256sums.txt');
  invariant(fs.existsSync(sumsPath), `${relativePosix(sumsPath)} is missing`);
  const lines = fs.readFileSync(sumsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  invariant(lines.length >= 20, `${relativePosix(sumsPath)} has an implausible entry count`);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    invariant(match, `${relativePosix(sumsPath)}: malformed checksum line ${JSON.stringify(line)}`);
    const target = path.resolve(releaseDirectory, match[2]);
    invariant(target.startsWith(`${path.resolve(releaseDirectory)}${path.sep}`), `${relativePosix(sumsPath)}: path escapes release: ${match[2]}`);
    invariant(fs.existsSync(target), `${relativePosix(target)} is missing`);
    invariant(sha256File(target) === match[1], `${relativePosix(target)} SHA-256 mismatch`);
  }
}

function validateScopeLedger() {
  const documents = listScopeDocuments();
  const byName = new Map(documents.map(item => [item.name, item]));
  const master = masterDocument(documents);
  const scopes = numberedScopes(documents);

  invariant(master.data.schema === 'gridatlas.scope-of-works.v1', `${MASTER_NAME}: schema mismatch`);
  invariant(master.data.scope === 0, `${MASTER_NAME}: scope must be 0`);
  invariant(['active', 'done'].includes(master.data.status), `${MASTER_NAME}: invalid status`);

  const seenScopeNumbers = new Set();
  for (const document of documents) {
    invariant(document.data.schema === 'gridatlas.scope-of-works.v1', `${document.name}: schema mismatch`);
    invariant(ALLOWED_STATUS.has(document.data.status), `${document.name}: invalid status ${document.data.status}`);
    invariant(/^\d{12}$/.test(String(document.data.generation)), `${document.name}: invalid generation`);
    invariant(document.name.startsWith(String(document.data.generation)), `${document.name}: filename/generation mismatch`);
    invariant(Number.isInteger(document.data.scope), `${document.name}: scope must be an integer`);
    if (document.data.scope > 0) {
      invariant(!seenScopeNumbers.has(document.data.scope), `${document.name}: duplicate scope ${document.data.scope}`);
      seenScopeNumbers.add(document.data.scope);
      invariant(document.data.scope >= 1 && document.data.scope <= 6, `${document.name}: scope outside 1..6`);
    }
    if (document.data.parent !== null) invariant(byName.has(document.data.parent), `${document.name}: missing parent ${document.data.parent}`);
    if (document.data.next !== null) invariant(byName.has(document.data.next), `${document.name}: missing next ${document.data.next}`);
  }

  scopes.forEach((document, index) => {
    const expectedScope = index + 1;
    invariant(document.data.scope === expectedScope, `${document.name}: expected contiguous scope ${expectedScope}`);
    const expectedParent = expectedScope === 1 ? MASTER_NAME : scopes[index - 1].name;
    invariant(document.data.parent === expectedParent, `${document.name}: parent must be ${expectedParent}`);
    if (index > 0) {
      invariant(Number(document.data.generation) > Number(scopes[index - 1].data.generation), `${document.name}: generation must advance beyond its parent scope`);
    }
    if (document.data.status === 'done' && document.data.scope < 6) {
      invariant(document.data.next !== null, `${document.name}: completed scope must point to successor`);
    }
    if (document.data.status === 'active') invariant(document.data.next === null, `${document.name}: active scope must not pre-name its successor`);
  });

  const active = activeScope(documents);
  if (master.data.status === 'active') {
    invariant(active, 'master is active but no numbered scope is active');
    invariant(master.data.active_scope === active.data.scope, `${MASTER_NAME}: active_scope does not match ${active.name}`);
    invariant(scopes.filter(item => item.data.status === 'active').length === 1, 'exactly one numbered scope must be active');
    invariant(scopes.filter(item => item.data.status === 'blocked').length === 0, 'blocked scope requires human repair before loop continues');
  } else {
    invariant(!active, 'master is done but a numbered scope remains active');
    invariant(scopes.length === 6 && scopes.every(item => item.data.status === 'done'), 'closed master requires six completed scopes');
    invariant(master.data.active_scope === null, 'closed master active_scope must be null');
  }

  invariant(master.data.next === scopes[0]?.name, `${MASTER_NAME}: next must identify Scope 1`);
  return { documents, master, scopes, active };
}

function validateWorkflowBudget(master) {
  const workflowDirectory = path.join(ROOT, '.github', 'workflows');
  const activeFiles = existingFiles(workflowDirectory, /\.ya?ml$/);
  invariant(JSON.stringify(activeFiles) === JSON.stringify([...ACTIVE_WORKFLOWS].sort()), `active workflow budget mismatch: ${JSON.stringify(activeFiles)}`);

  const archiveDirectory = path.join(ROOT, '.github', 'workflow-archive', '202608301321-hostile-amnesia');
  const archived = existingFiles(archiveDirectory, /\.ya?ml$/);
  invariant(archived.length === 21, `expected 21 archived one-off workflows, found ${archived.length}`);

  const loopWorkflow = fs.readFileSync(path.join(workflowDirectory, ACTIVE_WORKFLOWS[0]), 'utf8');
  invariant(loopWorkflow.includes('11bd71901bbe5b1630ceea73d27597364c9af683'), 'checkout action must be pinned by full SHA');
  if (master.data.status === 'done') {
    invariant(loopWorkflow.includes('scope-loop-mode: retired'), 'closed scope loop must be retired');
    invariant(!/^\s*schedule:/m.test(loopWorkflow), 'retired scope loop must not retain a schedule');
  } else {
    invariant(loopWorkflow.includes('scope-loop-mode: active'), 'active scope loop marker is missing');
    invariant(/^\s*schedule:/m.test(loopWorkflow), 'active scope loop requires its bounded fallback schedule');
  }
}

function validateAtlasLayout(scopeState) {
  const rootReleases = existingDirectories(ROOT).filter(name => RELEASE_PATTERN.test(name));
  const scope1Done = scopeState.scopes.some(item => item.data.scope === 1 && item.data.status === 'done');
  const scope2Done = scopeState.scopes.some(item => item.data.scope === 2 && item.data.status === 'done');

  if (!scope1Done) {
    invariant(JSON.stringify(rootReleases) === JSON.stringify([...EXPECTED_RELEASES].sort()), `pre-migration root release set changed: ${JSON.stringify(rootReleases)}`);
    return;
  }

  invariant(rootReleases.length === 0, `top-level release directories remain: ${rootReleases.join(', ')}`);
  const releaseRoot = path.join(ROOT, 'atlas', 'releases');
  const movedReleases = existingDirectories(releaseRoot).filter(name => RELEASE_PATTERN.test(name));
  invariant(JSON.stringify(movedReleases) === JSON.stringify([...EXPECTED_RELEASES].sort()), `atlas/releases immutable baseline mismatch: ${JSON.stringify(movedReleases)}`);
  invariant(fs.existsSync(path.join(releaseRoot, 'cartridges', SHARED_400KV_CARTRIDGE, 'grid_400kv.geojson')), 'shared 400 kV cartridge was not moved with the release baseline');
  invariant(!fs.existsSync(path.join(ROOT, 'cartridges', SHARED_400KV_CARTRIDGE)), 'old shared 400 kV cartridge path still exists');

  const rootIndex = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  invariant(rootIndex.includes('./atlas/'), 'root index does not redirect to ./atlas/');
  invariant(!rootIndex.includes(CURRENT_RELEASE), 'root index still hard-codes a full release');

  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  const atlasIndexPath = path.join(ROOT, 'atlas', 'index.html');
  invariant(fs.existsSync(currentPath), 'atlas/current.json is missing');
  invariant(fs.existsSync(atlasIndexPath), 'atlas/index.html is missing');
  const current = readJson(currentPath);
  invariant(current.release_id === CURRENT_RELEASE, 'atlas/current.json release_id mismatch');
  invariant(current.live_route === '/gridatlas/atlas/', 'atlas/current.json live_route mismatch');
  invariant(current.release_route === `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`, 'atlas/current.json release_route mismatch');

  const pointerA = readJson(path.join(ROOT, 'releases', 'current-v5.json'));
  const pointerB = readJson(path.join(ROOT, 'state', 'live-set.json'));
  invariant(JSON.stringify(pointerA) === JSON.stringify(pointerB), 'releases/current-v5.json and state/live-set.json diverged');
  invariant(pointerA.current?.live_url === 'https://ventusltd.github.io/gridatlas/atlas/', 'live pointer does not name stable atlas route');
  invariant(pointerA.current?.route === '/gridatlas/atlas/', 'live pointer route mismatch');
  invariant(pointerA.current?.release_route === `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`, 'live pointer release route mismatch');

  verifyReleaseChecksums(path.join(releaseRoot, CURRENT_RELEASE));

  if (scope2Done) {
    invariant(current.schema === 'gridatlas.current.v2', 'modular atlas/current.json schema is not v2');
    invariant(current.architecture === 'IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES', 'modular architecture marker is missing');
    invariant(current.shell?.index === `./releases/${CURRENT_RELEASE}/index.html`, 'shell index mismatch');
    invariant(current.shell?.base === `./releases/${CURRENT_RELEASE}/`, 'shell base mismatch');
    invariant(Array.isArray(current.cartridge_order) && Array.isArray(current.cartridges), 'cartridge registry is malformed');
    invariant(new Set(current.cartridge_order).size === current.cartridge_order.length, 'cartridge_order contains duplicates');
    const byId = new Map(current.cartridges.map(item => [item.id, item]));
    invariant(byId.size === current.cartridges.length, 'cartridge IDs are not unique');
    for (const id of current.cartridge_order) {
      const cartridge = byId.get(id);
      invariant(cartridge, `cartridge_order references missing ${id}`);
      invariant(/^[a-f0-9]{64}$/.test(cartridge.sha256 || ''), `${id}: invalid SHA-256`);
      const cartridgePath = path.resolve(path.join(ROOT, 'atlas'), cartridge.path);
      invariant(cartridgePath.startsWith(`${path.resolve(path.join(ROOT, 'atlas'))}${path.sep}`), `${id}: path escapes atlas/`);
      invariant(fs.existsSync(cartridgePath), `${id}: ${relativePosix(cartridgePath)} is missing`);
      invariant(sha256File(cartridgePath) === cartridge.sha256, `${id}: SHA-256 mismatch`);
      invariant(fs.statSync(cartridgePath).size <= 400_000, `${id}: cartridge exceeds 400 kB boundary`);
    }
    const atlasIndex = fs.readFileSync(atlasIndexPath, 'utf8');
    invariant(atlasIndex.includes('crypto.subtle.digest'), 'atlas loader does not verify cartridge SHA-256');
    invariant(atlasIndex.includes('document.write'), 'atlas loader does not compose the immutable shell');
    invariant(atlasIndex.includes('cartridge_order'), 'atlas loader does not obey cartridge order');

    for (const obsolete of ['successor', 'successor-202608291239', 'successor-202608291430', 'v8-mirror']) {
      invariant(!fs.existsSync(path.join(ROOT, 'ui', obsolete)), `obsolete UI copy remains: ui/${obsolete}`);
    }
    invariant(!fs.existsSync(path.join(ROOT, 'assets')), 'obsolete root assets copy remains');
    invariant(!fs.existsSync(path.join(ROOT, 'cartridges')), 'obsolete root cartridges copy remains');
  }
}

function lint() {
  const scopeState = validateScopeLedger();
  validateWorkflowBudget(scopeState.master);
  validateAtlasLayout(scopeState);
  console.log(`scope-ledger=PASS active=${scopeState.active?.name || 'none'} master=${scopeState.master.data.status}`);
  return scopeState;
}

function renderState(scopeState) {
  const rootReleaseCount = existingDirectories(ROOT).filter(name => RELEASE_PATTERN.test(name)).length;
  const atlasReleaseCount = existingDirectories(path.join(ROOT, 'atlas', 'releases')).filter(name => RELEASE_PATTERN.test(name)).length;
  let composition = 'not-created';
  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  if (fs.existsSync(currentPath)) {
    const current = readJson(currentPath);
    composition = `${current.generation} · ${current.release_id} · ${(current.cartridge_order || []).join(' → ') || 'shell only'}`;
  }
  const rows = scopeState.scopes.map(item => `| ${item.data.scope} | ${item.data.generation} | ${item.data.status} | ${item.name} |`).join('\n');
  const state = `# GridAtlas durable state\n\n- Master: \`${scopeState.master.data.status}\`\n- Active scope: \`${scopeState.active?.name || 'none'}\`\n- Composition: \`${composition}\`\n- Top-level full release copies: \`${rootReleaseCount}\`\n- Immutable releases under atlas/releases: \`${atlasReleaseCount}\`\n- Active workflows: \`${ACTIVE_WORKFLOWS.length}\`\n- Historical workflows archived: \`21\`\n- Last-known-green shell: \`${CURRENT_RELEASE}\`\n\n| Scope | Generation | Status | Ledger file |\n|---:|---:|---|---|\n${rows}\n\nThis file is generated deterministically by \`node tools/scope/loop.mjs state\`.\n`;
  writeText(path.join(ROOT, 'STATE.md'), state);
  console.log('STATE.md=UPDATED');
}

function next(scopeState) {
  const active = scopeState.active;
  const output = {
    pending: Boolean(active),
    scope_file: active?.name || '',
    scope_number: active?.data.scope || '',
    generation: active?.data.generation || ''
  };
  githubOutput(output);
  console.log(JSON.stringify(output));
}

const command = process.argv[2] || 'lint';
try {
  if (command === 'lint') lint();
  else if (command === 'state') renderState(lint());
  else if (command === 'next') next(lint());
  else throw new Error(`unknown command ${command}`);
} catch (error) {
  console.error(`[scope-loop:${command}] ${error?.stack || error}`);
  process.exitCode = 1;
}
