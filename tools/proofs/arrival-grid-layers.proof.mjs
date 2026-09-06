/* Arriving from a project deep link shows that project's grid.
 *
 * Asserted against the COMPOSED bytes named by atlas/current.json, never
 * against the parts - a fix can sit in a part for generations and never reach
 * the cartridge the shell actually loads.
 *
 * WHAT WAS MEASURED, live, 2026-09-06, arriving at REPD 9873 (Berwick Bank,
 * 4,100 MW) on ventusltd.github.io/gridatlas/atlas/:
 *
 *     style layers                     192
 *     features rendered on screen        8
 *     l-400    visibility "none"    0 features
 *     l-275    visibility "none"    0 features
 *     l-132    visibility "none"    0 features
 *     l-66     visibility "none"    0 features
 *     l-11kv   visibility "none"    0 features
 *     l-subs   visibility "none"    0 features
 *
 * The card greeting that arrival stated "Nearest 400 kV substation: Torness
 * Substation - 78.96 km straight". The map drew none of it. The engine
 * measured against a network the reader could not see, and the only way to see
 * it was to know to open GRID and tick six boxes.
 *
 * Nobody had switched them off. They are lazy: handleLayerToggle is what
 * hydrates a layer, and nothing called it on arrival. So this is a DEFAULT
 * being set, not a capability being added - every layer remains a control the
 * reader owns, and the distribution voltages are deliberately left off because
 * they are large and are not where a connection question starts.
 *
 * The comparison that made the diagnosis certain: codex test code
 * 202609060537 carries 114 style layers and does not contain l-400, l-275,
 * l-132, l-66, l-11kv or l-subs at all. Two builds, one blank map, two
 * different causes - which is exactly why this proof asserts the CAUSE (the
 * arrival switches the layers on) and not the symptom.
 *
 * Run: node tools/proofs/arrival-grid-layers.proof.mjs
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
    if (!entry) throw new Error('no cartridge ' + id + ' in current.json');
    return (await readFile(join(ATLAS, entry.path.replace(/^\.\//, '')), 'utf8'))
        .replace(/\r\n/g, '\n');
}

const intelligence = await composed('substation-intelligence');

const failures = [];
let passed = 0;
const check = (name, ok) => { if (ok) passed += 1; else failures.push(name); };

/* ── The arrival switches layers on at all ──────────────────────────────── */

const block = intelligence.match(
    /const arrivalLayers = \[([^\]]*)\][\s\S]{0,900}?handleLayerToggle\(id, true\)/);

check('the composed cartridge switches layers on when a deep link arrives',
    block !== null);

const named = block
    ? block[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    : [];

check('the substations are switched on - they are what the card measures to',
    named.includes('subs'));
check('400 kV is switched on', named.includes('400'));
check('275 kV is switched on', named.includes('275'));
check('132 kV is switched on', named.includes('132'));

/* The distribution voltages are deliberately NOT switched on. They are large,
   and a connection question does not start there. This is not an oversight and
   a later change that quietly adds them should have to say why. */
check('11 kV is deliberately left off, because it is large and not where a connection starts',
    !named.includes('11kv'));
check('66 kV is deliberately left off for the same reason',
    !named.includes('66'));

/* ── It happens on a REAL arrival, not on every page load ───────────────── */

const guardIndex = intelligence.indexOf("if (!/^[A-Za-z0-9-]{1,40}$/.test(repdRef)) return;");
const switchIndex = intelligence.indexOf('const arrivalLayers');
check('the guard rejecting a malformed repd_ref is still present',
    guardIndex !== -1);
check('layers are only switched on AFTER a valid REPD ref is confirmed, so an ordinary visit is untouched',
    guardIndex !== -1 && switchIndex !== -1 && switchIndex > guardIndex);

/* ── It survives the style not being ready yet ──────────────────────────── */

check('it waits for the style when the style is not loaded, instead of silently doing nothing',
    /if \(map\.isStyleLoaded\(\)\) switchOn\(\);\s*\n\s*else map\.once\('load', switchOn\);/.test(intelligence));

/* ── The panel agrees with the map ──────────────────────────────────────── */

check('the layer checkbox is ticked too, so the GRID panel does not disagree with what is drawn',
    /input\[data-layer-id="\$\{id\}"\]/.test(intelligence)
    && /if \(box && !box\.checked\) box\.checked = true;/.test(intelligence));

/* ── One failure must not take the others down ──────────────────────────── */

check('a layer that fails to hydrate cannot stop the remaining layers',
    /try \{ handleLayerToggle\(id, true\); \} catch \(e\) \{[^}]*\}/.test(intelligence));
check('and the whole arrival is wrapped, so a layer fault never breaks the deep link itself',
    /catch \(error\) \{\s*\n\s*console\.warn\('\[ARRIVAL LAYERS\]/.test(intelligence));

/* ── The capability is still the reader's ───────────────────────────────── */

check('handleLayerToggle still hydrates on demand, so nothing here preloads a layer nobody asked for',
    /if \(isVisible && layerId !== '400'\) hydrateLayer\(layerId\);/.test(intelligence));

if (failures.length) {
    console.error('arrival-grid-layers proof FAILED (' + failures.length + ' of '
        + (failures.length + passed) + '):\n- ' + failures.join('\n- '));
    process.exit(1);
}
console.log('arrival-grid-layers proof PASS — ' + passed + ' checks');
export default { status: 'PASS', checks: passed };
