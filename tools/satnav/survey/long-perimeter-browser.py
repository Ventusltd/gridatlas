"""Check the return bearing and final arrival through the successor survey's map controls."""
import os
from pathlib import Path
import runpy

from playwright.sync_api import expect, sync_playwright

GPS_SPY = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'compact-browser.py'))['GPS_SPY']
SITE = os.environ.get('SURVEY_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-survey-return-202611281319/')


def check(browser, engine, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
    context.add_init_script(GPS_SPY)
    page = context.new_page()
    ring = [[0, 51], [.02, 51], [.02, 51.001]]
    try:
        page.goto(SITE, wait_until='domcontentloaded', timeout=60_000)
        survey = page.locator('#satnav-survey')
        guidance = page.locator('#satnav-guide')
        expect(page.locator('#satnav-location')).to_be_enabled(timeout=60_000)
        survey.locator('summary').tap()
        page.locator('#satnav-location').tap()
        page.evaluate('at => window.__lineGpsTest.emit(at, 3)', ring[0])
        page.evaluate("pins => document.querySelector('#satnav-compact').satnavSurvey.replacePlan(pins)", ring)
        survey.get_by_role('button', name='Close perimeter').tap()
        expect(survey.locator('[data-plan]')).to_contain_text('Deviation unavailable on legs over 1 km')
        for point, target in zip(ring, ['Pin 2', 'Pin 3', 'Return to FROM']):
            page.evaluate('at => window.__lineGpsTest.emit(at, 3)', point)
            expect(guidance).to_contain_text(target)
        expect(guidance).to_contain_text('true')
        expect(guidance).to_contain_text('remaining')
        page.evaluate('at => window.__lineGpsTest.emit(at, 3)', ring[0])
        expect(guidance).to_have_text('Arrived at the final pin')
        page.locator('#satnav-stop').tap()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': [1]}
        print(f'{engine} {width}×{height} · long perimeter returns to FROM before arrival', flush=True)
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
                for dimensions in [(390, 664), (664, 390)]:
                    check(browser, engine, *dimensions)
            finally:
                browser.close()
