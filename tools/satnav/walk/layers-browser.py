"""Exercise the actual field-map Layers control while direct guidance is active."""

import os
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright

compact = run_path(str(Path(__file__).resolve().parents[1] / 'compact-browser.py'))
SITE = os.environ.get('WALK_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-walk-202611281345/')


def check(browser, engine, width, height):
    with browser.new_context(viewport={'width': width, 'height': height},
                             is_mobile=True, has_touch=True) as context:
        context.add_init_script(compact['GPS_SPY'])
        page = context.new_page()
        page.goto(SITE, wait_until='domcontentloaded', timeout=90000)
        page.wait_for_function("""() => document.querySelector('#gridatlas-menu-bar') &&
            document.querySelector('#satnav-compact')?.satnavSurvey?.getMap()?.getLayer('l-400') &&
            document.querySelectorAll('#fs-curtain-keys input[data-layer-id]').length >= 40""",
                               timeout=90000)
        start = page.locator('#satnav-walk-start')
        expect(start).to_be_visible()
        gap = page.evaluate("""() => document.querySelector('#satnav-from').getBoundingClientRect().top
            - document.querySelector('#gridatlas-menu-bar').getBoundingClientRect().bottom""")
        assert gap >= 7, gap
        page.locator('#satnav-to').tap()
        target = compact['map_canvas_tap'](page)['coordinates']
        start.tap()
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', [target[0], target[1] - .00057])
        guidance = page.locator('#satnav-walk-guidance')
        expect(guidance).to_contain_text('Direct to pin')
        expect(guidance).to_contain_text('° true')
        before = guidance.inner_text()
        button = page.locator('#gridatlas-dash-toggle')
        panel = page.locator('#fs-curtain')
        expect(button).to_have_attribute('aria-expanded', 'false')
        button.tap()
        expect(panel).to_be_visible()
        expect(button).to_have_attribute('aria-expanded', 'true')
        layer = panel.locator('input[data-layer-id="400"]')
        source = page.locator('#scada-ui-container input[data-layer-id="400"]')
        original = layer.is_checked()
        layer.tap()
        assert layer.is_checked() == source.is_checked() == (not original)
        page.wait_for_function("""state => window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-400','visibility') === state""",
                               arg='none' if original else 'visible')
        page.evaluate('at => window.__lineGpsTest.emit(at, 4)', [target[0], target[1] - .00032])
        expect(guidance).not_to_have_text(before)
        expect(guidance).to_contain_text('° true')
        button.tap()
        expect(panel).to_be_hidden()
        button.tap()
        expect(panel).to_be_visible()
        assert layer.is_checked() == (not original)
        layer.tap()
        page.wait_for_function("""state => window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-400','visibility') === state""",
                               arg='visible' if original else 'none')
        button.tap()
        expect(panel).to_be_hidden()
        page.locator('#satnav-walk-stop').tap()
        expect(guidance).to_have_text('Walk stopped')
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': [1]}
        print(f'{engine} {width}×{height}: {gap:g}px header gap, 400 kV switched both ways, '
              'layer panel reopened, live guidance updated, one GPS watch started and cleared.', flush=True)


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for name in os.environ.get('LINE_TEST_BROWSERS', 'chromium,webkit').split(','):
            options = {'args': ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
                                '--enable-unsafe-swiftshader']} if name == 'chromium' else {}
            browser = getattr(playwright, name).launch(**options)
            try:
                for viewport in [(390, 664), (664, 390)]:
                    check(browser, name, *viewport)
            finally:
                browser.close()
