import drafts from "./draft-data.mjs";
import { pushConfigured, validPushEndpoint, validPushKeys, sendPush } from "./push.mjs";
const utf8 = new TextEncoder();
const statuses = {new:['confirmed','declined'],confirmed:['preparing','out_for_delivery','delivered'],preparing:['out_for_delivery','delivered'],out_for_delivery:['delivered'],declined:[],delivered:[]};
const id = () => crypto.randomUUID();
const hex = bytes => Array.from(new Uint8Array(bytes), x=>x.toString(16).padStart(2,'0')).join('');
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async value => hex(await crypto.subtle.digest('SHA-256',utf8.encode(value)));
const equal = (a,b) => {
  let diff = a.length ^ b.length;
  for (let i=0;i<b.length;i++) diff |= (a.charCodeAt(i)||0) ^ b.charCodeAt(i);
  return diff===0;
};
async function derive(password,salt) {
  const key = await crypto.subtle.importKey('raw',utf8.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:utf8.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
export async function passwordHash(password) {
  const salt=token();
  return salt+':'+await derive(password,salt);
}
const limit = (v,n=300) => typeof v==='string' ? v.trim().slice(0,n) : '';
const email = x => limit(x,254).toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validPassword = p => typeof p==='string' && p.length>=12 && p.length<=128;
const money = v => {
  const s=String(v ?? '').trim();
  return /^\d{1,7}(\.\d{1,2})?$/.test(s) ? Math.round(Number(s)*100) : null;
};
const slugify = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65).replace(/-$/,'') || 'store';
const cleanPhone = s => /^[+\d() .-]+$/.test(s) && /^\d{8,15}$/.test(s.replace(/\D/g,''));
const isID = s=>typeof s==='string' && /^[a-z0-9-]{10,60}$/i.test(s);
const fail = (error,status=400,details) => { throw Object.assign(new Error(error),{status,details}); };
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow'};
const json = (v,status=200,extra={}) => Response.json(v,{status,headers:{...headers,...extra}});
const sql = (db,query,...args) => db.prepare(query).bind(...args);
const one = (db,query,...args) => sql(db,query,...args).first();
const all = async (db,query,...args) => (await sql(db,query,...args).all()).results;
const run = (db,query,...args) => sql(db,query,...args).run();
const required = (ok,code='invalid') => {if(!ok) fail(code);};

const previewStores = [
 ['sample-garden','north-coast-garden','North Coast Garden','Fresh tropical fruit, garden greens, and harvest boxes for your stay.','Frutas tropicales, verduras y canastas para tu estadía.','produce','/produce.webp',15000],
 ['sample-bakehouse','casa-palmera-bakehouse','Casa Palmera Bakehouse','Small-batch breads and pastries, baked fresh for slow island mornings.','Pan y repostería artesanal para disfrutar las mañanas en la isla.','bakery','/bakery.webp',12000],
 ['sample-kitchen','brisa-island-kitchen','Brisa Island Kitchen','Dominican comfort food made for sharing around the villa table.','Comida dominicana para compartir en la villa.','meals','/meals.webp',18000]
];
const previewProducts = [
 ['sample-garden','MANGO','Mangoes / Mangos','Ripe tropical mangoes. / Mangos tropicales maduros.',9500,'lb','/produce.webp'],
 ['sample-garden','BOX','Tropical fruit box / Canasta tropical','Seasonal mixed fruit. / Frutas variadas de temporada.',75000,'package','/produce.webp'],
 ['sample-bakehouse','LOAF','Country sourdough / Pan de masa madre','Slow-fermented artisan loaf. / Pan artesanal de fermentación lenta.',36000,'unit','/bakery.webp'],
 ['sample-kitchen','PLATE','Dominican lunch / Almuerzo dominicano','Chicken, rice, beans and plantain. / Pollo, arroz, habichuelas y plátano.',49000,'unit','/meals.webp']
];
async function seed(db, preview, assets) {
  const drafts=[['draft-luiyi','luiyi-organic-farm','Luiyi Organic Farm'],['draft-ilia','ilia','Ilia']];
  const statements=drafts.map(s=>sql(db,'INSERT OR IGNORE INTO stores (id,slug,name) VALUES (?,?,?)',...s));
  if(preview) {
    for(const [store,slug,name,en,es,category,logo,fee] of previewStores) {
      statements.push(sql(db,"INSERT OR IGNORE INTO stores (id,slug,name,description,category,areas,hours,fee,logo,approved,demo) VALUES (?,?,?,?,?,'Sosúa, Cabarete','08:00–17:00',?,?,1,1)",store,slug,name,en+' / '+es,category,fee,logo));
    }
    for(const [store,code,name,description,cents,unit,photo] of previewProducts) {
      statements.push(sql(db,'INSERT OR IGNORE INTO products (id,store,code,name,description,cents,unit,photo) VALUES (?,?,?,?,?,?,?,?)',store+'-'+code,store,code,name,description,cents,unit,photo));
    }
  }
  await db.batch(statements);
  if (assets) await seedDrafts(db,assets);
}
function cookie(key,max,env) {
  return 'nulife_session='+key+'; Max-Age='+max+'; HttpOnly; Path=/; SameSite=Lax'+(!env.LOCAL||env.SECURE_COOKIE?'; Secure':'');
}
async function session(db,user,env,request) {
  const key=token();
  const max=60*60*24*14;
  const old=cookieToken(request);
  const writes=[sql(db,'INSERT INTO sessions VALUES (?,?,?)',await digest(key),user.id,Date.now()+max*1000),sql(db,'DELETE FROM sessions WHERE expires<=?',Date.now())];
  if(old) writes.push(sql(db,'DELETE FROM sessions WHERE token=?',await digest(old)));
  await db.batch(writes);
  return json({role:user.role,store:user.store},200,{'Set-Cookie':cookie(key,max,env)});
}
function cookieToken(req) {return (req.headers.get('cookie')||'').match(/(?:^|;\s*)nulife_session=([a-f0-9]{64})(?:;|$)/)?.[1];}
async function actor(req,db,preview) {
  const key=cookieToken(req);
  return key ? one(db,'SELECT users.id, email, role, store FROM users JOIN sessions ON users.id=sessions.user_id WHERE token=? AND expires>? AND (users.demo=0 OR ?=1)',await digest(key),Date.now(),Number(preview)) : null;
}
function role(user,permission) {
  if(!user) fail('sign_in',401);
  if(permission && user.role!==permission) fail('forbidden',403);
}
async function payload(req) {
  const reader=req.body?.getReader();
  if(!reader) fail('invalid');
  let output='';
  let bytes=0;
  const decoder=new TextDecoder();
  try {
    for(;;) {
      const next=await reader.read();
      if(next.done) break;
      bytes+=next.value.byteLength;
      if(bytes>3_300_000) { await reader.cancel(); fail('too_large',413); }
      output+=decoder.decode(next.value,{stream:true});
    }
    const value=JSON.parse(output+decoder.decode());
    if(!value || typeof value!=='object' || Array.isArray(value)) fail('invalid');
    return value;
  } catch(err) {if(err.status) throw err; fail('invalid');}
}
async function photo(db,store,value,clear,current) {
  if(clear) return null;
  if(value===undefined || value==='') return current??null;
  if(typeof value!=='string') fail('image');
  const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match) fail('image');
  let bytes;
  try {bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));} catch {fail('image');}
  if(bytes.length>2_300_000 || bytes.length<12) fail('image');
  const valid={
    'image/jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
    'image/png':[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),
    'image/webp':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  };
  if(!valid[match[1]]) fail('image');
  const media=id();
  // D1 caps individual database rows at 2 MB.
  if(bytes.length>1_800_000) fail('image');
  await run(db,'INSERT INTO media VALUES (?,?,?,?)',media,store,match[1],bytes.buffer);
  return '/media/'+media;
}
const documentedFields=['code','name','category','description','price','unit','pack','hidden','soldout'];
function validateProduct(v) {
  const code=limit(v.code,60).toUpperCase(), name=limit(v.name,140), cents=money(v.price);
  const unit=({unidad:'unit',paquete:'package',libra:'lb',pound:'lb'})[limit(v.unit,15).toLowerCase()]||limit(v.unit,15).toLowerCase();
  required(/^[A-Z0-9_.-]{1,60}$/.test(code),'product_code');
  required(name && cents!==null && cents>0 && ['unit','package','lb'].includes(unit),'product_fields');
  const flag = x => {
    if(x===undefined || x==='' || ['false','0','no'].includes(String(x).toLowerCase())) return 0;
    if(['true','1','yes','sí','si'].includes(String(x).toLowerCase())) return 1;
    fail('product_fields');
  };
  return {code,name,cents,unit,pack:limit(v.pack,70),category:limit(v.category,80),description:limit(v.description,1200),hidden:flag(v.hidden),soldout:flag(v.soldout)};
}
function parseCSV(value) {
  const csv=limit(value,180001).replace(/^\uFEFF/,'');
  required(csv.length>0&&csv.length<=180000,'csv_size');
  const rows=[];
  let row=[], field='', quoted=false, closed=false, line=1, start=1;
  const cell=()=>{row.push(field.trim());field='';closed=false;};
  const record=()=>{
    cell();
    if(row.some(Boolean)) rows.push({line:start,fields:row});
    row=[];
    start=line+1;
  };
  for(let i=0;i<csv.length;i++) {
    const c=csv[i];
    if(quoted) {
      if(c==='"') {
        if(csv[i+1]==='"') {field+='"';i++;} else {quoted=false;closed=true;}
      } else {field+=c;if(c==='\n') line++;}
      continue;
    }
    if(c==='\r' && csv[i+1]==='\n') continue;
    if(c===',' ) cell();
    else if(c==='\n'||c==='\r') {record();line++;}
    else if(c==='"' && !field && !closed) quoted=true;
    else if(c==='"'||closed&&c!==' ') fail('csv_format',400,{line});
    else field+=c;
  }
  if(quoted) fail('csv_format',400,{line});
  record();
  const fields=rows.shift()?.fields.map(x=>x.toLowerCase())||[];
  required(fields.length===documentedFields.length && documentedFields.every(x=>fields.includes(x)),'csv_header');
  required(rows.length>0 && rows.length<=100,'csv_size');
  const used=new Set();
  return rows.map(({line,fields:values})=>{
    try {
      required(values.length===fields.length,'csv_format');
      const product=validateProduct(Object.fromEntries(fields.map((key,i)=>[key,values[i]])));
      required(!used.has(product.code),'duplicate_code');
      used.add(product.code);
      return {line,product};
    } catch(error) { return {line,error:error.message}; }
  });
}
const publicStoreColumns=`id,slug,name,description,category,areas,hours,fee,instructions,logo,demo,nulife_managed,
  CASE WHEN nulife_managed=1 THEN managed_contact ELSE contact END AS contact`;
