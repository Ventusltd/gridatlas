import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function classes(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function selectorParts(selector) {
  return selector.split(',').map((part) => part.trim()).filter(Boolean);
}

function matches(node, selector) {
  if (!node || !node.tagName) return false;
  let part = selector.trim();
  if (!part || /\s/.test(part.replace(/\[[^\]]*\]/g, ''))) return false;
  const tag = part.match(/^[a-z][\w-]*/i);
  if (tag && node.tagName !== tag[0].toUpperCase()) return false;
  const id = part.match(/#([\w-]+)/);
  if (id && node.id !== id[1]) return false;
  for (const hit of part.matchAll(/\.([\w-]+)/g)) {
    if (!classes(node).has(hit[1])) return false;
  }
  for (const hit of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    const name = hit[1];
    const actual = node.getAttribute(name);
    if (actual === null) return false;
    if (hit[2] !== undefined && actual !== hit[2]) return false;
  }
  return true;
}

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.id = '';
    this.className = '';
    this.children = [];
    this.parentNode = null;
    this.attrs = Object.create(null);
    this.dataset = Object.create(null);
    this.style = { cssText: '' };
    this.textContent = '';
    this.type = '';
    this.name = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.listeners = Object.create(null);
    this.classList = {
      add: (...names) => {
        const next = classes(this);
        names.forEach((name) => next.add(name));
        this.className = [...next].join(' ');
      },
      remove: (...names) => {
        const next = classes(this);
        names.forEach((name) => next.delete(name));
        this.className = [...next].join(' ');
      },
      contains: (name) => classes(this).has(name),
      toggle: (name) => {
        const next = classes(this);
        const added = !next.has(name);
        if (added) next.add(name); else next.delete(name);
        this.className = [...next].join(' ');
        return added;
      }
    };
  }

  get firstChild() { return this.children[0] || null; }

  appendChild(child) {
    if (child.parentNode) {
      const at = child.parentNode.children.indexOf(child);
      if (at >= 0) child.parentNode.children.splice(at, 1);
    }
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(child, before) {
    if (child.parentNode) {
      const at = child.parentNode.children.indexOf(child);
      if (at >= 0) child.parentNode.children.splice(at, 1);
    }
    const index = before ? this.children.indexOf(before) : -1;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    child.parentNode = this;
    return child;
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attrs[name] = text;
    if (name === 'id') this.id = text;
    if (name === 'class') this.className = text;
    if (name === 'type') this.type = text;
    if (name === 'name') this.name = text;
    if (name === 'value') this.value = text;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    if (name === 'type') return this.type || this.attrs[name] || null;
    if (name === 'name') return this.name || this.attrs[name] || null;
    if (name === 'value') return this.value || this.attrs[name] || null;
    return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
  }

  hasAttribute(name) { return this.getAttribute(name) !== null; }

  removeAttribute(name) {
    delete this.attrs[name];
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  dispatch(type, supplied = {}) {
    const event = {
      type,
      target: supplied.target || this,
      currentTarget: this,
      key: supplied.key,
      stopped: false,
      defaultPrevented: false,
      stopPropagation() { this.stopped = true; },
      preventDefault() { this.defaultPrevented = true; }
    };
    let node = this;
    while (node) {
      event.currentTarget = node;
      for (const fn of node.listeners?.[type] || []) fn.call(node, event);
      if (event.stopped) break;
      node = node.parentNode;
    }
    if (!event.stopped) this.ownerDocument.dispatch(type, event);
    return event;
  }

  click() {
    if (this.disabled) return;
    if (this.type === 'checkbox') this.checked = !this.checked;
    if (this.type === 'radio') this.checked = true;
    this.dispatch('click');
    if (this.type === 'checkbox' || this.type === 'radio') this.dispatch('change');
  }

  focus() { this.ownerDocument.activeElement = this; }

  contains(other) {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }

  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (selectorParts(selector).some((part) => matches(node, part))) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    const wanted = selectorParts(selector);
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (wanted.some((part) => matches(child, part))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

class FakeDocument {
  constructor() {
    this.listeners = Object.create(null);
    this.readyState = 'complete';
    this.activeElement = null;
    this.documentElement = new FakeElement('html', this);
    this.head = new FakeElement('head', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag) { return new FakeElement(tag, this); }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }

  dispatch(type, event) {
    for (const fn of this.listeners[type] || []) fn.call(this, event);
  }

  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getElementById(id) { return this.querySelector('#' + id); }
}

function add(doc, parent, tag, attrs = {}, text = '') {
  const node = doc.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => {
    if (name === 'className') node.className = value;
    else if (name in node && !name.startsWith('data-')) node[name] = value;
    else node.setAttribute(name, value);
  });
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function fixture({ engineCount = 60, pipelineCount = 3, duplicate = false } = {}) {
  const doc = new FakeDocument();
  const dashboard = add(doc, doc.body, 'div', { className: 'dashboard' });
  const header = add(doc, dashboard, 'div', { className: 'hud-header' }, 'System time Ventus Live');
  const map = add(doc, dashboard, 'div', { className: 'map-container' });
  const result = add(doc, map, 'div', { id: 'radius-popup', className: 'radius-popup' });
  const search = add(doc, map, 'div', { className: 'search-bar-wrapper' });
  const searchInner = add(doc, search, 'div');
  add(doc, searchInner, 'input', { id: 'search-input', type: 'text' });
  add(doc, searchInner, 'div', { id: 'search-results', className: 'search-results' });
  add(doc, search, 'button', { id: 'search-btn', type: 'button' }, 'GO');
  const stack = add(doc, map, 'div', { className: 'map-controls' });
  const actions = {};
  for (const [id, label] of [
    ['btn-export', 'Export CSV'], ['btn-radius', 'Radius Search'],
    ['btn-radius-area', 'Radius Area'], ['btn-zonedraw', 'Poly Zone'],
    ['btn-status', 'Status Colours'], ['btn-measure', 'Measure']
  ]) {
    actions[id] = add(doc, stack, 'button', { id, type: 'button', className: 'map-ctrl-btn' }, label);
    actions[id].hits = 0;
    actions[id].addEventListener('click', () => { actions[id].hits += 1; });
  }
  actions['btn-fullscreen'] = add(doc, map, 'button', { id: 'btn-fullscreen', type: 'button' }, 'Full screen');
  actions['btn-fullscreen-exit'] = add(doc, doc.body, 'button', { id: 'btn-fullscreen-exit', type: 'button' }, 'Exit');
  const curtain = add(doc, doc.body, 'div', { id: 'fs-curtain-tab' }, 'Layers');
  curtain.hits = 0;
  curtain.addEventListener('click', () => { curtain.hits += 1; });
  const tray = add(doc, stack, 'div', { id: 'gridatlas-mobile-tray' });
  for (const text of ['Tools', 'Grid', 'Subs', 'Scope', 'Clear']) {
    const button = add(doc, tray, 'button', { type: 'button' }, text);
    button.hits = 0;
    button.addEventListener('click', () => { button.hits += 1; });
    actions['tray-' + text.toLowerCase()] = button;
  }
  const scada = add(doc, dashboard, 'div', { className: 'scada-wrapper' });
  const brand = add(doc, scada, 'div', { className: 'scada-brand' }, 'Ventus');
  add(doc, scada, 'div', { className: 'status-legend' }, 'Operational');
  const controls = add(doc, scada, 'div', { id: 'scada-ui-container' });
  const originals = [];
  const group = add(doc, controls, 'div', { className: 'key-group' });
  add(doc, group, 'div', { className: 'key-title' }, 'Engine layers');
  for (let index = 0; index < engineCount; index += 1) {
    const label = add(doc, group, 'label', { className: 'key-item' });
    const id = duplicate && index === engineCount - 1 ? 'engine-0' : 'engine-' + index;
    const input = add(doc, label, 'input', { type: 'checkbox', 'data-layer-id': id });
    input.hits = 0;
    input.addEventListener('change', () => { input.hits += 1; });
    add(doc, label, 'span', { 'data-base-label': 'Engine ' + index }, 'Engine ' + index + ' [WAIT]');
    originals.push(input);
  }
  const pnGroup = add(doc, controls, 'div', { className: 'key-group' });
  add(doc, pnGroup, 'div', { className: 'key-title' }, 'Pipeline News (REPD)');
  for (let index = 0; index < pipelineCount; index += 1) {
    const label = add(doc, pnGroup, 'label', { className: 'key-item' });
    const input = add(doc, label, 'input', { type: 'checkbox', 'data-pn-layer': 'pn-' + index });
    input.hits = 0;
    input.addEventListener('change', () => { input.hits += 1; });
    add(doc, label, 'span', { 'data-pn-label': 'pn-' + index }, 'Pipeline ' + index + ' [WAIT]');
    originals.push(input);
  }
  const bmGroup = add(doc, controls, 'div', { className: 'key-group' });
  add(doc, bmGroup, 'div', { className: 'key-title' }, 'Basemap');
  for (const value of ['dark', 'sat']) {
    const label = add(doc, bmGroup, 'label', { className: 'key-item' });
    const input = add(doc, label, 'input', { type: 'radio', name: 'bm', value });
    input.checked = value === 'dark';
    add(doc, label, 'span', {}, value === 'dark' ? 'Dark' : 'Satellite');
  }
  add(doc, scada, 'div', { className: 'disclaimer-box' }, 'Public data only');
  add(doc, map, 'div', { className: 'podcast-shoutout' }, 'The Future of Solar Photovoltaics');
  const dash = add(doc, doc.body, 'button', { id: 'gridatlas-dash-toggle', type: 'button' }, 'Hide layers');
  dash.addEventListener('click', () => {
    if (scada.hasAttribute('data-gridatlas-collapsed')) scada.removeAttribute('data-gridatlas-collapsed');
    else scada.setAttribute('data-gridatlas-collapsed', '1');
  });
  const gb = add(doc, stack, 'div', { id: 'gridatlas-gb-conditions' });
  add(doc, gb, 'button', { type: 'button' }, 'GB prices');
  const ledger = add(doc, stack, 'div', { id: 'gridatlas-version-ledger' });
  add(doc, ledger, 'button', { type: 'button' }, 'Versions');
  return { doc, map, result, stack, scada, brand, header, controls, originals, actions };
}

function run(source, options) {
  const page = fixture(options);
  const intervals = [];
  const box = {
    console,
    document: page.doc,
    Set,
    Object,
    Array,
    String,
    RegExp,
    window: {
      console,
      setInterval: (fn) => { intervals.push(fn); return intervals.length; },
      clearInterval: () => {},
      setTimeout: (fn) => { fn(); return 1; }
    }
  };
  box.window.window = box.window;
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(source, box, { filename: 'menu-bar.js' });
  return { ...page, api: box.window.__GRIDATLAS_MODULES__?.menuBar, intervals };
}

export async function proveMenuBar(menuPath, servedSource = '') {
  const source = await readFile(menuPath, 'utf8');
  const failures = [];
  let passed = 0;
  const check = (name, condition) => {
    if (condition) passed += 1;
    else failures.push(name);
  };

  const complete = run(source);
  const api = complete.api;
  const bar = complete.doc.getElementById('gridatlas-menu-bar');
  const styleText = complete.doc.getElementById('gridatlas-menu-bar-css')?.textContent || '';
  const titleNodes = bar ? bar.querySelectorAll('.gm-title') : [];
  const title = (name) => titleNodes.find((node) => node.textContent === name);
  const panel = (name) => title(name)?.parentNode.querySelector('.gm-panel');

  check('menu v2 registers and installs only on the complete UI',
    api?.schema === 'gridatlas.menu-bar.v2' && api.installed === true);
  check('served cartridge contains the same menu implementation',
    !servedSource || servedSource.includes('gridatlas.menu-bar.v2'));
  let partialIntervals = 0;
  const partialBox = {
    console,
    document: {
      readyState: 'complete',
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { style: {} }; },
      body: {}
    },
    Set,
    Object,
    Array,
    String,
    RegExp,
    window: {
      console,
      setInterval() { partialIntervals += 1; return partialIntervals; },
      clearInterval() {},
      setTimeout(fn) { fn(); return 1; }
    }
  };
  partialBox.window.window = partialBox.window;
  partialBox.globalThis = partialBox;
  vm.createContext(partialBox);
  vm.runInContext(source, partialBox, { filename: 'menu-bar-partial-dom.js' });
  check('a partial DOM fails closed without starting the long browser retry loop',
    partialBox.window.__GRIDATLAS_MODULES__?.menuBar?.installed === false
    && /document|DOM/.test(partialBox.window.__GRIDATLAS_MODULES__.menuBar.failure)
    && partialIntervals === 0);
  check('menu names are exactly File Edit View Scope Grid About',
    api?.menus.join('|') === 'File|Edit|View|Scope|Grid|About');
  check('all six menus are closed at rest',
    titleNodes.length === 6
    && titleNodes.every((node) => node.getAttribute('aria-expanded') === 'false')
    && bar.querySelectorAll('.gm-menu.gm-open').length === 0
    && api.closed_at_rest === true);
  check('every title exposes its popup, state and controlled panel',
    titleNodes.every((node) => node.getAttribute('aria-haspopup') === 'menu'
      && node.getAttribute('aria-controls')
      && complete.doc.getElementById(node.getAttribute('aria-controls'))));
  check('there are no empty or placeholder menus',
    api?.menus.every((name) => panel(name)?.children.length > 0)
    && !/nothing here yet/i.test(bar.textContent));
  check('the inventory is exactly 60 engine plus 3 Pipeline News controls',
    api?.engine_layer_controls === 60 && api.pipeline_layer_controls === 3
    && api.layer_controls === 63 && api.inspect().unique === 63);
  check('Grid exposes all 63 unique controls, not shallow direct children',
    panel('Grid')?.querySelectorAll('[data-gridatlas-layer-proxy]').length === 63
    && complete.controls.parentNode === complete.scada
    && complete.controls.querySelectorAll('input[type="checkbox"][data-layer-id]').length === 60
    && complete.controls.querySelectorAll('input[type="checkbox"][data-pn-layer]').length === 3);
  check('the forbidden Select layers alias is absent',
    !api?.menus.includes('Select layers') && !titleNodes.some((node) => node.textContent === 'Select layers'));

  const scope = complete.actions['tray-scope'];
  const clear = complete.actions['tray-clear'];
  const radius = complete.actions['btn-radius'];
  scope.click(); clear.click(); radius.click();
  check('nested Scope Clear and radius remain the original live nodes',
    panel('Scope')?.contains(scope) && panel('Scope')?.contains(clear)
    && panel('Scope')?.contains(radius)
    && scope.hits === 1 && clear.hits === 1 && radius.hits === 1);
  check('the radius result panel stays with the map and is never hidden with its controls',
    complete.result.parentNode === complete.map && complete.result.hidden === false);

  title('Grid').click();
  const proxy = panel('Grid').querySelector('[data-gridatlas-layer-proxy="engine:engine-0"]');
  const proxyName = proxy.parentNode.querySelector('.gm-layer-name');
  check('the Grid proxy mirrors the V8 live WAIT state rather than hiding it',
    proxyName.textContent === 'Engine 0 [WAIT]'
    && proxy.getAttribute('aria-label') === 'Engine 0 [WAIT]');
  proxy.click();
  check('a Grid proxy executes the original handler and reflects original state',
    complete.originals[0].checked === true && complete.originals[0].hits === 1
    && proxy.checked === true);
  check('a layer choice remains open so a phone reader can see the tick',
    title('Grid').getAttribute('aria-expanded') === 'true'
    && bar.querySelectorAll('.gm-menu.gm-open').length === 1
    && api.layer_menu_stays_open === true);

  complete.originals[0].parentNode.querySelector('[data-base-label]').textContent = 'Engine 0 [OK]';
  title('Grid').click();
  title('Grid').click();
  check('reopening Grid mirrors the V8 terminal load state visibly and accessibly',
    proxyName.textContent === 'Engine 0 [OK]'
    && proxy.getAttribute('aria-label') === 'Engine 0 [OK]'
    && api.layer_status_mirrored === true);

  complete.originals[0].click();
  check('opening Grid resynchronises state changed through the original UI',
    proxy.checked === complete.originals[0].checked && proxy.checked === false);
  title('View').click();
  check('navigating menus leaves exactly one panel open',
    title('Grid').getAttribute('aria-expanded') === 'false'
    && title('View').getAttribute('aria-expanded') === 'true'
    && bar.querySelectorAll('.gm-menu.gm-open').length === 1);
  title('View').focus();
  bar.dispatch('keydown', { key: 'Escape', target: title('View') });
  check('Escape closes and returns focus to the owning title',
    api.closed_at_rest === true && complete.doc.activeElement === title('View'));
  title('File').focus();
  bar.dispatch('keydown', { key: 'ArrowRight', target: title('File') });
  check('arrow navigation advances across the conventional menu titles',
    complete.doc.activeElement === title('Edit'));

  check('the old action stack is emptied only after nested controls move',
    complete.stack.getAttribute('data-gridatlas-menu-emptied') === '1'
    && panel('Scope').contains(clear));
  check('one identity surface remains and the duplicate SCADA brand is marked out',
    api.one_identity_surface === true && panel('About').contains(complete.header)
    && complete.brand.getAttribute('data-gridatlas-menu-duplicate') === '1');
  check('install is idempotent and document listeners are not multiplied',
    api.listeners === 2 && api.install() === true && api.listeners === 2
    && (complete.doc.listeners.click || []).length === 1
    && (complete.doc.listeners.change || []).length === 1);
  check('phone panels are bounded and scroll rather than escaping 393x852',
    /@media\(max-width:700px\)/.test(source)
    && /max-height:calc\(100dvh - 40px\)/.test(source)
    && /overflow:auto/.test(source));
  check('the Grid menu remains the hit target above the v9.90 mobile project sheet',
    api?.mobile_sheet_hit_target_guard === true
    && /html\.gridatlas-sheet-open #gridatlas-menu-bar\{z-index:10020!important;pointer-events:auto!important\}/
      .test(styleText)
    && /html\.gridatlas-sheet-open #gridatlas-menu-bar \.gm-panel\{pointer-events:auto!important\}/
      .test(styleText));
  check('nothing in menu output grades a connection',
    !/\b(strong|weak|remote|excellent|poor|good|bad)\b/i.test(
      source.replace(/\/\*[\s\S]*?\*\//g, '')));

  const incomplete = run(source, { engineCount: 59, pipelineCount: 3 });
  check('62 controls fail closed with the original interface untouched',
    incomplete.api?.installed === false && !incomplete.doc.getElementById('gridatlas-menu-bar')
    && incomplete.actions['btn-radius'].parentNode === incomplete.stack
    && !incomplete.stack.hasAttribute('data-gridatlas-menu-emptied'));
  const duplicate = run(source, { engineCount: 60, pipelineCount: 3, duplicate: true });
  check('a duplicate identity also fails closed even when the raw count is 63',
    duplicate.api?.installed === false && duplicate.api.inspect().total === 63
    && duplicate.api.inspect().unique === 62
    && !duplicate.doc.getElementById('gridatlas-menu-bar'));

  if (failures.length) {
    throw new Error('menu-bar DOM proof failed (' + failures.length + '):\n- '
      + failures.join('\n- '));
  }
  return { status: 'PASS', checks: passed, layers: 63, menus: api.menus };
}
