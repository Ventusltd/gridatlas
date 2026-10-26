import { H } from './extract-pure.mjs';
import { readFileSync } from 'node:fs';
const { mm, T, Ts, ymd, ds, cv, ni, vk, wf, tg, S, DAY, HOUR } = H;
const iso = t => new Date(t).toISOString();
const out = [];
const say = (k, v) => { out.push(`${k}: ${v}`); console.log(k + ': ' + v); };

// 1. month arithmetic over month-end and leap day
say('mm(2026-10-31T13:05Z,3)  [expect 2026-07-31T13:05]', iso(mm(Date.UTC(2026,9,31,13,5),3)));
say('mm(2026-03-31,1)          [expect 2026-02-28]', iso(mm(Date.UTC(2026,2,31),1)));
say('mm(2028-02-29,12)         [expect 2027-02-28]', iso(mm(Date.UTC(2028,1,29),12)));
say('mm(2026-01-15,3)          [expect 2025-10-15]', iso(mm(Date.UTC(2026,0,15),3)));
say('mm(2026-05-31,3)          [expect 2026-02-28]', iso(mm(Date.UTC(2026,4,31),3)));
say('mm(2026-05-31,-3) (plus)  [expect 2026-08-31]', iso(mm(Date.UTC(2026,4,31),-3)));

// 2. PREV then NEXT does not invert for month periods when not at latest (shift-by-span)
S.period='3m'; S.end=Date.UTC(2026,2,31); const now=Date.UTC(2026,9,26,22,0);
let w=wf(now); say('3m window ending 2026-03-31', `${iso(w.s)} -> ${iso(w.e)} span ${w.span/DAY}d`);
S.end=w.s; const wp=wf(now); say('PREV', `${iso(wp.s)} -> ${iso(wp.e)} span ${wp.span/DAY}d`);
let e=wp.e+wp.span; S.end=e>=now-9e5?null:e; const wn=wf(now); say('NEXT after PREV (expect original 12-31->03-31)', `${iso(wn.s)} -> ${iso(wn.e)}`);
S.end=Date.UTC(2026,2,31); w=wf(now); e=w.e+w.span; S.end=e; const wn2=wf(now); say('NEXT from [12-31,03-31) (expect contiguous start 03-31)', `${iso(wn2.s)} -> ${iso(wn2.e)} overlap/gap vs 03-31: ${(wn2.s-Date.UTC(2026,2,31))/DAY}d`);

// 3. T/Ts on NaN (unvalidated first_observation_utc / feed metadata)
try { say('T(NaN)', T(NaN)); } catch (err) { say('T(NaN) THROWS', err.constructor.name + ': ' + err.message); }
try { say('Ts(Date.parse("garbage"))', Ts(Date.parse('garbage'))); } catch (err) { say('Ts(garbage) THROWS', err.constructor.name + ': ' + err.message); }

// 4. vk acceptance of non-integer / string / null counts
const base = {date:'2026-10-23',coverage:'partial',scanned_seconds:100,sealed:true,path:'days/2026/10/23.json'};
for (const c of ['5', true, [], 1.5, Infinity, null, -1, 0, 'x']) {
  try { vk({...base, count:c}); say(`vk count=${JSON.stringify(c)}`, 'ACCEPTED'); } catch (err) { say(`vk count=${JSON.stringify(c)}`, 'rejected: ' + err.message); }
}
try { vk({...base, parts:[{path:'../../../../Other/repo/main/x.json'}], path:null}); say('vk parts path traversal', 'ACCEPTED (parts never validated)'); } catch (err) { say('vk parts traversal', 'rejected: '+err.message); }
try { vk({...base, date:'2026-99-99'}); say('vk date 2026-99-99', 'ACCEPTED; ds()='+ds('2026-99-99')); } catch (err) { say('vk date 2026-99-99', 'rejected'); }
try { vk({...base, bytes:'100'}); say('vk bytes "100"', 'ACCEPTED; "100">=0 is '+('100'>=0)+'; null>=0 is '+(null>=0)); } catch (err) { say('vk bytes', 'rejected'); }

// 5. tg with malformed parts -> zero targets though count>0
say('tg malformed parts', JSON.stringify(tg({date:'2026-10-23',count:50,parts:[{path:'days/2026/10/23/07.json'}]}, ds('2026-10-23'), ds('2026-10-24'))));
say('tg good parts', JSON.stringify(tg({date:'2026-10-23',count:50,sealed:true,parts:[{hour:'07',path:'days/2026/10/23/07.json',count:50,bytes:10}]}, ds('2026-10-23'), ds('2026-10-24'))));

// 6. cv on the fixture index (lead's fixture, synthetic-free archive)
const raw = JSON.parse(readFileSync('/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data/history/index.json','utf8'));
const x = ni(raw);
const gen = x.gen; // index build time used as "now" so the fixture is reproducible
const we = gen, ws7 = we - 7*DAY;
const c7 = cv(x, ws7, we);
say('cv 7d @gen', `f=${(c7.f*100).toFixed(1)}% runs=${c7.r} days=${c7.d} unknownDays=${c7.u.join(',')} notYet=${(c7.ny/HOUR).toFixed(1)}h beforeArchive=${(c7.bf/HOUR).toFixed(1)}h a=${c7.a&&iso(c7.a)} b=${c7.b&&iso(c7.b)}`);
// disjointness of scan windows (sum of overlaps can only exceed 1 if they overlap)
let overl=0; for (let i=1;i<x.sw.length;i++) if (x.sw[i].s < x.sw[i-1].e) overl++;
say('scan_windows overlapping pairs', overl + ' of ' + (x.sw.length-1));
const c12 = cv(x, mm(we,12), we);
say('cv 12m @gen', `f=${(c12.f*100).toFixed(2)}% days=${c12.d} unknownDays=${c12.u.length} bf=${(c12.bf/DAY).toFixed(1)}d`);
// custom single day 23 Oct
const c23 = cv(x, ds('2026-10-23'), ds('2026-10-24'));
say('cv 2026-10-23', `f=${(c23.f*100).toFixed(1)}% runs=${c23.r}`);
// 7. custom window with From in the future (no rejection in nv): inverted window
S.period='custom'; S.from='2030-01-01'; S.to='2030-01-02'; const wf2=wf(now); say('custom future window', `s=${iso(wf2.s)} e=${iso(wf2.e)} span=${wf2.span/DAY}d atLatest=${wf2.atLatest}`);
// 8. window span boundaries
S.period='custom'; S.from='2026-09-01'; S.to='2026-10-01'; say('custom 31 inclusive days span/DAY', wf(now).span/DAY + ' (>31 ? ' + (wf(now).span/DAY>31) + ')');
S.from='2026-09-01'; S.to='2026-10-02'; say('custom 32 inclusive days span/DAY', wf(now).span/DAY + ' (>31 ? ' + (wf(now).span/DAY>31) + ')');
// 9. count null with coverage partial passes vk (null>=0 true)
try { vk({date:'2026-10-23',coverage:'partial',scanned_seconds:100,sealed:true,count:null,path:null}); say('vk count=null coverage=partial', 'ACCEPTED'); } catch (err) { say('vk count=null coverage=partial', 'rejected: ' + err.message); }
