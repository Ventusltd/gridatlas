/**
 * Run the GridAtlas composer (atlas/index.html) in Node, without a browser,
 * and return exactly what it would hand to document.write: the composed HTML
 * and, in document order, the source of every script tag it points at a
 * verified cartridge blob.
 *
 *   import { compose } from './loader-composition.mjs';
 *   const out = await compose({ loaderHtml, route: 'atlas/v/<gen>/' });
 *
 * The loader's own module script is executed verbatim in a vm context. Only
 * the platform is stubbed: fetch reads the repository working tree (the bytes
 * GitHub Pages serves for this tree), crypto.subtle is Node's WebCrypto, and
 * URL.createObjectURL returns deterministic blob:gridatlas/<n> URLs so two
 * runs, or two loaders, can be compared byte for byte.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGIN = 'https://ventusltd.github.io';
const SITE = '/gridatlas/';

function response(file, virtual) {
  if (virtual) file = null;
  const bytes = virtual ? Buffer.from(virtual) : null;
  if (!bytes && (!file || !fs.existsSync(file) || !fs.statSync(file).isFile())) {
    return { ok: false, status: 404, async json() { throw new Error('404'); }, async text() { return ''; }, async arrayBuffer() { return new ArrayBuffer(0); } };
  }
  const body = bytes || fs.readFileSync(file);
  return {
    ok: true, status: 200,
    async json() { return JSON.parse(body.toString('utf8')); },
    async text() { return body.toString('utf8'); },
    async arrayBuffer() { return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength); }
  };
}

export function loaderScript(loaderHtml) {
  const m = String(loaderHtml).match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('loader has no module script');
  return m[1];
}

/** route: the served directory of the pointer, 'atlas/' (live) or 'atlas/v/<gen>/'.
    files: optional virtual files, { 'atlas/v/x/current.json': text }, served in
    place of (or in addition to) the working tree; nothing is written to disk. */
export async function compose({ loaderHtml, route = 'atlas/', files = {} }) {
  const href = `${ORIGIN}${SITE}${route}`;
  const blobs = new Map();
  let serial = 0;
  class StubURL extends URL {}
  StubURL.createObjectURL = (blob) => {
    const url = `blob:gridatlas/${++serial}`;
    blobs.set(url, blob);
    return url;
  };
  const written = [];
  const loader = { innerHTML: '' };
  const errors = [];
  const document = {
    getElementById: (id) => (id === 'gridatlas-loader' ? loader : null),
    body: { dataset: {} },
    open() {}, write(s) { written.push(s); }, close() {}
  };
  const fetch = async (input) => {
    const u = new URL(String(input), href);
    if (u.origin !== ORIGIN || !u.pathname.startsWith(SITE)) return response(null);
    const rel = decodeURIComponent(u.pathname.slice(SITE.length));
    return response(path.join(ROOT, rel), Object.hasOwn(files, rel) ? files[rel] : null);
  };
  const context = vm.createContext({
    window: { location: { href } }, document, fetch, URL: StubURL, Blob, crypto: webcrypto,
    console: { error: (...a) => errors.push(a.map(String).join(' ')), log() {} }
  });
  await vm.runInContext(`(async () => {${loaderScript(loaderHtml)}\n})()`, context);
  const html = written.join('');
  const scripts = [];
  for (const m of html.matchAll(/<script data-gridatlas-cartridge="([^"]+)" src="(blob:gridatlas\/\d+)"><\/script>/g)) {
    scripts.push({ id: m[1], url: m[2], source: Buffer.from(await blobs.get(m[2]).arrayBuffer()) });
  }
  return { html, scripts, failed: document.body.dataset.gridatlasRouter === 'failed', message: loader.innerHTML, errors };
}
