// reconstruct.mjs (CD-source lane, 29 Oct 2026, one-off; kept as the provenance of tools/lightning/src): the committed M4
// and M4b module bytes -> tools/lightning/src/*.js (readable layout, the comments of annotations.mjs, ///#if variant
// blocks from a token-level diff of the two modules), then proves build.mjs reproduces both modules byte for byte.
// It needs acorn 8.11.3 (npm i --no-save acorn@8.11.3 in a scratch directory; the repository installs nothing). It is
// NOT how the source is maintained now: edit tools/lightning/src directly (docs/LIGHTNING-SOURCE.md).
// usage: node reconstruct.mjs <repo-worktree> [--dry]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as acorn from 'acorn';
import { FILES, NOTES } from './annotations.mjs';

const REPO = path.resolve(process.argv[2]);
const DRY = process.argv.includes('--dry');
const GA = '202610290045', GB = '202610290050', VA = 'layers', VB = 'dots';
const MAXW = 110;
const rd = g => fs.readFileSync(path.join(REPO, 'atlas/modules', `${g}-uk-lightning-overlay.js`), 'utf8');
const norm = (t, g) => { if (t.split(g).length !== 3) throw new Error('GEN count ' + g); return t.split(g).join('@@GEN@@'); };
const A = norm(rd(GA), GA), B = norm(rd(GB), GB);

/* ---------- token info per text: break candidates and depth ---------- */
function analyse(T) {
  const toks = [], comments = [];
  for (const t of acorn.tokenizer(T, { ecmaVersion: 2022, onComment: (b, x, s, e) => comments.push([s, e]) })) toks.push(t);
  const inTok = new Uint8Array(T.length + 1); // 1 = position strictly inside a token or comment
  for (const t of toks) for (let i = t.start + 1; i < t.end; i++) inTok[i] = 1;
  for (const [s, e] of comments) for (let i = s + 1; i < e; i++) inTok[i] = 1;
  const depthAt = new Int16Array(T.length + 1); // bracket depth (excluding templates) before position
  const brk = new Map(); // position -> {kind, depth}
  const stack = [];
  const match = new Map();
  { const st = []; toks.forEach((t, i) => { const l = t.type.label;
      if (l === '{' || l === '${') st.push(i); else if (l === '}') { const j = st.pop(); if (j !== undefined) match.set(j, i); } }); }
  let pos = 0;
  const depth = () => stack.filter(x => x !== '`' && x !== '${').length;
  const inTpl = () => stack.includes('`');
  toks.forEach((t, i) => {
    for (; pos <= t.start; pos++) depthAt[pos] = depth();
    const l = t.type.label;
    const next = toks[i + 1];
    if (l === '`') { if (stack[stack.length - 1] === '`') stack.pop(); else stack.push('`'); }
    else if (l === '${') stack.push('${');
    else if (l === '{' || l === '(' || l === '[') stack.push(l);
    else if (l === '}' || l === ')' || l === ']') stack.pop();
    for (; pos <= t.end; pos++) depthAt[pos] = depth();
    if (!next || next.start !== t.end || inTpl()) return;
    if (l === ';') brk.set(t.end, { kind: 'semi' });
    else if (l === ',') brk.set(t.end, { kind: 'comma' });
    else if (l === '{' && match.has(i) && toks[match.get(i)].start - t.end > 50) {
      brk.set(t.end, { kind: 'open' });
      const c = toks[match.get(i)];
      if (toks[match.get(i) - 1].end === c.start) brk.set(c.start, { kind: 'close' });
    }
  });
  for (; pos <= T.length; pos++) depthAt[pos] = depth();
  const bnd = new Uint8Array(T.length + 1); bnd[0] = bnd[T.length] = 1;
  for (const t of toks) bnd[t.start] = bnd[t.end] = 1;
  for (const [a, b] of comments) bnd[a] = bnd[b] = 1;
  for (let i = 0; i < T.length; i++) if (T[i] === '\n') bnd[i] = bnd[i + 1] = 1;
  return { T, inTok, depthAt, brk, bnd };
}
const IA = analyse(A), IB = analyse(B);

