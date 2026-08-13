// â”€â”€ BUILD CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var cartRevision = 0;
var cartMutationVersion = 0;
var cartSyncInFlight = false;
var cartSyncQueued = false;
var cartSyncTimer = null;
var cartLoadToken = 0;
var lastCartSerialized = '';
var cartSyncPromise = Promise.resolve();
var CART_BACKUP_PREFIX = 'villas_cart_backup_';
var cartBackupLoaded = false;

function getCartBackupKey(){
  var clientId = loggedClient && (loggedClient.id || loggedClient.user || loggedClient.email || "");
  return CART_BACKUP_PREFIX + String(clientId || "guest");
}

function saveCartBackup(){
  try{
    localStorage.setItem(getCartBackupKey(), JSON.stringify({
      revision: cartRevision,
      items: cart
    }));
  }catch(e){}
}

function clearCartBackup(){
  try{
    localStorage.removeItem(getCartBackupKey());
  }catch(e){}
  cartBackupLoaded = false;
}

function loadCartBackup(){
  try{
    var raw = localStorage.getItem(getCartBackupKey());
    if(!raw) return false;
    var data = JSON.parse(raw);
    if(!data || !Array.isArray(data.items)) return false;
    cartRevision = Math.max(cartRevision, Number(data.revision || 0));
    cart = data.items.map(function(item){
      return {
        key: item.key || [item.ref, normalizeChoiceText(item.cor), normalizeChoiceText(item.tam)].join("|"),
        ref: item.ref,
        name: item.name,
        type: item.type,
        cor: normalizeChoiceText(item.cor),
        tam: normalizeChoiceText(item.tam),
        qty: Math.max(1, parseInt(item.qty, 10) || 0),
        price: Number(item.price || 0),
        img: item.img || null
      };
    }).filter(function(item){ return !!item.ref; });
    cartBackupLoaded = cart.length > 0;
    renderCart();
    return cart.length > 0;
  }catch(e){
    cartBackupLoaded = false;
    return false;
  }
}

function mkCard(p){
  var card = document.createElement("div");
  card.className = "card";
  card.id = "card-" + p.ref;
  card.dataset.ref = p.ref;
  card.dataset.season = p.season || "ambos";
  if(p.active === false) card.classList.add('inactive');

  // image box
  var imgBox = document.createElement("div");
  imgBox.className = "img-box";
  imgBox.dataset.action = "view";
  imgBox.dataset.ref = p.ref;
  // Admin edit button
  var editBtn = document.createElement("button");
  editBtn.className = "prod-edit-btn";
  editBtn.textContent = "✏ Editar";
  editBtn.onclick = function(e){ e.stopPropagation(); openProductEdit(p.ref); };
  imgBox.appendChild(editBtn);
  if(p.active === false){
    var inactiveFlag = document.createElement('div');
    inactiveFlag.className = 'inactive-flag';
    inactiveFlag.textContent = 'Inativo';
    imgBox.appendChild(inactiveFlag);
  }
  if(IMGS[p.ref]){
    var img = document.createElement("img");
    img.className = "prod-img";
    img.src = IMGS[p.ref];
    img.alt = "Ref " + p.ref;
    img.loading = "lazy";
    imgBox.appendChild(img);
  } else {
    var ni = document.createElement("div");
    ni.className = "no-img";
    ni.innerHTML = "<div class='no-img-ico'>&#129510;</div><span>Ref. " + p.ref + "</span>";
    imgBox.appendChild(ni);
  }
  var ov = document.createElement("div");
  ov.className = "img-ov";
 // ov.innerHTML = "<span>+ Adicionar</span>";
  imgBox.appendChild(ov);
  card.appendChild(imgBox);

  // body
  var body = document.createElement("div");
  body.className = "body";

  var pvpStr = p.pvp ? "P.V.P: " + p.pvp.toFixed(2).replace(".",",") + "€" : "";

  // cor select
  var corSel = document.createElement("select");
  corSel.id = "cor_" + p.ref;
  p.cores.forEach(function(c){ var o=document.createElement("option"); o.value=c; o.textContent=c; corSel.appendChild(o); });
  if(p.cores.length) corSel.value = p.cores[0];

  // tam select/hidden
  var tamEl;
  if(p.tams.length > 1){
    tamEl = document.createElement("select");
    tamEl.id = "tam_" + p.ref;
    tamEl.style.maxWidth = "110px";
    p.tams.forEach(function(t){ var o=document.createElement("option"); o.value=t; o.textContent=t; tamEl.appendChild(o); });
    if(p.tams.length) tamEl.value = p.tams[0];
  } else {
    tamEl = document.createElement("input");
    tamEl.type = "hidden";
    tamEl.id = "tam_" + p.ref;
    tamEl.value = p.tams[0] || "";
  }

  body.innerHTML =
    "<div class='ref'>Ref. " + p.ref + "</div>" +
    "<div class='nm'>" + p.name + "</div>" +
    "<div class='tp'>" + p.type + "</div>" +
    "<div class='pr-row'><span class='pr'>" + p.price.toFixed(2).replace(".",",") + "€</span><span class='pvp'>" + pvpStr + "</span></div>" +
    "<div class='meta'><b>Cores:</b> " + p.cores.join(", ") + "<br><b>Tam.:</b> " + p.tams.join(", ") + "</div>";

  var frow = document.createElement("div");
  frow.className = "frow";
  var fg1 = document.createElement("div"); fg1.className = "fg";
  var lbl1 = document.createElement("label"); lbl1.className = "flbl"; lbl1.textContent = "Cor";
  fg1.appendChild(lbl1); fg1.appendChild(corSel); frow.appendChild(fg1);
  if(p.tams.length > 1){
    var fg2 = document.createElement("div"); fg2.className = "fg"; fg2.style.maxWidth="110px";
    var lbl2 = document.createElement("label"); lbl2.className = "flbl"; lbl2.textContent = "Tamanho";
    fg2.appendChild(lbl2); fg2.appendChild(tamEl); frow.appendChild(fg2);
  } else {
    body.appendChild(tamEl);
  }
  body.appendChild(frow);

  var qrow = document.createElement("div");
  qrow.className = "qrow";
  var qm = document.createElement("button"); qm.className="qbtn"; qm.dataset.action="minus"; qm.dataset.ref=p.ref; qm.innerHTML="&#8722;";
  var qi = document.createElement("input"); qi.type="number"; qi.className="qinp"; qi.id="qty_"+p.ref;
  var qStep = inferQtyStep(p);
  qi.value=qStep; qi.min=qStep; qi.step=qStep; qi.max="9999";
  var qp = document.createElement("button"); qp.className="qbtn"; qp.dataset.action="plus"; qp.dataset.ref=p.ref; qp.textContent="+";
  var ab = document.createElement("button"); ab.className="abtn"; ab.id="abtn_"+p.ref; ab.dataset.action="add"; ab.dataset.ref=p.ref; ab.textContent="Adicionar";
  qrow.appendChild(qm); qrow.appendChild(qi); qrow.appendChild(qp); qrow.appendChild(ab);
  body.appendChild(qrow);
  card.appendChild(body);

  var bdg = document.createElement("div"); bdg.className="bdg"; bdg.id="bdg_"+p.ref;
  card.appendChild(bdg);
  return card;
}

