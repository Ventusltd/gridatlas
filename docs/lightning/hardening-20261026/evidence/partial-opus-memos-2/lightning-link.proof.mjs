/* lightning-link.proof.mjs -- static proof for the Atlas <-> See Through lightning bridge design (opus-memos-2).
 * Harness: self-fixture (node, no browser, no network). Reads the files it makes claims about; opens no socket;
 * writes nothing. Run: node lightning-link.proof.mjs
 * The browser half (load the candidate route with a lightning fragment and assert inspect() and the plain-visit
 * record are unchanged) is NOT run here: NOT_TESTED. */
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    LIGHTNING_VOCABULARY, LIGHTNING_PERIODS, LIGHTNING_PARAMS, LIGHTNING_RULES, LIGHTNING_RECEIVERS, ARRIVAL_KEYS,
    buildLightningLink, parseLightningLink, derivedStart
} from './lightning-link.v1.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SCR = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad';
const P = {
    engine: '/home/claude/ventusltd/ventus-grid-engine',
    atlasRepo: '/home/claude/gridatlas',
    wt: SCR + '/hardening/wt',
    module: SCR + '/hardening/wt/atlas/modules/202610261949-uk-lightning-overlay.js',
    cand: SCR + '/hardening/wt/atlas/cartridges/202610261949-sld-sandbox-v9-8.js',
    kb: '/home/claude/ventusltd/kuiper-belt',
    st: '/home/claude/ventusltd/kuiper-belt/see-through',
    dp: SCR + '/lightning/evidence/lightning-data-plane-builder/wt'
};
const read = (f) => readFileSync(f, 'utf8');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const head = (repo) => { try { return execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const checks = [];
const check = (id, name, ok, detail = '') => checks.push({ id, name, ok: Boolean(ok), detail });

console.log('PROVENANCE (harness: self-fixture, node ' + process.version + ', static, no network)');
for (const [k, r] of [['ventus-grid-engine', P.engine], ['gridatlas main', P.atlasRepo], ['hardening wt', P.wt], ['kuiper-belt', P.kb], ['lightning data-plane wt', P.dp]])
    console.log('  ' + k.padEnd(24) + head(r));

const contract = await import(pathToFileURL(P.engine + '/deeplink/contract.js').href);
const hw = await import(pathToFileURL(P.dp + '/history-window.mjs').href);
const KEYS = Object.keys(LIGHTNING_PARAMS);
const cur = JSON.parse(read(P.atlasRepo + '/atlas/current.json'));
const A = (p) => path.join(P.atlasRepo, 'atlas', p);
const live = cur.cartridges.map((c) => A(c.path)).concat([A(cur.shell.index), A('index.html')]);
for (const f of live.concat([P.module, P.st + '/index.html', P.st + '/202610050609/descent.js'])) console.log('  sha256/16 ' + sha(f) + '  ' + f.replace(SCR, '<scratch>'));

/* A. Vocabulary sits beside the project contract, never inside it */
check('A1', 'lightning keys are disjoint from contract.js PARAMS, which still has its 5 keys',
    KEYS.every((k) => !(k in contract.PARAMS)) && Object.keys(contract.PARAMS).length === 5, Object.keys(contract.PARAMS).join(','));
const proj = contract.buildDeepLink({ repd_ref: '13599', technology: 'solar', latitude: 53.1, longitude: -0.2, zoom: 12 });
check('A2', 'a project link built by the contract carries no lightning key and no fragment',
    ![...new URL(proj).searchParams.keys()].some((k) => k.startsWith('lightning')) && new URL(proj).hash === '', proj);
check('A3', 'one namespace: every key starts with "lightning"', KEYS.every((k) => k.startsWith('lightning')), KEYS.join(','));
check('A4', 'the period list is exactly history-window.mjs PERIODS',
    JSON.stringify([...LIGHTNING_PERIODS].sort()) === JSON.stringify(Object.keys(hw.PERIODS).sort()));
const liveKeys = new Set();
for (const f of live) for (const m of read(f).matchAll(/\.get\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)) liveKeys.add(m[1]);
check('A5', 'no lightning key is read by any live Atlas script', KEYS.every((k) => !liveKeys.has(k)), [...liveKeys].sort().join(','));

/* B. On the Atlas the fragment is an unowned channel */
const hashReads = live.reduce((n, f) => n + (read(f).match(/location\.hash/g) || []).length, 0);
check('B1', 'zero location.hash reads in composer, shell and the four live cartridges', hashReads === 0, 'reads=' + hashReads);
const si = read(A(cur.cartridges.find((c) => c.id === 'substation-intelligence').path));
const ctor = si.slice(si.indexOf('new maplibregl.Map({'), si.indexOf('new maplibregl.Map({') + 260);
check('B2', 'the Atlas map is built without MapLibre\'s hash option', ctor.length > 20 && !/\bhash\s*:/.test(ctor), ctor.replace(/\s+/g, ' ').slice(0, 120));
check('B3', 'the GridAtlas root redirect forwards search AND hash', read(P.atlasRepo + '/index.html').includes('window.location.search+window.location.hash'));
const sld = read(A(cur.cartridges.find((c) => c.id === 'sld-sandbox').path));
const pk = sld.match(/const projectKeys = \[([^\]]*)\]/);
const projectKeys = pk ? [...pk[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
check('B4', 'sld-sandbox projectKeys equals ARRIVAL_KEYS minus interconnector, and a plain visit is recorded as such',
    JSON.stringify([...projectKeys].sort()) === JSON.stringify(ARRIVAL_KEYS.filter((k) => k !== 'interconnector').sort())
    && sld.includes("link.origin_source = 'none: a plain visit'"), projectKeys.join(','));
const s0 = sld.indexOf('function deepLinkPlan(');
let i = sld.indexOf('{', s0), depth = 0, e0 = -1;
for (; i < sld.length; i++) { if (sld[i] === '{') depth++; else if (sld[i] === '}' && --depth === 0) { e0 = i + 1; break; } }
const deepLinkPlan = new Function(sld.slice(s0, e0) + '\nreturn deepLinkPlan;')();
const T = { 'gridatlas-v9': { ...LIGHTNING_RECEIVERS['gridatlas-v9'], honours: true },
            'see-through-lightning': { ...LIGHTNING_RECEIVERS['see-through-lightning'], honours: true } };
const W = { period: '24h', end: '2026-10-23T18:00:00.000Z' };
const VIEW = { longitude: -0.4166, latitude: 53.2307, zoom: 9 };
const atlasLink = buildLightningLink('gridatlas-v9', W, VIEW, T);
const aq = new URL(atlasLink).searchParams;
check('B5', 'a lightning link leaves the query empty, so the live deepLinkPlan routes NO_USABLE_POINT',
    new URL(atlasLink).search === '' && deepLinkPlan(aq.get('longitude'), aq.get('latitude'), aq.get('repd_ref')).route === 'NO_USABLE_POINT', atlasLink);
check('B6', 'sld-sandbox invalidates a pending arrival on hashchange, so no lightning code may write the hash',
    sld.includes("window.addEventListener('hashchange', () => invalidatePendingArrival('history-navigation'))")
    && LIGHTNING_RULES.receiver_writes_the_address === false);
const mod = read(P.module);
check('B7', 'the candidate overlay (fda6b10) neither reads nor writes the address today',
    !/location\.|history\.(push|replace)State|URLSearchParams|hashchange|popstate/.test(mod), statSync(P.module).size + ' B');
const pgs = read(A(cur.cartridges.find((c) => c.id === 'uk-gazetteer-flyto').path));
const mixed = parseLightningLink('https://ventusltd.github.io/gridatlas/atlas/?repd_ref=13599' + new URL(atlasLink).hash);
check('B8', 'place search rewrites the address from location.href (keeping the fragment), and the parser refuses the mixed result',
    /new URL\(window\.location\.href\);\s*url\.searchParams\.set\('repd_ref'/.test(pgs) && mixed.mixed_with_arrival && !mixed.honourable, mixed.problems.join('; '));

/* C. Why lightning must never reuse latitude/longitude */
const old = read(P.st + '/202610050356/descent.js');
const oldOk = /link\('OPEN IN GRIDATLAS', ATLAS_URL \+ '\?latitude=' \+ lat\.toFixed\(5\) \+ '&longitude=' \+ lon\.toFixed\(5\) \+ '&zoom=15'/.test(old);
const oq = new URL('https://ventusltd.github.io/gridatlas/atlas/?latitude=53.23070&longitude=-0.41660&zoom=15').searchParams;
check('C1', 'the retired See Through link (202610050356 descent.js:840) would arrive as a project, measured and named "Deep-linked project"',
    oldOk && deepLinkPlan(oq.get('longitude'), oq.get('latitude'), oq.get('repd_ref')).route === 'MEASURE_LINK_FIRST'
    && sld.includes("q.get('project') || 'Deep-linked project'"));

/* D. See Through side */
const stIndex = read(P.st + '/index.html');
const fwd = stIndex.match(/location\.replace\('([^']+)' \+ location\.hash\)/);
check('D1', 'the See Through stable route forwards location.hash and not location.search', Boolean(fwd) && !/location\.search/.test(stIndex), fwd ? fwd[1] : 'none');
const newest = path.join(P.st, fwd ? fwd[1] : '');
const stCode = ['descent.js', 'see3d.js', 'index.html', 'model.js', 'pf.js', 'kuiper-law.js'].map((f) => read(path.join(newest, f))).join('\n');
check('D2', 'the newest See Through generation reads no URL state, so it cannot honour a link yet',
    !/location\.(search|hash)|URLSearchParams|hashchange/.test(stCode), path.basename(newest));
const desc = read(path.join(newest, 'descent.js'));
check('D3', 'ATLAS_URL is declared once and never used in the newest generation (the hand-off is dead code)',
    (desc.match(/ATLAS_URL/g) || []).length === 1, 'occurrences=' + (desc.match(/ATLAS_URL/g) || []).length);

/* E. Honours gate and round trip */
let ra = '', rs = '';
try { buildLightningLink('gridatlas-v9', W, VIEW); } catch (e) { ra = e.message; }
try { buildLightningLink('see-through-lightning', W, VIEW); } catch (e) { rs = e.message; }
check('E1', 'today both receivers are refused, and the refusal says why', /silently inert/.test(ra) && /silently inert/.test(rs));
const stLink = buildLightningLink('see-through-lightning', W, VIEW, T);
const pa = parseLightningLink(atlasLink), ps = parseLightningLink(stLink);
const same = (r) => r.period === '24h' && r.end_utc === '2026-10-23T18:00:00.000Z' && r.start_utc === '2026-10-22T18:00:00.000Z'
    && r.longitude === -0.417 && r.latitude === 53.231 && r.zoom === 9 && r.honourable && r.activation === 'user-gesture-only';
check('E2', 'round trip through both receivers returns the same window and view, rounded to 3 decimals, gesture-only', same(pa) && same(ps), stLink);

/* F. Window honesty */
const refuse = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };
check('F1', '"latest" never crosses: a link without an end is refused', /latest/.test(refuse(() => buildLightningLink('see-through-lightning', { period: '24h' }, VIEW, T))));
const noZ = parseLightningLink('https://x.test/#lightning=24h&lightning_end=2026-10-24T18:00');
check('F2', 'an end without Z is refused, not guessed as local time', !noZ.honourable && noZ.end_utc === null, noZ.problems.join('; '));
const unk = parseLightningLink('https://x.test/#lightning=2w&lightning_end=2026-10-24T18:00Z');
check('F3', 'an unknown period is reported, never coerced', !unk.known_period && unk.start_utc === null && !unk.honourable);
const ends = ['2026-10-23T18:00:00.000Z', '2026-05-31T23:30:00.000Z', '2026-03-31T00:00:00.000Z', '2024-02-29T12:00:00.000Z',
    '2026-03-29T01:00:00.000Z', '2026-10-25T01:00:00.000Z', '2026-01-01T00:00:00.000Z', '2025-02-28T06:00:00.000Z'];
let n = 0;
const parity = ends.every((e) => LIGHTNING_PERIODS.filter((p) => p !== 'custom').every((p) => { n++;
    return new Date(derivedStart(p, Date.parse(e))).toISOString() === hw.selectUtcWindow({ period: p, end: e }).start; }));
check('F4', 'derived starts equal history-window.mjs selectUtcWindow (month ends, leap day, both 2026 DST instants, new year)', parity, n + ' cases');
const cust = parseLightningLink('https://x.test/#lightning=custom&lightning_end=2026-10-24T00:00Z');
check('F5', 'a custom window without a start is reported, not filled in', !cust.honourable && cust.start_utc === null);
const long = parseLightningLink('https://x.test/#lightning=custom&lightning_start=2025-01-01T00:00Z&lightning_end=2026-10-24T00:00Z');
check('F6', 'a window longer than one calendar year is refused by parser and builder',
    !long.honourable && /calendar year/.test(refuse(() => buildLightningLink('see-through-lightning', { period: 'custom', start: '2025-01-01T00:00Z', end: '2026-10-24T00:00Z' }, null, T))));
const fut = parseLightningLink('https://x.test/#lightning=24h&lightning_end=2026-10-30T00:00Z', { nowMs: Date.parse('2026-10-26T22:00:00Z') });
check('F7', 'an end in the future is honoured only with a visible clamp note', fut.end_in_future === true && fut.honourable && fut.notes.some((x) => /future/.test(x)));

/* G. View honesty */
const half = parseLightningLink(buildLightningLink('see-through-lightning', W, { longitude: -1.2 }, T));
check('G1', 'half a coordinate pair is dropped whole: absent is null, never 0', half.longitude === null && half.latitude === null && !half.view_usable);
const ni = parseLightningLink('https://x.test/#lightning=24h&lightning_end=2026-10-24T18:00Z&lightning_lon=0&lightning_lat=0');
check('G2', 'Null Island is no place', ni.view_usable === false);
const deep = parseLightningLink('https://x.test/#lightning=24h&lightning_end=2026-10-24T18:00Z&lightning_lon=-1.5&lightning_lat=53&lightning_zoom=16');
const deepOut = new URL(buildLightningLink('see-through-lightning', W, { ...VIEW, zoom: 16 }, T)).hash;
check('G3', 'zoom above 10 is capped with a note by the parser, and never emitted by the builder',
    deep.zoom === 10 && deep.honourable && deep.notes.some((x) => /capped/.test(x)) && /lightning_zoom=10(&|$)/.test(deepOut), deepOut);
const oslo = parseLightningLink(buildLightningLink('see-through-lightning', W, { longitude: 10.75, latitude: 59.91, zoom: 8 }, T));
check('G4', 'a view outside the archive box is flagged, not refused', oslo.in_uk_box === false && oslo.honourable);

/* H. What never enters the Atlas */
const CATHEDRAL = /KuiperLaw|2654435769|KGGridData|SeeThrough3D|see3d|descent\.js|setTerrain|setPitch|fill-extrusion|AudioContext|vendor\/maplibre|maplibre-gl@4|CERN/;
const hit = mod.match(CATHEDRAL);
check('H1', 'the candidate overlay carries no star field, Kuiper placement, 3D, terrain, audio, second MapLibre or CERN text', !hit, hit ? hit[0] : 'none');
const shell = read(A(cur.shell.index));
check('H2', 'MapLibre split: the Atlas shell pins 3.6.2, See Through vendors 4.7.1',
    shell.includes('maplibre-gl@3.6.2/dist/maplibre-gl.js') && read(path.join(newest, 'vendor/maplibre-gl.js')).slice(0, 300).includes('v4.7.1'));
check('H3', 'licence boundary: See Through is CERN-OHL-S v2, GridAtlas NOTICE is Apache-2.0',
    /CERN Open Hardware Licence Version 2, Strongly Reciprocal/.test(read(path.join(newest, 'LICENSE.md')))
    && /Apache License, Version 2\.0/.test(read(P.atlasRepo + '/NOTICE')));
const headroom = 460000 - statSync(P.cand).size;
const em = statSync(path.join(HERE, 'atlas-emitter.snippet.js')).size, rc = statSync(path.join(HERE, 'atlas-receiver.snippet.js')).size;
check('H4', 'budget: the emitter alone fits the cartridge headroom only if hardening spends little; emitter + receiver do not fit',
    em < headroom && em + rc > headroom, `headroom=${headroom} B (460,000 - ${statSync(P.cand).size}); emitter~${em} B; receiver~${rc} B; both~${em + rc} B`);

let failed = 0;
for (const c of checks) { if (!c.ok) failed++; console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.id} ${c.name}${c.detail ? '  -- ' + c.detail : ''}`); }
console.log(`\n${checks.length - failed}/${checks.length} checks passed (vocabulary ${LIGHTNING_VOCABULARY}); browser half NOT_TESTED`);
if (failed) process.exit(1);
