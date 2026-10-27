// Extract the overlay's pure helpers verbatim (lines 9-21, 33-45, 48-57, 64-65) and evaluate them in Node.
// Read-only on the candidate; nothing is written to the worktree.
import { readFileSync } from 'node:fs';
const SRC = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt/atlas/modules/202610261949-uk-lightning-overlay.js';
const lines = readFileSync(SRC, 'utf8').split('\n');
const pick = (a, b) => lines.slice(a - 1, b).join('\n');
// line 9..21 are one const chain ending with a comma after mm(); 22-23 is S; we stub S and the DOM-ish bits.
let code = pick(9, 21) + '\n';          // GEN..mm,  (ends with "...return d.getTime()},")
code += 'S={period:"24h",end:null,from:"",to:"",consent:false},lru=new Map(),\n';
code += pick(31, 31) + '\n';            // lg, ls
code += pick(33, 45) + '\n';            // vk, ni, stale
code += pick(48, 57) + '\n';            // cv, wf, tg
code += pick(64, 65) + '\n';            // ok, co
code = code.replace(/,\s*$/, ';');
const stub = { window: { innerWidth: 1440 }, matchMedia: () => ({ matches: false }), document: { getElementById: () => null } };
const fn = new Function('window', 'matchMedia', 'document', code + '\nreturn {GEN,AR,DAY,HOUR,PERIODS,pad,ymd,ds,T,Ts,N,AGO,ov,mm,S,vk,ni,stale,cv,wf,tg,ok,co,lg,ls,lru};');
export const H = fn(stub.window, stub.matchMedia, stub.document);
