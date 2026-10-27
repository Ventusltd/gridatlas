#!/usr/bin/env node
// kv-vogel: Build I's lightning module drawn as a Kuiper-Vogel sunflower.
// Usage: node -I tools/vogel.mjs <module.js> <cartridge.js> <outdir> [atlasRoot]
// Bodies = every function/closure in the module (first appearance order) + named cartridge bodies.
// Placement (kuiper-belt README "Acknowledgements"; globalgrid2050 wafer_keys.py:80):
//   item n (1-based)  ->  r = sqrt(n),  theta = 2*pi*frac(n * 2654435769 / 2^32)   (one golden-angle turn per item)
// Stable id = "kv:" + hex8( fnv1a32(qualified name) * 2654435769 mod 2^32 )  (Fibonacci hashing, Knuth 6.4)
// Key (first law) = SHA-256 of the body's source bytes.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';
const require = createRequire('/opt/node-tools/node_modules/_.js');
const acorn = require('acorn');
const escope = require('eslint-scope');

const [MODP, CARTP, OUT, ATLAS] = process.argv.slice(2);
if (!MODP || !CARTP || !OUT) { console.error('usage: vogel.mjs <module> <cartridge> <outdir> [atlasRoot]'); process.exit(2); }
const G = 2654435769n, M32 = 1n << 32n;
const sha256 = s => createHash('sha256').update(s).digest('hex');
const fnv1a = s => { let h = 0x811c9dc5; for (const b of Buffer.from(s, 'utf8')) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
const fib32 = k => Number((BigInt(k) * G) % M32);
const hex8 = n => n.toString(16).padStart(8, '0');

// ---------------------------------------------------------------- parsing helpers
const FN = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration']);
function parse(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, ranges: true, allowHashBang: true });
  const P = new WeakMap(), all = [];
  (function rec(n, p) {
    if (!n || typeof n.type !== 'string') return;
    P.set(n, p); all.push(n);
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'range') continue;
      const v = n[k];
      if (Array.isArray(v)) for (const c of v) rec(c, n); else if (v && typeof v.type === 'string') rec(v, n);
    }
  })(ast, null);
  return { ast, P, all, src };
}
const txt = (F, n) => F.src.slice(n.start, n.end);
const short = s => s.replace(/\s+/g, ' ').slice(0, 90);

// ---------------------------------------------------------------- module bodies
const modSrc = readFileSync(MODP, 'utf8'), cartSrc = readFileSync(CARTP, 'utf8');
const MF = parse(modSrc);
const fnNodes = MF.all.filter(n => FN.has(n.type)).sort((a, b) => a.start - b.start);
const root = fnNodes[0];
const bodyOfNode = new Map();
const bodies = [];
function enclosing(F, n, set) { let p = F.P.get(n); while (p && !set.has(p)) p = F.P.get(p); return p || null; }
const fnSet = new Set(fnNodes);
function calleeHint(F, call) {
  const c = call.callee;
  let h = c.type === 'MemberExpression' ? '.' + (c.property.name || c.property.value) : c.type === 'Identifier' ? c.name : 'call';
  const a0 = call.arguments[0];
  if (a0 && a0.type === 'Literal' && typeof a0.value === 'string' && /addEventListener|^\.on$/.test(h)) h += `('${a0.value}')`;
  return (call.type === 'NewExpression' ? 'new ' : '') + h;
}
function objLabel(F, obj) {
  const p = F.P.get(obj);
  if (p && p.type === 'VariableDeclarator') return p.id.name;
  if (p && p.type === 'CallExpression') { const q = F.P.get(p); if (q && q.type === 'AssignmentExpression') return txt(F, q.left); }
  return '{}';
}
function localName(F, fn) {
  const p = F.P.get(fn);
  if (fn.id && fn.id.name) return fn.id.name;
  if (!p) return 'λ';
  if (p.type === 'VariableDeclarator' && p.init === fn) return p.id.name;
  if (p.type === 'Property' && p.value === fn) return objLabel(F, F.P.get(p)) + '.' + (p.key.name || p.key.value);
  if (p.type === 'AssignmentExpression' && p.right === fn) return txt(F, p.left);
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.callee === fn) return 'IIFE';
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.arguments.includes(fn)) return 'λ' + calleeHint(F, p);
  return 'λ@L' + fn.loc.start.line;
}
const seen = new Map();
for (const fn of fnNodes) {
  const parent = fn === root ? null : bodyOfNode.get(enclosing(MF, fn, fnSet));
  let local = fn === root ? 'module(IIFE)' : localName(MF, fn);
  let q = !parent || parent.node === root ? local : parent.qname + '›' + local;
  const k = (seen.get(q) || 0) + 1; seen.set(q, k); if (k > 1) q += '#' + k;
  const s = txt(MF, fn);
  const b = { node: fn, file: 'module', qname: q, label: q, line: fn.loc.start.line, col: fn.loc.start.column + 1, bytes: Buffer.byteLength(s), key: sha256(s), parent, top: null };
  bodyOfNode.set(fn, b); bodies.push(b);
}
for (const b of bodies) { let t = b; while (t.parent && t.parent.node !== root) t = t.parent; b.top = b.node === root ? 'module(IIFE)' : t.qname; }

