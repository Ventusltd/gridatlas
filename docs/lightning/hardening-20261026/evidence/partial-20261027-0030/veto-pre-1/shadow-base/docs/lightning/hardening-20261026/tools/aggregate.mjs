#!/usr/bin/env node
// opus-matrix-aggregator — merge lane reports into TEST-MATRIX.json (issue #32 §12 C).
// Harness: self (Node only, no browser, no network). Reads reports/*.md and a TEST-MATRIX.json;
// writes ONLY to the path given with --out. Without --out it is a dry run (summary only).
//
// Usage:
//   node aggregate.mjs [--matrix <TEST-MATRIX.json>] [--reports <dir>] [--only a.md,b.md]
//                      [--out <merged.json>] [--allow-in-place] [--quiet]
// Defaults (relative to this script): --matrix ../../wt/docs/lightning/hardening-20261026/TEST-MATRIX.json
//                                      --reports ../../reports
//
// Parsed forms (status words are case-sensitive, from issue §1):
//   1. Markdown table rows whose first cell starts with an acceptance ID. The status cell is the
//      column whose header contains Status/Result/Verdict/Outcome; without such a column, the
//      second cell is used only if it starts with a status word.
//   2. Tables with a "decision" header and no status column (owner decision packs): every ID row
//      is recorded as OWNER_DECISION (form "decision-table").
//   3. Bullets / plain lines that start with an ID ("D07: FAIL", "- **R07: …** BLOCKED_DEPENDENCY"):
//      the status words within the first 160 characters after the ID (form "line").
//   4. Headings that start with an ID: if the section text contains the word OWNER_DECISION,
//      the IDs get an owner-decision flag (form "section"). No other status is taken from prose.
//   Text inside `backticks` and [brackets] is ignored when looking for status words, so UI labels
//   such as `[FAIL]` are not read as verdicts. Code fences are skipped.
//
// Conflict policy (applied in this order):
//   a. FAIL beats PASS (and beats everything else).
//   b. BLOCKED never upgrades to PASS: BLOCKED_DEPENDENCY > BLOCKED_HARNESS > PASS > NOT_TESTED.
//   c. OWNER_DECISION is kept alongside the technical status (fields owner_decision and
//      technical_status). `status` shows the technical status, or OWNER_DECISION when the only
//      technical status is NOT_TESTED.
//   d. Every source lane is recorded per row (rows[].sources), with file, line, form and raw text.
//   Within one cell, a NOT_TESTED next to another status sets `partial: true` on that source.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VOCAB = ['PASS', 'FAIL', 'BLOCKED_DEPENDENCY', 'BLOCKED_HARNESS', 'NOT_TESTED', 'OWNER_DECISION'];
const RANK = { NOT_TESTED: 0, PASS: 1, BLOCKED_HARNESS: 2, BLOCKED_DEPENDENCY: 3, FAIL: 4 };
const ID_SRC = String.raw`(?:P(?:0[1-9]|1[0-6])|D(?:0[1-9]|1[0-8])|R(?:0[1-9]|1[0-2])|V(?:1[0-5]|0?[1-9]))`;
const ID_RE = new RegExp(String.raw`(?<![A-Za-z0-9_])(${ID_SRC})(?![A-Za-z0-9_])`, 'g');
const STATUS_RE = /(?<![A-Za-z0-9_])(PASS|FAIL|BLOCKED_DEPENDENCY|BLOCKED_HARNESS|NOT_TESTED|OWNER_DECISION)(?![A-Za-z0-9_])/g;
// heuristic: only backticked invocations count as commands (quoted source code such as `git add -A …` from a workflow does not)
const CMD_RE = /^(node\s+\S+\.[cm]?js|python3?\s+(-\S+\s+)*\S+\.py|sha256sum|shasum|curl\s|gh\s+api|cmp\s|npx\s|bash\s+\S+\.sh|git\s+(show|diff|rev-parse|ls-tree|log|worktree)\b|adb\s)/;
const PATHISH_RE = /[\/]|\.(txt|json|log|png|md|mjs|cjs|js|py|out|diff|har|yml|csv)$/;