// â”€â”€ EVENT DELEGATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("main").addEventListener("click", function(e){
  var el = e.target;
  var imgBox = el.closest(".img-box");
  if(imgBox && imgBox.dataset.ref){
    openProductViewer(imgBox.dataset.ref);
    return;
  }
  // buttons
  var action = el.dataset.action;
  var ref = el.dataset.ref;
  if(!action || !ref) return;
  if(action==="minus") changeQty(ref,-1);
  else if(action==="plus") changeQty(ref,1);
  else if(action==="add"){
    var live = readLiveProductSelection(ref);
    addToCart(ref, live.cor, live.tam, live.qty);
  }
});
document.getElementById("main").addEventListener("change", function(e){
  var input = e.target;
  if(!input || !input.id || input.id.indexOf("qty_") !== 0) return;
  var ref = input.id.replace("qty_","");
  input.value = normalizeQtyValue(ref, input.value);
});

// â”€â”€ ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isPack(ref){
  var p = PRODS[ref];
  return p && p.type && p.type.toLowerCase().indexOf("pack") >= 0;
}
function stepFor(ref){
  var p = PRODS[ref];
  return inferQtyStep(p || {});
}
function minFor(ref){ return stepFor(ref); }
function normalizeQtyValue(ref, value){
  var step = stepFor(ref);
  var min = minFor(ref);
  var num = parseInt(value, 10);
  if(!isFinite(num) || num < min) return min;
  return Math.max(min, Math.ceil(num / step) * step);
}
function readLiveProductSelection(ref){
  var corEl = document.getElementById("cor_" + ref);
  var tamEl = document.getElementById("tam_" + ref);
  var qtyEl = document.getElementById("qty_" + ref);
  return {
    cor: corEl ? corEl.value : "",
    tam: tamEl ? tamEl.value : "",
    qty: qtyEl ? normalizeQtyValue(ref, qtyEl.value) : minFor(ref)
  };
}

function cartSelectionPayload(sourceCart){
  return (sourceCart || cart).map(function(item){
    return {
      ref: String(item.ref || '').trim(),
      cor: String(item.cor || '').trim(),
      tam: String(item.tam || '').trim(),
      qty: Math.max(1, parseInt(item.qty, 10) || 0)
    };
  }).filter(function(item){
    return !!(item.ref && item.cor && item.tam && item.qty > 0);
  });
}

function applyCartStateFromServer(payload){
  if(!payload || typeof payload.revision === "undefined") return false;
  var revision = Number(payload.revision || 0);
  if(revision < cartRevision) return false;
  cartRevision = revision;
  cart = Array.isArray(payload.items) ? payload.items.map(function(item){
    var prod = PRODS[item.ref] || {};
    return {
      ref: item.ref,
      name: item.name || prod.name || "",
      type: item.type || prod.type || "",
      cor: item.cor,
      tam: item.tam,
      qty: Math.max(1, parseInt(item.qty, 10) || 0),
      price: Number(item.price || prod.price || 0),
      img: item.img || prod.img || IMGS[item.ref] || ""
    };
  }) : [];
  renderCart();
  cart.forEach(function(item){ updateBadge(item.ref); });
  saveCartBackup();
  return true;
}

function syncCartPanelBadgeOnly(){
  cart.forEach(function(item){ updateBadge(item.ref); });
}

function scheduleCartSync(){
  if(!loggedClient || !authToken) return Promise.resolve(false);
  cartMutationVersion += 1;
  if(cartSyncTimer){
    clearTimeout(cartSyncTimer);
    cartSyncTimer = null;
  }
  cartSyncPromise = Promise.resolve().then(function(){
    return flushCartSync();
  });
  return cartSyncPromise;
}

function getOrderRequestId(){
  try{
    var existing = sessionStorage.getItem("villas_order_request_id");
    if(existing) return existing;
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    sessionStorage.setItem("villas_order_request_id", id);
    return id;
  }catch(e){
    return String(Date.now()) + Math.random().toString(16).slice(2);
  }
}

function clearOrderRequestId(){
  try{
    sessionStorage.removeItem("villas_order_request_id");
  }catch(e){}
}

async function waitForCartSync(){
  for(var i=0;i<5;i++){
    var version = cartMutationVersion;
    await cartSyncPromise.catch(function(){ return false; });
    if(version === cartMutationVersion && !cartSyncInFlight && !cartSyncTimer){
      return true;
    }
  }
  return true;
}

