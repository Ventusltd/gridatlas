/**
 * The About panel carries the attribution and the estate's published method.
 *
 * Two things this generation exists to do, both asserted against the COMPOSED
 * bytes named by atlas/current.json -- never against the module part. A fix
 * written into a part and never composed is this estate's most expensive
 * recurring defect: the iOS arrival fix of 202609041957 existed in a part for
 * hours while the served cartridge did not have it.
 *
 *   1. `.custom-map-attrib` is moved into the About panel. Measured live at
 *      generation 202609042123 it rendered at x=15 y=47, 401x24 px -- a boxed
 *      band under the menu bar, over the top-left of the map, exactly where a
 *      reader arriving on a deep link looks first.
 *
 *   2. About gains an Estate group linking the estate's published method: the
 *      engine graph, the federation map and the spider printer. The
 *      publication boundary is explicit that method is never withheld
 *      (seed-data/07_CRITICALITY_AND_PUBLICATION_BOUNDARY.md, section 6).
 *
 * Run: node tools/proofs/about-estate-and-attribution.proof.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = path.join(ROOT, 'atlas');

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail) });
}

const current = JSON.parse(await readFile(path.join(ATLAS, 'current.json'), 'utf8'));

/* The cartridge the menu bar is composed into, read from the composition
   rather than named here, so this proof cannot drift onto a stale file. */
const entry = (current.cartridges || []).find(c => /substation-intelligence/.test(c.path || ''));
check('composition names a substation-intelligence cartridge', Boolean(entry), entry && entry.path);
if (!entry) { report(); }