// ---------- args ----------
function parseArgs(argv) {
  const a = { matrix: path.resolve(HERE, '../../wt/docs/lightning/hardening-20261026/TEST-MATRIX.json'),
    reports: path.resolve(HERE, '../../reports'), only: null, out: null, allowInPlace: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { if (i + 1 >= argv.length) die(`missing value for ${k}`); return argv[++i]; };
    if (k === '--matrix') a.matrix = path.resolve(v());
    else if (k === '--reports') a.reports = path.resolve(v());
    else if (k === '--only') a.only = v().split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--out') a.out = path.resolve(v());
    else if (k === '--allow-in-place') a.allowInPlace = true;
    else if (k === '--quiet') a.quiet = true;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n')); process.exit(0); }
    else die(`unknown argument ${k}`);
  }
  return a;
}
function die(m) { console.error('aggregate.mjs: ' + m); process.exit(2); }
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// ---------- text helpers ----------
const mask = s => s.replace(/`[^`]*`/g, m => ' '.repeat(m.length)).replace(/\[[^\]\n]*\]/g, m => ' '.repeat(m.length));
const unmark = s => s.replace(/\*\*|__|(?<![A-Za-z0-9])[*_](?=\S)|(?<=\S)[*_](?![A-Za-z0-9])/g, '').trim();
// a status word used as a count ("FAIL 7/PASS 20", "3 PASS") is not a verdict
const tokens = s => { const m = mask(s); return [...m.matchAll(STATUS_RE)]
  .filter(x => !/^\s*\d/.test(m.slice(x.index + x[1].length)) && !/\d\s*$/.test(m.slice(0, x.index))).map(x => x[1]); };

function splitRow(line) {
  // split a markdown table row on unescaped pipes outside backticks
  let t = line.trim(); if (t.startsWith('|')) t = t.slice(1); if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  const cells = []; let cur = '', tick = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\' && t[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') tick = !tick;
    if (c === '|' && !tick) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
const isSep = l => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);

function normId(id) { return id[0] === 'V' ? 'V' + String(parseInt(id.slice(1), 10)) : id; }
// IDs at the start of a string: "R04/R05", "R07/R08/E", "D03 Time semantics", "R07–R08"
function leadingIds(text) {
  const s = unmark(text).replace(/^[#>\s]*/, '');
  const B = String.raw`(?![A-Za-z0-9_])`;
  const head = s.match(new RegExp(String.raw`^${ID_SRC}${B}(?:\s*(?:/|,|&|\+|–|-|and)\s*(?:${ID_SRC}${B}|[A-Z](?![A-Za-z0-9])))*`));
  if (!head) { const odd = s.match(/^([PDRV]\d{1,3})(?![A-Za-z0-9_])/); if (odd) leadingIds.odd.push(odd[1]); return []; }
  const ids = [...head[0].matchAll(ID_RE)].map(m => normId(m[1]));
  // expand simple ranges written with an en dash or hyphen, same prefix: R07–R09
  const rng = head[0].match(new RegExp(String.raw`^(${ID_SRC})\s*[–-]\s*(${ID_SRC})$`));
  if (rng && rng[1][0] === rng[2][0]) {
    const p = rng[1][0], a = parseInt(rng[1].slice(1), 10), b = parseInt(rng[2].slice(1), 10), out = [];
    for (let n = a; n <= b; n++) out.push(p === 'V' ? `V${n}` : `${p}${String(n).padStart(2, '0')}`);
    return out;
  }
  return [...new Set(ids)];
  // (returns [] when the line does not start with an ID)
}
leadingIds.odd = [];
function extract(text) {
  const ticks = [...text.matchAll(/`([^`]+)`/g)].map(m => m[1].trim());
  const commands = ticks.filter(t => CMD_RE.test(t));
  const paths = ticks.filter(t => !CMD_RE.test(t) && PATHISH_RE.test(t) && !/\s/.test(t));
  return { commands, paths };
}
function classify(toks) {
  const owner = toks.includes('OWNER_DECISION');
  const tech = toks.filter(t => t !== 'OWNER_DECISION');
  let technical = null;
  for (const t of tech) if (technical === null || RANK[t] > RANK[technical]) technical = t;
  return { owner, technical, partial: tech.includes('NOT_TESTED') && technical !== 'NOT_TESTED' && technical !== null,
    primary: toks[0] || null };
}

