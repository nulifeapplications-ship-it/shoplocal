import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const password='sample-only-passphrase';
const fields='code,name,category,description,price,unit,pack,hidden,soldout';
test('marketplace and portals enforce the complete ordering workflow',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'nulife-test-'));
  const child=spawn(process.execPath,['local.mjs'],{env:{...process.env,PORT:'0',DB_PATH:join(dir,'test.sqlite'),PREVIEW:'1',FIRST_ADMIN_KEY:'test-bootstrap-key'}});
  t.after(async()=>{
    if(child.exitCode===null) {child.kill();await once(child,'exit');}
    await rm(dir,{recursive:true,force:true});
  });
  const origin=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Local server did not start')),6000);
    child.stdout.on('data',data=>{
      const port=String(data).match(/listening on (\d+)/)?.[1];
      if(port) {clearTimeout(timeout);resolve('http://localhost:'+port);}
    });
    child.on('error',reject);
    child.stderr.on('data',data=>process.stderr.write(data));
  });
  function client() {
    let cookie='';
    return async(path,body,expected=200)=>{
      const res=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      assert.equal(res.status,expected,path+': '+(res.ok?'':await res.clone().text()));
      if(res.headers.get('set-cookie')) cookie=res.headers.get('set-cookie').split(';')[0];
      if(res.headers.get('content-type')?.includes('application/json')) return (await res.json());
      return res;
    };
  }
  const admin=client(), a=client(), b=client(), guest=client();
  await guest('/',undefined);
  await guest('/manifest.webmanifest',undefined);
  await guest('/template.csv',undefined);
  await guest('/api/admin/stores',undefined,401);
  const crossOrigin=await fetch(origin+'/api/login',{method:'POST',headers:{origin:'https://elsewhere.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(crossOrigin.status,403);
  await admin('/api/setup',{email:'admin@example.test',password,key:'test-bootstrap-key'});
  await admin('/api/setup',{email:'second@example.test',password,key:'test-bootstrap-key'},409);
  await admin('/api/login',{email:'admin@example.test',password:'wrong'},401);
  assert.equal((await admin('/api/login',{email:'admin@example.test',password})).role,'admin');

  const drafts=(await admin('/api/admin/stores')).stores.filter(s=>!s.demo);
  assert.equal(drafts.length,2);
  assert.ok(drafts.every(s=>s.approved===0));
  assert.equal((await admin('/api/admin/store?id=draft-ilia')).products.length,36);
  assert.equal((await admin('/api/admin/store?id=draft-luiyi')).products.length,35);
  await guest('/media/draft-ilia-image1',undefined,404);
  await guest('/draft-assets/draft-ilia-image1.webp',undefined,404);
  const first=await admin('/api/admin/invite',{name:'Fictional Test Farm'});
  assert.ok(first.expires>Date.now());
  assert.equal((await guest('/api/invite?token='+first.token)).name,'Fictional Test Farm');
  await a('/api/invite',{token:first.token,email:'farm@example.test',password});
  await a('/api/logout',{});
  await a('/api/vendor/store',undefined,401);
  assert.equal((await a('/api/login',{email:'farm@example.test',password})).role,'vendor');
  await guest('/api/invite',{token:first.token,email:'replay@example.test',password},404);
  await a('/api/admin/stores',undefined,403);
  await admin('/api/vendor/store',undefined,403);

  const second=await admin('/api/admin/invite',{name:'Fictional Test Bakery'});
  await b('/api/invite',{token:second.token,email:'bakery@example.test',password});
  const invitation=await admin('/api/admin/invite',{id:'draft-ilia'});
  await admin('/api/admin/invite',{id:'draft-ilia'});
  await guest('/api/invite?token='+invitation.token,undefined,404);
  const sourceLogo=await readFile('public/icon-192.png');
  const logo='data:image/png;base64,'+sourceLogo.toString('base64');
  await a('/api/vendor/store',{name:'Fictional Test Farm',contact:'+1 809 555 0100',areas:'Sosúa',hours:'08:00–16:00',fee:'75',logo});
  const item={code:'MANGO',name:'Mango',price:'200',unit:'lb',description:'Test fruit'};
  await a('/api/vendor/product',{...item,photo:logo});
  const {store,products:[product]}=await a('/api/vendor/store');
  assert.ok(store.logo.startsWith('/media/'));
  assert.equal((await a(store.logo)).headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await (await a(product.photo)).arrayBuffer()),sourceLogo);
  await admin(store.logo);
  await b(store.logo,undefined,404);
  await b(product.photo,undefined,404);
  await b('/api/vendor/product',{...item,id:product.id,price:'1'},404);
  await guest('/api/store/'+store.slug,undefined,404);
  await guest(store.logo,undefined,404);

  const bad=fields+'\nBAD,,produce,,no,lb,,false,false';
  const invalid=await a('/api/vendor/csv',{csv:bad});
  assert.equal(invalid.rows[0].error,'product_fields');
  await a('/api/vendor/csv',{csv:bad,confirm:invalid.fingerprint},400);
  const csv=fields+'\nMANGO,Mango,produce,"Fresh, sample",200,lb,,false,false\nBAG,Bag,produce,,125,package,3 lb,false,true';
  const diff=await a('/api/vendor/csv',{csv});
  assert.deepEqual(diff.rows.map(r=>r.action),['update','add']);
  assert.equal((await a('/api/vendor/store')).products.length,1);
  assert.equal((await a('/api/vendor/csv',{csv,confirm:diff.fingerprint})).saved,2);

  await admin('/api/admin/moderate',{id:store.id,action:'approve'});
  assert.ok((await guest('/api/stores')).stores.some(s=>s.id===store.id));
  const publicStore=await guest('/api/store/'+store.slug);
  assert.equal(publicStore.products.length,2);
  await guest(store.logo);
  const orderForm={guest:'Test Guest',phone:'+1 809 555 0101',property:'Test Property',room:'B1',
    date:new Date(Date.now()+86400000*3).toISOString().slice(0,10),time:'14:00',notes:'Demo order',
    store:store.id,fee:7500,attempt:crypto.randomUUID(),items:[{id:product.id,quantity:1.25,cents:20000,unit:'lb'}]};
  const soldout=publicStore.products.find(p=>p.soldout);
  await guest('/api/order',{...orderForm,items:[{id:soldout.id,quantity:1,cents:soldout.cents,unit:soldout.unit}]},409);
  await guest('/api/order',{...orderForm,items:[{...orderForm.items[0],quantity:-2}]},400);
  const placed=await guest('/api/order',orderForm,201);
  assert.match(placed.number,/^NL-/);
  assert.equal((await guest('/api/order',orderForm)).token,placed.token);
  await guest('/order/'+placed.token);
  const statusPath='/api/status/'+placed.token;
  let order=(await guest(statusPath)).order;
  assert.equal(order.status,'new');
  assert.equal(order.total,32500);
  assert.equal(order.phone,undefined);
  assert.equal(order.estimated,true);

  const vendorOrders=await a('/api/vendor/orders');
  const orderID=vendorOrders.orders[0].id;
  assert.equal(vendorOrders.orders.length,1);
  assert.equal((await b('/api/vendor/orders')).orders.length,0);
  await b('/api/vendor/order/'+orderID,undefined,404);
  await b('/api/vendor/order/'+orderID,{status:'confirmed'},404);
  assert.equal((await admin('/api/admin/orders')).orders[0].id,orderID);
  await a('/api/vendor/product',{...item,id:product.id,price:'375',name:'Price changed'});
  assert.equal((await guest('/api/store/'+store.slug)).products.find(p=>p.id===product.id).cents,37500);
  assert.equal((await guest(statusPath)).order.items[0].cents,20000);
  assert.equal((await guest(statusPath)).order.items[0].name,'Mango');
  await a('/api/vendor/order/'+orderID,{status:'confirmed'});
  assert.equal((await guest(statusPath)).order.status,'confirmed');
  await a('/api/vendor/order/'+orderID,{status:'preparing',weights:{[product.id]:1.4}});
  order=(await guest(statusPath)).order;
  assert.equal(order.items[0].actual,1400);
  assert.equal(order.total,35500);
  assert.equal(order.estimated,false);
  await a('/api/vendor/order/'+orderID,{status:'out_for_delivery'});
  await a('/api/vendor/order/'+orderID,{status:'delivered'});
  assert.equal((await guest(statusPath)).order.status,'delivered');

  await admin('/api/admin/moderate',{action:'pause_product',id:product.id});
  await a('/api/vendor/product',{...item,id:product.id,price:'375',paused:0});
  assert.ok(!(await guest('/api/store/'+store.slug)).products.some(p=>p.id===product.id));
  await admin('/api/admin/moderate',{action:'pause_store',id:store.id});
  await a('/api/vendor/store',{name:'Fictional Test Farm',fee:75,paused:0});
  await guest('/api/store/'+store.slug,undefined,404);
  await guest(store.logo,undefined,404);
  await guest(statusPath);
});

