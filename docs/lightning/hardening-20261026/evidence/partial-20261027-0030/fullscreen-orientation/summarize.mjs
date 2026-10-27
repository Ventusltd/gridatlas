// summarize.mjs — reads out/<route>-<vp>.json, prints per-step facts and baseline-vs-candidate geometry deltas of original controls.
import { readFileSync, existsSync } from 'node:fs';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/fullscreen-orientation/out';
const vps = process.argv.slice(2);
const load = (r, v) => existsSync(`${OUT}/${r}-${v}.json`) ? JSON.parse(readFileSync(`${OUT}/${r}-${v}.json`)) : null;
const d = (a, b) => Math.max(...['x', 'y', 'w', 'h'].map(k => Math.abs((a?.[k] ?? 1e9) - (b?.[k] ?? -1e9))));
for (const v of vps) {
  const B = load('baseline', v), C = load('candidate', v);
  console.log(`\n=== ${v}  baseline:${B ? B.steps.length + ' steps, err ' + JSON.stringify(B.errors) : 'MISSING'}  candidate:${C ? C.steps.length + ' steps, err ' + JSON.stringify(C.errors) : 'MISSING'}`);
  if (C) for (const s of C.steps) {
    const L = s.lightning || {};
    console.log(`C ${s.label.padEnd(26)} vw=${s.vw}x${s.vh} fs=${s.fsEl} open=${s.curtainOpen} scroll=${s.curtainScroll.top}/${s.curtainScroll.h}/${s.curtainScroll.client} on=${L.on} cur=${L.curtainChecked} main=${L.mainChecked} lbl="${L.curtainLabel}" collapsed=${s.panelCollapsed} hide=${s.hideHidden ? 'hidden' : s.hideText}`);
    console.log(`   blocked=${JSON.stringify(s.origBlocked)} visIn=${s.origVisibleInputs}/${s.origInputs} fixedHit=${JSON.stringify(Object.fromEntries(Object.entries(s.fixed).map(([k, f]) => [k, f.hit])))} overlap=${JSON.stringify(s.overlap)} cap=${JSON.stringify(s.caption)} mcap=${JSON.stringify(s.mainCaption || null)}${s.reveal ? ' reveal=' + JSON.stringify(s.reveal) : ''}${s.ready !== undefined ? ' ready=' + s.ready : ''}`);
  }
  if (B && C) for (const lab of ['rest', 'fs', 'curtain-open', 'rotated-on', 'rotated-back-on', 'exited-with-curtain-open']) {
    const b = B.steps.find(s => s.label === lab), c = C.steps.find(s => s.label === lab);
    if (!b || !c) { if (b || c) console.log(`G ${lab}: only in ${b ? 'baseline' : 'candidate'}`); continue; }
    const gd = b.origGroups.map((g, i) => d(g, c.origGroups[i]));
    const fd = Object.fromEntries(Object.keys(b.fixed).map(k => [k, d(b.fixed[k].rect, c.fixed[k]?.rect)]));
    const fh = Object.fromEntries(Object.keys(b.fixed).map(k => [k, b.fixed[k].hit + '|' + c.fixed[k]?.hit]));
    console.log(`G ${lab.padEnd(26)} groups ${b.origGroups.length}/${c.origGroups.length} maxΔ=${Math.max(0, ...gd).toFixed(1)} fixedΔ=${JSON.stringify(fd)} curtainΔ=${d(b.curtain, c.curtain).toFixed(1)} (B h=${b.curtain.h} C h=${c.curtain.h}) blockedB=${b.origBlocked.length} blockedC=${c.origBlocked.length} hits=${JSON.stringify(fh)} open=${b.curtainOpen}|${c.curtainOpen} fs=${b.fsEl}|${c.fsEl} tab=${b.tabText}|${c.tabText}`);
  }
}
