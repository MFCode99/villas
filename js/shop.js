if(typeof window.showInactiveProducts === "undefined"){
  window.showInactiveProducts = localStorage.getItem("villas_show_inactive_products") !== "0";
}
if(typeof window.loggedClient === "undefined") window.loggedClient = null;
if(typeof window.authToken === "undefined") window.authToken = null;
var CART_STORAGE_KEY = "villas_cart";
var CART_SERVER_URL = "/me/cart";
var cartSyncTimer = null;
var cartSyncInFlight = false;
var cartSyncQueued = false;
var cartUiBound = false;
var cartDelegatedBound = false;

// â”€â”€ BUILD CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mkCard(p){
  var card = document.createElement("div");
  card.className = "card";
  card.id = "card-" + p.ref;
  card.dataset.ref = p.ref;
  card.dataset.season = p.season || "ambos";
  card.dataset.selectedCor = "";
  card.dataset.selectedTam = "";
  card.dataset.selectedQty = "";
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
  p.cores.forEach(function(c){ var o=document.createElement("option"); o.value = normalizeChoiceText(c); o.textContent=c; corSel.appendChild(o); });
  if(p.cores.length) corSel.value = normalizeChoiceText(p.cores[0]);

  // tam select/hidden
  var tamEl;
  if(p.tams.length > 1){
    tamEl = document.createElement("select");
    tamEl.id = "tam_" + p.ref;
    tamEl.style.maxWidth = "110px";
    p.tams.forEach(function(t){ var o=document.createElement("option"); o.value = normalizeChoiceText(t); o.textContent=t; tamEl.appendChild(o); });
    if(p.tams.length) tamEl.value = normalizeChoiceText(p.tams[0]);
  } else {
    tamEl = document.createElement("input");
    tamEl.type = "hidden";
    tamEl.id = "tam_" + p.ref;
    tamEl.value = normalizeChoiceText(p.tams[0]);
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
  var qm = document.createElement("button"); qm.type="button"; qm.className="qbtn"; qm.dataset.action="minus"; qm.dataset.ref=p.ref; qm.innerHTML="&#8722;";
  var qi = document.createElement("input"); qi.type="number"; qi.className="qinp"; qi.id="qty_"+p.ref;
  var qStep = inferQtyStep(p);
  qi.value=qStep; qi.min=qStep; qi.step=qStep; qi.max="9999";
  card.dataset.selectedCor = normalizeChoiceText(corSel.value || (p.cores[0] || ""));
  card.dataset.selectedTam = normalizeChoiceText(p.tams.length ? p.tams[0] : "");
  card.dataset.selectedQty = String(qStep);
  var qp = document.createElement("button"); qp.type="button"; qp.className="qbtn"; qp.dataset.action="plus"; qp.dataset.ref=p.ref; qp.textContent="+";
  var ab = document.createElement("button"); ab.type="button"; ab.className="abtn"; ab.id="abtn_"+p.ref; ab.dataset.action="add"; ab.dataset.ref=p.ref; ab.textContent="Adicionar";
  qm.onclick = function(e){ e.preventDefault(); e.stopPropagation(); changeCardQty(card, -1); };
  qp.onclick = function(e){ e.preventDefault(); e.stopPropagation(); changeCardQty(card, 1); };
  ab.onclick = function(e){
    e.preventDefault();
    e.stopPropagation();
    var card = this.closest(".card");
    var live = readCardProductSelection(card);
    addToCart(card ? card.dataset.ref : p.ref, live.cor, live.tam, live.qty);
  };
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
  if(action==="minus" || action==="plus"){
    var card = el.closest(".card");
    if(card) changeCardQty(card, action==="minus" ? -1 : 1);
    else changeQty(ref, action==="minus" ? -1 : 1);
  }
  else if(action==="add"){
    var live = readLiveProductSelection(ref);
    addToCart(ref, live.cor, live.tam, live.qty);
  }
});
document.getElementById("main").addEventListener("change", function(e){
  var input = e.target;
  if(!input || !input.id) return;
  if(input.id.indexOf("qty_") === 0){
    var ref = input.id.replace("qty_","");
    input.value = normalizeQtyValue(ref, input.value);
    syncCardSelection(ref);
    return;
  }
  if(input.id.indexOf("cor_") === 0 || input.id.indexOf("tam_") === 0){
    var ref2 = input.id.replace(/^cor_|^tam_/,"");
    syncCardSelection(ref2);
  }
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
function normalizeChoiceText(value){
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}
function getCartSnapshot(){
  return cart.map(function(item){
    return {
      key: item.key,
      ref: item.ref,
      name: item.name,
      type: item.type,
      cor: item.cor,
      tam: item.tam,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      img: item.img || null
    };
  }).filter(function(item){ return !!item.ref; });
}
function normalizeCartItems(items){
  return (Array.isArray(items) ? items : []).map(function(item){
    var ref = String(item && item.ref != null ? item.ref : "").trim();
    if(!ref) return null;
    var prod = PRODS[ref] || {};
    var cor = normalizeChoiceText(item.cor);
    var tam = normalizeChoiceText(item.tam);
    var qty = normalizeQtyValue(ref, item.qty);
    return {
      key: item.key || cartItemKey(ref, cor, tam),
      ref: ref,
      name: item.name || prod.name || "",
      type: item.type || prod.type || "",
      cor: cor,
      tam: tam,
      qty: qty,
      price: Number(item.price != null ? item.price : (prod.price || 0)),
      img: item.img || IMGS[ref] || null
    };
  }).filter(Boolean);
}
function saveCartStateLocal(){
  try{
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(getCartSnapshot()));
  }catch(e){}
}
function saveCartState(){
  saveCartStateLocal();
  scheduleCartSync();
}
function loadCartState(){
  try{
    var raw = localStorage.getItem(CART_STORAGE_KEY);
    if(!raw) return;
    var data = JSON.parse(raw);
    if(!Array.isArray(data)) return;
    cart = normalizeCartItems(data);
  }catch(e){
    cart = [];
  }
}
function refreshCartBadges(){
  Object.keys(PRODS || {}).forEach(function(ref){
    updateBadge(ref);
  });
}
function applyCartState(nextCart, opts){
  cart = normalizeCartItems(nextCart);
  saveCartStateLocal();
  renderCart();
  refreshCartBadges();
  if(!(opts && opts.silent)) scheduleCartSync();
}
function scheduleCartSync(){
  if(!loggedClient || !authToken) return;
  clearTimeout(cartSyncTimer);
  cartSyncTimer = setTimeout(function(){
    pushCartStateToServer();
  }, 250);
}
function pushCartStateToServer(){
  if(cartSyncInFlight || !loggedClient || !authToken) {
    cartSyncQueued = cartSyncQueued || (!!loggedClient && !!authToken);
    return;
  }
  cartSyncInFlight = true;
  var snapshot = getCartSnapshot();
  window.fetch(CART_SERVER_URL, {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Token": authToken || ""
    },
    body: JSON.stringify({ cart: snapshot })
  })
  .then(function(r){ return r.text().then(function(text){
    var data = {};
    try{ data = text ? JSON.parse(text) : {}; }catch(e){}
    if(!r.ok) throw new Error((data && data.message) || "Falha ao guardar carrinho");
    return data;
  }); })
  .catch(function(){})
  .then(function(){
    cartSyncInFlight = false;
    if(cartSyncQueued){
      cartSyncQueued = false;
      scheduleCartSync();
    }
  });
}
function syncCartFromServer(){
  if(!loggedClient || !authToken) return Promise.resolve(false);
  var localSnapshot = normalizeCartItems(cart);
  return window.fetch(CART_SERVER_URL, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "X-Token": authToken || ""
    }
  })
  .then(function(r){
    return r.text().then(function(text){
      var data = {};
      try{ data = text ? JSON.parse(text) : {}; }catch(e){}
      if(!r.ok || !data.ok) return false;
      if(Array.isArray(data.cart)){
        var serverCart = normalizeCartItems(data.cart);
        if(serverCart.length){
          cart = serverCart;
        } else if(localSnapshot.length){
          return pushCartStateToServer().then(function(){ return true; });
        } else {
          cart = [];
        }
        saveCartStateLocal();
        renderCart();
        refreshCartBadges();
        return true;
      }
      return false;
    });
  })
  .catch(function(){ return false; });
}
function clearCartEverywhere(){
  cart = [];
  clearTimeout(cartSyncTimer);
  cartSyncQueued = false;
  saveCartStateLocal();
  renderCart();
  refreshCartBadges();
  if(!loggedClient || !authToken) return Promise.resolve(true);
  return window.fetch(CART_SERVER_URL, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "X-Token": authToken || ""
    }
  }).then(function(){ return true; }).catch(function(){ return false; });
}
function cartItemKey(ref, cor, tam){
  return [ref, normalizeChoiceText(cor), normalizeChoiceText(tam)].join("|");
}
function getCardByRef(ref){
  return document.querySelector(".card[data-ref='"+ref+"']");
}
function syncCardSelection(ref){
  var card = getCardByRef(ref);
  if(!card) return;
  var corEl = document.getElementById("cor_" + ref);
  var tamEl = document.getElementById("tam_" + ref);
  var qtyEl = document.getElementById("qty_" + ref);
  card.dataset.selectedCor = normalizeChoiceText(corEl ? corEl.value : "");
  card.dataset.selectedTam = normalizeChoiceText(tamEl ? tamEl.value : "");
  card.dataset.selectedQty = qtyEl ? String(normalizeQtyValue(ref, qtyEl.value)) : String(minFor(ref));
}
function readCardSelection(ref){
  var card = getCardByRef(ref);
  if(!card) return { cor:"", tam:"", qty:minFor(ref) };
  var cor = normalizeChoiceText(card.dataset.selectedCor || "");
  var tam = normalizeChoiceText(card.dataset.selectedTam || "");
  var qty = normalizeQtyValue(ref, card.dataset.selectedQty || minFor(ref));
  return { cor:cor, tam:tam, qty:qty };
}
function readLiveProductSelection(ref){
  var card = getCardByRef(ref);
  var corEl = card ? card.querySelector("#cor_" + ref) : document.getElementById("cor_" + ref);
  var tamEl = card ? card.querySelector("#tam_" + ref) : document.getElementById("tam_" + ref);
  var qtyEl = card ? card.querySelector("#qty_" + ref) : document.getElementById("qty_" + ref);
  var cor = normalizeChoiceText(corEl ? corEl.value : (card ? card.dataset.selectedCor : ""));
  var tam = normalizeChoiceText(tamEl ? tamEl.value : (card ? card.dataset.selectedTam : ""));
  var qty = normalizeQtyValue(ref, qtyEl ? qtyEl.value : (card ? card.dataset.selectedQty : minFor(ref)));
  return { cor:cor, tam:tam, qty:qty };
}
function readCardProductSelection(card){
  if(!card) return { cor:"", tam:"", qty:minFor("") };
  var ref = card.dataset.ref || "";
  var corEl = card.querySelector("#cor_" + ref) || card.querySelector("select[id^='cor_']");
  var tamEl = card.querySelector("#tam_" + ref) || card.querySelector("select[id^='tam_'], input[id^='tam_']");
  var qtyEl = card.querySelector("#qty_" + ref) || card.querySelector("input[id^='qty_']");
  return {
    cor: normalizeChoiceText(corEl ? corEl.value : card.dataset.selectedCor || ""),
    tam: normalizeChoiceText(tamEl ? tamEl.value : card.dataset.selectedTam || ""),
    qty: normalizeQtyValue(ref, qtyEl ? qtyEl.value : card.dataset.selectedQty || minFor(ref))
  };
}