const composedPath = path.join(ATLAS, entry.path.replace(/^\.\//, ''));
const composed = await readFile(composedPath, 'utf8');
check('composed cartridge is readable', composed.length > 0, `${entry.path} ${composed.length} bytes`);

/* 1. The attribution move. */
check(
  'composed bytes move .custom-map-attrib into the About panel',
  /var attrib = doc\.querySelector\('\.custom-map-attrib'\);/.test(composed)
  && /if \(!bar \|\| !bar\.contains\(attrib\)\) move\(panels\.About, attrib\);/.test(composed),
  'the node is adopted into About, not cloned or rewritten'
);
check(
  'composed bytes style the attribution once inside a panel',
  composed.includes(".gm-panel .custom-map-attrib{position:static!important;"),
  'panel-scoped rule present'
);
/* His instruction was "in small print at the bottom", so bottom is asserted,
   not assumed: the estate links must be appended before it, and the
   attribution must be re-appended on later passes so a late DOM rebuild
   cannot float it back above the controls. */
const iLinks = composed.indexOf('state.estate_links = appendEstateLinks(panels.About)');
const iAttrib = composed.indexOf("var attrib = doc.querySelector('.custom-map-attrib')");
check(
  'the attribution is appended AFTER the estate links, so it sits at the bottom',
  iLinks > -1 && iAttrib > iLinks,
  `estate links at ${iLinks}, attribution at ${iAttrib}`
);
/* This one is here because getting it wrong crashed the tab.
   adoptLate runs from a MutationObserver. An unconditional appendChild inside
   it is itself a mutation, so it re-enters adoptLate and appends again -- a
   feedback loop that crashed the renderer under the 393x852 arrival gate while
   the previous generation passed the same gate in the same harness. The guard
   must make the second and every later pass a NO-OP. */
check(
  'a later adoption pass only re-appends when the node is not already last',
  /panels\.About\.lastElementChild !== attrib/.test(composed),
  'lastElementChild guard closes the MutationObserver feedback loop'
);
check(
  'the engine fetch is guarded synchronously, not by the DOM it has yet to write',
  /var engineFetchStarted = false;/.test(composed)
  && /if \(!panel \|\| !window\.fetch \|\| engineFetchStarted\) return;/.test(composed)
  && /engineFetchStarted = true;/.test(composed),
  'one request, not one per mutation'
);
check(
  'it is small print',
  /\.gm-panel \.custom-map-attrib\{[^}]*font:10px/.test(composed.replace(/',\s*'/g, '')),
  '10px in the panel-scoped rule'
);

/* 2. The Estate group. Each URL is asserted individually: a single combined
      check would pass while two of the three had been dropped. */
const links = [
  ['engine graph', 'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph'],
  ['federation map', 'https://ventusltd.github.io/data-federation-map-for-globalgrid2050-all-repos/dashboard/sandbox/spider_full_po_test.html'],
  ['spider printer', 'https://ventusltd.github.io/spiders/spider_printer_v1/']
];
for (const [name, href] of links) {
  check(`composed bytes carry the ${name} link`, composed.includes(href), href);
}
check('estate links are marked so they are appended once', composed.includes('data-gm-estate'), 'data-gm-estate');
check('estate links sit under an Estate group heading', /appendGroup\(panel,\s*'Estate'\)/.test(composed), "appendGroup(panel, 'Estate')");
check(
  'estate links are anchors carrying the panel button role',
  /a\.setAttribute\('role',\s*'button'\)/.test(composed),
  'role="button" so they inherit the panel look'
);

/* 2b. The File panel lists the engine's own modules.
      "the menus must be neat, it should allow AI and humans to develop and
      use" -- the architect, 2026-09-05. The list is fetched from the engine's
      published graph rather than restated in this repository, so the menu
      cannot drift away from the maths it names. Both surfaces are served from
      ventusltd.github.io, so the request is same-origin. */
check(
  'composed bytes fetch the engine graph rather than restating its modules',
  composed.includes('https://ventusltd.github.io/ventus-grid-engine/genome/engine-graph.json'),
  'ENGINE_GRAPH_URL'
);
check(
  'each module links into the graph focused on itself',
  composed.includes('https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph&focus='),
  'uses the ?focus= contract published 202609050305'
);
/* The first cut of this listed only `type === 'canonical'` and the architect
   caught it in one line: "Why are the mjs files not there?" Every .mjs in the
   estate is an extract, a reference or a fragment, so filtering to canonical
   hid all four of them. The fragments matter most: they are where a
   calculation has been copied and left to drift. */
check(
  'every kind of node is listed, not only the canonical ones',
  !/node\.type === 'canonical'/.test(composed)
  && /var ORDER = \['canonical', 'extract', 'reference', 'fragment'\]/.test(composed),
  'canonical first, then extract, reference, fragment, then anything new'
);
check(
  'a kind the graph adds later still appears rather than being dropped',
  /Object\.keys\(byKind\)\.filter\(function \(k\) \{ return ORDER\.indexOf\(k\) < 0; \}\)/.test(composed),
  'unknown kinds are appended, not filtered out'
);
check(
  'the menu hands over a command that can actually be run',
  composed.includes('git clone https://github.com/Ventusltd/ventus-grid-engine')
  && composed.includes('node verify.mjs'),
  'clone, then run the engine\'s own fail-closed gate'
);
/* Measured 202609050250: the engine declares no dependencies and no proof in it
   opens a socket, so the gate runs from a clone with no install and no network.
   An install step in this command would imply a dependency that does not exist
   and would make the offline claim false, so its absence is asserted. */
/* Assert the COMMAND, not the file: the note above it explains why there is no
   install step, so a file-wide search for "npm install" matches the
   explanation and fails on prose. Read the string the button actually copies. */
const runValue = (() => {
  const at = composed.indexOf('var RUN_COMMAND =');
  if (at < 0) return null;
  const end = composed.indexOf(';', at);
  return end < 0 ? null : composed.slice(at, end);
})();
check(
  'the command claims no install step, because none is needed',
  Boolean(runValue) && !/npm\s+(install|i)\b/.test(runValue),
  runValue ? runValue.replace(/\s+/g, ' ').slice(17, 140) : 'RUN_COMMAND not found'
);
check(
  'it is copied, never executed, and says so by doing nothing else',
  /navigator\.clipboard\.writeText\(RUN_COMMAND\)/.test(composed)
  && !/eval\(/.test(composed.slice(composed.indexOf('RUN_COMMAND'), composed.indexOf('RUN_COMMAND') + 2000)),
  'the person who pastes it is the one who approves it'
);
check(
  'a browser with no clipboard permission shows the command instead of failing silently',
  composed.includes("done(false);"),
  'the control reveals its own payload'
);
check('the engine rows are marked so they are appended once', composed.includes('data-gm-engine'), 'data-gm-engine');
check(
  'the modules are listed alphabetically, as every non-version group here is',
  /localeCompare\(String\(b\.label\), 'en-GB'\)/.test(composed),
  'en-GB localeCompare'
);
check(
  'an unreachable engine leaves the menu exactly as it was',
  /\.catch\(function \(\) \{/.test(composed) && /state\.engine_modules = 0;/.test(composed),
  'the fetch failure path adds no group and throws nothing'
);
check(
  'the engine group goes in File, not About',
  composed.includes('appendEngineModules(panels.File)'),
  'appendEngineModules(panels.File)'
);

/* 2c. The published study, in View.
      "add this to the appropriate menuw on gridatlas and pipeline news" -- the
      architect, 2026-09-05, of the GB electricity price and grid constraint
      series. View is where this application already keeps readings of the
      network over time: GB prices · historic is moved into it by adoptLate.
      About would have filed it as provenance, which it is not. */
check(
  'the GB price and constraint study is carried',
  composed.includes('great_britain_electricity_price_grid_constraint_trends_2016_2026.html'),
  'globalgrid2050.com/data/grid_studies_public/'
);
check(
  'it is in View, beside the price control, not in About',
  composed.includes('state.studies = appendStudies(panels.View)'),
  'appendStudies(panels.View)'
);
check(
  'the studies group is appended once',
  /panel\.querySelector\('\[data-gm-study\]'\)/.test(composed),
  'data-gm-study guard'
);

/* 2d. Export: print a slide, or save an image of what is on screen.
      Two obligations, both of which this estate has already broken once:

      THE IMAGE MUST NOT BE BLANK. The map is a WebGL canvas created without
      preserveDrawingBuffer, so a read outside a render frame returns a fully
      transparent image that still encodes to a valid PNG and downloads
      happily. The capture happens inside a render frame AND the result is
      sampled before it is offered.

      THE CREDIT MUST TRAVEL WITH THE ARTEFACT. This generation moved the
      attribution into About, which is right for the screen and wrong for an
      export: OpenStreetMap and CARTO require attribution on the thing that
      leaves the building. */
check(
  'the File panel offers print and image export',
  composed.includes('data-gm-export') && /appendExport\(panels\.File, doc\)/.test(composed),
  'appendExport(panels.File, doc)'
);
check(
  'the image is captured inside a render frame, not after compositing',
  /map\.once\('render', grab\)/.test(composed) && /map\.triggerRepaint\(\)/.test(composed),
  'the canvas has no preserveDrawingBuffer, so the frame is where the pixels are'
);
check(
  'a blank capture is refused rather than downloaded',
  /function looksBlank\(canvas\)/.test(composed)
  && /looksBlank\(canvas\)/.test(composed)
  && composed.includes('The map could not be captured'),
  'sampled for non-transparent pixels before it is offered'
);
check(
  'a tainted canvas is not mistaken for a blank one',
  composed.includes('A tainted canvas throws here'),
  'the catch returns false, so the reader is not sent to print for no reason'
);
check(
  'the exported artefact carries the attribution the screen moved into About',
  /function attributionText\(doc\)/.test(composed)
  && composed.includes('gpf-attrib')
  && composed.includes('OpenStreetMap contributors'),
  'credit travels with the thing that leaves the building'
);
check(
  'the print slide carries the generation and a UTC stamp',
  /function generationText\(\)/.test(composed) && /function exportStamp\(\)/.test(composed)
  && composed.includes('gpf-stamp'),
  'an exported slide says which build and when'
);
/* "make sure print always fits to page in landscape or portrait on mobile, or
   desktop and sizes to fit the page". Forcing A4 landscape, which the first
   version did, is the OPPOSITE of fitting: it overrides the reader's own paper
   and clips on anything smaller. */
check(
  'the print takes whatever page the reader chose, rather than forcing one',
  composed.includes('@page{size:auto;margin:8mm}')
  && !composed.includes('size:A4 landscape'),
  'size:auto, so portrait or landscape and any paper both fit'
);
check(
  'the map sizes to the printable area instead of a fixed height',
  composed.includes('flex:1 1 auto!important;min-height:0!important')
  && !/height:170mm/.test(composed),
  'min-height:0 or the flex child refuses to shrink and pushes the footer off the sheet'
);
check(
  'a slide is one page, never two',
  composed.includes('break-inside:avoid;page-break-inside:avoid'),
  'nothing spills onto a second sheet'
);
check(
  'printing hides the interface',
  composed.includes("display:none!important"),
  'the bar is interface, not content'
);
check(
  'the print furniture is removed afterwards, and does not rely on afterprint alone',
  composed.includes("window.addEventListener('afterprint', clean)")
  && /window\.setTimeout\(clean, 20000\)/.test(composed),
  'some mobile browsers never fire afterprint'
);

/* 3. Nothing this generation touched may remove what was already proven.
      The v8 layers panel and the six menu titles are the two things earlier
      generations exist to protect; assert them here so this cut cannot pass
      by having quietly dropped them. */
check('the six menu titles survive', /'File',\s*'Edit',\s*'View',\s*'Scope',\s*'Grid',\s*'About'/.test(composed), 'MENUS unchanged');
check('the Scope tools survive', /move\(panels\.Scope,\s*ready\.nodes\.zoneButton\)/.test(composed), 'zoneButton still routed to Scope');
check('the v8 layer controls survive', composed.includes('buildLayerControls(ready.found)'), 'buildLayerControls still called');

/* 4. The part and the composed bytes must agree. If they do not, the
      composition did not pick up the edit, which is the failure mode this
      whole proof exists to catch. */
const part = await readFile(path.join(ATLAS, 'modules', '202609031958-menu-bar.js'), 'utf8');
check(
  'the module part and the composed cartridge agree on the estate links',
  part.includes('data-gm-estate') === composed.includes('data-gm-estate'),
  'part and composed bytes both carry it, or neither do'
);

report();

function report() {
  const failed = checks.filter(c => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? '  -- ' + c.detail : ''}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.error(`\n${failed.length} FAILED`);
    process.exit(1);
  }
  process.exit(0);
}
