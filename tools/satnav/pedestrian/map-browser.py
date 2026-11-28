"""Verify the Bristol control, actual MapLibre geometry and pin preservation in V4."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BUNDLE = json.loads(Path(__file__).with_name('bristol-footpaths.geojson').read_text())
API = "document.getElementById('satnav-compact').satnavSurvey"
COUNT_ROUTES = """() => {
    const control = document.getElementById('satnav-compact').satnavSurvey;
    const source = control.getMap().getSource('satnav-bristol-footpaths');
    const features = source?.serialize().data.features ?? [];
    return features.filter(f => f.properties.role === 'mapped-footpath').length;
}"""


def endpoints(code):
    sections = [f['geometry']['coordinates'] for f in BUNDLE['features']
                if f['properties']['ROUTE_CODE'].startswith(code + '/')]
    return [sections[0][0], sections[-1][-1]]


def check(browser, url, width, height):
    with browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True) as context:
        page = context.new_page()
        page.goto(url, wait_until='domcontentloaded')
        box = page.locator('#satnav-bristol')
        expect(box).to_be_attached(timeout=90000)
        summary = box.locator('summary')
        result = box.get_by_role('status')

        def wait_route(count):
            page.wait_for_function(f'({COUNT_ROUTES})() === {count}', timeout=30000)

        def set_pins(pins):
            page.evaluate(f'p => {API}.replacePlan(p)', pins)

        def get_pins():
            return page.evaluate(f'{API}.getPins().map(p=>p.coordinate)')

        summary.tap()
        original = [[-2.64, 51.50], [-2.61, 51.50]]
        set_pins(original)
        box.get_by_role('button', name='Show example').tap()
        expect(result).to_contain_text('BCC/21 · 578 m')
        wait_route(1)
        assert get_pins() == original
        box.get_by_role('button', name='Route FROM to TO').tap()
        expect(result).to_contain_text('unavailable')
        wait_route(0)
        for code, metres in [('BCC/21', 578), ('BCC/25', 1276), ('BCC/38', 342)]:
            set_pins(endpoints(code))
            expect(result).to_contain_text(f'{code} · {metres} m')
            wait_route(1)

        current = get_pins()
        summary.tap()
        wait_route(0)
        assert get_pins() == current
        summary.tap()
        box.get_by_role('button', name='Route FROM to TO').tap()
        expect(result).to_contain_text('BCC/38')
        wait_route(1)
        box.get_by_role('button', name='Clear footpaths').tap()
        wait_route(0)
        assert get_pins() == current
        assert page.evaluate(f'{API}.isTracking()') is False


if __name__ == '__main__':
    site = os.environ.get('SATNAV_V4_URL', 'http://127.0.0.1:8873/atlas/v/satnav-layout-202611281330/')
    with sync_playwright() as playwright:
        for engine in os.environ.get('SATNAV_TEST_BROWSERS', 'chromium,webkit').split(','):
            options = {'args': ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
                                '--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            with getattr(playwright, engine).launch(**options) as launched:
                for w,h in [(390,664),(664,390)]:
                    check(launched,site,w,h)
                    print(f'{engine} {w}×{h} Bristol routing controls passed')
