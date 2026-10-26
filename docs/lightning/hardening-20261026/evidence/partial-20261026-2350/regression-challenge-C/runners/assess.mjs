#!/usr/bin/env node
/**
 * assess.mjs — merge the group result files written by run-baseline.mjs into one
 * table and add an ASSESSED column: the machine classification stays in the
 * `result` column untouched; `assessed` is the auditor's reading, with the reason,
 * so a reader can disagree with either independently.
 *
 *   node assess.mjs --label baseline --dirs baseline-static,baseline-historical,baseline-python,baseline-browser,baseline-live --out baseline-table.md
 *   node assess.mjs --label candidate --dirs ... --out candidate-table.md --diff baseline-table.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const LABEL = arg('--label', 'baseline');
const DIRS = arg('--dirs', 'baseline-static,baseline-historical,baseline-python,baseline-browser,baseline-live').split(',').map(s => path.resolve(HERE, s.trim()));
const OUT = path.resolve(HERE, arg('--out', `${LABEL}-table.md`));
const DIFF = arg('--diff', '');

/* Auditor's overrides: id -> { assessed, why }. Applied only when the machine
   result is FAIL; a PASS or BLOCKED is never upgraded or downgraded here. */
const OVERRIDES = {
  'scope-lint': { assessed: 'FAIL (pre-existing on main)', why: 'STATE.md says 9 active workflows, .github/workflows holds 10 — the tenth is uk-lightning-preview.yml from the rejected preview work (brief, Known facts)' },
  'scope-state-stdout': { assessed: 'FAIL (pre-existing on main)', why: 'same workflow-budget invariant (tools/scope/loop.mjs:105 validateWorkflowBudget)' },
  'about-estate-and-attribution': { assessed: 'BLOCKED_HARNESS (stale proof, pre-existing)', why: 'its two print assertions (size:auto, map sized to printable area) encode the print design the owner overruled on 2026-09-05 ("just a screen grab"), see screen-grab-print-outcomes.browser.mjs header; 42 of 44 checks pass' },
  'menu-bar-attrib-clearance': { assessed: 'BLOCKED_HARNESS (stale proof, pre-existing)', why: 'asserts the credit sits unoccluded on the map; the owner later ordered it moved into About in small print (atlas/modules/202609031958-menu-bar.js:1593-1610), so in the fixture the credit now has no on-map box and elementFromPoint resolves to the File title; 17 of 24 pass' },
  'menu-bar-instrument-panel-202609041250': { assessed: 'BLOCKED_HARNESS (stale attribution checks, pre-existing)', why: 'the 10 failures are all the "attribution unoccluded with a panel open" checks, stale for the same reason; the masthead, 44 px control, and panel-containment checks (42) pass' },
  'all-versions-202609012150': { assessed: 'FAIL (pre-existing on main)', why: 'two things: (a) every sld-sandbox cartridge since 202609070913 carries 6371.0088/6371.008/6371.0 strings beside the canonical 6378.137 (the proof forbids a second radius anywhere); (b) the proof then crashes on a VERSION_LEDGER regex the current cartridge no longer satisfies. Neither is lightning; both must read identically on the candidate' },
  'data-contract-parity-202609012214': { assessed: 'FAIL (pre-existing on main)', why: 'bytes of sld-sandbox and substation-intelligence no longer name their declared product URLs in the string form the proof parses; not assessed further here, identical outcome required on the candidate' },
  'quantumspawn-recovery-202609012305': { assessed: 'FAIL (pre-existing on main)', why: 'the recovery capsule names an older generation/version than current.json (202609241334 / v9.156); documentation drift the capsule proof exists to catch' },
  'sld-styles-202609040400': { assessed: 'BLOCKED_HARNESS (stale proof, pre-existing)', why: 'reads sld.assembled_from from current.json; the 202609241334 sld-sandbox entry has derived_from instead, so the proof throws before asserting anything' },
  'sld-finance-fixture-202609010002': { assessed: 'BLOCKED_HARNESS (oracle upstream drift)', why: 'the GlobalGrid2050 sandbox files no longer hash as the committed fixture records (index.html, helpers, state, calculations, finance all differ); the oracle must be re-reviewed upstream, nothing in GridAtlas changed' },
  'modules-202609011950-module-parity': { assessed: 'FAIL (pre-existing on main)', why: '"the incumbent loaded the fixture product" fails and the proof then throws on network.byName; compares modules against the composed cartridge, pre-dates the current composition' },
  'modules-202609012130-declared-connections': { assessed: 'FAIL (pre-existing on main)', why: 'nearestTransmission() parity against the 202609012250 inline cartridge differs on the unnamed-wins-on-distance case; 18 of 19 pass; pre-dates lightning' },
  'historical-202609051522-sld-sandbox': { assessed: 'BLOCKED_HARNESS (stale pin)', why: 'pinned to 202609051522 and reads assembled_from which the current entry lacks' },
  'historical-202609051540-sld-sandbox': { assessed: 'BLOCKED_HARNESS (stale pin)', why: 'as above' },
  /* ---- shim-based run (the page boots; failures must be read per check) ---- */
  'baseline-browser-shim:all-controls-desktop': { assessed: 'PASS 20/26 · BLOCKED_DEPENDENCY 5 · BLOCKED_HARNESS 1', why: 'menus x6, status/radius/area/zone/measure, fullscreen, basemaps, CSV export, View+About expanders, Layers toggle, image/PDF/print export all PASS; csv-export-loaded (solar) and pipeline-same/wider/all need the REPD partitions read through DuckDB-wasm read_parquet (bridge queryOnDemand) and the +esm bundle is absent = BLOCKED_DEPENDENCY; search needs postcodes.io/Nominatim = BLOCKED_DEPENDENCY; card-minimise-restore-close hit Playwright\'s 6 s action timeout at "scrolling into view" while two other Chromiums shared the 2 cores = BLOCKED_HARNESS (re-run alone below)' },
  'baseline-browser-shim:all-controls-mobile': { assessed: 'PASS 21/26 · BLOCKED_DEPENDENCY 5', why: 'same 20 plus card-minimise-restore-close PASS at 393x852 touch; csv-export-loaded and pipeline x3 = DuckDB +esm; search = postcodes.io/Nominatim' },
  'baseline-browser-shim:all-layer-clicks-1440': { assessed: 'PASS 12/60 · BLOCKED_DEPENDENCY 48/60', why: 'the 11 map-ready same-origin partitions (400/275/220/132/66 kV, Subs, Nuclear, Gas, Industry, Data Ctrs, Airports, Railways) paint, pick, close inside the viewport and switch off; every other layer is served by the bridge through DuckDB-wasm read_parquet and the +esm bundle is absent, so the engine labels them [FAIL] with 0 eligible features — not a product fault' },
  'baseline-browser-shim:all-layer-clicks-393': { assessed: 'PASS 12/60 · BLOCKED_DEPENDENCY 48/60', why: 'identical id set to 1440 (results.json per id)' },
  'baseline-browser-shim:grid-subs-chips-on-desktop': { assessed: 'FAIL (pre-existing on main)', why: 'PASS at 393 (⚡ Grid, ◉ Subs on the map), FAIL at 1400x900 and 2327x1156: the composed cartridge installs the tray only when matchMedia(pointer: coarse) or innerWidth <= 700 (202609241334-sld-sandbox-v9-8.js lines 5810-5812, 5900); the proof encodes the 2026-09-05 "show them on desktop too" request that was never composed' },
  'baseline-browser-shim:menu-bar-attrib-clearance': { assessed: 'BLOCKED_HARNESS (stale proof, pre-existing)', why: 'fixture test, same stale attribution assertions as the plain run' },
  'baseline-browser-shim:menu-bar-instrument-panel-202609041250': { assessed: 'BLOCKED_HARNESS (stale attribution checks, pre-existing)', why: 'as the plain run' },
  'baseline-browser-shim:deep-link-technology-buckets': { assessed: 'PASS 5/6 · BLOCKED_HARNESS 1', why: 'bounded to width 393 / bucket solar: generation, no page errors, project_layer_enabled published, technology_layer.enabled true and matching all PASS; the one FAIL is `failures: []` because the shim\'s background-only style has no glyphs endpoint and the cartridge records "the basemap serves no glyphs, so link labels are omitted" into link.failures — an artefact of the offline style' },
  'baseline-browser-shim:export-print-and-image-outcomes': { assessed: 'PASS 50/66 · BLOCKED_DEPENDENCY 16', why: 'handles, generation stamp, attribution, menu-open discipline, downloads, print stylesheet, canvas height under print media, one furniture node, PDF carries a raster — all PASS at 393 and 1400; the 16 FAILs are "the PNG/PDF raster carries map content, not one flat colour" (1 distinct colour sampled) and the sheet-fit/one-page checks that follow from it: the shim serves a background-only style with no tiles, so the map raster IS one flat colour here (BLOCKED_DEPENDENCY basemaps.cartocdn.com); re-run with tiles before reading the two "slide is one page" results' },
  'baseline-browser-shim-alone:all-controls-desktop': { assessed: 'PASS 21/26 · BLOCKED_DEPENDENCY 5', why: 'run alone (concurrency 1): card-minimise-restore-close now PASS, so the earlier 6 s action timeout was CPU contention; the five remaining are csv-export-loaded + pipeline-same/wider/all (REPD partitions via DuckDB-wasm, +esm bundle absent) and search (postcodes.io/Nominatim aborted)' },
  'baseline-browser-shim:pdf-export-outcomes-202609051329': { assessed: 'PASS chromium 16/16 · BLOCKED_HARNESS firefox+webkit', why: 'at 393x852 and 1400x900 in Chromium: download received, %PDF-1.4..%%EOF, DCTDecode JPEG raster, page aspect == image aspect, xref resolves, no page errors; firefox-1543 and webkit-2359 executables are not installed' },
  'baseline-browser-shim:arrival-identity-202609040229': { assessed: 'BLOCKED_DEPENDENCY (DuckDB +esm)', why: 'identity lane reports "Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm"; the measurement still ran (5 links, nearest 0.175 km) with identity FAILED, which is the designed fallback' },
  'baseline-browser-shim:transit-layer-availability-202609040219': { assessed: 'BLOCKED_HARNESS (stale pin)', why: 'waits for data-gridatlas-generation === "202609040219" (hard-coded at line 22) while the page publishes 202609241334' },
  'baseline-browser-shim:deep-link-visibility': { assessed: 'PASS 9/10 · BLOCKED_HARNESS 1', why: 'hidden-tab deferral, no camera/draw while hidden, fly + links + card + resumed counter once visible, no page errors all PASS (chromium; webkit absent); the one FAIL is the same no-glyphs note in link.failures' }
};

