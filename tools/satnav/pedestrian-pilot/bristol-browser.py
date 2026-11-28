"""Touch acceptance against the combined V4 GridAtlas map and Bristol footpath data."""

import os

from playwright.sync_api import expect, sync_playwright


SITE = os.environ.get('LINE_TEST_URL', 'http://127.0.0.1:8873/atlas/v/satnav-layout-202611281330/')


def features(page, count):
    return page.wait_for_function("""count => {
      const data = window.__GRIDATLAS_V9_MAP__?.getSource('satnav-bristol-footpaths')?.serialize()?.data;
      return data?.features?.length === count ? data.features : null;
    }""", arg=count, timeout=20000).json_value()


def tap_endpoint(page, field, coordinates):
    page.locator('#satnav-' + field).tap()
    point = page.evaluate("""coordinates => {
      const map = window.__GRIDATLAS_V9_MAP__;
      const canvas = map.getCanvas();
      const box = canvas.getBoundingClientRect();
      map.easeTo({center: coordinates, zoom: 17, duration: 0, offset: [.32 * box.width, .18 * box.height]});
      const target = map.project(coordinates);
      const x = Math.round(box.left + target.x), y = Math.round(box.top + target.y);
      return {x, y, onMap: document.elementFromPoint(x, y) === canvas};
    }""", coordinates)
    assert point['onMap'], point
    page.touchscreen.tap(point['x'], point['y'])


def check_browser(browser, label, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
    try:
        page = context.new_page()
        page.goto(SITE, wait_until='domcontentloaded')
        panel = page.locator('#satnav-bristol')
        summary = panel.locator('summary')
        summary.wait_for(state='visible', timeout=60000)
        summary.tap()
        result = panel.get_by_role('status')
        example = panel.get_by_role('button', name='Show example')
        page.route('**/bristol-footpaths.geojson', lambda request: request.fulfill(status=503), times=1)
        example.tap()
        expect(result).to_contain_text('could not be loaded')
        example.tap()
        expect(result).to_contain_text('578 m')
        expect(result).to_contain_text('Current access is unverified')
        shown = features(page, 12)
        paths = {f['properties']['ROUTE_CODE']: f['geometry']['coordinates']
                 for f in shown if 'ROUTE_CODE' in f['properties']}
        assert len(paths) == 11
        summary.tap()
        expect(panel.locator('.footpath-brief')).to_be_visible()
        expect(panel.locator('.footpath-brief')).to_have_text('Example · BCC/21 · 578 m · access unverified')
        features(page, 12)
        summary.tap()
        panel.get_by_role('button', name='Route FROM to TO').tap()
        expect(result).to_contain_text('Select FROM and TO')
        features(page, 11)
        summary.tap()

        tap_endpoint(page, 'from', paths['BCC/21/10'][0])
        tap_endpoint(page, 'to', paths['BCC/21/30'][-1])
        summary.tap()
        expect(result).to_contain_text('FROM to TO · BCC/21')
        expect(result).to_contain_text('Current access is unverified')
        drawn = features(page, 12)
        route = next(f for f in drawn if f['properties'].get('role') == 'mapped-footpath')
        assert len(route['geometry']['coordinates']) > 10
        summary.tap()

        tap_endpoint(page, 'to', paths['BCC/38/30'][-1])
        expect(panel.locator('.footpath-brief')).to_have_text('Coverage only · no mapped route')
        expect(panel.locator('.footpath-brief')).to_be_visible()
        summary.tap()
        expect(result).to_contain_text('No mapped connection')
        features(page, 11)
        summary.tap()

        west, north = paths['BCC/21/10'][0]
        tap_endpoint(page, 'from', [west - .004, north])
        summary.tap()
        expect(result).to_contain_text('Route unavailable')
        features(page, 11)
        panel.get_by_role('button', name='Clear footpaths').tap()
        features(page, 0)
        expect(result).to_have_text('')
        print(f'{label} {width}×{height} passed Bristol example, pins, source retry, coverage, disconnection and clear')
    finally:
        context.close()


if __name__ == '__main__':
    with sync_playwright() as pw:
        for engine in os.environ.get('LINE_TEST_BROWSERS', 'chromium,webkit').split(','):
            options = {'args': ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']} if engine == 'chromium' else {}
            browser = getattr(pw, engine).launch(**options)
            try:
                for dimensions in [(390, 664), (664, 390)]:
                    check_browser(browser, engine, *dimensions)
            finally:
                browser.close()
