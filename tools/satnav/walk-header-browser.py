"""Check the walking controls on a narrow phone as the real header and viewport resize."""

import argparse
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


waypoints = run_path(str(Path(__file__).with_name('waypoint-browser.py')))
MAP = 'window.__GRIDATLAS_V9_MAP__'
BAR = '#gridatlas-menu-bar'
GAP = """() => {
  const header = document.querySelector('#gridatlas-menu-bar');
  const from = document.querySelector('#satnav-from');
  if (!header || !from) return -Infinity;
  return from.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
}"""
HIT = """el => {
  const box = el.getBoundingClientRect();
  return el.contains(document.elementFromPoint(box.x + box.width/2, box.y + box.height/2));
}"""


def check_header(page, action):
    page.wait_for_function(f'() => ({GAP})() >= 7.5', timeout=15000)
    gap = page.evaluate(GAP)
    brand = page.locator(BAR + ' .gm-brand-slot .ventus-main')
    expect(brand).to_be_visible()
    assert brand.evaluate("""el => {
      const text = document.createRange();
      text.selectNodeContents(el);
      const r = text.getBoundingClientRect(), y = r.top + r.height / 2;
      return r.width > 2 && [r.left + 1, r.left + r.width / 2, r.right - 1].every(
        x => el.contains(document.elementFromPoint(x, y)));
    }"""), 'Letterhead text is clipped or covered'
    assert action.evaluate(HIT), f'{action.inner_text()} is covered'

    menus = page.locator(BAR + ' .gm-title:visible').all()
    assert menus, 'No menu titles on screen'
    for title in menus:
        assert title.evaluate(HIT), f'{title.inner_text()} is covered'
    menu = menus[0]
    menu.tap()
    expect(menu).to_have_attribute('aria-expanded', 'true')
    option = page.locator(BAR + ' .gm-open .gm-panel :is(button,a,input,[role=button]):visible').first
    expect(option).to_be_visible()
    assert option.evaluate(HIT), 'Walking controls intercept the open menu'
    menu.tap()
    expect(menu).to_have_attribute('aria-expanded', 'false')
    return gap


def check_layers(page):
    toggle = page.locator('#gridatlas-dash-toggle')
    panel = page.locator('#fs-curtain')
    checkbox = panel.locator('input[data-layer-id="400"]')
    toggle.tap()
    expect(panel).to_be_visible()
    before = checkbox.is_checked()
    checkbox.tap()
    visibility = 'none' if before else 'visible'
    page.wait_for_function(f"v => {MAP}.getLayoutProperty('l-400', 'visibility') === v", arg=visibility)
    toggle.tap()
    expect(panel).to_be_hidden()
    toggle.tap()
    expect(panel).to_be_visible()
    assert checkbox.is_checked() != before
    checkbox.tap()
    page.wait_for_function(f"v => {MAP}.getLayoutProperty('l-400', 'visibility') === v",
                           arg='visible' if before else 'none')
    toggle.tap()
    expect(panel).to_be_hidden()
    expect(page.get_by_role('button', name='Stop walk', exact=True)).to_be_visible()


def check(browser, url, width, height, prepare=None):
    with browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True) as context:
        context.add_init_script(waypoints['GPS_SPY'])
        if prepare:
            prepare(context)
        page = context.new_page()
        page.goto(url, wait_until='domcontentloaded')
        page.wait_for_function(f"{MAP}?.getLayer('l-sat')", timeout=30000)
        start = page.get_by_role('button', name='Start walk', exact=True)
        stop = page.get_by_role('button', name='Stop walk', exact=True)
        expect(start).to_be_visible(timeout=15000)
        gaps = [check_header(page, start)]
        page.evaluate(f"() => {{ {MAP}.jumpTo({{center:[-1.5,51.5],zoom:17}}); }}")
        target = waypoints['place'](page, 'to', 23)
        start.tap()
        waypoints['emit_fix'](page, [target[0], target[1] - .00057], accuracy=4)
        expect(page.locator('#satnav-walk-guidance')).to_contain_text('Direct to pin')
        check_layers(page)

        # The same running walk must tolerate both rotation and a taller letterhead.
        page.set_viewport_size({'width': height, 'height': width})
        gaps.append(check_header(page, stop))
        check_layers(page)
        header = page.locator(BAR)
        header_height = header.bounding_box()['height']
        original = header.evaluate('el => el.style.height')
        header.evaluate("(el, h) => el.style.height = h + 'px'", header_height + 20)
        page.wait_for_function('(h) => document.querySelector("#gridatlas-menu-bar").getBoundingClientRect().height >= h',
                               arg=header_height + 19)
        gaps.append(check_header(page, stop))
        header.evaluate('(el, height) => el.style.height = height', original)
        page.set_viewport_size({'width': width, 'height': height})
        gaps.append(check_header(page, stop))
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': []}
        stop.tap()
        expect(start).to_be_visible()
        assert page.evaluate('window.__lineGpsTest.records') == {'starts': [1], 'stops': [1]}
        return gaps


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('browser', choices=['chromium', 'webkit'])
    parser.add_argument('url')
    parser.add_argument('--executable')
    args = parser.parse_args()
    with sync_playwright() as playwright:
        options = {'executable_path': args.executable} if args.executable else {}
        if args.browser == 'chromium':
            options['args'] = ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
                               '--enable-unsafe-swiftshader']
        browser = getattr(playwright, args.browser).launch(**options)
        try:
            for width, height in [(320, 568), (390, 664)]:
                print(args.browser, f'{width}x{height}', 'portrait, landscape, taller header, portrait gaps (px)',
                      check(browser, args.url, width, height))
        finally:
            browser.close()
