import json
import math
from urllib.parse import parse_qs, urlencode, urlparse

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8768/'
DEMO = BASE + 'atlas/v/satnav-native-m1/'
COMPASS = 'https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/'
CARD = DEMO + '?' + urlencode({
    'repd_ref': 12588, 'latitude': 51.8132088, 'longitude': -1.3489728,
    'project': 'Botley West', 'technology': 'solar', 'journey': 'vicinity',
    'origin_type': 'repd', 'origin_id': 'repd:12588', 'radius_km': 10,
})
MOCK_GPS = '''
    window.__gpsRequests = 0;
    Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
        watchPosition() { window.__gpsRequests++; return 1; }, clearWatch() {},
    }});
'''


def ready(page, url):
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#gridatlas-satnav-pick:not(:disabled)')", timeout=45000)
    page.locator('#gridatlas-satnav-toggle').click()


def choose_compass(page, name, point):
    page.locator('#gridatlas-satnav-confirm').click()
    page.wait_for_url(COMPASS + '?*')
    assert page.locator('#destination').inner_text() == name
    query = parse_qs(urlparse(page.url).query)
    assert query['mode'] == ['compass']
    assert set(query) == {'latitude', 'longitude', 'name', 'mode'}
    assert math.isclose(float(query['longitude'][0]), point[0], abs_tol=1e-6)
    assert math.isclose(float(query['latitude'][0]), point[1], abs_tol=1e-6)
    assert page.evaluate('window.__gpsRequests') == 0
    assert page.locator('#start').is_enabled()


def open_card(page):
    ready(page, CARD)
    page.locator('#gridatlas-satnav-close').click()
    page.locator('#gridatlas-pipeline-vicinity-button').click(timeout=45000)
    page.wait_for_function('''() => {
        const card = window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp;
        return card?.swipe?.entries?.length >= 2;
    }''', timeout=45000)
    page.locator('#gridatlas-satnav-toggle').click()


