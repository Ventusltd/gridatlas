"""Exercise the offline plan module and worker in a real browser against a local origin."""
import argparse
import json
import socket
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import copyfile
from tempfile import TemporaryDirectory
from threading import Event, Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CARTRIDGE = "atlas/modules/202611281256-satnav-offline-plan.js"
MODULE = "tools/satnav/field-reliability/offline-plan.mjs"
PINNED = "tools/satnav/vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/vendor/grid-distance-maths/src/geodesy.mjs"
WORKER = "atlas/v/satnav-offline-plan-20261128-worker.js"
CACHE = "ventus-satnav-offline-plans-v1"
VERSIONS = ("satnav-field-test-a", "satnav-field-test-b")
PLAN_A = [[0, 0], [0.001, 0], [0.001, 0.001]]
PLAN_B = [[5, 10], [5, 10.001]]
PRIVATE_FIX = "test-private-measured-fix"

# The fixture supplies only the waypoint map's documented handoff. The installed
# cartridge, module, worker and pinned maths run unmodified inside each browser.
FIXTURE = """<!doctype html><html lang="en"><meta charset="utf-8"><title>Live plan</title>
<section id="satnav-compact"><div id="satnav-field-tools"></div></section>
<script src="/atlas/modules/202611281256-satnav-offline-plan.js"></script>
<script>
  window.pins = [];
  document.getElementById('satnav-compact').satnavSurvey = {
    getPins: () => window.pins,
    getFix: () => { throw new Error('Offline plan must not read measured position'); },
  };
  document.dispatchEvent(new Event('satnav:ready'));
</script></html>"""


@contextmanager
def test_site(geodesy):
    with TemporaryDirectory() as directory:
        root = Path(directory)
        for path in (CARTRIDGE, MODULE, WORKER, PINNED):
            destination = root / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            copyfile(geodesy if path == PINNED else ROOT / path, destination)
        for version in VERSIONS:
            folder = root / "atlas/v" / version
            folder.mkdir()
            (folder / "index.html").write_text(FIXTURE, encoding="utf-8")
        (root / "sample-tile.pbf").write_bytes(b"test basemap tile")
        unavailable = Event()

        class Handler(SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def end_headers(self):
                self.send_header("Cache-Control", "no-store")
                super().end_headers()

            def do_GET(self):
                if unavailable.is_set():
                    self.close_connection = True
                    self.connection.shutdown(socket.SHUT_RDWR)
                    return
                super().do_GET()

        with ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=directory)) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                yield f"http://127.0.0.1:{server.server_port}", unavailable
            finally:
                server.shutdown()
                thread.join()


def scopes_and_keys(page):
    return page.evaluate("""async name => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const items = (await caches.keys()).includes(name) ? await (await caches.open(name)).keys() : [];
      return {
        scopes: registrations.map(r => r.scope).sort(),
        keys: items.map(key => key.url).sort(),
        local: localStorage.length, session: sessionStorage.length,
      };
    }""", CACHE)


def set_pins(page, points):
    page.evaluate("(pins) => window.pins = pins", [
        {"id": str(i), "coordinate": at, "ignoredMetadata": PRIVATE_FIX}
        for i, at in enumerate(points)
    ])


