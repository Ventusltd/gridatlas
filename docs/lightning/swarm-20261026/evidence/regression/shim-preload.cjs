/**
 * shim-preload.cjs — run an UNMODIFIED tools/proofs/*.browser.mjs under the lead's
 * offline shim, without editing the proof.
 *
 *   NODE_OPTIONS="--require <this file>" node tools/proofs/all-controls.browser.mjs --url http://127.0.0.1:8107/gridatlas/atlas/
 *
 * How: the proofs import { chromium } from 'playwright' (the clone's node_modules
 * symlink to the global 1.63 package) or require('playwright') through
 * createRequire. Both resolve to the same CommonJS module instance, and `chromium`
 * is one BrowserType object shared by every importer. This preload patches that
 * object's launch(): every Browser it returns gets newContext()/newPage() wrapped
 * so that each BrowserContext receives
 *   1. the lead's installOfflineShim(context, { lightningDataDir })  — jsdelivr
 *      MapLibre + DuckDB, data-gridatlas partitions, a background-only carto style,
 *      the lightning feed from a local directory; everything else off-origin aborted
 *   2. optionally (GRIDATLAS_SHIM_RAW_PASSTHROUGH=1, default on) a pass-through for
 *      raw.githubusercontent.com/Ventusltd/<not lightning>/... — the pinned
 *      data-grid-gb / data-gb-electricity products the cards read; that host is
 *      reachable from this sandbox, so the request goes to the real file
 *   3. optional extra denials for failure-mode tests: GRIDATLAS_SHIM_DENY=host1,host2
 * and a summary of what the shim served/aborted/missed is appended to
 * $GRIDATLAS_SHIM_LOG (one JSON line per context) when that variable is set.
 *
 * Environment knobs (all optional):
 *   GRIDATLAS_SHIM_MODULE          path of offline-shim.mjs (default: the lead's)
 *   GRIDATLAS_LIGHTNING_DATA_DIR   directory answering raw.githubusercontent.com/Ventusltd/lightning/<ref>/data/*
 *   GRIDATLAS_SHIM_RAW_PASSTHROUGH '0' to keep the shim's abort for other raw.githubusercontent.com products
 *   GRIDATLAS_SHIM_DENY            comma list of hosts to abort even if the shim would answer them
 *   GRIDATLAS_SHIM_LOG             file to append per-context shim summaries to
 *   GRIDATLAS_SHIM_VERBOSE         '1' prints what was patched
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SHIM = process.env.GRIDATLAS_SHIM_MODULE || '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const LIGHTNING_DIR = process.env.GRIDATLAS_LIGHTNING_DATA_DIR || undefined;
const RAW_PASSTHROUGH = (process.env.GRIDATLAS_SHIM_RAW_PASSTHROUGH || '1') !== '0';
const DENY = (process.env.GRIDATLAS_SHIM_DENY || '').split(',').map(s => s.trim()).filter(Boolean);
const LOG = process.env.GRIDATLAS_SHIM_LOG || '';
const VERBOSE = process.env.GRIDATLAS_SHIM_VERBOSE === '1';

let playwright;
try { playwright = require('/home/claude/gridatlas/node_modules/playwright'); }
catch { try { playwright = require('playwright'); } catch (e) { console.error('[shim-preload] cannot load playwright:', e.message); } }
if (!playwright) return;

const shimPromise = import(pathToFileURL(SHIM).href);
const contexts = [];

async function instrument(context, origin) {
  const { installOfflineShim } = await shimPromise;
  const shim = await installOfflineShim(context, { lightningDataDir: LIGHTNING_DIR });
  // Routes added later run first, so these take precedence over the shim's catch-all.
  if (RAW_PASSTHROUGH) {
    await context.route(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/(?!lightning\/)/, route => route.continue());
  }
  for (const host of DENY) {
    await context.route(url => url.hostname === host || url.hostname.endsWith('.' + host), route => route.abort('blockedbyclient'));
  }
  const rec = { origin, startedAt: new Date().toISOString(), shim, lightningDir: LIGHTNING_DIR || '(lead default /home/claude/lightning/data)', rawPassthrough: RAW_PASSTHROUGH, deny: DENY };
  contexts.push(rec);
  context.once('close', () => flush(rec));
  if (VERBOSE) console.error(`[shim-preload] shim installed on context (${origin}); raw passthrough=${RAW_PASSTHROUGH} deny=${DENY.join(',') || '-'}`);
}

function flush(rec) {
  if (!LOG || rec.flushed) return;
  rec.flushed = true;
  try { fs.appendFileSync(LOG, JSON.stringify({ origin: rec.origin, startedAt: rec.startedAt, endedAt: new Date().toISOString(), lightningDir: rec.lightningDir, rawPassthrough: rec.rawPassthrough, deny: rec.deny, ...rec.shim.summary() }) + '\n'); } catch { }
}
process.on('exit', () => { for (const rec of contexts) flush(rec); });

function patchBrowserType(bt, name) {
  if (!bt || typeof bt.launch !== 'function' || bt.__gridatlasShimPatched) return;
  const launch = bt.launch.bind(bt);
  bt.launch = async function (...args) {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async function (...cargs) {
      const context = await newContext(...cargs);
      if (!context.__gridatlasShimDone) { context.__gridatlasShimDone = true; await instrument(context, `${name}.newContext`); }
      return context;
    };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async function (...pargs) {
      const page = await newPage(...pargs);
      const context = page.context();
      if (!context.__gridatlasShimDone) { context.__gridatlasShimDone = true; await instrument(context, `${name}.newPage`); }
      return page;
    };
    return browser;
  };
  bt.__gridatlasShimPatched = true;
  if (VERBOSE) console.error(`[shim-preload] patched ${name}.launch`);
}
for (const name of ['chromium', 'webkit', 'firefox']) patchBrowserType(playwright[name], name);
