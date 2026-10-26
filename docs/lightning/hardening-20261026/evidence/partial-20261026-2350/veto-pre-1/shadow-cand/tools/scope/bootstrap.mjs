import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MARKER = path.join(ROOT, 'state', 'scope-bootstrap.json');
const PARTS_DIR = path.join(ROOT, 'tools', 'scope', 'bootstrap-payload');
const PAYLOAD_SHA256 = '36bebe95281d401eff590ffaacd6dfc89171a3eca6d5096c8845c470214f9102';

function writeOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  );
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

try {
  if (fs.existsSync(MARKER)) {
    const marker = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
    if (marker.payload_sha256 !== PAYLOAD_SHA256) {
      throw new Error('scope bootstrap marker payload mismatch');
    }
    writeOutput({ bootstrapped: false, payload_sha256: PAYLOAD_SHA256 });
    console.log('scope-bootstrap=ALREADY_MATERIALISED');
    process.exit(0);
  }

  const parts = fs.readdirSync(PARTS_DIR)
    .filter(name => /^\d{2}\.part$/.test(name))
    .sort();
  if (parts.length !== 5) throw new Error(`scope bootstrap part closure mismatch: ${parts.length}`);
  const encoded = parts
    .map(name => fs.readFileSync(path.join(PARTS_DIR, name), 'utf8').trim())
    .join('');
  const raw = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  if (sha256(raw) !== PAYLOAD_SHA256) throw new Error('scope bootstrap payload SHA-256 mismatch');
  const payload = JSON.parse(raw.toString('utf8'));
  if (payload.schema !== 'gridatlas.scope-bootstrap-payload.v1' || payload.generation !== '202608301321') {
    throw new Error('scope bootstrap payload contract mismatch');
  }

  const entries = Object.entries(payload.files);
  for (const [relative, content] of entries) {
    if (relative.startsWith('/') || relative.split('/').includes('..')) {
      throw new Error(`unsafe bootstrap path ${relative}`);
    }
    const target = path.join(ROOT, ...relative.split('/'));
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== content) {
      throw new Error(`bootstrap refuses to overwrite ${relative}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }

  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, JSON.stringify({
    schema: 'gridatlas.scope-bootstrap.v1',
    generation: '202608301321',
    payload_sha256: PAYLOAD_SHA256,
    files: entries.length,
    status: 'MATERIALISED'
  }, null, 2) + '\n', 'utf8');

  writeOutput({ bootstrapped: true, payload_sha256: PAYLOAD_SHA256, files: entries.length });
  console.log(`scope-bootstrap=MATERIALISED files=${entries.length} sha256=${PAYLOAD_SHA256}`);
} catch (error) {
  console.error(`[scope-bootstrap] ${error?.stack || error}`);
  process.exitCode = 1;
}
