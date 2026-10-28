// minidom.mjs — just enough DOM for the lightning overlay under node:vm (harness: self-fixture, SYNTHETIC shell).
// Parses only the well-formed markup the overlay itself generates; selectors: tag, .class, [attr], [attr="v"], lists.
const VOID = new Set(['input']);
const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

export class Text { constructor(t) { this.data = t; this.parentNode = null; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }

export class El {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.attrs = new Map(); this.children = []; this.parentNode = null;
    this.listeners = {}; this.checked = false; this.value = ''; this.min = ''; this.max = ''; this.scrollTop = 0;
    let css = ''; this.style = {}; Object.defineProperty(this.style, 'cssText', { get: () => css, set: v => { css = String(v); }, enumerable: false });
    const self = this;
    this.dataset = new Proxy({}, {
      get: (_, k) => self.attrs.get('data-' + kebab(String(k))),
      set: (_, k, v) => { self.attrs.set('data-' + kebab(String(k)), String(v)); return true; },
    });
    this.classList = {
      contains: c => (self.attrs.get('class') || '').split(/\s+/).includes(c),
      toggle: (c, on) => { const s = new Set((self.attrs.get('class') || '').split(/\s+/).filter(Boolean)); if (on === undefined) on = !s.has(c); on ? s.add(c) : s.delete(c); self.attrs.set('class', [...s].join(' ')); return on; },
    };
  }
  get id() { return this.attrs.get('id') || ''; } set id(v) { this.attrs.set('id', v); }
  get className() { return this.attrs.get('class') || ''; } set className(v) { this.attrs.set('class', v); }
  get disabled() { return this.attrs.has('disabled'); } set disabled(v) { v ? this.attrs.set('disabled', '') : this.attrs.delete('disabled'); }
  get hidden() { return this.attrs.has('hidden'); } set hidden(v) { v ? this.attrs.set('hidden', '') : this.attrs.delete('hidden'); }
  setAttribute(a, v) { this.attrs.set(a, String(v)); } getAttribute(a) { return this.attrs.has(a) ? this.attrs.get(a) : null; }
  hasAttribute(a) { return this.attrs.has(a); } removeAttribute(a) { this.attrs.delete(a); }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; }
  appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.children.push(n); return n; }
  insertBefore(n, ref) { if (!ref) return this.appendChild(n); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, n); return n; }
  removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); n.parentNode = null; return n; }
  get textContent() { return this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this.children = []; this.appendChild(new Text(String(v))); }
  set innerHTML(html) { this.children = []; parse(html, this, this.ownerDocument); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  closest(sel) { for (let x = this; x instanceof El; x = x.parentNode) if (matches(x, sel)) return x; return null; }
  *walk() { for (const c of this.children) if (c instanceof El) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) { return [...this.walk()].filter(e => matches(e, sel)); }
  querySelector(sel) { for (const e of this.walk()) if (matches(e, sel)) return e; return null; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  getBoundingClientRect() { return this._rect || { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}

function matchOne(e, s) {
  const m = s.trim().match(/^([a-z]+)?((?:\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i);
  if (!m) throw new Error('minidom: unsupported selector ' + s);
  if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
  for (const p of m[2].match(/\.[\w-]+|\[[^\]]+\]/g) || []) {
    if (p[0] === '.') { if (!e.classList.contains(p.slice(1))) return false; continue; }
    const [, a, v] = p.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (!e.attrs.has(a) || (v !== undefined && e.attrs.get(a) !== v)) return false;
  }
  return true;
}
const matches = (e, sel) => sel.split(',').some(s => matchOne(e, s));

function parse(html, root, doc) {
  const re = /<(\/?)([a-z]+)([^>]*)>|([^<]+)/gi; let cur = root, m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { cur.appendChild(new Text(m[4])); continue; }
    if (m[1]) { cur = cur.parentNode; continue; }
    const el = new El(m[2], doc), ar = /([\w-]+)(?:="([^"]*)")?/g; let a;
    while ((a = ar.exec(m[3]))) el.attrs.set(a[1], a[2] === undefined ? '' : a[2]);
    cur.appendChild(el); if (!VOID.has(m[2].toLowerCase())) cur = el;
  }
}

// event dispatch with bubbling; listener exceptions are caught and reported like a browser would
export function dispatch(target, type, errors) {
  let stopped = false; const ev = { type, target, stopPropagation: () => { stopped = true; } };
  for (let x = target; x && !stopped; x = x.parentNode) for (const f of (x.listeners && x.listeners[type]) || []) { try { f(ev); } catch (e) { errors.push(e); } }
}

export function makeDocument() {
  const doc = { };
  const html = new El('html', doc); doc.documentElement = html;
  doc.createElement = t => new El(t, doc);
  doc.getElementById = id => { for (const e of html.walk()) if (e.id === id) return e; return null; };
  doc.querySelector = s => html.querySelector(s);
  return doc;
}
