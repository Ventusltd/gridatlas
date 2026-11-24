import {createPreviewServer} from '../journey/serve.mjs';
const server=await createPreviewServer(Number(process.argv[2]||8768));
console.log(`Native M1 candidate http://127.0.0.1:${server.address().port}/atlas/v/satnav-native-m1/`);
