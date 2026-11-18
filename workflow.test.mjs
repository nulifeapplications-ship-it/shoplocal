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
