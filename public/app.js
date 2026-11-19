let lang=localStorage.getItem('nulife-lang')==='es'?'es':'en';
const L=(en,es)=>lang==='es'?es:en;
const human=value=>{
  const split=(value||'').split(' / ');
  return split.length===2?split[lang==='es'?1:0]:value||'';
};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const E=escape;
const q=(s,root=document)=>root.querySelector(s);
const main=q('#main');
const paths={
 pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 cart:'<path d="M3 8h18l-2 12H5L3 8Zm5 0 3-5m5 5-3-5"/><path d="M9 12v4m6-4v4"/>',
 store:'<path d="M4 9h16l-2-5H6L4 9Zm0 0v3a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0V9M6 14v6h12v-6m-8 6v-4h4v4"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18m0-18a16 16 0 0 0 0 18"/>',
 leaf:'<path d="M19 4c0 10-2 14-9 14a5 5 0 0 1-5-5c0-7 5-9 14-9Z"/><path d="M4 20 14 10"/>',
 bread:'<path d="M5 19c-3 0-4-3-2-5-1-3 2-7 6-8 6-2 12 0 12 5 0 3-3 7-6 8H5Z"/><path d="m8 8 2 4m3-5 2 4m3-3 1 3"/>',
 meal:'<path d="M4 17h16M3 16a9 9 0 1 1 18 0M12 6V3"/>',
 search:'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 share:'<path d="M9 12a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2M15 12a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2"/>',
 bag:'<path d="M5 7h14l2 14H3L5 7Zm4 0V5a3 3 0 0 1 6 0v2"/>',
 truck:'<path d="M2 6h12v10H2zm12 4h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
 checklist:'<path d="M9 4h10v16H5V4h4m0 0V2h6v4H9zm0 8 2 2 4-4"/>'
};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
const categories=()=>({produce:L('Fresh produce','Frutas y vegetales'),bakery:L('Bakery','Panadería'),meals:L('Prepared meals','Comidas preparadas')});
const catIcons={produce:'leaf',bakery:'bread',meals:'meal'};
const category=value=>categories()[value]||human(value);
const units=unit=>({unit:L('unit','unidad'),package:L('package','paquete'),lb:L('lb','libra')}[unit]||unit);
const unitName=p=>human(p.pack)||units(p.unit);
const money=cents=>'RD$ '+new Intl.NumberFormat(lang==='es'?'es-DO':'en-DO',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
const deliveryFee=fee=>fee===null?L('Ask vendor for delivery fee','Consulta la tarifa con el comercio'):fee===0?L('Free delivery','Entrega gratis'):money(fee)+' '+L('delivery','de entrega');
const choice=(name,html,selected)=>'<option value="'+E(name)+'" '+(name===selected?'selected':'')+'>'+E(html)+'</option>';
const btn=(label,classes='',extra='')=>'<button class="button '+classes+'" '+extra+'>'+label+'</button>';
const pill=(label,active,extra)=>'<button type="button" class="pill '+(active?'active':'')+'" aria-pressed="'+Boolean(active)+'" '+extra+'>'+label+'</button>';
const back=(href,text)=>'<a class="back" href="'+E(href)+'">'+E(text)+'</a>';
const image=(src,classes,name='')=>src?'<img class="'+classes+'" src="'+E(src)+'" alt="'+E(name)+'" loading="lazy">':'<div class="placeholder" aria-hidden="true">'+icon('store')+'</div>';
const panel=(title,html)=>'<section class="panel">'+(title?'<h2>'+title+'</h2>':'')+html+'</section>';
const formatDate=ms=>new Intl.DateTimeFormat(lang==='es'?'es-DO':'en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Santo_Domingo'}).format(ms);
const today=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Santo_Domingo'}).format(Date.now());
const statusName=s=>({
 new:L('Awaiting confirmation','Pendiente de confirmación'),confirmed:L('Confirmed','Confirmado'),preparing:L('Preparing','En preparación'),
 out_for_delivery:L('Out for delivery','En camino'),delivered:L('Delivered','Entregado'),declined:L('Declined','Rechazado')
}[s]||s);
const status=s=>'<span class="status '+(s==='new'?'waiting':s==='declined'?'stopped':'')+'">'+statusName(s)+'</span>';
const transitions={new:['confirmed','declined'],confirmed:['preparing','out_for_delivery','delivered'],preparing:['out_for_delivery','delivered'],out_for_delivery:['delivered'],delivered:[],declined:[]};
function errorText(error) {
  const msg={
    sign_in:L('Please sign in.','Inicia sesión.'),
    forbidden:L('This area is restricted.','Esta sección es privada.'),
    not_found:L('This page or link is unavailable.','Esta página o enlace no está disponible.'),
    credentials:L('Use a valid email and a password of 12–128 characters.','Usa un correo válido y una contraseña de 12 a 128 caracteres.'),
    login_failed:L('Check your email and password.','Revisa tu correo y contraseña.'),
    login_limit:L('Too many attempts. Try again in 15 minutes.','Demasiados intentos. Vuelve a intentarlo en 15 minutos.'),
    invite_invalid:L('This invitation has expired or has already been used. Ask NuLife for a new link.','La invitación venció o ya se usó. Pide un nuevo enlace a NuLife.'),
    email_used:L('That email is already registered.','Ese correo ya está registrado.'),
    account_exists:L('This store already has an account.','Esta tienda ya tiene una cuenta.'),
    product_fields:L('Enter a product name, a valid price and unit. Use true or false for availability flags.','Ingresa un nombre, un precio y una unidad válidos. Usa true o false para las opciones de disponibilidad.'),
    store_fields:L('Enter a store name and a valid phone number and fee if provided.','Ingresa el nombre de la tienda y un teléfono y tarifa válidos si los incluyes.'),
    managed_fields:L('Enter a NuLife WhatsApp number, delivery areas, hours and a delivery fee.','Ingresa un número de WhatsApp de NuLife, las zonas de entrega, el horario y la tarifa.'),
    managed_order:L('NuLife is handling this order.','NuLife está gestionando este pedido.'),
    product_code:L('Use letters, numbers, hyphens, periods or underscores in the code.','Usa letras, números, guiones, puntos o guiones bajos en el código.'),
    duplicate_code:L('This product code is repeated.','El código de producto está repetido.'),
    csv_header:L('Use the exact column headers from the template.','Usa los encabezados exactos de la plantilla.'),
    csv_format:L('Check commas, quotes and the number of columns.','Revisa las comas, las comillas y el número de columnas.'),
    csv_size:L('The CSV must have 1–100 products and contain at most 180,000 characters.','El CSV debe incluir de 1 a 100 productos y hasta 180,000 caracteres.'),
    csv_stale:L('The catalog changed. Preview the file again.','El catálogo cambió. Vuelve a previsualizar el archivo.'),
    csv_invalid:L('Correct invalid rows and preview again.','Corrige las filas inválidas y vuelve a previsualizar.'),
    image:L('Choose a supported image your phone can open.','Elige una imagen compatible que tu teléfono pueda abrir.'),
    too_large:L('The file is too large.','El archivo es demasiado grande.'),
    checkout_fields:L('Check your name, WhatsApp number, property and unit.','Revisa tu nombre, número de WhatsApp, propiedad y unidad.'),
    ordering_closed:L('This vendor is still setting up online ordering.','Este comercio aún está configurando los pedidos en línea.'),
    setup_link:L('This administrator setup link is invalid or expired.','Este enlace de configuración para administración no es válido o ha vencido.'),
    setup_done:L('An administrator account is already set up. Sign in with that account.','Ya existe una cuenta de administración. Inicia sesión con esa cuenta.'),
    unavailable:L('A store or product is no longer available. Refresh the cart.','Una tienda o un producto ya no está disponible. Actualiza el carrito.'),
    price_changed:L('A price changed. Refresh and review the cart before ordering.','Cambió un precio. Actualiza y revisa el carrito antes de hacer el pedido.'),
    quantity:L('Choose a valid quantity. You can enter up to three decimal places for pounds.','Elige una cantidad válida. Puedes ingresar hasta tres decimales para libras.'),
    cart:L('Choose between 1 and 16 different products.','Elige entre 1 y 16 productos distintos.'),
    delivery_date:L('Choose a future delivery date and time in the Dominican Republic.','Elige una fecha y hora de entrega futuras en República Dominicana.'),
    status_change:L('This status change is unavailable. Reload the order and try again.','No se puede cambiar el estado. Actualiza el pedido e inténtalo de nuevo.'),
    weight_required:L('Save the final weight of each item sold by the pound before completing delivery.','Guarda el peso final de cada producto vendido por libra antes de completar la entrega.'),
    push_unavailable:L('Device alerts are unavailable right now.','Los avisos del dispositivo no están disponibles ahora.'),
    push_subscription:L('This device could not be registered for alerts.','No se pudo registrar este dispositivo para recibir avisos.'),
    push_test_wait:L('Wait a few seconds before sending another test.','Espera unos segundos antes de enviar otra prueba.'),
    push_expired:L('Turn notifications on again for this device.','Vuelve a activar las notificaciones en este dispositivo.'),
    push_delivery:L('The test alert could not be sent. Try again shortly.','No se pudo enviar la prueba. Inténtalo de nuevo en unos momentos.'),
    network:L('Connection interrupted. Please try again.','Se interrumpió la conexión. Inténtalo de nuevo.'),
    server_error:L('Something went wrong. Please try again.','Ocurrió un error. Inténtalo de nuevo.')
  };
  return (msg[error.message]||L('Check the fields and try again.','Revisa los campos e inténtalo de nuevo.'))+(error.details?.line?' '+L('Row','Fila')+' '+error.details.line:'');
}
async function api(path,body) {
  let response;
  try {response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
  catch {throw new Error('network');}
  const data=await response.json().catch(()=>({error:'server_error'}));
  if(!response.ok) throw Object.assign(new Error(data.error),{details:data.details});
  return data;
}
function formError(form,error) {
  const element=q('.form-error',form)||q('.form-error');
  if(!element) return toast(errorText(error));
  element.hidden=false;
  element.textContent=errorText(error);
  element.scrollIntoView({block:'nearest'});
}
function submit(form,action) {
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=event.submitter;
    const error=q('.form-error',form);
    if(error) error.hidden=true;
    if(button) button.disabled=true;
    try {await action(new FormData(form));} catch(e) {formError(form,e);}
    finally {if(button) button.disabled=false;}
  });
}
function input(name,label,value='',options='') {return '<label>'+E(label)+'<input name="'+name+'" value="'+E(value)+'" '+options+'></label>';}
function area(name,label,value='') {return '<label class="full">'+E(label)+'<textarea name="'+name+'" maxlength="1600">'+E(value)+'</textarea></label>';}
function check(name,label,value) {return '<label class="check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'>'+E(label)+'</label>';}
const errorBox='<p class="banner error form-error" role="alert" hidden></p>';
const page=(title,body,wide=false)=>'<section class="screen '+(wide?'wrap':'reading')+'">'+title+body+'</section>';
const heading=title=>'<h1>'+title+'</h1>';
let noticeTimer;
function toast(message) {
  const notice=q('#notice'); notice.className='fixed-notice';notice.textContent=message;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.textContent='',3800);
}
async function copy(value) {
  try {await navigator.clipboard.writeText(value);toast(L('Link copied','Enlace copiado'));}
  catch {window.prompt(L('Copy this link','Copia este enlace'),value);}
}
function shareBox(url,send=false) {
  return '<div class="wide-link"><input aria-label="'+L('Shareable link','Enlace para compartir')+'" readonly value="'+E(url)+'">'+
    btn(icon('share')+' '+L('Copy link','Copiar enlace'),'secondary','type="button" data-copy="'+E(url)+'"')+
    (send?'<a class="button secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text='+encodeURIComponent(url)+'">WhatsApp</a>':'')+'</div>';
}
let cart;
try {cart=JSON.parse(localStorage.getItem('nulife-cart')||'null');} catch {cart=null;}
if(!cart || !Array.isArray(cart.items)) cart={items:[]};
let appUser=null, refreshTimer, notificationPoll, filter='all', query='';
const serviceRegistration='serviceWorker' in navigator&&window.isSecureContext
  ?navigator.serviceWorker.register('/sw.js').catch(()=>null)
  :Promise.resolve(null);
