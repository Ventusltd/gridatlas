"""Test the actual survey controls and local download using simulated device fixes."""

import json
import os
import runpy
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

GPS_SPY = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'compact-browser.py'))['GPS_SPY']
SITE = os.environ.get('SURVEY_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-survey-202611281318/')


def check(browser, label, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True,
                                  has_touch=True, accept_downloads=True)
    context.add_init_script(GPS_SPY)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(SITE, wait_until='domcontentloaded', timeout=60000)
        scope = page.locator('#satnav-survey')
        expect(page.locator('#satnav-from')).to_be_enabled(timeout=60000)
        expect(scope.locator('summary')).to_be_visible(timeout=15000)
        scope.locator('summary').tap()
        expect(scope.get_by_role('button', name='Record track')).to_be_disabled()
        assert page.evaluate('window.__lineGpsTest.records.starts') == []
        page.locator('#satnav-location').tap()
        page.evaluate('window.__lineGpsTest.emit([0, 51], 6)')
        page.evaluate("""() => document.querySelector('#satnav-compact').satnavSurvey.replacePlan(
            [[0,51], [.001,51], [.001,51.001]])""")
        scope.get_by_role('button', name='Close perimeter').tap()
        expect(scope.locator('[data-plan]')).to_contain_text('Planned perimeter')
        scope.get_by_role('button', name='Record track').tap()
        page.evaluate('window.__lineGpsTest.emit([0,51], 4)')
        expect(scope.locator('[data-track]')).to_contain_text('1 fix')
        page.evaluate('window.__lineGpsTest.emit([0.0001,51], 5)')
        expect(scope.locator('[data-track]')).to_contain_text('2 fixes')
        scope.get_by_role('button', name='Pause track').tap()
        page.evaluate('window.__lineGpsTest.emit([.5,51], 5)')
        scope.get_by_role('button', name='Resume track').tap()
        page.evaluate('window.__lineGpsTest.emit([.001,51], 6)')
        expect(scope.locator('[data-track]')).to_contain_text('3 fixes')
        page.evaluate('window.__lineGpsTest.emit([.8,51], 75)')
        page.evaluate('window.__lineGpsTest.emit([.0011,51], 9)')
        expect(scope.locator('[data-track]')).to_contain_text('4 fixes')
        page.locator('#satnav-stop').tap()
        expect(scope.locator('[data-track]')).to_contain_text('Stopped')
        expect(scope.get_by_role('button', name='Record track')).to_be_disabled()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': [1]}
        with page.expect_download(timeout=10000) as event:
            scope.get_by_role('button', name='Export GeoJSON').tap()
        download = event.value
        assert download.suggested_filename.endswith('.geojson')
        data = json.loads(Path(download.path()).read_text())
        roles = [f['properties']['satnavRole'] for f in data['features']]
        assert roles.count('waypoint') == 3 and roles.count('perimeter') == 1
        assert roles.count('walked-track') == 1 and roles.count('walked-fix') == 2
        measured = next(f for f in data['features'] if f['properties']['satnavRole'] == 'walked-track')
        assert measured['geometry']['coordinates'] == [[0,51],[.0001,51]]
        assert measured['properties']['accuracyM'] == [4,5]
        assert measured['properties']['timestampMs'][1] > measured['properties']['timestampMs'][0]
        page.wait_for_function("""() => window.__GRIDATLAS_V9_MAP__.getSource('satnav-field-survey')
            ?.serialize().data.features.filter(f => f.properties.satnavRole === 'walked-fix').length === 2""")
        scope.get_by_role('button', name='Open perimeter').tap()
        expect(scope.locator('[data-plan]')).to_be_empty()
        assert not errors, errors
        print(f'{label} {width}×{height} · perimeter, watch, pause, gaps, actual GeoJSON download passed', flush=True)
    finally:
        context.close()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        for engine in os.environ.get('SURVEY_BROWSERS', 'chromium,webkit').split(','):
            options = {}
            if engine == 'chromium':
                options['args'] = ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
                if os.environ.get('CHROMIUM_PATH'):
                    options['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = getattr(playwright, engine).launch(**options)
            try:
                for dimensions in [(390,664), (664,390)]:
                    check(browser, engine, *dimensions)
            finally:
                browser.close()