function quickAdd(ref){
  var live = readLiveProductSelection(ref);
  addToCart(ref, live.cor, live.tam, live.qty);
}
function getSelectedProductOptions(ref){
  return readLiveProductSelection(ref);
}
function syncProductViewerSelection(p, initial){
  var corSel = document.getElementById("product-view-cor");
  var tamSel = document.getElementById("product-view-tam");
  var qtyEl = document.getElementById("product-view-qty");
  var addBtn = document.getElementById("product-view-add");
  if(!p || !corSel || !tamSel || !qtyEl || !addBtn) return { cor:"", tam:"", qty:minFor(p && p.ref ? p.ref : "") };
  corSel.innerHTML = "";
  (p.cores || []).forEach(function(c){
    var o = document.createElement("option");
    o.value = normalizeChoiceText(c);
    o.textContent = c;
    corSel.appendChild(o);
  });
  if(p.cores && p.cores.length){
    corSel.value = normalizeChoiceText((initial && initial.cor) || p.cores[0]);
    if(!corSel.value) corSel.value = normalizeChoiceText(p.cores[0]);
  }
  tamSel.innerHTML = "";
  (p.tams || []).forEach(function(t){
    var o = document.createElement("option");
    o.value = normalizeChoiceText(t);
    o.textContent = t;
    tamSel.appendChild(o);
  });
  if(p.tams && p.tams.length){
    tamSel.value = normalizeChoiceText((initial && initial.tam) || p.tams[0]);
    if(!tamSel.value) tamSel.value = normalizeChoiceText(p.tams[0]);
  }
  var qty = inferQtyStep(p);
  qtyEl.min = qty;
  qtyEl.step = qty;
  qtyEl.value = initial && initial.qty ? normalizeQtyValue(p.ref, initial.qty) : qty;
  var cor = normalizeChoiceText(corSel.value || "");
  var tam = normalizeChoiceText(tamSel.value || "");
  var selectedQty = normalizeQtyValue(p.ref, qtyEl.value);
  addBtn.dataset.ref = p.ref;
  addBtn.dataset.cor = cor;
  addBtn.dataset.tam = tam;
  addBtn.dataset.qty = String(selectedQty);
  document.getElementById("product-view-choice").textContent = [cor, tam, selectedQty + " un."].filter(Boolean).join(" · ");
  return { cor: cor, tam: tam, qty: selectedQty };
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
  var modalOpts = syncProductViewerSelection(p, opts);
  document.getElementById("product-view-choice").textContent = [modalOpts.cor || opts.cor, modalOpts.tam || opts.tam, (modalOpts.qty || opts.qty) + " un."].filter(Boolean).join(" · ");
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
  var normalized = Math.max(min, next);
  qi.value = normalized;
  syncCardSelection(ref);
}
function changeCardQty(card, d){
  if(!card) return;
  var ref = card.dataset.ref || "";
  var qi = card.querySelector("#qty_" + ref) || card.querySelector("input[id^='qty_']");
  if(!qi) return;
  var step = stepFor(ref);
  var min = minFor(ref);
  var cur = parseInt(qi.value, 10) || min;
  var next = Math.max(min, cur + (d * step));
  qi.value = next;
  card.dataset.selectedQty = String(next);
  var corEl = card.querySelector("#cor_" + ref) || card.querySelector("select[id^='cor_']");
  var tamEl = card.querySelector("#tam_" + ref) || card.querySelector("select[id^='tam_'], input[id^='tam_']");
  card.dataset.selectedCor = normalizeChoiceText(corEl ? corEl.value : card.dataset.selectedCor || "");
  card.dataset.selectedTam = normalizeChoiceText(tamEl ? tamEl.value : card.dataset.selectedTam || "");
}
function addToCart(ref, corOverride, tamOverride, qtyOverride){
  var p = PRODS[ref]; if(!p || p.active === false) return;
  var card = getCardByRef(ref);
  var corEl = document.getElementById("cor_"+ref);
  var tamEl = document.getElementById("tam_"+ref);
  var qtyInput = document.getElementById("qty_"+ref);
  var live = readLiveProductSelection(ref);
  var cor = normalizeChoiceText(corOverride != null ? corOverride : live.cor);
  var tam = normalizeChoiceText(tamOverride != null ? tamOverride : live.tam);
  var qty = normalizeQtyValue(ref, qtyOverride != null ? qtyOverride : live.qty);
  if(qtyInput) qtyInput.value = qty;
  if(corEl) corEl.value = cor;
  if(tamEl) tamEl.value = tam;
  if(card){
    card.dataset.selectedCor = cor;
    card.dataset.selectedTam = tam;
    card.dataset.selectedQty = String(qty);
  }
  var key = cartItemKey(ref, cor, tam);
  var ex = null;
  for(var i=0;i<cart.length;i++){ if(cart[i].key===key || (cart[i].ref===ref&&normalizeChoiceText(cart[i].cor)===cor&&normalizeChoiceText(cart[i].tam)===tam)){ex=cart[i];break;} }
  if(ex) ex.qty+=qty;
  else cart.push({key:key,ref:ref,name:p.name,type:p.type,cor:cor,tam:tam,qty:qty,price:p.price,img:IMGS[ref]||null});
  var ab = document.getElementById("abtn_"+ref);
  if(ab){
    ab.textContent="OK";
    ab.classList.add("ok","flash");
    setTimeout(function(){
      ab.textContent="Adicionar";
      ab.classList.remove("ok","flash");
    },900);
  }
  showCartToast(p, cor, tam, qty);
  updateBadge(ref);
  renderCart();
  saveCartState();
}
function showCartToast(product, cor, tam, qty){
  var toast = document.getElementById("cart-toast");
  if(!toast || !product) return;
  toast.innerHTML = "Adicionado ao carrinho" +
    "<small>" + escH(product.name || ("Ref. " + product.ref)) +
    (cor || tam || qty ? " · " + escH([cor, tam, qty + " un."].filter(Boolean).join(" · ")) : "") +
    "</small>";
  toast.classList.add("on");
  clearTimeout(showCartToast._t);
  showCartToast._t = setTimeout(function(){
    toast.classList.remove("on");
  }, 1600);
}
function removeFromCart(i){
  var ref = cart[i].ref;
  cart.splice(i,1);
  updateBadge(ref);
  renderCart();
  saveCartState();
}
function updateBadge(ref){
  var tot=0; cart.forEach(function(c){if(c.ref===ref)tot+=c.qty;});
  var bdg=document.getElementById("bdg_"+ref);
  var card=document.querySelector(".card[data-ref='"+ref+"']");
  if(!bdg || !card) return;
  if(tot>0){bdg.textContent=tot+" un.";bdg.style.display="block";card.classList.add("active");}
  else{bdg.style.display="none";card.classList.remove("active");}
}
function renderCart(){
  var cnt=0,tot=0; cart.forEach(function(c){cnt+=c.qty;tot+=c.price*c.qty;});
  var missing = Math.max(0, MIN_ORDER_TOTAL - tot);
  document.getElementById("cart-n").textContent=cnt;
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
  document.getElementById("pbtn").disabled=cart.length===0;
  var clearBtn = document.getElementById("cart-clear");
  if(clearBtn) clearBtn.disabled = cart.length===0;
  var el=document.getElementById("citems");
  if(!cart.length){el.innerHTML="<div class='cempty'><div class='cempty-ico'>&#129510;</div><p>Sem itens</p><small>Adiciona produtos para começar a montar a encomenda.</small></div>";return;}
  var html="<section class='cart-summary'>"
    + "<div class='cart-summary-main'>"
      + "<span class='cart-summary-kicker'>Resumo rápido</span>"
      + "<strong>" + cnt + " unidades</strong>"
      + "<small>" + cart.length + " linha" + (cart.length!==1?"s":"") + " · " + formatMoney(tot) + "</small>"
    + "</div>"
    + "<div class='cart-summary-meta'>"
      + "<span><b>" + formatMoney(tot) + "</b><small>Total</small></span>"
      + "<span><b>" + formatMoney(missing) + "</b><small>Falta para mínimo</small></span>"
    + "</div>"
    + "</section>";
  cart.forEach(function(c,i){
    html+="<article class='ci'>";
    html+="<div class='ci-main'>";
    html+=c.img?"<img class='ci-th' src='"+c.img+"' alt=''>":"<div class='ci-th-empty'></div>";
    html+="<div class='ci-inf'><div class='ci-ref'>Ref. "+c.ref+"</div><div class='ci-nm'>"+c.name+"</div><div class='ci-sub'>"+c.cor+" · "+c.tam+"</div><div class='ci-pills'><span>"+c.cor+"</span><span>"+c.tam+"</span></div></div>";
    html+="</div>";
    html+="<div class='ci-rt'>";
    html+="<div class='ci-qty-ctrl'>";
    html+="<button class='ci-qbtn' data-qm='"+i+"' aria-label='Diminuir quantidade'>&#8722;</button>";
    html+="<span class='ci-qval'>"+c.qty+"</span>";
    html+="<button class='ci-qbtn' data-qp='"+i+"' aria-label='Aumentar quantidade'>+</button>";
    html+="</div>";
    html+="<div class='ci-pricing'><div class='ci-tot'>"+formatMoney(c.qty*c.price)+"</div><div class='ci-unit'>"+formatMoney(c.price)+"/un</div></div>";
    html+="</div>";
    html+="<button class='ci-rm' data-idx='"+i+"' aria-label='Remover item'>&#10005;</button>";
    html+="</article>";
  });
  el.innerHTML=html;
}