async function flushCartSync(){
  if(cartSyncInFlight || !loggedClient || !authToken) {
    cartSyncQueued = true;
    return false;
  }
  cartSyncInFlight = true;
  cartSyncQueued = false;
  var snapshotVersion = cartMutationVersion;
  var payloadItems = cartSelectionPayload();
  var expectedRevision = cartRevision;
  var body = {
    revision: expectedRevision,
    items: payloadItems
  };
  lastCartSerialized = JSON.stringify(body);
  try{
    var response = await fetch(BASE_URL + "/me/cart", {
      method: "PUT",
      headers: { "Content-Type":"application/json", "X-Token": authToken || "" },
      keepalive: true,
      body: JSON.stringify(body)
    });
    var res = await response.json().catch(function(){ return {}; });
    if(snapshotVersion !== cartMutationVersion){
      return false;
    }
    if(!response.ok && response.status !== 409){
      throw new Error(res.message || "Nao foi possivel guardar o carrinho.");
    }
    if(res && typeof res.revision !== "undefined"){
      if(Number(res.revision || 0) >= cartRevision || snapshotVersion === cartMutationVersion){
        cartRevision = Number(res.revision || 0);
        if(Array.isArray(res.items)){
          cart = res.items.map(function(item){
            var prod = PRODS[item.ref] || {};
            return {
              ref: item.ref,
              name: item.name || prod.name || "",
              type: item.type || prod.type || "",
              cor: item.cor,
              tam: item.tam,
              qty: Math.max(1, parseInt(item.qty, 10) || 0),
              price: Number(item.price || prod.price || 0),
              img: item.img || prod.img || IMGS[item.ref] || ""
            };
          });
          renderCart();
          syncCartPanelBadgeOnly();
        }
      }
    }
    return true;
  } catch(e){
    return false;
  } finally {
    cartSyncInFlight = false;
    if(cartSyncQueued || snapshotVersion !== cartMutationVersion){
      cartSyncQueued = false;
      flushCartSync();
    }
  }
}

function loadCartFromServer(){
  if(!loggedClient || !authToken) return Promise.resolve(false);
  var token = ++cartLoadToken;
  return fetch(BASE_URL + "/me/cart", {
    headers: { "X-Token": authToken || "" }
  })
  .then(function(r){ return r.json().then(function(data){ return { ok:r.ok, status:r.status, body:data || {} }; }); })
  .then(function(res){
    if(token !== cartLoadToken) return false;
    if(res.status === 401 || (res.body && res.body.message && isSessionExpiredMessage(res.body.message))){
      handleSessionExpired((res.body && res.body.message) || "A sessão expirou. Volta a iniciar sessão.");
      return false;
    }
    if(!res.ok || !res.body || !res.body.ok){
      return false;
    }
    if(cartBackupLoaded && cart.length && Array.isArray(res.body.items) && !res.body.items.length && Number(res.body.revision || 0) <= cartRevision){
      renderCart();
      return true;
    }
    return applyCartStateFromServer(res.body);
  })
  .catch(function(){ return false; });
}

function clearCartOnServer(){
  if(!loggedClient || !authToken) return Promise.resolve(false);
  return fetch(BASE_URL + "/me/cart", {
    method: "DELETE",
    headers: { "Content-Type":"application/json", "X-Token": authToken || "" },
    keepalive: true,
    body: JSON.stringify({ revision: cartRevision })
  })
  .then(function(r){ return r.json().then(function(data){ return { ok:r.ok, status:r.status, body:data || {} }; }); })
  .then(function(res){
    if(res.status === 401 || (res.body && res.body.message && isSessionExpiredMessage(res.body.message))){
      handleSessionExpired((res.body && res.body.message) || "A sessão expirou. Volta a iniciar sessão.");
      return false;
    }
    if(!res.ok || !res.body || !res.body.ok){
      return false;
    }
    cartRevision = Number(res.body.revision || cartRevision);
    return true;
  })
  .catch(function(){ return false; });
}

