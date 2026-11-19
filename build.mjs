import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist',{recursive:true,force:true});
mkdirSync('dist/server',{recursive:true});
mkdirSync('dist/.openai',{recursive:true});
cpSync('.openai/hosting.json','dist/.openai/hosting.json');
cpSync('migrations','dist/migrations',{recursive:true});
cpSync('migrations','dist/drizzle',{recursive:true});
mkdirSync('dist/drizzle/meta',{recursive:true});
const entries=readdirSync('migrations').filter(file=>file.endsWith('.sql')).sort().map((file,idx)=>({
  idx,version:'6',when:1720000000000+idx,tag:file.slice(0,-4),breakpoints:false
}));
writeFileSync('dist/drizzle/meta/_journal.json',JSON.stringify({version:'7',dialect:'sqlite',entries},null,2));
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.csv':'text/csv; charset=utf-8'};
const files={};
for(const directory of ['public','draft-assets']) {
  for(const file of readdirSync(directory)) {
    const path=directory==='public'?'/'+file:'/draft-assets/'+file;
    files[path]=[types[file.match(/\.[^.]+$/)[0]],readFileSync(directory+'/'+file).toString('base64')];
  }
}
const handler=`
import worker from './worker.mjs';
const files=${JSON.stringify(files)};
const assets={async fetch(request) {
  const file=files[new URL(request.url).pathname];
  if(!file) return new Response('Not found',{status:404});
  const [type,binary]=file;
  return new Response(Uint8Array.from(atob(binary),x=>x.charCodeAt(0)),{headers:{'Content-Type':type}});
}};
export default {fetch(request,env,ctx) {return worker.fetch(request,{...env,ASSETS:assets},ctx);}};
`;
await build({stdin:{contents:handler,resolveDir:process.cwd()},outfile:'dist/server/index.js',bundle:true,platform:'browser',format:'esm',target:'es2022'});
writeFileSync('dist/server/wrangler.json',JSON.stringify({
  name:'nulife-market',main:'index.js',compatibility_date:'2026-01-01',
  d1_databases:[{binding:'DB',database_name:'nulife-market',database_id:manifest.project_id,migrations_dir:'../migrations'}]
},null,2));
