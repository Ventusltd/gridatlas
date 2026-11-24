import json
import math
import os
from urllib.parse import parse_qs, urlencode, urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright

BASE = f"http://127.0.0.1:{os.environ.get('SATNAV_PORT', '8768')}/"
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
POSTCODE = 'SW1A 2AA'
POSTCODE_ENDPOINT = 'https://api.postcodes.io/postcodes/SW1A2AA'
POSTCODE_POINT = [-0.12767, 51.503541]
PANEL = '#gridatlas-satnav-satnav'
TOGGLE = '#gridatlas-satnav-toggle'
CONFIRM = '#gridatlas-satnav-confirm'
VICINITY = '#gridatlas-satnav-vicinity'
PICK = '#gridatlas-satnav-pick'
USE_SEARCH_RESULT = '#gridatlas-satnav-planned'


def load_map(page, url):
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#gridatlas-satnav-pick:not(:disabled)')", timeout=45000)


def click_launcher(page):
    hit = page.locator(TOGGLE).evaluate('''async button => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.__satnavTapEvents = [];
        const types = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart',
            'touchend', 'touchcancel', 'click', 'fullscreenchange'];
        window.__satnavTapTrace?.abort();
        window.__satnavTapTrace = new AbortController();
        const record = event => {
            const point = event.changedTouches?.[0] || event;
            window.__satnavTapEvents.push({
                type: event.type, target: event.target.id || event.target.tagName,
                x: point.clientX, y: point.clientY,
                launcherTop: button.getBoundingClientRect().top,
                expanded: button.getAttribute('aria-expanded'),
            });
        };
        for (const type of types) {
            window.addEventListener(type, record, {capture: true, signal: window.__satnavTapTrace.signal});
        }
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const target = document.elementFromPoint(x, y);
        return {
            x, y, width: rect.width, height: rect.height,
            inViewport: rect.left >= 0 && rect.top >= 0 &&
                rect.right <= innerWidth && rect.bottom <= innerHeight,
            reachable: button.contains(target),
            coveredBy: target && (target.id || target.className || target.tagName),
            viewport: {
                width: innerWidth, height: innerHeight, scale: visualViewport.scale,
                offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
                fullscreen: Boolean(document.fullscreenElement),
            },
        };
    }''')
    assert hit['width'] >= 44 and hit['height'] >= 44, hit
    assert hit['inViewport'] and hit['reachable'], hit
    scroll = page.evaluate('[scrollX, scrollY]')
    if page.evaluate("navigator.maxTouchPoints > 0"):
        page.touchscreen.tap(hit['x'], hit['y'])
    else:
        page.mouse.click(hit['x'], hit['y'])
    assert page.evaluate('[scrollX, scrollY]') == scroll
    return hit


def open_satnav(page):
    hit = click_launcher(page)
    try:
        page.locator(PANEL).wait_for(state='visible', timeout=5000)
    except PlaywrightTimeoutError:
        print(json.dumps({
            'missedLauncherTap': hit,
            'events': page.evaluate('window.__satnavTapEvents'),
            'expanded': page.locator(TOGGLE).get_attribute('aria-expanded'),
        }), flush=True)
        page.screenshot(path='launcher-missed.png')
        raise


def check_launcher_during_search_reflow(page):
    top = page.locator(TOGGLE).evaluate('button => button.getBoundingClientRect().top')
    wrapper = page.locator('.search-bar-wrapper')
    old_top = wrapper.evaluate('element => element.style.top')
    try:
        # Exercise the two native search positions observed during mobile boot.
        for search_top in ['164px', '72px']:
            wrapper.evaluate('(element, top) => { element.style.top = top; }', search_top)
            page.wait_for_timeout(350)
            assert page.locator(TOGGLE).evaluate('button => button.getBoundingClientRect().top') == top
    finally:
        wrapper.evaluate('(element, top) => { element.style.top = top; }', old_top)


def ready(page, url):
    load_map(page, url)
    open_satnav(page)


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


