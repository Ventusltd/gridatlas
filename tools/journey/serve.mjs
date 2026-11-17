/** Read-only local preview server, serving the same LF text bytes as GitHub Pages. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {ROOT, G} from './build.mjs';
const types={'.html':'text/html','.json':'application/json','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.geojson':'application/json','.png':'image/png','.wasm':'application/wasm','.pbf':'application/x-protobuf','.woff2':'font/woff2'};
export async function createPreviewServer(port=0) {
  const server=http.createServer((req,res)=>{
    let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
    p=path.resolve(ROOT,'.'+p);if(!(p===ROOT||p.startsWith(ROOT+path.sep))){res.writeHead(403).end();return;}
    try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');let bytes=fs.readFileSync(p);const ext=path.extname(p);if(['.html','.json','.js','.mjs','.css','.geojson'].includes(ext))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.argv[2]||8084);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port must be1..65535');
  const server=await createPreviewServer(port);console.log(`GJ-03 PREVIEW ONLY http://127.0.0.1:${server.address().port}/atlas/v/${G}/`);
  process.once('SIGINT',()=>server.close(()=>process.exit(0)));
}