/* ---------- diff A/B into common and alternative segments ---------- */
function lineDiff(a, b) {
  const al = a.split('\n'), bl = b.split('\n'), n = al.length, m = bl.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = al[i] === bl[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && al[i] === bl[j]) { ops.push(['=', i, j]); i++; j++; }
    else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) { ops.push(['+', i, j]); j++; }
    else { ops.push(['-', i, j]); i++; }
  }
  return { al, bl, ops };
}
const off = ls => { const o = [0]; for (const l of ls) o.push(o[o.length - 1] + l.length + 1); return o; };
function segments() {
  const { al, bl, ops } = lineDiff(A, B), oa = off(al), ob = off(bl);
  const hunks = []; // [aStart, aEnd, bStart, bEnd] char ranges
  let k = 0;
  while (k < ops.length) {
    if (ops[k][0] === '=') { k++; continue; }
    const i0 = ops[k][1], j0 = ops[k][2]; let i1 = i0, j1 = j0;
    while (k < ops.length && ops[k][0] !== '=') { if (ops[k][0] === '-') i1 = ops[k][1] + 1; else j1 = ops[k][2] + 1; k++; }
    let as = oa[i0], ae = oa[i1], bs = ob[j0], be = ob[j1];
    // char-level trim
    while (as < ae && bs < be && A[as] === B[bs]) { as++; bs++; }
    while (ae > as && be > bs && A[ae - 1] === B[be - 1]) { ae--; be--; }
    // snap outwards to positions outside tokens/comments in both texts
    while (!(IA.bnd[as] && IB.bnd[bs])) { as--; bs--; }
    while (!(IA.bnd[ae] && IB.bnd[be])) { ae++; be++; }
    // token-level LCS inside the block
    const P = (I, s, e) => { const o = []; let q = s; for (let i = s + 1; i <= e; i++) if (I.bnd[i]) { o.push([q, i]); q = i; } return o; };
    const pa = P(IA, as, ae), pb = P(IB, bs, be), ta = pa.map(([x, y]) => A.slice(x, y)), tb = pb.map(([x, y]) => B.slice(x, y));
    const n = ta.length, m = tb.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = ta[i] === tb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const runs = []; let i = 0, j = 0, cur = null, same = 0;
    const posA = i => i < n ? pa[i][0] : ae, posB = j => j < m ? pb[j][0] : be;
    while (i < n || j < m) {
      if (i < n && j < m && ta[i] === tb[j]) { if (cur) { same++; if (same > 8 || /\n/.test(ta[i])) { runs.push(cur); cur = null; } } i++; j++; continue; }
      if (!cur) cur = { as: posA(i), bs: posB(j) };
      else if (same) { /* short common gap: absorb */ }
      same = 0;
      if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) j++; else i++;
      cur.ae = posA(i); cur.be = posB(j);
    }
    if (cur) runs.push(cur);
    // an unrelated rewrite (few shared tokens) stays one block
    if (L[0][0] < 0.5 * Math.min(n, m) && Math.min(n, m) > 20) runs.splice(0, runs.length, { as, ae, bs, be });
    for (const r of runs) {
      let { as, ae, bs, be } = r;
      // trim the absorbed common tail back off
      while (ae > as && be > bs && A[ae - 1] === B[be - 1]) { ae--; be--; }
      while (!(IA.bnd[ae] && IB.bnd[be])) { ae++; be++; }
      const ws = c => c === ' ';
      while (as > 0 && A[as - 1] !== '\n' && (ws(A[as]) || ws(B[bs]))) { as--; bs--; while (!(IA.bnd[as] && IB.bnd[bs])) { as--; bs--; } }
      while (ae < A.length && ws(A[ae])) { ae++; be++; }
      // widen to whole statements or list items when they are near (inside common text, so A and B move together)
      { const ls = lineStart(A, as); let k = as; const pun = q => /[;,{}(]/.test(A[q - 1]) && IA.bnd[q] && IA.bnd[q - 1] && !IA.inTok[q - 1];
        while (k > ls && as - k <= 40 && !pun(k)) k--;
        if (k === ls || pun(k)) { if (as - k <= 40) { bs -= as - k; as = k; } } }
      { const le = lineEnd(A, ae); let k = ae; const pe = q => /[;,]/.test(A[q]) && IA.bnd[q] && IA.bnd[q + 1] && !IA.inTok[q];
        while (k < le && k - ae <= 40 && !pe(k)) k++;
        if (k < le && k - ae <= 40) { be += k + 1 - ae; ae = k + 1; } else if (k === le && k - ae <= 40) { be += k - ae; ae = k; } }
      if (/^ *$/.test(A.slice(lineStart(A, as), as)) && /^ *$/.test(B.slice(lineStart(B, bs), bs))) { const d = as - lineStart(A, as); if (bs - lineStart(B, bs) === d) { as -= d; bs -= d; } }
      hunks.push([as, ae, bs, be]);
    }
  }
  // merge overlapping / touching hunks
  const H = [];
  for (const h of hunks) { const p = H[H.length - 1]; if (p && h[0] <= p[1]) { p[1] = Math.max(p[1], h[1]); p[3] = Math.max(p[3], h[3]); } else H.push([...h]); }
  const segs = []; let pa = 0, pb = 0;
  for (const [as, ae, bs, be] of H) {
    if (A.slice(pa, as) !== B.slice(pb, bs)) throw new Error('common mismatch');
    if (as > pa) segs.push({ t: 'c', a: pa, b: pb, len: as - pa });
    segs.push({ t: 'x', as, ae, bs, be });
    pa = ae; pb = be;
  }
  if (A.slice(pa) !== B.slice(pb)) throw new Error('tail mismatch');
  segs.push({ t: 'c', a: pa, b: pb, len: A.length - pa });
  return segs;
}