test('production routes and retries new order alerts for the assigned recipient',async t=>{
  const { createDatabase }=await import('./sqlite.mjs');
  const { default:app, passwordHash, seed }=await import('./worker.mjs');
  const DB=createDatabase(':memory:');
  await seed(DB,true);
  await DB.prepare("INSERT INTO users (id,email,password,role,demo) VALUES (?,?,?,'admin',1)")
    .bind('demo-admin','admin@nulife-preview.test',await passwordHash(password)).run();
  const ASSETS={async fetch(request) {
    const path=new URL(request.url).pathname;
    return new Response(await readFile(path==='/index.html'?'public/index.html':'.'+path));
  }};
  const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const env={DB,ASSETS,FIRST_ADMIN_KEY:'production-test-key',FIRST_ADMIN_KEY_EXPIRES:String(Date.now()+60000),
    PUSH_PUBLIC_KEY:Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url'),
    PUSH_PRIVATE_KEY:(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d};
  const pushes=[];
  let deferNext=false;
  t.mock.method(globalThis,'fetch',async (endpoint,options)=>{
    assert.equal(options.redirect,'error');
    assert.match(options.headers.authorization,/^vapid t=/);
    assert.equal(options.headers['content-encoding'],'aes128gcm');
    assert.equal(options.body.byteLength,4096);
    pushes.push({endpoint,body:options.body,topic:options.headers.topic});
    if(deferNext) {
      deferNext=false;
      return new Response(null,{status:503,headers:{'Retry-After':'60'}});
    }
    return new Response(null,{status:201});
  });
  async function device(name) {
    const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const publicKey=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey));
    const auth=crypto.getRandomValues(new Uint8Array(16));
    return {
      subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/'+name,
        keys:{p256dh:publicKey.toString('base64url'),auth:Buffer.from(auth).toString('base64url')}},
      async read(body) {
        const salt=body.slice(0,16), server=body.slice(21,86);
        const encryptionKey=await crypto.subtle.importKey('raw',server,{name:'ECDH',namedCurve:'P-256'},false,[]);
        const shared=await crypto.subtle.deriveBits({name:'ECDH',public:encryptionKey},keys.privateKey,256);
        const derive=async (material,salt,info,size)=>{
          const key=await crypto.subtle.importKey('raw',material,'HKDF',false,['deriveBits']);
          return crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,size);
        };
        const context=Buffer.concat([Buffer.from('WebPush: info\0'),publicKey,server]);
        const secret=await derive(shared,auth,context,256);
        const aes=await derive(secret,salt,Buffer.from('Content-Encoding: aes128gcm\0'),128);
        const iv=await derive(secret,salt,Buffer.from('Content-Encoding: nonce\0'),96);
        const key=await crypto.subtle.importKey('raw',aes,'AES-GCM',false,['decrypt']);
        const clear=Buffer.from(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,body.slice(86)));
        return JSON.parse(clear.subarray(0,clear.indexOf(2)).toString());
      }
    };
  }
  const publicRequest=async(path,body,expected=200,cookie='')=>{
    const response=await app.fetch(new Request('https://market.example'+path,{
      headers:{cookie,'Content-Type':'application/json'},
      method:body===undefined?'GET':'POST',
      body:body===undefined?undefined:JSON.stringify(body)
    }),env);
    assert.equal(response.status,expected,path+': '+(response.ok?'':await response.clone().text()));
    return response;
  };
  const admin=(path,body,expected=200)=>publicRequest(path,body,expected,adminCookie);
  const getSession=res=>res.headers.get('set-cookie').split(';')[0];
  await publicRequest('/setup');
  await publicRequest('/api/login',{email:'admin@nulife-preview.test',password},401);
  const setup={email:'owner@example.test',key:env.FIRST_ADMIN_KEY,password};
  await publicRequest('/api/setup',{...setup,key:'incorrect'},404);
  const expiry=env.FIRST_ADMIN_KEY_EXPIRES;
  env.FIRST_ADMIN_KEY_EXPIRES='1';
  await publicRequest('/api/setup',setup,404);
  env.FIRST_ADMIN_KEY_EXPIRES=expiry;
  await publicRequest('/api/setup',setup);
  await publicRequest('/api/setup',{...setup,email:'second@example.test'},409);
  const adminCookie=getSession(await publicRequest('/api/login',{email:setup.email,password}));
  const adminDevice=await device('synthetic-admin');
  const vendorDevice=await device('synthetic-vendor');
  const alerts='/api/notifications';
  await publicRequest(alerts,undefined,401);
  await admin(alerts,{action:'enable',endpoint:'https://example.test/not-a-provider',keys:adminDevice.subscription.keys},400);
  await admin(alerts,{action:'enable',...adminDevice.subscription,language:'es'});
  await admin(alerts,{action:'test',endpoint:adminDevice.subscription.endpoint});
  assert.equal((await adminDevice.read(pushes.shift().body)).url,'/admin#orders');
  await admin(alerts,{action:'test',endpoint:adminDevice.subscription.endpoint},409);
  const {stores}=await (await admin('/api/admin/stores')).json();
  assert.deepEqual(stores.map(s=>s.slug),['ilia','luiyi-organic-farm']);
  await publicRequest('/api/store/north-coast-garden',undefined,404);
  await admin('/api/admin/moderate',{id:'draft-ilia',action:'approve'});
  const catalog=async()=> (await (await publicRequest('/api/store/ilia')).json());
  const listing=await catalog();
  assert.equal(listing.store.orderable,0);
  const product=listing.products.find(item=>item.unit==='lb');
  const order={store:listing.store.id,attempt:crypto.randomUUID(),guest:'Test Guest',phone:'+1 809 555 0101',
    property:'Test Property',room:'1',date:new Date(Date.now()+86400000*3).toISOString().slice(0,10),time:'14:00',fee:0,
    items:[{id:product.id,cents:product.cents,unit:product.unit,quantity:1}]};
  await publicRequest('/api/order',order,409);

  const settings={id:listing.store.id,managed:true,contact:'+1 809 555 0102',areas:'Sosúa',hours:'08:00–14:00',fee:0};
  await publicRequest('/api/admin/store/ordering',settings,401);
  await admin('/api/admin/store/ordering',{...settings,hours:''},400);
  assert.equal((await catalog()).store.orderable,0);
  await admin('/api/admin/store/ordering',settings);
  const managedStore=(await catalog()).store;
  assert.equal(managedStore.orderable,1);
  assert.equal(managedStore.nulife_managed,1);
  assert.equal(managedStore.contact,settings.contact);
  const managed={...order,attempt:crypto.randomUUID()};
  deferNext=true;
  const placed=await (await publicRequest('/api/order',managed,201)).json();
  assert.deepEqual(pushes.map(push=>push.endpoint),[adminDevice.subscription.endpoint]);
  assert.equal((await DB.prepare('SELECT count(*) AS jobs FROM order_alerts').first()).jobs,1);
  await DB.prepare('UPDATE order_alerts SET next_at=?').bind(Date.now()-1).run();
  const {pending,publicKey}=await (await admin(alerts)).json();
  assert.equal(pending,1);
  assert.equal(publicKey,env.PUSH_PUBLIC_KEY);
  assert.equal(pushes.length,2);
  assert.equal(pushes[0].topic,pushes[1].topic);
  const news=await adminDevice.read(pushes[1].body);
  assert.equal(news.title,'Nuevo pedido en NuLife');
  assert.match(news.url,/^\/admin#order\/[\w-]+$/);
  assert.doesNotMatch(JSON.stringify(news),/Test Guest|555 0101/);
  assert.equal((await DB.prepare('SELECT count(*) AS jobs FROM order_alerts').first()).jobs,0);
  await publicRequest('/api/order',managed);
  assert.equal(pushes.length,2);
  pushes.length=0;
  const statusPath='/api/status/'+placed.token;
  const guestOrder=async()=> (await (await publicRequest(statusPath)).json()).order;
  const {order:received}=await (await publicRequest(statusPath)).json();
  assert.equal(received.nulife_managed,1);
  assert.equal(received.contact,settings.contact);
  assert.equal(received.managed_contact,undefined);
  const {orders}=await (await admin('/api/admin/orders')).json();
  const orderID=orders.find(entry=>entry.number===placed.number).id;
  const adminOrder='/api/admin/order?id='+orderID;
  await admin(adminOrder,{status:'confirmed'});
  assert.equal((await guestOrder()).status,'confirmed');

  await admin('/api/admin/store/ordering',{id:settings.id,managed:false});
  assert.equal((await catalog()).store.orderable,0);
  assert.equal((await catalog()).store.contact,listing.store.contact);
  await publicRequest('/api/order',order,409);
  await admin('/api/admin/store/ordering',settings);
  const {token}=await (await admin('/api/admin/invite',{id:listing.store.id})).json();
  const vendorCookie=getSession(await publicRequest('/api/invite',{token,email:'vendor@example.test',password}));
  await publicRequest(alerts,{action:'enable',...vendorDevice.subscription,language:'en'},200,vendorCookie);
  const checkOther=await (await publicRequest(alerts,{action:'check',endpoint:adminDevice.subscription.endpoint},200,vendorCookie)).json();
  assert.equal(checkOther.enabled,false);
  await publicRequest(alerts,{action:'disable',endpoint:adminDevice.subscription.endpoint},200,vendorCookie);
  assert.equal((await (await admin(alerts,{action:'check',endpoint:adminDevice.subscription.endpoint})).json()).enabled,true);

  const updateStore={name:listing.store.name,contact:'+1 809 555 0103',areas:'Cabarete',hours:'09:00–18:00',fee:100};
  await publicRequest('/api/vendor/store',updateStore,200,vendorCookie);
  assert.equal((await catalog()).store.fee,0);
  assert.equal((await catalog()).store.areas,settings.areas);
  await publicRequest('/api/admin/store/ordering',{id:settings.id,managed:false},403,vendorCookie);
  await publicRequest('/api/vendor/order/'+orderID,{status:'out_for_delivery'},403,vendorCookie);
  await admin('/api/admin/store/ordering',{id:settings.id,managed:false});
  await publicRequest('/api/vendor/store',updateStore,200,vendorCookie);
  const vendorStore=(await catalog()).store;
  assert.equal(vendorStore.orderable,1);
  assert.equal(vendorStore.contact,updateStore.contact);
  const vendorPlaced=await (await publicRequest('/api/order',{...order,fee:vendorStore.fee},201)).json();
  const {order:vendorOrder}=await (await publicRequest('/api/status/'+vendorPlaced.token)).json();
  assert.deepEqual(pushes.map(push=>push.endpoint),[vendorDevice.subscription.endpoint]);
  assert.equal((await vendorDevice.read(pushes[0].body)).url,'/vendor#order/'+vendorOrder.id);
  assert.equal((await (await publicRequest(alerts,undefined,200,vendorCookie)).json()).pending,1);
  await publicRequest(alerts,{action:'disable',endpoint:vendorDevice.subscription.endpoint},200,vendorCookie);
  const checkDisabled=await (await publicRequest(alerts,{action:'check',endpoint:vendorDevice.subscription.endpoint},200,vendorCookie)).json();
  assert.equal(checkDisabled.enabled,false);

  assert.equal(vendorOrder.nulife_managed,0);
  await admin('/api/admin/order?id='+vendorOrder.id,{status:'confirmed'},403);
  await publicRequest('/api/vendor/order/'+vendorOrder.id,{status:'confirmed'},200,vendorCookie);

  await admin(adminOrder,{status:'delivered'},400);
  await admin(adminOrder,{status:'delivered',weights:{[product.id]:1.25}});
  const complete=await guestOrder();
  assert.equal(complete.status,'delivered');
  assert.equal(complete.total,Math.round(product.cents*1.25));
  assert.equal(complete.contact,settings.contact);
});
