import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.route('https://probe.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
await p.clock.setFixedTime(new Date('2026-10-26T13:30:00Z'));
await p.goto('https://probe.test/host.html');
console.log(await p.evaluate(() => ({ secure: isSecureContext, subtle: !!(window.crypto && crypto.subtle), now: new Date().toISOString(), ua: navigator.userAgent })));
console.log('chromium', b.version());
await b.close();