const liveCheckout=`stores.demo=0 AND stores.areas<>'' AND stores.hours<>'' AND stores.fee IS NOT NULL
  AND CASE WHEN stores.nulife_managed=1 THEN stores.managed_contact<>'' ELSE stores.contact<>''
  AND EXISTS(SELECT 1 FROM users WHERE users.store=stores.id AND users.role='vendor' AND users.demo=0) END`;
const publicProductColumns='id,name,category,description,cents,unit,pack,photo,soldout';
const nqty = (q,unit) => {
  const num=Number(q);
  const scaled=Math.round(num*1000);
  return typeof q==='number' && Number.isFinite(num) && num>0 && num<=1000 && Math.abs(scaled/1000-num)<1e-9 && (unit==='lb'||scaled%1000===0) ? scaled : null;
};
const lineTotal = item => Math.round(item.cents*(item.actual??item.quantity)/1000);
function orderData(row,isGuest=false) {
  const items=JSON.parse(row.items);
  const {token:privateToken,attempt,managed_contact,...rest}=row;
  if(isGuest) {
    delete rest.phone;
    delete rest.notes;
  }
  return {...rest,...(!isGuest?{}:{contact:row.contact}),items,total:items.reduce((sum,p)=>sum+lineTotal(p),row.fee??0),estimated:row.fee==null||items.some(p=>p.unit==='lb'&&p.actual==null)};
}
const joinedOrder=`SELECT orders.*, stores.name AS store_name,
  CASE WHEN orders.nulife_managed=1 THEN orders.managed_contact ELSE stores.contact END AS contact
  FROM orders JOIN stores ON stores.id=orders.store`;
