#!/usr/bin/env node
/* build-paired-catalogue.mjs — regression-challenge-C. Pairs the browser-group proof catalogue, baseline vs candidate,
 * same shim, same catalogue (runners/run-chunked.mjs = runners/run-baseline.mjs + chunking + incremental rows).
 * Sources:
 *   baseline: rows from the pre-restart run (runner log lines in logs/baseline-browser-shim.log, per-proof logs kept),
 *             rows-*.jsonl from the resume chain; all-layer-clicks-1440 per-layer results from the pre-restart
 *             results.json (58 layers completed before the kill) + the L1440-tail chunk (geothermal, caes).
 *   candidate: rows-*.jsonl from the resume chain.
 * all-layer-clicks-* are paired PER LAYER ID (pass, label suffix, eligible, rendered, popup, off, error class).
 * Writes catalogue-paired-table.{md,json}. */
import fs from 'node:fs';
import path from 'node:path';
const EV = path.dirname(new URL(import.meta.url).pathname);
const B = path.join(EV, 'baseline-browser-shim'), C = path.join(EV, 'candidate-browser-shim');
const rj = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const jsonl = (dir) => { const out = []; for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => /^rows-.*\.jsonl$/.test(f)).sort()) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) if (l.trim()) out.push({ ...JSON.parse(l), source: f }); return out; };

// --- proof-level rows -------------------------------------------------------------------------------------
const base = new Map(), cand = new Map();
// pre-restart baseline rows from the runner log
const preLog = fs.readFileSync(path.join(EV, 'logs', 'baseline-browser-shim.log'), 'utf8');
for (const m of preLog.matchAll(/^\[runner\] (PASS|FAIL|BLOCKED_\w+)\s+(\S+)\s+([\d.]+)s\s+(.*)$/gm)) base.set(m[2], { id: m[2], result: m[1], durationS: +m[3], firstError: m[4].slice(0, 200), source: 'pre-restart run (logs/baseline-browser-shim.log)' });
for (const r of jsonl(B)) base.set(r.id, { id: r.id, result: r.result, note: r.note, durationS: +(r.durationMs / 1000).toFixed(1), firstError: (r.firstError || '').slice(0, 200), source: r.source });
for (const r of jsonl(C)) cand.set(r.id, { id: r.id, result: r.result, note: r.note, durationS: +(r.durationMs / 1000).toFixed(1), firstError: (r.firstError || '').slice(0, 200), source: r.source });

// --- per-layer pairing for all-layer-clicks ---------------------------------------------------------------
const layerResults = (dir, width) => { const m = new Map(); for (const d of fs.readdirSync(dir).filter(d => d === `all-layer-clicks-${width}` || d.startsWith(`all-layer-clicks-${width}-`)).sort()) { const r = rj(path.join(dir, d, 'results.json')); if (!r) continue; for (const x of r.results) { const prev = m.get(x.id); /* a later chunk (tail/retry) replaces a row the restart killed */ if (!prev || (prev.error && /closed|crashed/.test(prev.error) && d !== `all-layer-clicks-${width}`)) m.set(x.id, { ...x, chunk: d }); } } return m; };
const cls = (x) => { if (!x) return 'MISSING'; if (x.pass) return 'PASS'; if (x.error) { if (/Target crashed/.test(x.error)) return 'ERR:target-crashed'; if (/has been closed/.test(x.error)) return 'ERR:context-closed'; if (/Timeout/.test(x.error)) return 'ERR:timeout ' + (x.error.match(/waiting for ([^\n]{0,60})/) || [, ''])[1]; return 'ERR:' + x.error.slice(0, 60); } const suf = (x.label || '').match(/\[[^\]]*\]$/); if (x.eligible === 0) return 'NOT-LOADED ' + (suf ? suf[0] : ''); return `FAIL rendered=${x.rendered} popup=${x.popup} off=${x.off}`; };
const layerPairs = {};
for (const w of ['1440', '393']) {
  const bl = layerResults(B, w), cl = fs.existsSync(C) ? layerResults(C, w) : new Map();
  const ids = [...new Set([...bl.keys(), ...cl.keys()])];
  layerPairs[w] = ids.map(id => { const b = bl.get(id), c = cl.get(id); return { id, baseline: cls(b), candidate: cls(c), same: cls(b) === cls(c), b: b && { label: b.label, eligible: b.eligible, rendered: b.rendered, popup: b.popup, off: b.off, chunk: b.chunk }, c: c && { label: c.label, eligible: c.eligible, rendered: c.rendered, popup: c.popup, off: c.off, chunk: c.chunk } }; });
}