// ---------- report parser ----------
function parseReport(file) {
  const lane = path.basename(file, '.md');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = [], diag = [];
  let fence = false;
  const sections = []; // {level, ids, start, end}
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      for (const s of sections) if (s.end === null && s.level >= h[1].length) s.end = i;
      const ids = leadingIds(h[2]);
      if (ids.length) sections.push({ level: h[1].length, ids, start: i, end: null });
      continue;
    }
    // ---- tables ----
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = splitRow(line).map(c => unmark(c).toLowerCase());
      const statusCol = header.findIndex((c, k) => k > 0 && /\b(status|result|verdict|outcome)\b/.test(c));
      const decisionCol = header.findIndex(c => /\bdecision\b/.test(c));
      const evCols = header.map((c, k) => (/evidence/.test(c) ? k : -1)).filter(k => k > 0);
      const cmdCols = header.map((c, k) => (/command/.test(c) ? k : -1)).filter(k => k > 0);
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
        const cells = splitRow(lines[j]);
        const ids = leadingIds(cells[0] || '');
        if (!ids.length) continue;
        let cell = null, form = 'table';
        if (statusCol >= 0) cell = cells[statusCol] ?? '';
        else if (decisionCol >= 0) form = 'decision-table';
        else if (cells[1] && /^(PASS|FAIL|BLOCKED_DEPENDENCY|BLOCKED_HARNESS|NOT_TESTED|OWNER_DECISION)(?![A-Za-z0-9_])/.test(unmark(mask(cells[1])).trim())) cell = cells[1];
        else { if (tokens(cells.slice(1).join(' ')).length) diag.push(`${lane}:${j + 1} ID row with status words but no status column; ignored`); continue; }
        let toks = form === 'decision-table' ? ['OWNER_DECISION'] : tokens(cell);
        if (!toks.length) { diag.push(`${lane}:${j + 1} ${ids.join('/')} status cell has no status word: "${unmark(cell).slice(0, 80)}"`); continue; }
        const evText = (evCols.length ? evCols : cells.map((_, k) => k).filter(k => k > 0 && k !== statusCol)).map(k => cells[k] || '').join(' | ');
        const cmdText = cmdCols.map(k => cells[k] || '').join(' | ');
        const ex = extract(evText + ' ' + cmdText);
        for (const id of ids) out.push({ id, lane, file: path.basename(file), line: j + 1, form,
          status_text: form === 'decision-table' ? unmark(cells[decisionCol] || '') : unmark(cell),
          tokens: toks, ...classify(toks), evidence_text: unmark(evText).slice(0, 1200), ...ex });
      }
      i = j - 1; continue;
    }
    // ---- bullets / plain "ID: STATUS" lines ----
    const body = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\s*>\s*/, '');
    const ids = leadingIds(body);
    if (ids.length) {
      const s = unmark(body);
      const idEnd = s.search(/[\s:.—–-]/) >= 0 ? s.search(/[\s:.—–-]/) : s.length;
      const window = s.slice(idEnd, idEnd + 160);
      // mask on the original body text so `[FAIL]` and `code` are ignored
      const toks = tokens(window);
      if (toks.length) {
        const ex = extract(body);
        for (const id of ids) out.push({ id, lane, file: path.basename(file), line: i + 1, form: 'line',
          status_text: s.slice(0, 300), tokens: toks, ...classify(toks), evidence_text: '', ...ex });
      }
    }
  }
  for (const s of sections) {
    const end = s.end ?? lines.length;
    const text = lines.slice(s.start + 1, end).join('\n');
    const hit = lines.slice(s.start + 1, end).findIndex(l => tokens(l).includes('OWNER_DECISION'));
    if (hit >= 0 && tokens(text).includes('OWNER_DECISION'))
      for (const id of s.ids) out.push({ id, lane, file: path.basename(file), line: s.start + 2 + hit, form: 'section',
        status_text: unmark(lines[s.start + 1 + hit]).slice(0, 300), tokens: ['OWNER_DECISION'], ...classify(['OWNER_DECISION']),
        evidence_text: '', commands: [], paths: [] });
  }
  return { lane, entries: out, diag };
}

