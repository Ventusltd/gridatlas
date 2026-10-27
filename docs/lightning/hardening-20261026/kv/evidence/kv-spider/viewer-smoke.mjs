// node-only smoke test of lightning-spider.html (minidom + node:vm); no browser.
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import { El, makeDocument } from './minidom.mjs';
const html = readFileSync(new URL('./lightning-spider.html', import.meta.url), 'utf8');
const json = html.match(/<script id="graph" type="application\/json">([\s\S]*?)<\/script>/)[1];
const code = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
const body = html.match(/<body>([\s\S]*?)<script id="graph"/)[1];
El.prototype.append = function (...xs) { for (const x of xs) this.appendChild(x); };
for (const q of ['?focus=gh_sched', '', '?focus=nonsense']) {
  const doc = makeDocument(); const b = doc.createElement('body'); doc.documentElement.appendChild(b); b.innerHTML = body;
  const g = doc.createElement('script'); g.id = 'graph'; g.textContent = json; b.appendChild(g);
  let replaced = null;
  vm.runInNewContext(code, { document: doc, window: { scrollTo() {} }, location: { search: q }, URLSearchParams, history: { replaceState: (_, __, u) => { replaced = u; } }, JSON });
  const t = id => doc.getElementById(id).textContent;
  console.log(JSON.stringify({ q, focus: t('focus').slice(0, 90), in: doc.getElementById('in').children.length, out: doc.getElementById('out').children.length, risks: doc.getElementById('risks').children.length, idx: doc.getElementById('idx').children.length }));
  const first = doc.getElementById('out').children[0]; if (first && first.onclick) { first.onclick(); console.log('  click ->', replaced, t('focus').slice(0, 60)); }
}