const rows = [];
for (const dir of DIRS) {
  const f = path.join(dir, 'results.json');
  if (!fs.existsSync(f)) { console.error(`[assess] missing ${f}`); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const r of j.results) {
    const o = OVERRIDES[path.basename(dir) + ':' + r.id] || (r.result === 'FAIL' ? OVERRIDES[r.id] : null);
    rows.push({ ...r, dir: path.basename(dir), routeBoots: j.routeBoots, assessed: o ? o.assessed : r.result + (r.note ? '' : ''), why: o ? o.why : (r.note || '') });
  }
}
const tally = {};
for (const r of rows) { const k = r.assessed.split(' ')[0]; tally[k] = (tally[k] || 0) + 1; }
let diffRows = null;
if (DIFF) {
  const base = JSON.parse(fs.readFileSync(path.resolve(HERE, DIFF), 'utf8'));
  const byId = new Map(base.rows.map(r => [r.id, r]));
  diffRows = rows.map(r => ({ id: r.id, baseline: byId.get(r.id)?.assessed || '(absent)', candidate: r.assessed, changed: (byId.get(r.id)?.assessed || '') !== r.assessed, baselineError: byId.get(r.id)?.firstError || '', candidateError: r.firstError }));
}
fs.writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ label: LABEL, tally, rows, diffRows }, null, 2));
const md = [];
md.push(`# ${LABEL} — classified proof table (${rows.length} entries)`);
md.push('');
md.push(`Assessed tally: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
md.push('');
md.push('| # | proof | kind | what it tests | target | machine result | assessed | duration | first error line |');
md.push('|--:|---|---|---|---|---|---|--:|---|');
rows.forEach((r, i) => md.push(`| ${i + 1} | \`${r.id}\` | ${r.kind} | ${r.tests.replace(/\|/g, '/')} | ${r.target.replace(/\|/g, '/')} | ${r.result}${r.note ? ' — ' + r.note.replace(/\|/g, '/') : ''} | **${r.assessed}**${(OVERRIDES[r.dir + ':' + r.id] || (OVERRIDES[r.id] && r.result === 'FAIL')) ? ' — ' + r.why.replace(/\|/g, '/') : ''} | ${(r.durationMs / 1000).toFixed(1)}s | ${r.firstError.replace(/\|/g, '/')} |`));
if (diffRows) {
  md.push('', `## Diff against ${DIFF}`, '', '| proof | baseline | candidate | changed |', '|---|---|---|---|');
  for (const d of diffRows) md.push(`| ${d.id} | ${d.baseline} | ${d.candidate} | ${d.changed ? '**YES**' : 'no'} |`);
}
fs.writeFileSync(OUT, md.join('\n') + '\n');
console.log(`[assess] ${rows.length} rows -> ${OUT}; tally ${JSON.stringify(tally)}`);
