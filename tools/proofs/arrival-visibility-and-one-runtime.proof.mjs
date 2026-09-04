/* What this generation has to keep true, asserted against the COMPOSED bytes
 * named by atlas/current.json - not against the parts they were built from.
 *
 * That distinction is the whole point of this file. The defect it exists to
 * stop already happened once: the iOS Safari visibility fix below was written
 * into atlas/parts/202609041234-sld-sandbox-technology-buckets.js and never
 * reached the composed cartridge, so the repository contained the fix, the
 * part-level reader saw the fix, and the served page did not have it. A proof
 * that reads parts would have passed while the phone stayed broken.
 *
 * Run: node tools/proofs/arrival-visibility-and-one-runtime.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = join(REPO, 'atlas');

const current = JSON.parse(await readFile(join(ATLAS, 'current.json'), 'utf8'));
const byId = new Map(current.cartridges.map(c => [c.id, c]));

async function composed(id) {
    const entry = byId.get(id);
    if (!entry) throw new Error(`no cartridge ${id} in current.json`);
    const rel = entry.path.replace(/^\.\//, '');
    return (await readFile(join(ATLAS, rel), 'utf8')).replace(/\r\n/g, '\n');
}

const failures = [];
let passed = 0;
const check = (name, condition) => {
    if (condition) passed += 1;
    else failures.push(name);
};

const sld = await composed('sld-sandbox');
const bridge = await composed('streaming-parquet-bridge');
const search = await composed('uk-gazetteer-flyto');
const intelligence = await composed('substation-intelligence');

/* ── The iOS Safari arrival, in the SERVED bytes ─────────────────────────
 *
 * Mechanism, reproduced by an independent audit: a deep link loaded with
 * document.hidden === true drew zero layer controls at 40s and the camera
 * never left its default position, recovering 2.5s after being made visible.
 * MapLibre's flyTo() and the engine's paint-driven boot both depend on
 * requestAnimationFrame, which iOS Safari does not tick in a tab that is not
 * composited. flyTo() does not throw there - it is simply never given a frame
 * - so the arrival ran to its own conclusion against a camera that had not
 * moved, and nothing called it again once the tab was finally seen.
 *
 * Pipeline News' MAP control carries target="_blank" on touch devices, which
 * is why this is the ordinary path to the product on a phone and not an edge
 * case. */

check('the layer-control budget is charged in VISIBLE time, not wall clock: '
    + 'time spent in a tab nobody can see buys nothing observable and must not '
    + 'be spent from the budget',
    /visibilityState === 'visible'\) elapsed \+= 200/.test(sld)
    && /while \(elapsed < budgetMs &&/.test(sld));

check('and the wall-clock BUDGET it replaced is genuinely gone, so the two '
    + 'cannot both be present with one shadowing the other',
    !/while \(Date\.now\(\) - started < budgetMs\)/.test(sld));

check('the visible-time budget is nonetheless bounded by an absolute ceiling, '
    + 'because visible time alone never elapses in a tab that is never shown - '
    + 'that would be a poll every 200ms for ever on the device least able to '
    + 'afford the battery',
    /Date\.now\(\) - started < HARD_CEILING_MS/.test(sld)
    && /const HARD_CEILING_MS = 600000;/.test(sld));

check('both clocks are published, because they answer different questions: '
    + 'wall time is what the reader sat through, visible time is what the '
    + 'budget was actually spent from',
    /link\.layer_controls_ready_ms = Date\.now\(\) - started;/.test(sld)
    && /link\.layer_controls_ready_visible_ms = elapsed;/.test(sld));

check('the arrival never STARTS while the document is hidden, because a flyTo '
    + 'issued to an uncomposited tab is silently discarded rather than failing',
    /function attemptArrival\(\)/.test(sld)
    && /if \(document\.visibilityState !== 'visible'\) return;/.test(sld));

