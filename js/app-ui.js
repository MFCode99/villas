// Focus user field on load
function ensureCatalogReadyOnStartup(){
  if(typeof reloadCatalogFromServer !== "function") return;
  reloadCatalogFromServer()
    .then(function(){
      if(loggedClient && loggedClient.admin && !loggedClient.developer){
        return reloadCategoriesFromServer().catch(function(){ return false; });
      }
      return false;
    })
    .then(function(){
      if(typeof refreshCatalogUi === "function") refreshCatalogUi();
      else if(typeof renderCatalogShell === "function") renderCatalogShell();
    })
    .catch(function(){});
}

var ADMIN_STATS = null;

setTimeout(function(){
  try{
    var savedToken = sessionStorage.getItem("villas_token") || localStorage.getItem("villas_token");
    var savedUser  = sessionStorage.getItem("villas_client") || localStorage.getItem("villas_client");
    var expiresAt  = parseInt(localStorage.getItem("villas_session_expires")||"0", 10);
    if(savedUser && expiresAt && Date.now() < expiresAt){
      authToken = savedToken || "";
      loggedClient = JSON.parse(savedUser);
      localStorage.setItem("villas_session_expires", String(Date.now() + SESSION_TTL_MS));
      document.getElementById("login-screen").style.display="none";
      setLoginScreenActive(false);
      setDeveloperMode(!!loggedClient.developer);
      if(loggedClient.name) document.getElementById("cname").value = loggedClient.name;
      if(loggedClient.nif) document.getElementById("cnif").value = loggedClient.nif;
      updateAreaButton();
      updateUserGreeting();
      if(loggedClient.admin && !loggedClient.developer){
        document.getElementById("admin-settings-btn").classList.add("on");
        document.getElementById("new-prod-btn").classList.add("on");
        enableAdminProductEdit();
        loadAdminNotifications();
        reloadCatalogFromServer()
          .catch(function(){ return false; })
          .then(function(){
            return reloadCategoriesFromServer().catch(function(){ return false; });
          })
          .then(function(updated){
            if(updated || Object.keys(PRODS||{}).length) refreshCatalogUi();
          })
          .catch(function(){});
      } else {
        ADMIN_NOTIFICATIONS = [];
        updateNotificationButton();
      }
      if(loggedClient.developer){
        openDeveloperDashboard();
      }
      document.getElementById("logout-btn").classList.add("on");
      clearOrderRequestId();
      if(typeof loadCartBackup === "function"){
        loadCartBackup();
      }
      if(typeof loadCartFromServer === "function"){
        loadCartFromServer();
      }
      setTimeout(function(){
        updateStickyOffsets();
        syncMobileCompactState();
      }, 0);
      ensureCatalogReadyOnStartup();
      return;
    }
  }catch(e){}
  try{
    sessionStorage.removeItem("villas_token");
    sessionStorage.removeItem("villas_client");
    localStorage.removeItem("villas_token");
    localStorage.removeItem("villas_client");
    localStorage.removeItem("villas_session_expires");
  }catch(e){}
  updateUserGreeting();
  setLoginScreenActive(true);
  setMobileCompact(false);
  ensureCatalogReadyOnStartup();
  document.getElementById("l-user").focus();
}, 100);

window.addEventListener("resize", updateStickyOffsets);
window.addEventListener("resize", function(){
  if(window.innerWidth > 640) setMobileCompact(false);
  updateStickyOffsets();
  syncMobileCompactState();
});
window.addEventListener("scroll", handleMobileChromeScroll, { passive:true });

document.addEventListener("touchmove", function(e){
  if(document.body.classList.contains("login-active")) e.preventDefault();
}, { passive:false });

document.addEventListener("wheel", function(e){
  if(document.body.classList.contains("login-active")) e.preventDefault();
}, { passive:false });

function doLogout(){
  loggedClient = null;
  authToken = null;
  ADMIN_NOTIFICATIONS = [];
  DEV_SUMMARY = null;
  DEV_STATUS_DATA = null;
  DEV_NOTES = [];
  DEV_ALL_LOGINS = [];
  DEV_LOGIN_LOGS = [];
  DEV_RECENT_ORDERS = [];
  cart = [];
  cartRevision = 0;
  clearOrderRequestId();
  if(typeof clearCartBackup === "function") clearCartBackup();
  if(typeof renderCart === "function") renderCart();
  clearStoredSession();
  closeNotifications();
  setDeveloperMode(false);
  location.reload();
}