// ---------------------------------------------------------------- cartridge bodies (declared selection, all located by parse)
const CF = parse(cartSrc);
const CART_DECL = ['nearestTransmission', 'distanceKm', 'deepLinkPlan', 'loadSubstations', 'nearestSubstations', 'addCardBar', 'ensureLayers', 'startAnimation', 'clearLinks', 'drawLinks', 'setPin', 'selectAt', 'runDeepLink', 'attemptArrival'];
const cartNodes = [];
for (const n of CF.all) {
  if (n.type === 'FunctionDeclaration' && CART_DECL.includes(n.id.name)) cartNodes.push({ n, name: n.id.name });
  if (n.type === 'FunctionDeclaration' && n.id.name === 'install' && /Warm the substation payload immediately/.test(txt(CF, n))) cartNodes.push({ n, name: 'install(map)' });
  if (n.type === 'VariableDeclarator' && n.id.name === 'link' && n.init && n.init.type === 'ObjectExpression' && /schema: 'gridatlas.neon-substation-links.v1'/.test(txt(CF, n.init))) cartNodes.push({ n, name: 'link (window.__GRIDATLAS_NEON_LINKS__)' });
  if (FN.has(n.type) && !n.id) {
    const p = CF.P.get(n);
    if (p && p.type === 'CallExpression' && p.callee.type === 'MemberExpression' && p.callee.property.name === 'on' && p.arguments[0]?.value === 'click' && /fromOwnUi\(event\)/.test(txt(CF, n)) && /selectAt\(/.test(txt(CF, n))) cartNodes.push({ n, name: "engine map.on('click')" });
    if (p && p.type === 'NewExpression' && p.callee.name === 'MutationObserver' && /links_drawn > 0 && !document\.querySelector\('\.maplibregl-popup'\)\) clearLinks/.test(txt(CF, n))) cartNodes.push({ n, name: 'popupWatcher' });
  }
}
cartNodes.sort((a, b) => a.n.start - b.n.start);
const topStmt = (F, n) => { let c = n, p = F.P.get(n); while (p && p.type !== 'Program') { c = p; p = F.P.get(p); } return c; };
const cartSeen = new Map();
for (const { n, name } of cartNodes) {
  const k = (cartSeen.get(name) || 0) + 1; cartSeen.set(name, k);
  const s = txt(CF, n);
  const b = { node: n, file: 'cartridge', qname: 'cartridge:' + name + (k > 1 ? '#' + k : ''), label: name + (k > 1 ? ' #' + k : '') + ' (cartridge L' + n.loc.start.line + ')', name, line: n.loc.start.line, col: n.loc.start.column + 1, bytes: Buffer.byteLength(s), key: sha256(s), top: null, stmt: topStmt(CF, n) };
  bodyOfNode.set(n, b); bodies.push(b);
}
const cartBodies = bodies.filter(b => b.file === 'cartridge');
const cartByName = n => cartBodies.filter(b => b.name === n);
const LINKB = cartByName('link (window.__GRIDATLAS_NEON_LINKS__)')[0];

// ids, positions
const ids = new Map();
bodies.forEach((b, i) => {
  b.n = i + 1;
  b.fib = fib32(fnv1a(b.qname));
  b.id = 'kv:' + hex8(b.fib);
  if (ids.has(b.id)) { console.error('REFUSED: Fibonacci id collision', b.qname, ids.get(b.id)); process.exit(3); }
  ids.set(b.id, b.qname);
  b.theta = 2 * Math.PI * (Number((BigInt(b.n) * G) % M32) / 2 ** 32);
  b.r = Math.sqrt(b.n);
});

// ---------------------------------------------------------------- resources and edges
const res = new Map(); // id -> {id,label,type}
const R = (id, type, label) => { if (!res.has(id)) res.set(id, { id, type, label: label || id }); return id; };
const edges = []; const ekey = new Set();
function E(from, to, type, ev, extra = {}) {
  const k = from + '|' + to + '|' + type + '|' + (extra.via || '') + '|' + (extra.prop || '');
  if (ekey.has(k)) { const e = edges.find(x => x.k === k); if (ev && e.evidence.lines.indexOf(ev.line) < 0) e.evidence.lines.push(ev.line); return; }
  ekey.add(k);
  edges.push({ k, from, to, type, ...extra, evidence: { file: ev.file, lines: [ev.line], snippet: ev.snippet } });
}
const evM = n => ({ file: basename(MODP), line: n.loc.start.line, snippet: short(txt(MF, n)) });
const evC = n => ({ file: basename(CARTP), line: n.loc.start.line, snippet: short(txt(CF, n)) });
const bodyAt = (F, n) => bodyOfNode.get(FN.has(n.type) && bodyOfNode.has(n) ? n : enclosingBody(F, n));
function enclosingBody(F, n) { let p = F.P.get(n); while (p && !bodyOfNode.has(p)) p = F.P.get(p); return p; }
const encB = (F, n) => bodyOfNode.get(enclosingBody(F, n));

// scope resolution (module)
const sm = escope.analyze(MF.ast, { ecmaVersion: 2022, sourceType: 'script' });
const refOf = new Map(); const varBody = new Map(); const varInit = new Map();
for (const sc of sm.scopes) {
  for (const v of sc.variables) for (const d of v.defs) if (d.type === 'Variable' && d.node.init) { varInit.set(v, d.node.init); if (bodyOfNode.has(d.node.init)) varBody.set(v, bodyOfNode.get(d.node.init)); }
  for (const r of sc.references) refOf.set(r.identifier, r);
}
const rootScopeVar = name => { const s = sm.acquire(root); return s && s.variables.find(v => v.name === name); };
const S_VAR = rootScopeVar('S'), LRU_VAR = rootScopeVar('lru'), NS_VAR = rootScopeVar('NS');
const resolved = id => refOf.get(id)?.resolved || null;

// constant evaluator for layer/source ids (module)
function evalIds(n, ctx) {
  if (!n) return [];
  if (n.type === 'Literal' && typeof n.value === 'string') return [n.value];
  if (n.type === 'TemplateLiteral' && !n.expressions.length) return [n.quasis[0].value.cooked];
  if (n.type === 'ArrayExpression') return n.elements.flatMap(e => evalIds(e, ctx));
  if (n.type === 'BinaryExpression' && n.operator === '+') { const a = evalIds(n.left, ctx), b = evalIds(n.right, ctx); return a.flatMap(x => b.map(y => x + y)); }
  if (n.type === 'MemberExpression' && n.computed && n.property.type === 'Literal') { const a = evalIds(n.object, ctx); return a[n.property.value] !== undefined ? [a[n.property.value]] : []; }
  if (n.type === 'Identifier') {
    const v = resolved(n);
    if (v) { const d = v.defs[0]; if (d && d.type === 'Variable') {
      const decl = MF.P.get(d.node), loop = decl && MF.P.get(decl);
      if (loop && loop.type === 'ForOfStatement' && loop.left === decl) return evalIds(loop.right, ctx);
      if (d.node.init && decl.kind === 'const') return evalIds(d.node.init, ctx);
    } }
  }
  return [];
}
const layerType = id => /^l-|-(hit|count|glow|core|node|label)$/.test(id) ? 'layer' : 'source';

