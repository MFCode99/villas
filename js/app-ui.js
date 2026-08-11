// Focus user field on load
try{
  if(typeof window.showInactiveProducts === "undefined"){
    window.showInactiveProducts = true;
  }
  if(typeof window.collectionMode === "undefined" || !window.collectionMode){
    window.collectionMode = "personalizada";
  }
}catch(e){}

function ensureCatalogReadyOnStartup(){
  if(typeof loadSiteSettingsFromServer === "function"){
    loadSiteSettingsFromServer().catch(function(){ return false; });
  }
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
      if(typeof syncCartFromServer === "function"){
        return syncCartFromServer().catch(function(){ return false; });
      }
    })
    .catch(function(){});
}

setTimeout(function(){
  if(typeof bootstrapSessionFromServer === "function"){
    bootstrapSessionFromServer().catch(function(){ return false; });
    return;
  }
  if(typeof setLoginScreenActive === "function") setLoginScreenActive(true);
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
  var finish = function(){
    if(typeof sessionExpiryHandled !== "undefined") sessionExpiryHandled = false;
    clearAuthenticatedState();
    closeNotifications();
    setDeveloperMode(false);
    location.reload();
  };
  if(typeof logoutSessionOnServer === "function"){
    logoutSessionOnServer().finally(finish);
  } else {
    finish();
  }
}

function openAdminSettings(){
  if(!loggedClient || !loggedClient.admin) return;
  setCategoryStatus("", "");
  setSmtpFeedback("", "");
  loadCollectionModeFromServer();
  reloadCategoriesFromServer()
    .then(function(updated){
      if(updated) refreshCatalogUi();
      else renderCategoryManager();
    })
    .catch(function(){
      renderCategoryManager();
    });
  loadAdminEmailSettings();
  setSettingsTab("collection");
  updateCollectionSummary();
  updateInactiveToggleButton();
  document.getElementById("settings-bg").classList.add("on");
}
function closeAdminSettings(){
  document.getElementById("settings-bg").classList.remove("on");
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
function setSettingsTab(tab){
  var current = tab || "collection";
  window.__VILLAS_SETTINGS_TAB__ = current;
  document.querySelectorAll("[data-set-tab]").forEach(function(btn){
    btn.classList.toggle("on", btn.getAttribute("data-set-tab") === current);
  });
  document.querySelectorAll("[data-set-panel]").forEach(function(panel){
    panel.classList.toggle("on", panel.getAttribute("data-set-panel") === current);
  });
}
function getCollectionModeLabel(mode){
  var map = {
    verao: "Verão",
    inverno: "Inverno",
    todos: "Tudo",
    personalizada: "Personalizada"
  };
  return map[String(mode || "").toLowerCase()] || "Personalizada";
}
function inferCollectionModeFromCatalog(){
  var products = Object.keys(PRODS || {}).map(function(ref){ return PRODS[ref]; }).filter(Boolean);
  if(!products.length) return "todos";
  var summer = 0, winter = 0, both = 0;
  var summerOff = 0, winterOff = 0, bothOff = 0;
  products.forEach(function(p){
    var season = String(p.season || "ambos").toLowerCase();
    var isActive = p.active !== false;
    if(season === "verao"){
      if(isActive) summer++; else summerOff++;
    } else if(season === "inverno"){
      if(isActive) winter++; else winterOff++;
    } else {
      if(isActive) both++; else bothOff++;
    }
  });
  if(summer > 0 && winterOff > 0 && summerOff === 0 && bothOff === 0) return "verao";
  if(winter > 0 && summerOff > 0 && winterOff === 0 && bothOff === 0) return "inverno";
  if(summerOff === 0 && winterOff === 0 && bothOff === 0) return "todos";
  return "personalizada";
}
function updateInactiveToggleButton(){
  var btn = document.getElementById("settings-toggle-inactive");
  if(!btn) return;
  var isShowing = window.showInactiveProducts !== false;
  btn.classList.toggle("is-on", isShowing);
  btn.innerHTML = isShowing
    ? "Ocultar itens desativados<small>Esconde os produtos inativos no catálogo enquanto trabalhas.</small>"
    : "Mostrar itens desativados<small>Volta a mostrar os produtos desativados no catálogo.</small>";
}
function updateCollectionSummary(){
  var titleEl = document.getElementById("collection-summary-title");
  var textEl = document.getElementById("collection-summary-text");
  var chipsEl = document.getElementById("collection-summary-chips");
  if(!titleEl || !textEl || !chipsEl) return;
  var products = Object.keys(PRODS || {}).map(function(ref){ return PRODS[ref]; }).filter(Boolean);
  var activeCount = products.filter(function(p){ return p.active !== false; }).length;
  var inactiveCount = products.length - activeCount;
  var currentMode = window.collectionMode || inferCollectionModeFromCatalog();
  window.collectionMode = currentMode;
  titleEl.textContent = getCollectionModeLabel(currentMode);
  textEl.textContent = activeCount + " produto" + (activeCount !== 1 ? "s" : "") + " ativos · " + inactiveCount + " inativo" + (inactiveCount !== 1 ? "s" : "");
  chipsEl.innerHTML = ""
    + "<span class='set-chip'>" + activeCount + " ativos</span>"
    + "<span class='set-chip'>" + inactiveCount + " inativos</span>"
    + "<span class='set-chip'>" + getCollectionModeLabel(currentMode) + "</span>";
}
function loadCollectionModeFromServer(){
  if(!loggedClient || !loggedClient.admin) return Promise.resolve(false);
  return fetch("/admin/site-settings", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "X-Token": authToken || "" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Nao foi possivel carregar o modo de colecao.");
    if(res.collectionMode){
      window.collectionMode = String(res.collectionMode || "personalizada").toLowerCase();
    }
    if(typeof res.showInactiveProducts !== "undefined"){
      window.showInactiveProducts = !!res.showInactiveProducts;
    }
    updateCollectionSummary();
    updateInactiveToggleButton();
    if(typeof refreshCatalogVisibility === "function") refreshCatalogVisibility();
    return true;
  })
  .catch(function(){ return false; });
}
function toggleInactiveProducts(){
  if(!loggedClient || !loggedClient.admin) return;
  var nextValue = window.showInactiveProducts === false ? true : false;
  fetch("/admin/site-settings", {
    method: "PUT",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type":"application/json", "X-Token": authToken || "" },
    body: JSON.stringify({ showInactiveProducts: nextValue })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Nao foi possivel guardar a visibilidade.");
    window.showInactiveProducts = !!res.showInactiveProducts;
    updateInactiveToggleButton();
    if(typeof refreshCatalogVisibility === "function") refreshCatalogVisibility();
    return true;
  })
  .catch(function(){ return false; });
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
  return fetch("/admin/email-config", {
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
  fetch("/admin/email-config", {
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
  var activeCats = dynamicCats.filter(function(cat){ return cat.active !== false; });
  var inactiveCats = dynamicCats.filter(function(cat){ return cat.active === false; });
  function renderCatGroup(title, cats, tone){
    return "<div class='cat-group " + tone + "'>" +
      "<div class='cat-group-head'><h5>" + escH(title) + "</h5><span>" + cats.length + " categoria" + (cats.length !== 1 ? "s" : "") + "</span></div>" +
      "<div class='cat-group-list'>" + cats.map(function(cat){
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
      }).join("") + "</div>" +
    "</div>";
  }
  listEl.innerHTML = renderCatGroup("Categorias ativas", activeCats, "tone-active")
    + renderCatGroup("Categorias desativadas", inactiveCats, "tone-off");
}
function persistCategoryOrder(order, successMsg){
  var ordem = Array.isArray(order) ? order.slice() : [];
  if(!ordem.length) return;
  setCategoryStatus("A guardar ordem das categorias...", "");
  fetch("/admin/categorias/ordem", {
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
  updateCollectionSummary();
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
  fetch("/admin/categorias", {
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
    fetch("/admin/categorias/" + encodeURIComponent(catId), {
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
  fetch("/admin/categorias/" + encodeURIComponent(catId), {
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
  fetch("/admin/categorias/" + encodeURIComponent(catId), {
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
          var url = "/admin/categorias" + (exists ? "/" + encodeURIComponent(cat.id) : "");
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
          return fetch("/admin/categorias/ordem", {
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
              var url = "/admin/produtos" + (exists ? "/" + encodeURIComponent(product.ref) : "");
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
    fetch("/admin/produtos/colecao", {
      method: "POST",
      headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
      body: JSON.stringify({ modo: mode })
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Nao foi possivel atualizar a colecao.");
      if(res.modo){
        window.collectionMode = res.modo;
      }
      closeAdminSettings();
      updateCollectionSummary();
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

function parseLocalDateValue(value){
  if(!value) return null;
  if(value instanceof Date && !isNaN(value.getTime())) return value;
  var str = String(value).trim();
  if(!str) return null;
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) str = str.replace(" ", "T");
  var d = new Date(str);
  if(isNaN(d.getTime())) return null;
  return d;
}

function formatDateTime(iso, fallbackDate, fallbackTime){
  var d = parseLocalDateValue(iso);
  if(d){
    return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit" });
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
    + "</div>";
}

function buildStatCard(label, value, hint, tone){
  return "<article class='stat-card" + (tone ? " " + tone : "") + "'>"
    + "<span>" + escH(label) + "</span>"
    + "<strong>" + escH(value) + "</strong>"
    + (hint ? "<small>" + escH(hint) + "</small>" : "")
    + "</article>";
}

function buildAdminIntro(title, subtitle, actionsHtml){
  return "<section class='admin-intro'>"
    + "<div class='admin-intro-copy'>"
      + "<div class='admin-kicker'>Gestão interna</div>"
      + "<h3>" + escH(title) + "</h3>"
      + "<p>" + escH(subtitle) + "</p>"
    + "</div>"
    + "<div class='admin-intro-actions'>" + (actionsHtml || "") + "</div>"
    + "</section>";
}

function sumOrderTotal(list){
  return (list || []).reduce(function(acc, order){
    return acc + Number(order.total || 0);
  }, 0);
}

function sumOrderUnits(list){
  return (list || []).reduce(function(acc, order){
    return acc + Number(order.units || 0);
  }, 0);
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
  var title = isAdminView ? escH(order.client || ("Encomenda #" + order.id)) : "Encomenda anterior";
  var subtitle = isAdminView
    ? ("#" + order.id + (order.email ? " &middot; " + escH(order.email) : ""))
    : ("NIF: " + escH(order.nif || "Sem NIF"));
  return "<article class='ord-card'>"
    + "<div class='ord-card-top'>"
      + "<div class='ord-card-identity'>"
        + "<div class='ord-title'>" + title + "</div>"
        + "<div class='ord-sub'>" + subtitle + "</div>"
        + "<div class='ord-chip-row'>"
          + "<span class='ord-chip'>" + escH(formatDateTime(order.createdAt, order.date, order.time)) + "</span>"
          + "<span class='ord-chip'>" + escH(order.units + " un.") + "</span>"
          + "<span class='ord-chip'>" + escH(order.lines + " linhas") + "</span>"
        + "</div>"
      + "</div>"
      + "<div class='ord-card-total'><small>Total</small>" + formatMoney(order.total) + "</div>"
    + "</div>"
    + "<div class='ord-actions'>" + actions.join("") + "</div>"
    + "</article>";
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
    + "<div class='ord-detail-head'><div><div class='ord-title'>" + (isAdminView ? escH(order.client || ("Encomenda #" + order.id)) : "Resumo da encomenda") + "</div><div class='ord-sub'>" + (isAdminView ? ("#" + order.id + " &middot; ") : "") + escH(formatDateTime(order.createdAt, order.date, order.time)) + "</div></div><div class='ord-total'><small>Total</small>" + formatMoney(order.total) + "</div></div>"
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
  var url = isAdminView ? ("/admin/encomendas/" + orderId) : ("/me/encomendas/" + orderId);
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
  return "<div class='user-orders-wrap'>"
    + buildAdminIntro(
        "As tuas encomendas",
        "Vê rapidamente o histórico, abre um detalhe ou volta a repetir um pedido antigo.",
        ""
      )
    + "<div class='area-section'>" + USER_ORDERS.map(function(order){
      return buildOrderCard(order, { admin:false });
    }).join("") + "</div>"
    + "</div>";
}

function buildClientsSection(){
  var search = (areaSearch || "").toLowerCase();
  var list = CLIENTS.filter(function(c){
    if(!search) return true;
    return [c.name, c.user, c.email, c.nif].join(" ").toLowerCase().indexOf(search) >= 0;
  });
  var total = CLIENTS.length;
  var active = CLIENTS.filter(function(c){ return c.ativo !== false; }).length;
  var admins = CLIENTS.filter(function(c){ return c.admin; }).length;
  var orderTotal = CLIENTS.reduce(function(acc, c){ return acc + Number(c.total_encomendas || 0); }, 0);
    return "<div class='admin-workspace'>"
      + buildAdminIntro(
        "Clientes",
        "Cria, edita e consulta clientes com uma vista mais limpa. O formulário abre num modal para não entupir a lista.",
        "<button class='abtn-new' id='abtn-new' type='button'>+ Novo Cliente</button>"
      )
    + "<div class='admin-kpis'>"
      + buildStatCard("Clientes", String(total), "Registos na base de dados", "tone-neutral")
      + buildStatCard("Ativos", String(active), "Com acesso à plataforma", "tone-soft")
      + buildStatCard("Admins", String(admins), "Contas com permissões", "tone-dark")
      + buildStatCard("Encomendas", String(orderTotal), "Total acumulado", "tone-gold")
    + "</div>"
    + "<section class='admin-panel-card admin-list-column'>"
      + "<div class='area-toolbar'>"
        + "<input class='area-search' id='area-search' type='search' placeholder='Pesquisar clientes por nome, utilizador, email ou NIF' value='" + escAttr(areaSearch) + "'>"
        + "<span class='ord-badge'>" + list.length + " resultado" + (list.length !== 1 ? "s" : "") + "</span>"
      + "</div>"
      + (list.length ? "<div class='client-grid'>" + list.map(function(c,i){
        var index = CLIENTS.indexOf(c);
        var lastLogin = formatDateTime(c.ultimo_login, "", "");
        return "<article class='cl-item'>"
          + "<div class='cl-avatar'>" + escH((c.name || c.user || "?").slice(0,1).toUpperCase()) + "</div>"
          + "<div class='cl-info'>"
            + "<div class='cl-name'>" + escH(c.name||c.user) + (c.admin ? " <span class='cl-badge'>ADMIN</span>" : "") + "</div>"
            + "<div class='cl-meta'>" + escH(c.user) + "</div>"
            + "<div class='cl-meta'>" + (c.nif ? "NIF " + escH(c.nif) : "Sem NIF") + (c.email ? " · " + escH(c.email) : "") + "</div>"
            + "<div class='cl-meta'><b>" + (c.total_encomendas || 0) + "</b> encomenda" + ((c.total_encomendas || 0)!==1 ? "s" : "") + " · " + escH(c.ativo !== false ? "Ativo" : "Inativo") + "</div>"
            + "<div class='cl-meta'><b>Último login:</b> " + escH(lastLogin || "Nunca") + "</div>"
          + "</div>"
          + "<div class='cl-item-actions'>"
            + "<button class='cl-edit' data-ei='" + index + "'>Editar</button>"
            + "<button class='cl-edit' data-client-orders='" + c.id + "'>Encomendas</button>"
            + (!c.admin ? "<button class='cl-del' data-di='" + index + "'>&#128465;</button>" : "")
          + "</div>"
        + "</article>";
      }).join("") + "</div>" : "<div class='area-empty'>Ainda não há clientes para mostrar.</div>")
    + "</section>"
    + "</div>";
}

function buildAdminOrdersSection(){
  var list = ADMIN_ORDERS.filter(function(order){
    if(filterClientId && order.clientId !== filterClientId) return false;
    if(!areaSearch) return true;
    var hay = [order.id, order.client, order.nif, order.email, order.date].join(" ").toLowerCase();
    return hay.indexOf(areaSearch.toLowerCase()) >= 0;
  });
  var activeClient = filterClientId ? CLIENTS.find(function(c){ return c.id === filterClientId; }) : null;
  var totalMoney = sumOrderTotal(list);
  var totalUnits = sumOrderUnits(list);
  var detailHtml = "";
  if(selectedOrderId){
    var match = ADMIN_ORDERS.find(function(order){ return order.id === selectedOrderId; });
    if(match){
      detailHtml = "<div class='ord-detail-box'><strong>Encomenda selecionada</strong>Clica em <b>Ver detalhe</b> para abrir toda a informação da encomenda #" + match.id + ".</div>";
    }
  }
  return "<div class='admin-workspace'>"
    + buildAdminIntro(
        "Encomendas",
        "Consulta, filtra e abre encomendas com uma vista mais limpa. Mantivemos tudo rápido, mas com menos ruído visual.",
        activeClient ? "<span class='ord-badge'>Cliente ativo: " + escH(activeClient.name || activeClient.user) + "</span>" : ""
      )
    + "<div class='admin-kpis'>"
      + buildStatCard("Encomendas", String(list.length), "Visíveis no filtro atual", "tone-neutral")
      + buildStatCard("Unidades", String(totalUnits), "Quantidade total", "tone-soft")
      + buildStatCard("Total", formatMoney(totalMoney), "Valor acumulado", "tone-gold")
      + buildStatCard("Clientes", String(CLIENTS.length), "Base de clientes", "tone-dark")
    + "</div>"
    + "<div class='admin-panel-card'>"
      + "<div class='area-toolbar'>"
        + "<input class='area-search' id='area-search' type='search' placeholder='Pesquisar encomendas por cliente, NIF ou email' value='" + escAttr(areaSearch) + "'>"
        + "<span class='ord-badge'>" + list.length + " resultado" + (list.length !== 1 ? "s" : "") + "</span>"
      + "</div>"
      + detailHtml
      + (list.length ? "<div class='area-section'>" + list.map(function(order){ return buildOrderCard(order, { admin:true }); }).join("") + "</div>" : "<div class='area-empty'>Nao encontramos encomendas com esse filtro.</div>")
    + "</div>"
    + "</div>";
}

function buildAdminExtraSection(){
  if(areaTab === "clientes") return buildClientsSection();
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
  fetch("/me/encomendas", {
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
  fetch("/admin/clientes", {
    headers: {"X-Token": authToken||""}
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.clientes)) throw new Error(res.message||"Erro ao carregar clientes");
    CLIENTS = res.clientes.map(function(c){
      return {user:c.user,pass:c.pass,name:c.nome,nif:c.nif,admin:!!c.admin,id:c.id,
              ativo:c.activo !== false,email:c.email||'',telefone:c.telefone||'',
              total_encomendas:c.total_encomendas||0,ultimo_login:c.ultimo_login||null};
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
    fetch("/admin/encomendas", {
      headers: { "X-Token": authToken||"" }
    }).then(function(r){ return r.json(); }),
    fetch("/admin/clientes", {
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
                total_encomendas:c.total_encomendas||0,ultimo_login:c.ultimo_login||null};
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

function deleteAdminOrder(orderId){
  askConfirm({
    title: "Eliminar encomenda",
    text: "Tens a certeza que queres eliminar esta encomenda? Esta ação não pode ser anulada.",
    confirmText: "Eliminar",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    fetch("/admin/encomendas/" + orderId, {
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
    var cor = normalizeChoiceText(item.cor);
    var tam = normalizeChoiceText(item.tam);
    return {
      key: cartItemKey(item.ref, cor, tam),
      ref: item.ref,
      name: item.name,
      type: item.type || prod.type || "",
      cor: cor,
      tam: tam,
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      img: prod.img || IMGS[item.ref] || ""
    };
  });
  renderCart();
  cart.forEach(function(item){ updateBadge(item.ref); });
  if(typeof saveCartState === "function") saveCartState();
  closeAdmin();
  openCartPanel();
}

function repeatOrder(orderId){
  fetch("/me/encomendas/" + orderId + "/reencomendar", {
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
  var url = "/encomendas/" + orderId + "/pdf" + (mode === "sem_precos" ? "?mode=sem_precos" : "");
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
    a.download = "encomenda_" + orderId + suffix + ".pdf";
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
      openClientModal(parseInt(editClientBtn.getAttribute("data-ei"), 10));
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
      openClientModal(-2);
      return;
    }
    if(e.target && e.target.id === "afrm-cancel"){
      closeClientModal();
      return;
    }
    if(e.target && e.target.id === "afrm-save"){
      e.preventDefault();
      saveClientForm();
      return;
    }
    if(e.target && e.target.id === "client-modal-close"){
      closeClientModal();
      return;
    }
    if(e.target && e.target.id === "client-modal-bg"){
      closeClientModal();
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

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      closeClientModal();
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