async function updateOrder(db,row,v) {
  const status=v.status||row.status;
  required(status===row.status||statuses[row.status].includes(status),'status_change');
  const items=JSON.parse(row.items);
  if(v.weights!==undefined) {
    required(v.weights && typeof v.weights==='object' && !Array.isArray(v.weights),'quantity');
    required(!['declined','delivered'].includes(row.status),'status_change');
    for(const [product,weight] of Object.entries(v.weights)) {
      const item=items.find(x=>x.id===product&&x.unit==='lb');
      const actual=nqty(weight,'lb');
      required(item&&actual,'quantity');
      item.actual=actual;
    }
  }
  if(status==='delivered'&&items.some(x=>x.unit==='lb'&&x.actual==null)) fail('weight_required');
  const result=await run(db,'UPDATE orders SET status=?,items=?,updated=? WHERE id=? AND store=? AND status=? AND items=?',
    status,JSON.stringify(items),Date.now(),row.id,row.store,row.status,row.items);
  if(result.meta.changes!==1) fail('status_change',409);
  return json({ok:true});
}
function validDelivery(day,time) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const date=new Date(day+'T'+time+':00-04:00');
  return Number.isFinite(date.valueOf()) && new Date(date.valueOf()-4*3600000).toISOString().slice(0,10)===day && date.valueOf()>Date.now()-5*60000;
}

async function deliverOrderAlerts(env,origin) {
  const {DB:db}=env, now=Date.now(), lease=now+30000;
  await run(db,`DELETE FROM order_alerts WHERE id IN (
    SELECT alerts.id FROM order_alerts AS alerts JOIN orders ON orders.id=alerts.order_id
    JOIN push_subscriptions AS subscriptions ON subscriptions.endpoint=alerts.endpoint
    WHERE orders.status<>'new' OR orders.created<? OR subscriptions.user_id<>alerts.user_id LIMIT 100
  )`,now-86400000);
  const claimed=await all(db,`UPDATE order_alerts SET next_at=?,attempts=attempts+1 WHERE id IN (
    SELECT alerts.id FROM order_alerts AS alerts JOIN orders ON orders.id=alerts.order_id
    JOIN push_subscriptions AS subscriptions ON subscriptions.endpoint=alerts.endpoint AND subscriptions.user_id=alerts.user_id
    JOIN users ON users.id=alerts.user_id AND users.demo=0
    WHERE alerts.next_at<=? AND orders.status='new' AND orders.created>=? ORDER BY alerts.next_at,alerts.id LIMIT 8
  ) RETURNING id`,lease,now,now-86400000);
  if(!claimed.length) return;
  const alerts=await all(db,`SELECT alerts.id AS alert_id,alerts.attempts,alerts.order_id,subscriptions.endpoint,
    subscriptions.user_id,subscriptions.p256dh,subscriptions.auth,subscriptions.language,users.role
    FROM order_alerts AS alerts
    JOIN push_subscriptions AS subscriptions ON subscriptions.endpoint=alerts.endpoint AND subscriptions.user_id=alerts.user_id
    JOIN users ON users.id=alerts.user_id
    JOIN orders ON orders.id=alerts.order_id AND orders.status='new'
    WHERE alerts.id IN (${claimed.map(()=>'?').join(',')}) AND alerts.next_at=?`,...claimed.map(row=>row.id),lease);
  await Promise.all(alerts.map(async alert=>{
    let result=await sendPush(env,origin,alert,{role:alert.role,id:alert.order_id});
    // Retry an initial transient failure immediately while the checkout Worker is still active.
    if(result.temporary && !result.delay && alert.attempts===1) {
      await new Promise(resolve=>setTimeout(resolve,1000));
      result=await sendPush(env,origin,alert,{role:alert.role,id:alert.order_id});
    }
    if(result.expired) {
      await run(db,'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=? AND p256dh=?',alert.endpoint,alert.user_id,alert.p256dh);
    } else if(result.sent || alert.attempts>=5) {
      await run(db,'DELETE FROM order_alerts WHERE id=? AND next_at=?',alert.alert_id,lease);
    } else {
      const backoff=30000*2**(alert.attempts-1);
      await run(db,'UPDATE order_alerts SET next_at=? WHERE id=? AND next_at=?',
        Date.now()+Math.min(3600000,Math.max(backoff,result.delay||0)),alert.alert_id,lease);
    }
  }));
}
async function dispatchOrderAlerts(env,origin,ctx) {
  if(!pushConfigured(env)) return;
  const work=deliverOrderAlerts(env,origin).catch(()=>console.error('NuLife order alert dispatch failed'));
  if(ctx) ctx.waitUntil(work);
  else await work;
}