function openAdminSettings(){
  if(!loggedClient || !loggedClient.admin) return;
  setCategoryStatus("", "");
  setSmtpFeedback("", "");
  if(typeof setSettingsTab === "function") setSettingsTab("collection");
  reloadCategoriesFromServer()
    .then(function(updated){
      if(updated) refreshCatalogUi();
      else renderCategoryManager();
    })
    .catch(function(){
      renderCategoryManager();
    });
  loadAdminEmailSettings();
  document.getElementById("settings-bg").classList.add("on");
}
function closeAdminSettings(){
  document.getElementById("settings-bg").classList.remove("on");
}
function setSettingsTab(tabName){
  tabName = String(tabName || "collection");
  var tabs = document.querySelectorAll(".set-tab[data-set-tab]");
  var panels = document.querySelectorAll(".set-panel[data-set-panel]");
  tabs.forEach(function(tab){
    tab.classList.toggle("on", tab.getAttribute("data-set-tab") === tabName);
  });
  panels.forEach(function(panel){
    panel.classList.toggle("on", panel.getAttribute("data-set-panel") === tabName);
  });
}
function setCategoryStatus(msg, kind){
  var el = document.getElementById("category-status");
  if(!el) return;
  el.textContent = msg || "";
  el.className = "cat-status" + (kind ? " " + kind : "");
}
function setSmtpFeedback(msg, kind){
  var el = document.getElementById("smtp-feedback");
  if(!el) return;
  el.textContent = msg || "";
  el.className = "smtp-feedback" + (kind ? " " + kind : "");
}
function setSmtpStatusCard(status){
  var card = document.getElementById("smtp-status-card");
  var title = document.getElementById("smtp-status-title");
  var text = document.getElementById("smtp-status-text");
  if(!card || !title || !text) return;
  var ready = !!(status && status.ready);
  card.className = "smtp-status" + (status ? (ready ? " ok" : " err") : "");
  title.textContent = ready ? "Ligação pronta" : "Ligação com aviso";
  text.textContent = status && status.message ? status.message : "Ainda sem estado disponível.";
}
function openSmtpHelp(){
  var message = [
    "Para usar o email da app:",
    "1) Ativa a verificação em 2 passos na conta Google.",
    "2) Cria uma app password para esta aplicação.",
    "3) Cola essa password no campo Password / app password.",
    "",
    "Se precisares dos links oficiais, vou abrir agora."
  ].join("\n");
  try{
    window.open("https://support.google.com/accounts/answer/185833", "_blank", "noopener");
    window.open("https://myaccount.google.com/security", "_blank", "noopener");
  }catch(e){}
  alert(message);
}
function fillSmtpSettings(config, status){
  var from = document.getElementById("smtp-email-from");
  var to = document.getElementById("smtp-email-to");
  var pass = document.getElementById("smtp-email-pass");
  var hint = document.getElementById("smtp-email-pass-hint");
  if(from) from.value = config && config.emailFrom ? config.emailFrom : "";
  if(to) to.value = config && config.emailTo ? config.emailTo : "";
  if(pass) pass.value = "";
  if(hint){
    hint.textContent = config && config.hasPassword
      ? "Password atual guardada: " + (config.maskedPassword || "********")
      : "Sem password guardada.";
  }
  setSmtpStatusCard(status || null);
}
function loadAdminEmailSettings(){
  if(!loggedClient || !loggedClient.admin) return Promise.resolve(false);
  setSmtpStatusCard({ ready:false, message:"A verificar SMTP..." });
  return fetch(BASE_URL + "/admin/email-config", {
    headers: { "X-Token": authToken || "" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Nao foi possivel carregar o SMTP.");
    fillSmtpSettings(res.config || {}, res.status || null);
    return true;
  })
  .catch(function(err){
    setSmtpStatusCard({ ready:false, message: err.message || "Nao foi possivel carregar o SMTP." });
    setSmtpFeedback(err.message || "Nao foi possivel carregar o SMTP.", "err");
    return false;
  });
}
function saveAdminEmailSettings(){
  var from = document.getElementById("smtp-email-from");
  var to = document.getElementById("smtp-email-to");
  var pass = document.getElementById("smtp-email-pass");
  if(!from || !to || !pass) return;
  var payload = {
    emailFrom: from.value.trim(),
    emailTo: to.value.trim(),
    emailPass: pass.value.trim()
  };
  if(!payload.emailFrom || !payload.emailTo){
    setSmtpFeedback("Preenche o email de envio e o email de destino.", "err");
    return;
  }
  setSmtpFeedback("A atualizar configuração SMTP...", "");
  fetch(BASE_URL + "/admin/email-config", {
    method: "PUT",
    headers: { "Content-Type":"application/json", "X-Token": authToken || "" },
    body: JSON.stringify(payload)
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Nao foi possivel atualizar o SMTP.");
    fillSmtpSettings(res.config || {}, res.status || null);
    setSmtpFeedback(res.message || "SMTP atualizado com sucesso.", "ok");
  })
  .catch(function(err){
    setSmtpStatusCard({ ready:false, message: err.message || "Nao foi possivel atualizar o SMTP." });
    setSmtpFeedback(err.message || "Nao foi possivel atualizar o SMTP.", "err");
  });
}
function renderCategoryManager(){
  var listEl = document.getElementById("category-list");
  if(!listEl) return;
  var dynamicCats = CATS.slice();
  if(!dynamicCats.length){
    listEl.innerHTML = "<div class='cat-empty'>Ainda nao existem categorias.</div>";
    return;
  }
  listEl.innerHTML = dynamicCats.map(function(cat){
    var count = (CAT_ITEMS[cat.id] || []).length;
    var isActive = cat.active !== false;
    return "<div class='cat-item" + (isActive ? "" : " is-off") + "' data-cat-id='" + escAttr(cat.id) + "'>" +
      "<div class='cat-item-meta'><div><strong>" + escH(cat.label) + "</strong><span>" + count + " produto" + (count!==1?"s":"") + " nesta categoria" + (isActive ? "" : " · desativada") + "</span></div></div>" +
      "<div class='cat-item-actions'>" +
      "<button type='button' class='cat-btn cat-btn-order' data-cat-move='" + escAttr(cat.id) + "' data-cat-dir='up'>&uarr;</button>" +
      "<button type='button' class='cat-btn cat-btn-order' data-cat-move='" + escAttr(cat.id) + "' data-cat-dir='down'>&darr;</button>" +
      "<button type='button' class='cat-btn' data-cat-edit='" + escAttr(cat.id) + "'>Editar</button>" +
      "<button type='button' class='cat-btn cat-btn-toggle " + (isActive ? "on" : "off") + "' data-cat-toggle='" + escAttr(cat.id) + "' data-next-active='" + (isActive ? "0" : "1") + "'>" + (isActive ? "Desativar" : "Ativar") + "</button>" +
      "<button type='button' class='cat-btn cat-btn-delete' data-cat-delete='" + escAttr(cat.id) + "'" + (count>0 ? " title='Remove primeiro os produtos desta categoria'" : "") + ">Apagar</button>" +
      "</div></div>";
  }).join("");
}
function persistCategoryOrder(order, successMsg){
  var ordem = Array.isArray(order) ? order.slice() : [];
  if(!ordem.length) return;
  setCategoryStatus("A guardar ordem das categorias...", "");
  fetch(BASE_URL + "/admin/categorias/ordem", {
    method: "POST",
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ ordem: ordem })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Nao foi possivel guardar a ordem.");
    return refreshCatalogUiFromServer(successMsg || "Ordem das categorias atualizada.");
  })
  .catch(function(err){
    setCategoryStatus(err.message||"Nao foi possivel guardar a ordem.", "err");
  });
}
function syncCatalogArrayFromState(){
  CATALOG.length = 0;
  CATS.forEach(function(cat){
    CATALOG.push({ cat:cat.id, label:cat.label, active:cat.active !== false });
    (CAT_ITEMS[cat.id] || []).forEach(function(item){ CATALOG.push(item); });
  });
}
function refreshCatalogUi(){
  syncCatalogArrayFromState();
  rebuildCatalogState();
  renderCatalogShell();
  refreshCatalogVisibility();
  renderCategoryManager();
  var peditCat = document.getElementById("pedit-cat");
  if(peditCat) peditCat.innerHTML = buildCategoryOptions(activeCat);
}
function refreshCatalogUiFromServer(successMsg){
  return reloadCatalogFromServer()
    .then(function(){
      return reloadCategoriesFromServer().catch(function(){ return false; });
    })
    .then(function(){
      refreshCatalogUi();
      if(successMsg) setCategoryStatus(successMsg, "ok");
      return true;
    });
}
function moveCategoryInSettings(catId, direction){
  var idx = CATS.findIndex(function(cat){ return cat.id === catId; });
  if(idx < 0) return;
  var nextIdx = direction === "up" ? idx - 1 : idx + 1;
  if(nextIdx < 0 || nextIdx >= CATS.length) return;
  var tmp = CATS[idx];
  CATS[idx] = CATS[nextIdx];
  CATS[nextIdx] = tmp;
  refreshCatalogUi();
  persistCategoryOrder(CATS.map(function(cat){ return cat.id; }), "Ordem das categorias atualizada.");
}
function createCategoryFromSettings(){
  var input = document.getElementById("category-name");
  if(!input) return;
  var label = input.value.trim();
  if(!label){
    setCategoryStatus("Escreve primeiro o nome da categoria.", "err");
    input.focus();
    return;
  }
  setCategoryStatus("A criar categoria...", "");
  fetch(BASE_URL + "/admin/categorias", {
    method: "POST",
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ label: label })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Nao foi possivel criar a categoria.");
    input.value = "";
    var created = res.categoria || { id:(label||"").trim(), label:label, active:true };
    activeCat = created.id;
    return refreshCatalogUiFromServer("Categoria criada com sucesso.");
  })
  .catch(function(err){
    setCategoryStatus(err.message||"Nao foi possivel criar a categoria.", "err");
  });
}
function deleteCategoryFromSettings(catId){
  if(!catId) return;
  var cat = null;
  for(var i=0;i<CATS.length;i++){ if(CATS[i].id===catId){ cat=CATS[i]; break; } }
  if(!cat) return;
  var count = (CAT_ITEMS[cat.id] || []).length;
  if(count > 0){
    setCategoryStatus("Essa categoria ainda tem produtos associados.", "err");
    return;
  }
  askConfirm({
    title: "Apagar categoria",
    message: "Tens a certeza que queres apagar a categoria \"" + cat.label + "\"?",
    confirmLabel: "Apagar",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    setCategoryStatus("A apagar categoria...", "");
    fetch(BASE_URL + "/admin/categorias/" + encodeURIComponent(catId), {
      method: "DELETE",
      headers: { "X-Token": authToken||"" }
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Nao foi possivel apagar a categoria.");
      if(activeCat === catId){
        var nextCat = CATS.find(function(item){ return item.id !== catId; });
        activeCat = nextCat ? nextCat.id : "";
      }
      return refreshCatalogUiFromServer("Categoria apagada com sucesso.");
    })
    .catch(function(err){
      setCategoryStatus(err.message||"Nao foi possivel apagar a categoria.", "err");
    });
  });
}
function editCategoryFromSettings(catId){
  var cat = null;
  for(var i=0;i<CATS.length;i++){ if(CATS[i].id===catId){ cat=CATS[i]; break; } }
  if(!cat) return;
  var nextLabel = window.prompt("Novo nome da categoria:", cat.label || "");
  if(nextLabel == null) return;
  nextLabel = nextLabel.trim();
  if(!nextLabel){
    setCategoryStatus("O nome da categoria nao pode ficar vazio.", "err");
    return;
  }
  setCategoryStatus("A guardar categoria...", "");
  fetch(BASE_URL + "/admin/categorias/" + encodeURIComponent(catId), {
    method: "PUT",
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ label: nextLabel, activo: cat.active !== false })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Nao foi possivel editar a categoria.");
    var updated = res.categoria || {};
    activeCat = updated.id || catId;
    return refreshCatalogUiFromServer("Categoria atualizada com sucesso.");
  })
  .catch(function(err){
    setCategoryStatus(err.message||"Nao foi possivel editar a categoria.", "err");
  });
}
function toggleCategoryFromSettings(catId, nextActive){
  var cat = null;
  for(var i=0;i<CATS.length;i++){ if(CATS[i].id===catId){ cat=CATS[i]; break; } }
  if(!cat) return;
  var willActivate = String(nextActive) === "1";
  setCategoryStatus((willActivate ? "A ativar" : "A desativar") + " categoria...", "");
  fetch(BASE_URL + "/admin/categorias/" + encodeURIComponent(catId), {
    method: "PUT",
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ label: cat.label, activo: willActivate })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Nao foi possivel atualizar a categoria.");
    return refreshCatalogUiFromServer("Categoria atualizada com sucesso.");
  })
  .catch(function(err){
    setCategoryStatus(err.message||"Nao foi possivel atualizar a categoria.", "err");
  });
}
function exportCatalogData(){
  var payload = {
    exportedAt: new Date().toISOString(),
    categories: CATS.map(function(cat, index){
      return { id:cat.id, label:cat.label, active:cat.active !== false, ordem:index };
    }),
    products: Object.keys(PRODS).map(function(ref){
      var p = PRODS[ref];
      return {
        ref: p.ref,
        nome: p.name,
        tipo: p.type || "",
        cat: p.cat,
        preco: p.price,
        pvp: p.pvp,
        qtd_step: inferQtyStep(p),
        activo: p.active !== false,
        estacao: p.season || "ambos",
        cores: Array.isArray(p.cores) ? p.cores.slice() : [],
        tams: Array.isArray(p.tams) ? p.tams.slice() : [],
        imagem: IMGS[ref] || null
      };
    })
  };
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "villas_backup_" + new Date().toISOString().slice(0,19).replace(/[:T]/g,"-") + ".json";
  a.click();
  URL.revokeObjectURL(url);
  setCategoryStatus("Backup exportado com sucesso.", "ok");
}
function importCatalogData(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    try{
      var data = JSON.parse((ev.target && ev.target.result) || "{}");
      var categories = Array.isArray(data.categories) ? data.categories : [];
      var products = Array.isArray(data.products) ? data.products : [];
      if(!categories.length && !products.length) throw new Error("O ficheiro nao tem categorias nem produtos.");
      setCategoryStatus("A importar dados...", "");

      var categoryChain = categories.reduce(function(prev, cat){
        return prev.then(function(){
          var exists = CATS.some(function(current){ return current.id === cat.id; });
          var url = BASE_URL + "/admin/categorias" + (exists ? "/" + encodeURIComponent(cat.id) : "");
          var method = exists ? "PUT" : "POST";
          var body = exists
            ? { label: cat.label, activo: cat.active !== false }
            : { id: cat.id, label: cat.label, activo: cat.active !== false };
          return fetch(url, {
            method: method,
            headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
            body: JSON.stringify(body)
          }).then(function(r){ return r.json(); }).then(function(res){
            if(!res.ok) throw new Error(res.message||"Falha ao importar categorias.");
          });
        });
      }, Promise.resolve());

      categoryChain
        .then(function(){
          if(!categories.length) return;
          return fetch(BASE_URL + "/admin/categorias/ordem", {
            method: "POST",
            headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
            body: JSON.stringify({ ordem: categories.map(function(cat){ return cat.id; }) })
          }).then(function(r){ return r.json(); }).then(function(res){
            if(!res.ok) throw new Error(res.message||"Falha ao ordenar categorias.");
          });
        })
        .then(function(){
          return products.reduce(function(prev, product){
            return prev.then(function(){
              var exists = !!PRODS[product.ref];
              var url = BASE_URL + "/admin/produtos" + (exists ? "/" + encodeURIComponent(product.ref) : "");
              var method = exists ? "PUT" : "POST";
              return fetch(url, {
                method: method,
                headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
                body: JSON.stringify(product)
              }).then(function(r){ return r.json(); }).then(function(res){
                if(!res.ok) throw new Error(res.message||("Falha ao importar produto " + product.ref));
              });
            });
          }, Promise.resolve());
        })
        .then(function(){
          return refreshCatalogUiFromServer("Importacao concluida com sucesso.");
        })
        .catch(function(err){
          setCategoryStatus(err.message||"Nao foi possivel importar o ficheiro.", "err");
        });
    }catch(err){
      setCategoryStatus(err.message||"Ficheiro JSON invalido.", "err");
    }
  };
  reader.readAsText(file);
}
function applyCollectionMode(mode){
  if(!loggedClient || !loggedClient.admin) return;
  var labels = {
    verao: "Modo Verão",
    inverno: "Modo Inverno",
    todos: "Reativar Tudo"
  };
  askConfirm({
    title: "Aplicar coleção",
    message: "Queres aplicar \"" + (labels[mode] || mode) + "\" ao catálogo?",
    confirmLabel: "Aplicar"
  }).then(function(ok){
    if(!ok) return;
    fetch(BASE_URL + "/admin/produtos/colecao", {
      method: "POST",
      headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
      body: JSON.stringify({ modo: mode })
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Nao foi possivel atualizar a colecao.");
      closeAdminSettings();
      return refreshCatalogUiFromServer("Colecao atualizada com sucesso.");
    })
    .catch(function(err){
      alert(err.message||"Nao foi possivel atualizar a colecao.");
    });
  });
}

