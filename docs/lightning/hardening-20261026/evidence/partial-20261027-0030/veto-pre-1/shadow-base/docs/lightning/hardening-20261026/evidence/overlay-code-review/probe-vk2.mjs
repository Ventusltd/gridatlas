import { H } from './extract-pure.mjs';
const { vk, ds, ni } = H;
const say=(k,v)=>console.log(k+': '+v);
const base = {date:'2026-10-23',coverage:'partial',scanned_seconds:100,sealed:true,count:50};
try { vk({...base, path:null, parts:[{path:'../../../../OtherOrg/repo/main/x.json'}]}); say('vk parts path traversal (count 50, path null)', 'ACCEPTED - parts entries are never validated'); } catch (e) { say('vk parts traversal', 'rejected: '+e.message); }
try { vk({...base, path:'days/2026/10/23.json', date:'2026-99-99'}); say('vk date 2026-99-99', 'ACCEPTED; ds("2026-99-99")='+ds('2026-99-99')); } catch (e) { say('vk date 2026-99-99', 'rejected: '+e.message); }
try { vk({...base, path:'days/2026/10/23.json', bytes:'100'}); say('vk bytes "100"', 'ACCEPTED; "100">=0 -> '+('100'>=0)+'; null>=0 -> '+(null>=0)+'; 5+"100" -> '+(5+'100')); } catch (e) { say('vk bytes "100"', 'rejected: '+e.message); }
try { vk({...base, path:'days/2026/10/23.json', count:Infinity}); say('vk count=Infinity', 'ACCEPTED'); } catch (e) { say('vk count=Infinity','rejected'); }
// index-level: cutoff_date_utc shape-only
const raw = JSON.parse(JSON.stringify((await import('node:fs')).readFileSync ? {} : {}));
import { readFileSync } from 'node:fs';
const idx = JSON.parse(readFileSync('/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data/history/index.json','utf8'));
idx.cutoff_date_utc = '9999-99-99';
try { const x = ni(idx); say('ni cutoff 9999-99-99', 'ACCEPTED; cutoff ms = '+x.cutoff+' (NaN disables BEFORE-ARCHIVE/clamp/PREV-disable; input min="9999-99-99")'); } catch (e) { say('ni cutoff 9999-99-99', 'rejected: '+e.message); }
const idx2 = JSON.parse(readFileSync('/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data/history/index.json','utf8'));
idx2.days.find(r=>r.date==='2026-10-23').first_observation_utc = 'not-a-date';
try { const x = ni(idx2); say('ni row first_observation_utc="not-a-date"', 'ACCEPTED (reaches cp() line 107 -> Ts(NaN) -> RangeError at paint)'); } catch (e) { say('ni bad first_observation_utc', 'rejected: '+e.message); }
const idx3 = JSON.parse(readFileSync('/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data/history/index.json','utf8'));
idx3.schema = 'uk-lightning-history-index.v1';
try { ni(idx3); say('ni v1', 'accepted'); } catch (e) { say('ni v1 schema -> error text', e.message); }