function quickAdd(ref){
  var live = readLiveProductSelection(ref);
  addToCart(ref, live.cor, live.tam, live.qty);
}
function getSelectedProductOptions(ref){
  return readLiveProductSelection(ref);
}
function openProductViewer(ref){
  var p = PRODS[ref];
  var bg = document.getElementById("product-view-bg");
  if(!p || !bg) return;
  var opts = getSelectedProductOptions(ref);
  var img = IMGS[ref] || "";
  var imgEl = document.getElementById("product-view-img");
  var emptyEl = document.getElementById("product-view-empty");
  imgEl.src = img;
  imgEl.style.display = img ? "block" : "none";
  emptyEl.style.display = img ? "none" : "flex";
  document.getElementById("product-view-ref").textContent = "Ref. " + p.ref;
  document.getElementById("product-view-name").textContent = p.name || "";
  document.getElementById("product-view-type").textContent = p.type || "Artigo";
  document.getElementById("product-view-price").textContent = p.price.toFixed(2).replace(".", ",") + "€";
  document.getElementById("product-view-pvp").textContent = p.pvp ? "P.V.P " + p.pvp.toFixed(2).replace(".", ",") + "€" : "";
  document.getElementById("product-view-colors").textContent = (p.cores || []).join(", ") || "-";
  document.getElementById("product-view-sizes").textContent = (p.tams || []).join(", ") || "-";
  document.getElementById("product-view-step").textContent = inferQtyStep(p) + " em " + inferQtyStep(p);
  document.getElementById("product-view-choice").textContent = [opts.cor, opts.tam, opts.qty + " un."].filter(Boolean).join(" · ");
  document.getElementById("product-view-add").dataset.ref = p.ref;
  document.getElementById("product-view-edit").dataset.ref = p.ref;
  document.getElementById("product-view-edit").style.display = loggedClient && loggedClient.admin ? "" : "none";
  bg.classList.add("on");
}
function closeProductViewer(){
  var bg = document.getElementById("product-view-bg");
  if(bg) bg.classList.remove("on");
}
function changeQty(ref,d){
  var qi = document.getElementById("qty_"+ref);
  var step = stepFor(ref);
  var min  = minFor(ref);
  var cur  = parseInt(qi.value) || min;
  var next = cur + (d * step);
  qi.value = Math.max(min, next);
}
function addToCart(ref, corOverride, tamOverride, qtyOverride){
  var p = PRODS[ref]; if(!p || p.active === false) return;
  var live = readLiveProductSelection(ref);
  var cor = normalizeChoiceText(corOverride != null ? corOverride : live.cor);
  var tam = normalizeChoiceText(tamOverride != null ? tamOverride : live.tam);
  var qtyInput = document.getElementById("qty_"+ref);
  var qty = normalizeQtyValue(ref, qtyOverride != null ? qtyOverride : live.qty);
  if(qtyInput) qtyInput.value = qty;
  var ex = null;
  var key = [ref, cor, tam].join("|");
  for(var i=0;i<cart.length;i++){ if(cart[i].key===key || (cart[i].ref===ref&&cart[i].cor===cor&&cart[i].tam===tam)){ex=cart[i];break;} }
  if(ex) ex.qty+=qty;
  else cart.push({key:key,ref:ref,name:p.name,type:p.type,cor:cor,tam:tam,qty:qty,price:p.price,img:IMGS[ref]||null});
  var ab = document.getElementById("abtn_"+ref);
  ab.textContent="OK"; ab.classList.add("ok");
  setTimeout(function(){ ab.textContent="Adicionar"; ab.classList.remove("ok"); },900);
  updateBadge(ref);
  renderCart();
  clearOrderRequestId();
  scheduleCartSync();
}
function removeFromCart(i){
  var ref = cart[i].ref;
  cart.splice(i,1);
  updateBadge(ref);
  renderCart();
  clearOrderRequestId();
  scheduleCartSync();
}
function updateBadge(ref){
  var tot=0; cart.forEach(function(c){if(c.ref===ref)tot+=c.qty;});
  var bdg=document.getElementById("bdg_"+ref);
  var card=document.querySelector(".card[data-ref='"+ref+"']");
  if(tot>0){bdg.textContent=tot+" un.";bdg.style.display="block";card.classList.add("active");}
  else{bdg.style.display="none";card.classList.remove("active");}
}
function renderCart(){
  var cnt=0,tot=0; cart.forEach(function(c){cnt+=c.qty;tot+=c.price*c.qty;});
  var missing = Math.max(0, MIN_ORDER_TOTAL - tot);
  document.getElementById("cart-n").textContent=cnt;
  var clearBtn = document.getElementById("cart-clear");
  if(clearBtn) clearBtn.disabled = cart.length === 0;
  var summaryEl = document.getElementById("cart-summary");
  if(summaryEl) summaryEl.textContent = cnt + " item" + (cnt===1 ? "" : "s") + " no carrinho";
  document.getElementById("tamt").textContent=tot.toFixed(2).replace(".",",")+"€";
  var minEl = document.getElementById("tmin");
  if(minEl){
    if(cart.length===0){
      minEl.className = "tmin";
      minEl.innerHTML = "Encomenda mínima: <b>" + MIN_ORDER_TOTAL.toFixed(2).replace(".",",") + " &euro;</b>";
    } else if(missing > 0){
      minEl.className = "tmin err";
      minEl.innerHTML = "Faltam <b>" + missing.toFixed(2).replace(".",",") + " &euro;</b> para atingir a encomenda mínima de <b>" + MIN_ORDER_TOTAL.toFixed(2).replace(".",",") + " &euro;</b>.";
    } else {
      minEl.className = "tmin ok";
      minEl.innerHTML = "Valor mínimo atingido. Já podes finalizar a encomenda.";
    }
  }
  document.getElementById("pbtn").disabled=cart.length===0 || tot < MIN_ORDER_TOTAL;
  var el=document.getElementById("citems");
  if(!cart.length){el.innerHTML="<div class='cempty'><div class='cempty-ico'>&#129510;</div><p>Sem itens</p></div>"; saveCartBackup(); return;}
  var html="";
  cart.forEach(function(c,i){
    html+="<div class='ci'>";
    html+=c.img?"<img class='ci-th' src='"+c.img+"' alt=''>":"<div class='ci-th-empty'></div>";
    html+="<div class='ci-inf'><div class='ci-ref'>Ref. "+c.ref+"</div><div class='ci-nm'>"+c.name+"</div><div class='ci-sub'>"+c.cor+" &middot; "+c.tam+"</div></div>";
    html+="<div class='ci-rt'>";
    html+="<div class='ci-qty-ctrl'>";
    html+="<button class='ci-qbtn' data-qm='"+i+"'>&#8722;</button>";
    html+="<span class='ci-qval'>"+c.qty+"</span>";
    html+="<button class='ci-qbtn' data-qp='"+i+"'>+</button>";
    html+="</div>";
    html+="<div class='ci-tot'>"+(c.qty*c.price).toFixed(2).replace(".",",")+"€</div>";
    html+="<div style='font-size:11px;color:var(--muted)'>"+c.price.toFixed(2).replace(".",",")+"€/un</div>";
    html+="</div>";
    html+="<button class='ci-rm' data-idx='"+i+"'>&#10005;</button>";
    html+="</div>";
  });
  el.innerHTML=html;
  syncCartPanelBadgeOnly();
  saveCartBackup();
}

function clearCartEverywhere(){
  if(!cart.length) return Promise.resolve(false);
  cart = [];
  cartRevision += 1;
  clearOrderRequestId();
  renderCart();
  return clearCartOnServer().then(function(ok){
    if(ok) clearCartBackup();
    return ok;
  });
}

document.getElementById("citems").addEventListener("click",function(e){
  var btn=e.target.closest(".ci-rm");
  if(btn){ removeFromCart(parseInt(btn.dataset.idx)); return; }
  var qp=e.target.closest("[data-qp]");
  if(qp){ 
    var i=parseInt(qp.dataset.qp);
    var step = stepFor(cart[i].ref);
    cart[i].qty += step; updateBadge(cart[i].ref); renderCart(); clearOrderRequestId(); scheduleCartSync(); return;
  }
  var qm=e.target.closest("[data-qm]");
  if(qm){
    var i=parseInt(qm.dataset.qm);
    var step = stepFor(cart[i].ref);
    var min  = minFor(cart[i].ref);
    cart[i].qty = Math.max(min, cart[i].qty - step);
    updateBadge(cart[i].ref); renderCart(); clearOrderRequestId(); scheduleCartSync(); return;
  }
});
var cartClearBtn = document.getElementById("cart-clear");
if(cartClearBtn){
  cartClearBtn.addEventListener("click", function(){
    clearCartEverywhere();
  });
}