function formatMoney(value){
  return Number(value || 0).toFixed(2).replace(".", ",") + "€";
}

function formatDateTime(iso, fallbackDate, fallbackTime){
  if(iso){
    var d = new Date(iso);
    if(!isNaN(d.getTime())){
      return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" });
    }
  }
  return [fallbackDate || "", fallbackTime || ""].join(" ").trim();
}

function areaTabsMarkup(isAdmin){
  if(!isAdmin){
    return "<div class='area-tabs'><button class='area-tab on' data-area-tab='minhas-encomendas'>As minhas encomendas</button></div>";
  }
  return "<div class='area-tabs'>"
    + "<button class='area-tab" + (areaTab==="clientes"?" on":"") + "' data-area-tab='clientes'>Clientes</button>"
    + "<button class='area-tab" + (areaTab==="encomendas"?" on":"") + "' data-area-tab='encomendas'>Encomendas</button>"
    + "<button class='area-tab" + (areaTab==="estatisticas"?" on":"") + "' data-area-tab='estatisticas'>Estatísticas</button>"
    + "</div>";
}

function buildOrderCard(order, opts){
  opts = opts || {};
  var isAdminView = !!opts.admin;
  var actions = [];
  actions.push("<button class='ord-btn' data-order-open='" + order.id + "'>Ver detalhe</button>");
  actions.push("<button class='ord-btn' data-order-pdf='" + order.id + "'>PDF</button>");
  if(isAdminView){
    actions.push("<button class='ord-btn' data-order-pdf='" + order.id + "' data-order-pdf-mode='sem_precos'>PDF s/ preços</button>");
  }
  if(isAdminView){
    actions.push("<button class='ord-btn danger' data-order-delete='" + order.id + "'>Eliminar</button>");
  } else {
    actions.push("<button class='ord-btn primary' data-order-repeat='" + order.id + "'>Reencomendar</button>");
  }
  var publicNumber = order.publicNumber || order.public_number || ("VLS-" + String(new Date(order.createdAt || Date.now()).getFullYear()) + "-" + String(order.id || 0).padStart(6, "0"));
  var title = isAdminView ? escH(order.client || publicNumber) : "Encomenda anterior";
  var subtitle = isAdminView
    ? (escH(publicNumber) + (order.email ? " &middot; " + escH(order.email) : ""))
    : (escH(publicNumber) + " &middot; NIF: " + escH(order.nif || "Sem NIF"));
  return "<div class='ord-card'>"
    + "<div class='ord-card-head'>"
      + "<div><div class='ord-title'>" + title + "</div><div class='ord-sub'>" + subtitle + "<br>" + escH(formatDateTime(order.createdAt, order.date, order.time)) + "</div></div>"
      + "<div class='ord-total'><small>Total</small>" + formatMoney(order.total) + "</div>"
    + "</div>"
    + "<div class='ord-sub'><span class='ord-badge'>" + order.units + " unidades</span> <span class='ord-badge'>" + order.lines + " linhas</span></div>"
    + "<div class='ord-actions'>" + actions.join("") + "</div>"
    + "</div>";
}