def open_native_card(page):
    load_map(page, CARD)
    page.locator('#gridatlas-pipeline-vicinity-button').click(timeout=45000)
    page.wait_for_function('''() => {
        const card = window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp;
        return card?.__vicFocus?.origin === true && card.swipe?.entries?.length >= 2;
    }''', timeout=45000)


def open_card(page):
    open_native_card(page)
    open_satnav(page)


def click_uncovered_map(page):
    point = page.evaluate('''() => {
        const canvas = window.__GRIDATLAS_V9_MAP__.getCanvas();
        const rect = canvas.getBoundingClientRect();
        for (const [fx, fy] of [[.55, .40], [.60, .55], [.46, .68]]) {
            const x = rect.left + fx * rect.width;
            const y = rect.top + fy * rect.height;
            if (document.elementFromPoint(x, y) === canvas) return [x, y];
        }
        return null;
    }''')
    assert point is not None, 'Expected a genuinely uncovered canvas point'
    page.mouse.click(*point)


def pick_search_result(page, query, result_selector):
    search = page.locator('#search-input')
    search.fill(query)
    search.press('Enter')
    page.locator(result_selector).click(timeout=45000)


def stale_project_refused(page, action):
    ready(page, DEMO)
    map_search = page.locator('#gridatlas-satnav-map-search')
    map_search.click()
    pick_search_result(page, '12588', '#search-results [data-repd-ref="12588"]')
    open_satnav(page)
    page.locator(USE_SEARCH_RESULT).click()
    assert page.locator(CONFIRM).is_visible()

    map_search.click()
    pick_search_result(page, '10603', '#search-results [data-repd-ref="10603"]')
    open_satnav(page)
    url = page.url
    page.locator(action).click()
    assert 'selection changed' in page.locator(PANEL + ' [role=status]').inner_text()
    assert page.url == url
    assert not page.evaluate("Boolean(window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp?.project)")
    assert page.locator(CONFIRM).is_hidden()
    assert page.locator(VICINITY).is_hidden()


