"""Replay the public walking baseline and a camera-only composition through their normal controls."""

import argparse
import hashlib
import io
import json
import math
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from runpy import run_path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = "/atlas/v/satnav-walk-202611281345/"
PREVIEW = "/atlas/v/satnav-follow-candidate/"
CARTRIDGE = "../../modules/202611281445-satnav-follow-waypoints.js"
HELPERS = run_path(str(ROOT / "tools/satnav/waypoint-browser.py"))
MAP = "window.__GRIDATLAS_V9_MAP__"
ORIGIN = [-1.5, 51.5]
DISTANCE = HELPERS["surface_distance"]


class Preview(SimpleHTTPRequestHandler):
    """Serve the feature on a separate address without changing either production pointer."""

    def log_message(self, *_):
        pass

    def send_head(self):
        path = urlsplit(self.path).path
        if path not in (PREVIEW, PREVIEW + "index.html", PREVIEW + "current.json"):
            return super().send_head()
        baseline = ROOT / BASE.lstrip("/")
        if path.endswith("current.json"):
            manifest = json.loads((baseline / "current.json").read_bytes())
            entry = next(c for c in manifest["cartridges"] if c["id"] == "satnav-waypoint-map")
            entry["path"] = CARTRIDGE
            entry["sha256"] = hashlib.sha256((baseline / CARTRIDGE).read_bytes()).hexdigest()
            manifest.update(generation="202611281445", previous_generation="202611281345")
            data, mime = json.dumps(manifest).encode(), "application/json"
        else:
            data, mime = (baseline / "index.html").read_bytes(), "text/html"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        return io.BytesIO(data)


def route_fixture(route, origin_host):
    url = urlsplit(route.request.url)
    name = Path(url.path).name
    if url.hostname == "cdn.jsdelivr.net" and "/maplibre-gl@3.6.2/dist/" in url.path:
        assets = os.environ.get("MAPLIBRE_DIST")
        if not assets:
            return route.continue_()
        return route.fulfill(path=Path(assets) / name, headers={"Access-Control-Allow-Origin": "*"})
    if name == "style.json":
        return route.fulfill(json={"version": 8, "sources": {}, "layers": [{
            "id": "background", "type": "background", "paint": {"background-color": "#18232b"}
        }]}, headers={"Access-Control-Allow-Origin": "*"})
    if url.scheme in ("data", "blob") or url.hostname == origin_host:
        return route.continue_()
    return route.abort()


def centre(page):
    return page.evaluate(MAP + ".getCenter().toArray()")


def settle(page):
    page.wait_for_function("!" + MAP + ".isMoving()", timeout=12000)


def emit(page, point, accuracy=4, age=0):
    HELPERS["emit_fix"](page, point, accuracy, age)
    HELPERS["measured"](page, None if age else point)
    settle(page)


def move_east(point, metres):
    return [point[0] + metres / (111195 * math.cos(math.radians(point[1]))), point[1]]


def marker_visible(page, point):
    return page.evaluate("""at => {
        const map = window.__GRIDATLAS_V9_MAP__, canvas = map.getCanvas(), r = canvas.getBoundingClientRect();
        const p = map.project(at);
        return document.elementFromPoint(p.x + r.left,p.y + r.top) === canvas;
    }""", point)


def gesture(page, engine, frames):
    kinds = ["Start"] + ["Move"] * (len(frames) - 2) + ["End"]
    if engine == "chromium":
        session = page.context.new_cdp_session(page)
        try:
            for kind, points in zip(kinds, frames):
                session.send("Input.dispatchTouchEvent", {"type": "touch" + kind, "touchPoints": points})
        finally:
            session.detach()
    else:
        # Playwright WebKit has no native gesture stream. Send contact changes
        # to the real map handlers, then verify their pan and zoom results.
        for kind, points in zip(kinds, frames):
            page.evaluate("""([type,points]) => {
                const target=window.__GRIDATLAS_V9_MAP__.getCanvas();
                const touches=points.map(p=>({identifier:p.id,clientX:p.x,clientY:p.y,target}));
                const event=new Event(type,{bubbles:true,cancelable:true});
                for (const key of ['touches','targetTouches','changedTouches']) Object.defineProperty(event,key,{value:touches});
                target.dispatchEvent(event);
            }""", ["touch" + kind.lower(), points])
            page.wait_for_timeout(30)
    settle(page)


def pinch(page, engine):
    pixel = HELPERS["clear_map_pixel"](page, 14)
    x, y = pixel["x"], pixel["y"]
    frames = [[{"x": x - n, "y": y, "id": 1}, {"x": x + n, "y": y, "id": 2}] for n in (8, 13, 18, 24)]
    gesture(page, engine, frames + [[]])