const MUT = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'set', 'delete', 'clear', 'remove', 'add', 'sort']);
const DOMPROPS = new Set(['textContent', 'innerHTML', 'cssText', 'hidden', 'disabled', 'value', 'checked', 'min', 'max', 'title', 'className', 'type', 'gridColumn', 'maxHeight', 'left', 'top', 'paddingBottom', 'paddingRight', 'background', 'borderColor', 'opacity', 'display', 'out', 'll']);
const DOMCALLS = new Set(['appendChild', 'setAttribute', 'removeAttribute', 'toggle', 'insertBefore', 'removeChild']);
const SURFACE = { tap: 'dom:lightning-card', pc: 'dom:lightning-card', cpos: 'dom:lightning-card', nr: 'dom:lightning-card', near: 'dom:lightning-card', el: 'dom:created-element',
  bg: 'dom:layers-panel', pt: 'dom:layers-panel', txt: 'dom:layers-panel', flag: 'dom:layers-panel', nv: 'dom:layers-panel', fit: 'dom:layers-panel', ins: 'dom:layers-panel', so: 'dom:layers-panel', bt: 'dom:layers-panel' };
const surfaceOf = b => SURFACE[b.top] || 'dom:other';
const VALUE_CB = new Set(['then', 'catch', 'map', 'filter', 'find', 'some', 'every', 'reduce', 'sort', 'flatMap', 'from', 'finally']);
// one event node per registration site, except the map: module and cartridge handlers share the one map's events
const EVENT_REG = c => {
  const at = '@L' + c.loc.start.line;
  if (c.type === 'NewExpression' && /^(MutationObserver|ResizeObserver)$/.test(c.callee.name)) return 'event:' + c.callee.name + at;
  if (c.type !== 'CallExpression') return null;
  const f = c.callee, a0 = c.arguments[0];
  if (f.type === 'Identifier' && f.name === 'setInterval') return 'event:setInterval' + at;
  if (f.type === 'Identifier' && f.name === 'addEventListener') return 'event:window.' + (evalIds(a0).join('|') || '?') + at;
  if (f.type === 'MemberExpression' && f.property.name === 'addEventListener') return 'event:dom.' + (a0 && a0.value || '?') + '(' + txt(MF, f.object) + ')' + at;
  if (f.type === 'MemberExpression' && f.property.name === 'on' && a0 && a0.type === 'Literal') return 'event:map.' + a0.value;
  return null;
};
const usedIn = (F, call) => { let n = call, p = F.P.get(n); while (p && (p.type === 'AwaitExpression' || p.type === 'ChainExpression')) { n = p; p = F.P.get(p); } if (!p || p.type === 'ExpressionStatement') return false; if (p.type === 'UnaryExpression' && p.operator === 'void') return false; return true; };
const used = call => { const p = MF.P.get(call); if (!p) return false; if (!usedIn(MF, call)) return false; if (p.type === 'UnaryExpression' && p.operator === 'void') return false;
  if (p.type === 'SequenceExpression' && p.expressions[p.expressions.length - 1] !== call) return false; if (p.type === 'ForStatement' && p.update === call) return false; return true; };

const B = n => bodyOfNode.get(n);
// 1. closures as call/callback/event/export targets
for (const b of bodies.filter(b => b.file === 'module' && b.node !== root)) {
  const fn = b.node, p = MF.P.get(fn), from = b.parent || B(root);
  if (p.type === 'VariableDeclarator') continue; // named; reached through references
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.callee === fn) { E(from.id, b.id, 'calls', evM(p), { via: 'IIFE', value_used: used(p) }); continue; }
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.arguments.includes(fn)) {
    const ev = EVENT_REG(p);
    if (ev) { R(ev, 'event'); E(from.id, ev, 'registers', evM(p)); E(ev, b.id, 'calls', evM(p), { via: 'event' }); continue; }
    const h = calleeHint(MF, p).replace(/^new /, '');
    E(from.id, b.id, 'calls', evM(p), { via: 'callback ' + h, value_used: VALUE_CB.has(h.replace(/^\./, '')) || h === 'Promise', has_args: true });
    continue;
  }
  if (p.type === 'Property') { E(from.id, b.id, 'exports', evM(p)); continue; }
  if (p.type === 'AssignmentExpression') { E(from.id, b.id, 'calls', evM(p), { via: 'handler ' + txt(MF, p.left) }); continue; }
  E(from.id, b.id, 'calls', evM(fn), { via: 'inline' });
}
// 2. identifier references to named bodies
for (const [id, r] of refOf) {
  const v = r.resolved; if (!v || !varBody.has(v)) continue;
  const tgt = varBody.get(v), from = encB(MF, id); if (!from) continue;
  const p = MF.P.get(id);
  if (p.type === 'VariableDeclarator' && p.id === id) continue;
  if (p.type === 'CallExpression' && p.callee === id) { E(from.id, tgt.id, 'calls', evM(p), { value_used: used(p), has_args: p.arguments.length > 0 }); continue; }
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.arguments.includes(id)) {
    const ev = EVENT_REG(p);
    if (ev) { R(ev, 'event'); E(from.id, ev, 'registers', evM(p)); E(ev, tgt.id, 'calls', evM(p), { via: 'event' }); continue; }
    const h = calleeHint(MF, p).replace(/^new /, '');
    E(from.id, tgt.id, 'calls', evM(p), { via: 'callback ' + h, value_used: VALUE_CB.has(h.replace(/^\./, '')), has_args: true }); continue;
  }
  if (p.type === 'Property' && p.value === id) { E(from.id, tgt.id, 'exports', evM(p)); continue; }
  E(from.id, tgt.id, 'calls', evM(p), { via: 'reference', value_used: true });
}
// 3. member accesses: S.*, lru, window.*, NS.*, neon alias, map ops, DOM writes
const access = n => { const p = MF.P.get(n), g = p && MF.P.get(p);
  if (p.type === 'AssignmentExpression' && p.left === n) return p.operator === '=' ? 'w' : 'rw';
  if (p.type === 'UpdateExpression') return 'rw';
  if (p.type === 'UnaryExpression' && p.operator === 'delete') return 'w';
  if (p.type === 'MemberExpression' && p.object === n && g && g.type === 'CallExpression' && g.callee === p && MUT.has(p.property.name)) return 'rw';
  if (p.type === 'MemberExpression' && p.object === n && g && g.type === 'AssignmentExpression' && g.left === p) return 'rw';
  return 'r'; };