async function notificationApi(req,env,url,user,ctx) {
  role(user);
  const db=env.DB, configured=pushConfigured(env);
  if(req.method==='GET') {
    const count=user.role==='admin'
      ?await one(db,`SELECT count(*) AS pending FROM orders JOIN stores ON orders.store=stores.id
        WHERE orders.nulife_managed=1 AND orders.status='new' AND stores.demo=0`)
      :await one(db,"SELECT count(*) AS pending FROM orders WHERE store=? AND nulife_managed=0 AND status='new'",user.store);
    await dispatchOrderAlerts(env,url.origin,ctx);
    return json({publicKey:configured?env.PUSH_PUBLIC_KEY:'',pending:count.pending});
  }
  if(req.method!=='POST') fail('not_found',404);
  const v=await payload(req);
  if(!validPushEndpoint(v.endpoint)) fail('push_subscription');
  if(v.action==='check') {
    const enabled=await one(db,'SELECT 1 FROM push_subscriptions WHERE endpoint=? AND user_id=?',v.endpoint,user.id);
    return json({enabled:Boolean(enabled)});
  }
  if(v.action==='disable') {
    await run(db,'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?',v.endpoint,user.id);
    return json({ok:true});
  }
  if(!configured) fail('push_unavailable',503);
  if(v.action==='enable') {
    if(!validPushKeys(v.keys)) fail('push_subscription');
    await run(db,`INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,language) VALUES (?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,language=excluded.language`,
      v.endpoint,user.id,v.keys.p256dh,v.keys.auth,v.language==='es'?'es':'en');
    return json({ok:true});
  }
  if(v.action==='test') {
    const now=Date.now();
    const subscription=await one(db,`UPDATE push_subscriptions SET last_test=? WHERE endpoint=? AND user_id=? AND last_test<?
      RETURNING endpoint,p256dh,auth,language`,now,v.endpoint,user.id,now-15000);
    if(!subscription) fail('push_test_wait',409);
    const result=await sendPush(env,url.origin,subscription,{role:user.role});
    if(result.expired) {
      await run(db,'DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=? AND p256dh=?',v.endpoint,user.id,subscription.p256dh);
      fail('push_expired',409);
    }
    if(!result.sent) fail('push_delivery',502);
    return json({ok:true});
  }
  fail('invalid');
}

