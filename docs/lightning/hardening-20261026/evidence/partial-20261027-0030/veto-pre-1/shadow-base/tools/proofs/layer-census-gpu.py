"""Bounded CuPy geometry and filter census, independently checked against scalar CPU masks."""
import argparse,hashlib,json,pathlib,time
import cupy as cp
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--input',default='work/layer-census');a=p.parse_args();root=pathlib.Path(a.input)
manifest=json.loads((root/'manifest.json').read_text());assert hashlib.sha256((root/'inputs.npz').read_bytes()).hexdigest()==manifest['input_sha256']
data=np.load(root/'inputs.npz');started=time.perf_counter();results=[]
for layer in manifest['layers']:
 prefix=layer['id'];vocab=layer['vocabulary']
 def gpu(e):
  if not isinstance(e,list):return e
  op,*args=e
  if op in ['all','any']:
   masks=[gpu(x) for x in args];answer=masks[0]
   for mask in masks[1:]:answer=answer & mask if op=='all' else answer | mask
   return answer
  if op=='!':return ~gpu(args[0])
  if op in ['==','!=']:
   key=args[0][1];codes=cp.asarray(data[prefix+'_'+key]);dictionary=vocab[key]
   target=args[1] if dictionary is None else dictionary.index(args[1]) if args[1] in dictionary else -1
   return codes==target if op=='==' else codes!=target
  if op=='in':
   needle=args[0];key=args[1][1];dictionary=vocab[key]
   allowed=cp.asarray([i for i,v in enumerate(dictionary) if v is not None and needle in v],dtype=cp.int32)
   return cp.isin(cp.asarray(data[prefix+'_'+key]),allowed)
  raise ValueError('unsupported real layer filter '+op)
 mask=cp.asarray(data[prefix+'_geometry'])==layer['expected_geometry']
 if layer['filter']:mask &= gpu(layer['filter'])
 got=cp.asnumpy(mask);expected=data[prefix+'_cpu'];diff=int(np.count_nonzero(got!=expected));assert diff==0,(prefix,diff)
 assert got.any(),(prefix,'no geometry-compatible features satisfy the layer filter')
 results.append({'id':prefix,'examined':len(got),'eligible':int(got.sum()),'cpu_gpu_differences':diff})
xy=cp.asarray(data['coordinates']);invalid=int(cp.count_nonzero(~cp.isfinite(xy)).get());outside=int(cp.count_nonzero((cp.abs(xy[:,0])>180)|(cp.abs(xy[:,1])>90)).get());assert invalid==outside==0
cp.cuda.Stream.null.synchronize()
receipt={'status':'passed','gpu':cp.cuda.runtime.getDeviceProperties(0)['name'].decode(),'cupy':cp.__version__,'input_sha256':manifest['input_sha256'],'script_sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'layers':results,'coordinates':len(xy),'invalid_values':invalid,'out_of_range_coordinates':outside,'elapsed_seconds':time.perf_counter()-started,'scope':'Real published corpus only. Scalar CPU evaluates original property strings; GPU compares dictionary codes and numeric geometry/coordinate arrays. Not browser click or visual correctness proof; browser receipts are separate.'}
(root/'gpu-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt,indent=2))