// â”€â”€ TABS / PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchCat(cat){
  activeCat=cat;
  document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("on",t.dataset.cat===cat);});
  document.querySelectorAll(".sec").forEach(function(s){s.classList.toggle("on",s.id==="sec_"+cat);});
  refreshCatalogVisibility();
}
function openCartPanel(){
  closeAdmin();
  closeNotifications();
  renderCart();
  document.getElementById("panel").classList.add("on");
  document.getElementById("ov").classList.add("on");
}
function closeCartPanel(){
  document.getElementById("panel").classList.remove("on");
  if(!document.getElementById("apanel").classList.contains("on") && !document.getElementById("notif-panel").classList.contains("on")){
    document.getElementById("ov").classList.remove("on");
  }
}
function toggleCartPanel(){
  if(document.getElementById("panel").classList.contains("on")) closeCartPanel();
  else openCartPanel();
}
document.getElementById("cart-btn").addEventListener("click",function(e){ e.preventDefault(); toggleCartPanel(); });
document.getElementById("ph-x").addEventListener("click",function(e){ e.preventDefault(); closeCartPanel(); });
document.getElementById("product-view-close").addEventListener("click", closeProductViewer);
document.getElementById("product-view-bg").addEventListener("click", function(e){
  if(e.target === this) closeProductViewer();
});
document.getElementById("product-view-add").addEventListener("click", function(){
  var ref = this.dataset.ref;
  if(!ref) return;
  addToCart(ref, this.dataset.cor, this.dataset.tam, this.dataset.qty);
  closeProductViewer();
  openCartPanel();
});
document.getElementById("product-view-edit").addEventListener("click", function(){
  var ref = this.dataset.ref;
  if(!ref || !loggedClient || !loggedClient.admin) return;
  closeProductViewer();
  openProductEdit(ref);
});
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeProductViewer();
});
document.getElementById("ov").addEventListener("click",function(e){
  if(e.target !== this) return;
  closeCartPanel();
  closeAdmin();
  closeNotifications();
});

window.addEventListener("pagehide", function(){
  if(loggedClient && authToken){
    flushCartSync();
  }
});

// â”€â”€ SEARCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var srchEl=document.getElementById("srch");
var srchX=document.getElementById("srch-x");
var srchInfo=document.getElementById("srch-info");

function normalizeSearchValue(value){
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchValue(value){
  return normalizeSearchValue(value).replace(/[^a-z0-9]+/g, "");
}

srchEl.addEventListener("input",function(){ doSearch(srchEl.value); });
srchEl.addEventListener("focus", function(){ setMobileCompact(false); });
srchX.addEventListener("click",clearSearch);

function removeSearchResultsSection(){
  var searchSec = document.getElementById("sec_search_results");
  if(searchSec) searchSec.remove();
}

function buildSearchMatches(qNorm, qCompact, terms){
  return Object.keys(PRODS).map(function(ref){ return PRODS[ref]; }).filter(function(p){
    if(!p) return false;
    if(p.active === false) return false;
    var refCompact = compactSearchValue(p.ref);
    var hay = normalizeSearchValue([p.ref,p.name,p.type,p.cat].concat(p.cores || []).concat(p.tams || []).join(" "));
    if(qCompact && refCompact.indexOf(qCompact) >= 0) return true;
    return terms.every(function(t){ return hay.indexOf(t) >= 0; });
  });
}

function renderSearchResults(matches){
  removeSearchResultsSection();
  var sec = document.createElement("section");
  sec.className = "sec on";
  sec.id = "sec_search_results";
  var title = document.createElement("div");
  title.className = "sec-title";
  title.innerHTML = "Resultados da pesquisa <small>" + matches.length + " referencia" + (matches.length !== 1 ? "s" : "") + "</small>";
  sec.appendChild(title);
  var grid = document.createElement("div");
  grid.className = "grid";
  matches.forEach(function(p){ grid.appendChild(mkCard(p)); });
  sec.appendChild(grid);
  mainEl.insertBefore(sec, noresEl);
}

function refreshCatalogVisibility(){
  var q = (srchEl.value || "").trim();
  var qNorm = normalizeSearchValue(q);
  var qCompact = compactSearchValue(q);
  var terms = qNorm ? qNorm.split(/\s+/).filter(function(t){ return t.length > 0; }) : [];
  var searching = terms.length > 0;
  var total = 0;

  srchX.style.display = q ? "block" : "none";
  srchInfo.textContent = "";
  noresEl.style.display = "none";
  document.getElementById("tabs").style.display = searching ? "none" : "";

  if(searching){
    var matches = buildSearchMatches(qNorm, qCompact, terms);
    total = matches.length;
    document.querySelectorAll(".sec").forEach(function(s){ s.classList.remove("on"); });
    if(total > 0){
      renderSearchResults(matches);
      srchInfo.innerHTML = "<b>"+total+"</b> produto"+(total!==1?"s":"")+" encontrado"+(total!==1?"s":"");
    } else {
      removeSearchResultsSection();
      noresEl.style.display = "block";
    }
    return;
  }

  removeSearchResultsSection();
  document.querySelectorAll(".sec").forEach(function(s){
    s.classList.toggle("on", s.id==="sec_"+activeCat);
  });

  document.querySelectorAll(".sec").forEach(function(sec){
    sec.querySelectorAll(".card").forEach(function(card){
      card.style.display = "";
    });
    var title = sec.querySelector(".sec-title");
    if(title) title.style.display = "";
  });
}

function doSearch(q){
  srchEl.value = q;
  refreshCatalogVisibility();
  updateStickyOffsets();
}

function clearSearch(){
  srchEl.value="";
  refreshCatalogVisibility();
}

var confirmResolve = null;
function askConfirm(opts){
  opts = opts || {};
  var bg = document.getElementById("confirm-bg");
  var title = document.getElementById("confirm-title");
  var text = document.getElementById("confirm-text");
  var accept = document.getElementById("confirm-accept");
  var cancel = document.getElementById("confirm-cancel");
  if(!bg || !title || !text || !accept || !cancel){
    return Promise.resolve(window.confirm(opts.message || "Confirmar?"));
  }
  title.textContent = opts.title || "Confirmar";
  text.textContent = opts.message || "Tens a certeza que queres continuar?";
  accept.textContent = opts.confirmLabel || "Confirmar";
  cancel.textContent = opts.cancelLabel || "Cancelar";
  accept.className = "confirm-accept" + (opts.danger ? " danger" : "");
  bg.classList.add("on");
  return new Promise(function(resolve){
    confirmResolve = function(result){
      bg.classList.remove("on");
      confirmResolve = null;
      resolve(result);
    };
  });
}

// â”€â”€ PRINT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ FINALIZE / OUTPUT MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("pbtn").addEventListener("click", function(){
  if(!cart.length) return;
  var total = cart.reduce(function(s,c){ return s+c.price*c.qty; },0);
  if(total < MIN_ORDER_TOTAL) return;
  document.getElementById("modal-bg").classList.add("on");
});
document.getElementById("mo-cancel").addEventListener("click", function(){
  document.getElementById("modal-bg").classList.remove("on");
});
document.getElementById("modal-bg").addEventListener("click", function(e){
  if(e.target === this) this.classList.remove("on");
});
document.getElementById("confirm-cancel").addEventListener("click", function(){
  if(confirmResolve) confirmResolve(false);
});
document.getElementById("confirm-accept").addEventListener("click", function(){
  if(confirmResolve) confirmResolve(true);
});
document.getElementById("confirm-bg").addEventListener("click", function(e){
  if(e.target === this && confirmResolve) confirmResolve(false);
});