check('the arrival is not one-shot: an arrival that produced no visible '
    + 'outcome is run again the first time the tab is actually seen',
    /visibilitychange/.test(sld)
    && /function arrivalHasVisibleOutcome\(\)/.test(sld));

check('a visible outcome is judged on fields the cartridge already publishes '
    + 'and already relies on elsewhere, rather than a new signal invented for '
    + 'the retry to read',
    /link\.links_drawn > 0/.test(sld)
    && /not-in-active-register-no-supplied-point/.test(sld));

check('retrying is BOUNDED, so a genuine non-visibility failure still stops '
    + 'rather than re-running forever every time the reader switches tabs',
    /MAX_AUTO_ARRIVAL_ATTEMPTS = 5/.test(sld)
    && /link\.arrival_attempts = arrivalAttempts/.test(sld));

check('the retry publishes its own state, so a reader can tell an arrival that '
    + 'waited for visibility from one that simply worked',
    /arrival_deferred_for_visibility/.test(sld)
    && /arrival_resumed_on_visibility/.test(sld));

/* ── One DuckDB runtime for the page ─────────────────────────────────────
 *
 * Measured live at an iPhone 13 profile, 202609041500: duckdb-eh.wasm fetched
 * twice at 5.92 MB, 11.84 MB of a 12.81 MB arrival, and two WebAssembly heaps
 * alive at once on a device that caps per-tab memory hard. */

check('both cartridges that need DuckDB go through the shared broker, keyed on '
    + 'the window so neither depends on composition order',
    /__GRIDATLAS_DUCKDB_RUNTIME__/.test(bridge)
    && /__GRIDATLAS_DUCKDB_RUNTIME__/.test(search)
    && /sharedDuckDBRuntime\(DUCKDB_MODULE\)/.test(bridge)
    && /sharedDuckDBRuntime\(DUCKDB_MODULE\)/.test(search));

check('neither cartridge still instantiates a runtime outside the broker - if '
    + 'one did, the page would quietly pay for two heaps again',
    bridge.split('database.instantiate(').length - 1 === 1
    && search.split('database.instantiate(').length - 1 === 1);

check('a rejected runtime is dropped rather than cached, so a retry rebuilds '
    + 'instead of inheriting a dead promise',
    /window\[KEY\]\.promise === promise\) delete window\[KEY\]/.test(bridge)
    && /window\[KEY\]\.promise === promise\) delete window\[KEY\]/.test(search));

check('the search lane never terminates a SHARED database: its retry owns its '
    + 'own connection, and tearing down the runtime would take the bridge\'s '
    + 'data plane for every V8 layer down with it',
    /if \(!active\.shared\)/.test(search)
    && /shared: true/.test(search));

/* ── The chips a phone actually needs ───────────────────────────────────── */

check('GRID and SUBS stay on the map on a touch screen or a narrow window, '
    + 'because the switches they stand in for live in the SCADA panel below a '
    + 'fold a phone never scrolls to',
    /function chipStaysOnMap/.test(intelligence)
    && /pointer: coarse/.test(intelligence));

check('an UNKNOWN viewport width is not treated as a phone: the width has to '
    + 'be a real positive number before it argues for staying on the map, so a '
    + 'host that publishes no width does not silently get the phone layout',
    /width > 0 && width <= 700/.test(intelligence));

check('everything else still routes into the menus, so this is a targeted '
    + 'exception and not a reversal of the menu consolidation',
    /button\.hidden = true/.test(intelligence)
    && /move\(panels\[route\], button\)/.test(intelligence));

/* ── Report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
    console.error('arrival-visibility-and-one-runtime FAILED ('
        + failures.length + ' of ' + (failures.length + passed) + '):\n- '
        + failures.join('\n- '));
    process.exit(1);
}
console.log('arrival visibility and one runtime: PASS — ' + passed + ' checks '
    + 'against the composed bytes of generation ' + current.generation);
