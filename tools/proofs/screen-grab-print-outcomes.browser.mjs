/**
 * DOES THE SHEET SHOW WHAT THE READER WAS LOOKING AT?
 * ---------------------------------------------------------------------------
 * Not "did a PDF come out" -- 202609051329-pdf-export-outcomes.browser.mjs
 * already establishes that bytes arrive and that they carry a map. This asks
 * the question that one cannot: is the thing on the sheet the READER'S SCREEN,
 * or an edited version of it?
 *
 * WHY IT EXISTS. The architect printed a view from the File menu on
 * 2026-09-05, with layers selected, and the layers were not on the sheet:
 *
 *     "The layers are vital otherwise the reader doesnt know what is being
 *      shown on the map"
 *     "Keep EVERYTHING IN THE PRINT, DONT TRY TO BE CLEVER, JUST A SCREEN GRAP
 *      OF WHAT THE USER SEES ... just print what is already being rendered on
 *      the display"
 *
 * The cause was one rule in the print stylesheet -- `body > *{display:none
 * !important}` -- which hid the whole page and printed a map raster edge to
 * edge as a presentation slide. That was a deliberate design, and it is the
 * design the architect has now overruled. No proof in the tree could see it,
 * because every one of them asked about the PDF and none asked about the page.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE CAN GO RED
 *   - the layer controls have a non-zero box under PRINT media
 *                                       (goes red on `body > *{display:none}`;
 *                                        this is the architect's finding)
 *   - the menu bar has a non-zero box under print media
 *                                       (goes red if the bar is hidden again)
 *   - the legend/attribution is on the sheet
 *                                       (goes red if the credit is dropped)
 *   - the page box is the VIEWPORT's width, not the paper's
 *                                       (goes red the moment the layout is
 *                                        allowed to reflow to paper width,
 *                                        which turned a 1390px desktop view
 *                                        into a phone-shaped column)
 *   - the map raster sits INSIDE the canvas's box, not over the viewport
 *                                       (goes red if the raster is appended to
 *                                        <body> and stretched inset:0 again,
 *                                        which is what covered the panel)
 *   - the provenance strip starts at or below the bottom of the view
 *                                       (goes red if the furniture is painted
 *                                        back over the map, which truncated the
 *                                        generation stamp on a real sheet)
 *
 * WHAT IT DOES NOT ESTABLISH. It measures the DOM under print emulation, which
 * is the layout the rasteriser is handed. It does not open a print dialog and
 * it does not drive a physical printer -- neither is ours, and the Firefox
 * no-file-at-all failure of 2026-09-05 happened entirely inside the part that
 * is not. A green run here means the SHEET IS LAID OUT CORRECTLY, not that a
 * particular driver accepted it.
 *
 *   node tools/proofs/screen-grab-print-outcomes.browser.mjs <base-url>
 */
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) {
  console.error('usage: node screen-grab-print-outcomes.browser.mjs <base-url>');
  process.exit(2);
}

const VIEWPORTS = [
  { name: '393x852 phone portrait', width: 393, height: 852 },
  { name: '852x393 phone landscape', width: 852, height: 393 },
  { name: '1400x900 desktop', width: 1400, height: 900 }
];

const failures = [];
const rows = [];