function renderOrderDetail(order, isAdminView){
  var itemsHtml = (order.items || []).map(function(item){
    return "<div class='ord-line'>"
      + "<div><div class='ord-line-ref'>Ref. " + escH(item.ref) + " - " + escH(item.name) + "</div><div class='ord-line-meta'>" + escH(item.cor) + " &middot; " + escH(item.tam) + (item.type ? " &middot; " + escH(item.type) : "") + "</div></div>"
      + "<div>" + item.qty + "x</div>"
      + "<div class='ord-line-total'>" + formatMoney(item.total || (item.qty * item.price)) + "</div>"
      + "</div>";
  }).join("");
  var actions = "<div class='ord-actions'>"
    + "<button class='ord-btn' data-order-pdf='" + order.id + "'>Descarregar PDF</button>"
    + (isAdminView ? "<button class='ord-btn' data-order-pdf='" + order.id + "' data-order-pdf-mode='sem_precos'>Descarregar PDF s/ preços</button>" : "")
    + (isAdminView
      ? "<button class='ord-btn danger' data-order-delete='" + order.id + "'>Eliminar encomenda</button>"
      : "<button class='ord-btn primary' data-order-repeat='" + order.id + "'>Reencomendar esta encomenda</button>")
    + "</div>";
  return "<div class='ord-detail'>"
    + "<div class='ord-detail-head'><div><div class='ord-title'>" + (isAdminView ? escH(order.client || ("Encomenda #" + order.id)) : "Resumo da encomenda") + "</div><div class='ord-sub'>" + escH(order.publicNumber || order.public_number || ("#" + order.id)) + " &middot; " + escH(formatDateTime(order.createdAt, order.date, order.time)) + "</div></div><div class='ord-total'><small>Total</small>" + formatMoney(order.total) + "</div></div>"
    + "<div class='ord-detail-grid'>"
      + "<div class='ord-detail-box'><strong>Cliente</strong>" + escH(order.client || "") + "</div>"
      + "<div class='ord-detail-box'><strong>NIF</strong>" + escH(order.nif || "Sem NIF") + "</div>"
      + "<div class='ord-detail-box'><strong>Contacto</strong>" + escH(order.email || "Sem email") + "</div>"
      + "<div class='ord-detail-box'><strong>Resumo</strong>" + order.units + " unidades &middot; " + order.lines + " linhas</div>"
    + "</div>"
    + (order.notes ? "<div class='ord-detail-box'><strong>Notas</strong>" + escH(order.notes) + "</div>" : "")
    + "<div class='ord-items'>" + itemsHtml + "</div>"
    + actions
    + "</div>";
}

