import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ROOT, SCOPE_DIR, MASTER_NAME, CURRENT_RELEASE, SHARED_400KV_CARTRIDGE,
  EXPECTED_RELEASES, invariant, listScopeDocuments, activeScope, readJson,
  writeJson, writeText, writeFrontMatter, nextGeneration, scopeFileName,
  scopeMarkdown, sha256File, githubOutput, relativePosix
} from './lib.mjs';

const MASTER_PATH = path.join(SCOPE_DIR, MASTER_NAME);
const LIVE_POINTERS = [
  path.join(ROOT, 'releases', 'current-v5.json'),
  path.join(ROOT, 'state', 'live-set.json')
];

function moveDirectory(from, to) {
  if (fs.existsSync(from) && fs.existsSync(to)) throw new Error(`both source and destination exist: ${relativePosix(from)} and ${relativePosix(to)}`);
  if (!fs.existsSync(from)) {
    invariant(fs.existsSync(to), `missing both source and destination for ${relativePosix(from)}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

function removePath(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], { cwd: ROOT, encoding: 'utf8' });
  invariant(result.status === 0, `${relativePosix(filePath)} syntax check failed: ${result.stderr || result.stdout}`);
}

function finishScope(document, nextScope, slug, title, body) {
  const generation = nextGeneration(String(document.data.generation));
  const nextName = scopeFileName(generation, nextScope, slug);
  writeFrontMatter(document.filePath, { status: 'done', next: nextName });
  writeText(path.join(SCOPE_DIR, nextName), scopeMarkdown({
    generation,
    scope: nextScope,
    parent: document.name,
    title,
    body
  }));
  writeFrontMatter(MASTER_PATH, { active_scope: nextScope });
  return { nextName, generation };
}

function finishFinal(document) {
  const closureGeneration = nextGeneration(String(document.data.generation));
  writeFrontMatter(document.filePath, { status: 'done', next: null });
  writeFrontMatter(MASTER_PATH, { status: 'done', active_scope: null, closure_generation: closureGeneration });
  const closureName = `${closureGeneration}-closure.md`;
  writeText(path.join(SCOPE_DIR, closureName), `---\nschema: "gridatlas.scope-closure.v1"\ngeneration: "${closureGeneration}"\nstatus: "done"\nparent: "${document.name}"\n---\n# GridAtlas scope loop closed\n\nAll six bounded scopes are complete. The loop schedule is retired. The immutable shell remains \`${CURRENT_RELEASE}\`; future application changes must be SHA-256 cartridges ordered by \`atlas/current.json\`, not copied application folders.\n`);
  return { nextName: '', generation: closureGeneration };
}

function temporaryAtlasRouter() {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grid Atlas</title></head><body><p><a id="open" href="./releases/${CURRENT_RELEASE}/">Open Grid Atlas</a></p><script type="module">const current=await fetch('./current.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('current.json HTTP '+response.status);return response.json()});const target=new URL(current.release_route,window.location.origin);target.search=window.location.search;target.hash=window.location.hash;window.location.replace(target.href);</script></body></html>\n`;
}

function rootRouter() {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="gridatlas-current-route" content="atlas"><title>Grid Atlas</title><script>(()=>{const target='./atlas/';window.location.replace(target+window.location.search+window.location.hash);})();</script></head><body data-gridatlas-current-route="atlas"><main><h1>Grid Atlas</h1><p><a href="./atlas/">Open Atlas</a></p></main></body></html>\n`;
}

function rewriteLivePointers(routerGeneration) {
  const pointer = readJson(LIVE_POINTERS[0]);
  pointer.current.live_url = 'https://ventusltd.github.io/gridatlas/atlas/';
  pointer.current.route = '/gridatlas/atlas/';
  pointer.current.release_route = `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`;
  pointer.current.runtime.shared_cartridge_path = `atlas/releases/cartridges/${SHARED_400KV_CARTRIDGE}/grid_400kv.geojson`;
  pointer.current.atlas_router_generation = routerGeneration;
  pointer.predecessor.live_url = `https://ventusltd.github.io/gridatlas/atlas/releases/${pointer.predecessor.release_id}/`;
  pointer.predecessor.route = `/gridatlas/atlas/releases/${pointer.predecessor.release_id}/`;
  pointer.rollback.route = `/gridatlas/atlas/releases/${pointer.rollback.release_id}/`;
  pointer.atlas = {
    schema: 'gridatlas.router.v1',
    generation: routerGeneration,
    stable_route: '/gridatlas/atlas/',
    immutable_release_route: `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`,
    no_new_application_copy: true
  };
  for (const filePath of LIVE_POINTERS) writeJson(filePath, pointer);
}

function scope1(document) {
  const releaseRoot = path.join(ROOT, 'atlas', 'releases');
  fs.mkdirSync(releaseRoot, { recursive: true });
  for (const release of EXPECTED_RELEASES) moveDirectory(path.join(ROOT, release), path.join(releaseRoot, release));
  moveDirectory(
    path.join(ROOT, 'cartridges', SHARED_400KV_CARTRIDGE),
    path.join(releaseRoot, 'cartridges', SHARED_400KV_CARTRIDGE)
  );

  const generation = String(document.data.generation);
  writeJson(path.join(ROOT, 'atlas', 'current.json'), {
    schema: 'gridatlas.current.v1',
    generation,
    architecture: 'MOVED_RELEASE_BASELINE',
    live_route: '/gridatlas/atlas/',
    release_id: CURRENT_RELEASE,
    release_route: `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`,
    shell_index: `./releases/${CURRENT_RELEASE}/index.html`,
    last_known_green: `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`,
    cartridge_order: [],
    cartridges: []
  });
  writeText(path.join(ROOT, 'atlas', 'index.html'), temporaryAtlasRouter());
  writeText(path.join(ROOT, 'index.html'), rootRouter());
  rewriteLivePointers(generation);

  return finishScope(document, 2, 'modularise-immutable-shell-and-cartridges', 'Scope 2 — modularise the Atlas shell and cartridges', `Do only this scope.\n\n## Changes\n\n- Replace the temporary Atlas redirect with the stable SHA-verifying composer in \`atlas/index.html\`.\n- Keep \`${CURRENT_RELEASE}\` byte-identical as the immutable shell.\n- Define ordered cartridges in \`atlas/current.json\`; an empty order must reproduce the shell.\n- Remove obsolete working copies under \`ui/successor*\`, \`ui/v8-mirror\`, root \`assets/\`, and root \`cartridges/\`. Git history and immutable releases preserve provenance.\n\n## Prohibited\n\n- No search or geocoder changes.\n- No ninth full application release.\n- No edits inside \`atlas/releases/${CURRENT_RELEASE}/\`.\n\n## Acceptance\n\n- \`atlas/current.json\` declares \`IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES\`.\n- \`atlas/index.html\` SHA-verifies every cartridge before composition.\n- The immutable shell checksums still pass.\n- On green, write the timestamped Scope 3 file.`);
}

function scope2(document) {
  const loaderSource = fs.readFileSync(path.join(ROOT, 'tools', 'scope', 'payloads', 'atlas-loader.html'), 'utf8');
  writeText(path.join(ROOT, 'atlas', 'index.html'), loaderSource);
  const previous = readJson(path.join(ROOT, 'atlas', 'current.json'));
  const generation = String(document.data.generation);
  writeJson(path.join(ROOT, 'atlas', 'current.json'), {
    schema: 'gridatlas.current.v2',
    generation,
    previous_generation: previous.generation,
    architecture: 'IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES',
    live_route: '/gridatlas/atlas/',
    release_id: CURRENT_RELEASE,
    release_route: `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`,
    shell: {
      release_id: CURRENT_RELEASE,
      index: `./releases/${CURRENT_RELEASE}/index.html`,
      base: `./releases/${CURRENT_RELEASE}/`
    },
    cartridge_order: [],
    cartridges: [],
    last_known_green: {
      release_id: CURRENT_RELEASE,
      route: `/gridatlas/atlas/releases/${CURRENT_RELEASE}/`
    },
    contracts: {
      new_full_application_folders: 0,
      cartridge_sha256_required: true,
      cartridge_order_explicit: true,
      shell_mutation_forbidden: true
    }
  });

  for (const obsolete of ['successor', 'successor-202608291239', 'successor-202608291430', 'v8-mirror']) {
    removePath(path.join(ROOT, 'ui', obsolete));
  }
  removePath(path.join(ROOT, 'assets'));
  removePath(path.join(ROOT, 'cartridges'));
  writeText(path.join(ROOT, 'atlas', 'README.md'), `# Atlas runtime\n\n\`atlas/index.html\` is the stable composer. It fetches one immutable shell from \`atlas/releases/\`, verifies each listed cartridge with SHA-256, replaces only named cartridge slots, and writes the composed document.\n\nThe only mutable application pointer is \`atlas/current.json\`. New features must be bounded cartridges; do not copy the whole application.\n`);

  return finishScope(document, 3, 'apply-pipelinenews-lessons', 'Scope 3 — apply PipelineNews repository lessons', `Do only this scope.\n\n## Changes\n\n- Record the inspected PipelineNews tree and the patterns adopted by GridAtlas.\n- Define stable module namespaces for cartridges, manifests, state, and UI source.\n- Preserve the archived one-off workflows as evidence; do not reactivate them.\n\n## Acceptance\n\n- The record cites \`Ventusltd/pipelinenews\` and inspected tree \`83d9c430b283f8beaa8c0a05e42b14d4a4784623\`.\n- GridAtlas explicitly distinguishes stable source modules from timestamped outputs.\n- On green, write the timestamped Scope 4 file.`);
}

function scope3(document) {
  const generation = String(document.data.generation);
  writeText(path.join(ROOT, 'atlas', 'architecture', `${generation}-pipelinenews-lessons.md`), `# PipelineNews lessons applied to GridAtlas\n\nSource repository: https://github.com/Ventusltd/pipelinenews  \nInspected tree: \`83d9c430b283f8beaa8c0a05e42b14d4a4784623\`\n\n## Adopted\n\n- Stable source areas for UI, cartridges, manifests, state and automation.\n- Timestamped scope records and compiled manifests, not timestamped copies of source modules.\n- One mutable live pointer plus immutable evidence.\n- One-off workflows moved to \`.github/workflow-archive/\` rather than left active.\n- CI/CD performs deterministic compilation and gates; human and AI context is reconstructed from repository state.\n\n## Deliberately not copied\n\n- Workflow proliferation.\n- Full application duplication for minor feature changes.\n- Implicit release ordering or multiple live pointers.\n`);
  writeJson(path.join(ROOT, 'atlas', 'modules.json'), {
    schema: 'gridatlas.modules.v1',
    generation,
    source_patterns_from: {
      repository: 'Ventusltd/pipelinenews',
      tree: '83d9c430b283f8beaa8c0a05e42b14d4a4784623'
    },
    modules: {
      composer: './index.html',
      cartridges: './cartridges/',
      manifests: './manifests/',
      state: './state/',
      immutable_releases: './releases/',
      ui_source: '../ui/'
    },
    timestamp_policy: 'TIMESTAMPS_FOR_SCOPES_MANIFESTS_AND_OUTPUTS_NOT_STABLE_MODULE_NAMES'
  });
  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  const current = readJson(currentPath);
  current.generation = generation;
  current.previous_generation = current.previous_generation || '202608301321';
  current.provenance = {
    ...(current.provenance || {}),
    pipelinenews_repository: 'https://github.com/Ventusltd/pipelinenews',
    pipelinenews_tree: '83d9c430b283f8beaa8c0a05e42b14d4a4784623',
    cvaa_guide: 'https://github.com/Ventusltd/cvaa/blob/main/202608301321-gridatlas-amnesia-vaccine.txt'
  };
  writeJson(currentPath, current);

  return finishScope(document, 4, 'add-uk-location-search-cartridge', 'Scope 4 — add UK postcode and town location search', `Do only this scope.\n\n## Changes\n\n- Derive \`atlas/cartridges/202608301136-place-postcode-search.js\` from the immutable shell search script.\n- Add the postcodes.io postcode, outcode and OS Open Names place lane.\n- Keep REPD results first and exact REPD identity/deep-link behaviour unchanged.\n- Add \`ui/cartridges/202608301136-uk-gazetteer-flyto.mjs\`.\n- Activate the script as a SHA-256 replacement cartridge in \`atlas/current.json\`.\n\n## Acceptance\n\n- Location results are \`LOCATION_ONLY\`, never set \`repd_ref\`, and remove a stale \`repd_ref\` on selection.\n- Full postcode, outcode and place branches exist.\n- The REPD and geocoder queries run concurrently with a stale-response guard.\n- Geocoder failure cannot break the REPD lane.\n- No immutable release file changes.\n- On green, write the timestamped Scope 5 file.`);
}

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  invariant(first >= 0, `search patch missing ${label}`);
  invariant(source.indexOf(search, first + search.length) < 0, `search patch ${label} is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function buildLocationSearchCartridge(source) {
  let output = source;
  output = replaceExactlyOnce(
    output,
    "  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';",
    "  const GEOCODER_BASE = 'https://api.postcodes.io';\n  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';",
    'GEOCODER_BASE insertion'
  );
  output = replaceExactlyOnce(output, "    schema: 'gridatlas.v9-place-postcode-search.v1',", "    schema: 'gridatlas.v9-place-postcode-search.v2',", 'schema bump');
  output = replaceExactlyOnce(output, "    generation: '202608300453',", "    generation: '202608301136',", 'generation bump');
  output = replaceExactlyOnce(
    output,
    '    parquet_url: PARQUET_URL,',
    "    geocoder: GEOCODER_BASE,\n    geocoder_requests: 0,\n    geocoder_failures: [],\n    last_location_selection: null,\n    parquet_url: PARQUET_URL,",
    'geocoder state'
  );
  output = replaceExactlyOnce(output, '  async function queryOfficialRepd(query) {', '  async function queryOfficialRepd(query, serial = null) {', 'queryOfficialRepd signature');
  output = replaceExactlyOnce(output, '    const serial = ++activeQuerySerial;\n', '', 'old serial increment');
  output = replaceExactlyOnce(output, '    if (serial !== activeQuerySerial) return [];\n', '    if (serial !== null && serial !== activeQuerySerial) return [];\n', 'serial guard');

  const renderStart = output.indexOf('  function renderResults(');
  const waitStart = output.indexOf('  async function waitForCapturedMap');
  invariant(renderStart >= 0 && waitStart > renderStart, 'render/execute replacement markers missing');
  const gazetteer = fs.readFileSync(path.join(ROOT, 'tools', 'scope', 'patches', '202608301136-gazetteer.jsfrag'), 'utf8');
  const renderExecute = fs.readFileSync(path.join(ROOT, 'tools', 'scope', 'patches', '202608301136-render-execute.jsfrag'), 'utf8');
  output = `${output.slice(0, renderStart)}${gazetteer}\n${renderExecute}${output.slice(waitStart)}`;

  output = output.replace(/input\.setAttribute\('placeholder',\s*'[^']*'\);/, "input.setAttribute('placeholder', 'Search project, UK postcode or town...');");
  output = output.replace(/input\.setAttribute\('aria-label',\s*'[^']*'\);/, "input.setAttribute('aria-label', 'Search project, UK postcode or town');");

  for (const required of [
    "const GEOCODER_BASE = 'https://api.postcodes.io'",
    "kind: 'postcode'",
    "kind: 'postcode_district'",
    "kind: 'place'",
    'Promise.all([',
    "url.searchParams.delete('repd_ref')",
    'fly to only, not a REPD project',
    'No REPD project, UK postcode or place match'
  ]) invariant(output.includes(required), `generated location cartridge missing ${required}`);
  return output;
}

function scope4(document) {
  const sourcePath = path.join(ROOT, 'atlas', 'releases', CURRENT_RELEASE, '202608291818-place-postcode-search.js');
  const cartridgePath = path.join(ROOT, 'atlas', 'cartridges', '202608301136-place-postcode-search.js');
  const cartridge = buildLocationSearchCartridge(fs.readFileSync(sourcePath, 'utf8'));
  writeText(cartridgePath, cartridge);
  runNodeCheck(cartridgePath);

  const contractPath = path.join(ROOT, 'ui', 'cartridges', '202608301136-uk-gazetteer-flyto.mjs');
  writeText(contractPath, `export const ATLAS_V9_UK_GAZETTEER_FLYTO_CONTRACT = Object.freeze({\n  schema: 'gridatlas.cartridge.v1',\n  generation: '202608301136',\n  activation: 'explicit-user-query-only',\n  externalGeocoderRequests: 2,\n  provider: 'postcodes.io',\n  resultClass: 'LOCATION_ONLY',\n  proximityEstablishesIdentity: false,\n  setsDeepLink: false\n});\n`);
  runNodeCheck(contractPath);

  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  const current = readJson(currentPath);
  const generation = String(document.data.generation);
  current.previous_generation = current.generation;
  current.generation = generation;
  current.cartridge_order = ['uk-gazetteer-flyto'];
  current.cartridges = [{
    id: 'uk-gazetteer-flyto',
    generation: '202608301136',
    type: 'script',
    slot: 'replace-script',
    replace_script: '202608291818-place-postcode-search.js',
    path: './cartridges/202608301136-place-postcode-search.js',
    sha256: sha256File(cartridgePath),
    contract: '../ui/cartridges/202608301136-uk-gazetteer-flyto.mjs',
    result_class: 'LOCATION_ONLY',
    sets_deep_link: false
  }];
  current.search_lanes = {
    repd: { external_requests: 0, identity_claims: 'EXACT_REPD_REF_ONLY', first: true },
    uk_gazetteer: {
      provider: 'postcodes.io',
      endpoints: ['postcodes', 'outcodes', 'places'],
      identity_claims: 'none',
      external_requests_per_query_max: 2,
      result_class: 'LOCATION_ONLY'
    }
  };
  writeJson(currentPath, current);

  return finishScope(document, 5, 'compile-and-attest-cartridge-composition', 'Scope 5 — compile and attest the cartridge composition', `Do only this scope.\n\n## Changes\n\n- Create one timestamped composition manifest from the immutable shell and ordered cartridge hashes.\n- Update \`atlas/current.json\`, \`atlas/state/live-set.json\`, and the existing repository live pointers.\n- Run the structural composition verifier.\n\n## Prohibited\n\n- No new \`*-atlas-v9\` application directory.\n- No immutable shell mutation.\n\n## Acceptance\n\n- The manifest names the shell, every cartridge, every SHA-256 and the explicit order.\n- Root, shell and cartridge paths verify.\n- The next generation is represented by the Atlas pointer/manifest, not a copied application.\n- On green, write the timestamped Scope 6 file.`);
}

function updateCompositionPointers(current, manifestPath) {
  const pointer = readJson(LIVE_POINTERS[0]);
  pointer.current.atlas_composition = {
    schema: 'gridatlas.composition-pointer.v1',
    generation: current.generation,
    route: current.live_route,
    shell_release_id: current.shell.release_id,
    cartridge_order: current.cartridge_order,
    manifest: manifestPath.replace(/^\.\//, 'atlas/')
  };
  for (const filePath of LIVE_POINTERS) writeJson(filePath, pointer);
}

function scope5(document) {
  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  const current = readJson(currentPath);
  const generation = String(document.data.generation);
  const previousGeneration = current.generation;
  current.previous_generation = previousGeneration;
  current.generation = generation;

  const releaseDirectory = path.join(ROOT, 'atlas', 'releases', CURRENT_RELEASE);
  const manifestRelative = `./manifests/${generation}-composition.json`;
  const manifestPath = path.join(ROOT, 'atlas', 'manifests', `${generation}-composition.json`);
  const manifest = {
    schema: 'gridatlas.composition-manifest.v1',
    generation,
    parent_generation: previousGeneration,
    live_route: current.live_route,
    shell: {
      release_id: CURRENT_RELEASE,
      index: current.shell.index,
      base: current.shell.base,
      hashes: {
        index_html: sha256File(path.join(releaseDirectory, 'index.html')),
        css: sha256File(path.join(releaseDirectory, 'ventusv8.css')),
        engine: sha256File(path.join(releaseDirectory, 'ventus-corev8engine.js')),
        maplibre_worker_bridge: sha256File(path.join(releaseDirectory, '202608292311-maplibre-worker-bridge.js')),
        pre_snapped_adapter: sha256File(path.join(releaseDirectory, '202608292126-pre-snapped-config-adapter.js'))
      }
    },
    shared_runtime: {
      path: `./releases/cartridges/${SHARED_400KV_CARTRIDGE}/grid_400kv.geojson`,
      sha256: sha256File(path.join(ROOT, 'atlas', 'releases', 'cartridges', SHARED_400KV_CARTRIDGE, 'grid_400kv.geojson'))
    },
    cartridge_order: current.cartridge_order,
    cartridges: current.cartridges,
    acceptance: {
      full_application_copies_created: 0,
      immutable_shell_modified: false,
      exact_repd_identity_lane_preserved: true,
      uk_location_lane_result_class: 'LOCATION_ONLY',
      external_location_failure_isolated: true,
      runtime_browser_verification: 'REQUIRED_BY_202608301321-verify-live.yml'
    },
    scope_file: document.name
  };
  writeJson(manifestPath, manifest);
  current.composition_manifest = manifestRelative;
  writeJson(currentPath, current);
  writeJson(path.join(ROOT, 'atlas', 'state', 'live-set.json'), {
    schema: 'gridatlas.atlas-live-set.v1',
    generation,
    live_route: current.live_route,
    release_id: current.release_id,
    shell: current.shell,
    cartridge_order: current.cartridge_order,
    composition_manifest: manifestRelative,
    last_known_green: current.last_known_green
  });
  updateCompositionPointers(current, manifestRelative);

  const verification = spawnSync(process.execPath, ['tools/scope/verify-compose.mjs'], { cwd: ROOT, encoding: 'utf8' });
  invariant(verification.status === 0, `composition verification failed: ${verification.stderr || verification.stdout}`);

  return finishScope(document, 6, 'close-and-harden-cicd-loop', 'Scope 6 — close and harden the CI/CD loop', `Do only this scope.\n\n## Changes\n\n- Write the CVAA application and ratchet record.\n- Confirm only the scope loop and live verifier remain active; all 21 prior workflows remain archived.\n- Retire the scope loop schedule after closure.\n- Write the timestamped closure record and dispatch public verification.\n\n## Acceptance\n\n- Six scopes are done and no numbered scope remains active.\n- Root full-release count is zero; immutable baseline count is eight; active workflow count is two.\n- The loop workflow has no schedule after closure.\n- Public verification covers exact REPD deep link, postcode, town, REPD-first result ordering and geocoder-failure isolation.`);
}

function retireScopeLoopWorkflow() {
  const workflowPath = path.join(ROOT, '.github', 'workflows', '202608301321-scope-loop.yml');
  let workflow = fs.readFileSync(workflowPath, 'utf8');
  workflow = replaceExactlyOnce(workflow, '# scope-loop-mode: active', '# scope-loop-mode: retired', 'scope loop mode marker');
  const start = workflow.indexOf('# BEGIN ACTIVE TRIGGERS');
  const endMarker = '# END ACTIVE TRIGGERS';
  const end = workflow.indexOf(endMarker);
  invariant(start >= 0 && end > start, 'scope loop trigger markers missing');
  const retired = `# BEGIN ACTIVE TRIGGERS\non:\n  workflow_dispatch:\n# END ACTIVE TRIGGERS`;
  workflow = `${workflow.slice(0, start)}${retired}${workflow.slice(end + endMarker.length)}`;
  writeText(workflowPath, workflow);
}

function scope6(document) {
  const generation = String(document.data.generation);
  writeText(path.join(ROOT, 'governance', `${generation}-cvaa-gridatlas-application.md`), `# CVAA applied to GridAtlas\n\nGuide: https://github.com/Ventusltd/cvaa/blob/main/202608301321-gridatlas-amnesia-vaccine.txt\n\n## Active antibodies\n\n- One active numbered scope at a time.\n- One deterministic scope per workflow run.\n- Zero top-level full Atlas release directories.\n- Exactly eight immutable historical releases under \`atlas/releases/\`.\n- Zero future full application copies; changes are SHA-256 cartridges.\n- One mutable application composition pointer: \`atlas/current.json\`.\n- Two active workflows maximum; 21 expired workflows archived.\n- The scope schedule retires when the six-scope chain closes.\n\nThe enforcement code is \`tools/scope/loop.mjs\`; CI runs it before and after every bounded change.\n`);
  writeJson(path.join(ROOT, 'state', 'cvaa-ratchets.json'), {
    schema: 'gridatlas.cvaa-ratchets.v1',
    generation,
    maximums: {
      top_level_full_release_directories: 0,
      active_workflows: 2,
      active_numbered_scopes: 0,
      future_full_application_copies: 0,
      mutable_application_pointers: 1
    },
    exact: {
      immutable_release_baseline: 8,
      archived_legacy_workflows: 21
    },
    enforcement: 'tools/scope/loop.mjs'
  });
  retireScopeLoopWorkflow();
  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  const current = readJson(currentPath);
  current.scope_closure = { generation, status: 'DONE', scopes: 6, schedule_retired: true };
  writeJson(currentPath, current);

  const verification = spawnSync(process.execPath, ['tools/scope/verify-compose.mjs'], { cwd: ROOT, encoding: 'utf8' });
  invariant(verification.status === 0, `final composition verification failed: ${verification.stderr || verification.stdout}`);
  return finishFinal(document);
}

const handlers = new Map([
  [1, scope1], [2, scope2], [3, scope3], [4, scope4], [5, scope5], [6, scope6]
]);

try {
  const documents = listScopeDocuments();
  const document = activeScope(documents);
  invariant(document, 'no active scope to advance');
  const handler = handlers.get(Number(document.data.scope));
  invariant(handler, `no deterministic handler for scope ${document.data.scope}`);
  const result = handler(document);
  const commitMessage = `${document.data.generation}-gridatlas-scope-${String(document.data.scope).padStart(2, '0')}: ${document.body.split('\n')[0].replace(/^#\s*/, '')}`;
  githubOutput({
    completed_scope: document.data.scope,
    completed_scope_file: document.name,
    successor_scope_file: result.nextName,
    successor_generation: result.generation,
    commit_message: commitMessage
  });
  console.log(JSON.stringify({ completed: document.name, successor: result.nextName || null, generation: result.generation }));
} catch (error) {
  console.error(`[scope-advance] ${error?.stack || error}`);
  process.exitCode = 1;
}
