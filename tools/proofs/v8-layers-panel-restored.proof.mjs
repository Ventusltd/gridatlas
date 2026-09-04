/* The v8 layers panel is back beneath the menus, asserted against the
 * COMPOSED bytes named by atlas/current.json - never against the parts.
 *
 * What was measured on live v9.115 at 1400x900 and at an iPhone 13 viewport,
 * 202609041957: all 60 engine layer switches present in the DOM, every
 * container holding them at 0x0 or display:none, scrollHeight equal to the
 * viewport so the page could not even scroll to them - ZERO of 120 layer
 * controls reachable without first opening a menu. The rule responsible was
 * one line: '.gridatlas-menu-hosted .scada-wrapper{display:none!important}',
 * justified by a circular argument (the rule hid the panel, so the panel's
 * toggle looked inert, which justified the rule).
 *
 * The architect's instruction, 2026-09-04: "restore v8 panels but keep
 * dropdowns file, edit, scope, grid, about" - both, not either. And: "don't
 * lose the grid engines" - so the arrival and its measurement are proven
 * separately by deep-link-visibility.browser.mjs and the five-case arrival
 * proof, run against the same composed bytes, before this generation ships.
 *
 * Run: node tools/proofs/v8-layers-panel-restored.proof.mjs
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

const intelligence = await composed('substation-intelligence');   // carries the menu bar
const sld = await composed('sld-sandbox');                         // carries the panel default

const failures = [];
let passed = 0;
const check = (name, ok) => { if (ok) passed += 1; else failures.push(name); };

/* ── The panel is shown, not hidden ─────────────────────────────────────── */

check('the rule that hid the whole v8 layers panel is gone from the served bytes',
    !/\.gridatlas-menu-hosted \.scada-wrapper\{display:none!important\}/.test(intelligence));

check('and the panel is positively shown beneath the menu bar, as v8 always drew it',
    /\.gridatlas-menu-hosted \.scada-wrapper\{display:flex!important\}/.test(intelligence));

check('the panel\'s own show/hide toggle is no longer hidden by the menu bar - '
    + 'with the panel restored it is the only control that opens and closes it',
    /if \(dashToggle\) dashToggle\.hidden = false;/.test(intelligence)
    && !/if \(dashToggle\) dashToggle\.hidden = true;/.test(intelligence)
    && /#gridatlas-dash-toggle\{display:inline-flex!important\}/.test(intelligence));

/* ── The menus stay ─────────────────────────────────────────────────────── */

check('all six dropdowns survive, in order: the architect asked for both, not either',
    /var MENUS = \['File', 'Edit', 'View', 'Scope', 'Grid', 'About'\];/.test(intelligence));

check('the Grid dropdown still proxies the same original inputs the panel shows, so '
    + 'the two surfaces cannot disagree about which layer is on',
    /data-gridatlas-layer-proxy/.test(intelligence));

/* ── One identity surface is still honoured ─────────────────────────────── */

check('the VENTUS wordmark is still fused into the bar and the SCADA brand node is '
    + 'MOVED into the Grid panel head, not cloned - restoring the panel does not '
    + 'bring back a second wordmark',
    /gm-brand-slot/.test(intelligence)
    && /\.gridatlas-menu-hosted #fs-letterhead\{display:none!important\}/.test(intelligence));

/* ── The default is right for each screen ───────────────────────────────── */

check('on a phone the panel starts collapsed - measured, an open panel held 31.6% of '
    + 'a 393x852 screen against the map\'s 29.3% - and on a desktop it starts open, '
    + 'as v8 always did',
    /let collapsed = coarse \|\| \(isFinite\(width\) && width > 0 && width <= 700\);/.test(sld));

check('an UNKNOWN width is not a phone: the width must be a real positive number '
    + 'before it argues for starting collapsed, so a host that publishes none gets '
    + 'the desktop default rather than an empty-looking page',
    /width > 0 && width <= 700/.test(sld)
    && !/let collapsed = true;/.test(sld));

check('a choice the reader has already made still wins over both defaults',
    /window\.localStorage\.getItem\(KEY\)/.test(sld)
    && /if \(v !== null\) collapsed = v === '1';/.test(sld));

/* ── Report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
    console.error('v8 layers panel proof FAILED (' + failures.length + ' of '
        + (failures.length + passed) + '):\n- ' + failures.join('\n- '));
    process.exit(1);
}
console.log('v8 layers panel restored: PASS — ' + passed + ' checks against the '
    + 'composed bytes of generation ' + current.generation);
