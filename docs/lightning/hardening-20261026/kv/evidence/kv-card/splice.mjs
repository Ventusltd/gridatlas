// splice.mjs: test-card.mjs = test-fixes.mjs (Build I suite) minus the three tests that pin the old anchored card / NEAREST button,
// plus the kv-card tests. Usage: node splice.mjs
import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('test-fixes.orig.mjs', 'utf8');
for (const name of ["test('H3/I1: tapping a flash", "test('I1: the card has explicit", "test('I3: NEAREST SUBSTATIONS draws"]) {
  const a = s.indexOf(name); if (a < 0 || s.indexOf(name, a + 1) >= 0) throw new Error(name);
  const b = s.indexOf('\n});\n', a) + 5; s = s.slice(0, a) + s.slice(b);
}
s += "\nconst SHELLCSS = process.env.SHELLCSS || '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt/atlas/releases/202608300453-atlas-v9/ventusv8.css';\nconst STYLES = process.env.STYLES || '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt/atlas/modules/202609040400-sld-styles.js';\n" + readFileSync('card-tests.part.mjs', 'utf8');
writeFileSync('test-card.mjs', s);