let screenEdit='', activeProduct=null, csvFile='', orderPage=0;
const segments=()=>location.pathname.replace(/\/$/,'').split('/');
function persistCart() {localStorage.setItem('nulife-cart',JSON.stringify(cart)); shell();}
function shell() {
  document.documentElement.lang=lang;
  q('#skip').textContent=L('Skip to content','Ir al contenido');
  const portal=appUser?'/'+appUser.role:'/login';
  q('#header').innerHTML='<div class="topbar"><div class="wrap"><a class="brand" href="/" aria-label="NuLife Dominicana"><img src="/brand.png" alt="NuLife Dominicana"><span>'+L('Local Market','Mercado Local')+'</span></a>'+
    '<nav class="nav" aria-label="'+L('Main navigation','Navegación principal')+'"><a class="navlink" href="'+portal+'" aria-label="'+L('Vendor portal','Portal de comercios')+'">'+icon('store')+
    '<span class="nav-full">'+(appUser?L('Dashboard','Panel'):L('Vendor portal','Portal de comercios'))+'</span></a>'+
    '<button class="language" id="language" aria-label="'+L('Cambiar a español','Switch to English')+'">'+icon('globe')+' '+L('ES','EN')+'</button>'+
    '<a class="cartlink" href="/cart" aria-label="'+L('Cart','Carrito')+'">'+icon('cart')+'<span class="nav-full">'+L('Cart','Carrito')+'</span><span class="cart-count">'+cart.items.length+'</span></a></nav></div></div>';
  q('#language').onclick=()=>{
    lang=L('es','en');localStorage.setItem('nulife-lang',lang);shell();render();
  };
  q('#footer').innerHTML='<div class="foot"><div class="wrap split"><span><strong>NuLife Dominicana</strong> · Sosúa &amp; Cabarete</span><a href="'+portal+'">'+L('Vendor and admin sign-in','Acceso para comercios y administración')+'</a></div></div>';
}
function sampleBanner() {return '<p class="banner sample-notice">'+L('Preview with sample vendors. Orders here are for testing only.','Vista previa con tiendas de ejemplo. Los pedidos aquí son solo de prueba.')+'</p>';}
function marketplace({stores}) {
  main.innerHTML='<section class="hero wrap"><div class="hero-copy"><span class="location">'+icon('pin')+' Sosúa &amp; Cabarete</span>'+
    '<h1>'+L('Shop local.<br><em>Stay local.</em>','Compra local.<br><em>Vive local.</em>')+'</h1>'+
    '<p>'+L('Order fresh finds and island favorites delivered to your villa or apartment.','Pide productos frescos y sabores de la isla a tu villa o apartamento.')+'</p>'+
    '<a class="button gold" href="#vendors">'+icon('bag')+' '+L('Browse vendors','Ver comercios')+'</a></div>'+
    '<img class="hero-img" src="/hero.webp" alt="'+L('Basket of tropical fruit overlooking the coast','Canasta de frutas tropicales frente a la costa')+'" fetchpriority="high"></section>'+
    '<section id="vendors" class="market wrap"><div class="split market-head"><div><div class="eyebrow">'+L('The marketplace','El mercado')+'</div><h2>'+L('Local vendors','Comercios locales')+'</h2>'+
    '<p class="hint">'+L('Find something fresh from the north coast.','Encuentra algo fresco de la costa norte.')+'</p></div>'+
    '<label class="search">'+icon('search')+'<input id="vendor-search" type="search" aria-label="'+L('Search vendors','Buscar comercios')+'" placeholder="'+L('Search vendors','Buscar comercios')+'" value="'+E(query)+'"></label></div>'+
    '<div class="filters" aria-label="'+L('Vendor categories','Categorías de comercios')+'"></div><div id="stores"></div></section>';
  const storeCards=()=>{
    const list=stores.filter(s=>(filter==='all'||s.category===filter)&&[s.name,human(s.description),s.areas,category(s.category)].join(' ').toLowerCase().includes(query.toLowerCase().trim()));
    q('#stores').innerHTML=list.length?'<div class="grid">'+list.map(s=>'<article class="card">'+image(s.logo,'cover '+(s.demo?'':'logo-cover'))+
      '<div class="card-body"><div class="badge-line">'+(s.category?'<span class="category">'+E(category(s.category))+'</span>':'')+
      (s.demo?' <span class="category preview-label">'+L('Sample vendor','Tienda de ejemplo')+'</span>':s.orderable?'':' <span class="category preview-label">'+L('Catalog only','Solo catálogo')+'</span>')+'</div>'+
      '<h3><a href="/store/'+E(s.slug)+'">'+E(s.name)+'</a></h3>'+(s.description?'<p class="hint">'+E(human(s.description))+'</p>':'')+
      '<div class="card-meta">'+(s.areas?'<span>'+icon('pin')+' '+E(s.areas)+'</span>':'')+'<span>'+icon('truck')+' '+E(deliveryFee(s.fee))+'</span></div>'+
      '<a class="button secondary" href="/store/'+E(s.slug)+'">'+L('Visit store','Ver tienda')+'</a></div></article>').join('')+'</div>':
      '<p class="empty">'+(stores.length?L('No vendors match your search.','No hay comercios que coincidan.'):L('No vendors are open in the marketplace yet.','Aún no hay comercios disponibles en el mercado.'))+'</p>';
  };
  function filters() {
    const options=[['all',L('All vendors','Todos los comercios')],...Object.entries(categories()),...Array.from(new Set(stores.map(s=>s.category).filter(c=>c&&!categories()[c]))).map(c=>[c,human(c)])];
    q('.filters').innerHTML=options.map(([key,title])=>pill((catIcons[key]?icon(catIcons[key])+' ':'')+E(title),key===filter,'data-filter="'+E(key)+'"')).join('');
    q('.filters').querySelectorAll('button').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;filters();storeCards();q('[data-filter="'+CSS.escape(filter)+'"]').focus();});
  }
  filters();storeCards();
  q('#vendor-search').addEventListener('input',event=>{query=event.target.value;storeCards();});
}
function validQuantity(value,unit) {return value>0&&value<=1000&&Math.round(value*(unit==='lb'?1000:1))/(unit==='lb'?1000:1)===value;}
function storefront({store:s,products}) {
  const info=[
   [L('Delivery areas','Zonas de entrega'),s.areas],[L('Hours','Horario'),s.hours],
   [L('Delivery fee','Tarifa de entrega'),deliveryFee(s.fee)],[s.nulife_managed?L('NuLife WhatsApp','WhatsApp de NuLife'):L('Contact','Contacto'),s.contact],
   [L('Ordering instructions','Instrucciones para pedidos'),s.instructions]
  ];
  const link=location.origin+'/store/'+s.slug;
  main.innerHTML=page(back('/',L('Marketplace','Mercado'))+
    '<div class="store-hero">'+(s.logo?image(s.logo,'store-logo',s.name):'')+'<div>'+(s.category?'<span class="location">'+E(category(s.category))+'</span>':'')+
    heading(E(s.name))+(s.description?'<p>'+E(human(s.description))+'</p>':'')+'</div>'+btn(icon('share')+' '+L('Copy store link','Copiar enlace de tienda'),'secondary','data-copy="'+E(link)+'"')+'</div>',
    (s.demo?sampleBanner():'')+(s.orderable
      ?s.nulife_managed?'<p class="banner sample-notice">'+L('NuLife handles orders for this store.','NuLife gestiona los pedidos de esta tienda.')+'</p>':''
      :'<p class="banner sample-notice">'+E(errorText(new Error('ordering_closed')))+'</p>')+panel(L('Delivery details','Detalles de entrega'),'<dl class="info-grid">'+info.filter(x=>x[1]).map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+E(value)+'</dd></div>').join('')+'</dl>')+
    '<section class="products"><h2 class="section-title">'+L('Shop the catalog','Compra en el catálogo')+'</h2><div class="grid products">'+products.map(product=>productCard(product,s.orderable)).join('')+
    '</div>'+(!products.length?'<p class="empty">'+L('This store has no products available yet.','Esta tienda aún no tiene productos disponibles.')+'</p>':'')+'</section>',true);
  main.querySelectorAll('.product-order').forEach(form=>submit(form,data=>{
    const product=products.find(row=>row.id===form.dataset.id);
    const quantity=Number(data.get('quantity'));
    if(!validQuantity(quantity,product.unit)) throw new Error('quantity');
    if(cart.items.length&&cart.store!==s.id) {
      if(!window.confirm(L('Your cart contains items from '+cart.name+'. Clear it to order from '+s.name+'?','Hay productos de '+cart.name+' en tu carrito. ¿Vaciarlo para pedir de '+s.name+'?'))) return;
      cart={items:[]};
    }
    const item=cart.items.find(row=>row.id===product.id);
    if(item) {
      const combined=Math.round((item.quantity+quantity)*1000)/1000;
      if(!validQuantity(combined,product.unit)) throw new Error('quantity');
      Object.assign(item,product,{quantity:combined});
    } else {
      if(cart.items.length>=16) throw new Error('cart');
      cart.items.push({...product,quantity});
    }
    Object.assign(cart,{store:s.id,slug:s.slug,name:s.name,fee:s.fee,demo:s.demo,managed:Boolean(s.nulife_managed),orderable:Boolean(s.orderable),attempt:crypto.randomUUID()});
    persistCart();toast(L('Added to cart','Agregado al carrito'));
  }));
}
function productCard(p,orderable) {
  return '<article class="card product-card">'+(p.photo?image(p.photo,'cover'): '')+'<div class="card-body">'+
    (p.category?'<span class="category">'+E(category(p.category))+'</span>':'')+'<h3>'+E(human(p.name))+'</h3>'+
    (p.description?'<p class="hint">'+E(human(p.description))+'</p>':'')+'<p class="price">'+money(p.cents)+' / '+E(unitName(p))+'</p>'+
    (p.unit==='lb'?'<p class="hint">'+L('Total based on final weight','Total según el peso final')+'</p>':'')+
    (p.soldout?'<span class="status stopped">'+L('Sold out','Agotado')+'</span>':!orderable?'':
      '<form class="product-order" data-id="'+E(p.id)+'"><label>'+L('Qty.','Cant.')+'<input name="quantity" type="number" inputmode="decimal" required min="'+(p.unit==='lb'?'0.001':'1')+'" max="1000" step="'+(p.unit==='lb'?'0.001':'1')+'" value="1"></label>'+
      btn(icon('cart')+' '+L('Add to cart','Agregar'))+'</form>')+'</div></article>';
}
function costs(items,fee,estimated,total) {
  return '<div class="rows">'+items.map(p=>'<div class="row"><div><strong>'+E(human(p.name))+'</strong><p class="hint">'+E(p.quantity)+' '+E(unitName(p))+' × '+money(p.cents)+'</p>'+
    (p.actual!=null?'<p class="hint">'+L('Final weight','Peso final')+' '+E(p.actual)+' '+units('lb')+'</p>':'')+'</div><strong>'+money(Math.round((p.actual??p.quantity)*p.cents))+'</strong></div>').join('')+
    '<div class="row"><span>'+L('Delivery','Entrega')+'</span><strong>'+(fee==null?L('To be confirmed','Por confirmar'):money(fee))+'</strong></div>'+
    '<div class="row order-total"><strong>'+(estimated?L('Estimated total','Total estimado'):L('Total','Total'))+'</strong><strong>'+money(total)+'</strong></div></div>'+
    (items.some(p=>p.unit==='lb'&&p.actual==null)?'<p class="hint">'+L('The amount will be updated using the actual weight.','El importe se actualizará según el peso real.')+'</p>':'');
}
function cartScreen() {
  const title=heading(L('Your cart','Tu carrito'));
  if(!cart.items.length) {
    main.innerHTML=page(back('/',L('Marketplace','Mercado'))+title,panel('', '<p>'+L('Your cart is empty.','Tu carrito está vacío.')+'</p><br><a class="button" href="/#vendors">'+L('Browse vendors','Ver comercios')+'</a>'));
    return;
  }
  const {items,fee}=cart;
  const canOrder=cart.orderable!==false;
  const total=items.reduce((sum,p)=>sum+Math.round(p.quantity*p.cents),fee||0);
  const list='<div class="rows">'+items.map(p=>'<div class="row"><div><strong>'+E(human(p.name))+'</strong><p class="hint">'+E(p.quantity)+' '+E(unitName(p))+' × '+money(p.cents)+'</p></div>'+
    btn(L('Remove','Quitar'),'secondary small','type="button" data-remove="'+E(p.id)+'"')+'</div>').join('')+'</div>';
  const form=canOrder?'<form id="checkout" class="form">'+errorBox+'<div class="form-grid">'+
    input('guest',L('Full name','Nombre completo'),'','required autocomplete="name" maxlength="140"')+
    input('phone',L('WhatsApp number','Número de WhatsApp'),'','required type="tel" autocomplete="tel" placeholder="+1 809 555 0100"')+
    input('property',L('Property','Propiedad'),'','required maxlength="140"')+
    input('room',L('Villa or apartment number','Número de villa o apartamento'),'','required maxlength="80"')+
    input('date',L('Preferred date','Fecha preferida'),'','required type="date" min="'+today()+'"')+
    input('time',L('Preferred time (local)','Hora preferida (local)'),'','required type="time"')+
    area('notes',L('Notes (optional)','Notas (opcional)'))+'</div>'+
    '<p class="hint">'+(cart.managed?L('NuLife will coordinate your order and payment.','NuLife coordinará tu pedido y el pago.'):L('You will arrange payment directly with the vendor.','Coordinarás el pago directamente con el comercio.'))+'</p>'+
    (fee===null?'<p class="hint">'+L('Confirm any delivery fee with the vendor.','Confirma la tarifa de entrega con el comercio.')+'</p>':'')+
    btn(L('Place order','Hacer pedido'))+'</form>':'<p class="banner">'+E(errorText(new Error('ordering_closed')))+'</p>';
  main.innerHTML=page(back('/store/'+cart.slug,L('Continue shopping','Seguir comprando'))+title,(cart.demo?sampleBanner():'')+
    '<div class="checkout"><div class="checkout-items stack">'+panel(E(cart.name),list+btn(L('Refresh cart','Actualizar carrito'),'secondary small','id="refresh-cart" type="button"')+
    costs(items,fee,items.some(p=>p.unit==='lb')||fee===null,total))+'</div><div class="checkout-form">'+panel(L('Delivery information','Datos de entrega'),form)+'</div></div>',true);
  main.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{
    cart.items=cart.items.filter(p=>p.id!==button.dataset.remove);
    cart.attempt=crypto.randomUUID();persistCart();cartScreen();
  });
  q('#refresh-cart').onclick=async()=>{
    try {
      const {store,products}=await api('/store/'+encodeURIComponent(cart.slug));
      cart.items=cart.items.flatMap(item=>{
        const latest=products.find(p=>p.id===item.id&&!p.soldout&&validQuantity(item.quantity,p.unit));
        return latest?[{...latest,quantity:item.quantity}]:[];
      });
      cart.fee=store.fee;cart.managed=Boolean(store.nulife_managed);cart.orderable=Boolean(store.orderable);cart.attempt=crypto.randomUUID();persistCart();cartScreen();toast(L('Cart updated','Carrito actualizado'));
    } catch(e) {toast(errorText(e));}
  };
  if(!canOrder) return;
  submit(q('#checkout'),async data=>{
    if(!cart.attempt) {cart.attempt=crypto.randomUUID();persistCart();}
    const result=await api('/order',{...Object.fromEntries(data),store:cart.store,fee:cart.fee,attempt:cart.attempt,
      items:cart.items.map(p=>({id:p.id,quantity:p.quantity,cents:p.cents,unit:p.unit}))});
    cart={items:[]};persistCart();location.assign('/order/'+result.token);
  });
}
function payment(o) {
  const number=o.contact?.replace(/\D/g,'');
  const instructions=o.nulife_managed?L('Contact NuLife to coordinate payment.','Contacta a NuLife para coordinar el pago.')
    :L('Arrange payment directly with '+o.store_name+'.','Coordina el pago directamente con '+o.store_name+'.');
  return '<p>'+E(instructions)+'</p>'+
    (number?'<a class="whatsapp" rel="noopener noreferrer" target="_blank" href="https://wa.me/'+E(number)+'?text='+encodeURIComponent(L('Hello, my order number is ','Hola, mi número de pedido es ')+o.number)+'">WhatsApp</a>':'');
}
function orderSummary(o) {
  return costs(o.items.map(p=>({...p,quantity:p.quantity/1000,actual:p.actual==null?null:p.actual/1000})),o.fee,o.estimated,o.total);
}
function statusScreen({order:o}) {
  const orderStatuses=['new','confirmed','preparing','out_for_delivery','delivered'];
  const stages=o.status==='declined'?[]:orderStatuses.map((s,i)=>'<span class="'+(i<=orderStatuses.indexOf(o.status)?'done':'')+'">'+statusName(s)+'</span>');
  main.innerHTML=page(back('/',L('Marketplace','Mercado'))+heading(L('Order status','Estado del pedido')),
    '<div class="stack">'+panel(E(o.number),'<div class="stack"><div class="split"><strong>'+E(o.store_name)+'</strong>'+status(o.status)+'</div>'+
    (stages.length?'<div class="steps">'+stages.join('')+'</div>':'')+
    '<p>'+E(o.property)+' · '+E(o.room)+'<br>'+E(formatDate(new Date(o.delivery_date+'T'+o.delivery_time+':00-04:00')))+'<br><span class="hint">'+L('Preferred delivery time','Horario de entrega preferido')+'</span></p>'+
    '<div class="private-shared"><p class="hint">'+L('Save this private link to check for updates. Anyone with the link can view this order.','Guarda este enlace privado para ver cambios. Cualquier persona con el enlace puede ver el pedido.')+'</p>'+
    shareBox(location.origin+location.pathname)+'</div>'+btn(L('Refresh status','Actualizar estado'),'secondary small','id="refresh-order"')+'</div>')+
    panel(L('Order summary','Resumen del pedido'),orderSummary(o))+panel(L('Payment','Pago'),payment(o))+'</div>');
  q('#refresh-order').onclick=()=>render();
}
function authScreen(view,name,secret) {
  const inviting=view==='invite', setup=view==='setup';
  const creating=inviting||setup;
  const title=setup?L('Set up NuLife administration','Configura la administración de NuLife'):inviting?L('Set up your vendor account','Crea tu cuenta de comercio'):L('Vendor and admin sign-in','Acceso para comercios y administración');
  const body='<form class="form" id="auth">'+errorBox+
    (inviting?'<p>'+L('Your invitation is for','Tu invitación es para')+' <strong>'+E(name)+'</strong>.</p>':'')+
    input('email',L('Email','Correo electrónico'),'','type="email" required autocomplete="username"')+
    input('password',L('Password','Contraseña'),'','type="password" required maxlength="128" '+(creating?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'))+
    (creating?'<p class="hint">'+L('Use at least 12 characters. Sign in with this account on future visits.','Usa al menos 12 caracteres. Usa esta cuenta la próxima vez que ingreses.')+'</p>':'')+
    btn(setup?L('Create administrator account','Crear cuenta de administración'):inviting?L('Accept invitation','Aceptar invitación'):L('Sign in','Iniciar sesión'))+'</form>';
  main.innerHTML=page(back('/',L('Marketplace','Mercado'))+heading(title),panel('',body));
  submit(q('#auth'),async data=>{
    const fields=Object.fromEntries(data);
    if(setup) {
      await api('/setup',{...fields,key:secret});
      location.replace('/login');
      return;
    }
    const result=await api(inviting?'/invite':'/login',{...fields,...(inviting?{token:secret}:{})});
    const returnTo=segments()[1]===result.role&&/^#(orders|order\/[a-f0-9-]{36})$/.test(location.hash)?location.hash:'';
    location.assign('/'+result.role+returnTo);
  });
}
const accountHeading=(title,body)=>'<div class="split">'+heading(title)+btn(L('Sign out','Cerrar sesión'),'secondary small','id="logout"')+'</div>'+body;
function portalNav(tabs,tab) {
  return '<div class="tabs">'+tabs.map(([id,name])=>pill(name,tab===id,'data-tab="'+id+'"')).join('')+'</div>';
}
function setTab(value) {orderPage=0;screenEdit='';activeProduct=null;csvFile='';location.hash=value;}
function notificationPanel() {
  return '<section class="panel order-alerts"><div class="split"><div><h3>'+L('Order alerts','Avisos de pedidos')+
    '</h3><p class="hint" id="pending-orders" aria-live="polite"></p></div><div class="actions" id="alert-buttons"></div></div>'+
    '<p class="hint" id="alert-help" aria-live="polite"></p></section>';
}
async function connectNotifications() {
  const controls=q('#alert-buttons'), help=q('#alert-help'), pending=q('#pending-orders');
  const updatePending=count=>{
    pending.textContent=count===1?L('1 order awaiting confirmation','1 pedido pendiente de confirmación')
      :L(count+' orders awaiting confirmation',count+' pedidos pendientes de confirmación');
  };
  try {
    const config=await api('/notifications');
    if(!controls.isConnected) return;
    updatePending(config.pending);
    const timer=setInterval(async()=>{
      if(!controls.isConnected) {clearInterval(timer);return;}
      if(document.hidden) return;
      try {updatePending((await api('/notifications')).pending);} catch {}
    },30000);
    notificationPoll=timer;
    if(!config.publicKey) {
      help.textContent=errorText(new Error('push_unavailable'));
      return;
    }
    if(!('Notification' in window)||!('PushManager' in window)) {
      help.textContent=L('On iPhone or iPad, add this site to your Home Screen and open it from there to enable alerts. Other devices need a browser that supports push notifications.','En iPhone o iPad, añade este sitio a la pantalla de inicio y ábrelo desde allí para activar los avisos. Otros dispositivos requieren un navegador compatible.');
      return;
    }
    if(Notification.permission==='denied') {
      help.textContent=L('Allow notifications for this site in your browser settings.','Permite las notificaciones de este sitio en los ajustes del navegador.');
      return;
    }
    const installed=await serviceRegistration;
    if(!installed) throw new Error('push_unavailable');
    const registration=await navigator.serviceWorker.ready;
    if(!controls.isConnected) return;
    let subscription=await registration.pushManager.getSubscription();
    let enabled=subscription&&Notification.permission==='granted'&&
      (await api('/notifications',{action:'check',endpoint:subscription.endpoint})).enabled;
    function paint() {
      controls.innerHTML=enabled
        ?btn(L('Send test alert','Enviar aviso de prueba'),'secondary small','id="alert-test"')+
          btn(L('Turn off alerts','Desactivar avisos'),'secondary small','id="alert-disable"')
        :btn(L('Enable order alerts','Activar avisos de pedidos'),'small','id="alert-enable"');
      help.textContent=enabled?L('Order alerts are on for this device.','Los avisos están activados en este dispositivo.')
        :L('Receive a device notification when a new order needs your attention.','Recibe una notificación en este dispositivo cuando llegue un pedido.');
      for(const button of controls.querySelectorAll('button')) button.onclick=async()=>{
        const buttons=controls.querySelectorAll('button');
        buttons.forEach(b=>b.disabled=true);
        try {
          if(button.id==='alert-enable') {
            const key=Uint8Array.from(atob(config.publicKey.replaceAll('-','+').replaceAll('_','/')+'='),c=>c.charCodeAt(0));
            if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
            const device=subscription.toJSON();
            await api('/notifications',{action:'enable',endpoint:device.endpoint,keys:device.keys,language:lang});
            enabled=true;
            paint();
          } else if(button.id==='alert-disable') {
            await api('/notifications',{action:'disable',endpoint:subscription.endpoint});
            await subscription.unsubscribe().catch(()=>false);
            subscription=null;
            enabled=false;
            paint();
          } else {
            await api('/notifications',{action:'test',endpoint:subscription.endpoint});
            toast(L('Test alert sent to this device.','Aviso de prueba enviado a este dispositivo.'));
          }
        } catch(error) {
          if(error.message==='push_expired') {
            await subscription?.unsubscribe().catch(()=>false);
            subscription=null;
            enabled=false;
            paint();
          }
          help.textContent=Notification.permission==='denied'
            ?L('Allow notifications for this site in your browser settings.','Permite las notificaciones de este sitio en los ajustes del navegador.')
            :errorText(error);
        } finally {buttons.forEach(b=>b.disabled=false);}
      };
    }
    paint();
  } catch(error) {
    if(controls.isConnected) help.textContent=errorText(error);
  }
}
function connectPortal() {
  q('#logout').onclick=async()=>{
    try {await api('/logout',{});location.assign('/');} catch(error) {toast(errorText(error));}
  };
  connectNotifications();
  main.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
}
const storeState=s=>s.paused?L('Paused by NuLife','Pausada por NuLife'):s.approved?L('Published','Publicada'):L('Pending NuLife approval','Pendiente de aprobación de NuLife');
const storeBadge=s=>'<span class="status '+(s.paused?'stopped':s.approved?'':'waiting')+'">'+storeState(s)+'</span>';
function imageField(name,text,existing) {
  return '<div class="full">'+(existing?image(existing,'large-logo'):'')+
    '<label>'+text+'<input type="file" name="'+name+'" accept="image/*"></label>'+
    (existing?check('clear',L('Remove current image','Quitar imagen actual')):'')+'</div>';
}
async function phoneImage(file) {
  if(!file||!file.size) return undefined;
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();
    img.src=url;await img.decode();
    const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const context=canvas.getContext('2d');
    context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.84);
  } catch {throw new Error('image');}
  finally {URL.revokeObjectURL(url);}
}
function vendorStore(s) {
  const deliveryLocked=s.nulife_managed?'disabled':'';
  const fields=input('name',L('Store name','Nombre de la tienda'),s.name,'required maxlength="140"')+
    input('category',L('Store category','Categoría de la tienda'),s.category,'list="store-categories"')+
    '<datalist id="store-categories">'+Object.entries(categories()).map(([id,name])=>choice(id,name)).join('')+'</datalist>'+
    area('description',L('Store description','Descripción de la tienda'),s.description)+
    input('contact',L('WhatsApp or phone','WhatsApp o teléfono'),s.contact,'type="tel"')+
    input('areas',L('Delivery areas','Zonas de entrega'),s.areas,deliveryLocked)+
    input('hours',L('Delivery hours','Horario de entrega'),s.hours,deliveryLocked)+
    input('fee',L('Delivery fee (RD$)','Tarifa de entrega (RD$)'),s.fee==null?'':s.fee/100,'type="number" min="0" step="0.01" '+deliveryLocked)+
    area('instructions',L('Ordering instructions','Instrucciones para pedidos'),s.instructions)+imageField('logo',L('Store logo','Logo de la tienda'),s.logo);
  const share=s.approved&&!s.paused?panel(L('Public storefront','Tienda pública'),shareBox(location.origin+'/store/'+s.slug,true)):'';
  return '<div class="stack">'+share+panel(L('Store details','Datos de la tienda'),'<form id="store-form" class="form">'+errorBox+
    (s.nulife_managed?'<p class="banner">'+L('NuLife manages delivery settings for this storefront.','NuLife gestiona los ajustes de entrega de esta tienda.')+'</p>':'')+
    '<div class="form-grid">'+fields+'</div>'+btn(L('Save storefront','Guardar tienda'))+'</form>')+'</div>';
}
function productEditor(p={}) {
  return panel(p.id?L('Edit product','Editar producto'):L('Add product','Agregar producto'),'<form class="form" id="product-form">'+errorBox+'<div class="form-grid">'+
    input('name',L('Product name','Nombre del producto'),p.name,'required maxlength="140"')+
    input('code',L('Product code','Código de producto'),p.code,'required maxlength="60"')+
    input('category',L('Category','Categoría'),p.category)+input('price',L('Price (RD$)','Precio (RD$)'),p.cents==null?'':p.cents/100,'type="number" min=".01" step=".01" required')+
    '<label>'+L('Sold by','Se vende por')+'<select name="unit">'+['unit','package','lb'].map(u=>choice(u,units(u),p.unit||'unit')).join('')+'</select></label>'+
    input('pack',L('Package size (optional)','Tamaño del paquete (opcional)'),p.pack,'placeholder="500 ml" maxlength="70"')+
    area('description',L('Description','Descripción'),p.description)+imageField('photo',L('Product photo','Foto del producto'),p.photo)+
    check('hidden',L('Hide from guests','Ocultar a huéspedes'),p.hidden)+check('soldout',L('Mark as sold out','Marcar como agotado'),p.soldout)+'</div>'+
    (p.paused?'<p class="banner">'+L('NuLife has paused this product.','NuLife ha pausado este producto.')+'</p>':'')+
    '<div class="actions">'+btn(L('Save product','Guardar producto'))+btn(L('Cancel','Cancelar'),'secondary','id="editor-cancel" type="button"')+'</div></form>');
}
function vendorCatalog(products) {
  if(screenEdit==='product') return productEditor(activeProduct||{});
  if(screenEdit==='csv') return panel(L('Import spreadsheet','Importar hoja de cálculo'),
    '<form class="form" id="csv-form">'+errorBox+'<p>'+L('Download the template, keep its column headers, and use the same product code to update an existing item. Use a period as the decimal separator.','Descarga la plantilla, conserva sus encabezados y usa el mismo código para actualizar un producto existente. Usa el punto como separador decimal.')+'</p>'+
    '<p class="hint">'+L('Units: unit, package or lb. Use true or false for hidden and soldout.','Unidades: unidad, paquete o libra. Usa sí/no o true/false para hidden (oculto) y soldout (agotado).')+'</p>'+
    '<a class="button secondary" download="nulife-catalog-template.csv" href="/template.csv">'+L('Download CSV template','Descargar plantilla CSV')+'</a>'+
    '<label>'+L('Catalog CSV','Archivo CSV del catálogo')+'<input name="csv" type="file" accept=".csv,text/csv" required></label>'+
    '<div class="actions">'+btn(L('Preview changes','Previsualizar cambios'))+btn(L('Cancel','Cancelar'),'secondary','id="editor-cancel" type="button"')+'</div></form><div id="csv-result"></div>');
  return panel(L('Products','Productos'),'<div class="actions">'+btn(L('Add product','Agregar producto'),'','id="add-product"')+btn(L('Import CSV','Importar CSV'),'secondary','id="import-csv"')+'</div><div class="rows">'+
    products.map(p=>'<div class="row"><div><strong>'+E(human(p.name))+'</strong><p class="hint">'+E(p.code)+' · '+money(p.cents)+' / '+E(unitName(p))+'</p><div class="actions">'+
      (p.paused?'<span class="status stopped">'+L('Paused','Pausado')+'</span>':'')+(p.hidden?'<span class="status waiting">'+L('Hidden','Oculto')+'</span>':'')+
      (p.soldout?'<span class="status stopped">'+L('Sold out','Agotado')+'</span>':'')+'</div></div>'+
      btn(L('Edit','Editar'),'secondary small','data-product="'+E(p.id)+'"')+'</div>').join('')+
    (products.length?'':'<p class="empty">'+L('Add your first product to start your catalog.','Agrega tu primer producto para iniciar el catálogo.')+'</p>')+'</div>');
}
function csvPreview(data) {
  const haveErrors=data.rows.some(x=>x.error);
  q('#csv-result').innerHTML='<div class="csv-wrap"><table><thead><tr><th>'+L('Row','Fila')+'</th><th>'+L('Product code','Código')+'</th><th>'+
    L('Change','Cambio')+'</th><th>'+L('Price','Precio')+'</th></tr></thead><tbody>'+data.rows.map(row=>{
      if(row.error) return '<tr><td>'+row.line+'</td><td colspan="3">'+E(errorText(new Error(row.error)))+'</td></tr>';
      const {product:p,previous}=row;
      return '<tr><td>'+row.line+'</td><td>'+E(p.code)+'</td><td><strong>'+L(row.action==='add'?'Add':'Update',row.action==='add'?'Agregar':'Actualizar')+
        '</strong> · '+E(human(p.name))+' / '+E(unitName(p))+'<br>'+E(p.category)+(p.description?' · '+E(p.description):'')+
        (p.hidden?' · '+L('Hidden','Oculto'):'')+(p.soldout?' · '+L('Sold out','Agotado'):'')+'</td><td>'+
        (previous?money(previous.cents)+' → ':'')+money(p.cents)+'</td></tr>';
    }).join('')+'</tbody></table></div>'+
    (haveErrors?'<p class="banner error subtle">'+L('Fix invalid rows before applying.','Corrige las filas inválidas antes de aplicar.')+'</p>':
    '<form id="csv-apply" class="form subtle">'+errorBox+btn(L('Apply catalog changes','Aplicar cambios al catálogo'))+'</form>');
  if(!haveErrors) submit(q('#csv-apply'),async()=>{
    const res=await api('/vendor/csv',{csv:csvFile,confirm:data.fingerprint});
    screenEdit='';csvFile='';await render();toast(L(res.saved+' products saved',res.saved+' productos guardados'));
  });
}
function vendorConnect(data,tab) {
  const editorCancel=q('#editor-cancel');
  if(editorCancel) editorCancel.onclick=()=>{screenEdit='';activeProduct=null;csvFile='';render();};
  if(tab==='store') submit(q('#store-form'),async form=>{
    const v=Object.fromEntries(form);
    await api('/vendor/store',{...v,logo:await phoneImage(v.logo),clearLogo:v.clear==='on'});
    await render();toast(L('Storefront saved','Tienda guardada'));
  });
  if(tab!=='catalog') return;
  if(q('#add-product')) q('#add-product').onclick=()=>{screenEdit='product';activeProduct=null;render();};
  if(q('#import-csv')) q('#import-csv').onclick=()=>{screenEdit='csv';render();};
  main.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>{
    activeProduct=data.products.find(p=>p.id===b.dataset.product);screenEdit='product';render();
  });
  if(q('#product-form')) submit(q('#product-form'),async form=>{
    const v=Object.fromEntries(form);
    await api('/vendor/product',{...v,id:activeProduct?.id,photo:await phoneImage(v.photo),
      clearPhoto:v.clear==='on',hidden:v.hidden==='on',soldout:v.soldout==='on'});
    screenEdit='';activeProduct=null;await render();toast(L('Product saved','Producto guardado'));
  });
  if(q('#csv-form')) submit(q('#csv-form'),async form=>{
    q('#csv-result').innerHTML='';
    const file=form.get('csv');
    if(file.size>750000) throw new Error('csv_size');
    csvFile=await file.text();
    csvPreview(await api('/vendor/csv',{csv:csvFile}));
  });
}
const managedLabel=()=>L('Managed by NuLife','Gestionado por NuLife');
function ordersList(orders,admin) {
  return panel(L('Orders','Pedidos'),'<div class="rows">'+orders.slice(0,50).map(o=>'<div class="row"><div><strong>'+E(o.number)+'</strong><p class="hint">'+
    E(o.guest)+(admin?' · '+E(o.store_name):'')+(o.nulife_managed?' · '+managedLabel():'')+' · '+E(formatDate(o.created))+'</p></div><div class="actions">'+status(o.status)+
    '<a class="button secondary small" href="#order/'+E(o.id)+'">'+L('View order','Ver pedido')+'</a></div></div>').join('')+
    (!orders.length?'<p class="empty">'+L('No orders on this page.','No hay pedidos en esta página.')+'</p>':'')+'</div><div class="actions">'+
    (orderPage?btn(L('Previous orders','Pedidos anteriores'),'secondary small','data-order-page="'+(orderPage-1)+'"'):'')+
    (orders.length>50?btn(L('Next orders','Más pedidos'),'secondary small','data-order-page="'+(orderPage+1)+'"'):'')+'</div>');
}
function orderDetails(o,admin) {
  const phone=o.phone.replace(/\D/g,'');
  const weights=o.items.filter(p=>p.unit==='lb');
  const editable=admin===Boolean(o.nulife_managed)&&transitions[o.status].length>0;
  return '<div class="stack">'+back('#orders',L('All orders','Todos los pedidos'))+
    panel(E(o.number),'<div class="stack"><div class="split"><strong>'+E(o.store_name)+'</strong>'+status(o.status)+'</div>'+
    (o.nulife_managed?'<p class="hint">'+managedLabel()+'</p>':'')+
    '<dl class="info-grid">'+[
      [L('Guest','Huésped'),E(o.guest)],[L('WhatsApp','WhatsApp'),'<a class="whatsapp" rel="noopener noreferrer" target="_blank" href="https://wa.me/'+E(phone)+'">'+E(o.phone)+'</a>'],
      [L('Property','Propiedad'),E(o.property)+' · '+E(o.room)],[L('Preferred delivery','Entrega preferida'),E(formatDate(new Date(o.delivery_date+'T'+o.delivery_time+':00-04:00')))],
      ...(o.notes?[[L('Notes','Notas'),E(o.notes)]]:[])
    ].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl></div>')+
    panel(L('Order summary','Resumen del pedido'),orderSummary(o))+
    (editable?panel(L('Update order','Actualizar pedido'),'<form class="form" id="update-order">'+errorBox+
      (weights.length?'<div class="form-grid">'+weights.map(p=>input('weight-'+p.id,L('Final weight (lb)','Peso final (lb)')+' · '+human(p.name),p.actual==null?'':p.actual/1000,'type="number" min="0.001" max="1000" step="0.001" inputmode="decimal"')).join('')+'</div>':'')+
      '<label>'+L('Order status','Estado del pedido')+'<select name="status">'+[o.status,...transitions[o.status]].map(s=>choice(s,statusName(s),o.status)).join('')+'</select></label>'+
      btn(L('Save update','Guardar cambios'))+'</form>'):'')+'</div>';
}
function connectOrder(admin=false) {
  main.querySelectorAll('[data-order-page]').forEach(b=>b.onclick=()=>{orderPage=Number(b.dataset.orderPage);render();});
  if(q('#update-order')) submit(q('#update-order'),async form=>{
    const weights={};
    for(const [key,value] of form) if(key.startsWith('weight-')&&value!=='') weights[key.slice(7)]=Number(value);
    const orderID=encodeURIComponent(location.hash.slice(7));
    await api(admin?'/admin/order?id='+orderID:'/vendor/order/'+orderID,{status:form.get('status'),...(Object.keys(weights).length?{weights}:{})});
    await render();toast(L('Order updated','Pedido actualizado'));
  });
}
function vendorDashboard(data) {
  const [active,orderID]=location.hash.slice(1).split('/');
  const tab=['catalog','orders','order'].includes(active)?active:'store';
  const title=accountHeading(L('Vendor dashboard','Panel del comercio'),'<div class="split"><p class="hint">'+E(data.store.name)+'</p>'+storeBadge(data.store)+'</div>');
  const tabs=portalNav([['store',L('Storefront','Tienda')],['catalog',L('Catalog','Catálogo')],['orders',L('Orders','Pedidos')]],tab==='order'?'orders':tab);
  const body=tab==='store'?vendorStore(data.store):tab==='catalog'?vendorCatalog(data.products):tab==='order'?orderDetails(data.order,false):ordersList(data.orders,false);
  main.innerHTML=page(title,notificationPanel()+tabs+body,true);
  connectPortal();vendorConnect(data,tab);connectOrder();
}
function inviteBox(result) {
  return '<div class="banner stack"><p>'+L('Single-use link. Expires','Enlace de un solo uso. Vence el')+' '+E(formatDate(result.expires))+'.</p>'+
    shareBox(location.origin+'/invite/'+result.token,true)+'</div>';
}
function adminStores(stores) {
  return '<div class="stack">'+panel(L('Invite a vendor','Invitar a un comercio'),
    '<form class="form" id="invite-form">'+errorBox+input('name',L('Vendor or store name','Nombre del comercio o tienda'),'','required maxlength="140"')+
    '<div class="actions">'+btn(L('Create invitation','Crear invitación'))+'</div></form><div class="subtle" id="invite-result"></div>')+
    panel(L('Storefronts','Tiendas'),'<div class="rows">'+stores.map(s=>'<div class="row"><div><strong>'+E(s.name)+'</strong><p class="hint">'+
      (s.nulife_managed?managedLabel():s.demo?L('Sample storefront','Tienda de ejemplo'):s.account?L('Vendor account active','Cuenta activa'):L('No vendor account yet','Aún sin cuenta'))+
      '</p></div><div class="actions">'+storeBadge(s)+'<a class="button secondary small" href="#review/'+E(s.id)+'">'+L('Review','Revisar')+'</a></div></div>').join('')+
      (stores.length?'':'<p class="empty">'+L('No storefronts yet.','Aún no hay tiendas.')+'</p>')+'</div>')+
    panel(L('Marketplace link','Enlace del mercado'),shareBox(location.origin+'/',true))+'</div>';
}
function managedOrdering(s) {
  const fields=input('contact',L('NuLife WhatsApp with country code','WhatsApp de NuLife con código de país'),s.managed_contact,'type="tel" required')+
    input('areas',L('Delivery areas','Zonas de entrega'),s.areas,'required maxlength="300"')+
    input('hours',L('Delivery hours','Horario de entrega'),s.hours,'required maxlength="300"')+
    input('fee',L('Delivery fee (RD$)','Tarifa de entrega (RD$)'),s.fee==null?'':s.fee/100,'type="number" min="0" step="0.01" required');
  return panel(L('NuLife-managed ordering','Pedidos gestionados por NuLife'),'<form id="managed-ordering" class="form">'+errorBox+
    '<p>'+L('Enable this to confirm and update orders on behalf of the vendor.','Activa esta opción para confirmar y actualizar pedidos en nombre del comercio.')+'</p>'+
    check('managed',L('Enable NuLife-managed ordering','Activar pedidos gestionados por NuLife'),s.nulife_managed)+
    '<fieldset class="managed-fields" '+(s.nulife_managed?'':'hidden disabled')+'><div class="form-grid">'+fields+'</div>'+
    '<p class="hint">'+L('Guests see these details. Enter 0 for free delivery.','Los huéspedes verán estos datos. Ingresa 0 para entrega gratis.')+'</p></fieldset>'+
    (s.nulife_managed?'<p class="hint">'+L('Turning this off changes who handles new orders. NuLife can still finish orders already assigned to it.','Desactivar esta opción cambia quién gestiona los pedidos nuevos. NuLife puede terminar los pedidos que ya tiene asignados.')+'</p>':'')+
    btn(L('Save ordering settings','Guardar ajustes de pedidos'))+'</form>');
}
function adminReview(s,products) {
  const top='<div class="split"><div><h2>'+E(s.name)+'</h2>'+storeBadge(s)+'</div>'+(s.logo?image(s.logo,'large-logo',s.name):'')+'</div>'+
    '<dl class="info-grid">'+[
      [L('Description','Descripción'),s.description],[L('Category','Categoría'),category(s.category)],[L('Delivery areas','Zonas de entrega'),s.areas],[L('Hours','Horario'),s.hours],
      [L('Fee','Tarifa'),s.fee==null?'':money(s.fee)],[L('Contact','Contacto'),s.contact],[L('Ordering instructions','Instrucciones para pedidos'),s.instructions]
    ].map(([label,text])=>'<div><dt>'+label+'</dt><dd>'+E(human(text)||'—')+'</dd></div>').join('')+'</dl>';
  const button=(text,action,id,style='secondary')=>btn(text,style+' small','data-mod="'+action+'" data-id="'+E(id)+'"');
  return '<div class="stack">'+back('#stores',L('All storefronts','Todas las tiendas'))+
    panel('',top+(s.id.startsWith('draft-')?'<p class="banner">'+L('Confirm package sizes where the source list omitted them, and verify delivery details before opening checkout.','Confirma las presentaciones que faltan en la lista de precios y verifica los datos de entrega antes de activar los pedidos.')+'</p>':'')+'<div class="actions">'+
    (!s.approved?button(L('Approve and publish','Aprobar y publicar'),'approve',s.id,''):'')+
    button(s.paused?L('Resume store','Reactivar tienda'):L('Pause store','Pausar tienda'),s.paused?'resume_store':'pause_store',s.id)+
    btn(L('Invite to this storefront','Invitar a esta tienda'),'secondary small','id="invite-existing" data-id="'+E(s.id)+'"')+'</div><div class="subtle" id="invite-result"></div>')+
    (s.approved&&!s.paused?panel(L('Storefront link','Enlace de la tienda'),shareBox(location.origin+'/store/'+s.slug,true)):'')+
    managedOrdering(s)+panel(L('Catalog review','Revisión del catálogo'),'<div class="rows">'+products.map(p=>'<div class="row"><div>'+
      (p.photo?image(p.photo,'large-logo'):'')+'<strong>'+E(human(p.name))+'</strong><p class="hint">'+E(p.code)+' · '+money(p.cents)+' / '+E(unitName(p))+
      (p.category?' · '+E(category(p.category)):'')+'</p>'+(p.description?'<p class="hint">'+E(human(p.description))+'</p>':'')+
      '<p class="hint">'+(p.hidden?L('Hidden','Oculto')+' · ':'')+(p.soldout?L('Sold out','Agotado')+' · ':'')+(p.paused?L('Paused by NuLife','Pausado por NuLife'):'')+'</p></div>'+
      button(p.paused?L('Resume product','Reactivar producto'):L('Pause product','Pausar producto'),p.paused?'resume_product':'pause_product',p.id)+'</div>').join('')+
      (!products.length?'<p class="empty">'+L('The store has no products yet.','La tienda aún no tiene productos.')+'</p>':'')+'</div>')+'</div>';
}
function adminDashboard(data) {
  const [active]=location.hash.slice(1).split('/');
  const tab=['orders','order','review'].includes(active)?active:'stores';
  const tabs=portalNav([['stores',L('Storefronts','Tiendas')],['orders',L('All orders','Todos los pedidos')]],['orders','order'].includes(tab)?'orders':'stores');
  const body=tab==='review'?adminReview(data.store,data.products):tab==='order'?orderDetails(data.order,true):tab==='orders'?ordersList(data.orders,true):adminStores(data.stores);
  main.innerHTML=page(accountHeading(L('NuLife administration','Administración de NuLife'),''),notificationPanel()+tabs+body,true);
  connectPortal();connectOrder(true);
  const managedForm=q('#managed-ordering');
  if(managedForm) {
    const toggle=q('[name=managed]',managedForm), fields=q('.managed-fields',managedForm);
    toggle.onchange=()=>{fields.hidden=!toggle.checked;fields.disabled=!toggle.checked;};
    submit(managedForm,async form=>{
      await api('/admin/store/ordering',{...Object.fromEntries(form),id:data.store.id,managed:form.has('managed')});
      await render();toast(L('Ordering settings saved','Ajustes de pedidos guardados'));
    });
  }
  if(q('#invite-form')) submit(q('#invite-form'),async form=>{
    q('#invite-result').innerHTML=inviteBox(await api('/admin/invite',{name:form.get('name')}));
    q('#invite-form').reset();
  });
  if(q('#invite-existing')) q('#invite-existing').onclick=async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    try {q('#invite-result').innerHTML=inviteBox(await api('/admin/invite',{id:button.dataset.id}));}
    catch(error) {toast(errorText(error));}
    finally {button.disabled=false;}
  };
  main.querySelectorAll('[data-mod]').forEach(b=>b.onclick=async()=>{
    if(b.dataset.mod==='approve'&&!window.confirm(L('Publish this storefront in the marketplace?','¿Publicar esta tienda en el mercado?'))) return;
    b.disabled=true;
    try {await api('/admin/moderate',{id:b.dataset.id,action:b.dataset.mod});await render();toast(L('Saved','Guardado'));}
    catch(error) {toast(errorText(error));}
    finally {b.disabled=false;}
  });
}
let renderSequence=0;
async function render() {
  const seq=++renderSequence;
  const current=()=>seq===renderSequence;
  clearTimeout(refreshTimer);
  clearInterval(notificationPoll);
  const [,view,parameter]=segments();
  try {
    if(!view) {const data=await api('/stores');if(current())marketplace(data);}
    else if(view==='store') {const data=await api('/store/'+encodeURIComponent(parameter));if(current())storefront(data);}
    else if(view==='cart') {
      if(cart.items.length) {
        const {store}=await api('/store/'+encodeURIComponent(cart.slug)).catch(error=>{
          if(error.message==='not_found') return {store:null};
          throw error;
        });
        cart.orderable=Boolean(store?.orderable);
        cart.managed=Boolean(store?.nulife_managed);
      }
      if(current())cartScreen();
    }
    else if(view==='setup') {
      const key=location.hash.slice(1);
      if(!/^[a-f0-9]{64}$/.test(key)) throw new Error('setup_link');
      authScreen('setup',null,key);
    }
    else if(view==='order') {
      const data=await api('/status/'+encodeURIComponent(parameter));
      if(current()) {statusScreen(data);refreshTimer=setTimeout(()=>{if(!document.hidden)render();else refreshTimer=setTimeout(render,30000);},30000);}
    }
    else if(view==='invite') {
      const data=await api('/invite?token='+encodeURIComponent(parameter));
      if(current())authScreen(view,data.name,parameter);
    }
    else if(view==='login') authScreen(view);
    else if(view==='vendor'||view==='admin') {
      if(!appUser) {authScreen('login');return;}
      if(appUser.role!==view) throw new Error('forbidden');
      const [tab,orderID]=location.hash.slice(1).split('/');
      if(view==='vendor') {
        const data=await api('/vendor/store');
        if(tab==='orders') Object.assign(data,await api('/vendor/orders?page='+orderPage));
        if(tab==='order') Object.assign(data,await api('/vendor/order/'+encodeURIComponent(orderID)));
        if(current())vendorDashboard(data);
      } else {
        const data=await api(tab==='review'?'/admin/store?id='+encodeURIComponent(orderID):tab==='order'?'/admin/order?id='+encodeURIComponent(orderID):tab==='orders'?'/admin/orders?page='+orderPage:'/admin/stores');
        if(current())adminDashboard(data);
      }
    } else throw new Error('not_found');
  } catch(error) {
    if(current())main.innerHTML=page(back('/',L('Marketplace','Mercado'))+heading(L('Page unavailable','Página no disponible')),panel('', '<p class="banner error" role="alert">'+E(errorText(error))+'</p>'));
  }
}
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-copy]');
  if(target) copy(target.dataset.copy);
});
window.addEventListener('hashchange',()=>{if(['/vendor','/admin'].includes(location.pathname))render();});
shell();
main.innerHTML='<div class="wrap empty" role="status">'+L('Loading…','Cargando…')+'</div>';
await api('/me').then(r=>appUser=r.user).catch(()=>{});
shell();await render();