def postcode_handoff(page, use_live_provider):
    if not use_live_provider:
        page.route(POSTCODE_ENDPOINT, lambda route: route.fulfill(
            headers={'Access-Control-Allow-Origin': '*'},
            json={'status': 200, 'result': {
                'postcode': POSTCODE, 'longitude': POSTCODE_POINT[0], 'latitude': POSTCODE_POINT[1],
                'admin_district': 'Westminster', 'region': 'London',
            }},
        ))
    ready(page, DEMO)
    page.locator('#gridatlas-satnav-map-search').click()
    assert page.locator(PANEL).is_hidden()
    assert page.locator('#search-input').evaluate('(input) => document.activeElement === input')
    pick_search_result(page, POSTCODE, '#search-results [data-location-kind="postcode"]')
    location = page.evaluate('window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection')
    assert location['label'] == POSTCODE and location['mapped'] is True, location
    point = [location['longitude'], location['latitude']]
    if not use_live_provider:
        assert point == POSTCODE_POINT
    open_satnav(page)
    page.locator(USE_SEARCH_RESULT).click()
    choose_compass(page, POSTCODE, point)
    source = 'live Postcodes.io' if use_live_provider else 'deterministic Postcodes.io response'
    print(f'PASS postcode handoff through GridAtlas search ({source})', flush=True)


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
    for width, height, is_mobile, card_open in [
        (1440, 900, False, False),
        (390, 844, True, True),
        (844, 390, True, False),
        (320, 568, True, False),
    ]:
        hit_page = browser.new_page(
            viewport={'width': width, 'height': height}, is_mobile=is_mobile, has_touch=is_mobile,
        )
        if card_open:
            open_native_card(hit_page)
        else:
            load_map(hit_page, DEMO)
        if width == 320:
            check_launcher_during_search_reflow(hit_page)
            print('PASS narrow launcher position stays stable as native search reflows', flush=True)
        open_satnav(hit_page)
        print(f'PASS launcher screen hit {width}x{height}, vicinity card open={card_open}', flush=True)
        hit_page.close()

    context = browser.new_context(viewport={'width': 1024, 'height': 740})
    context.add_init_script(MOCK_GPS)
    page = context.new_page()

    ready(page, DEMO)
    for use_close_button in [True, False]:
        page.locator(PICK).click()
        assert page.locator(PICK).get_attribute('aria-pressed') == 'true'
        if use_close_button:
            page.locator('#gridatlas-satnav-close').click()
        else:
            click_launcher(page)
        page.locator(PANEL).wait_for(state='hidden', timeout=5000)
        assert page.locator(PICK).get_attribute('aria-pressed') == 'false'
        click_uncovered_map(page)
        open_satnav(page)
        assert page.locator(CONFIRM).is_hidden()
        assert page.locator(VICINITY).is_hidden()
    print('PASS both panel close actions disarm map selection and prevent hidden staging', flush=True)

    ready(page, DEMO)
    page.locator('#gridatlas-satnav-map-search').click()
    pick_search_result(page, '10603', '#search-results [data-repd-ref="10603"]')
    unmapped = page.evaluate('window.__GRIDATLAS_PLACE_SEARCH__.last_selection')
    assert str(unmapped['repd_ref']) == '10603' and unmapped['mapped'] is False, unmapped
    open_satnav(page)
    page.locator(USE_SEARCH_RESULT).click()
    assert 'has no mapped location' in page.locator(PANEL + ' [role=status]').inner_text()
    assert page.locator(CONFIRM).is_hidden()
    assert page.locator(VICINITY).is_hidden()
    assert page.locator(PICK).is_enabled()
    assert page.url.startswith(DEMO)
    print('PASS genuine unmapped REPD 10603 refused for SatNav and Vicinity with pin fallback', flush=True)

    stale_project_refused(page, CONFIRM)
    stale_project_refused(page, VICINITY)
    print('PASS both confirmations refuse stale mapped project after selection changes to unmapped 10603', flush=True)

    postcode_page = context.new_page()
    postcode_handoff(postcode_page, use_live_provider=False)
    postcode_page.close()
    if os.environ.get('SATNAV_LIVE_POSTCODE') == '1':
        postcode_page = context.new_page()
        postcode_handoff(postcode_page, use_live_provider=True)
        postcode_page.close()

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
    pin_name = 'Future substation field point'
    page.locator('#gridatlas-satnav-pin-label input').fill(pin_name)
    page.screenshot(path='satellite-selection.png')
    assert 200 in tile_responses
    print(json.dumps({'satelliteTileResponses': tile_responses, 'nativeLayerVisible': True}), flush=True)
    choose_compass(page, pin_name, expected)
    print('PASS native satellite click, cancel, named pin, signed compass handoff and GPS opt-in', flush=True)

    ready(page, DEMO)
    page.locator('#gridatlas-satnav-manual-details summary').click()
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
    page.locator('#gridatlas-satnav-manual-details summary').click()
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

    for source_id, point in [
        ('grid_substations:212', [-0.4978855, 51.5434023]),
        ('grid_substations:213', [-0.4973463, 51.5416778]),
    ]:
        ready(page, DEMO)
        page.locator('#gridatlas-satnav-station-details summary').click()
        page.get_by_label('Existing substation name or source ID').fill('Iver')
        page.locator('#gridatlas-satnav-search').click()
        page.get_by_role('button', name=f'Iver Substation · {source_id}', exact=False).click(timeout=30000)
        choose_compass(page, 'Iver Substation', point)
    print('PASS same-name Iver substations open the compass at their distinct mapped points', flush=True)

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
    open_satnav(page)
    page.locator('#gridatlas-satnav-asset').click()
    page.locator('#gridatlas-satnav-close').click()
    next_asset.click()
    current = selected(page, 'asset')
    assert current['at'] != first['at']
    open_satnav(page)
    page.locator('#gridatlas-satnav-confirm').click()
    assert 'selection changed' in page.locator('#gridatlas-satnav-satnav [role=status]').inner_text()
    assert page.url.startswith(DEMO)
    page.locator('#gridatlas-satnav-asset').click()
    choose_compass(page, current['name'], current['at'])
    print('PASS existing highlighted Vicinity asset and stale selection refusal', flush=True)
    browser.close()
