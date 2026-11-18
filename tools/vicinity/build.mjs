import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Native journey search, law and motion remain a small additive module within the 500k repository ceiling.
export const BUDGET = 140000;
export function assemble({root = ROOT, generation = 'UNRELEASED'} = {}) {
  if (!/^(?:UNRELEASED|\d{12})$/.test(generation)) throw new Error('Invalid generation');
  const read = p => fs.readFileSync(path.join(root, 'tools/vicinity', p), 'utf8').replace(/\r\n/g, '\n');
  const model = read('src/model.mjs').replace(/^export /gm, '');
  const adapters = [['asset-context.mjs', 'collectAssetContext'], ['document-context.mjs', 'documentContextFor']].map(([file, api]) =>
    `const ${api} = (() => {\n${read('src/' + file).replace(/^export /gm, '')}\nreturn ${api};\n})();`).join('\n');
  const trainRead = file => fs.readFileSync(path.join(root,'tools/train',file),'utf8').replace(/\r\n/g,'\n').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  const train = `const TRAIN_STATION_SOURCE_PIN=${JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'tools/train/station-source.json'),'utf8')))};\nconst TrainCore=(()=>{\n${['src/station-index.mjs','src/scenario-stations.mjs','src/itinerary.mjs','src/place-bridge.mjs','src/route-plan.mjs','src/train-motion.mjs','fixtures/learning-networks.mjs'].map(trainRead).join('\n')}\nreturn {buildStationIndex,createScenarioStationStore,createItinerary,createPlaceBridge,normaliseJourneyLaw,buildRoutePlan,createTrainRide,trainLearningFixture};\n})();\n${trainRead('ui.js')}`;
  const body = `/* GridAtlas vicinity ${generation}: source-built spatial context, no inferred circuits. */\n(() => {\n'use strict';\nconst VICINITY_GENERATION=${JSON.stringify(generation)};\nconst VICINITY_CSS=${JSON.stringify(read('src/vicinity.css'))};\n${model}\n${adapters}\n${train}\n${read('src/bootstrap.js')}\n})();\n`;
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
