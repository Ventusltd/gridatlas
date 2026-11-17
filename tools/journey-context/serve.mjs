import {createPreviewServer} from '../journey/serve.mjs';
import {G} from './build.mjs';
const port = Number(process.argv[2] || 8084);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1..65535');
const server = await createPreviewServer(port);
console.log(`GJ-04 CONTEXT PREVIEW ONLY http://127.0.0.1:${server.address().port}/atlas/v/${G}/`);
process.once('SIGINT', () => server.close(() => process.exit(0)));
