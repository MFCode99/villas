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

function setProductImageState(src, message, kind){
  var preview = document.getElementById("pedit-img-preview");
  var card = document.getElementById("pedit-image-card");
  var status = document.getElementById("pedit-image-status");
  if(preview) preview.src = src || "";
  if(card) card.classList.toggle("has-image", !!src);
  if(status){
    status.textContent = message || "";
    status.className = "pedit-image-status" + (kind ? " " + kind : "");
  }
}

function formatBytes(bytes){
  var n = Number(bytes || 0);
  if(n < 1024) return n + " B";
  if(n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}

function processProductImageFile(file){
  if(!file || !file.type || file.type.indexOf("image/") !== 0) {
    setProductImageState("", "Escolhe um ficheiro de imagem válido.", "err");
    return;
  }
  setProductImageState("", "A preparar imagem...", "");
  var reader = new FileReader();
  reader.onerror = function(){
    setProductImageState("", "Não foi possível ler a imagem.", "err");
  };
  reader.onload = function(ev){
    var img = new Image();
    img.onerror = function(){
      setProductImageState("", "Formato de imagem não suportado.", "err");
    };
    img.onload = function(){
      var maxSide = 1600;
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var width = Math.max(1, Math.round(img.width * scale));
      var height = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      var dataUrl = canvas.toDataURL("image/jpeg", 0.86);
      var input = document.getElementById("pedit-img");
      if(input) input.value = dataUrl;
      setProductImageState(
        dataUrl,
        "Imagem otimizada: " + width + "×" + height + " · " + formatBytes(Math.round(dataUrl.length * 0.75)),
        "ok"
      );
    };
    img.src = ev.target && ev.target.result ? ev.target.result : "";
  };
  reader.readAsDataURL(file);
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
  var settingsTabs = document.querySelectorAll("[data-set-tab]");
  var settingsSummer = document.getElementById("settings-summer");
  var settingsWinter = document.getElementById("settings-winter");
  var settingsAll = document.getElementById("settings-all");
  var settingsToggleInactive = document.getElementById("settings-toggle-inactive");
  var categoryCreate = document.getElementById("category-create");
  var categoryName = document.getElementById("category-name");
  var categoryList = document.getElementById("category-list");
  var settingsExport = document.getElementById("settings-export");
  var settingsImport = document.getElementById("settings-import");
  var settingsImportFile = document.getElementById("settings-import-file");
  var smtpHelp = document.getElementById("smtp-help");
  var smtpSave = document.getElementById("smtp-save");
  var smtpFrom = document.getElementById("smtp-email-from");
  var smtpTo = document.getElementById("smtp-email-to");
  var smtpPass = document.getElementById("smtp-email-pass");
  var peditCancel = document.getElementById("pedit-cancel");
  var peditHeadClose = document.getElementById("pedit-head-close");
  var peditBg = document.getElementById("pedit-bg");
  var peditBox = peditBg ? peditBg.querySelector(".pedit-box") : null;
  var peditImg = document.getElementById("pedit-img");
  var peditFile = document.getElementById("pedit-img-file");
  var peditImageCard = document.getElementById("pedit-image-card");
  var peditImgUrlToggle = document.getElementById("pedit-img-url-toggle");
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
  var overlay = document.getElementById("ov");

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
  settingsTabs.forEach(function(tabBtn){
    tabBtn.addEventListener("click", function(){
      if(typeof setSettingsTab === "function") setSettingsTab(this.getAttribute("data-set-tab") || "collection");
    });
  });
  if(settingsSummer) settingsSummer.addEventListener("click", function(){ applyCollectionMode("verao"); });
  if(settingsWinter) settingsWinter.addEventListener("click", function(){ applyCollectionMode("inverno"); });
  if(settingsAll) settingsAll.addEventListener("click", function(){ applyCollectionMode("todos"); });
  if(settingsToggleInactive) settingsToggleInactive.addEventListener("click", function(){
    if(typeof toggleInactiveProducts === "function") toggleInactiveProducts();
  });
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
  if(smtpHelp && typeof openSmtpHelp === "function") smtpHelp.addEventListener("click", openSmtpHelp);
  if(smtpSave && typeof saveAdminEmailSettings === "function") smtpSave.addEventListener("click", saveAdminEmailSettings);
  [smtpFrom, smtpTo, smtpPass].forEach(function(field){
    if(!field) return;
    field.addEventListener("keydown", function(e){
      if(e.key === "Enter"){
        e.preventDefault();
        saveAdminEmailSettings();
      }
    });
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
  if(peditCancel) peditCancel.addEventListener("click", function(){ closeProductEditor(); });
  if(peditHeadClose) peditHeadClose.addEventListener("click", function(){ closeProductEditor(); });
  if(peditBg) peditBg.addEventListener("click", function(e){
    if(e.target===this) closeProductEditor();
  });
  if(peditBox) peditBox.addEventListener("click", function(e){
    e.stopPropagation();
  });
  if(peditImg) peditImg.addEventListener("input", function(){
    var v = this.value.trim();
    document.getElementById("pedit-img-preview").src = v || (IMGS[editingRef]||"");
    setProductImageState(v || (IMGS[editingRef]||""), v ? "Imagem definida por URL." : "");
  });
  if(peditImgUrlToggle) peditImgUrlToggle.addEventListener("click", function(){
    var wrap = document.getElementById("pedit-img-url-wrap");
    if(!wrap) return;
    wrap.classList.toggle("on");
    if(wrap.classList.contains("on") && peditImg) peditImg.focus();
  });
  if(peditFile) peditFile.addEventListener("change", function(){
    var file = this.files && this.files[0];
    if(!file) return;
    processProductImageFile(file);
  });
  if(peditImageCard){
    ["dragenter", "dragover"].forEach(function(evtName){
      peditImageCard.addEventListener(evtName, function(e){
        e.preventDefault();
        peditImageCard.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach(function(evtName){
      peditImageCard.addEventListener(evtName, function(e){
        e.preventDefault();
        peditImageCard.classList.remove("is-drag");
      });
    });
    peditImageCard.addEventListener("drop", function(e){
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(file) processProductImageFile(file);
    });
  }
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
  if(overlay) overlay.addEventListener("click", function(){
    closeAdmin();
    closeCartPanel();
    closeNotifications();
    if(document.getElementById("settings-bg")) closeAdminSettings();
    closeProductEditor();
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Escape") return;
    var peditOn = document.getElementById("pedit-bg") && document.getElementById("pedit-bg").classList.contains("on");
    if(peditOn) closeProductEditor();
  });
}

