import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDatabase } from './sqlite.mjs';
import { passwordHash, seed } from './worker.mjs';
import { readFile } from 'node:fs/promises';

const address=(process.env.ADMIN_EMAIL||'').toLowerCase().trim();
const chunks=[];
for await (const chunk of process.stdin) chunks.push(chunk);
const password=Buffer.concat(chunks).toString().replace(/\r?\n$/,'');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || password.length<12 || password.length>128) {
  console.error('Supply ADMIN_EMAIL and a 12–128 character password through stdin.');
  process.exit(1);
}
const path=process.env.DB_PATH||'data/app.sqlite';
mkdirSync(dirname(path),{recursive:true});
const db=createDatabase(path);
await seed(db,process.env.PREVIEW==='1',{async fetch(request) {
  return new Response(await readFile(new URL('.'+new URL(request.url).pathname,import.meta.url)));
}});
const result=await db.prepare("INSERT INTO users (id,email,password,role) VALUES (?,?,?,'admin') ON CONFLICT(email) DO UPDATE SET password=excluded.password WHERE users.role='admin'").bind(crypto.randomUUID(),address,await passwordHash(password)).run();
if(result.meta.changes!==1) throw new Error('Email is already used by a vendor.');
console.log('Administrator ready: '+address);