async function api(req,env,path,ctx) {
  const db=env.DB;
  const method=req.method;
  const url=new URL(req.url);
  if(method==='POST') {
    const origin=req.headers.get('origin');
    if((origin&&origin!==url.origin)||req.headers.get('sec-fetch-site')==='cross-site') fail('forbidden',403);
    if(req.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json') fail('invalid',415);
  }
  const preview=env.PREVIEW==='1';
  const visible=preview?'1=1':'stores.demo=0';
  const checkout='stores.approved=1 AND stores.paused=0 AND '+(preview?'1=1':liveCheckout);
  const user=await actor(req,db,preview);
  const p=async()=>payload(req);
  const params=url.searchParams;

  if(method==='GET'&&path==='/api/config') return json({preview});
  if(method==='GET'&&path==='/api/stores') {
    if(preview && !await one(db,'SELECT 1 FROM stores WHERE demo=1 LIMIT 1')) await seed(db,true);
    return json({stores:await all(db,'SELECT '+publicStoreColumns+', ('+checkout+') AS orderable FROM stores WHERE approved=1 AND paused=0 AND '+visible+' ORDER BY demo, name')});
  }
  if(method==='GET'&&path.startsWith('/api/store/')) {
    const store=await one(db,'SELECT '+publicStoreColumns+', ('+checkout+') AS orderable FROM stores WHERE slug=? AND approved=1 AND paused=0 AND '+visible,path.split('/').pop());
    if(!store) fail('not_found',404);
    return json({store,products:await all(db,'SELECT '+publicProductColumns+' FROM products WHERE store=? AND hidden=0 AND paused=0 ORDER BY category,name',store.id)});
  }
  if(method==='GET'&&path==='/api/me') return json({user});
  if(path==='/api/notifications') return notificationApi(req,env,url,user,ctx);
  if(method==='POST'&&path==='/api/setup') {
    const v=await p();
    if(!env.FIRST_ADMIN_KEY || typeof v.key!=='string' || !equal(v.key,env.FIRST_ADMIN_KEY)
      || (env.FIRST_ADMIN_KEY_EXPIRES && !(Number(env.FIRST_ADMIN_KEY_EXPIRES)>Date.now()))) fail('setup_link',404);
    const address=email(v.email);
    required(validEmail(address)&&validPassword(v.password)&&!address.endsWith('@nulife-preview.test'),'credentials');
    if(await one(db,"SELECT 1 FROM users WHERE role='admin' AND demo=0")) fail('setup_done',409);
    if(await one(db,'SELECT 1 FROM users WHERE email=?',address)) fail('email_used',409);
    await seed(db,preview,env.ASSETS);
    const result=await run(db,"INSERT OR IGNORE INTO users (id,email,password,role) SELECT ?,?,?,'admin' WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin' AND demo=0)",id(),address,await passwordHash(v.password));
    if(result.meta.changes!==1) fail('setup_done',409);
    return json({ok:true});
  }
  if(method==='POST'&&path==='/api/login') {
    const v=await p(), address=email(v.email);
    const now=Date.now();
    const ip=env.LOCAL?req.headers.get('x-nulife-local-client'):req.headers.get('cf-connecting-ip');
    const keys=[await digest('email:'+address),...(ip?[await digest('ip:'+ip)]:[])];
    const results=await db.batch(keys.map(key=>sql(db,`INSERT INTO login_attempts VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
      expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count`,key,now+900000,now,now)));
    if(results.some((result,i)=>result.results[0].count>(i===0?12:60))) fail('login_limit',429);
    let account=validEmail(address)?await one(db,'SELECT * FROM users WHERE email=? AND (demo=0 OR ?=1)',address,Number(preview)):null;
    if(!account && preview && env.PREVIEW_ADMIN_PASSWORD && address===env.PREVIEW_ADMIN_EMAIL
          && validPassword(v.password) && equal(v.password,env.PREVIEW_ADMIN_PASSWORD)) {
      const password=await passwordHash(v.password);
      await seed(db,true,env.ASSETS);
      await run(db,"INSERT OR IGNORE INTO users (id,email,password,role,demo) SELECT ?,?,?,'admin',1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin')",id(),address,password);
      account=await one(db,"SELECT * FROM users WHERE email=? AND role='admin'",address);
    }
    const [salt,hash]=(account?.password||'0:0').split(':');
    const supplied=await derive(typeof v.password==='string'?v.password.slice(0,128):'',salt);
    if(!account||!validPassword(v.password)||!equal(supplied,hash)) fail('login_failed',401);
    await db.batch([sql(db,'DELETE FROM login_attempts WHERE key=?',keys[0]),sql(db,'DELETE FROM login_attempts WHERE expires<=?',now)]);
    return session(db,account,env,req);
  }
  if(method==='POST'&&path==='/api/logout') {
    const key=cookieToken(req);
    if(key) await run(db,'DELETE FROM sessions WHERE token=?',await digest(key));
    return json({ok:true},200,{'Set-Cookie':cookie('',0,env)});
  }
  if(path==='/api/invite' && ['GET','POST'].includes(method)) {
    const v=method==='POST'?await p():{token:params.get('token')};
    if(!/^[a-f0-9]{64}$/.test(v.token||'')) fail('invite_invalid',404);
    const hash=await digest(v.token);
    const invite=await one(db,'SELECT invites.*,stores.name FROM invites JOIN stores ON stores.id=invites.store WHERE token=? AND expires>? AND claim IS NULL AND '+visible,hash,Date.now());
    if(!invite) fail('invite_invalid',404);
    if(method==='GET') return json({name:invite.name});
    const address=email(v.email);
    required(validEmail(address)&&validPassword(v.password)&&(preview||!address.endsWith('@nulife-preview.test')),'credentials');
    const account={id:id(),store:invite.store,role:'vendor'};
    const password=await passwordHash(v.password);
    let result;
    try {
      result=await db.batch([
        sql(db,"UPDATE invites SET claim=? WHERE token=? AND claim IS NULL AND expires>? AND NOT EXISTS(SELECT 1 FROM users WHERE store=?)",account.id,hash,Date.now(),account.store),
        sql(db,"INSERT INTO users (id,email,password,role,store,demo) SELECT ?,?,?,'vendor',store,? FROM invites WHERE token=? AND claim=?",account.id,address,password,Number(address.endsWith('@nulife-preview.test')),hash,account.id)
      ]);
    } catch(error) {
      if(String(error).includes('UNIQUE')) fail('email_used',409);
      throw error;
    }
    if(result[1].meta.changes!==1) fail('invite_invalid',409);
    return session(db,account,env,req);
  }

  if(method==='GET'&&path.startsWith('/api/status/')) {
    const t=path.split('/').pop();
    if(!/^[a-f0-9]{64}$/.test(t)) fail('not_found',404);
    const row=await one(db,joinedOrder+' WHERE orders.token=? AND '+visible,await digest(t));
    if(!row) fail('not_found',404);
    await dispatchOrderAlerts(env,url.origin,ctx);
    return json({order:orderData(row,true)});
  }
  if(method==='POST'&&path==='/api/order') {
    const v=await p();
    const attempt=limit(v.attempt,90);
    required(/^[a-f0-9-]{36}$/.test(attempt),'invalid');
    const attemptHash=await digest(attempt);
    const old=await one(db,'SELECT orders.number FROM orders JOIN stores ON stores.id=orders.store WHERE orders.attempt=? AND '+visible,attemptHash);
    if(old) return json({number:old.number,token:await digest('order:'+attempt),repeated:true});
    const store=await one(db,'SELECT id,fee FROM stores WHERE id=? AND '+checkout,limit(v.store,80));
    if(!store) fail('unavailable',409);
    const guest=limit(v.guest,140), phone=limit(v.phone,40), property=limit(v.property,140), room=limit(v.room,80);
    const date=limit(v.date,10), time=limit(v.time,5), notes=limit(v.notes,1200);
    required(guest&&property&&room&&cleanPhone(phone),'checkout_fields');
    required(validDelivery(date,time),'delivery_date');
    required(Array.isArray(v.items)&&v.items.length&&v.items.length<=16,'cart');
    const keys=v.items.map(item=>item?.id);
    required(keys.every(isID)&&new Set(keys).size===keys.length,'cart');
    const records=await all(db,'SELECT id,name,cents,unit,pack,hidden,paused,soldout FROM products WHERE store=? AND id IN ('+keys.map(()=>'?').join(',')+')',store.id,...keys);
    const byKey=new Map(records.map(row=>[row.id,row]));
    const items=v.items.map(item=>{
      const product=byKey.get(item.id);
      if(!product || product.hidden || product.paused || product.soldout) fail('unavailable',409);
      if(product.cents!==item.cents || product.unit!==item.unit) fail('price_changed',409);
      const quantity=nqty(item.quantity,product.unit);
      required(quantity,'quantity');
      return {id:product.id,name:product.name,cents:product.cents,unit:product.unit,pack:product.pack,quantity,actual:null};
    });
    if(store.fee!==(v.fee??null)) fail('price_changed',409);
    const number='NL-'+token().slice(0,10).toUpperCase(), privateLink=await digest('order:'+attempt);
    const now=Date.now();
    // Verify the catalog and store again within the insert statement.
    const conditions=items.map(()=>"(id=? AND cents=? AND unit=? AND name=? AND pack=?)").join(' OR ');
    const orderID=id();
    const insert=sql(db,`INSERT OR IGNORE INTO orders (id,number,token,store,guest,phone,property,room,delivery_date,delivery_time,notes,fee,items,created,updated,attempt,nulife_managed,managed_contact)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,nulife_managed,CASE WHEN nulife_managed=1 THEN managed_contact ELSE '' END
      FROM stores WHERE id=? AND fee IS ? AND ${checkout}
      AND (SELECT count(*) FROM products WHERE store=? AND hidden=0 AND paused=0 AND soldout=0 AND (${conditions}))=?`,
      orderID,number,await digest(privateLink),store.id,guest,phone,property,room,date,time,notes,store.fee,JSON.stringify(items),now,now,attemptHash,
      store.id,store.fee,store.id,...items.flatMap(x=>[x.id,x.cents,x.unit,x.name,x.pack]),items.length);
    // Save the notification jobs in the same transaction as the order.
    const enqueue=sql(db,`INSERT INTO order_alerts (order_id,endpoint,user_id,next_at)
      SELECT orders.id,subscriptions.endpoint,users.id,orders.created
      FROM orders JOIN stores ON stores.id=orders.store AND stores.demo=0
      JOIN users ON users.demo=0 AND (
        (orders.nulife_managed=1 AND users.role='admin')
        OR (orders.nulife_managed=0 AND users.role='vendor' AND users.store=orders.store)
      )
      JOIN push_subscriptions AS subscriptions ON subscriptions.user_id=users.id
      WHERE orders.id=?`,orderID);
    const [result]=await db.batch([insert,enqueue]);
    if(result.meta.changes!==1) {
      const existing=await one(db,'SELECT orders.number FROM orders JOIN stores ON stores.id=orders.store WHERE orders.attempt=? AND '+visible,attemptHash);
      if(existing) return json({number:existing.number,token:privateLink,repeated:true});
      fail('unavailable',409);
    }
    await dispatchOrderAlerts(env,url.origin,ctx);
    return json({number,token:privateLink},201);
  }

  if(path.startsWith('/api/vendor/')) {
    role(user,'vendor');
    const store=await one(db,'SELECT *, ('+checkout+') AS orderable FROM stores WHERE id=? AND '+visible,user.store);
    if(!store) fail('not_found',404);
    if(method==='GET'&&path==='/api/vendor/store') {
      const {managed_contact,...details}=store;
      return json({store:details,products:await all(db,'SELECT * FROM products WHERE store=? ORDER BY name',store.id)});
    }
    if(method==='POST'&&path==='/api/vendor/store') {
      const v=await p(), name=limit(v.name,140), contact=limit(v.contact,80), feeText=String(v.fee??'').trim();
      const fee=feeText===''?null:money(feeText);
      required(name&&(!contact||cleanPhone(contact))&&(feeText===''||fee!==null),'store_fields');
      const logo=await photo(db,store.id,v.logo,v.clearLogo,store.logo);
      await run(db,`UPDATE stores SET name=?,description=?,category=?,contact=?,
        areas=CASE WHEN nulife_managed=1 THEN areas ELSE ? END,
        hours=CASE WHEN nulife_managed=1 THEN hours ELSE ? END,
        fee=CASE WHEN nulife_managed=1 THEN fee ELSE ? END,
        instructions=?,logo=? WHERE id=?`,
        name,limit(v.description,1600),limit(v.category,80),contact,limit(v.areas,300),limit(v.hours,300),fee,limit(v.instructions,1200),logo,store.id);
      return json({ok:true});
    }
    if(method==='POST'&&path==='/api/vendor/product') {
      const v=await p();
      const product=validateProduct(v);
      const old=v.id?await one(db,'SELECT * FROM products WHERE id=? AND store=?',limit(v.id,75),store.id):null;
      if(v.id&&!old) fail('not_found',404);
      const media=await photo(db,store.id,v.photo,v.clearPhoto,old?.photo);
      const fields=[product.code,product.name,product.category,product.description,product.cents,product.unit,product.pack,media,product.hidden,product.soldout];
      try {
        if(old) await run(db,'UPDATE products SET code=?,name=?,category=?,description=?,cents=?,unit=?,pack=?,photo=?,hidden=?,soldout=? WHERE id=? AND store=?',...fields,old.id,store.id);
        else await run(db,'INSERT INTO products (code,name,category,description,cents,unit,pack,photo,hidden,soldout,id,store) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',...fields,id(),store.id);
      } catch(error) {
        if(String(error).includes('UNIQUE')) fail('duplicate_code',409);
        throw error;
      }
      return json({ok:true});
    }
    if(method==='POST'&&path==='/api/vendor/csv') {
      const v=await p();
      const rows=parseCSV(v.csv);
      const existing=await all(db,'SELECT code, name, cents, unit, pack, category, description, hidden, soldout FROM products WHERE store=?',store.id);
      const codes=new Map(existing.map(row=>[row.code,row]));
      const changes=rows.map(row=>row.error?row:{...row,action:codes.has(row.product.code)?'update':'add',previous:codes.get(row.product.code)});
      const fingerprint=await digest(JSON.stringify([store.id,changes]));
      if(v.confirm) {
        if(v.confirm!==fingerprint) fail('csv_stale',409);
        if(changes.some(row=>row.error)) fail('csv_invalid',400);
        await db.batch(rows.map(({product:x})=>sql(db,`INSERT INTO products (id,store,code,name,category,description,cents,unit,pack,hidden,soldout) VALUES (?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(store,code) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,cents=excluded.cents,unit=excluded.unit,pack=excluded.pack,hidden=excluded.hidden,soldout=excluded.soldout`,
          id(),store.id,x.code,x.name,x.category,x.description,x.cents,x.unit,x.pack,x.hidden,x.soldout)));
        return json({saved:rows.length});
      }
      return json({rows:changes,fingerprint});
    }
    if(method==='GET'&&path==='/api/vendor/orders') {
      const page=Math.max(0,Math.min(100000,Number(params.get('page'))||0));
      return json({orders:(await all(db,joinedOrder+' WHERE orders.store=? ORDER BY orders.created DESC LIMIT 51 OFFSET ?',store.id,Math.floor(page)*50)).map(row=>orderData(row))});
    }
    if(path.startsWith('/api/vendor/order/')) {
      const orderID=path.split('/').pop();
      const row=await one(db,joinedOrder+' WHERE orders.id=? AND orders.store=?',orderID,store.id);
      if(!row) fail('not_found',404);
      if(method==='GET') return json({order:orderData(row)});
      if(method==='POST') {
        if(row.nulife_managed) fail('managed_order',403);
        return updateOrder(db,row,await p());
      }
    }
  }
  if(path.startsWith('/api/admin/')) {
    role(user,'admin');
    if(method==='GET'&&path==='/api/admin/stores') {
      return json({stores:await all(db,'SELECT stores.*, EXISTS(SELECT 1 FROM users WHERE users.store=stores.id) AS account, ('+checkout+') AS orderable FROM stores WHERE '+visible+' ORDER BY demo, approved, name')});
    }
    if(method==='GET'&&path==='/api/admin/store') {
      const store=await one(db,'SELECT *, ('+checkout+') AS orderable FROM stores WHERE id=? AND '+visible,params.get('id'));
      if(!store) fail('not_found',404);
      return json({store,products:await all(db,'SELECT * FROM products WHERE store=? ORDER BY name',store.id)});
    }
    if(method==='GET'&&path==='/api/admin/orders') {
      const page=Math.max(0,Math.min(100000,Number(params.get('page'))||0));
      return json({orders:(await all(db,joinedOrder+' WHERE '+visible+' ORDER BY orders.created DESC LIMIT 51 OFFSET ?',Math.floor(page)*50)).map(row=>orderData(row))});
    }
    if(path==='/api/admin/order'&&['GET','POST'].includes(method)) {
      const row=await one(db,joinedOrder+' WHERE orders.id=? AND '+visible,params.get('id'));
      if(!row) fail('not_found',404);
      if(method==='GET') return json({order:orderData(row)});
      if(!row.nulife_managed) fail('forbidden',403);
      return updateOrder(db,row,await p());
    }
    if(method==='POST'&&path==='/api/admin/store/ordering') {
      const v=await p(), store=limit(v.id,75);
      required(typeof v.managed==='boolean');
      let result;
      if(v.managed) {
        const contact=limit(v.contact,80), areas=limit(v.areas,300), hours=limit(v.hours,300), fee=money(v.fee);
        required(cleanPhone(contact)&&areas&&hours&&fee!==null,'managed_fields');
        result=await run(db,'UPDATE stores SET nulife_managed=1,managed_contact=?,areas=?,hours=?,fee=? WHERE id=? AND '+visible,
          contact,areas,hours,fee,store);
      } else {
        result=await run(db,'UPDATE stores SET nulife_managed=0 WHERE id=? AND '+visible,store);
      }
      if(result.meta.changes!==1) fail('not_found',404);
      return json({ok:true});
    }
    if(method==='POST'&&path==='/api/admin/invite') {
      const v=await p(), name=limit(v.name,140);
      let store=v.id?await one(db,'SELECT id FROM stores WHERE id=? AND '+visible,limit(v.id,75)):null;
      if(v.id&&!store) fail('not_found',404);
      if(!store) {
        required(name,'store_fields');
        store={id:id()};
        await run(db,'INSERT INTO stores(id,slug,name) VALUES (?,?,?)',store.id,slugify(name)+'-'+store.id.slice(0,5),name);
      }
      const secret=token(), expires=Date.now()+7*24*3600000;
      const result=await db.batch([
        sql(db,'DELETE FROM invites WHERE store=? AND claim IS NULL',store.id),
        sql(db,'INSERT INTO invites (token,store,expires) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE store=?)',await digest(secret),store.id,expires,store.id)
      ]);
      if(result[1].meta.changes!==1) fail('account_exists',409);
      return json({token:secret,expires});
    }
    if(method==='POST'&&path==='/api/admin/moderate') {
      const v=await p(), target=limit(v.id,75);
      let result;
      switch(v.action) {
        case 'approve': result=await run(db,'UPDATE stores SET approved=1 WHERE id=? AND '+visible,target);break;
        case 'pause_store':
        case 'resume_store': result=await run(db,'UPDATE stores SET paused=? WHERE id=? AND '+visible,Number(v.action==='pause_store'),target);break;
        case 'pause_product':
        case 'resume_product': result=await run(db,'UPDATE products SET paused=? WHERE id=? AND EXISTS(SELECT 1 FROM stores WHERE stores.id=products.store AND '+visible+')',Number(v.action==='pause_product'),target);break;
        default: fail('invalid');
      }
      if(result.meta.changes!==1) fail('not_found',404);
      return json({ok:true});
    }
  }
  fail('not_found',404);
}

async function serveMedia(request,env,path) {
  const db=env.DB, preview=env.PREVIEW==='1', user=await actor(request,db,preview), mediaID=path.split('/').pop();
  const found=await one(db,'SELECT media.store,media.mime FROM media JOIN stores ON stores.id=media.store WHERE media.id=? AND (stores.demo=0 OR ?=1)',mediaID,Number(preview));
  if(!found) fail('not_found',404);
  if(user?.role!=='admin' && user?.store!==found.store) {
    const visible=await one(db,`SELECT 1 FROM stores WHERE id=? AND approved=1 AND paused=0 AND
      (logo=? OR EXISTS (SELECT 1 FROM products WHERE store=stores.id AND photo=? AND hidden=0 AND paused=0))`,found.store,path,path);
    if(!visible) fail('not_found',404);
  }
  const file=await one(db,'SELECT data FROM media WHERE id=?',mediaID);
  return new Response(new Uint8Array(file.data),{headers:{...headers,'Content-Type':found.mime,'Content-Security-Policy':"default-src 'none'; sandbox"}});
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url), path=url.pathname;
    try {
      if(path.startsWith('/api/')) return await api(request,env,path,ctx);
      if(path.startsWith('/media/')) return await serveMedia(request,env,path);
      if(path.startsWith('/draft-assets/')) fail('not_found',404);
      const entry=path==='/'||/^\/(store|invite|order)\/[^/]+\/?$/.test(path)||['/cart','/login','/setup','/vendor','/admin'].includes(path);
      const target=entry?'/index.html':path;
      const response=await env.ASSETS.fetch(new Request(new URL(target,url)));
      const safe=new Headers(response.headers);
      safe.set('X-Content-Type-Options','nosniff');
      safe.set('Referrer-Policy','no-referrer');
      if(entry) {
        safe.set('Cache-Control','no-store');
        safe.set('X-Robots-Tag','noindex, nofollow');
        safe.set('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
      }
      return new Response(response.body,{status:response.status,headers:safe});
    } catch(error) {
      if(!error.status) console.error(error);
      return json({error:error.status?error.message:'server_error',details:error.details},error.status||500);
    }
  }
};
export { seed };

async function seedDrafts(db,assets) {
  async function file(store,key) {
    if(!key) return null;
    const resp=await assets.fetch(new Request('https://assets.internal/draft-assets/'+key+'.webp'));
    if(!resp.ok) throw new Error('Draft asset missing: '+key);
    await run(db,'INSERT OR IGNORE INTO media VALUES (?,?,?,?)',key,store,'image/webp',await resp.arrayBuffer());
    return '/media/'+key;
  }
  for(const [store,contact,logo,items] of drafts) {
    await run(db,"UPDATE stores SET contact=?,logo=? WHERE id=? AND approved=0 AND logo IS NULL",contact,await file(store,logo),store);
    const statements=[];
    for(const [code,name,cents,unit,pack,picture,category] of items) {
      statements.push(sql(db,'INSERT OR IGNORE INTO products (id,store,code,name,cents,unit,pack,photo,category) VALUES (?,?,?,?,?,?,?,?,?)',
        store+'-'+code,store,code,name,cents,unit,pack,await file(store,picture),category));
    }
    await db.batch(statements);
  }
}