const neonAlias = new Set(), dkAlias = new Set();
for (const [v, init] of varInit) { const t = txt(MF, init); if (/window\.__GRIDATLAS_NEON_LINKS__/.test(t) && v.defs[0].node.init === init && !/measure/.test(t)) neonAlias.add(v); if (/measure\.distanceKm/.test(t)) dkAlias.add(v); }
const MAPW = new Set(['addSource', 'removeSource', 'addLayer', 'removeLayer', 'setLayoutProperty', 'setData']), MAPR = new Set(['getSource', 'getLayer', 'queryRenderedFeatures', 'getClusterExpansionZoom']);
const CAM_W = new Set(['easeTo', 'fitBounds', 'flyTo', 'jumpTo']), CAM_R = new Set(['project', 'getBounds']);
for (const n of MF.all) {
  const b = encB(MF, n); if (!b) continue;
  if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && !n.computed) {
    const v = resolved(n.object), prop = n.property.name, a = access(n);
    if (v && v === S_VAR) { const id = R('state:S.' + prop, 'state'); if (a.includes('r')) E(b.id, id, 'reads', evM(n)); if (a.includes('w')) E(b.id, id, 'writes', evM(n)); }
    else if (v && v === LRU_VAR) { const id = R('state:lru', 'state', 'state:lru (day-file promise cache)'); const g = MF.P.get(n); const m = prop; if (/^(set|delete|clear)$/.test(m)) E(b.id, id, 'writes', evM(g)); else E(b.id, id, 'reads', evM(g)); }
    else if (v && v === NS_VAR) { const id = R('global:__GRIDATLAS_MODULES__.' + prop, 'global'); if (a.includes('r')) E(b.id, id, 'reads', evM(n)); if (a.includes('w')) E(b.id, id, 'writes', evM(n)); }
    else if (v && neonAlias.has(v)) E(b.id, LINKB.id, 'reads', evM(n), { prop: 'link.' + prop });
    else if (!v && n.object.name === 'window' && /^__GRIDATLAS_/.test(prop)) {
      if (prop === '__GRIDATLAS_NEON_LINKS__') E(b.id, LINKB.id, 'reads', evM(n), { prop: 'window.__GRIDATLAS_NEON_LINKS__' });
      else { const id = R('global:' + prop, 'global'); if (a.includes('r')) E(b.id, id, 'reads', evM(n)); if (a.includes('w')) E(b.id, id, 'writes', evM(n)); }
    }
  }
  if (n.type === 'CallExpression' && n.callee.type === 'Identifier') {
    const v = resolved(n.callee);
    if (v && dkAlias.has(v)) E(b.id, cartByName('distanceKm')[0].id, 'calls', evM(n), { via: 'link.measure.distanceKm', value_used: true, has_args: true });
    if (!v && n.callee.name === 'fetch') E(b.id, R('net:fetch()', 'net'), 'fetches', evM(n));
    if (v && (varBody.get(v)?.qname === 'gj' || varBody.get(v)?.qname === 'gx')) {
      let a0 = n.arguments[0], t = txt(MF, a0);
      if (a0.type === 'Identifier') { const av = resolved(a0); if (av && varInit.has(av)) t = txt(MF, varInit.get(av)); }
      const fam = /index\.json/.test(t) ? 'net:lightning/data/history/index.json' : /path/.test(t) ? 'net:lightning/data/history/days/YYYY/MM/DD[/HH].json' : /FEED/.test(t) ? 'net:lightning/data/uk_lightning.geojson' : 'net:?';
      E(b.id, R(fam, 'net'), 'fetches', evM(n), { via: varBody.get(v).qname });
    }
  }
  if (n.type === 'NewExpression' && n.callee.name === 'XMLHttpRequest') E(b.id, R('net:XMLHttpRequest', 'net'), 'fetches', evM(n));
  if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed) {
    const m = n.callee.property.name, obj = n.callee.object;
    const isMap = (obj.type === 'Identifier' && obj.name === 'm') || (obj.type === 'CallExpression' && obj.callee.type === 'MemberExpression' && obj.callee.property.name === 'getSource');
    if (isMap && (MAPW.has(m) || MAPR.has(m))) {
      let idsx = [];
      if (m === 'addLayer') { const o = n.arguments[0]; const pid = o && o.properties && o.properties.find(p => p.key.name === 'id'); idsx = pid ? evalIds(pid.value) : []; }
      else if (m === 'queryRenderedFeatures') { const o = n.arguments[1]; const pl = o && o.properties && o.properties.find(p => p.key.name === 'layers'); idsx = pl ? evalIds(pl.value) : []; }
      else if (m === 'setData' || m === 'getClusterExpansionZoom') idsx = evalIds(obj.arguments[0]);
      else idsx = evalIds(n.arguments[0]);
      for (const id of idsx) { const rid = R(layerType(id) + ':' + id, 'map'); E(b.id, rid, MAPW.has(m) ? 'writes' : 'reads', evM(n), { via: 'map.' + m }); }
      if (!idsx.length) E(b.id, R('map:?', 'map'), MAPW.has(m) ? 'writes' : 'reads', evM(n), { via: 'map.' + m });
    }
    if (obj.type === 'Identifier' && obj.name === 'm' && CAM_W.has(m)) E(b.id, R('map:camera', 'map'), 'writes', evM(n), { via: 'map.' + m });
    if (obj.type === 'Identifier' && obj.name === 'm' && CAM_R.has(m)) E(b.id, R('map:camera', 'map'), 'reads', evM(n), { via: 'map.' + m });
    if (obj.type === 'CallExpression' && obj.callee.name === 'mh' && CAM_R.has(m)) E(b.id, R('map:camera', 'map'), 'reads', evM(n), { via: 'map.' + m });
    if (DOMCALLS.has(m) || (m === 'remove' && txt(MF, obj) === 'S.pp')) E(b.id, R(surfaceOf(b), 'dom'), 'dom_write', evM(n), { via: '.' + m });
  }
  if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression') {
    const lt = txt(MF, n.left), last = n.left.property.name;
    if (/^S\./.test(lt) && !/^S\.(pp)\./.test(lt)) continue;
    if (DOMPROPS.has(last) || /\.style\.|\.dataset\./.test(lt)) { if (/^(x|w|r)\./.test(lt)) continue; E(b.id, R(surfaceOf(b), 'dom'), 'dom_write', evM(n), { via: lt.replace(/\s+/g, '') }); }
  }
}