// ---------- merge ----------
function merge(matrix, parsed, reportsDir) {
  const ids = matrix.rows.map(r => r.id);
  const dup = ids.filter((x, k) => ids.indexOf(x) !== k);
  const byId = new Map(matrix.rows.map(r => [r.id, r]));
  const unknown = new Set();
  const rows = matrix.rows.map(r => ({ ...r, _src: [] }));
  const rowMap = new Map(rows.map(r => [r.id, r]));
  for (const p of parsed) for (const e of p.entries) {
    if (!rowMap.has(e.id)) { unknown.add(`${e.id} (${e.file}:${e.line})`); continue; }
    rowMap.get(e.id)._src.push(e);
  }
  for (const r of rows) {
    const base = byId.get(r.id);
    const sources = [];
    if (base.status && base.status !== 'NOT_TESTED') sources.push({ lane: 'matrix-input', file: 'TEST-MATRIX.json', line: null, form: 'matrix',
      status_text: base.status, tokens: [base.status], ...classify([base.status]), evidence_text: base.evidence || '', commands: base.command ? [base.command] : [], paths: base.evidence ? [base.evidence] : [] });
    sources.push(...r._src);
    let tech = null; const techSet = new Set(); let owner = false;
    for (const s of sources) {
      if (s.owner) owner = true;
      if (s.technical) { techSet.add(s.technical); if (tech === null || RANK[s.technical] > RANK[tech]) tech = s.technical; }
    }
    tech = tech || 'NOT_TESTED';
    const notes = [];
    const tested = [...techSet].filter(t => t !== 'NOT_TESTED');
    if (tested.length > 1) notes.push(`conflict ${sources.filter(s => s.technical && s.technical !== 'NOT_TESTED').map(s => `${s.lane}=${s.technical}`).join(', ')} → ${tech} (policy: FAIL > BLOCKED_DEPENDENCY > BLOCKED_HARNESS > PASS)`);
    if (techSet.has('NOT_TESTED') && tech !== 'NOT_TESTED') notes.push(`some sources say NOT_TESTED for part of the row: ${sources.filter(s => s.technical === 'NOT_TESTED' || s.partial).map(s => s.lane).join(', ')}`);
    if (owner) notes.push(`owner decision raised by ${[...new Set(sources.filter(s => s.owner).map(s => s.lane))].join(', ')}`);
    const status = tech === 'NOT_TESTED' && owner ? 'OWNER_DECISION' : tech;
    const lanes = sources.filter(s => s.lane !== 'matrix-input');
    const ev = [base.evidence, ...lanes.map(s => `reports/${s.file}:${s.line}` + (s.paths.length ? ` [${s.lane}: ${[...new Set(s.paths)].join(', ')}]` : ''))].filter(Boolean);
    const cmd = [base.command, ...lanes.flatMap(s => s.commands.map(c => `${c}  (${s.lane})`))].filter(Boolean);
    delete r._src;
    Object.assign(r, {
      status, technical_status: tech, owner_decision: owner,
      evidence: [...new Set(ev)].join('; '), command: [...new Set(cmd)].join('; '),
      source_lanes: [...new Set(sources.map(s => s.lane))],
      sources: sources.map(s => ({ lane: s.lane, file: s.file, line: s.line, form: s.form, tokens: s.tokens,
        technical_status: s.technical, owner_decision: s.owner, partial: s.partial, status_text: s.status_text,
        evidence_text: s.evidence_text, paths: s.paths, commands: s.commands,
        evidence_dir: s.lane === 'matrix-input' ? null : (fs.existsSync(path.join(reportsDir, '..', 'evidence', s.lane)) ? `evidence/${s.lane}/` : null) })),
      merge_notes: notes,
    });
  }
  return { rows, unknown: [...unknown], dup };
}

// ---------- main ----------
const args = parseArgs(process.argv.slice(2));
if (!fs.existsSync(args.matrix)) die(`matrix not found: ${args.matrix}`);
const matrixBuf = fs.readFileSync(args.matrix);
const matrix = JSON.parse(matrixBuf);
if (!Array.isArray(matrix.rows)) die('matrix has no rows[]');
let files = fs.readdirSync(args.reports).filter(f => f.endsWith('.md')).sort();
if (args.only) { const miss = args.only.filter(f => !files.includes(f)); if (miss.length) die(`--only names missing reports: ${miss.join(', ')}`); files = args.only; }
const parsed = files.map(f => ({ ...parseReport(path.join(args.reports, f)), file: f, sha256: sha256(fs.readFileSync(path.join(args.reports, f))) }));
const { rows, unknown, dup } = merge(matrix, parsed, args.reports);

