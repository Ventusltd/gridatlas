import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BUDGET = 48000;
export function assemble({root = ROOT, generation = 'UNRELEASED'} = {}) {
  if (!/^(?:UNRELEASED|\d{12})$/.test(generation)) throw new Error('Invalid generation');
  const read = p => fs.readFileSync(path.join(root, 'tools/vicinity', p), 'utf8').replace(/\r\n/g, '\n');
  const model = read('src/model.mjs').replace(/^export /gm, '');
  const body = `/* GridAtlas vicinity ${generation}: source-built spatial context, no inferred circuits. */\n(() => {\n'use strict';\nconst VICINITY_GENERATION=${JSON.stringify(generation)};\nconst VICINITY_CSS=${JSON.stringify(read('src/vicinity.css'))};\n${model}\n${read('src/bootstrap.js')}\n})();\n`;
  if (Buffer.byteLength(body) > BUDGET) throw new Error(`Vicinity module exceeds ${BUDGET} bytes`);
  return {body, bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex')};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  const generation = option('--generation') || 'UNRELEASED', output = option('--out');
  const result = assemble({generation});
  if (output) { fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true}); fs.writeFileSync(output, result.body); }
  console.log(JSON.stringify({generation, bytes: result.bytes, sha256: result.sha256, output: output || null}));
}