def check(browser, engine, url, size, baseline=False):
    reduced = size[0] > size[1]
    with browser.new_context(viewport={"width": size[0], "height": size[1]}, is_mobile=True, has_touch=True,
                             reduced_motion="reduce" if reduced else "no-preference") as context:
        context.add_init_script(HELPERS["GPS_SPY"])
        context.route("**/*", partial(route_fixture, origin_host=urlsplit(url).hostname))
        page = context.new_page()
        page.goto(url, wait_until="commit")
        page.wait_for_function("""() => document.querySelector('#satnav-compact')?.satnavSurvey?.getMap()?.getLayer('l-sat')
            && document.querySelector('#satnav-walk-start')""", timeout=60000)
        page.evaluate(MAP + ".jumpTo({center:[-1.5,51.5],zoom:16}); void 0")
        HELPERS["place"](page, "to", 14)
        location = page.locator("#satnav-location")
        start = page.locator("#satnav-walk-start")
        if not reduced or baseline:
            location.tap()
            emit(page, ORIGIN)
            expect(location).to_have_text("Centre GPS")
        if baseline:
            start.tap()
            original = centre(page)
            emit(page, move_east(ORIGIN, 30))
            drift = DISTANCE(original, centre(page))
            assert drift < .05, drift
            print(f"{engine} {size} published baseline: 30 m simulated movement, {drift:.3f} m camera movement.", flush=True)
            return
        page.evaluate("""() => {
            const map=window.__GRIDATLAS_V9_MAP__;
            window.followDurations=[];
            const ease=map.easeTo.bind(map);
            map.easeTo=(options,event)=>{if(event?.satnavFollow)window.followDurations.push(options.duration);return ease(options,event);};
        }""")
        if reduced:
            page.evaluate(MAP + ".setZoom(14); void 0")
        expected_zoom = page.evaluate(MAP + ".getZoom()")
        start.tap()
        emit(page, ORIGIN)
        expect(location).to_have_text("Follow me")
        expect(location).to_have_attribute("aria-pressed", "true")
        assert abs(page.evaluate(MAP + ".getZoom()") - expected_zoom) < 1e-6
        assert marker_visible(page, ORIGIN)
        target_pixel = page.evaluate("at => {const p=window.__GRIDATLAS_V9_MAP__.project(at);return [p.x,p.y]}", ORIGIN)
        initial = centre(page)
        if not reduced:
            remote = move_east(ORIGIN, 1200)
            # Interrupt one animation with a different trusted fix, then a
            # second animation with a poor fix at the same coordinates.
            page.evaluate("""([remote,home]) => {
                window.__lineGpsTest.emit(remote,4);window.__lineGpsTest.emit(home,4);
            }""", [remote, ORIGIN])
            settle(page)
            assert DISTANCE(initial, centre(page)) < 1
            page.evaluate("at => {window.__lineGpsTest.emit(at,4);window.__lineGpsTest.emit(at,90);}", remote)
            settle(page)
            emit(page, remote)
            assert marker_visible(page, remote) and DISTANCE(initial, centre(page)) > 1100
            emit(page, ORIGIN)
            initial = centre(page)
        for offset in [1, -1.5, 2, -.5]:
            emit(page, move_east(ORIGIN, offset))
        stationary = DISTANCE(initial, centre(page))
        assert stationary < .05, stationary
        for first_edge in range(10, 710, 10):
            step = move_east(ORIGIN, first_edge)
            emit(page, step)
            if DISTANCE(initial, centre(page)) > 2:
                assert marker_visible(page, step)
                break
        else:
            raise AssertionError("Camera stayed still through a 700 m walk")
        assert first_edge > 10
        edge = move_east(ORIGIN, 1200)
        emit(page, edge)
        camera_distance = DISTANCE(initial, centre(page))
        assert abs(camera_distance - 1200) < 3 and marker_visible(page, edge), (camera_distance, size)
        if reduced:
            assert set(page.evaluate("window.followDurations")) == {0}
        if not reduced:
            assert 250 in page.evaluate("window.followDurations")
        assert page.evaluate(MAP + ".getZoom()") == expected_zoom
        guide = page.locator("#satnav-walk-guidance")
        plan = HELPERS["pins"](page, 2)
        pixel = HELPERS["clear_map_pixel"](page, 14)
        before_drag = centre(page)
        frames = [[{"x": pixel["x"] - 9 * n, "y": pixel["y"] - 4 * n, "id": 1}] for n in range(7)]
        gesture(page, engine, frames + [[]])
        expect(location).to_have_attribute("aria-pressed", "false")
        browsed, before = centre(page), guide.inner_text()
        assert DISTANCE(browsed, before_drag) > .5
        next_fix = move_east(edge, 280)
        emit(page, next_fix)
        assert DISTANCE(browsed, centre(page)) < .05 and guide.inner_text() != before
        pinch(page, engine)
        selected_zoom = page.evaluate(MAP + ".getZoom()")
        assert abs(selected_zoom - expected_zoom) > .25, (expected_zoom, selected_zoom)
        expect(location).to_have_attribute("aria-pressed", "false")
        before_resume = centre(page)
        location.tap()
        settle(page)
        expect(location).to_have_attribute("aria-pressed", "true")
        assert marker_visible(page, next_fix)
        resumed_pixel = page.evaluate("at => {const p=window.__GRIDATLAS_V9_MAP__.project(at);return [p.x,p.y]}", next_fix)
        assert DISTANCE(before_resume, centre(page)) > 2 and math.dist(target_pixel, resumed_pixel) < 24
        assert abs(page.evaluate(MAP + ".getZoom()") - selected_zoom) < 1e-6
        # A second pinch while following must keep follow enabled.
        pinch(page, engine)
        expect(location).to_have_attribute("aria-pressed", "true")
        selected_zoom = page.evaluate(MAP + ".getZoom()")
        steady = centre(page)
        distant = move_east(next_fix, 1200)
        emit(page, distant, accuracy=90)
        assert DISTANCE(steady, centre(page)) < .05
        emit(page, distant, age=180000)
        assert DISTANCE(steady, centre(page)) < .05
        emit(page, distant)
        assert marker_visible(page, distant) and abs(page.evaluate(MAP + ".getZoom()") - selected_zoom) < 1e-6
        layers = page.locator("#gridatlas-dash-toggle")
        layers.tap()
        expect(layers).to_have_attribute("aria-expanded", "true")
        layers.tap()
        expect(layers).to_have_attribute("aria-expanded", "false")
        location.tap()
        settle(page)
        assert abs(page.evaluate(MAP + ".getZoom()") - selected_zoom) < 1e-6
        assert HELPERS["pins"](page, 2) == plan
        page.locator("#satnav-walk-stop").tap()
        final = centre(page)
        page.evaluate("at => window.__waypointSample(at,0,1)", ORIGIN)
        HELPERS["measured"](page, None)
        assert DISTANCE(final, centre(page)) < .05
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1], "stops": [1]}
        expect(location).not_to_have_attribute("aria-pressed", "true")
        location.tap()
        start.tap()  # The second watch is still awaiting its first fix.
        emit(page, ORIGIN)
        assert marker_visible(page, ORIGIN)
        page.evaluate("window.dispatchEvent(new Event('pagehide'))")
        page.evaluate("at => window.__waypointSample(at,0,1)", distant)
        HELPERS["measured"](page, None)
        assert page.evaluate("window.__lineGpsTest.records") == {"starts": [1, 2], "stops": [1, 2]}
        print(f"{engine} {size}: scatter {stationary:.3f} m, first recenter by {first_edge} m, "
              f"1,200 m input moved camera {camera_distance:.1f} m. Drag paused, pinch/resume reached zoom "
              f"{selected_zoom:.3f}, Layers reopened, Stop and page exit cleared both watches.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", type=int, metavar="PORT", help="Open the camera-only candidate locally for manual use")
    parser.add_argument("--engine", choices=["chromium", "webkit"], action="append")
    parser.add_argument("--url", help="Test an integrated candidate instead of the camera-only composition")
    args = parser.parse_args()
    handler = partial(Preview, directory=ROOT)
    with ThreadingHTTPServer(("127.0.0.1", args.serve or 0), handler) as server:
        address = f"http://127.0.0.1:{server.server_port}"
        if args.serve:
            print(address + PREVIEW, flush=True)
            server.serve_forever()
            return
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                for name in args.engine or ("chromium", "webkit"):
                    binary = os.environ.get(name.upper() + "_BIN")
                    flags = ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader"] if name == "chromium" else []
                    with getattr(playwright, name).launch(executable_path=binary, args=flags) as browser:
                        print(f"{name} {browser.version}", flush=True)
                        check(browser, name, address + BASE, (390, 664), baseline=True)
                        for size in ((390, 664), (664, 390)):
                            check(browser, name, args.url or address + PREVIEW, size)
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