// URL do servidor â€” usa caminho relativo para funcionar com http e https
var BASE_URL = API_BASE_URL;
var SERVER_URL = BASE_URL + "/encomenda";
var sessionExpiryHandled = false;

function clearStoredSession(){
  try{
    sessionStorage.removeItem("villas_token");
    sessionStorage.removeItem("villas_client");
    localStorage.removeItem("villas_token");
    localStorage.removeItem("villas_client");
    localStorage.removeItem("villas_session_expires");
  }catch(e){}
}

function setLoginScreenActive(active){
  document.body.classList.toggle("login-active", !!active);
  document.documentElement.classList.toggle("login-active", !!active);
}

function isSessionExpiredMessage(message){
  return /sess[aã]o inv[aá]lida/i.test(String(message || ""));
}

function handleSessionExpired(message){
  if(sessionExpiryHandled) return;
  sessionExpiryHandled = true;
  loggedClient = null;
  authToken = null;
  USER_ORDERS = [];
  ADMIN_ORDERS = [];
  CLIENTS = [];
  ADMIN_NOTIFICATIONS = [];
  DEV_SUMMARY = null;
  DEV_STATUS_DATA = null;
  DEV_NOTES = [];
  DEV_ALL_LOGINS = [];
  DEV_LOGIN_LOGS = [];
  DEV_RECENT_ORDERS = [];
  areaTab = "minhas-encomendas";
  selectedOrderId = null;
  areaSearch = "";
  filterClientId = null;
  cart = [];
  cartRevision = 0;
  clearOrderRequestId();
  if(typeof clearCartBackup === "function") clearCartBackup();
  if(typeof renderCart === "function") renderCart();
  clearStoredSession();
  closeCartPanel();
  closeAdmin();
  closeNotifications();
  closeAdminSettings();
  document.getElementById("modal-bg").classList.remove("on");
  document.getElementById("pedit-bg").classList.remove("on");
  document.body.classList.remove("admin-mode");
  setDeveloperMode(false);
  document.getElementById("admin-settings-btn").classList.remove("on");
  document.getElementById("new-prod-btn").classList.remove("on");
  document.getElementById("admin-btn").classList.remove("on");
  document.getElementById("logout-btn").classList.remove("on");
  updateNotificationButton();
  updateUserGreeting();
  document.getElementById("login-screen").style.display = "flex";
  setLoginScreenActive(true);
  var err = document.getElementById("login-err");
  err.textContent = message || "A sessão expirou. Volta a iniciar sessão.";
  err.classList.add("on");
  document.getElementById("l-pass").value = "";
  setTimeout(function(){
    sessionExpiryHandled = false;
    document.getElementById("l-user").focus();
  }, 0);
}

var nativeFetch = window.fetch.bind(window);
window.fetch = function(input, init){
  return nativeFetch(input, init).then(function(res){
    return res.clone().json().catch(function(){ return {}; }).then(function(data){
      var message = data && data.message ? data.message : "";
      if(res.status === 401 || isSessionExpiredMessage(message)){
        handleSessionExpired(message || "A sessão expirou. Volta a iniciar sessão.");
      }
      return res;
    });
  });
};

document.getElementById("mo-send").addEventListener("click", function(){
  var m = getOrderMeta();
  if(!m.name){ 
    document.getElementById("send-status").textContent = "Por favor preenche o teu nome antes de enviar.";
    document.getElementById("send-status").className = "send-status err";
    return;
  }
  var btn = this;
  btn.disabled = true;
  btn.querySelector(".mlbl").textContent = "A enviar...";
  document.getElementById("send-status").textContent = "";
  document.getElementById("send-status").className = "send-status";

  waitForCartSync().then(function(){
    var payload = {
      clientId: loggedClient ? (loggedClient.id || 0) : 0,
      client:  m.name,
      nif:     m.nif || "",
      request_id: getOrderRequestId(),
      cart_revision: cartRevision,
      notes:   m.notes || "",
      items:   cartSelectionPayload()
    };

    fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Token": authToken||"" },
      body: JSON.stringify(payload)
    })
    .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
    .then(function(res){
      var st = document.getElementById("send-status");
      if(res.ok){
        if(res.data && res.data.emailStatus === "failed"){
          st.textContent = "\u26A0 Encomenda criada, mas o email falhou. O pedido ficou guardado.";
          st.className = "send-status err";
        } else {
          st.textContent = "\u2705 Encomenda enviada com sucesso!";
          st.className = "send-status ok";
        }
        cart = [];
        cartRevision = Number(res.data && res.data.cartRevision != null ? res.data.cartRevision : (cartRevision + 1));
        renderCart();
        clearOrderRequestId();
        saveToHistory();
        btn.querySelector(".mlbl").textContent = "Enviado!";
        setTimeout(function(){ document.getElementById("modal-bg").classList.remove("on"); }, 2000);
      } else {
        st.textContent = "\u274C Erro ao enviar. Tenta outra op\u00E7\u00E3o.";
        st.className = "send-status err";
        btn.querySelector(".mlbl").textContent = "Enviar Encomenda";
        btn.disabled = false;
      }
    })
    .catch(function(){
      var st = document.getElementById("send-status");
      st.textContent = "\u274C Sem liga\u00E7\u00E3o. Tenta outra op\u00E7\u00E3o.";
      st.className = "send-status err";
      btn.querySelector(".mlbl").textContent = "Enviar Encomenda";
      btn.disabled = false;
    });
  });
});