/* ---------- render ---------- */
const lineStart = (T, p) => T.lastIndexOf('\n', p - 1) + 1;
const lineEnd = (T, p) => { const e = T.indexOf('\n', p); return e < 0 ? T.length : e; };
// physical units: {text, cont, s, e, o ('A'|'B'), s2 (B pos for common)}
function pieces(I, s, e, extra) {
  const T = I.T, out = [];
  let p = s;
  while (p < e) {
    const le = Math.min(lineEnd(T, p), e), ls = lineStart(T, p), full = lineEnd(T, p) - ls;
    const atStart = p === ls;
    const lead = (T.slice(ls).match(/^ */) || [''])[0].length;
    const ind = q => ' '.repeat(Math.max(lead + 2, 2 + 2 * Math.max(0, I.depthAt[q] - 2)));
    const cuts = [];
    if (full > MAXW) {
      for (let q = p + 1; q < le; q++) {
        const b = I.brk.get(q); if (!b) continue;
        if (b.kind === 'comma' && I.depthAt[q] !== 2) continue;
        cuts.push(q);
      }
    }
    // second pass: still-long chunks get commas one level deeper
    const bounds = [p, ...cuts, le];
    const fin = [];
    for (let k = 0; k + 1 < bounds.length; k++) {
      const a = bounds[k], b = bounds[k + 1];
      fin.push(a);
      if (b - a > MAXW + 40) {
        const d0 = I.depthAt[a];
        for (let q = a + 1; q < b - 30; q++) { const x = I.brk.get(q); if (x && x.kind === 'comma' && I.depthAt[q] === d0 + 1 && q - fin[fin.length - 1] > 60) fin.push(q); }
      }
    }
    fin.push(le);
    for (let k = 0; k + 1 < fin.length; k++) {
      const a = fin[k], b = fin[k + 1];
      if (a === b) continue;
      const first = a === p;
      const close = I.brk.get(a) && I.brk.get(a).kind === 'close';
      let text = T.slice(a, b);
      if (!(first && atStart)) text = (close ? ind(a).slice(2) : ind(a)) + text;
      const last = k + 2 === fin.length;
      out.push({ text, cont: !(last && le < e) && !(last && le === e && (T[e] === '\n')), s: a, e: b, o: I === IA ? 'A' : 'B', ...extra(a) });
    }
    if (le < e) p = le + 1; else p = e;
  }
  // a piece that ends exactly at a newline inside [s,e) was handled by cont=false; one ending at e mid-line continues
  return out;
}
function render() {
  const segs = segments(), units = [];
  for (const g of segs) {
    if (g.t === 'c') units.push(...pieces(IA, g.a, g.a + g.len, a => ({ sb: a - g.a + g.b })));
    else {
      units.push({ dir: `///#if ${VB}` });
      units.push(...pieces(IB, g.bs, g.be, () => ({})));
      units.push({ dir: '///#else' });
      units.push(...pieces(IA, g.as, g.ae, () => ({})));
      units.push({ dir: '///#endif' });
    }
  }
  // fix cont: a unit continues when its text does not end at a real newline of its origin
  for (const u of units) if (!u.dir) { const T = u.o === 'A' ? A : B; u.cont = T[u.e] !== '\n';
    if (u.cont && !u.text.trim()) throw new Error('blank continued unit at ' + u.o + u.s);
    if (/^\s*\/\/\//.test(u.text)) throw new Error('unit starts with /// at ' + u.o + u.s); }
  return units;
}

/* ---------- annotations and files ---------- */
function place(units) {
  const at = (u, o, p) => !u.dir && (u.o === o ? p >= u.s && p < u.e : (o === 'B' && u.sb !== undefined && p >= u.sb && p < u.sb + (u.e - u.s)));
  const find = (needle, where) => {
    const o = where || (A.split(needle).length === 2 ? 'A' : 'B'), T = o === 'A' ? A : B;
    if (T.split(needle).length !== 2) throw new Error(`anchor not unique in ${o}: ${needle.slice(0, 60)} (${T.split(needle).length - 1})`);
    const p = T.indexOf(needle);
    const i = units.findIndex(u => at(u, o, p));
    if (i < 0) throw new Error('anchor unit not found ' + needle.slice(0, 50));
    return i;
  };
  const pre = new Map(); // unit index -> comment lines
  for (const n of NOTES) {
    const i = find(n.at, n.in);
    const lead = units[i].text.match(/^ */)[0];
    const lines = n.text.trim().split('\n').map(l => lead + '/// ' + l.trim()).map(l => l.trimEnd());
    pre.set(i, [...(pre.get(i) || []), ...lines]);
  }
  const fileAt = new Map();
  for (const f of FILES) {
    let i = f.at === null ? 0 : find(f.at, f.in || 'A');
    if (i && units[i - 1].dir && units[i - 1].dir.startsWith('///#if')) i--;
    if (i && units[i - 1].cont) throw new Error('file split inside a continued line: ' + f.name);
    fileAt.set(i, f);
  }
  const files = []; let cur = null;
  units.forEach((u, i) => {
    if (fileAt.has(i)) { const f = fileAt.get(i); cur = { name: f.name, lines: f.head.trim().split('\n').map(l => ('/// ' + l.trim()).trimEnd()) }; cur.lines.push('///'); files.push(cur); }
    for (const l of pre.get(i) || []) cur.lines.push(l);
    cur.lines.push(u.dir || (u.text + (u.cont ? '///' : '')));
  });
  return files;
}

const units = render();
const files = place(units);
const outDir = DRY ? fs.mkdtempSync(path.join(os.tmpdir(), 'lightning-src-')) : path.join(REPO, 'tools/lightning/src');
for (const n of fs.readdirSync(outDir)) if (n.endsWith('.js')) fs.unlinkSync(path.join(outDir, n));
for (const f of files) fs.writeFileSync(path.join(outDir, f.name), f.lines.join('\n') + '\n');
const { assemble } = await import(path.join(REPO, 'tools/lightning/build.mjs'));
const ga = assemble({ variant: VA, gen: GA, variants: [VA, VB], srcDir: outDir }), gb = assemble({ variant: VB, gen: GB, variants: [VA, VB], srcDir: outDir });
const okA = ga === rd(GA), okB = gb === rd(GB);
const firstDiff = (x, y) => { let i = 0; while (i < x.length && x[i] === y[i]) i++; return i; };
console.log(JSON.stringify({ outDir, files: files.map(f => [f.name, f.lines.length]), okA, okB,
  diffA: okA ? null : [firstDiff(ga, rd(GA)), JSON.stringify(ga.slice(firstDiff(ga, rd(GA)) - 40, firstDiff(ga, rd(GA)) + 40)), JSON.stringify(rd(GA).slice(firstDiff(ga, rd(GA)) - 40, firstDiff(ga, rd(GA)) + 40))],
  diffB: okB ? null : [firstDiff(gb, rd(GB)), JSON.stringify(gb.slice(firstDiff(gb, rd(GB)) - 40, firstDiff(gb, rd(GB)) + 40)), JSON.stringify(rd(GB).slice(firstDiff(gb, rd(GB)) - 40, firstDiff(gb, rd(GB)) + 40))] }));
if (!okA || !okB) process.exit(1);