document.getElementById("citems").addEventListener("click",function(e){
  var btn=e.target.closest(".ci-rm");
  if(btn){ removeFromCart(parseInt(btn.dataset.idx)); return; }
  var qp=e.target.closest("[data-qp]");
  if(qp){ 
    var i=parseInt(qp.dataset.qp);
    var step = stepFor(cart[i].ref);
    cart[i].qty += step; updateBadge(cart[i].ref); renderCart(); saveCartState(); return;
  }
  var qm=e.target.closest("[data-qm]");
  if(qm){
    var i=parseInt(qm.dataset.qm);
    var step = stepFor(cart[i].ref);
    var min  = minFor(cart[i].ref);
    cart[i].qty = Math.max(min, cart[i].qty - step);
    updateBadge(cart[i].ref); renderCart(); saveCartState(); return;
  }
});

loadCartState();
renderCart();
cart.forEach(function(item){
  updateBadge(item.ref);
});

// â”€â”€ TABS / PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchCat(cat){
  activeCat = cat;
  document.querySelectorAll(".tab").forEach(function(t){ t.classList.toggle("on", t.dataset.cat === cat); });
  document.querySelectorAll(".sec").forEach(function(sec){ sec.classList.toggle("on", sec.id === "sec_" + cat); });
  refreshCatalogVisibility();
}

