"""Exercise the phone's Layers button with a live direct-to-pin walk on a composed map."""

import argparse
import os
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


waypoints = run_path(str(Path(__file__).with_name('waypoint-browser.py')))

# A panel can have width and height while every checkbox is behind the map.
# Read only labels a real touchscreen can hit, bound to a live MapLibre layer.
FIND_ROW = """wanted => {
    const map = window.__GRIDATLAS_V9_MAP__;
    for (const input of document.querySelectorAll('#fs-curtain input[type=checkbox][data-layer-id]')) {
        const id = input.dataset.layerId;
        if ((wanted && wanted !== id) || !map.getLayer('l-' + id)) continue;
        const row = input.closest('label') || input;
        for (const target of [input, row]) {
            const rect = target.getBoundingClientRect();
            const x = Math.floor(rect.left + rect.width / 2);
            const y = Math.floor(rect.top + rect.height / 2);
            if (!rect.width || !rect.height || !row.contains(document.elementFromPoint(x, y))) continue;
            const visible = map.getLayoutProperty('l-' + id, 'visibility') !== 'none';
            if (visible === input.checked) return {id, x, y, visible};
        }
    }
    return null;
}"""


def row(page, layer=None):
    return page.wait_for_function(FIND_ROW, arg=layer, timeout=10000).json_value()


def tap_layer(page, before):
    page.touchscreen.tap(before['x'], before['y'])
    page.wait_for_function(
        """([id, expected]) => {
            const map = window.__GRIDATLAS_V9_MAP__;
            return map.getLayer('l-' + id) &&
              (map.getLayoutProperty('l-' + id, 'visibility') !== 'none') === expected;
        }""", arg=[before['id'], not before['visible']], timeout=10000)
    assert row(page, before['id'])['visible'] != before['visible']


def check_browser(browser, name, width, height):
    url = os.environ['LINE_TEST_URL']
    with browser.new_context(viewport={'width': width, 'height': height},
                             is_mobile=True, has_touch=True) as context:
        context.add_init_script(waypoints['GPS_SPY'])
        page = context.new_page()
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function("window.__GRIDATLAS_V9_MAP__?.getLayer('l-sat')", timeout=60000)
        toggle = page.locator('#gridatlas-dash-toggle')
        expect(toggle).to_be_visible(timeout=20000)
        page.evaluate("() => { window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-1.5,51.5],zoom:17}); }")
        target = waypoints['place'](page, 'to', 23)
        page.locator('#satnav-walk-start').tap()
        guidance = page.locator('#satnav-walk-guidance')

        def distance(metres):
            at = [target[0], target[1] - metres / 111195]
            waypoints['emit_fix'](page, at, accuracy=4)
            expect(guidance).to_contain_text(f'Direct to pin · {metres} m')
            assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': []}

        panel = page.locator('#fs-curtain')

        def toggle_panel(open_panel):
            point = toggle.evaluate('''el => {
                const r=el.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
                return el.contains(document.elementFromPoint(x,y)) ? [x,y] : null;
            }''')
            assert point, 'Layers button is outside the viewport or covered'
            page.touchscreen.tap(*point)
            if open_panel:
                expect(panel).to_be_visible(timeout=6000)
            else:
                expect(panel).to_be_hidden(timeout=6000)

        distance(63)
        toggle_panel(True)
        original = row(page, '400')
        tap_layer(page, original)
        toggle_panel(False)
        page.wait_for_function(f'id => !({FIND_ROW})(id)', arg=original['id'], timeout=10000)
        distance(35)
        toggle_panel(True)
        reopened = row(page, original['id'])
        assert reopened['visible'] != original['visible']
        tap_layer(page, reopened)
        toggle_panel(False)
        distance(49)
        page.locator('#satnav-walk-stop').tap()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': [1]}
        print(f"{name} {width}x{height}: layer l-{original['id']} changed on map, closed, "
              "reopened and restored; 63 → 35 → 49 m, one watch cleared.", flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('engine', choices=['chromium', 'webkit'])
    parser.add_argument('url', help='Full URL of the versioned Start walk entry')
    parser.add_argument('--executable', help='Optional installed Playwright browser binary')
    args = parser.parse_args()
    os.environ['LINE_TEST_URL'] = args.url
    with sync_playwright() as playwright:
        options = {'executable_path': args.executable} if args.executable else {}
        if args.engine == 'chromium':
            options['args'] = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        with getattr(playwright, args.engine).launch(**options) as browser:
            for viewport in [(390, 664), (664, 390)]:
                check_browser(browser, args.engine, *viewport)