// ---------------------------------------------------------------- cartridge edges among selected bodies
const cartNames = new Set(cartBodies.map(b => b.name));
const cartConst = new Map();
for (const n of CF.all) if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && n.init.type === 'Literal' && typeof n.init.value === 'string') { const k = n.id.name + '@' + topStmt(CF, n).start; cartConst.set(k, n.init.value); }
function cartPick(name, at) { const c = cartByName(name); if (c.length < 2) return c[0]; const st = topStmt(CF, at); return c.find(b => b.stmt === st) || c[0]; }
for (const b of cartBodies) {
  const stack = [b.node];
  (function rec(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n !== b.node && bodyOfNode.has(n)) return; // nested selected body owns its own subtree
    if (n.type === 'CallExpression') {
      const c = n.callee;
      if (c.type === 'Identifier' && cartNames.has(c.name) && c.name !== b.name) E(b.id, cartPick(c.name, n).id, 'calls', evC(n), { value_used: usedIn(CF, n), has_args: n.arguments.length > 0 });
      if (c.type === 'Identifier' && c.name === b.name && b.name !== 'nearestTransmission') E(b.id, b.id, 'calls', evC(n), { via: 'recursion' });
      if (c.type === 'MemberExpression' && c.object.name === 'DECLARED' && c.property.name === 'nearestTransmission') E(b.id, cartByName('nearestTransmission')[0].id, 'calls', evC(n), { via: 'DECLARED.nearestTransmission' });
      if (c.type === 'Identifier' && c.name === 'setSourceData' && n.arguments[1]?.type === 'Identifier') { const k = n.arguments[1].name + '@' + topStmt(CF, n).start; const v = cartConst.get(k); if (v) E(b.id, R('source:' + v, 'map'), 'writes', evC(n), { via: 'setSourceData' }); }
      if (c.type === 'Identifier' && c.name === 'fetch') E(b.id, R('net:atlas/data/grid_substations.geojson', 'net'), 'fetches', evC(n));
      if (c.type === 'MemberExpression' && /^(fitBounds|flyTo|easeTo|jumpTo)$/.test(c.property.name)) E(b.id, R('map:camera', 'map'), 'writes', evC(n), { via: 'map.' + c.property.name });
    }
    if (n.type === 'Identifier' && cartNames.has(n.name) && n.name !== b.name) { const p = CF.P.get(n); if (p && !(p.type === 'CallExpression' && p.callee === n) && !(p.type === 'MemberExpression' && p.property === n) && !(p.type === 'Property' && p.key === n) && p.type !== 'FunctionDeclaration') E(b.id, cartPick(n.name, n).id, 'calls', evC(n), { via: 'reference ' + short(txt(CF, p)).slice(0, 40) }); }
    if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'link' && !n.computed && b !== LINKB) {
      const p = CF.P.get(n), w = (p.type === 'AssignmentExpression' && p.left === n) || (p.type === 'UpdateExpression');
      E(b.id, LINKB.id, w ? 'writes' : 'reads', evC(n), { prop: 'link.' + n.property.name });
    }
    for (const k of Object.keys(n)) { if (k === 'loc' || k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(rec); else if (v && typeof v.type === 'string') rec(v); }
  })(b.node);
}
// cartridge event registrations for the two anonymous bodies
for (const b of cartBodies) {
  const p = CF.P.get(b.node);
  if (b.name === "engine map.on('click')") E(R('event:map.click', 'event'), b.id, 'calls', evC(p), { via: 'event (cartridge, registered after the engine click handler)' });
  if (b.name === 'popupWatcher') E(R('event:MutationObserver(map container)', 'event'), b.id, 'calls', evC(p), { via: 'event' });
}
// the cartridge's deep-link entry is fired by the boot/visibility path
E(cartByName('attemptArrival')[0].id, cartByName('runDeepLink')[0].id, 'calls', evC(cartByName('attemptArrival')[0].node), { via: 'rerunDeepLink binding (L6895) / attempt' });

// ---------------------------------------------------------------- declared edges: should_call and duplicates (owner expectation; printed in rules)
const mb = q => bodies.find(b => b.qname === q);
const DECLARED = [
  ['nr', 'cartridge:nearestSubstations', 'should_call', 'link.measure.nearestSubstations is public (cartridge L3584): >=33 kV (MIN_KV L1663), 5 links (LINK_COUNT L1664), 40 km draw radius (MAX_LINK_KM L1665). nr re-implements it with kv[0]>=132, 3 links, no radius (module L156).'],
  ['nr', 'cartridge:nearestSubstations', 'duplicates', 'same nearest-N-by-distanceKm loop with different constants (module L156 vs cartridge L3513-3541)'],
  ['nr', 'cartridge:drawLinks', 'duplicates', 'Lightning-owned glow/core/node/label layers "styled like the originals" (module L151, L158-163) vs drawLinks/ensureLayers (cartridge L4522, L4308); strength 0.62-i*0.10 copied (module L158 vs cartridge L4535)'],
  ['near', 'map:camera', 'should_write', 'no framing after NEAREST: drawLinks frames the declared link with fitBounds (cartridge L4594-4600); module near() only repositions the card (module L163)'],
  ['nr', 'cartridge:nearestTransmission', 'duplicates', 'third "transmission" threshold: module kv>=132 (L156) vs nearestTransmission kv>=400 (cartridge L631) vs MIN_KV 33 (L1663)'],
  ['tap', 'cartridge:addCardBar', 'duplicates', 'Lightning re-implements the card (module L145-149) instead of the original card bar (cartridge L3950); owner expects the original card bar'],
  ['cartridge:nearestTransmission#2', 'cartridge:nearestTransmission', 'duplicates', 'two declarations named nearestTransmission (cartridge L623 and L1975); the second delegates'],
];
for (const [f, t, type, why] of DECLARED) {
  const fb = mb(f), tb = t.startsWith('map:') ? null : mb(t), tid = tb ? tb.id : R(t, 'map');
  if (!fb || (!tb && !t.startsWith('map:'))) { console.error('REFUSED: declared edge endpoint missing', f, t); process.exit(4); }
  edges.push({ from: fb.id, to: tid, type, declared: true, evidence: { file: 'declared (rules.txt)', lines: [], snippet: why } });
}

