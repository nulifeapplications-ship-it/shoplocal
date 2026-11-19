import { buildPushPayload } from '@block65/webcrypto-web-push';

const providers=[
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)+notify\.windows\.com$/
];
const signKey=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(value);
const clientKey=value=>typeof value==='string'&&/^B[a-zA-Z0-9_-]{86}$/.test(value);
export const pushConfigured=env=>clientKey(env.PUSH_PUBLIC_KEY)&&signKey(env.PUSH_PRIVATE_KEY);

export function validPushEndpoint(endpoint) {
  if(typeof endpoint!=='string'||endpoint.length>2048) return false;
  try {
    const url=new URL(endpoint);
    return url.protocol==='https:' && !url.port && !url.username && !url.password && !url.hash
      && url.pathname.length>1 && providers.some(provider=>provider.test(url.hostname));
  } catch {return false;}
}
export function validPushKeys(keys) {
  return clientKey(keys?.p256dh) && typeof keys?.auth==='string' && /^[a-zA-Z0-9_-]{22}$/.test(keys.auth);
}

export async function sendPush(env,origin,subscription,{role,id}) {
  if(!validPushEndpoint(subscription.endpoint)) return {expired:true};
  const es=subscription.language==='es';
  const notification={
    title:id?(es?'Nuevo pedido en NuLife':'New NuLife Market order'):(es?'Notificaciones activadas':'Notifications are on'),
    body:id?(es?'Abre tu panel para revisar el pedido.':'Open your dashboard to review the order.')
      :(es?'Tu dispositivo puede recibir avisos de pedidos.':'This device can receive order alerts.'),
    url:id?'/'+role+'#order/'+id:'/'+role+'#orders',
    tag:id?'order-'+id:'nulife-test'
  };
  try {
    const payload=await buildPushPayload(
      {data:JSON.stringify(notification),options:{ttl:id?86400:60,urgency:'high',topic:id?id.replaceAll('-',''):'nulife-test'}},
      {endpoint:subscription.endpoint,expirationTime:null,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
      {subject:env.PUSH_SUBJECT||origin,publicKey:env.PUSH_PUBLIC_KEY,privateKey:env.PUSH_PRIVATE_KEY}
    );
    const response=await fetch(subscription.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(4500)});
    await response.body?.cancel().catch(()=>{});
    if(response.ok) return {sent:true};
    if([404,410].includes(response.status)) return {expired:true};
    const retry=response.headers.get('retry-after');
    const delay=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:new Date(retry).valueOf()-Date.now()):0;
    return {delay:Number.isFinite(delay)?Math.max(0,delay):0,temporary:response.status===429||response.status>=500};
  } catch {return {temporary:true};}
}