function check(view, name, ok, detail) {
  rows.push({ view, name, ok, detail });
  if (!ok) failures.push(`${view} :: ${name} :: ${detail}`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
      /* The layer controls are built by the engine after the map settles.
         Waiting for the canvas is not enough: a canvas exists before any
         control does, and asserting against a half-built panel manufactures a
         red that says nothing. */
      await page.locator('canvas').first().waitFor({ timeout: 90000 });
      /* WAIT FOR THE BAR, NOT FOR A PROXY FOR IT.
         The first version of this waited for `input[type=checkbox] > 0` and
         measured at 0.2 s, when 126 boxes existed and the menu bar did not --
         and then reported the bar "absent", which is a defect in the proof and
         not in the app. The bar installs only once SIXTY-THREE UNIQUE layer
         controls exist; measured headless at 1400x900 it appears at 2.2 s with
         189 checkboxes present. So the wait is for the bar itself. */
      await page.locator('#gridatlas-menu-bar').waitFor({ timeout: 90000 });

      /* Press the app's own control rather than reproducing what it does.
         A proof that installs the print stylesheet itself proves nothing about
         the button the reader presses. window.print() is stubbed so the run
         does not block on a dialog that never gets an answer in headless. */
      await page.evaluate(() => {
        window.__printCalled = 0;
        window.print = () => { window.__printCalled += 1; };
      });

      const pressed = await page.evaluate(() => {
        const wanted = /(^|\b)print(\b|$)/i;
        const nodes = Array.from(document.querySelectorAll('button,[role=menuitem],a'));
        const target = nodes.find(node => wanted.test((node.textContent || '').trim())
          && !/source/i.test(node.textContent || ''));
        if (!target) return false;
        target.click();
        return true;
      });

      /* If the control could not be reached the run must say so rather than
         silently measure a page that was never printed. */
      check(viewport.name, 'the app\'s own Print control is reachable', pressed,
        pressed ? 'clicked' : 'no element whose text is "Print" was found');

      if (pressed) {
        await page.waitForTimeout(1200);
      } else {
        /* Still measure the stylesheet, so a missing button does not mask a
           second, independent defect in the sheet itself. */
        await page.evaluate(() => {
          const style = document.getElementById('gridatlas-print-css');
          if (!style) return;
        });
      }

      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(250);

      const measured = await page.evaluate(() => {
        const box = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            w: Math.round(rect.width), h: Math.round(rect.height),
            top: Math.round(rect.top), left: Math.round(rect.left),
            display: style.display, visibility: style.visibility
          };
        };
        const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'));
        const visibleCheckboxes = checkboxes.filter(node => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          /* A control can be laid out and still be invisible if an ancestor is
             display:none, which is exactly what `body > *` did. A zero box is
             the honest test. */
          return rect.width > 0 && rect.height > 0;
        });
        const anyAncestorHidden = (selector) => {
          let node = document.querySelector(selector);
          while (node && node !== document.documentElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none') return node.tagName + (node.id ? '#' + node.id : '');
            node = node.parentElement;
          }
          return null;
        };
        return {
          bodyWidth: Math.round(document.body.getBoundingClientRect().width),
          innerWidth: window.innerWidth,
          pinnedWidth: getComputedStyle(document.documentElement)
            .getPropertyValue('--gpf-vw').trim(),
          pinnedHeight: getComputedStyle(document.documentElement)
            .getPropertyValue('--gpf-vh').trim(),
          checkboxCount: checkboxes.length,
          visibleCheckboxes: visibleCheckboxes.length,
          controlsHiddenBy: anyAncestorHidden('input[type=checkbox]'),
          menuBar: box('#gridatlas-menu-bar'),
          mapControls: box('.map-controls'),
          canvas: box('.maplibregl-canvas'),
          raster: box('#gridatlas-print-map'),
          rasterParent: (() => {
            const node = document.getElementById('gridatlas-print-map');
            if (!node || !node.parentElement) return null;
            const parent = node.parentElement;
            return parent.tagName.toLowerCase()
              + (parent.className ? '.' + String(parent.className).split(/\s+/)[0] : '');
          })(),
          furniture: box('#gridatlas-print-furniture'),
          attribution: box('.maplibregl-ctrl-attrib-inner')
        };
      });

      /* THE ARCHITECT'S FINDING, AS A CHECK. */
      check(viewport.name, 'layer controls are on the sheet',
        measured.visibleCheckboxes > 0,
        `${measured.visibleCheckboxes} of ${measured.checkboxCount} controls have a box`
          + (measured.controlsHiddenBy ? `; hidden by ${measured.controlsHiddenBy}` : ''));

      check(viewport.name, 'the menu bar is on the sheet',
        !!(measured.menuBar && measured.menuBar.w > 0 && measured.menuBar.h > 0),
        JSON.stringify(measured.menuBar));

      check(viewport.name, 'the layout keeps the screen\'s width, not the paper\'s',
        measured.pinnedWidth === `${viewport.width}px`,
        `--gpf-vw is "${measured.pinnedWidth}", viewport is ${viewport.width}px`);

      if (measured.raster) {
        check(viewport.name, 'the raster is inside the canvas box, not over the page',
          measured.raster.w <= measured.innerWidth
            && measured.rasterParent !== 'body',
          `raster ${measured.raster.w}x${measured.raster.h} in <${measured.rasterParent}>`);
      } else {
        /* No raster is a legitimate outcome -- a capture can fail -- but then
           the live canvas must NOT have been hidden, or the map is a hole. */
        check(viewport.name, 'no raster means the live canvas is still shown',
          !(measured.canvas && measured.canvas.visibility === 'hidden'),
          'no #gridatlas-print-map, canvas visibility '
            + (measured.canvas ? measured.canvas.visibility : 'no canvas'));
      }

      if (measured.furniture) {
        const viewBottom = measured.pinnedHeight
          ? parseInt(measured.pinnedHeight, 10) : viewport.height;
        check(viewport.name, 'the provenance strip does not cover the view',
          measured.furniture.top >= viewBottom - 2,
          `furniture top ${measured.furniture.top}, view bottom ${viewBottom}`);
      }

      console.log(`-- ${viewport.name}: ${measured.visibleCheckboxes}/${measured.checkboxCount} `
        + `controls, menubar ${measured.menuBar ? measured.menuBar.w + 'x' + measured.menuBar.h : 'absent'}, `
        + `pinned ${measured.pinnedWidth || 'unset'}`);
    } finally {
      await context.close().catch(() => {});
    }
  }
} finally {
  await browser.close().catch(() => {});
}

for (const row of rows) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.view}  ${row.name}  -- ${row.detail}`);
}
console.log(`\n${rows.filter(r => r.ok).length} passed, ${failures.length} failed, `
  + `${rows.length} checks`);
if (failures.length) {
  console.error('\nFAILURES:');
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}
