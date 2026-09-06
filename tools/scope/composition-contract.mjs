import assert from 'node:assert/strict';

// The v2 immutable shell requires these four replacements. Optional cartridges
// may be added, but deleting a required entry from both lists is never valid.
export const REQUIRED_CARTRIDGES=Object.freeze([
  'streaming-parquet-bridge','uk-gazetteer-flyto','substation-intelligence','sld-sandbox'
]);

export function validateCompositionContract(current){
  assert.equal(current?.schema,'gridatlas.current.v2','The composition contract requires schema v2');
  assert(Array.isArray(current.cartridges)&&Array.isArray(current.cartridge_order),'Both cartridge lists are required');
  const ids=current.cartridges.map(entry=>entry?.id),order=current.cartridge_order;
  assert(ids.every(id=>typeof id==='string'&&id.length>0),'Every cartridge needs an ID');
  assert.equal(new Set(ids).size,ids.length,'Duplicate cartridge ID');
  assert.equal(new Set(order).size,order.length,'Duplicate cartridge order entry');
  for(const id of REQUIRED_CARTRIDGES){
    assert(ids.includes(id),`Required cartridge absent from registry: ${id}`);
    assert(order.includes(id),`Required cartridge absent from order: ${id}`);
  }
  assert.deepEqual([...ids].sort(),[...order].sort(),'Registry and execution order must contain the same cartridge IDs');
}