def save(page, pins):
    set_pins(page, pins)
    page.get_by_role("button", name="Save plan", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("Saved. Reopen", timeout=20000)


def expect_plan(page, url, expected):
    response = page.goto(url, wait_until="domcontentloaded", timeout=20000)
    assert response is not None and response.status == 200
    expect(page.get_by_role("heading", name="Saved field plan")).to_be_visible()
    stored = json.loads(page.locator("#saved-plan").text_content())
    assert stored["coordinates"] == expected
    assert set(stored) == {"coordinates", "legs", "totalM", "savedAt"}
    assert PRIVATE_FIX not in page.content()
    expect(page.locator("#pin")).to_have_text(f"Pin 1 of {len(expected)}")
    expect(page.locator("#previous")).to_be_disabled()
    return stored


def exercise(browser, origin, unavailable):
    urls = [f"{origin}/atlas/v/{name}/" for name in VERSIONS]
    keys = [url + "__saved-field-plan__" for url in urls]
    context = browser.new_context(viewport={"width": 390, "height": 664}, has_touch=True)
    try:
        pages = [context.new_page(), context.new_page()]
        for page, url in zip(pages, urls):
            page.goto(url)
            page.get_by_text("Offline plan", exact=True).click()
        assert scopes_and_keys(pages[0]) == {"scopes": [], "keys": [], "local": 0, "session": 0}
        save(pages[0], PLAN_A)
        save(pages[1], PLAN_B)

        # Ordinary basemap fetches, unread GPS and unrelated metadata never enter the cache.
        assert pages[0].evaluate("async () => (await fetch('/sample-tile.pbf')).ok")
        assert scopes_and_keys(pages[0]) == {"scopes": urls, "keys": keys, "local": 0, "session": 0}
        set_pins(pages[0], [[200, 0], [0, 1]])
        pages[0].get_by_role("button", name="Save plan", exact=True).click()
        expect(pages[0].get_by_role("status")).to_contain_text("invalid coordinates")
        assert scopes_and_keys(pages[0])["keys"] == keys

        # Drop all origin connections in both engines. Chromium also supports offline
        # emulation during navigation. The WebKit inspector switch cancels even
        # navigation handled by a worker returning a constant, before fetch fires.
        unavailable.set()
        if browser.browser_type.name == "chromium":
            context.set_offline(True)
        pages[0].reload(wait_until="domcontentloaded")
        expect(pages[0].get_by_role("heading", name="Saved field plan")).to_be_visible()
        fresh = context.new_page()
        plan = expect_plan(fresh, urls[0] + "index.html?field=1", PLAN_A)
        assert plan["legs"] == [[111, 90], [111, 0]] and plan["totalM"] == 223
        expect(fresh.locator("#coordinate")).to_have_text("0.00000°, 0.00000°")
        expect(fresh.locator("#leg")).to_contain_text("111 m · 90° true")
        fresh.locator("#next").click()
        expect(fresh.locator("#coordinate")).to_have_text("0.00000°, 0.00100°")
        expect(fresh.locator("#leg")).to_contain_text("111 m · 0° true")
        fresh.locator("#next").click()
        expect(fresh.locator("#leg")).to_have_text("Last planned pin")
        expect(fresh.locator("#next")).to_be_disabled()
        fresh.locator("#previous").click()
        expect(fresh.locator("#pin")).to_have_text("Pin 2 of 3")
        second = context.new_page()
        expect_plan(second, urls[1], PLAN_B)
        second.locator("#forget").click()
        expect(second.get_by_text("Saved plan removed from this device.")).to_be_visible()
        assert scopes_and_keys(second)["keys"] == [keys[0]]
        empty = second.goto(urls[1], wait_until="domcontentloaded")
        assert empty is not None and empty.status == 503
        expect(second.locator("body")).to_contain_text("no saved field plan")
        expect_plan(fresh, urls[0], PLAN_A)

        # When the connection returns, the live page wins even with a saved copy.
        if browser.browser_type.name == "chromium":
            context.set_offline(False)
        unavailable.clear()
        fresh.reload()
        expect(fresh).to_have_title("Live plan")
        fresh.get_by_text("Offline plan", exact=True).click()
        fresh.get_by_role("button", name="Forget saved plan").click()
        expect(fresh.get_by_role("status")).to_contain_text("removed")
        assert scopes_and_keys(fresh)["keys"] == []
    finally:
        unavailable.clear()
        context.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", choices=("chromium", "webkit"))
    parser.add_argument("--executable", help="Optional path to a local browser binary")
    parser.add_argument("--geodesy", type=Path, default=ROOT / PINNED,
                        help="Canonical geodesy.mjs from the pinned SatNav release")
    args = parser.parse_args()
    if not args.geodesy.is_file():
        parser.error("Pass --geodesy with the pinned SatNav geodesy.mjs or run from the integrated waypoint checkout")
    with test_site(args.geodesy) as (origin, unavailable), sync_playwright() as playwright:
        options = {"executable_path": args.executable} if args.executable else {}
        browser = getattr(playwright, args.browser).launch(**options)
        try:
            exercise(browser, origin, unavailable)
            print(f"{args.browser}: explicit save, offline reload/new tab, bearings, isolation, invalid edits and forget passed")
        finally:
            browser.close()
