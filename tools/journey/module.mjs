/** Deterministic, pinned-source preview assembly. Never modifies a live pointer. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const G = '202611171525', PARENT = '202611161720', BUDGET = 72000;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const hash = b => createHash('sha256').update(b).digest('hex');
export function assembleModule({generation = G} = {}) {
  assert.match(generation, /^\d{12}$/, "Generation must be a UTC minute identifier");
  const pin = JSON.parse(read('tools/journey/vendor-pin.json'));
  assert.equal(pin.commit, '65d48a851fc2ac74b13f939a0184e11298e7e5bd');
  const wrappers = [];
  const imports = {
    'network-topology.js': '',
    'journey-evidence.js': "import {index as topologyIndex} from './network-topology.js';",
    'edge-cover-journey.js': "import {canonicalJson, ordinal, prepareJourneyEvidence, sha256} from './journey-evidence.js';"
  };
  const aliases = {'network-topology.js': '', 'journey-evidence.js': 'const topologyIndex = JourneyTopology.index;', 'edge-cover-journey.js': 'const {canonicalJson, ordinal, prepareJourneyEvidence, sha256} = JourneyEvidence;'};
  const names = ['JourneyTopology', 'JourneyEvidence', 'JourneyEngine'];
  for (const [i, p] of pin.files.entries()) {
    const raw = fs.readFileSync(path.join(ROOT, 'tools/journey', p.vendorPath));
    assert.equal(raw.length, p.bytes, p.path); assert.equal(hash(raw), p.sha256, p.path);
    let text = raw.toString('utf8'); const file = path.basename(p.path);
    if (imports[file]) { assert.ok(text.includes(imports[file])); text = text.replace(imports[file], aliases[file]); }
    const exports = [...text.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    text = text.replace(/^export (?=(?:async )?(?:function|const) )/gm, '');
    assert.ok(!/^\s*(?:import|export) /m.test(text), 'Unexpected ESM syntax in pinned module');
    wrappers.push(`const ${names[i]} = (() => {\n${text}\nreturn Object.freeze({${exports.join(',')}});\n})();`);
  }
  assert.equal(hash(fs.readFileSync(path.join(ROOT, 'tools/journey/fixtures/reviewed-pair.v1.json'))), pin.sharedFixture.sha256);
  const fixture = JSON.parse(read('tools/journey/fixtures/synthetic-branch.v1.json'));
  assert.equal(fixture.synthetic, true);
  const controller = read('tools/journey/src/controller.mjs').replace('export function createJourneyController', 'function createJourneyController');
  const body = `/* GJ-03 PREVIEW ONLY. Canonical engine ${pin.repository}@${pin.commit}. No live pointer writes. */\n(() => {\n'use strict';\n${wrappers.join('\n')}\nconst JourneyFixture = ${JSON.stringify(fixture)};\nconst JourneyCSS = ${JSON.stringify(read('tools/journey/src/journey.css'))};\nconst JourneyGeneration = '${generation}';\n${controller}\n${read('tools/journey/src/bootstrap.js')}\n})();\n`;
  assert.ok(Buffer.byteLength(body) <= BUDGET, `Preview exceeds proposed ${BUDGET}B budget: ${Buffer.byteLength(body)}`);
  return {body, pin, fixture};
}
