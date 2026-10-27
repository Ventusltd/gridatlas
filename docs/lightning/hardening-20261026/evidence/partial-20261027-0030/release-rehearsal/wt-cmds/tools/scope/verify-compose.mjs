import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CURRENT_RELEASE, EXPECTED_RELEASES, SHARED_400KV_CARTRIDGE,
  invariant, readJson, sha256PublishedFile, relativePosix
} from './lib.mjs';

function releaseDirectories(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{12}-atlas-v9$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

try {
  const currentPath = path.join(ROOT, 'atlas', 'current.json');
  if (!fs.existsSync(currentPath)) {
    console.log('composition=SKIP atlas/current.json absent before Scope 1');
    process.exit(0);
  }
  const current = readJson(currentPath);
  if (current.schema !== 'gridatlas.current.v2') {
    console.log(`composition=SKIP schema=${current.schema} before Scope 2`);
    process.exit(0);
  }

  invariant(current.architecture === 'IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES', 'architecture mismatch');
  invariant(current.release_id === CURRENT_RELEASE, 'release identity mismatch');
  const releases = releaseDirectories(path.join(ROOT, 'atlas', 'releases'));
  invariant(JSON.stringify(releases) === JSON.stringify([...EXPECTED_RELEASES].sort()), `immutable release closure mismatch: ${JSON.stringify(releases)}`);
  invariant(releaseDirectories(ROOT).length === 0, 'top-level release copy found');

  const atlasIndex = fs.readFileSync(path.join(ROOT, 'atlas', 'index.html'), 'utf8');
  for (const marker of ['crypto.subtle.digest', 'cartridge_order', 'replace-script', 'document.write']) {
    invariant(atlasIndex.includes(marker), `atlas composer missing ${marker}`);
  }

  const shellIndexPath = path.resolve(path.join(ROOT, 'atlas'), current.shell.index);
  invariant(fs.existsSync(shellIndexPath), `shell index missing: ${relativePosix(shellIndexPath)}`);
  invariant(shellIndexPath === path.join(ROOT, 'atlas', 'releases', CURRENT_RELEASE, 'index.html'), 'shell index escaped fixed release');
  const shell = fs.readFileSync(shellIndexPath, 'utf8');
  const byId = new Map(current.cartridges.map(item => [item.id, item]));
  invariant(byId.size === current.cartridges.length, 'duplicate cartridge id');
  for (const id of current.cartridge_order) {
    const cartridge = byId.get(id);
    invariant(cartridge, `missing ordered cartridge ${id}`);
    const filePath = path.resolve(path.join(ROOT, 'atlas'), cartridge.path);
    invariant(filePath.startsWith(`${path.join(ROOT, 'atlas')}${path.sep}`), `${id}: cartridge escaped atlas`);
    invariant(fs.existsSync(filePath), `${id}: cartridge file missing`);
    invariant(sha256PublishedFile(filePath) === cartridge.sha256, `${id}: cartridge hash mismatch`);
    invariant(shell.includes(cartridge.replace_script), `${id}: replacement slot missing from immutable shell`);
  }

  const sharedPath = path.join(ROOT, 'atlas', 'releases', 'cartridges', SHARED_400KV_CARTRIDGE, 'grid_400kv.geojson');
  invariant(fs.existsSync(sharedPath), 'shared 400 kV content-addressed cartridge missing');
  invariant(sha256PublishedFile(sharedPath) === SHARED_400KV_CARTRIDGE, 'shared 400 kV content hash mismatch');

  if (current.cartridge_order.includes('uk-gazetteer-flyto')) {
    const cartridge = byId.get('uk-gazetteer-flyto');
    const source = fs.readFileSync(path.resolve(path.join(ROOT, 'atlas'), cartridge.path), 'utf8');
    for (const marker of [
      "GEOCODER_BASE = 'https://api.postcodes.io'",
      'Promise.all([',
      "kind: 'postcode'",
      "kind: 'postcode_district'",
      "kind: 'place'",
      "url.searchParams.delete('repd_ref')",
      'serial !== activeQuerySerial',
      'geocoder_failures'
    ]) invariant(source.includes(marker), `location cartridge missing ${marker}`);
    const contract = fs.readFileSync(path.join(ROOT, 'ui', 'cartridges', '202608301136-uk-gazetteer-flyto.mjs'), 'utf8');
    invariant(contract.includes("resultClass: 'LOCATION_ONLY'"), 'location contract result class mismatch');
    invariant(contract.includes('setsDeepLink: false'), 'location contract deep-link rule mismatch');
  }

  if (current.composition_manifest) {
    const manifestPath = path.resolve(path.join(ROOT, 'atlas'), current.composition_manifest);
    invariant(fs.existsSync(manifestPath), 'composition manifest missing');
    const manifest = readJson(manifestPath);
    invariant(manifest.generation === current.generation, 'composition manifest generation mismatch');
    invariant(JSON.stringify(manifest.cartridge_order) === JSON.stringify(current.cartridge_order), 'composition order mismatch');
    invariant(manifest.acceptance?.full_application_copies_created === 0, 'composition copied full application');
  }

  console.log(JSON.stringify({
    composition: 'PASS',
    generation: current.generation,
    release_id: current.release_id,
    immutable_releases: releases.length,
    cartridges: current.cartridge_order
  }));
} catch (error) {
  console.error(`[verify-compose] ${error?.stack || error}`);
  process.exitCode = 1;
}
