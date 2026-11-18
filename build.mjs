import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist',{recursive:true,force:true});
mkdirSync('dist/server',{recursive:true});
mkdirSync('dist/.openai',{recursive:true});
cpSync('.openai/hosting.json','dist/.openai/hosting.json');
cpSync('migrations','dist/migrations',{recursive:true});
cpSync('migrations','dist/drizzle',{recursive:true});
const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.csv':'text/csv; charset=utf-8'};
const files={};
for(const directory of ['public','draft-assets']) {
  for(const file of readdirSync(directory)) {
    const path=directory==='public'?'/'+file:'/draft-assets/'+file;
    files[path]=[types[file.match(/\.[^.]+$/)[0]],readFileSync(directory+'/'+file).toString('base64')];
  }
}
const drafts=readFileSync('draft-data.mjs','utf8').replace('export default','const drafts=');
const implementation=readFileSync('worker.mjs','utf8')
  .replace(/^import drafts .*\n/,'')
  .replace('export default {','const worker = {');
const handler=`
const files=${JSON.stringify(files)};
const assets={async fetch(request) {
  const file=files[new URL(request.url).pathname];
  if(!file) return new Response('Not found',{status:404});
  const [type,binary]=file;
  return new Response(Uint8Array.from(atob(binary),x=>x.charCodeAt(0)),{headers:{'Content-Type':type}});
}};
export default {fetch(request,env) {return worker.fetch(request,{...env,ASSETS:assets});}};
`;
writeFileSync('dist/server/index.js',drafts+'\n'+implementation+'\n'+handler);
writeFileSync('dist/server/wrangler.json',JSON.stringify({
  name:'nulife-market',main:'index.js',compatibility_date:'2026-01-01',
  d1_databases:[{binding:'DB',database_name:'nulife-market',database_id:manifest.project_id,migrations_dir:'../migrations'}]
},null,2));
