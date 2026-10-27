"""Prepare the real published layer corpus for CPU/GPU parity; never synthesize cases."""
import argparse, collections, hashlib, json, pathlib
import numpy as np
import pyarrow.parquet as pq

p=argparse.ArgumentParser();p.add_argument('--data-root',required=True);p.add_argument('--config',default='work/layer-config.json');p.add_argument('--out',default='work/layer-census');a=p.parse_args()
root=pathlib.Path(a.data_root);out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'manifest.json').read_text());artifacts={x['path']:x for x in manifest['artifacts']}
layers=[l for g in json.loads(pathlib.Path(a.config).read_text()) for l in g['layers']]
GEOM={'Point':1,'MultiPoint':1,'LineString':2,'MultiLineString':2}
def value(e,props):
 if not isinstance(e,list):return e
 op,*args=e
 if op=='get':return props.get(args[0])
 if op=='literal':return args[0]
 if op=='coalesce':return next((v for x in args if (v:=value(x,props)) is not None),None)
 if op=='all':return all(value(x,props) for x in args)
 if op=='any':return any(value(x,props) for x in args)
 if op=='!':return not value(args[0],props)
 if op=='==':return value(args[0],props)==value(args[1],props)
 if op=='!=':return value(args[0],props)!=value(args[1],props)
 if op=='in':return value(args[0],props) in (value(args[1],props) or '')
 if op=='>=':return (value(args[0],props) or 0)>=value(args[1],props)
 raise ValueError(op)
def coordinates(c):
 if c and isinstance(c[0],(int,float)):yield c[:2]
 else:
  for item in c:yield from coordinates(item)
cache={};descriptors=[];arrays={};coord_groups=[]
for layer in layers:
 name=layer['url'].rsplit('/',1)[-1].removesuffix('.geojson').removesuffix('.json')
 name={'repd_master':'repd_master_v8_oracle','uk_metros_trams':'uk_metros_trams_local_unwired'}.get(name,name)
 artifact=artifacts['partitions/'+name+'.parquet'];file=root/artifact['path']
 assert hashlib.sha256(file.read_bytes()).hexdigest()==artifact['sha256'],file
 if name not in cache:
  rows=pq.read_table(file).to_pylist();features=[{'geometry':json.loads(r['geometry_json']),'properties':json.loads(r['properties_json'])} for r in rows]
  cache[name]=features
  coord_groups.extend([xy for f in features for xy in coordinates(f['geometry']['coordinates'])])
 features=cache[name];prefix=layer['id'];expected_geom=2 if layer['type']=='line' else 1
 geom=np.array([GEOM.get(f['geometry']['type'],0) for f in features],dtype=np.int8)
 expected=np.array([GEOM.get(f['geometry']['type'],0)==expected_geom and (not layer.get('filter') or value(layer['filter'],f['properties'])) for f in features],dtype=np.bool_)
 arrays[prefix+'_geometry']=geom;arrays[prefix+'_cpu']=expected
 keys=set()
 def gather(e):
  if isinstance(e,list):
   if e[0]=='get':keys.add(e[1])
   for v in e[1:]:gather(v)
 gather(layer.get('filter'));vocab={}
 for key in keys:
  values=[f['properties'].get(key) for f in features]
  if all(v is None or isinstance(v,(int,float)) for v in values):arrays[prefix+'_'+key]=np.array([np.nan if v is None else v for v in values]);vocab[key]=None
  else:
   dictionary=list(dict.fromkeys(values));lookup={v:i for i,v in enumerate(dictionary)}
   arrays[prefix+'_'+key]=np.array([lookup[v] for v in values],dtype=np.int32);vocab[key]=dictionary
 descriptors.append({'id':prefix,'source':name,'sha256':artifact['sha256'],'features':len(features),'expected_geometry':expected_geom,'filter':layer.get('filter'),'vocabulary':vocab,'eligible_cpu':int(expected.sum())})
arrays['coordinates']=np.asarray(coord_groups,dtype=np.float64)
assert np.isfinite(arrays['coordinates']).all()
assert (np.abs(arrays['coordinates'][:,0])<=180).all() and (np.abs(arrays['coordinates'][:,1])<=90).all()
np.savez_compressed(out/'inputs.npz',**arrays)
(out/'manifest.json').write_text(json.dumps({'schema':'gridatlas.layer-census.v1','layers':descriptors,'sources':len(cache),'coordinates':len(coord_groups),'input_sha256':hashlib.sha256((out/'inputs.npz').read_bytes()).hexdigest()},indent=2))
print(json.dumps({'layers':len(descriptors),'sources':len(cache),'feature_layer_pairs':sum(x['features'] for x in descriptors),'coordinates':len(coord_groups),'zero_eligible':[x['id'] for x in descriptors if not x['eligible_cpu']]}))
