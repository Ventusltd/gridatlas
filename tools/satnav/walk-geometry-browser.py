"""Check saved geometry and live arrival on a composed Start walk map with synthetic GPS."""

import argparse
import math
import re
from pathlib import Path
from runpy import run_path

from playwright.sync_api import expect, sync_playwright


GPS_SPY = run_path(str(Path(__file__).with_name('compact-browser.py')))['GPS_SPY']
PANEL = '#satnav-compact'
METRE_DEGREES = math.degrees(1 / 6_378_137)


def point(east, north):
    # Engineering offsets from the synthetic site used in the map's waypoint tests.
    return [-1.5 + east * METRE_DEGREES / math.cos(math.radians(51.5)),
            51.5 + north * METRE_DEGREES]


def pins(page):
    return page.locator(PANEL).evaluate('panel => panel.satnavSurvey.getPins()')


def plan(page, coordinates):
    page.locator(PANEL).evaluate('(panel, at) => panel.satnavSurvey.replacePlan(at)', coordinates)
    selected = pins(page)
    assert [pin['coordinate'] for pin in selected] == coordinates
    return selected


def fix(page, at, accuracy):
    # A repaint or duplicate timestamp must not count as a second measured fix.
    page.evaluate('''([at, accuracy]) => new Promise(resolve => requestAnimationFrame(() => {
        window.__lineGpsTest.emit(at, accuracy); resolve();
    }))''', [at, accuracy])


def check(page, url):
    page.goto(url, wait_until='domcontentloaded')
    expect(page.locator('#satnav-from')).to_be_enabled(timeout=75_000)
    start = page.locator('#satnav-walk-start')
    stop = page.locator('#satnav-walk-stop')
    guidance = page.locator('#satnav-walk-guidance')
    status = page.locator('#satnav-status')
    expect(start).to_be_visible(timeout=30_000)
    expect(page.locator('#satnav-walk-mode')).to_have_value('direct')

    origin = point(0, 0)
    selected = plan(page, [origin, point(0, 63)])
    start.tap()
    # At 10 m, ±6 m cannot confirm arrival inside 15 m. A fresh ±4 m fix can.
    for north, accuracy, expected in [(0, 4, 63), (28, 4, 35), (14, 4, 49), (53, 6, 10)]:
        fix(page, point(0, north), accuracy)
        expect(guidance).to_have_text(f'Direct to pin · {expected} m · 0° true')
        expect(status).to_contain_text('2 pins · 63 m planned')
        assert pins(page) == selected
    fix(page, point(0, 53), 4)
    expect(guidance).to_have_text('Direct to pin · Arrived')
    expect(status).to_contain_text('2 pins · 63 m planned')
    assert pins(page) == selected
    stop.tap()

    corner = point(30, 0)
    finish = point(30, 40)
    triangle = plan(page, [origin, corner, finish])
    survey = page.locator('#satnav-survey')
    survey.locator('summary').tap()
    survey.locator('[data-loop]').tap()
    expect(survey.locator('[data-loop]')).to_have_attribute('aria-pressed', 'true')
    perimeter = survey.locator('[data-plan]')
    expect(perimeter).to_contain_text('Planned perimeter 120 m')
    survey.locator('summary').tap()
    start.tap()
    for at, accuracy, distance, heading, remaining in [
        (origin, 4, 30, 90, 120),
        (corner, 4, 40, 0, 90),
        (finish, 4, 50, 217, 50),
        (point(6, 8), 6, 10, 217, 10),
    ]:
        fix(page, at, accuracy)
        expect(guidance).to_contain_text(f'{distance} m · {heading}° true')
        expect(guidance).to_contain_text(f'{remaining} m remaining')
        expect(status).to_contain_text('3 pins · 70 m planned')
        expect(perimeter).to_contain_text('Planned perimeter 120 m')
        assert pins(page) == triangle
    fix(page, origin, 4)
    expect(guidance).to_have_text('Direct to pin · Arrived')
    assert pins(page) == triangle
    stop.tap()
    expect(guidance).to_have_text(re.compile('stopped', re.I))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('browser', choices=['chromium', 'webkit'])
    parser.add_argument('url', help='Served versioned Start walk entry')
    parser.add_argument('--landscape', action='store_true', help='Use the 664 × 390 phone viewport')
    parser.add_argument('--executable', help='Optional installed browser binary')
    args = parser.parse_args()
    with sync_playwright() as playwright:
        options = {'executable_path': args.executable} if args.executable else {}
        if args.browser == 'chromium':
            options['args'] = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        with getattr(playwright, args.browser).launch(**options) as browser:
            width, height = (664, 390) if args.landscape else (390, 664)
            context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
            context.add_init_script(GPS_SPY)
            check(context.new_page(), args.url)
            print(f'{args.browser}: 63 m plan, approach, retreat, accuracy-limited arrival and 120 m loop passed')
