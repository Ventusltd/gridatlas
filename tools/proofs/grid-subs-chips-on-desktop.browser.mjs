/**
 * ARE GRID AND SUBS UNDER THE CURSOR, NOT INSIDE A MENU?
 * ---------------------------------------------------------------------------
 * "in mobile view the Grid and subs buttons are nice show them on desktop TOO"
 * -- the architect, 2026-09-05.
 *
 * These two chips were deliberately phone-only. The reasoning is on the record
 * and it was sound: the grid-line and substation switches live in a panel below
 * the map "which a phone never scrolls to; activation looked broken", so on a
 * touch screen the chips stay on the map. On desktop they were routed into the
 * menu because a menu is always one click away.
 *
 * That last step is the one being reversed. GRID and SUBS are the two layers a
 * reader toggles most often, and a control used that often belongs under the
 * cursor. This proof fails while they are reachable only through a menu.
 *
 *   node tools/proofs/grid-subs-chips-on-desktop.browser.mjs <base-url>
 */
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) { console.error('usage: <base-url>'); process.exit(2); }

const VIEWPORTS = [
  { name: '1400x900 desktop', width: 1400, height: 900 },
  { name: '2327x1156 ultrawide', width: 2327, height: 1156 },
  { name: '393x852 phone (must not regress)', width: 393, height: 852 }
];

const rows = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('#gridatlas-menu-bar').waitFor({ timeout: 90000 });
      await page.waitForTimeout(1500);
      /* Measured by BOX, not by presence in the DOM: a chip that exists inside
         a closed menu panel is exactly the state this proof exists to reject. */
      const chips = await page.evaluate(() => {
        /* The chips are '⚡ Grid' and '◉ Subs' -- a leading symbol,
           then the word. Matching on the word with any leading symbol is what
           this needs; an earlier version anchored on ⚡ alone and therefore
           never saw Subs at all, and reported a red that was its own.
           'Grid At Point' is a different control and is excluded by name. */
        const wanted = /^[^A-Za-z0-9]*\s*(grid|subs)\s*$/i;
        return Array.from(document.querySelectorAll('button,[role=button]'))
          .map(node => ({
            text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
            rect: node.getBoundingClientRect(),
            /* The menu bar's own GRID title is a button reading exactly
               "Grid" and it is NOT in a panel, so without this it counts as a
               chip on the map and this proof goes green while the chip is
               still buried in a menu -- passing for the wrong reason, which
               is worse than failing. */
            inMenu: !!(node.closest('.gm-panel') || node.closest('.gm-title')
              || node.classList.contains('gm-title')
              || node.closest('#gridatlas-menu-bar'))
          }))
          .filter(item => wanted.test(item.text))
          .map(item => ({
            text: item.text,
            onMap: item.rect.width > 0 && item.rect.height > 0 && !item.inMenu,
            inMenu: item.inMenu
          }));
      });
      const onMap = chips.filter(c => c.onMap).map(c => c.text);
      const ok = onMap.some(t => /grid/i.test(t)) && onMap.some(t => /subs/i.test(t));
      rows.push({ view: viewport.name, ok, detail: `on the map: [${onMap.join(', ')}]` });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${viewport.name}  on the map: [${onMap.join(', ')}]`);
    } finally { await context.close().catch(() => {}); }
  }
} finally { await browser.close().catch(() => {}); }

const failed = rows.filter(r => !r.ok);
console.log(`\n${rows.length - failed.length} passed, ${failed.length} failed, ${rows.length} checks`);
if (failed.length) process.exit(1);