// ---------------------------------------------------------------- analysis
const nodeIds = new Set([...bodies.map(b => b.id), ...res.keys()]);
for (const e of edges) if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) { console.error('REFUSED: dangling edge', e.from, e.to); process.exit(5); }
const byId = new Map(bodies.map(b => [b.id, b]));
const lbl = id => byId.get(id)?.qname || id;
const real = edges.filter(e => !e.declared);
// flow graph
const out = new Map(), inn = new Map(); const add = (m, k, v) => (m.get(k) || m.set(k, []).get(k)).push(v);
// the neon links object is one body, but data flows per property: link.substations has one writer (loadSubstations)
const flowTo = e => e.to === LINKB.id && e.prop ? (/^link\./.test(e.prop) ? LINKB.id + '#' + e.prop.split('.').slice(0, 2).join('.') : null) : e.to;
for (const e of real) {
  const to = flowTo(e); if (to === null) continue;
  if (e.type === 'calls') { add(out, e.from, { to, k: 'call' }); add(inn, to, { from: e.from, k: 'call', vu: !!e.value_used, args: !!e.has_args }); }
  else if (e.type === 'registers') { add(out, e.from, { to, k: 'call' }); add(inn, to, { from: e.from, k: 'call', vu: false, args: false }); }
  else if (e.type === 'writes' || e.type === 'dom_write') { add(out, e.from, { to, k: 'write' }); add(inn, to, { from: e.from, k: 'write' }); }
  else if (e.type === 'reads' || e.type === 'fetches') { add(out, to, { to: e.from, k: 'read' }); add(inn, e.from, { from: to, k: 'read' }); }
}
// Fwd follows control (calls, registrations, event dispatch) and writes into resources; it does not fan out through readers of shared state
function fwd(starts) { const s = new Set(starts), q = [...starts]; while (q.length) { const x = q.shift(); for (const o of out.get(x) || []) if (o.k !== 'read' && !s.has(o.to)) { s.add(o.to); q.push(o.to); } } return s; }
// modes: w = writes an influencing resource; ca = calls an effectful body passing arguments; c = calls it without arguments;
//        v = its return value is used by an influencing body; r = resource.
// w, ca, v follow their inputs (resources read, callees whose value they use); w, ca, c climb to their callers; v does not climb.
function bwd(sinks) {
  const seen = new Set(), q = sinks.map(s => [s, 'r']), nodes = new Set(sinks), why = bwd.why = new Map();
  while (q.length) { const [x, mode, from] = q.shift(); const key = x + '|' + mode; if (seen.has(key)) continue; seen.add(key); nodes.add(x); if (!why.has(x)) why.set(x, from);
    const Q = it => q.push([it[0], it[1], key]);
    for (const i of inn.get(x) || []) {
      if (i.k === 'write' && mode === 'r') Q([i.from, 'w']);
      if (i.k === 'read' && mode !== 'c' && mode !== 'r' && i.from !== 'map:camera') Q([i.from, 'r']);   // the camera is the reader's own view, not an input
      if (i.k === 'call' && mode !== 'v' && mode !== 'r') Q([i.from, mode !== 'c' && i.args ? 'ca' : 'c']);   // argument data matters only next to the effect
      if (i.k === 'call' && mode === 'r') Q([i.from, 'c']);                  // event node -> its registrant
    }
    if (mode === 'w' || mode === 'ca' || mode === 'v') for (const o of out.get(x) || []) if (o.k === 'call') {
      const e = (inn.get(o.to) || []).find(i => i.from === x && i.k === 'call' && i.vu); if (e) Q([o.to, 'v']);
    }
  }
  return nodes;
}
const pathSet = (triggers, sinks) => { const F = fwd(triggers), Bw = bwd(sinks);
  if (process.env.KV_TRACE) for (const t of process.env.KV_TRACE.split(',')) { const tb = bodies.find(b => b.qname === t); if (!tb || !Bw.has(tb.id)) continue; let k = tb.id, ch = []; for (let i = 0; i < 20 && k; i++) { ch.push(lbl(k.split('|')[0]) + (k.includes('|') ? '[' + k.split('|')[1] + ']' : '')); k = bwd.why.get(k.split('|')[0]) || null; } console.log('TRACE', sinks[0], ch.join(' <- ')); }
  return new Set([...F].filter(x => Bw.has(x))); };