function hideCartNeighbors(){
  try{ if(typeof closeAdmin === "function") closeAdmin(); }catch(e){}
  try{ if(typeof closeAdminSettings === "function") closeAdminSettings(); }catch(e){}
  try{ if(typeof closeNotifications === "function") closeNotifications(); }catch(e){}
  try{ if(typeof closeProductViewer === "function") closeProductViewer(); }catch(e){}
  var modalBg = document.getElementById("modal-bg");
  if(modalBg) modalBg.classList.remove("on");
}

function openCartPanel(){
  hideCartNeighbors();
  var panel = document.getElementById("panel");
  var ov = document.getElementById("ov");
  if(!panel || !ov) return;
  renderCart();
  panel.classList.add("on");
  ov.classList.add("on");
}

function closeCartPanel(){
  var panel = document.getElementById("panel");
  if(panel) panel.classList.remove("on");
  var ov = document.getElementById("ov");
  var apanel = document.getElementById("apanel");
  var notif = document.getElementById("notif-panel");
  if(ov && !(apanel && apanel.classList.contains("on")) && !(notif && notif.classList.contains("on"))){
    ov.classList.remove("on");
  }
}

function toggleCartPanel(forceOpen){
  var panel = document.getElementById("panel");
  if(!panel) return;
  if(typeof forceOpen === "boolean"){
    if(forceOpen) openCartPanel();
    else closeCartPanel();
    return;
  }
  if(panel.classList.contains("on")) closeCartPanel();
  else openCartPanel();
}