function loadOrderDetail(orderId, isAdminView){
  var url = isAdminView ? (BASE_URL + "/admin/encomendas/" + orderId) : (BASE_URL + "/me/encomendas/" + orderId);
  fetch(url, {
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !res.encomenda) throw new Error(res.message || "Nao foi possivel carregar a encomenda.");
    selectedOrderId = orderId;
    var body = document.getElementById("abody");
    if(body){
      body.innerHTML = areaTabsMarkup(!!(loggedClient && loggedClient.admin)) + renderOrderDetail(res.encomenda, isAdminView)
        + (loggedClient && loggedClient.admin ? buildAdminExtraSection() : buildUserOrdersSection());
      bindAreaPanelEvents();
    }
  })
  .catch(function(err){
    alert(err.message || "Nao foi possivel carregar a encomenda.");
  });
}

function buildUserOrdersSection(){
  if(!USER_ORDERS.length){
    return "<div class='area-empty'>Ainda nao tens encomendas antigas.</div>";
  }
  return "<div class='area-section'>" + USER_ORDERS.map(function(order){
    return buildOrderCard(order, { admin:false });
  }).join("") + "</div>";
}

function buildClientsSection(){
  return "<div style='display:flex;justify-content:flex-end;margin-bottom:12px;'>" +
    (editingIdx < 0 ? "<button class='abtn-new' id='abtn-new' style='width:auto;min-height:42px;padding:0 16px;border-radius:999px;'>+ Novo Cliente</button>" : "") +
    "</div>" +
    renderForm(editingIdx >= 0 ? CLIENTS[editingIdx] : null) +
    "<div style='margin-bottom:6px;'>" +
    CLIENTS.map(function(c,i){
      return "<div class='cl-item'>"
        + "<div class='cl-info'>"
          + "<div class='cl-name'>" + escH(c.name||c.user) + (c.admin ? " <span class='cl-badge'>ADMIN</span>" : "") + "</div>"
          + "<div class='cl-meta'>&#128100; " + escH(c.user) + (c.nif ? " &nbsp;&#183;&nbsp; NIF: " + escH(c.nif) : "") + (c.email ? " &nbsp;&#183;&nbsp; " + escH(c.email) : "") + "</div>"
          + "<div class='cl-meta'>" + (c.total_encomendas || 0) + " encomenda" + ((c.total_encomendas || 0)!==1 ? "s" : "") + "</div>"
        + "</div>"
        + "<button class='cl-edit' data-ei='" + i + "'>Editar</button>"
        + "<button class='cl-edit' data-client-orders='" + c.id + "'>Encomendas</button>"
        + (!c.admin ? "<button class='cl-del' data-di='" + i + "'>&#128465;</button>" : "")
        + "</div>";
    }).join("") + "</div>" +
    "";
}

function buildAdminOrdersSection(){
  var list = ADMIN_ORDERS.filter(function(order){
    if(filterClientId && order.clientId !== filterClientId) return false;
    if(!areaSearch) return true;
    var hay = [order.id, order.client, order.nif, order.email, order.date].join(" ").toLowerCase();
    return hay.indexOf(areaSearch.toLowerCase()) >= 0;
  });
  var activeClient = filterClientId ? CLIENTS.find(function(c){ return c.id === filterClientId; }) : null;
  var detailHtml = "";
  if(selectedOrderId){
    var match = ADMIN_ORDERS.find(function(order){ return order.id === selectedOrderId; });
    if(match){
      detailHtml = "<div class='ord-detail-box'><strong>Encomenda selecionada</strong>Clica em <b>Ver detalhe</b> para abrir toda a informação da encomenda #" + match.id + ".</div>";
    }
  }
  return "<div class='area-toolbar'>"
    + "<input class='area-search' id='area-search' type='search' placeholder='Pesquisar encomendas por cliente, NIF ou email' value='" + escAttr(areaSearch) + "'>"
    + (activeClient ? "<span class='ord-badge'>Cliente: " + escH(activeClient.name || activeClient.user) + "</span>" : "")
    + "</div>"
    + detailHtml
    + (list.length ? "<div class='area-section'>" + list.map(function(order){ return buildOrderCard(order, { admin:true }); }).join("") + "</div>" : "<div class='area-empty'>Nao encontramos encomendas com esse filtro.</div>");
}

function buildKpiCard(value, label, sublabel){
  return "<div class='stats-kpi'>"
    + "<div class='stats-kpi-value'>" + value + "</div>"
    + "<div class='stats-kpi-label'>" + escH(label) + "</div>"
    + (sublabel ? "<div class='stats-kpi-sub'>" + escH(sublabel) + "</div>" : "")
    + "</div>";
}

function buildRankingRows(items, emptyText, renderRow){
  if(!items || !items.length){
    return "<div class='area-empty'>" + escH(emptyText) + "</div>";
  }
  return "<div class='stats-ranking'>" + items.map(function(item, index){
    return renderRow(item, index);
  }).join("") + "</div>";
}

function buildOrderedListSection(title, subtitle, items, emptyText, renderRow){
  return "<div class='stats-panel'>"
    + "<div class='stats-panel-head'>"
      + "<div>"
        + "<div class='ord-title'>" + escH(title) + "</div>"
        + (subtitle ? "<div class='ord-sub'>" + escH(subtitle) + "</div>" : "")
      + "</div>"
    + "</div>"
    + buildRankingRows(items, emptyText, renderRow)
  + "</div>";
}