const result = { ...matrix, rows, aggregation: {
  tool: 'evidence/opus-matrix-aggregator/aggregate.mjs', tool_sha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  harness: 'self (Node ' + process.version + ', static markdown parse; no browser, no network)',
  generated_utc: new Date().toISOString(), input_matrix: args.matrix, input_matrix_sha256: sha256(matrixBuf),
  reports: parsed.map(p => ({ file: p.file, sha256: p.sha256, entries: p.entries.length, ids: [...new Set(p.entries.map(e => e.id))] })),
  policy: ['FAIL beats PASS (FAIL > BLOCKED_DEPENDENCY > BLOCKED_HARNESS > PASS > NOT_TESTED)', 'BLOCKED never upgrades to PASS',
    'OWNER_DECISION kept alongside technical_status; status=OWNER_DECISION only when technical_status is NOT_TESTED',
    'every source lane recorded in rows[].sources', 'NOT_TESTED from a lane never downgrades a tested status; it is noted in merge_notes'],
  unknown_ids: unknown, out_of_vocabulary_ids: [...new Set(leadingIds.odd)], duplicate_matrix_ids: dup, diagnostics: parsed.flatMap(p => p.diag),
} };

// ---------- summary ----------
if (!args.quiet) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`matrix: ${args.matrix} (sha256 ${result.aggregation.input_matrix_sha256.slice(0, 12)})`);
  for (const p of result.aggregation.reports) console.log(`report: ${pad(p.file, 28)} entries ${pad(p.entries, 3)} ids ${p.ids.join(' ') || '-'}`);
  console.log('\n' + pad('ID', 5) + pad('STATUS', 20) + pad('TECHNICAL', 20) + pad('OWNER', 7) + 'SOURCES (lane=status[+OD][~partial])');
  for (const r of rows) {
    const src = r.sources.map(s => `${s.lane}=${s.technical_status || '-'}${s.owner_decision ? '+OD' : ''}${s.partial ? '~' : ''}`).join(', ');
    console.log(pad(r.id, 5) + pad(r.status, 20) + pad(r.technical_status, 20) + pad(r.owner_decision ? 'yes' : '', 7) + (src || '-'));
  }
  const count = {}; for (const r of rows) count[r.status] = (count[r.status] || 0) + 1;
  console.log('\ncounts: ' + VOCAB.map(v => `${v} ${count[v] || 0}`).join(' · ') + ` · rows ${rows.length}`);
  const nt = rows.filter(r => r.status === 'NOT_TESTED').map(r => r.id);
  console.log(`\nNOT_TESTED (${nt.length}): ${nt.join(' ') || 'none'}`);
  const conf = rows.filter(r => r.merge_notes.some(n => n.startsWith('conflict')));
  if (conf.length) { console.log('\nconflicts:'); for (const r of conf) console.log(`  ${r.id}: ${r.merge_notes.find(n => n.startsWith('conflict'))}`); }
  if (dup.length) console.log(`\nWARNING duplicate ids in input matrix: ${dup.join(' ')}`);
  if (unknown.length) console.log(`\nIDs in reports but not in matrix: ${unknown.join(', ')}`);
  if (result.aggregation.out_of_vocabulary_ids.length) console.log(`\nID-like labels outside P01–P16/D01–D18/R01–R12/V1–V15 (ignored): ${result.aggregation.out_of_vocabulary_ids.join(' ')}`);
  if (result.aggregation.diagnostics.length) { console.log('\ndiagnostics:'); for (const d of result.aggregation.diagnostics) console.log('  ' + d); }
}

if (!args.out) { if (!args.quiet) console.log('\n(dry run: no --out given, nothing written)'); process.exit(0); }
if (path.resolve(args.out) === path.resolve(args.matrix) && !args.allowInPlace) die('refusing to overwrite the input matrix; pass a different --out (or --allow-in-place deliberately)');
fs.writeFileSync(args.out, JSON.stringify(result, null, 1) + '\n');
if (!args.quiet) console.log(`\nwrote ${args.out}`);