window.__villasToggleCartPanel = function(forceOpen){
  toggleCartPanel(forceOpen);
  return false;
};

function bindCartPanelUi(){
  if(cartUiBound) return;
  cartUiBound = true;

  var cartBtn = document.getElementById("cart-btn");
  if(cartBtn){
    cartBtn.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      toggleCartPanel();
    });
    cartBtn.onclick = function(e){
      if(e){
        e.preventDefault();
        e.stopPropagation();
      }
      toggleCartPanel();
      return false;
    };
  }

  var cartClose = document.getElementById("ph-x");
  if(cartClose){
    cartClose.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      closeCartPanel();
    });
  }

  var overlay = document.getElementById("ov");
  if(overlay){
    overlay.addEventListener("click", function(e){
      if(e.target !== this) return;
      closeCartPanel();
      hideCartNeighbors();
    });
  }

  var viewerClose = document.getElementById("product-view-close");
  if(viewerClose){
    viewerClose.addEventListener("click", closeProductViewer);
  }

  var viewerBg = document.getElementById("product-view-bg");
  if(viewerBg){
    viewerBg.addEventListener("click", function(e){
      if(e.target === this) closeProductViewer();
    });
  }

  var viewerAdd = document.getElementById("product-view-add");
  if(viewerAdd){
    viewerAdd.addEventListener("click", function(){
      var ref = this.dataset.ref;
      if(!ref) return;
      addToCart(ref, this.dataset.cor, this.dataset.tam, this.dataset.qty);
      closeProductViewer();
      openCartPanel();
    });
  }

  var viewerCor = document.getElementById("product-view-cor");
  if(viewerCor){
    viewerCor.addEventListener("change", function(){
      var addBtn = document.getElementById("product-view-add");
      if(!addBtn) return;
      var ref = addBtn.dataset.ref;
      if(!ref) return;
      var qtyEl = document.getElementById("product-view-qty");
      var tamEl = document.getElementById("product-view-tam");
      var qty = normalizeQtyValue(ref, qtyEl ? qtyEl.value : minFor(ref));
      if(qtyEl) qtyEl.value = qty;
      addBtn.dataset.cor = normalizeChoiceText(this.value);
      addBtn.dataset.tam = normalizeChoiceText(tamEl ? tamEl.value : "");
      addBtn.dataset.qty = String(qty);
      var choice = document.getElementById("product-view-choice");
      if(choice) choice.textContent = [addBtn.dataset.cor, addBtn.dataset.tam, qty + " un."].filter(Boolean).join(" | ");
    });
  }

  var viewerTam = document.getElementById("product-view-tam");
  if(viewerTam){
    viewerTam.addEventListener("change", function(){
      var addBtn = document.getElementById("product-view-add");
      if(!addBtn) return;
      var ref = addBtn.dataset.ref;
      if(!ref) return;
      var qtyEl = document.getElementById("product-view-qty");
      var corEl = document.getElementById("product-view-cor");
      var qty = normalizeQtyValue(ref, qtyEl ? qtyEl.value : minFor(ref));
      if(qtyEl) qtyEl.value = qty;
      addBtn.dataset.cor = normalizeChoiceText(corEl ? corEl.value : "");
      addBtn.dataset.tam = normalizeChoiceText(this.value);
      addBtn.dataset.qty = String(qty);
      var choice = document.getElementById("product-view-choice");
      if(choice) choice.textContent = [addBtn.dataset.cor, addBtn.dataset.tam, qty + " un."].filter(Boolean).join(" | ");
    });
  }

  var viewerQty = document.getElementById("product-view-qty");
  if(viewerQty){
    viewerQty.addEventListener("change", function(){
      var addBtn = document.getElementById("product-view-add");
      if(!addBtn) return;
      var ref = addBtn.dataset.ref;
      if(!ref) return;
      var corEl = document.getElementById("product-view-cor");
      var tamEl = document.getElementById("product-view-tam");
      var qty = normalizeQtyValue(ref, this.value);
      this.value = qty;
      addBtn.dataset.cor = normalizeChoiceText(corEl ? corEl.value : "");
      addBtn.dataset.tam = normalizeChoiceText(tamEl ? tamEl.value : "");
      addBtn.dataset.qty = String(qty);
      var choice = document.getElementById("product-view-choice");
      if(choice) choice.textContent = [addBtn.dataset.cor, addBtn.dataset.tam, qty + " un."].filter(Boolean).join(" | ");
    });
  }

  var viewerEdit = document.getElementById("product-view-edit");
  if(viewerEdit){
    viewerEdit.addEventListener("click", function(){
      var ref = this.dataset.ref;
      if(!ref || !loggedClient || !loggedClient.admin) return;
      closeProductViewer();
      openProductEdit(ref);
    });
  }

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") closeProductViewer();
  });
}