def selected(page, kind):
    return page.evaluate('''kind => {
        const card = window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp;
        if (kind === 'origin') return { name:card.r.n, at:card.r.a };
        const entry = card.swipe.entries[card.swipe.index];
        return { name:entry.name, at:entry.at };
    }''', kind)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=[
        '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ])
    context = browser.new_context(viewport={'width': 1024, 'height': 740})
    context.add_init_script(MOCK_GPS)
    page = context.new_page()
    tile_responses = []
    page.on('response', lambda response: tile_responses.append(response.status)
            if 'World_Imagery/MapServer/tile/' in response.url else None)
    ready(page, DEMO)
    page.evaluate("window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-2.1,53.4], zoom:9})")
    canvas = page.locator('.maplibregl-canvas').first.bounding_box()
    x, y = round(canvas['x'] + canvas['width'] * .58), round(canvas['y'] + canvas['height'] * .39)
    page.locator('#gridatlas-satnav-pick').click()
    page.wait_for_function("window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-sat','visibility') === 'visible'")
    page.wait_for_function("window.__GRIDATLAS_V9_MAP__.isSourceLoaded('sat-s')", timeout=45000)
    page.wait_for_timeout(1200)  # Allow the native raster fade-in before capturing the map.
    page.mouse.click(x, y)
    page.locator('#gridatlas-satnav-confirm:visible').wait_for()
    assert page.url == DEMO
    page.locator('#gridatlas-satnav-cancel').click()
    page.mouse.click(x, y)
    assert page.locator('#gridatlas-satnav-confirm').is_hidden()
    assert page.url == DEMO
    page.locator('#gridatlas-satnav-pick').click()
    expected = page.evaluate('''([x,y]) => {
        const map = window.__GRIDATLAS_V9_MAP__;
        const rect = map.getCanvas().getBoundingClientRect();
        return map.unproject([x-rect.left, y-rect.top]).toArray();
    }''', [x, y])
    page.mouse.click(x, y)
    page.locator('#gridatlas-satnav-confirm:visible').wait_for()
    assert page.evaluate('window.__gpsRequests') == 0
    page.screenshot(path='satellite-selection.png')
    assert 200 in tile_responses
    print(json.dumps({'satelliteTileResponses': tile_responses, 'nativeLayerVisible': True}), flush=True)
    choose_compass(page, 'Chosen map point', expected)
    print('PASS native satellite click, cancel, explicit confirmation, signed compass handoff and GPS opt-in', flush=True)

    ready(page, DEMO)
    page.locator('#gridatlas-satnav-satnav summary').click()
    page.locator('#gridatlas-satnav-latitude').fill('51.5')
    page.locator('#gridatlas-satnav-longitude').fill('-0.4')
    page.locator('#gridatlas-satnav-label').fill('Manual field point')
    page.locator('#gridatlas-satnav-manual').click()
    page.locator('#gridatlas-satnav-latitude').fill('invalid')
    page.locator('#gridatlas-satnav-manual').click()
    assert page.locator('#gridatlas-satnav-confirm').is_visible()
    choose_compass(page, 'Manual field point', [-0.4, 51.5])
    print('PASS signed manual destination and invalid edit retains pending selection', flush=True)

    ready(page, DEMO)
    page.locator('#gridatlas-satnav-satnav summary').click()
    page.locator('#gridatlas-satnav-latitude').fill('51.5')
    page.locator('#gridatlas-satnav-longitude').fill('-0.4')
    page.locator('#gridatlas-satnav-manual').click()
    page.locator('#gridatlas-satnav-vicinity').click()
    page.wait_for_function('''() => {
      const c=window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp;
      return c?.project && c.r.a[0]===-0.4 && !c.r.p.repd_ref;
    }''')
    assert page.locator('[data-vicinity-focus-title]').inner_text() == 'Manual coordinate point'
    print('PASS anonymous plain-point native Vicinity without fabricated REPD reference', flush=True)

    ready(page, DEMO)
    page.locator('#gridatlas-satnav-satnav summary').click()
    page.get_by_label('Existing substation name or source ID').fill('Iver')
    page.locator('#gridatlas-satnav-search').click()
    station=page.locator('#gridatlas-satnav-station-0')
    station.wait_for(timeout=30000)
    assert page.locator('#gridatlas-satnav-station-1').is_visible()
    station.click()
    assert page.locator('#gridatlas-satnav-confirm').is_visible()
    print('PASS native source station index keeps same-name Iver records separately selectable', flush=True)

    open_card(page)
    page.wait_for_function('''() => {
      const s=window.__GRIDATLAS_PLACE_SEARCH__;
      return s?.last_selection && s.last_results.some(r=>r.repd_ref===s.last_selection.repd_ref);
    }''',timeout=45000)
    planned_record=page.evaluate('''() => {
      const s=window.__GRIDATLAS_PLACE_SEARCH__;
      return s.last_results.find(r=>r.repd_ref===s.last_selection.repd_ref);
    }''')
    page.locator('#gridatlas-satnav-planned').click()
    choose_compass(page,planned_record['name'],[planned_record['longitude'],planned_record['latitude']])
    print('PASS exact native selected project record handoff with source status and coordinates',flush=True)

    open_card(page)
    origin = selected(page, 'origin')
    assert page.locator('#gridatlas-satnav-asset').is_disabled()
    page.locator('#gridatlas-satnav-origin').click()
    choose_compass(page, origin['name'], origin['at'])
    print('PASS existing project Vicinity origin', flush=True)

    open_card(page)
    next_asset = page.get_by_role('button', name='Next vicinity point')
    page.locator('#gridatlas-satnav-close').click()
    next_asset.click()
    first = selected(page, 'asset')
    assert first['at'] != origin['at']
    page.locator('#gridatlas-satnav-toggle').click()
    page.locator('#gridatlas-satnav-asset').click()
    page.locator('#gridatlas-satnav-close').click()
    next_asset.click()
    current = selected(page, 'asset')
    assert current['at'] != first['at']
    page.locator('#gridatlas-satnav-toggle').click()
    page.locator('#gridatlas-satnav-confirm').click()
    assert 'selection changed' in page.locator('#gridatlas-satnav-satnav [role=status]').inner_text()
    assert page.url.startswith(DEMO)
    page.locator('#gridatlas-satnav-asset').click()
    choose_compass(page, current['name'], current['at'])
    print('PASS existing highlighted Vicinity asset and stale selection refusal', flush=True)
    browser.close()
