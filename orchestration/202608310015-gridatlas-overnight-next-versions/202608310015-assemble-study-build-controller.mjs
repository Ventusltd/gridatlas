import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.SOURCE_ROOT || process.cwd());
const source = path.join(root, 'orchestration/202608310015-gridatlas-overnight-next-versions');
const output = path.resolve(process.env.CONTROLLER_OUTPUT || path.join(root, 'work/202608310015-study-build-controller.mjs'));
const expected = new Map([
  ['202608310015-study-build-controller.part-00', 'b70db8723cbe7020adbeaa296ec5e94d93961eb2fcc6d776bad8ec74e71f8500'],
  ['202608310015-study-build-controller.part-01', 'e18f782eded3c464f84f09d0106bd948b30cad8267f4b56f04de7be5aa5298ef'],
  ['202608310015-study-build-controller.part-02', '401bd93dc0e097da92874cd6ea77f2faafc92dc7f1c30b01a52686dcac8e38c7'],
  ['202608310015-study-build-controller.part-03', '6cb8526e8a7885764955a996b4828760c5422f2f7f64b30c9876b4f6b01ee70f'],
  ['202608310015-study-build-controller.part-04', '4b194b34edeba7a14b3da84f08227ad2a29623bd59023ae7442f830d732d46ca'],
  ['202608310015-study-build-controller.part-05', 'b82908bd6acac006941f9ac03ce64db8a6fce7010ac054a0f869fa35833e3d5f'],
  ['202608310015-study-build-controller.part-06', 'ee42d39225c1e9f6631b0664f7b554c04df73a4a07c3d7aff5538269bcb97d62'],
  ['202608310015-study-build-controller.part-07', '13bfa16018843b927dd97df78b8b9ea681b768b57b816022e4d321e06c460058']
]);
const expectedController = '40d45d31f1e3c926b2261067f8870bc77f7df69399b119ef581ef4054ab0a901';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const chunks = [];
for (const [name, digest] of expected) {
  const bytes = await fs.readFile(path.join(source, name));
  const actual = sha256(bytes);
  if (actual !== digest) throw new Error(`${name}: SHA-256 ${actual} != ${digest}`);
  chunks.push(bytes);
}
const controller = Buffer.concat(chunks);
const actualController = sha256(controller);
if (actualController !== expectedController) throw new Error(`controller SHA-256 ${actualController} != ${expectedController}`);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, controller);
console.log(JSON.stringify({ output, parts: expected.size, bytes: controller.length, sha256: actualController }));