const chip = mb("bg›λ.addEventListener('click')");
if (!chip) { console.error('REFUSED: chip click body not found'); process.exit(8); }
const NEARL = [...res.keys()].filter(k => /gridatlas-lightning-nearest/.test(k));
const PATH = {
  A: { title: 'Complaint A: identical period counts', triggers: [chip.id], sinks: ['dom:layers-panel', 'source:gridatlas-lightning'] },
  B: { title: 'Complaint B: substation engine not firing', triggers: ['event:map.click'], sinks: [...NEARL, 'dom:lightning-card'] },
  E: { title: 'Expected: project deep-link arrival (original cartridge)', triggers: [cartByName('runDeepLink')[0].id], sinks: ['source:gridatlas-neon-links', 'source:gridatlas-neon-nodes', 'map:camera'] },
};
for (const k in PATH) { for (const s of [...PATH[k].triggers, ...PATH[k].sinks]) if (!nodeIds.has(s)) { console.error('REFUSED: path endpoint missing', k, s); process.exit(6); } PATH[k].set = pathSet(PATH[k].triggers, PATH[k].sinks); PATH[k].props = [...PATH[k].set].filter(x => x.includes('#link.')); for (const x of PATH[k].props) { PATH[k].set.delete(x); PATH[k].set.add(LINKB.id); } }
const both = new Set([...PATH.A.set].filter(x => PATH.B.set.has(x)));
// orphans
const inbound = new Map(); for (const e of real) if (['calls', 'exports'].includes(e.type)) inbound.set(e.to, (inbound.get(e.to) || 0) + 1);
const orphanBodies = bodies.filter(b => b.node !== root && !inbound.get(b.id) && b.file === 'module');
const orphanCart = bodies.filter(b => b.file === 'cartridge' && !inbound.get(b.id) && !real.some(e => e.to === b.id));
const stW = new Map(), stR = new Map();
for (const e of real) if (/^state:|^global:|^layer:|^source:/.test(e.to)) { if (e.type === 'writes') add(stW, e.to, e.from); if (e.type === 'reads') add(stR, e.to, e.from); }
const writeOnly = [...res.keys()].filter(k => /^(state|layer|source):/.test(k) && stW.get(k) && !stR.get(k));
const readOnly = [...res.keys()].filter(k => /^(state|global|layer|source):/.test(k) && stR.get(k) && !stW.get(k));
// global writers anywhere in the atlas tree
const globalWriters = {};
if (ATLAS) {
  const files = []; (function w(d) { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) { if (!/node_modules|\.git/.test(f)) w(p); } else if (/\.(js|mjs|html)$/.test(f) && s.size < 8e6) files.push(p); } })(ATLAS);
  for (const g of [...res.keys()].filter(k => k.startsWith('global:'))) {
    const name = g.slice(7).split('.')[0]; const re = new RegExp(name.replace(/[$]/g, '\\$') + '\\s*=(?!=)');
    globalWriters[g] = files.filter(f => re.test(readFileSync(f, 'utf8'))).map(f => f.slice(ATLAS.length + 1)).slice(0, 5);
  }
}
// cycles (Tarjan over call/register edges between bodies and events)
const cg = new Map(); for (const e of real) if (e.type === 'calls' || e.type === 'registers') add(cg, e.from, e.to);
let idx = 0; const st = [], on = new Set(), I = new Map(), L = new Map(), sccs = [];
function sc(v) { I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v);
  for (const w of cg.get(v) || []) { if (!I.has(w)) { sc(w); L.set(v, Math.min(L.get(v), L.get(w))); } else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w))); }
  if (L.get(v) === I.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1 || (cg.get(v) || []).includes(v)) sccs.push(c); } }
for (const v of nodeIds) if (!I.has(v)) sc(v);
// duplicated bodies: exact and alpha-renamed
const norm = s => { try { return [...acorn.tokenizer(s, { ecmaVersion: 'latest' })].map(t => t.type.label === 'name' ? '_' : (t.value ?? t.type.label)).join(' '); } catch (_) { return s.replace(/\s+/g, ''); } };
const dupE = new Map(), dupA = new Map();
for (const b of bodies.filter(b => b.file === 'module' && b.node !== root)) { const s = txt(MF, b.node); add(dupE, s.replace(/\s+/g, ''), b.qname); if (s.length >= 24) add(dupA, norm(s), b.qname); }
const exactDups = [...dupE.values()].filter(v => v.length > 1);
const shapeDups = [...dupA.values()].filter(v => v.length > 1);
for (const g of exactDups) for (let i = 1; i < g.length; i++) edges.push({ from: mb(g[0]).id, to: mb(g[i]).id, type: 'duplicates', evidence: { file: basename(MODP), lines: [mb(g[0]).line, mb(g[i]).line], snippet: 'byte-identical body (whitespace-normalised)' } });

// ---------------------------------------------------------------- RAG
// red   = a declared finding with file:line that produces a complaint symptom
// amber = on a computed complaint path (A or B) with no red finding, or a declared amber finding (known failure, duplicate, orphan, untested)
// green = off both complaint paths, no finding.  Resource nodes: amber on a path, grey otherwise.
const FIND = JSON.parse(readFileSync(new URL('./findings.json', import.meta.url), 'utf8'));
for (const b of bodies) {
  const f = FIND[b.qname];
  const onA = PATH.A.set.has(b.id), onB = PATH.B.set.has(b.id), onE = PATH.E.set.has(b.id);
  const paths = [onA && 'A', onB && 'B', onE && 'E'].filter(Boolean);
  b.paths = paths;
  if (f) { b.rag = f.rag; b.reason = f.reason + (paths.length ? ` [on path ${paths.join('+')}]` : ''); }
  else if (onA || onB) { b.rag = 'amber'; b.reason = `on computed path ${paths.join('+')}; no defect of its own found`; }
  else { b.rag = 'green'; b.reason = paths.length ? `on expected path ${paths.join('+')}; behaves as the owner expects` : 'off both complaint paths; no known failure'; }
}
for (const r of res.values()) {
  const paths = ['A', 'B', 'E'].filter(k => PATH[k].set.has(r.id)); r.paths = paths;
  const f = FIND[r.id];
  if (f) { r.rag = f.rag; r.reason = f.reason; } else { r.rag = paths.some(p => p !== 'E') ? 'amber' : 'grey'; r.reason = paths.length ? `resource on path ${paths.join('+')}` : 'resource; not on a complaint path'; }
}
const missingFind = Object.keys(FIND).filter(k => !bodies.some(b => b.qname === k) && !res.has(k));
if (missingFind.length) { console.error('REFUSED: findings name unknown bodies', missingFind); process.exit(7); }