// --- per-step pairing for all-controls (desktop / android-emulation) ----------------------------------------
const stepPairs = {};
for (const [name, file] of [['all-controls-desktop', 'report.json'], ['all-controls-mobile', 'report.json']]) {
  const load = (dir) => { const r = rj(path.join(dir, name, file)); const m = new Map(); if (!r) return m; for (const p of r.profiles || []) for (const c of p.checks || []) { const ok = c.completed === true && !c.error; const err = String(c.error || '').split('\n')[0]; m.set(c.name, { ok, cls: ok ? 'ok' : /Target crashed|has been closed/.test(err) ? 'ERR:renderer-crashed(OOM)' : /Timeout/.test(err) ? 'timeout' : err ? 'error:' + err.slice(0, 60) : 'false' }); } return m; };
  const b = load(B), c = load(C); const ids = [...new Set([...b.keys(), ...c.keys()])];
  stepPairs[name] = ids.map(id => ({ step: id, baseline: b.get(id)?.cls ?? 'MISSING', candidate: c.get(id)?.cls ?? 'MISSING' })).map(x => ({ ...x, same: x.baseline === x.candidate }));
}

// --- assemble ------------------------------------------------------------------------------------------------
const ids = [...new Set([...base.keys(), ...cand.keys()])].filter(id => !/^all-layer-clicks-/.test(id));
const rows = ids.map(id => { const b = base.get(id), c = cand.get(id); return { id, baseline: b ? b.result : 'MISSING', candidate: c ? c.result : 'MISSING', same: !!b && !!c && b.result === c.result, bErr: b?.firstError, cErr: c?.firstError, bNote: b?.note, cNote: c?.note, bSrc: b?.source, cSrc: c?.source }; });
for (const w of ['1440', '393']) { const lp = layerPairs[w]; const sum = (k) => lp.reduce((a, x) => { a[x[k]] = (a[x[k]] || 0) + 1; return a; }, {}); rows.push({ id: `all-layer-clicks-${w} (per layer, ${lp.length} ids)`, baseline: JSON.stringify(sum('baseline')), candidate: JSON.stringify(sum('candidate')), same: lp.every(x => x.same), layerDiffs: lp.filter(x => !x.same) }); }
fs.writeFileSync(path.join(EV, 'catalogue-paired-table.json'), JSON.stringify({ builtAt: new Date().toISOString(), rows, layerPairs }, null, 2));
const md = ['# Browser proof catalogue — paired baseline vs candidate (regression-challenge-C)', '', 'Harness: lead offline shim (runners/shim-preload.cjs) on both sides, Playwright 1.63.0 Chromium headless, concurrency 1, same catalogue (runners/run-chunked.mjs). Baseline = main c08f3a6 via shadow-baseline, base http://127.0.0.1:8143/gridatlas/atlas/ ; candidate = fda6b10 bytes via shadow-candidate, base http://127.0.0.1:8144/wt/atlas/v/202610261949/ .', '', '| proof | baseline | candidate | same | baseline first error | candidate first error |', '|---|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.id} | ${r.baseline} | ${r.candidate} | ${r.same ? 'yes' : '**NO**'} | ${(r.bErr || '').replace(/\|/g, '/').slice(0, 120)} | ${(r.cErr || '').replace(/\|/g, '/').slice(0, 120)} |`);
for (const w of ['1440', '393']) { md.push('', `## all-layer-clicks-${w}: per-layer differences`, '', '| layer | baseline | candidate |', '|---|---|---|'); for (const x of layerPairs[w].filter(x => !x.same)) md.push(`| ${x.id} | ${x.baseline} | ${x.candidate} |`); }
for (const [name, sp] of Object.entries(stepPairs)) { md.push('', `## ${name}: per-step pairing (${sp.length} steps, ${sp.filter(x => !x.same).length} differ)`, '', '| step | baseline | candidate | same |', '|---|---|---|---|'); for (const x of sp) md.push(`| ${x.step} | ${x.baseline} | ${x.candidate} | ${x.same ? 'yes' : '**NO**'} |`); }
fs.writeFileSync(path.join(EV, 'catalogue-paired-table.json'), JSON.stringify({ builtAt: new Date().toISOString(), rows, layerPairs, stepPairs }, null, 2));
fs.writeFileSync(path.join(EV, 'catalogue-paired-table.md'), md.join('\n') + '\n');
for (const [name, sp] of Object.entries(stepPairs)) for (const x of sp.filter(x => !x.same)) console.log(`   step ${name} ${x.step}: B=${x.baseline} C=${x.candidate}`);
console.log(rows.map(r => `${r.same ? '  same' : '**DIFF'} ${r.id}: B=${r.baseline} C=${r.candidate}`).join('\n'));
for (const w of ['1440', '393']) for (const x of layerPairs[w].filter(x => !x.same)) console.log(`   layer ${w} ${x.id}: B=${x.baseline} C=${x.candidate}`);
