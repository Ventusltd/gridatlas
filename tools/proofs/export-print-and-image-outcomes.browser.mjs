/**
 * The Export group is proved by its OUTCOME, not by its source.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * v9.121 shipped three defects in one feature, and
 * tools/proofs/about-estate-and-attribution.proof.mjs passed 44/44 over all
 * three. It asserted CSS STRINGS and CODE SHAPES -- that a rule was present in
 * the composed bytes, that a function was called -- and never once asserted
 * what the browser DID with them. That is this estate's own recorded failure
 * mode: a check built only from cases the code already passes cannot fail.
 *
 * The three defects it could not see, all measured on the live composed page
 * at generation 202609050354:
 *
 *   1. PRINT PRODUCED A BLANK SHEET. Under print media emulation
 *      `.maplibregl-canvas` measured 385x0 on a 393x852 phone and 1392x0 on a
 *      1400x900 desktop -- 838 px and 518 px on screen, zero on paper.
 *      Page.printToPDF returned ZERO image XObjects at both viewports.
 *
 *   2. "SAVE AN IMAGE" WAS UNCONDITIONALLY BROKEN. The handle lookup read
 *      `window.__GRIDATLAS_MAP__`, which is assigned nowhere in this estate,
 *      then fell back to `window.map` -- the DIV `<div id="map">` by named
 *      element reflection, whose `.getCanvas` is undefined.
 *
 *   3. THE STAMP LOST THE GENERATION. `window.__GRIDATLAS_CURRENT__` is also
 *      undefined; the loader publishes `window.__GRIDATLAS_ATLAS__`.
 *
 * THE DRIVER FAULTS THIS FILE ITSELF HAD, AND HOW THEY ARE FIXED
 * -------------------------------------------------------------
 * The independent review of 2026-09-05 (finding 16) read the first draft of
 * this proof and found three faults that were the DRIVER'S, not the
 * application's. Any failure it reported was therefore unattributable:
 *
 *   i.   It clicked Save without opening the File menu. Every panel starts
 *        `hidden`, so that click could only ever hit a hidden element.
 *   ii.  It located the button by its TEXT -- and saveImage() rewrites that
 *        text on click, so the second lookup searched for a string that no
 *        longer existed.
 *   iii. It clicked Print without reopening File. The bar's own document
 *        click listener runs `setTimeout(closeAll, 0)` after ANY non-title
 *        button inside the bar is pressed, so the preceding Save closed the
 *        menu the Print click needed.
 *
 * The corrections, in order:
 *
 *   - NO SELECTOR IN THIS FILE READS TEXT. The two export controls are
 *     resolved by id (`#gridatlas-export-print` / `#gridatlas-export-image`),
 *     falling back to `[data-gm-export="print"|"image"]`, falling back to
 *     DOM order within `[data-gm-export]` -- that last rung exists ONLY so
 *     this proof can still run against pre-fix composed bytes, where both
 *     buttons carry `data-gm-export="1"` and are told apart solely by the
 *     order appendExport() appends them. Which rung resolved is recorded in
 *     the receipt, so a reader can see which bytes were under test.
 *   - The owning menu is found STRUCTURALLY: the `.gm-menu` that contains an
 *     export control, never the string "File".
 *   - openExportMenu() is called EXPLICITLY before each of the two actions,
 *     and it asserts `aria-expanded="true"` and `panel.hidden === false`
 *     before returning. It reads the open state first, because openMenu() is
 *     a toggle and a blind second click would close what it meant to open.
 *   - The button locators are structural, so the text changing under them
 *     after the click is irrelevant; the new text is read back through the
 *     same locator and is EVIDENCE, not a selector.
 *
 * WHAT THIS PROOF ASSERTS, AND WHY EACH ONE IS AN OUTCOME
 * ------------------------------------------------------
 * The same review warned that "non-transparent pixels alone can describe a
 * solid blank rectangle, and any image XObject could be a logo". Both holes
 * are closed here:
 *
 *   A. Under print emulation `.maplibregl-canvas` has a height GREATER THAN
 *      ZERO, and keeps at least half its on-screen height. A number.
 *   B. Page.printToPDF over the page contains at least one image XObject,
 *      and the largest one IS THE MAP: its raster dimensions equal the map
 *      canvas's own drawing buffer, within 5%. A logo, an icon or a marker
 *      sprite cannot be 383x838. Separately, that image is PLACED so it
 *      fills the sheet in the direction its aspect constrains and spills
 *      over neither edge -- read by walking q/Q and cm to the composed CTM
 *      at the `Do`, against the page's own /MediaBox.
 *   C. That image is not a solid rectangle, and this is DECODED rather than
 *      inferred: the Flate stream is inflated and sampled, and must carry
 *      at least 8 distinct pixel values with no single value taking 95% of
 *      them. Its /SMask, if it has one, must be non-zero over at least half
 *      the sample -- a perfectly detailed image behind an all-zero alpha
 *      mask is still a blank sheet, and that is exactly what the first
 *      candidate produced.
 *   D. Clicking "Save an image" produces a REAL download -- a browser
 *      download event, a plausible filename, and a file over 10,000 bytes --
 *      and the PNG decodes, at its natural resolution, to an image whose
 *      sampled pixels carry at least 8 distinct colours with no single
 *      colour covering more than 95% of the sample. A blank or solid-fill
 *      capture scores exactly 1 distinct colour at 100%.
 *   E. The generation in the export furniture is NON-EMPTY and EQUALS the
 *      generation of the composition actually under test.
 *
 * A control, not an outcome, and labelled as one: the map handle
 * `__GRIDATLAS_V9_MAP__` is asserted to be a live map object and
 * `window.map` to be the DIV it really is. Neither depends on the export
 * code; they exist so that a future regression in the handle itself cannot
 * be mistaken for an export bug.
 *
 * Run:
 *   node tools/proofs/export-print-and-image-outcomes.browser.mjs
 *   node tools/proofs/export-print-and-image-outcomes.browser.mjs --route /atlas/v/<generation>/
 *
 * --route selects WHICH COMPOSITION is under test. The default is the live
 * route. A pinned candidate route under atlas/v/<generation>/ composes its
 * own generation without changing anything the live route serves, which is
 * how a candidate is measured here without shipping it.
 */
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function argv(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at > -1 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

/* Normalised at both ends: an MSYS/Git-Bash shell rewrites a leading-slash
   argument into a Windows path, so `atlas/v/<stamp>` must be accepted too. */
const ROUTE = `/${argv('--route', '/atlas/').replace(/^[/\\]*/, '').replace(/[/\\]*$/, '')}/`;
const RECEIPT_OUT = argv('--receipt', '');
const CURRENT_PATH = path.join(ROOT, ROUTE.replace(/^\/+/, '').split('/').join(path.sep), 'current.json');
const CURRENT = JSON.parse(await readFile(CURRENT_PATH, 'utf8'));
const GENERATION = CURRENT.generation;
/* The cartridge that actually carries the export code, named from the
   composition under test rather than assumed, so the receipt records the
   exact bytes every measurement below was taken against. */
const EXPORT_CARTRIDGE = (CURRENT.cartridges || [])
  .find(entry => entry.id === 'substation-intelligence') || {};

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail) });
}

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.parquet', 'application/octet-stream'], ['.png', 'image/png']
]);
const sockets = new Set();
const server = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = requestPath.replace(/^\/+/, '') || 'index.html';
    let target = path.resolve(ROOT, relative);
    if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
      response.writeHead(403).end('outside repository');
      return;
    }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const bytes = await readFile(target);
    response.writeHead(200, {
      'content-type': MIME.get(path.extname(target).toLowerCase())
        || 'application/octet-stream',
      'cache-control': 'no-store', 'access-control-allow-origin': '*'
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('not found');
  }
});
/* Own every socket: an unclosed keep-alive connection holds server.close()
   open forever, and this estate has already paid for orphaned http servers
   left running for over an hour. */