function bindCartDelegatedUi(){
  if(cartDelegatedBound) return;
  cartDelegatedBound = true;
  document.addEventListener("click", function(e){
    var target = e.target;
    if(!target) return;
    var cartTrigger = target.closest ? target.closest("#cart-btn") : null;
    if(cartTrigger){
      e.preventDefault();
      e.stopPropagation();
      toggleCartPanel();
      return;
    }
    var closeTrigger = target.closest ? target.closest("#ph-x") : null;
    if(closeTrigger){
      e.preventDefault();
      e.stopPropagation();
      closeCartPanel();
    }
  }, true);
}

function initCartUi(){
  bindCartPanelUi();
  bindCartDelegatedUi();
  renderCart();
  cart.forEach(function(item){ updateBadge(item.ref); });
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", initCartUi);
} else {
  initCartUi();
}

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
  var showInactive = window.showInactiveProducts !== false;

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
      var hiddenInactive = card.classList.contains("inactive") && !showInactive;
      card.style.display = hiddenInactive ? "none" : "";
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
  document.getElementById("modal-bg").classList.add("on");
  var total = cart.reduce(function(s,c){ return s+c.price*c.qty; },0);
  var st = document.getElementById("send-status");
  if(st && total < MIN_ORDER_TOTAL){
    st.textContent = "A encomenda mínima ainda não foi atingida.";
    st.className = "send-status err";
  }
});
var cartClearBtn = document.getElementById("cart-clear");
if(cartClearBtn){
  cartClearBtn.addEventListener("click", function(){
    if(!cart.length) return;
    var btn = this;
    btn.disabled = true;
    var doClear = function(){
      clearCartEverywhere().then(function(){
        btn.disabled = cart.length===0;
      });
    };
    if(typeof askConfirm === "function"){
      askConfirm({
        title: "Limpar carrinho",
        message: "Queres remover todos os itens do carrinho?",
        confirmLabel: "Limpar",
        cancelLabel: "Cancelar",
        danger: true
      }).then(function(ok){
        if(ok) doClear();
        else btn.disabled = cart.length===0;
      });
    } else {
      doClear();
    }
  });
}
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
  var total = cart.reduce(function(s,c){ return s+c.price*c.qty; },0);
  if(total < MIN_ORDER_TOTAL){
    document.getElementById("send-status").textContent = "Faltam " + (MIN_ORDER_TOTAL - total).toFixed(2).replace(".",",") + " € para atingir a encomenda mínima.";
    document.getElementById("send-status").className = "send-status err";
    return;
  }
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

  // Build order text for email
  // Compact format to stay within Formspree limits
  var lines = cart.map(function(c){
    return c.ref+"|"+c.cor+"|"+c.tam+"|"+c.qty+"x";
  }).join(", ");

  var payload = {
    clientId: loggedClient ? (loggedClient.id || 0) : 0,
    client:  m.name,
    nif:     m.nif || "",
    date:    m.date,
    time:    m.time,
    total:   m.total,
    units:   m.units,
    lines:   m.lines,
    notes:   m.notes || "",
    items:   cart.map(function(c){
      return { ref:c.ref, name:c.name, type:c.type, cor:c.cor, tam:c.tam, qty:c.qty, price:c.price };
    })
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
      st.textContent = "\u2705 Encomenda enviada com sucesso!";
      st.className = "send-status ok";
      saveToHistory();
      clearCartEverywhere();
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