function buildAdminStatsSection(){
  var stats = ADMIN_STATS || {};
  var summary = stats.summary || {};
  var catalog = stats.catalog || {};
  var topProducts = stats.topProducts || [];
  var topCategories = stats.topCategories || [];
  var topCustomers = stats.topCustomers || [];
  var topColors = stats.topColors || [];
  var topSizes = stats.topSizes || [];
  var topOrders = stats.topOrders || [];
  var recentOrders = stats.recentOrders || [];
  var monthly = stats.monthly || [];
  var lastOrder = summary.lastOrderAt ? formatDateTime(summary.lastOrderAt) : "Sem dados";
  var lastLogin = catalog.lastLoginAt ? formatDateTime(catalog.lastLoginAt) : "Sem dados";
  var avgTicket = summary.totalOrders ? (summary.totalBilled / summary.totalOrders) : 0;
  return "<div class='area-section stats-shell'>"
    + "<div class='stats-kpis'>"
      + buildKpiCard(summary.totalOrders || 0, "Encomendas", "Última: " + lastOrder)
      + buildKpiCard(formatMoney(summary.totalBilled || 0), "Faturação", "Ticket médio " + formatMoney(avgTicket))
      + buildKpiCard(summary.totalUnits || 0, "Unidades vendidas", (summary.orders30d || 0) + " nas últimas 4 semanas")
      + buildKpiCard(summary.totalCustomers || 0, "Clientes com compras", (summary.orders7d || 0) + " encomendas na última semana")
      + buildKpiCard(catalog.totalProducts || 0, "Produtos", (catalog.activeProducts || 0) + " ativos · " + (catalog.inactiveProducts || 0) + " inativos")
      + buildKpiCard(catalog.totalCategories || 0, "Categorias", (catalog.activeCategories || 0) + " ativas · " + (catalog.inactiveCategories || 0) + " inativas")
      + buildKpiCard(summary.emailsSent || 0, "Emails enviados", (summary.emailsFailed || 0) + " falhas")
      + buildKpiCard(catalog.logins7d || 0, "Logins 7 dias", (catalog.failedLogins7d || 0) + " falhados · último " + lastLogin)
    + "</div>"
    + "<div class='stats-panels'>"
      + "<div class='stats-panel stats-panel-wide'>"
        + "<div class='stats-panel-head'><div><div class='ord-title'>Resumo do catálogo</div><div class='ord-sub'>Sazonalidade, tamanhos e estado dos produtos</div></div></div>"
        + "<div class='stats-mini-grid'>"
          + "<div class='stats-mini'><strong>" + (catalog.activeProducts || 0) + "</strong><span>Ativos</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.inactiveProducts || 0) + "</strong><span>Inativos</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.winterProducts || 0) + "</strong><span>Inverno</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.summerProducts || 0) + "</strong><span>Verão</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.allSeasonProducts || 0) + "</strong><span>Ambos</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.step1Products || 0) + "/" + (catalog.step12Products || 0) + "</strong><span>Qtd. 1 / 12</span></div>"
        + "</div>"
      + "</div>"
      + "<div class='stats-panel stats-panel-wide'>"
        + "<div class='stats-panel-head'><div><div class='ord-title'>Atividade recente</div><div class='ord-sub'>Movimento do site e do login</div></div></div>"
        + "<div class='stats-mini-grid'>"
          + "<div class='stats-mini'><strong>" + (summary.orders7d || 0) + "</strong><span>Encomendas 7 dias</span></div>"
          + "<div class='stats-mini'><strong>" + (summary.orders30d || 0) + "</strong><span>Encomendas 30 dias</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.logins7d || 0) + "</strong><span>Logins 7 dias</span></div>"
          + "<div class='stats-mini'><strong>" + (catalog.logins30d || 0) + "</strong><span>Logins 30 dias</span></div>"
          + "<div class='stats-mini'><strong>" + (summary.emailsSent || 0) + "</strong><span>Emails enviados</span></div>"
          + "<div class='stats-mini'><strong>" + (summary.emailsFailed || 0) + "</strong><span>Emails falhados</span></div>"
        + "</div>"
      + "</div>"
      + buildOrderedListSection("Produtos mais vendidos", "Unidades vendidas e faturação por artigo", topProducts, "Ainda não há dados de produtos.", function(item, index){
        return "<div class='stats-row'>"
          + "<div class='stats-rank'>" + (index + 1) + "</div>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(item.ref) + " - " + escH(item.name || item.ref) + "</div>"
            + "<div class='stats-meta'>" + escH(item.unitsSold || 0) + " unidades · " + escH(item.ordersCount || 0) + " encomendas" + (item.type ? " · " + escH(item.type) : "") + "</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + buildOrderedListSection("Clientes com mais compras", "Total faturado por cliente", topCustomers, "Ainda não há dados de clientes.", function(item, index){
        var who = item.name || item.user || "Cliente";
        return "<div class='stats-row'>"
          + "<div class='stats-rank'>" + (index + 1) + "</div>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(who) + "</div>"
            + "<div class='stats-meta'>" + escH(item.ordersCount || 0) + " encomendas · " + escH(item.unitsSold || 0) + " unidades" + (item.email ? " · " + escH(item.email) : "") + "</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + buildOrderedListSection("Categorias mais vendidas", "Agrupadas pela categoria real do produto", topCategories, "Ainda não há dados de categorias.", function(item, index){
        return "<div class='stats-row'>"
          + "<div class='stats-rank'>" + (index + 1) + "</div>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(item.category) + "</div>"
            + "<div class='stats-meta'>" + escH(item.unitsSold || 0) + " unidades · " + escH(item.ordersCount || 0) + " encomendas</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + buildOrderedListSection("Cores mais pedidas", "Variações usadas nas encomendas", topColors, "Ainda não há dados de cores.", function(item, index){
        return "<div class='stats-row'>"
          + "<div class='stats-rank'>" + (index + 1) + "</div>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(item.color) + "</div>"
            + "<div class='stats-meta'>" + escH(item.unitsSold || 0) + " unidades · " + escH(item.ordersCount || 0) + " encomendas</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + buildOrderedListSection("Tamanhos mais pedidos", "Distribuição por tamanho", topSizes, "Ainda não há dados de tamanhos.", function(item, index){
        return "<div class='stats-row'>"
          + "<div class='stats-rank'>" + (index + 1) + "</div>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(item.size) + "</div>"
            + "<div class='stats-meta'>" + escH(item.unitsSold || 0) + " unidades · " + escH(item.ordersCount || 0) + " encomendas</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + buildOrderedListSection("Evolução mensal", "Últimos 6 meses", monthly, "Ainda não há dados mensais.", function(item, index){
        var max = 1;
        for(var i=0;i<monthly.length;i++){
          max = Math.max(max, Number(monthly[i].billedTotal || 0));
        }
        var pct = Math.max(6, Math.round(((Number(item.billedTotal || 0) / max) * 100)));
        return "<div class='stats-row stats-row-graph'>"
          + "<div class='stats-main'>"
            + "<div class='stats-name'>" + escH(item.label || item.key || "") + "</div>"
            + "<div class='stats-bar'><span style='width:" + pct + "%'></span></div>"
            + "<div class='stats-meta'>" + escH(item.ordersCount || 0) + " encomendas · " + escH(item.unitsSold || 0) + " unidades</div>"
          + "</div>"
          + "<div class='stats-value'>" + formatMoney(item.billedTotal || 0) + "</div>"
        + "</div>";
      })
      + "<div class='stats-panel stats-panel-wide'>"
        + "<div class='stats-panel-head'><div><div class='ord-title'>Últimas encomendas</div><div class='ord-sub'>Entrada recente no sistema</div></div></div>"
        + buildRankingRows(recentOrders, "Ainda não há encomendas recentes.", function(item, index){
          return "<div class='stats-row'>"
            + "<div class='stats-rank'>" + (index + 1) + "</div>"
            + "<div class='stats-main'>"
              + "<div class='stats-name'>" + escH(item.publicNumber || ("#" + item.id)) + "</div>"
              + "<div class='stats-meta'>" + escH(item.client || "Cliente") + " · " + escH(formatDateTime(item.createdAt)) + " · " + escH(item.orderStatus || "created") + " / " + escH(item.emailStatus || "pending") + "</div>"
            + "</div>"
            + "<div class='stats-value'>" + formatMoney(item.total || 0) + "</div>"
          + "</div>";
        })
      + "</div>"
      + "<div class='stats-panel stats-panel-wide'>"
        + "<div class='stats-panel-head'><div><div class='ord-title'>Encomendas de maior valor</div><div class='ord-sub'>As mais faturadas do histórico</div></div></div>"
        + buildRankingRows(topOrders, "Ainda não há encomendas.", function(item, index){
          return "<div class='stats-row'>"
            + "<div class='stats-rank'>" + (index + 1) + "</div>"
            + "<div class='stats-main'>"
              + "<div class='stats-name'>" + escH(item.publicNumber || ("#" + item.id)) + "</div>"
              + "<div class='stats-meta'>" + escH(item.client || "Cliente") + " · " + escH(item.units || 0) + " unidades · " + escH(item.lines || 0) + " linhas</div>"
            + "</div>"
            + "<div class='stats-value'>" + formatMoney(item.total || 0) + "</div>"
          + "</div>";
        })
      + "</div>"
    + "</div>"
  + "</div>";
}

