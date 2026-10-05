/** Exact change boundary: the previous SLD cartridge is carried forward byte for byte and the Esri imagery credit module is appended. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const current=JSON.parse(fs.readFileSync(new URL('atlas/current.json',root)));
const entry=current.cartridges.find(x=>x.id==='sld-sandbox');
const source=fs.readFileSync(new URL('atlas/'+entry.path,root),'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
const previous=fs.readFileSync(new URL('atlas/cartridges/202609241334-sld-sandbox-v9-8.js',root),'utf8');
const credit=fs.readFileSync(new URL('atlas/modules/202610050839-esri-imagery-credit.js',root),'utf8');
assert.equal(source,previous+'\n'+credit,'only the Esri imagery credit module may differ');
new vm.Script(source);

// The credit belongs to the imagery the engine actually draws.
const engine=current.cartridges.find(x=>x.id==='substation-intelligence');
const engineSource=fs.readFileSync(new URL('atlas/'+engine.path,root),'utf8');
assert.ok(engineSource.includes("map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']"),'engine still draws Esri World Imagery as sat-s');
assert.ok(engineSource.includes("map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s'"),'engine layer l-sat still uses sat-s');

// The module reads the layer state, names Esri, and removes itself when off.
for(const marker of [
 "m.getLayoutProperty('l-sat', 'visibility') === 'visible'",
 "'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community'",
 "node.append('Powered by ')",
 "link.href = 'https://www.esri.com'",
 "World_Imagery/MapServer?f=json",
 "if (strip) strip.remove();",
 "if (line) line.remove();",
 "document.querySelector('.custom-map-attrib')"
]) assert.ok(credit.includes(marker),'credit module missing '+marker);
assert.ok(!/innerHTML/.test(credit),'service text is written as text, never as markup');
console.log('SLD exact delta, SHA-256, syntax and Esri credit markers PASS; browser check runs separately.');