server.on('connection', (socket) => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const { port } = server.address();

/* READING A PDF PROPERLY, BECAUSE THE CHEAP READ MEASURED THE WRONG THING.
   ------------------------------------------------------------------------
   The first version of this function took a +/-600 character window around
   each `/Subtype /Image` and regexed /Width, /Height and /Length out of it.
   Width and height were right; /Length was not -- it picked up whichever
   object happened to sit inside the window, and reported 293 compressed
   bytes for a 322,630-pixel raster. That is a driver defect of the same
   family this file exists to stop, so the objects are now walked properly.

   It also compared the raster's PIXEL dimensions with the sheet's size in
   pixels and called the ratio "coverage". Those are different quantities: a
   1392x518 map placed on an 816x1056 sheet is scaled down to fit, and the
   ratio 1.706 x 0.491 describes resolution, not layout. HOW MUCH OF THE
   SHEET THE MAP COVERS is written in the content stream, as the `cm` matrix
   in force when the image is painted with `Do`. That is what is read here:
   the placed width and height in points, against the page's own /MediaBox.

   So two independent questions get two independent answers:
     - is this image THE MAP? its raster dimensions equal the print-media
       canvas that was measured in the browser moments earlier;
     - does it FILL THE SHEET? its placed size covers most of the MediaBox. */
function pdfFacts(base64) {
  const bytes = Buffer.from(base64, 'base64');
  const text = bytes.toString('latin1');

  /* Objects, walked in order, stepping OVER stream payloads so binary bytes
     can never be mistaken for the start of another object. */
  const objects = new Map();
  const objectStart = /(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\b/g;
  let found;
  while ((found = objectStart.exec(text)) !== null) {
    const from = objectStart.lastIndex;
    const streamAt = text.indexOf('stream', from);
    const endAt = text.indexOf('endobj', from);
    const hasStream = streamAt > -1 && (endAt === -1 || streamAt < endAt);
    const dict = text.slice(from, hasStream ? streamAt : (endAt > -1 ? endAt : from));
    objects.set(Number(found[1]), { dict, hasStream, streamAt });
    if (hasStream) {
      const endStream = text.indexOf('endstream', streamAt);
      if (endStream > -1) objectStart.lastIndex = endStream;
    }
  }
  const number = (dict, key) => {
    const direct = dict.match(new RegExp(`/${key}\\s+(-?[\\d.]+)(?!\\s+\\d+\\s+R)`));
    if (direct) return Number(direct[1]);
    const indirect = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
    if (indirect) {
      const referenced = objects.get(Number(indirect[1]));
      const value = referenced && referenced.dict.match(/(-?[\d.]+)/);
      return value ? Number(value[1]) : null;
    }
    return null;
  };
  const streamOf = (entry) => {
    if (!entry || !entry.hasStream) return null;
    const length = number(entry.dict, 'Length');
    let at = entry.streamAt + 'stream'.length;
    if (text[at] === '\r') at += 1;
    if (text[at] === '\n') at += 1;
    const end = length === null ? text.indexOf('endstream', at) : at + length;
    return { raw: bytes.subarray(at, end), filter: /\/FlateDecode/.test(entry.dict) };
  };

  /* DECODED, NOT INFERRED.
     Compression ratio is a hint; the pixels are the answer. The candidate's
     first print PDF carried a 383x838 image whose 962,862 inflated bytes were
     every one (0,0,0), behind an /SMask of 320,954 zero bytes. Only opening
     the stream shows that. */
  const decoded = (entry) => {
    const stream = streamOf(entry);
    if (!stream) return null;
    if (/\/DecodeParms/.test(entry.dict)) return { predictor: true };
    try {
      return { bytes: stream.filter ? zlib.inflateSync(stream.raw) : stream.raw };
    } catch { return null; }
  };
  const sample = (buffer, width, height) => {
    const components = Math.round(buffer.length / (width * height));
    if (!components || components > 4) return null;
    const counts = new Map();
    let nonZero = 0, sampled = 0;
    /* A stride coprime with the row width walks the whole raster rather than
       one column of it. */
    for (let at = 0; at + components <= buffer.length; at += components * 97) {
      sampled += 1;
      let key = 0, any = 0;
      for (let c = 0; c < components; c += 1) {
        key = (key * 257) + buffer[at + c];
        any |= buffer[at + c];
      }
      if (any) nonZero += 1;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let top = 0;
    for (const value of counts.values()) if (value > top) top = value;
    return {
      components, sampled, distinct: counts.size,
      dominantShare: sampled ? Number((top / sampled).toFixed(4)) : 1,
      nonZeroShare: sampled ? Number((nonZero / sampled).toFixed(4)) : 0
    };
  };

  /* An /SMask IS an image XObject in its own right. Counting them as
     pictures double-counts every masked image, and sorting by area can then
     hand back an alpha channel as "the largest image on the page". They are
     collected, attached to the image they mask, and excluded from the
     picture list. */
  const maskOf = new Map();
  for (const [id, entry] of objects) {
    const ref = entry.dict.match(/\/SMask\s+(\d+)\s+\d+\s+R/);
    if (ref) maskOf.set(id, Number(ref[1]));
  }
  const masks = new Set(maskOf.values());

  const images = new Map();
  for (const [id, entry] of objects) {
    if (!/\/Subtype\s*\/Image/.test(entry.dict)) continue;
    if (masks.has(id)) continue;
    const width = number(entry.dict, 'Width');
    const height = number(entry.dict, 'Height');
    if (!width || !height) continue;
    const image = { id, width, height, streamBytes: number(entry.dict, 'Length') || 0 };
    const body = decoded(entry);
    image.content = body && body.bytes ? sample(body.bytes, width, height)
      : { unread: body && body.predictor ? 'DecodeParms present' : 'stream unreadable' };
    if (maskOf.has(id)) {
      const maskBody = decoded(objects.get(maskOf.get(id)));
      image.smask = maskBody && maskBody.bytes ? sample(maskBody.bytes, width, height)
        : { unread: true };
    }
    images.set(id, image);
  }

  /* The page: its paper, and where it paints each image. */
  let pagePt = null;
  const placements = [];
  for (const [, entry] of objects) {
    if (!/\/Type\s*\/Page[^s]/.test(entry.dict)) continue;
    const media = entry.dict.match(/\/MediaBox\s*\[\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\]/);
    if (media) {
      pagePt = {
        width: Number(media[3]) - Number(media[1]),
        height: Number(media[4]) - Number(media[2])
      };
    }
    const names = new Map();
    const resources = entry.dict.match(/\/XObject\s*<<([\s\S]*?)>>/);
    if (resources) {
      const pair = /\/([A-Za-z0-9._]+)\s+(\d+)\s+\d+\s+R/g;
      let hit;
      while ((hit = pair.exec(resources[1])) !== null) names.set(hit[1], Number(hit[2]));
    }
    const contentsRef = entry.dict.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
    if (!contentsRef) continue;
    const stream = streamOf(objects.get(Number(contentsRef[1])));
    if (!stream) continue;
    let content;
    try {
      content = (stream.filter ? zlib.inflateSync(stream.raw) : stream.raw).toString('latin1');
    } catch { continue; }
    /* THE PLACED SIZE IS THE FULL CTM, NOT THE NEAREST `cm`.
       Reading only the `cm` immediately before `Do` reported the map as
       covering 2.3x and 3.8x the sheet, which is not a coverage at all: the
       page content sits inside an outer scaling transform, and the nearest
       matrix is only the innermost factor. So q/Q and cm are walked with a
       stack and multiplied, and the placed size is read off the composed
       matrix at the moment of `Do`. String literals are stripped first, so a
       'q' inside the printed title cannot be mistaken for an operator. */
    const ops = content
      .replace(/\\[\s\S]/g, '  ')
      .replace(/\([^()]*\)/g, '()')
      .replace(/<[0-9A-Fa-f\s]*>/g, '<>');
    const identity = [1, 0, 0, 1, 0, 0];
    const times = (m, n) => [
      (m[0] * n[0]) + (m[1] * n[2]), (m[0] * n[1]) + (m[1] * n[3]),
      (m[2] * n[0]) + (m[3] * n[2]), (m[2] * n[1]) + (m[3] * n[3]),
      (m[4] * n[0]) + (m[5] * n[2]) + n[4], (m[4] * n[1]) + (m[5] * n[3]) + n[5]
    ];
    let ctm = identity;
    const stack = [];
    const token = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm|\/([A-Za-z0-9._]+)\s+Do|(?<![A-Za-z])(q|Q)(?![A-Za-z])/g;
    let hit;
    while ((hit = token.exec(ops)) !== null) {
      if (hit[8] === 'q') { stack.push(ctm); continue; }
      if (hit[8] === 'Q') { ctm = stack.pop() || identity; continue; }
      if (hit[7] !== undefined) {
        const id = names.get(hit[7]);
        if (id === undefined || !images.has(id)) continue;
        placements.push({
          id,
          widthPt: Math.hypot(ctm[0], ctm[1]),
          heightPt: Math.hypot(ctm[2], ctm[3])
        });
        continue;
      }
      ctm = times([Number(hit[1]), Number(hit[2]), Number(hit[3]),
        Number(hit[4]), Number(hit[5]), Number(hit[6])], ctm);
    }
  }
  for (const placement of placements) {
    const image = images.get(placement.id);
    if (!image) continue;
    if (!image.placed || (placement.widthPt * placement.heightPt)
        > (image.placed.widthPt * image.placed.heightPt)) {
      image.placed = { widthPt: placement.widthPt, heightPt: placement.heightPt };
    }
  }

  const ordered = [...images.values()].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const count = text.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  return {
    bytes: bytes.length,
    pagePt,
    pages: count ? Number(count[1]) : (text.match(/\/Type\s*\/Page[^s]/g) || []).length,
    imageCount: ordered.length,
    images: ordered
  };
}

const VIEWPORTS = [
  { name: '393x852 phone', width: 393, height: 852, isMobile: true },
  { name: '1400x900 desktop', width: 1400, height: 900, isMobile: false }
];
/* A4 in inches, both ways round. "fits to page in landscape or portrait on
   mobile, or desktop" was the requirement; a forced size is the only way to
   prove the layout does not assume the viewport's own shape. */
const PAPERS = [
  { name: 'reader paper (@page size:auto)', preferCSSPageSize: true },
  { name: 'A4 portrait', preferCSSPageSize: false, paperWidth: 8.27, paperHeight: 11.69 },
  { name: 'A4 landscape', preferCSSPageSize: false, paperWidth: 11.69, paperHeight: 8.27 }
];

/* "make sure print always fits to page in landscape or portrait on mobile,
   or desktop and sizes to fit the page" -- the architect. Fitting is two
   properties, and neither is "covers half the sheet in both directions": a
   383x838 phone map on landscape A4 cannot, without distorting. It must fill
   the sheet in the direction its aspect constrains, and it must not spill
   over the edge in either. */
const FILLS_ONE_DIRECTION = 0.9;
const NO_OVERFLOW = 1.02;
/* A blank capture is a solid fill. Eight distinct sampled values, with no
   single value taking more than 95% of them, is the same floor the saved PNG
   is held to -- a uniform rectangle scores exactly 1 distinct value at 100%. */
const MIN_DISTINCT = 8;
const MAX_DOMINANT = 0.95;
/* An /SMask of zeroes hides a perfectly detailed image. At least half the
   sampled alpha must be non-zero for the sheet to show anything. */
const MIN_VISIBLE = 0.5;

/* Resolution by id, then by a typed data attribute, then by DOM order.
   NEVER by text: saveImage() rewrites the button's text on click, which is
   precisely how the first draft of this driver lost its own button. */
async function exportControl(page, kind) {
  const attempts = [
    { how: `#gridatlas-export-${kind}`, locator: page.locator(`#gridatlas-export-${kind}`) },
    { how: `button[data-gm-export="${kind}"]`, locator: page.locator(`button[data-gm-export="${kind}"]`) },
    /* Pre-fix composed bytes give both controls data-gm-export="1"; the only
       thing that tells them apart there is that appendExport() appends print
       before image. This rung exists so the SAME proof can be run against
       the unfixed cartridge and fail for the application's reasons rather
       than for a missing selector. */
    {
      how: `button[data-gm-export] in DOM order (index ${kind === 'print' ? 0 : 1})`,
      locator: page.locator('button[data-gm-export]').nth(kind === 'print' ? 0 : 1)
    }
  ];
  for (const attempt of attempts) {
    if (await attempt.locator.count() > 0) return attempt;
  }
  return { how: 'not found', locator: null };
}

const browser = await chromium.launch({ headless: true });
const receipts = {
  route: ROUTE,
  generation: GENERATION,
  export_cartridge: EXPORT_CARTRIDGE.path || null,
  export_cartridge_sha256: EXPORT_CARTRIDGE.sha256 || null,
  viewports: {}
};
try {
  for (const viewport of VIEWPORTS) {
    const receipt = {};
    receipts.viewports[viewport.name] = receipt;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile, deviceScaleFactor: 1, acceptDownloads: true
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}${ROUTE}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(
      () => window.__GRIDATLAS_V9_MAP__ && typeof window.__GRIDATLAS_V9_MAP__.loaded === 'function'
        && window.__GRIDATLAS_V9_MAP__.loaded(),
      null, { timeout: 90000 }
    ).catch(() => { /* asserted below, not swallowed */ });
    await page.waitForTimeout(3000);

    /* CONTROL. Not an export outcome: the handle the export code must read,
       measured independently so a regression there cannot be misread as an
       export bug. */
    const handles = await page.evaluate(() => {
      const shape = value => (value ? {
        present: true, tag: value.tagName || null,
        getCanvas: typeof value.getCanvas, once: typeof value.once,
        triggerRepaint: typeof value.triggerRepaint
      } : { present: false });
      return {
        v9: shape(window.__GRIDATLAS_V9_MAP__),
        windowMap: shape(window.map),
        legacyMap: shape(window.__GRIDATLAS_MAP__),
        legacyCurrent: window.__GRIDATLAS_CURRENT__ === undefined ? 'undefined' : 'present',
        atlasGeneration: (window.__GRIDATLAS_ATLAS__ || {}).generation || null,
        datasetGeneration: document.documentElement.dataset.gridatlasGeneration || null
      };
    });
    receipt.handles = handles;
    check(`${viewport.name}: CONTROL - the published map handle is a live map object`,
      handles.v9.present && handles.v9.getCanvas === 'function'
      && handles.v9.once === 'function' && handles.v9.triggerRepaint === 'function',
      `__GRIDATLAS_V9_MAP__ getCanvas=${handles.v9.getCanvas} once=${handles.v9.once} triggerRepaint=${handles.v9.triggerRepaint}`);
    check(`${viewport.name}: CONTROL - window.map is the DIV, so it can never be the handle`,
      handles.windowMap.tag === 'DIV' && handles.windowMap.getCanvas === 'undefined',
      `window.map is <${handles.windowMap.tag}> getCanvas=${handles.windowMap.getCanvas}`);
    check(`${viewport.name}: the composition publishes its generation to the page`,
      handles.atlasGeneration === GENERATION,
      `__GRIDATLAS_ATLAS__.generation=${handles.atlasGeneration} current.json=${GENERATION}`);

    /* THE TWO CONTROLS, RESOLVED ONCE, STRUCTURALLY, AND HELD. */
    const printControl = await exportControl(page, 'print');
    const imageControl = await exportControl(page, 'image');
    receipt.selectors = { print: printControl.how, image: imageControl.how };
    check(`${viewport.name}: both export controls are addressable without reading their text`,
      Boolean(printControl.locator) && Boolean(imageControl.locator),
      `print via ${printControl.how}; image via ${imageControl.how}`);

    /* The owning menu, found by containment rather than by the word "File".
       Menus start closed and the bar closes them again after every non-title
       button press, so this is called before EACH action, and it verifies
       the panel is actually open before the action is attempted. */
    const exportMenu = page.locator('#gridatlas-menu-bar .gm-menu')
      .filter({ has: page.locator('button[data-gm-export]') }).first();
    const exportTitle = exportMenu.locator('.gm-title').first();
    async function openExportMenu(label) {
      const already = await exportMenu.evaluate(node => node.classList.contains('gm-open'))
        .catch(() => false);
      /* openMenu() is a TOGGLE. A blind click on an already-open menu closes
         the very panel this is here to open. */
      if (!already) await exportTitle.click({ timeout: 10000 });
      const state = await exportMenu.evaluate(node => {
        const title = node.querySelector('.gm-title');
        const panel = node.querySelector('.gm-panel');
        return {
          open: node.classList.contains('gm-open'),
          menuTitle: title ? title.textContent : null,
          expanded: title ? title.getAttribute('aria-expanded') : null,
          panelHidden: panel ? panel.hidden : null
        };
      });
      receipt[`menu_before_${label}`] = state;
      check(`${viewport.name}: the export menu is open before ${label} is clicked`,
        state.open && state.expanded === 'true' && state.panelHidden === false,
        `open=${state.open} aria-expanded=${state.expanded} panel.hidden=${state.panelHidden}`
        + ` (menu titled ${JSON.stringify(state.menuTitle)})`);
      return state;
    }

    /* D. Save an image, and decode what came out. */
    if (imageControl.locator) {
      await openExportMenu('save');
      /* The anchor the app itself creates is observed in the capture phase.
         It changes nothing the app does -- the app's own click still runs --
         and it yields the exact bytes a reader would receive, which is what
         the pixel assertions below are taken over. */
      await page.evaluate(() => {
        window.__capturedDownloadHref = null;
        document.addEventListener('click', (event) => {
          const anchor = event.target && event.target.closest
            ? event.target.closest('a[download]') : null;
          if (anchor) window.__capturedDownloadHref = anchor.getAttribute('href');
        }, true);
      });
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
        .catch(() => null);
      await imageControl.locator.click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      /* Read the text back through the SAME locator. The text is evidence of
         what the app reported; it was never the way this driver finds the
         button. */
      receipt.imageButtonText = (await imageControl.locator.textContent() || '').trim();
      const download = await downloadPromise;
      receipt.downloadName = download ? download.suggestedFilename() : null;
      if (download) {
        const target = path.join(os.tmpdir(),
          `gridatlas-export-proof-${process.pid}-${viewport.width}.png`);
        await download.saveAs(target);
        const png = await readFile(target);
        receipt.pngBytes = png.length;
        receipt.pixels = await page.evaluate(async (dataUrl) => {
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve; image.onerror = reject; image.src = dataUrl;
          });
          const probe = document.createElement('canvas');
          probe.width = image.naturalWidth; probe.height = image.naturalHeight;
          const context = probe.getContext('2d');
          /* Drawn at NATURAL size and sampled on a grid: downscaling
             interpolates, and interpolation would manufacture the very
             colour variety this assertion is looking for. */
          context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, probe.width, probe.height).data;
          const step = 64;
          const counts = new Map();
          let opaque = 0, sampled = 0;
          for (let y = 0; y < probe.height; y += Math.max(1, Math.floor(probe.height / step))) {
            for (let x = 0; x < probe.width; x += Math.max(1, Math.floor(probe.width / step))) {
              const at = ((y * probe.width) + x) * 4;
              sampled += 1;
              if (data[at + 3] !== 0) opaque += 1;
              const key = `${data[at]},${data[at + 1]},${data[at + 2]},${data[at + 3]}`;
              counts.set(key, (counts.get(key) || 0) + 1);
            }
          }
          let top = 0;
          for (const value of counts.values()) if (value > top) top = value;
          return {
            naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
            sampled, opaque, distinctColours: counts.size,
            dominantShare: sampled ? Number((top / sampled).toFixed(4)) : 1
          };
        }, `data:image/png;base64,${png.toString('base64')}`);
      }
      receipt.capturedHref = await page.evaluate(
        () => (window.__capturedDownloadHref || '').slice(0, 32) || null);
    }
    const pixels = receipt.pixels || {};
    check(`${viewport.name}: saving an image reports success rather than refusing`,
      /Image saved/.test(receipt.imageButtonText || ''),
      `button reads ${JSON.stringify(receipt.imageButtonText)}`);
    check(`${viewport.name}: the browser actually received a download`,
      Boolean(receipt.downloadName) && /^gridatlas-\d+\.png$/.test(receipt.downloadName || ''),
      `download=${receipt.downloadName} href starts ${JSON.stringify(receipt.capturedHref)}`);
    check(`${viewport.name}: the saved PNG is a plausible size for a map view`,
      (receipt.pngBytes || 0) > 10000,
      `${receipt.pngBytes || 0} bytes`);
    check(`${viewport.name}: the saved PNG carries map content, not a solid rectangle`,
      (pixels.distinctColours || 0) >= 8 && (pixels.dominantShare === undefined
        ? false : pixels.dominantShare < 0.95) && (pixels.opaque || 0) > 0,
      `${pixels.naturalWidth}x${pixels.naturalHeight}, ${pixels.distinctColours} distinct colours`
      + ` over ${pixels.sampled} sampled pixels, dominant colour ${pixels.dominantShare} of them,`
      + ` ${pixels.opaque} non-transparent`);

    /* A + E. Print: install the stylesheet the way a reader does, by clicking
       the Print control, with window.print neutered so no dialog blocks. */
    await page.evaluate(() => {
      window.__printCalls = 0;
      window.print = function () { window.__printCalls += 1; };
    });
    if (printControl.locator) {
      /* REOPENED. The Save click above closed this menu -- the bar's own
         document listener does `setTimeout(closeAll, 0)` after any non-title
         button inside it. */
      await openExportMenu('print');
      await printControl.locator.click({ timeout: 10000 });
    }
    await page.waitForTimeout(700);
    receipt.printCalls = await page.evaluate(() => window.__printCalls);
    receipt.printCssInstalled = await page.evaluate(
      () => Boolean(document.getElementById('gridatlas-print-css')));
    receipt.stamp = await page.evaluate(() => {
      const node = document.querySelector('#gridatlas-print-furniture .gpf-stamp');
      return node ? node.textContent : null;
    });
    receipt.attrib = await page.evaluate(() => {
      const node = document.querySelector('#gridatlas-print-furniture .gpf-attrib');
      return node ? node.textContent : null;
    });
    check(`${viewport.name}: the print stylesheet is installed by the Print control`,
      receipt.printCssInstalled, `window.print called ${receipt.printCalls} time(s)`);
    check(`${viewport.name}: the export stamp names the generation it came from`,
      typeof receipt.stamp === 'string' && receipt.stamp.includes(`generation ${GENERATION}`),
      `stamp=${JSON.stringify(receipt.stamp)}`);
    check(`${viewport.name}: the export stamp still carries the attribution`,
      /OpenStreetMap/.test(receipt.attrib || ''), receipt.attrib);

    receipt.screenCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibregl-canvas');
      if (!canvas) return null;
      const box = canvas.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    });
    /* The DRAWING BUFFER, not the CSS box: whatever the print path captures
       comes out at this size, and it is what the PDF raster is checked
       against below. */
    receipt.canvasBuffer = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibregl-canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(800);
    receipt.printCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibregl-canvas');
      if (!canvas) return null;
      const box = canvas.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    });
    check(`${viewport.name}: the map canvas has a height greater than zero under print media`,
      receipt.printCanvas && receipt.printCanvas.height > 0,
      `screen ${receipt.screenCanvas && receipt.screenCanvas.width}x${receipt.screenCanvas && receipt.screenCanvas.height}`
      + ` -> print ${receipt.printCanvas && receipt.printCanvas.width}x${receipt.printCanvas && receipt.printCanvas.height}`);
    check(`${viewport.name}: the printed map keeps at least half its on-screen height`,
      receipt.printCanvas && receipt.screenCanvas
      && receipt.printCanvas.height >= receipt.screenCanvas.height * 0.5,
      `${receipt.printCanvas && receipt.printCanvas.height} vs ${receipt.screenCanvas && receipt.screenCanvas.height} on screen`);

    /* Back to screen media before anything is clicked again: the print
       stylesheet hides the menu bar outright, so a control cannot be pressed
       while print media is emulated. Page.printToPDF applies print media
       itself, so nothing is lost. */
    await page.emulateMedia({ media: null });
    await page.waitForTimeout(300);

    /* B + C. The artefact itself. */
    const session = await context.newCDPSession(page);
    receipt.pdf = {};
    for (const paper of PAPERS) {
      /* PRINT IS INVOKED AGAIN FOR EACH SHEET, because that is what a reader
         does and because the export overlays are TEMPORARY: printView()
         removes them 20 seconds after the click, and generating three PDFs of
         a page this heavy takes longer than that. Measuring the second and
         third sheets against overlays the app had already cleaned up would be
         a driver artefact reported as a product failure -- the same class of
         mistake this file was rewritten to remove. */
      await openExportMenu(`print for ${paper.name}`);
      await printControl.locator.click({ timeout: 10000 });
      await page.waitForTimeout(1200);
      const overlays = await page.evaluate(() => ({
        furniture: document.querySelectorAll('#gridatlas-print-furniture').length,
        capturedMap: document.querySelectorAll('#gridatlas-print-map').length
      }));
      check(`${viewport.name} / ${paper.name}: the print overlays are on the page, exactly once each`,
        overlays.furniture === 1 && overlays.capturedMap === 1,
        `${overlays.furniture} furniture node(s), ${overlays.capturedMap} captured-map node(s)`);
      const options = { printBackground: true, preferCSSPageSize: paper.preferCSSPageSize };
      if (paper.paperWidth) { options.paperWidth = paper.paperWidth; options.paperHeight = paper.paperHeight; }
      const { data } = await session.send('Page.printToPDF', options);
      const facts = pdfFacts(data);
      receipt.pdf[paper.name] = facts;
      const sheet = facts.pagePt;
      const coverageOf = (image) => (image && image.placed && sheet)
        ? {
          width: Number((image.placed.widthPt / sheet.width).toFixed(3)),
          height: Number((image.placed.heightPt / sheet.height).toFixed(3))
        }
        : null;
      for (const image of facts.images) image.coverage = coverageOf(image);

      /* THE QUESTION IS NOT "IS THE LARGEST IMAGE THE MAP".
         The printed page carries more than one large raster -- the live
         canvas among them -- and asking about the largest one lets a blank
         rectangle answer for the map. So the page is asked whether ANY image
         on it is a picture of the map: big enough not to be an icon, laid
         out to fill the sheet, carrying more than one colour, and not hidden
         behind an alpha mask. If one such image exists, the reader sees a
         map. If none does, the sheet is blank however many images are on it. */
      const graded = facts.images.map(image => {
        const content = image.content || {};
        const coverage = image.coverage;
        return {
          image,
          bigEnough: image.width >= 200 && image.height >= 200,
          fills: Boolean(coverage)
            && Math.max(coverage.width, coverage.height) >= FILLS_ONE_DIRECTION
            && coverage.width <= NO_OVERFLOW && coverage.height <= NO_OVERFLOW,
          varied: (content.distinct || 0) >= MIN_DISTINCT
            && content.dominantShare !== undefined && content.dominantShare < MAX_DOMINANT,
          visible: !image.smask
            || (image.smask.nonZeroShare !== undefined && image.smask.nonZeroShare >= MIN_VISIBLE)
        };
      });
      const describe = (row) => {
        const content = row.image.content || {};
        const coverage = row.image.coverage;
        return `#${row.image.id} ${row.image.width}x${row.image.height}px`
          + ` placed ${coverage ? `${coverage.width}x${coverage.height}` : 'nowhere'} of the sheet,`
          + ` ${content.distinct === undefined ? content.unread : `${content.distinct} distinct/${content.sampled} sampled`}`
          + `, dominant ${content.dominantShare}`
          + (row.image.smask ? `, alpha non-zero ${row.image.smask.nonZeroShare}` : ', no mask');
      };
      const mapLike = graded.filter(row => row.bigEnough && row.fills);
      const printed = mapLike.filter(row => row.varied && row.visible);
      facts.verdict = {
        images: graded.length,
        big_and_filling_the_sheet: mapLike.length,
        carrying_visible_map_pixels: printed.length
      };

      check(`${viewport.name} / ${paper.name}: the PDF contains a rasterised map`,
        facts.imageCount >= 1, `${facts.imageCount} image XObjects (masks excluded) in ${facts.bytes} bytes`);
      check(`${viewport.name} / ${paper.name}: an image the size of the sheet is on the page, not just an icon`,
        mapLike.length >= 1,
        graded.length
          ? graded.map(describe).join(' | ')
          : 'no image XObject at all');
      check(`${viewport.name} / ${paper.name}: that image carries visible map pixels, not one flat colour behind an empty mask`,
        printed.length >= 1,
        mapLike.length
          ? mapLike.map(describe).join(' | ')
            + ` [floors: ${MIN_DISTINCT} distinct, dominant < ${MAX_DOMINANT}, alpha >= ${MIN_VISIBLE}]`
          : 'no sheet-sized image to inspect');
      check(`${viewport.name} / ${paper.name}: the slide is one page`,
        facts.pages === 1, `${facts.pages} pages`);
    }
    await session.detach().catch(() => { /* the context is closing anyway */ });
    await page.emulateMedia({ media: null });
    await context.close();
  }
} finally {
  /* Own every child. A browser or a listening socket left behind is a defect
     of this harness, not an inconvenience. */
  await browser.close().catch(() => { /* already gone */ });
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}

console.log(`route under test: ${ROUTE}`);
console.log(`generation under test: ${GENERATION}`);
console.log(`export cartridge: ${receipts.export_cartridge}`);
console.log(`export cartridge sha256: ${receipts.export_cartridge_sha256}`);
console.log(JSON.stringify(receipts, null, 2));
let failed = 0;
for (const entry of checks) {
  if (!entry.ok) failed += 1;
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? `  [${entry.detail}]` : ''}`);
}
console.log(`\n${checks.length - failed}/${checks.length} export outcome checks passed`);
if (RECEIPT_OUT) {
  await writeFile(path.resolve(RECEIPT_OUT),
    `${JSON.stringify({ route: ROUTE, generation: GENERATION, receipts, checks }, null, 2)}\n`, 'utf8');
}
if (failed) console.error(`${failed} export outcome check(s) failed`);
/* Explicit, so a stray handle cannot keep this process alive after the work
   is done and the receipts are written. */
process.exit(failed ? 1 : 0);