document.getElementById("mo-print").addEventListener("click", function(){
  document.getElementById("modal-bg").classList.remove("on");
  saveToHistory();
  doPrint();
});
document.getElementById("mo-email").addEventListener("click", function(){
  document.getElementById("modal-bg").classList.remove("on");
  saveToHistory();
  doEmail();
});
document.getElementById("mo-csv").addEventListener("click", function(){
  document.getElementById("modal-bg").classList.remove("on");
  saveToHistory();
  doCSV();
});
document.getElementById("mo-wa").addEventListener("click", function(){
  document.getElementById("modal-bg").classList.remove("on");
  saveToHistory();
  doWhatsApp();
});

// â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getOrderMeta(){
  return {
    name:  document.getElementById("cname").value  || "",
    nif:   document.getElementById("cnif").value   || "",
    notes: document.getElementById("cnotes").value || "",
    date:  new Date().toLocaleDateString("pt-PT"),
    time:  new Date().toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}),
    total: cart.reduce(function(s,c){ return s+c.price*c.qty; },0),
    units: cart.reduce(function(s,c){ return s+c.qty; },0),
    lines: cart.length
  };
}

function buildTableRows(forPrint){
  return cart.map(function(c,i){
    var bg = i%2===0 ? "#fff" : "#f9f7f4";
    var td = "padding:7px 10px;border-bottom:1px solid #e2ddd5;font-size:12px;";
    return "<tr style='background:"+bg+"'>"
      +"<td style='"+td+"'><b>Ref. "+c.ref+"</b></td>"
      +"<td style='"+td+";text-align:center'>"+c.name+"</td>"
      +"<td style='"+td+";color:#7a7369;text-align:center'>"+c.type+"</td>"
      +"<td style='"+td+";text-align:center'>"+c.cor+"</td>"
      +"<td style='"+td+";text-align:center'>"+c.tam+"</td>"
      +"<td style='"+td+";text-align:center'>"+c.qty+"</td>"
      +"<td style='"+td+";text-align:right'>"+c.price.toFixed(2).replace(".",",")+"\u20AC</td>"
      +"<td style='"+td+";text-align:right;font-weight:700'>"+(c.price*c.qty).toFixed(2).replace(".",",")+"\u20AC</td>"
      +"</tr>";
  }).join("");
}

function buildPrintHTML(m){
  var rows = buildTableRows(true);
  var notesHtml = m.notes ? "<div style='background:#fffdf0;border:1px solid #e8d08a;border-radius:4px;padding:10px 14px;margin-bottom:18px;font-size:12px'><strong style='font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;display:block;margin-bottom:4px'>Notas</strong>"+m.notes+"</div>" : "";
  return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Encomenda Villas</title>"
    +"<style>"
    +"*{box-sizing:border-box;margin:0;padding:0}"
    +"@page{size:A4;margin:16mm 10mm 16mm 10mm}"
    +"body{font-family:Arial,sans-serif;color:#0f0f0f;padding:0;margin:0;background:#fff}"
    +"table{width:100%;border-collapse:collapse;margin-bottom:16px}"
    +"thead{display:table-header-group}"
    +"tr{page-break-inside:avoid}"
    +".doc-shell{padding:18mm 0 14mm}"
    +".doc-head,.doc-foot{display:none}"
    +".doc-head{position:fixed;top:0;left:0;right:0;height:12mm;padding:4mm 0 2mm;border-bottom:1px solid #e9e1d4;font-size:9px;color:#8a8175;text-transform:uppercase;letter-spacing:1.2px}"
    +".doc-foot{position:fixed;bottom:0;left:0;right:0;height:12mm;padding:2mm 0 4mm;border-top:1px solid #e9e1d4;font-size:9px;color:#8a8175}"
    +".doc-foot .page-num:before{content:counter(page)}"
    +".doc-foot .page-total:before{content:counter(pages)}"
    +".prtbtn{display:block;margin:0 auto;background:#c9a84c;color:#0f0f0f;border:none;padding:12px 40px;font-size:14px;font-weight:700;border-radius:4px;cursor:pointer}"
    +"@media print{.prtbtn{display:none}.doc-head,.doc-foot{display:block}}"
    +"</style></head><body>"
    +"<div class='doc-head'><div style='display:flex;justify-content:space-between;align-items:center'><span>Villas&reg; Nota de Encomenda</span><span>"+m.date+" "+m.time+"</span></div></div>"
    +"<div class='doc-foot'><div style='display:flex;justify-content:space-between;align-items:center'><span>VÍTOR GOUVEIA &middot; +351 968 350 394 &middot; Vitormbgouveia@gmail.com</span><span>Página <span class='page-num'></span> / <span class='page-total'></span></span></div></div>"
    +"<div class='doc-shell'>"
    +"<h1 style='font-family:Georgia,serif;font-size:28px;border-bottom:2px solid #c9a84c;padding-bottom:8px;margin-bottom:4px'>Villas&reg;</h1>"
    +"<p style='font-size:10px;color:#888;text-transform:uppercase;letter-spacing:3px;margin-bottom:20px'>Outono/Inverno 2025&middot;2026 &mdash; Nota de Encomenda</p>"
    +"<div style='display:flex;flex-wrap:wrap;gap:28px;background:#f7f4ef;padding:12px 16px;border-radius:4px;margin-bottom:18px'>"
    +"<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Cliente</strong>"+(m.name||"&mdash;")+"</div>"
    +"<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>NIF</strong>"+(m.nif||"&mdash;")+"</div>"
    +"<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Data</strong>"+m.date+" "+m.time+"</div>"
    +"<div style='font-size:13px'><strong style='font-size:10px;display:block;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px'>Unidades</strong>"+m.units+"</div>"
    +"</div>"
    +notesHtml
    +"<table><thead><tr style='background:#f7f4ef;border-top:1px solid #e2ddd5;border-bottom:1px solid #e2ddd5'>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Ref.</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Descrição</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Tipo</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Cor</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Tam.</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Qtd.</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px'>P.Unit.</th>"
    +"<th style='color:#6c6458;padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px'>Total</th>"
    +"</tr></thead><tbody>"+rows+"</tbody></table>"
    +"<div style='text-align:right;padding:12px 0;border-top:2px solid #c9a84c;margin-bottom:20px'>"
    +"<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px'>Total (preço de custo)</div>"
    +"<div style='font-size:22px;font-weight:700'>"+m.total.toFixed(2).replace(".",",")+" &euro;</div>"
    +"<div style='font-size:11px;color:#888;margin-top:2px'>"+m.units+" unidades &middot; "+m.lines+" linhas</div>"
    +"</div>"
    +"<div style='font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px;margin-bottom:20px'>VÍTOR GOUVEIA &middot; +351 968 350 394 &middot; Vitormbgouveia@gmail.com</div>"
    +"</div>"
    +"<button class='prtbtn' onclick='window.print()'>\uD83D\uDDA8 IMPRIMIR</button>"
    +"</body></html>";
}

