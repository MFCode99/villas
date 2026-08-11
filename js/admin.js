// â”€â”€ ADMIN PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openAdmin(){
  if(!loggedClient) return;
  if(isDeveloper()){
    closeCartPanel();
    closeNotifications();
    loadDeveloperDashboard();
    return;
  }
  closeCartPanel();
  closeNotifications();
  editingIdx = -1;
  if(loggedClient.admin){
    if(["clientes","encomendas"].indexOf(areaTab) < 0) areaTab = "encomendas";
  } else {
    areaTab = "minhas-encomendas";
  }
  renderAdminPanel();
  document.getElementById("apanel").classList.add("on");
  document.getElementById("ov").classList.add("on");
}
function closeAdmin(){
  document.getElementById("apanel").classList.remove("on");
  if(!document.getElementById("panel").classList.contains("on") && !document.getElementById("notif-panel").classList.contains("on")){
    document.getElementById("ov").classList.remove("on");
  }
}

var adminUiBound = false;
function initAdminUiBindings(){
  if(adminUiBound) return;
  adminUiBound = true;
  var adminBtn = document.getElementById("admin-btn");
  var newProdBtn = document.getElementById("new-prod-btn");
  var adminSettingsBtn = document.getElementById("admin-settings-btn");
  var closeAdminBtn = document.getElementById("aph-x");
  var logoutBtn = document.getElementById("logout-btn");
  var notifBtn = document.getElementById("notif-btn");
  var notifClose = document.getElementById("notif-close");
  var settingsBg = document.getElementById("settings-bg");
  var settingsClose = document.getElementById("settings-close");
  var settingsSummer = document.getElementById("settings-summer");
  var settingsWinter = document.getElementById("settings-winter");
  var settingsAll = document.getElementById("settings-all");
  var categoryCreate = document.getElementById("category-create");
  var categoryName = document.getElementById("category-name");
  var categoryList = document.getElementById("category-list");
  var settingsExport = document.getElementById("settings-export");
  var settingsImport = document.getElementById("settings-import");
  var settingsImportFile = document.getElementById("settings-import-file");
  var peditCancel = document.getElementById("pedit-cancel");
  var peditBg = document.getElementById("pedit-bg");
  var peditImg = document.getElementById("pedit-img");
  var peditFile = document.getElementById("pedit-img-file");
  var peditCat = document.getElementById("pedit-cat");
  var peditSave = document.getElementById("pedit-save");
  var peditReset = document.getElementById("pedit-reset");
  var peditDuplicate = document.getElementById("pedit-duplicate");
  var peditDelete = document.getElementById("pedit-delete");
  var devSave = document.getElementById("dev-note-save");
  var devOpen = document.getElementById("dev-open-dashboard");
  var devRefresh = document.getElementById("dev-refresh-all");
  var devClearSessions = document.getElementById("dev-clear-sessions");
  var devNotesList = document.getElementById("dev-notes-list");
  var devOrdersList = document.getElementById("dev-orders-list");

  if(adminBtn) adminBtn.addEventListener("click", openAdmin);
  if(newProdBtn) newProdBtn.addEventListener("click", openNewProduct);
  if(adminSettingsBtn) adminSettingsBtn.addEventListener("click", openAdminSettings);
  if(closeAdminBtn) closeAdminBtn.addEventListener("click", closeAdmin);
  if(logoutBtn) logoutBtn.addEventListener("click", doLogout);
  if(notifBtn) notifBtn.addEventListener("click", openNotifications);
  if(notifClose) notifClose.addEventListener("click", closeNotifications);
  if(settingsClose) settingsClose.addEventListener("click", closeAdminSettings);
  if(settingsBg) settingsBg.addEventListener("click", function(e){
    if(e.target===this) closeAdminSettings();
  });
  if(settingsSummer) settingsSummer.addEventListener("click", function(){ applyCollectionMode("verao"); });
  if(settingsWinter) settingsWinter.addEventListener("click", function(){ applyCollectionMode("inverno"); });
  if(settingsAll) settingsAll.addEventListener("click", function(){ applyCollectionMode("todos"); });
  if(categoryCreate) categoryCreate.addEventListener("click", createCategoryFromSettings);
  if(settingsExport) settingsExport.addEventListener("click", exportCatalogData);
  if(settingsImport) settingsImport.addEventListener("click", function(){
    if(settingsImportFile) settingsImportFile.click();
  });
  if(settingsImportFile) settingsImportFile.addEventListener("change", function(){
    var file = this.files && this.files[0];
    if(file) importCatalogData(file);
    this.value = "";
  });
  if(categoryName) categoryName.addEventListener("keydown", function(e){
    if(e.key === "Enter"){
      e.preventDefault();
      createCategoryFromSettings();
    }
  });
  if(categoryList) categoryList.addEventListener("click", function(e){
    var moveBtn = e.target.closest("[data-cat-move]");
    if(moveBtn){
      moveCategoryInSettings(moveBtn.getAttribute("data-cat-move"), moveBtn.getAttribute("data-cat-dir"));
      return;
    }
    var editBtn = e.target.closest("[data-cat-edit]");
    if(editBtn){
      editCategoryFromSettings(editBtn.getAttribute("data-cat-edit"));
      return;
    }
    var toggleBtn = e.target.closest("[data-cat-toggle]");
    if(toggleBtn){
      toggleCategoryFromSettings(toggleBtn.getAttribute("data-cat-toggle"), toggleBtn.getAttribute("data-next-active"));
      return;
    }
    var deleteBtn = e.target.closest("[data-cat-delete]");
    if(!deleteBtn) return;
    deleteCategoryFromSettings(deleteBtn.getAttribute("data-cat-delete"));
  });
  if(peditCancel) peditCancel.addEventListener("click", function(){
    document.getElementById("pedit-bg").classList.remove("on");
  });
  if(peditBg) peditBg.addEventListener("click", function(e){
    if(e.target===this) this.classList.remove("on");
  });
  if(peditImg) peditImg.addEventListener("input", function(){
    var v = this.value.trim();
    document.getElementById("pedit-img-preview").src = v || (IMGS[editingRef]||"");
  });
  if(peditFile) peditFile.addEventListener("change", function(){
    var file = this.files && this.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      var dataUrl = ev.target && ev.target.result ? ev.target.result : "";
      document.getElementById("pedit-img").value = dataUrl;
      document.getElementById("pedit-img-preview").src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  if(devSave) devSave.addEventListener("click", saveDeveloperNote);
  if(devOpen) devOpen.addEventListener("click", openDeveloperDashboard);
  if(devRefresh) devRefresh.addEventListener("click", function(){
    setDevStatus("", "");
    if(isDeveloper()) loadDeveloperDashboard();
    if(loggedClient && loggedClient.admin && !loggedClient.developer) loadAdminNotifications();
  });
  if(devClearSessions) devClearSessions.addEventListener("click", clearAllSessionsFromDev);
  if(devNotesList) devNotesList.addEventListener("click", function(e){
    var toggle = e.target.closest("[data-dev-note-toggle]");
    if(toggle){
      toggleDeveloperNote(parseInt(toggle.getAttribute("data-dev-note-toggle"), 10), toggle.getAttribute("data-dev-note-active") === "1");
      return;
    }
    var del = e.target.closest("[data-dev-note-delete]");
    if(del){
      deleteDeveloperNote(parseInt(del.getAttribute("data-dev-note-delete"), 10));
    }
  });
  if(devOrdersList) devOrdersList.addEventListener("click", function(e){
    var open = e.target.closest("[data-dev-order-open]");
    if(!open) return;
    var orderId = parseInt(open.getAttribute("data-dev-order-open"), 10);
    if(orderId) downloadOrderPdf(orderId, "normal");
  });
  if(peditCat) peditCat.innerHTML = buildCategoryOptions(activeCat);
  if(peditSave) peditSave.addEventListener("click", saveProductEdit);
  if(peditReset) peditReset.addEventListener("click", resetProductEdit);
  if(peditDuplicate) peditDuplicate.addEventListener("click", duplicateProductEdit);
  if(peditDelete) peditDelete.addEventListener("click", deleteProductEdit);
}

function renderAdminPanel_unused_legacy(){
  var body = document.getElementById("abody");
  body.innerHTML = "<div style='text-align:center;padding:30px;color:var(--muted)'>A carregar...</div>";
  var controller = new AbortController();
  var timeout = setTimeout(function(){ controller.abort(); }, 5000);
  fetch(BASE_URL+"/admin/clientes", {
    headers: {"X-Token": authToken||""},
    signal: controller.signal
  })
  .then(function(r){ clearTimeout(timeout); return r.json(); })
  .then(function(res){
    if(!res.ok || !Array.isArray(res.clientes)) throw new Error(res.message||"Erro ao carregar clientes");
    CLIENTS = res.clientes.map(function(c){
      return {user:c.user,pass:c.pass,name:c.nome,nif:c.nif,admin:!!c.admin,id:c.id,
              ativo:c.ativo,email:c.email||'',telefone:c.telefone||'',
              total_encomendas:c.total_encomendas||0};
    });
    _renderAdminList();
  })
  .catch(function(){
    clearTimeout(timeout);
    body.innerHTML = "<div style='text-align:center;padding:30px;color:var(--danger)'>Nao foi possivel carregar os clientes.</div>";
  });
}
function _renderAdminList(){ _renderAdminPanel_unused(); }
function _renderAdminPanel_unused(){
  var body = document.getElementById("abody");
  var formHtml = editingIdx >= 0 ? renderForm(CLIENTS[editingIdx]) : renderForm(null);
  var listHtml = "<div style='margin-bottom:6px;'>" +
    CLIENTS.map(function(c,i){
      return "<div class='cl-item'>" +
        "<div class='cl-info'>" +
          "<div class='cl-name'>" + escH(c.name||c.user) +
            (c.admin ? " <span class='cl-badge'>ADMIN</span>" : "") + "</div>" +
          "<div class='cl-meta'>&#128100; " + escH(c.user) +
            (c.nif ? " &nbsp;&#183;&nbsp; NIF: " + escH(c.nif) : "") + "</div>" +
        "</div>" +
        "<button class='cl-edit' data-ei='"+i+"'>Editar</button>" +
        (!c.admin ? "<button class='cl-del' data-di='"+i+"'>&#128465;</button>" : "") +
      "</div>";
    }).join("") + "</div>" +
    (editingIdx < 0 ? "<button class='abtn-new' id='abtn-new'>+ Novo Cliente</button>" : "");

  body.innerHTML = formHtml + listHtml;

  // form events
  if(document.getElementById("afrm")){
    document.getElementById("afrm-save").addEventListener("click", function(e){
      e.preventDefault();
      saveClientForm();
    });
    document.getElementById("afrm-cancel").addEventListener("click", function(){
      editingIdx = -1; _renderAdminList();
    });
  }
  if(document.getElementById("abtn-new")){
    document.getElementById("abtn-new").addEventListener("click", function(){
      editingIdx = -2; _renderAdminList();
    });
  }

  // list events
  body.querySelectorAll(".cl-edit").forEach(function(btn){
    btn.addEventListener("click", function(){
      editingIdx = parseInt(this.dataset.ei);
      _renderAdminList();
    });
  });
  body.querySelectorAll(".cl-del").forEach(function(btn){
    btn.addEventListener("click", function(){
      var i = parseInt(this.dataset.di);
      var c = CLIENTS[i];
      askConfirm({
        title: "Apagar cliente",
        message: "Tens a certeza que queres apagar o cliente \"" + c.name + "\"?",
        confirmLabel: "Apagar",
        danger: true
      }).then(function(ok){
        if(ok) deleteClient(c, i);
      });
    });
  });
}

function renderForm(c){
  if(editingIdx === -1) return ""; // no form
  var isNew = editingIdx === -2;
  return "<div class='aform' id='afrm'>" +
    "<h3>" + (isNew ? "Novo Cliente" : "Editar Cliente") + "</h3>" +
    "<div class='aform-grid'>" +
      "<div>" +
        "<label class='afl'>Nome completo</label>" +
        "<input class='afi' id='af-name' type='text' value='" + escAttr(c?c.name:"") + "' placeholder='Ex: Loja ABC Lda'>" +
      "</div>" +
      "<div>" +
        "<label class='afl'>NIF / Empresa</label>" +
        "<input class='afi' id='af-nif' type='text' value='" + escAttr(c?c.nif:"") + "' placeholder='Ex: 509 000 000'>" +
      "</div>" +
      "<div>" +
        "<label class='afl'>Utilizador</label>" +
        "<input class='afi' id='af-user' type='text' value='" + escAttr(c?c.user:"") + "' placeholder='Ex: lojaabc' " + (c&&c.admin?"readonly style='opacity:.5'":"") + ">" +
      "</div>" +
      "<div>" +
        "<label class='afl'>Password</label>" +
        "<input class='afi' id='af-pass' type='text' value='" + escAttr(c?c.pass:"") + "' placeholder='Ex: abc2026'>" +
      "</div>" +
      "<div>" +
        "<label class='afl'>Email</label>" +
        "<input class='afi' id='af-email' type='email' value='" + escAttr(c?c.email:"") + "' placeholder='cliente@email.com'>" +
      "</div>" +
      "<div>" +
        "<label class='afl'>Telefone</label>" +
        "<input class='afi' id='af-phone' type='text' value='" + escAttr(c?c.telefone:"") + "' placeholder='+351 ...'>" +
      "</div>" +
    "</div>" +
    "<div class='aform-err' id='af-err'></div>" +
    "<div class='aform-btns'>" +
      "<button class='abtn-cancel' id='afrm-cancel'>Cancelar</button>" +
      "<button class='abtn-save' id='afrm-save'>&#10003; Guardar</button>" +
    "</div>" +
  "</div>";
}

function saveClientForm(){
  var name = document.getElementById("af-name").value.trim();
  var nif  = document.getElementById("af-nif").value.trim();
  var user = document.getElementById("af-user").value.trim().toLowerCase();
  var pass = document.getElementById("af-pass").value.trim();
  var email = document.getElementById("af-email").value.trim();
  var telefone = document.getElementById("af-phone").value.trim();

  if(!name){ showAfErr("Preenche o nome do cliente."); return; }
  if(!user){ showAfErr("Preenche o utilizador."); return; }
  if(!pass){ showAfErr("Preenche a password."); return; }

  var isDup = CLIENTS.some(function(c,i){
    return c.user.toLowerCase()===user && i!==editingIdx;
  });
  if(isDup){ showAfErr("Esse utilizador ja existe. Escolhe outro."); return; }

  var payload = {
    user: user,
    pass: pass,
    nome: name,
    nif: nif,
    email: email,
    telefone: telefone
  };

  if(editingIdx === -2){
    fetch(BASE_URL+"/admin/clientes", {
      method: "POST",
      headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
      body: JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Erro ao criar cliente");
      editingIdx = -1;
      renderAdminPanel();
    })
    .catch(function(err){
      showAfErr(err.message||"Nao foi possivel guardar o cliente.");
    });
    return;
  }

  var current = CLIENTS[editingIdx];
  if(!current || !current.id){
    showAfErr("Cliente invalido.");
    return;
  }

  fetch(BASE_URL+"/admin/clientes/"+current.id, {
    method: "PUT",
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({
      pass: pass,
      nome: name,
      nif: nif,
      email: email,
      telefone: telefone,
      activo: current.ativo !== false
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Erro ao editar cliente");
    editingIdx = -1;
    renderAdminPanel();
  })
  .catch(function(err){
    showAfErr(err.message||"Nao foi possivel editar o cliente.");
  });
}

function deleteClient(c, index){
  if(!c || !c.id){
    alert("Cliente invalido.");
    return;
  }
  fetch(BASE_URL+"/admin/clientes/"+c.id, {
    method: "DELETE",
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Erro ao apagar cliente");
    editingIdx = -1;
    renderAdminPanel();
  })
  .catch(function(err){
    alert(err.message||"Nao foi possivel apagar o cliente.");
  });
}

function showAfErr(msg){
  var el = document.getElementById("af-err");
  if(el){ el.textContent=msg; el.classList.add("on"); }
}

function escH(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escAttr(s){ return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }

// â”€â”€ PRODUCT OVERRIDES (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var editingRef = null;
function buildCategoryOptions(selectedCat){
  return CATS.map(function(c){
    return "<option value='" + escAttr(c.id) + "'" + (c.id===selectedCat?" selected":"") + ">" + escH(c.label) + "</option>";
  }).join("");
}
function productDiffersFromBase(ref, payload){
  var base = BASE_PRODUCTS[ref];
  if(!base) return true;
  var baseImg = BASE_IMGS[ref] || "";
  var payloadActivo = payload.activo != null ? payload.activo : payload.active;
  var payloadEstacao = payload.estacao || payload.season || "ambos";
  return (
    base.ref !== payload.ref ||
    base.name !== payload.nome ||
    (base.type||"") !== (payload.tipo||"") ||
    base.cat !== payload.cat ||
    Number(base.price||0) !== Number(payload.preco||0) ||
    Number(base.pvp||0) !== Number(payload.pvp||0) ||
    inferQtyStep(base) !== inferQtyStep(payload) ||
    !!base.active !== !!payloadActivo ||
    (base.season || "ambos") !== payloadEstacao ||
    JSON.stringify(base.cores||[]) !== JSON.stringify(payload.cores||[]) ||
    JSON.stringify(base.tams||[]) !== JSON.stringify(payload.tams||[]) ||
    baseImg !== (payload.imagem||"")
  );
}
function fillProductForm(prod, img, showModified){
  var resetBtn = document.getElementById("pedit-reset");
  var deleteBtn = document.getElementById("pedit-delete");
  document.getElementById("pedit-img-preview").src = img || "";
  document.getElementById("pedit-img").value = img || "";
  document.getElementById("pedit-ref").value = prod.ref || "";
  document.getElementById("pedit-name").value = prod.name || "";
  document.getElementById("pedit-type").value = prod.type || "";
  document.getElementById("pedit-cat").value = prod.cat || activeCat;
  document.getElementById("pedit-price").value = prod.price != null ? prod.price : "";
  document.getElementById("pedit-pvp").value = prod.pvp != null ? prod.pvp : "";
  document.getElementById("pedit-step").value = inferQtyStep(prod);
  document.getElementById("pedit-active").value = prod.active === false ? "0" : "1";
  document.getElementById("pedit-season").value = prod.season || "ambos";
  document.getElementById("pedit-cores").value = (prod.cores||[]).join(", ");
  document.getElementById("pedit-tams").value = (prod.tams||[]).join(", ");
  document.getElementById("pedit-modified").style.display = showModified ? "inline-block" : "none";
  if(deleteBtn) deleteBtn.style.display = editingRef === "__new__" ? "none" : "";
  if(resetBtn){
    if(editingRef === "__new__") resetBtn.textContent = "Limpar";
    else if(BASE_PRODUCTS[editingRef]) resetBtn.textContent = "↻ Repor Original";
    else resetBtn.textContent = "↻ Repor Guardado";
  }
}
function openProductEdit(ref){
  var p = PRODS[ref]; if(!p) return;
  editingRef = ref;
  var payload = {
    ref: p.ref,
    nome: p.name,
    tipo: p.type || "",
    cat: p.cat || activeCat,
    preco: p.price,
    pvp: p.pvp == null ? null : p.pvp,
    qtd_step: inferQtyStep(p),
    active: p.active !== false,
    season: p.season || "ambos",
    cores: Array.isArray(p.cores) ? p.cores.slice() : [],
    tams: Array.isArray(p.tams) ? p.tams.slice() : [],
    imagem: IMGS[ref] || ""
  };
  fillProductForm(p, payload.imagem, productDiffersFromBase(ref, payload));
  document.getElementById("pedit-bg").classList.add("on");
}
function openNewProduct(){
  if(!loggedClient || !loggedClient.admin) return;
  editingRef = "__new__";
  fillProductForm({ ref:"", name:"", type:"", cat:activeCat, price:"", pvp:"", qtdStep:12, active:true, season:"ambos", cores:[], tams:[] }, "", false);
  document.getElementById("pedit-bg").classList.add("on");
}
function buildProductPayload(){
  var pvpRaw = document.getElementById("pedit-pvp").value.trim();
  return {
    ref: document.getElementById("pedit-ref").value.trim(),
    nome: document.getElementById("pedit-name").value.trim(),
    tipo: document.getElementById("pedit-type").value.trim() || "Artigo",
    cat: document.getElementById("pedit-cat").value,
    preco: parseFloat(document.getElementById("pedit-price").value),
    pvp: pvpRaw === "" ? null : parseFloat(pvpRaw),
    qtd_step: parseInt(document.getElementById("pedit-step").value, 10),
    activo: document.getElementById("pedit-active").value === "1",
    estacao: document.getElementById("pedit-season").value || "ambos",
    cores: document.getElementById("pedit-cores").value.split(",").map(function(s){ return s.trim(); }).filter(Boolean),
    tams: document.getElementById("pedit-tams").value.split(",").map(function(s){ return s.trim(); }).filter(Boolean),
    imagem: document.getElementById("pedit-img").value.trim() || null
  };
}
function saveProductEdit(){
  if(!editingRef) return;
  var isNewProduct = editingRef === "__new__";
  var payload = buildProductPayload();

  if(!payload.ref){ alert("Referencia obrigatoria."); return; }
  if(isNewProduct && PRODS[payload.ref]){ alert("Essa referencia ja existe."); return; }
  if(!isNewProduct && payload.ref !== editingRef && PRODS[payload.ref]){ alert("Essa referencia ja existe."); return; }
  if(!payload.nome){ alert("Nome obrigatorio."); return; }
  if(!payload.cat || !CAT_ITEMS[payload.cat]){ alert("Categoria invalida."); return; }
  if(!isFinite(payload.preco) || payload.preco <= 0){ alert("Preco invalido."); return; }
  if(payload.pvp != null && !isFinite(payload.pvp)){ alert("PVP invalido."); return; }
  if(!payload.qtd_step || payload.qtd_step < 1){ alert("Incremento invalido."); return; }
  if(!payload.cores.length){ alert("Indica pelo menos uma cor."); return; }
  if(!payload.tams.length){ alert("Indica pelo menos um tamanho."); return; }

  var url = BASE_URL + "/admin/produtos" + (isNewProduct ? "" : "/" + encodeURIComponent(editingRef));
  var method = isNewProduct ? "POST" : "PUT";
  fetch(url, {
    method: method,
    headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify(payload)
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message||"Nao foi possivel guardar o produto.");
    document.getElementById("pedit-bg").classList.remove("on");
    location.reload();
  })
  .catch(function(err){
    alert(err.message||"Nao foi possivel guardar o produto.");
  });
}
function duplicateProductEdit(){
  if(!editingRef || editingRef === "__new__") return;
  var payload = buildProductPayload();
  payload.ref = "";
  fillProductForm({
    ref: "",
    name: payload.nome,
    type: payload.tipo,
    cat: payload.cat,
    price: payload.preco,
    pvp: payload.pvp,
    qtdStep: payload.qtd_step,
    active: payload.activo,
    season: payload.estacao,
    cores: payload.cores.slice(),
    tams: payload.tams.slice()
  }, payload.imagem || "", false);
  editingRef = "__new__";
  var deleteBtn = document.getElementById("pedit-delete");
  if(deleteBtn) deleteBtn.style.display = "none";
}
function deleteProductEdit(){
  if(!editingRef || editingRef === "__new__") {
    document.getElementById("pedit-bg").classList.remove("on");
    return;
  }
  askConfirm({
    title: "Apagar produto",
    message: "Tens a certeza que queres apagar este produto?",
    confirmLabel: "Apagar",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    fetch(BASE_URL + "/admin/produtos/" + encodeURIComponent(editingRef), {
      method: "DELETE",
      headers: { "X-Token": authToken||"" }
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Nao foi possivel apagar o produto.");
      document.getElementById("pedit-bg").classList.remove("on");
      location.reload();
    })
    .catch(function(err){
      alert(err.message||"Nao foi possivel apagar o produto.");
    });
  });
}

function resetProductEdit(){
  if(!editingRef) return;
  if(editingRef === "__new__"){
    fillProductForm({ ref:"", name:"", type:"", cat:activeCat, price:"", pvp:"", qtdStep:12, active:true, season:"ambos", cores:[], tams:[] }, "", false);
    return;
  }
  var base = BASE_PRODUCTS[editingRef];
  if(!base){
    var saved = PRODS[editingRef];
    if(!saved) return;
    fillProductForm({
      ref: saved.ref,
      name: saved.name,
      type: saved.type || "",
      cat: saved.cat || activeCat,
      price: saved.price,
      pvp: saved.pvp == null ? null : saved.pvp,
      qtdStep: inferQtyStep(saved),
      active: saved.active !== false,
      season: saved.season || "ambos",
      cores: Array.isArray(saved.cores) ? saved.cores.slice() : [],
      tams: Array.isArray(saved.tams) ? saved.tams.slice() : []
    }, IMGS[editingRef] || "", false);
    return;
  }
  askConfirm({
    title: "Repor produto",
    message: "Queres repor os valores originais deste produto?",
    confirmLabel: "Repor"
  }).then(function(ok){
    if(!ok) return;
    fetch(BASE_URL + "/admin/produtos/" + encodeURIComponent(editingRef), {
      method: "PUT",
      headers: { "Content-Type":"application/json", "X-Token": authToken||"" },
      body: JSON.stringify({
        ref: base.ref,
        nome: base.name,
        tipo: base.type || "",
        cat: base.cat,
        preco: base.price,
        pvp: base.pvp == null ? null : base.pvp,
        qtd_step: inferQtyStep(base),
        cores: Array.isArray(base.cores) ? base.cores.slice() : [],
        tams: Array.isArray(base.tams) ? base.tams.slice() : [],
        imagem: BASE_IMGS[editingRef] || null,
        activo: true,
        estacao: BASE_PRODUCTS[editingRef].season || "ambos"
      })
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message||"Nao foi possivel repor o produto.");
      document.getElementById("pedit-bg").classList.remove("on");
      location.reload();
    })
    .catch(function(err){
      alert(err.message||"Nao foi possivel repor o produto.");
    });
  });
}
// Show edit buttons when admin logs in
function enableAdminProductEdit(){
  document.body.classList.add("admin-mode");
}

var lastTouchEndAt = 0;
document.addEventListener("touchend", function(e){
  var target = e.target;
  var isField = target && (target.closest("input, textarea, select, label") || target.isContentEditable);
  if(isField) return;
  var now = Date.now();
  if(now - lastTouchEndAt < 320){
    e.preventDefault();
  }
  lastTouchEndAt = now;
}, { passive:false });

document.addEventListener("dblclick", function(e){
  var target = e.target;
  var isField = target && (target.closest("input, textarea, select") || target.isContentEditable);
  if(isField) return;
  e.preventDefault();
}, { passive:false });

