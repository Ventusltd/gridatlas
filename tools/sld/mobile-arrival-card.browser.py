"""Candidate-only real-browser proof; intercepts pointer/hash and one cartridge.

Run with the QA Python environment containing Playwright. This is not public
release acceptance: all other native Atlas assets use their actual URLs.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('MOBILE_CARD_OUTPUT', str(ROOT / 'work/mobile-arrival-card')))


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = (ROOT / 'atlas/cartridges/202611161720-sld-sandbox-v9-8.js').read_text(encoding='utf-8')
    for edit in json.loads((ROOT / 'tools/sld/src/mobile-arrival-card-edits.json').read_text(encoding='utf-8')):
        assert source.count(edit['before']) == 1
        source = source.replace(edit['before'], edit['after'])
    pointer = json.loads((ROOT / 'atlas/current.json').read_text(encoding='utf-8'))
    digest = hashlib.sha256(source.encode()).hexdigest()
    for entry in pointer['cartridges']:
        if entry['id'] == 'sld-sandbox':
            entry['sha256'] = digest
    receipt = {'mode': 'CANDIDATE_INTERCEPTION_NOT_PUBLIC_ACCEPTANCE', 'startedUTC': datetime.now(timezone.utc).isoformat(), 'candidateSha256': digest, 'errors': [], 'requestFailures': [], 'interceptions': []}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
            context = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
            page = await context.new_page()
            page.on('pageerror', lambda e: receipt['errors'].append(str(e)))
            page.on('requestfailed', lambda r: receipt['requestFailures'].append({'url': r.url, 'failure': r.failure}))

            async def candidate(route):
                url = route.request.url
                if url.split('?')[0].endswith('/atlas/current.json'):
                    receipt['interceptions'].append(url)
                    await route.fulfill(body=json.dumps(pointer), content_type='application/json')
                elif url.split('?')[0].endswith('/202611161720-sld-sandbox-v9-8.js'):
                    receipt['interceptions'].append(url)
                    await route.fulfill(body=source, content_type='text/javascript')
                else:
                    await route.continue_()
            await context.route('https://ventusltd.github.io/gridatlas/**', candidate)
            await page.goto('https://ventusltd.github.io/gridatlas/atlas/?repd_ref=2470&technology=wind_offshore&latitude=52.1374391&longitude=2.1708996&zoom=12', wait_until='domcontentloaded', timeout=60000)
            print('receiver loaded', flush=True)
            summary = page.locator('.gridatlas-arrival-summary').first
            await summary.wait_for(timeout=120000)
            await page.wait_for_function("() => window.__GRIDATLAS_NEON_LINKS__?.last_selection?.name === 'East Anglia 3 (EA 3)'", timeout=120000)
            selection = await page.evaluate('() => window.__GRIDATLAS_NEON_LINKS__.last_selection')
            assert selection['name'] == 'East Anglia 3 (EA 3)'
            text = await summary.inner_text()
            assert selection['nearest_name'] in text
            assert f"{selection['nearest_km']:.1f} km straight-line" in text
            assert 'Screening only; connection unverified.' in text
            popup = page.locator('.maplibregl-popup').first
            assert 'gridatlas-min' in (await popup.get_attribute('class'))
            details = page.get_by_role('button', name='Show project details', exact=True)
            box = await details.bounding_box()
            assert box['height'] >= 44 and box['width'] >= 44
            rect = await summary.bounding_box()
            assert rect['x'] >= 0 and rect['y'] >= 0 and rect['x'] + rect['width'] <= 391 and rect['y'] + rect['height'] <= 845
            assert await summary.evaluate('(e) => {const r=e.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit)}')
            await page.screenshot(path=str(OUT / 'compact.png'))
            await details.tap()
            await page.locator('.neon-km').first.wait_for(state='visible')
            assert 'gridatlas-min' not in (await popup.get_attribute('class'))
            assert await page.get_by_role('button', name='Minimise project details', exact=True).get_attribute('aria-expanded') == 'true'
            await page.wait_for_timeout(12000)
            assert 'gridatlas-min' not in (await popup.get_attribute('class')), 'identity reconciliation must retain reader restore'
            await page.screenshot(path=str(OUT / 'details.png'))
            await page.get_by_role('button', name='Minimise project details', exact=True).tap()
            assert 'gridatlas-min' in (await popup.get_attribute('class'))
            await page.set_viewport_size({'width': 844, 'height': 390})
            await page.wait_for_timeout(500)
            rect = await summary.bounding_box()
            assert rect['x'] >= 0 and rect['y'] >= 0 and rect['x'] + rect['width'] <= 845 and rect['y'] + rect['height'] <= 391
            assert not await page.evaluate('() => document.documentElement.scrollWidth > innerWidth')
            assert not receipt['errors']
            assert len(receipt['interceptions']) >= 2
            receipt.update({'result': 'PASS', 'renderedSummary': text, 'selection': selection, 'firstDetailsTouch': 'PASS', 'manualRestoreSurvives12Seconds': True, 'rotation': '844x390 bounded', 'physicalHandset': 'UNKNOWN', 'finishedUTC': datetime.now(timezone.utc).isoformat()})
            await browser.close()
    except Exception as e:
        receipt.update({'result': 'FAIL', 'failure': str(e)})
        raise
    finally:
        (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print(json.dumps({k: v for k, v in receipt.items() if k not in ['requestFailures', 'interceptions']}), flush=True)


asyncio.run(main())