// ---------------------------------------------------------------- outputs
const nodesOut = [
  ...bodies.map(b => ({ id: b.id, label: b.label, type: b.file === 'module' ? (b.node === root ? 'module' : 'function') : 'cartridge-function', rag: b.rag, reason: b.reason,
    key: b.key, fib32: hex8(b.fib), n: b.n, qname: b.qname, file: b.file === 'module' ? basename(MODP) : basename(CARTP), line: b.line, col: b.col, m_bytes: b.bytes,
    x: +(b.r * Math.cos(b.theta)).toFixed(6), y: +(b.r * Math.sin(b.theta)).toFixed(6), paths: b.paths })),
  ...[...res.values()].sort((a, b) => a.id.localeCompare(b.id)).map(r => ({ id: r.id, label: r.label, type: r.type, rag: r.rag, reason: r.reason, paths: r.paths, writers_in_atlas: globalWriters[r.id] }))];
const edgesOut = edges.map(({ k, ...e }) => e).sort((a, b) => (a.from + a.to + a.type).localeCompare(b.from + b.to + b.type));
const graph = { schema: 'kv-vogel.spider-graph.v1', generated_at: process.env.KV_ASOF, generator: 'hardening/evidence/kv-vogel/tools/vogel.mjs',
  source_pins: { module: { path: MODP.replace(/.*hardening\//, 'hardening/'), sha256: sha256(modSrc), bytes: Buffer.byteLength(modSrc) }, cartridge: { path: CARTP.replace(/.*hardening\//, 'hardening/'), sha256: sha256(cartSrc), bytes: Buffer.byteLength(cartSrc) } },
  note: 'Spider node/edge format (label,type,rag,reason; from,to,type) as in spiders/species/genome-spider/data/gridatlas-lineage.json. Bodies carry key (sha256 of bytes), fib32 id and Vogel x,y. Declared edges are marked declared:true and are candidates, not measurements.',
  paths: Object.fromEntries(Object.entries(PATH).map(([k, p]) => [k, { title: p.title, triggers: p.triggers.map(lbl), sinks: p.sinks, link_properties: p.props.map(x => x.split('#')[1]), nodes: [...p.set].map(lbl).sort() }])),
  both_complaints: [...both].map(lbl).sort(),
  orphans: { bodies_without_caller: orphanBodies.map(b => b.qname), cartridge_without_edge: orphanCart.map(b => b.qname), write_only: writeOnly, read_only: readOnly, global_writers: globalWriters },
  cycles: sccs.map(c => c.map(lbl)), duplicates: { exact: exactDups, same_shape: shapeDups, declared: DECLARED.filter(d => d[2] === 'duplicates').map(d => [d[0], d[1], d[3]]) },
  nodes: nodesOut, edges: edgesOut };
writeFileSync(join(OUT, 'graph.json'), JSON.stringify(graph, null, 1) + '\n');
const rules = [
  `asof ${process.env.KV_ASOF}`, `module ${MODP} sha256 ${sha256(modSrc)}`, `cartridge ${CARTP} sha256 ${sha256(cartSrc)}`,
  'placement: Vogel 1979. item n (1-based, order of first appearance: module bodies by source offset, then cartridge bodies by source offset)',
  '  r = sqrt(n) ; theta = 2*pi*frac(n*2654435769/2^32)  (= one golden-angle turn of 137.508 deg per item; same law as globalgrid2050 wafer_keys.py:80)',
  'stable id: kv:hex8( fnv1a32(qualified name) * 2654435769 mod 2^32 ); collisions refuse the run',
  'key: sha256 of the body source bytes (kuiper-belt README, first law). mass m = body bytes; drawn radius ∝ log(1+m) (LAWS L5)',
  'resources (state/global/map/dom/net/event): outer ring, theta = 2*pi*fib32(fnv1a32(id))/2^32',
  'edges: calls (direct, callback, event dispatch), registers, exports, reads, writes, dom_write, fetches (scope-resolved with eslint-scope 9.1.2 over acorn 8.18.0 ASTs)',
  'declared edges (should_call, should_write, duplicates) are candidates from the owner expectation and cartridge comments: ' + DECLARED.map(d => d.slice(0, 3).join(' -> ')).join('; '),
  'DOM surface table (declared): ' + JSON.stringify(SURFACE),
  'paths: P(trigger,sinks) = Fwd(trigger) ∩ Bwd(sinks). Fwd follows calls, registrations, event dispatch and writes (not readers of shared state). Bwd from a sink follows writers, inputs, callers of effectful bodies,',
  '       and callees whose return value is used (value mode: no further climb to callers). A caller is followed into its other callees only when the call passes arguments. Reads of map:camera do not propagate.',
  ...Object.entries(PATH).map(([k, p]) => `  ${k}: triggers ${p.triggers.map(lbl)} sinks ${p.sinks}`),
  'RAG: red = declared finding with file:line producing a complaint symptom; amber = on computed path A or B, or declared amber finding; green = otherwise. resources: amber on A/B, grey otherwise.',
  `counts: bodies ${bodies.length} (module ${bodies.filter(b => b.file === 'module').length}, cartridge ${cartBodies.length}), resources ${res.size}, edges ${edgesOut.length} (declared ${edgesOut.filter(e => e.declared).length})`,
  `rag: ${['red', 'amber', 'green', 'grey'].map(r => r + ' ' + nodesOut.filter(n => n.rag === r).length).join(', ')}`];
writeFileSync(join(OUT, 'rules.txt'), rules.join('\n') + '\n');
writeFileSync(join(OUT, 'layout.json'), JSON.stringify({ bodies: nodesOut.filter(n => n.key), resources: nodesOut.filter(n => !n.key).map(n => ({ id: n.id, theta: 2 * Math.PI * fib32(fnv1a(n.id)) / 2 ** 32 })), edges: edgesOut, paths: graph.paths, both: graph.both_complaints, byIdQ: Object.fromEntries(bodies.map(b => [b.qname, b.id])) }));
console.log(rules.join('\n'));
console.log('BOTH', graph.both_complaints.join(', '));
console.log('A', graph.paths.A.nodes.join(', '));
console.log('B', graph.paths.B.nodes.join(', '));
console.log('E', graph.paths.E.nodes.join(', '));
console.log('ORPHANS', JSON.stringify(graph.orphans, null, 0));
console.log('CYCLES', JSON.stringify(graph.cycles));
console.log('DUPS', JSON.stringify(graph.duplicates.exact), JSON.stringify(graph.duplicates.same_shape));