// â”€â”€ PRINT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doPrint(){
  var m = getOrderMeta();
  var win = window.open("","_blank","width=960,height=700,scrollbars=yes");
  if(!win){ alert("Permite popups para imprimir."); return; }
  win.document.write(buildPrintHTML(m));
  win.document.close();
}

// â”€â”€ EMAIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doEmail(){
  var m = getOrderMeta();
  var subject = encodeURIComponent("Encomenda Villas - "+(m.name||"Cliente")+" - "+m.date);
  var lines = cart.map(function(c){
    return "Ref."+c.ref+" | "+c.name+" | "+c.cor+" | "+c.tam+" | "+c.qty+"x | "+(c.price*c.qty).toFixed(2).replace(".",",")+"EUR";
  }).join("\n");
  var body = encodeURIComponent(
    "Boa tarde,\n\nSegue nota de encomenda:\n\n"
    +"Cliente: "+(m.name||"")+(m.nif?" ("+m.nif+")":"")+"\n"
    +"Data: "+m.date+" "+m.time+"\n\n"
    +lines+"\n\n"
    +"Total: "+m.total.toFixed(2).replace(".",",")+"EUR ("+m.units+" unidades)"
    +(m.notes?"\n\nNotas: "+m.notes:"")
    +"\n\nCom os melhores cumprimentos,\nVítor Gouveia\n+351 968 350 394"
  );
  window.location.href = "mailto:?subject="+subject+"&body="+body;
}

// â”€â”€ CSV / EXCEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doCSV(){
  var m = getOrderMeta();
  var bom = "\uFEFF"; // UTF-8 BOM for Excel
  var header = "Ref.;Descrição;Tipo;Cor;Tamanho;Quantidade;P. Unitário;Total\n";
  var rows = cart.map(function(c){
    return [c.ref, c.name, c.type, c.cor, c.tam, c.qty,
            c.price.toFixed(2).replace(".",","),
            (c.price*c.qty).toFixed(2).replace(".",",")].join(";");
  }).join("\n");
  var footer = "\n\nCliente;"+m.name+"\nNIF;"+m.nif+"\nData;"+m.date+" "+m.time
    +"\nTotal;"+m.total.toFixed(2).replace(".",",")+"\nUnidades;"+m.units
    +(m.notes?"\nNotas;"+m.notes.replace(/\n/g," "):"");
  var blob = new Blob([bom+header+rows+footer], {type:"text/csv;charset=utf-8"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "encomenda_villas_"+(m.name||"cliente").replace(/\s+/g,"_")+"_"+m.date.replace(/\//g,"-")+".csv";
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€ WHATSAPP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function doWhatsApp(){
  var m = getOrderMeta();
  var lines = cart.map(function(c){
    return "• Ref."+c.ref+" "+c.name+" | "+c.cor+" | "+c.tam+" | "+c.qty+"x = "+(c.price*c.qty).toFixed(2).replace(".",",")+"€";
  }).join("\n");
  var msg = "*Encomenda Villas*\n"
    +(m.name?"*Cliente:* "+m.name+"\n":"")
    +(m.nif?"*NIF:* "+m.nif+"\n":"")
    +"*Data:* "+m.date+" "+m.time+"\n\n"
    +lines+"\n\n"
    +"*Total: "+m.total.toFixed(2).replace(".",",")+"€* ("+m.units+" unidades)"
    +(m.notes?"\n\n_Notas: "+m.notes+"_":"");
  window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");
}

// â”€â”€ LOCAL SAVE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var HIST_KEY = "villas_hist";

function saveToHistory(){
  var m = getOrderMeta();
  if(!m.name && !cart.length) return;
  var hist = loadHistory();
  hist.unshift({
    id: Date.now(),
    client: m.name,
    nif: m.nif,
    date: m.date,
    time: m.time,
    total: m.total,
    units: m.units,
    lines: m.lines,
    notes: m.notes,
    items: cart.map(function(c){ return {ref:c.ref,name:c.name,type:c.type,cor:c.cor,tam:c.tam,qty:c.qty,price:c.price}; })
  });
  // keep max 50 orders
  if(hist.length > 50) hist = hist.slice(0,50);
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch(e){}
}

function loadHistory(){
  try{
    var raw = localStorage.getItem(HIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}