function buildAdminExtraSection(){
  if(areaTab === "clientes") return buildClientsSection();
  if(areaTab === "estatisticas") return buildAdminStatsSection();
  return buildAdminOrdersSection();
}

function renderAdminPanel(){
  var title = document.querySelector("#apanel .aph h2");
  var body = document.getElementById("abody");
  if(!loggedClient){
    if(title) title.textContent = "Área";
    body.innerHTML = "<div class='area-empty'>Faz login para aceder à tua área.</div>";
    return;
  }
  if(loggedClient.admin){
    if(title) title.textContent = "Área Admin";
    body.innerHTML = areaTabsMarkup(true) + "<div class='area-empty'>A carregar...</div>";
    bindAreaPanelEvents();
    if(areaTab === "clientes"){
      renderAdminClients();
    } else if(areaTab === "estatisticas"){
      renderAdminStats();
    } else {
      renderAdminOrders();
    }
    return;
  }
  if(title) title.textContent = "A Minha Área";
  body.innerHTML = areaTabsMarkup(false) + "<div class='area-empty'>A carregar as tuas encomendas...</div>";
  bindAreaPanelEvents();
  renderUserOrders();
}

function renderUserOrders(){
  fetch(BASE_URL + "/me/encomendas", {
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.encomendas)) throw new Error(res.message || "Nao foi possivel carregar as encomendas.");
    USER_ORDERS = res.encomendas;
    selectedOrderId = null;
    document.getElementById("abody").innerHTML = areaTabsMarkup(false) + buildUserOrdersSection();
    bindAreaPanelEvents();
  })
  .catch(function(){
    document.getElementById("abody").innerHTML = areaTabsMarkup(false) + "<div class='area-empty'>Nao foi possivel carregar as tuas encomendas.</div>";
    bindAreaPanelEvents();
  });
}

function renderAdminClients(){
  var body = document.getElementById("abody");
  fetch(BASE_URL+"/admin/clientes", {
    headers: {"X-Token": authToken||""}
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.clientes)) throw new Error(res.message||"Erro ao carregar clientes");
    CLIENTS = res.clientes.map(function(c){
      return {user:c.user,pass:c.pass,name:c.nome,nif:c.nif,admin:!!c.admin,id:c.id,
              ativo:c.activo !== false,email:c.email||'',telefone:c.telefone||'',
              total_encomendas:c.total_encomendas||0};
    });
    body.innerHTML = areaTabsMarkup(true) + buildClientsSection();
    bindAreaPanelEvents();
  })
  .catch(function(){
    body.innerHTML = areaTabsMarkup(true) + "<div class='area-empty'>Nao foi possivel carregar os clientes.</div>";
    bindAreaPanelEvents();
  });
}

function renderAdminOrders(){
  var body = document.getElementById("abody");
  Promise.all([
    fetch(BASE_URL + "/admin/encomendas", {
      headers: { "X-Token": authToken||"" }
    }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/admin/clientes", {
      headers: { "X-Token": authToken||"" }
    }).then(function(r){ return r.json(); }).catch(function(){ return { ok:false, clientes:[] }; })
  ])
  .then(function(results){
    var ordersRes = results[0] || {};
    var clientsRes = results[1] || {};
    if(!ordersRes.ok || !Array.isArray(ordersRes.encomendas)) throw new Error(ordersRes.message || "Nao foi possivel carregar as encomendas.");
    ADMIN_ORDERS = ordersRes.encomendas;
    if(clientsRes.ok && Array.isArray(clientsRes.clientes)){
      CLIENTS = clientsRes.clientes.map(function(c){
        return {user:c.user,pass:c.pass,name:c.nome,nif:c.nif,admin:!!c.admin,id:c.id,
                ativo:c.activo !== false,email:c.email||'',telefone:c.telefone||'',
                total_encomendas:c.total_encomendas||0};
      });
    }
    body.innerHTML = areaTabsMarkup(true) + buildAdminExtraSection();
    bindAreaPanelEvents();
  })
  .catch(function(){
    body.innerHTML = areaTabsMarkup(true) + "<div class='area-empty'>Nao foi possivel carregar as encomendas.</div>";
    bindAreaPanelEvents();
  });
}

