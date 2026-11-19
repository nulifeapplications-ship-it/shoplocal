import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDatabase } from './sqlite.mjs';
import app from './worker.mjs';

const flags = Object.fromEntries(process.argv.slice(2).flatMap((value,index,argv) => ['--host','--port'].includes(value) ? [[value,argv[index+1]]] : []));
const port = Number(flags['--port'] || process.env.PORT || 3000);
const database = process.env.DB_PATH || 'data/app.sqlite';
if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true });
const env = { PUSH_PUBLIC_KEY:process.env.PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY:process.env.PUSH_PRIVATE_KEY, PUSH_SUBJECT:process.env.PUSH_SUBJECT, DB: createDatabase(database), LOCAL: '1', PREVIEW: process.env.PREVIEW || '', SECURE_COOKIE: process.env.SECURE_COOKIE || '', FIRST_ADMIN_KEY: process.env.FIRST_ADMIN_KEY || '', FIRST_ADMIN_KEY_EXPIRES: process.env.FIRST_ADMIN_KEY_EXPIRES || '', ASSETS: {
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = new URL((path.startsWith('/draft-assets/')?'.':'./public') + path, import.meta.url);
    const type = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.csv':'text/csv; charset=utf-8'}[path.match(/\.[^.]+$/)?.[0]];
    if (!type || !existsSync(file)) return new Response('Not found',{status:404});
    return new Response(readFileSync(file),{headers:{'Content-Type':type}});
  }
} };
createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://' + (incoming.headers.host || 'localhost'));
    const requestHeaders=new Headers(incoming.headers);
    requestHeaders.set('x-nulife-local-client',incoming.socket.remoteAddress||'unknown');
    const options = { method: incoming.method, headers: requestHeaders };
    if (!['GET','HEAD'].includes(incoming.method)) Object.assign(options,{body:incoming,duplex:'half'});
    const res = await app.fetch(new Request(url,options),env);
    outgoing.writeHead(res.status,Object.fromEntries(res.headers));
    outgoing.end(Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    console.error(err);
    outgoing.writeHead(500).end();
  }
}).listen(port,flags['--host'] || '0.0.0.0',function() {console.log('NuLife Market listening on ' + this.address().port);});
