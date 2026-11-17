import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildSld} from './build.mjs';

const edits = JSON.parse(fs.readFileSync(new URL('./src/mobile-arrival-card-edits.json', import.meta.url)));
const accepted = buildSld('202611161720').toString('utf8');
const helper = edits[0].after.replace('  function addCardBar(content) {\n', '');
function fixture(minimised = true) {
  const button = {style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }};
  const label = {style: {}, children: [], querySelector() { return this.children[0]; }, appendChild(n) { this.children.push(n); }};
  const popup = {classList: {contains() { return minimised; }}, querySelector() { return button; }};
  const content = {closest() { return popup; }, querySelector() { return label; }};
  const context = {document: {createElement() { return {style: {}, setAttribute() {}}; }}};
  vm.createContext(context); vm.runInContext(helper, context);
  return {context, content, button, label};
}
test('all edits apply exactly once to rebuilt accepted source and compile without changing history', () => {
  let source = accepted;
  for (const edit of edits) {
    assert.equal(source.split(edit.before).length - 1, 1);
    source = source.replace(edit.before, edit.after);
  }
  new vm.Script(source);
  assert.equal(accepted.includes('function renderArrivalCardSummary'), false);
  assert.ok(source.includes('cardPreference = { key: cardPreferenceKey(), minimised:'));
  assert.ok(source.includes('? cardPreference.minimised'));
});
test('collapsed card exposes nearest name, distance and screening scope with labelled Details', () => {
  const f = fixture();
  f.context.renderArrivalCardSummary(f.content, [{name: 'Nearest A', km: 38.627}], 'to-substation');
  assert.equal(f.label.children[0].textContent, 'Nearest mapped substation: Nearest A | 38.6 km straight-line. Screening only; connection unverified.');
  assert.equal(f.button.textContent, 'Details');
  assert.equal(f.button.attrs['aria-expanded'], 'false');
  assert.equal(f.button.style.minHeight, '44px');
  assert.equal(f.button.attrs['aria-label'], 'Show project details');
});
test('a replacement selection updates one summary without stale name or HTML injection', () => {
  const f = fixture(false);
  f.context.renderArrivalCardSummary(f.content, [{name: 'Old', km: 1}], 'to-substation');
  f.context.renderArrivalCardSummary(f.content, [{name: '<img src=x>', km: 0}], 'from-substation');
  assert.equal(f.label.children.length, 1);
  assert.equal(f.label.children[0].textContent, 'Nearest mapped project: <img src=x> | 0.0 km straight-line. Screening only; connection unverified.');
  assert.equal(f.button.textContent, 'Map');
  assert.equal(f.button.attrs['aria-expanded'], 'true');
});
test('beyond-radius distance stays visible and absent/nonfinite distance stays unknown', () => {
  const f = fixture();
  const links = []; links.beyondRadiusNearest = {name: 'Beyond', km: 52};
  f.context.renderArrivalCardSummary(f.content, links, 'to-substation');
  assert.match(f.label.children[0].textContent, /Beyond \| 52.0 km straight-line/);
  f.context.renderArrivalCardSummary(f.content, [{name: 'Unknown', km: NaN}], 'to-substation');
  assert.equal(f.label.children[0].textContent, 'No mapped substation distance available. Connection unverified.');
});