function renderAdminStats(){
  var body = document.getElementById("abody");
  fetch(BASE_URL + "/admin/estatisticas", {
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !res.estatisticas) throw new Error(res.message || "Nao foi possivel carregar as estatísticas.");
    ADMIN_STATS = res.estatisticas;
    body.innerHTML = areaTabsMarkup(true) + buildAdminStatsSection();
    bindAreaPanelEvents();
  })
  .catch(function(){
    body.innerHTML = areaTabsMarkup(true) + "<div class='area-empty'>Nao foi possivel carregar as estatísticas.</div>";
    bindAreaPanelEvents();
  });
}

function deleteAdminOrder(orderId){
  askConfirm({
    title: "Eliminar encomenda",
    text: "Tens a certeza que queres eliminar esta encomenda? Esta ação não pode ser anulada.",
    confirmText: "Eliminar",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    fetch(BASE_URL + "/admin/encomendas/" + orderId, {
      method: "DELETE",
      headers: { "X-Token": authToken||"" }
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message || "Não foi possível eliminar a encomenda.");
      ADMIN_ORDERS = ADMIN_ORDERS.filter(function(order){ return order.id !== orderId; });
      if(selectedOrderId === orderId) selectedOrderId = null;
      renderAdminPanel();
    })
    .catch(function(err){
      alert(err.message || "Não foi possível eliminar a encomenda.");
    });
  });
}

function fillCartFromOrder(order){
  if(!order || !Array.isArray(order.items)) return;
  cart = order.items.map(function(item){
    var prod = PRODS[item.ref] || {};
    return {
      ref: item.ref,
      name: item.name,
      type: item.type || prod.type || "",
      cor: item.cor,
      tam: item.tam,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      img: prod.img || IMGS[item.ref] || ""
    };
  });
  renderCart();
  cart.forEach(function(item){ updateBadge(item.ref); });
  scheduleCartSync();
  closeAdmin();
  openCartPanel();
}

function repeatOrder(orderId){
  fetch(BASE_URL + "/me/encomendas/" + orderId + "/reencomendar", {
    method: "POST",
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !res.encomenda) throw new Error(res.message || "Nao foi possivel repetir a encomenda.");
    fillCartFromOrder(res.encomenda);
  })
  .catch(function(err){
    alert(err.message || "Nao foi possivel repetir a encomenda.");
  });
}

function downloadOrderPdf(orderId, mode){
  mode = mode || "normal";
  var suffix = mode === "sem_precos" ? "_sem_precos" : "";
  var url = BASE_URL + "/encomendas/" + orderId + "/pdf" + (mode === "sem_precos" ? "?mode=sem_precos" : "");
  var order = (ADMIN_ORDERS || []).find(function(item){ return item.id === orderId; }) || (USER_ORDERS || []).find(function(item){ return item.id === orderId; }) || {};
  var publicNumber = order.publicNumber || order.public_number || ("VLS-" + String(new Date(order.createdAt || Date.now()).getFullYear()) + "-" + String(orderId || 0).padStart(6, "0"));
  fetch(url, {
    headers: { "X-Token": authToken||"" }
  })
  .then(function(res){
    if(!res.ok) throw new Error("Nao foi possivel gerar o PDF.");
    return res.blob();
  })
  .then(function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = publicNumber + suffix + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  })
  .catch(function(err){
    alert(err.message || "Nao foi possivel descarregar o PDF.");
  });
}

function bindAreaPanelEvents(){
  var body = document.getElementById("abody");
  if(!body || body.dataset.areaBound === "1") return;
  body.dataset.areaBound = "1";
  body.addEventListener("click", function(e){
    var tab = e.target.closest("[data-area-tab]");
    if(tab){
      areaTab = tab.getAttribute("data-area-tab");
      selectedOrderId = null;
      filterClientId = null;
      editingIdx = -1;
      renderAdminPanel();
      return;
    }
    var openBtn = e.target.closest("[data-order-open]");
    if(openBtn){
      loadOrderDetail(parseInt(openBtn.getAttribute("data-order-open"), 10), !!(loggedClient && loggedClient.admin));
      return;
    }
    var pdfBtn = e.target.closest("[data-order-pdf]");
    if(pdfBtn){
      downloadOrderPdf(
        parseInt(pdfBtn.getAttribute("data-order-pdf"), 10),
        pdfBtn.getAttribute("data-order-pdf-mode") || "normal"
      );
      return;
    }
    var repeatBtn = e.target.closest("[data-order-repeat]");
    if(repeatBtn){
      repeatOrder(parseInt(repeatBtn.getAttribute("data-order-repeat"), 10));
      return;
    }
    var deleteOrderBtn = e.target.closest("[data-order-delete]");
    if(deleteOrderBtn){
      deleteAdminOrder(parseInt(deleteOrderBtn.getAttribute("data-order-delete"), 10));
      return;
    }
    var clientOrdersBtn = e.target.closest("[data-client-orders]");
    if(clientOrdersBtn){
      areaTab = "encomendas";
      areaSearch = "";
      filterClientId = parseInt(clientOrdersBtn.getAttribute("data-client-orders"), 10);
      renderAdminOrders();
      return;
    }
    var editClientBtn = e.target.closest("[data-ei]");
    if(editClientBtn){
      editingIdx = parseInt(editClientBtn.getAttribute("data-ei"), 10);
      renderAdminPanel();
      return;
    }
    var deleteClientBtn = e.target.closest("[data-di]");
    if(deleteClientBtn){
      var idx = parseInt(deleteClientBtn.getAttribute("data-di"), 10);
      var client = CLIENTS[idx];
      if(client){
        askConfirm({
          title: "Apagar cliente",
          message: "Tens a certeza que queres apagar o cliente \"" + client.name + "\"?",
          confirmLabel: "Apagar",
          danger: true
        }).then(function(ok){
          if(ok) deleteClient(client, idx);
        });
      }
      return;
    }
    if(e.target && e.target.id === "abtn-new"){
      editingIdx = -2;
      renderAdminPanel();
      return;
    }
  });
  body.addEventListener("input", function(e){
    if(e.target && e.target.id === "area-search"){
      areaSearch = e.target.value || "";
      document.getElementById("abody").innerHTML = areaTabsMarkup(true) + buildAdminExtraSection();
      bindAreaPanelEvents();
      return;
    }
  });
}


if (!window.__VILLAS_BOOTSTRAPPED__) {
  window.__VILLAS_BOOTSTRAPPED__ = true;
  renderCatalogShell();
  setTimeout(function(){
    updateStickyOffsets();
    syncMobileCompactState();
  }, 0);
}
