function updateNotificationButton(){
  var btn = document.getElementById("notif-btn");
  var badge = document.getElementById("notif-badge");
  if(!btn || !badge) return;
  var canShow = !!(loggedClient && loggedClient.admin && !loggedClient.developer);
  btn.classList.toggle("on", canShow);
  badge.textContent = String(ADMIN_NOTIFICATIONS.length || 0);
  badge.classList.toggle("on", canShow && ADMIN_NOTIFICATIONS.length > 0);
}

function closeNotifications(){
  var panel = document.getElementById("notif-panel");
  if(panel) panel.classList.remove("on");
  var cartPanel = document.getElementById("panel");
  var adminPanel = document.getElementById("apanel");
  var ov = document.getElementById("ov");
  if(ov && !(cartPanel && cartPanel.classList.contains("on")) && !(adminPanel && adminPanel.classList.contains("on"))){
    ov.classList.remove("on");
  }
}

function renderNotificationsPanel(){
  var body = document.getElementById("notif-body");
  if(!body) return;
  if(!ADMIN_NOTIFICATIONS.length){
    body.innerHTML = "<div class='area-empty'>Sem notificações ativas neste momento.</div>";
    return;
  }
  body.innerHTML = ADMIN_NOTIFICATIONS.map(function(note){
    return "<article class='notif-item'>"
      + "<h4>" + escH(note.title || "Atualização") + "</h4>"
      + "<p>" + escH(note.body || "") + "</p>"
      + "<time>" + formatDevDate(note.criado_em) + "</time>"
      + "</article>";
  }).join("");
}

function openNotifications(){
  if(!(loggedClient && loggedClient.admin && !loggedClient.developer)) return;
  closeCartPanel();
  if(typeof closeAdminSettings === "function") closeAdminSettings();
  renderNotificationsPanel();
  document.getElementById("notif-panel").classList.add("on");
  document.getElementById("ov").classList.add("on");
}

function formatDevDate(value){
  if(!value) return "Agora mesmo";
  var dt = new Date(value);
  if(isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString("pt-PT", {
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function renderDeveloperStats(){
  var el = document.getElementById("dev-stats");
  if(!el) return;
  var summary = DEV_SUMMARY || {};
  var stats = [
    { label:"Clientes", value: summary.clientes || 0 },
    { label:"Encomendas", value: summary.encomendas || 0 },
    { label:"Notas ativas", value: summary.notificacoesAtivas || 0 },
    { label:"Falhas login 7 dias", value: summary.falhasLogin7d || 0 },
    { label:"Sessões ativas", value: summary.sessoesAtivas || 0 }
  ];
  el.innerHTML = stats.map(function(item){
    return "<div class='dev-stat'><small>" + escH(item.label) + "</small><strong>" + escH(String(item.value)) + "</strong><span>Atualização rápida do painel técnico.</span></div>";
  }).join("");
}

function renderDeveloperHealth(){
  var list = document.getElementById("dev-health-list");
  if(!list) return;
  var status = DEV_STATUS_DATA || {};
  var items = [
    { title:"Servidor", body: status.servidor === "online" ? "Online e a responder." : "Sem estado conhecido." },
    { title:"Email SMTP", body: status.smtpReady ? "Ligação pronta para envio de emails." : (status.smtpMessage || "SMTP com aviso ou sem validação.") },
    { title:"Sessões ativas", body: String(status.sessoesAtivas || 0) + " sessões ativas neste momento." }
  ];
  list.innerHTML = items.map(function(item){
    return "<article class='dev-log'><h4>" + escH(item.title) + "</h4><p>" + escH(item.body) + "</p></article>";
  }).join("");
}

function renderDeveloperNotes(){
  var list = document.getElementById("dev-notes-list");
  if(!list) return;
  if(!DEV_NOTES.length){
    list.innerHTML = "<div class='area-empty'>Ainda não há notas técnicas publicadas.</div>";
    return;
  }
  list.innerHTML = DEV_NOTES.map(function(note){
    var active = !!note.active;
    return "<article class='dev-note'>"
      + "<h4>" + escH(note.title || "Nota") + "</h4>"
      + "<p>" + escH(note.body || "") + "</p>"
      + "<div class='dev-meta'>" + escH(note.audience === "all" ? "Todos" : "Admins") + " · " + formatDevDate(note.criado_em) + " · " + escH(active ? "Ativa" : "Inativa") + "</div>"
      + "<div class='dev-actions' style='margin-top:10px'>"
      + "<button class='dev-btn' data-dev-note-toggle='" + escAttr(String(note.id)) + "' data-dev-note-active='" + (active ? "0" : "1") + "'>" + (active ? "Desativar" : "Ativar") + "</button>"
      + "<button class='dev-btn' data-dev-note-delete='" + escAttr(String(note.id)) + "'>Apagar</button>"
      + "</div>"
      + "</article>";
  }).join("");
}

function renderDeveloperLogins(){
  var failedList = document.getElementById("dev-logins-list");
  var allList = document.getElementById("dev-logins-all-list");
  if(!failedList || !allList) return;
  if(!DEV_LOGIN_LOGS.length){
    failedList.innerHTML = "<div class='area-empty'>Sem falhas registadas.</div>";
  } else {
    failedList.innerHTML = DEV_LOGIN_LOGS.map(function(item){
      return "<article class='dev-log'>"
        + "<h4>" + escH(item.nome || item.user_input || "Tentativa de login") + "</h4>"
        + "<p>" + escH("Falha no login" + (item.user_input ? " · utilizador " + item.user_input : "") + (item.ip ? " · IP " + item.ip : "")) + "</p>"
        + "<div class='dev-meta'>" + formatDevDate(item.criado_em) + "</div>"
        + "</article>";
    }).join("");
  }
  if(!DEV_ALL_LOGINS.length){
    allList.innerHTML = "<div class='area-empty'>Sem registos recentes.</div>";
    return;
  }
  allList.innerHTML = DEV_ALL_LOGINS.map(function(item){
    return "<article class='dev-log'>"
      + "<h4>" + escH(item.nome || item.user_input || "Tentativa de login") + "</h4>"
      + "<p>" + escH((item.sucesso ? "Login com sucesso" : "Falha no login") + (item.user_input ? " · utilizador " + item.user_input : "") + (item.ip ? " · IP " + item.ip : "")) + "</p>"
      + "<div class='dev-meta'>" + formatDevDate(item.criado_em) + "</div>"
      + "</article>";
  }).join("");
}

function renderDeveloperOrders(){
  var list = document.getElementById("dev-orders-list");
  if(!list) return;
  if(!DEV_RECENT_ORDERS.length){
    list.innerHTML = "<div class='area-empty'>Ainda não há encomendas recentes para mostrar.</div>";
    return;
  }
  list.innerHTML = DEV_RECENT_ORDERS.map(function(order){
    return "<article class='dev-order'>"
      + "<h4>" + escH(order.client || "Cliente") + "</h4>"
      + "<p>" + escH((order.date || "") + " " + (order.time || "") + " · " + (order.units || 0) + " unidades · " + (order.lines || 0) + " linhas") + "</p>"
      + "<div class='dev-actions'>"
      + "<button class='dev-btn' data-dev-order-open='" + escAttr(String(order.id)) + "'>PDF</button>"
      + "<span class='dev-meta' style='display:flex;align-items:center'>" + escH("#" + order.id + " · " + Number(order.total || 0).toFixed(2).replace(".", ",") + " €") + "</span>"
      + "</div>"
      + "</article>";
  }).join("");
}

function setDevStatus(message, kind){
  var el = document.getElementById("dev-status");
  if(!el) return;
  el.textContent = message || "";
  el.className = "dev-status" + (kind ? " " + kind : "");
}

function renderDeveloperDashboard(){
  if(!isDeveloper()) return;
  setDeveloperMode(true);
  renderDeveloperStats();
  renderDeveloperHealth();
  renderDeveloperNotes();
  renderDeveloperLogins();
  renderDeveloperOrders();
}

function loadAdminNotifications(){
  if(!(loggedClient && loggedClient.admin && !loggedClient.developer)) return Promise.resolve();
  return fetch("/admin/notificacoes", {
    headers: { "X-Token": authToken||"" }
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    ADMIN_NOTIFICATIONS = res.ok && Array.isArray(res.notificacoes) ? res.notificacoes : [];
    updateNotificationButton();
    renderNotificationsPanel();
  })
  .catch(function(){
    ADMIN_NOTIFICATIONS = [];
    updateNotificationButton();
  });
}

function loadDeveloperDashboard(){
  if(!isDeveloper()) return Promise.resolve();
  return Promise.all([
    fetch("/dev/summary", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch("/dev/notes", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch("/dev/status", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch("/dev/logins?limit=24", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch("/dev/logins?failed=1", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch("/dev/encomendas-recentes", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); })
  ])
  .then(function(results){
    DEV_SUMMARY = results[0] && results[0].ok ? results[0].summary : null;
    DEV_NOTES = results[1] && results[1].ok && Array.isArray(results[1].notes) ? results[1].notes : [];
    DEV_STATUS_DATA = results[2] && results[2].ok ? results[2].status : null;
    DEV_ALL_LOGINS = results[3] && results[3].ok && Array.isArray(results[3].logs) ? results[3].logs : [];
    DEV_LOGIN_LOGS = results[4] && results[4].ok && Array.isArray(results[4].logs) ? results[4].logs : [];
    DEV_RECENT_ORDERS = results[5] && results[5].ok && Array.isArray(results[5].encomendas) ? results[5].encomendas : [];
    renderDeveloperDashboard();
  })
  .catch(function(){
    setDevStatus("Não foi possível carregar o painel técnico.", "err");
    renderDeveloperDashboard();
  });
}

function openDeveloperDashboard(){
  if(!isDeveloper()) return;
  closeCartPanel();
  closeAdmin();
  closeNotifications();
  setDeveloperMode(true);
  loadDeveloperDashboard();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function saveDeveloperNote(){
  if(!isDeveloper()) return;
  var title = (document.getElementById("dev-note-title").value || "").trim();
  var body = (document.getElementById("dev-note-body").value || "").trim();
  var audience = document.getElementById("dev-note-audience").value || "admin";
  if(!title || !body){
    setDevStatus("Preenche o título e o conteúdo da nota.", "err");
    return;
  }
  setDevStatus("A publicar nota técnica...", "");
  fetch("/dev/notes", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ title:title, body:body, audience:audience })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Não foi possível publicar a nota.");
    document.getElementById("dev-note-title").value = "";
    document.getElementById("dev-note-body").value = "";
    setDevStatus("Nota publicada com sucesso.", "ok");
    return Promise.all([loadDeveloperDashboard(), loadAdminNotifications()]);
  })
  .catch(function(err){
    setDevStatus(err.message || "Não foi possível publicar a nota.", "err");
  });
}

function toggleDeveloperNote(noteId, nextActive){
  if(!isDeveloper()) return;
  fetch("/dev/notes/" + noteId, {
    method:"PUT",
    headers:{ "Content-Type":"application/json", "X-Token": authToken||"" },
    body: JSON.stringify({ active: !!nextActive })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(!res.ok) throw new Error(res.message || "Não foi possível atualizar a nota.");
    return Promise.all([loadDeveloperDashboard(), loadAdminNotifications()]);
  })
  .catch(function(err){
    setDevStatus(err.message || "Não foi possível atualizar a nota.", "err");
  });
}

function deleteDeveloperNote(noteId){
  askConfirm({
    title: "Apagar nota",
    message: "Queres mesmo apagar esta nota técnica?",
    confirmLabel: "Apagar",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    fetch("/dev/notes/" + noteId, {
      method:"DELETE",
      headers:{ "X-Token": authToken||"" }
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message || "Não foi possível apagar a nota.");
      setDevStatus("Nota apagada com sucesso.", "ok");
      return Promise.all([loadDeveloperDashboard(), loadAdminNotifications()]);
    })
    .catch(function(err){
      setDevStatus(err.message || "Não foi possível apagar a nota.", "err");
    });
  });
}

function clearAllSessionsFromDev(){
  askConfirm({
    title: "Forçar novo login",
    message: "Isto vai invalidar todas as sessões ativas. Os utilizadores terão de voltar a iniciar sessão.",
    confirmLabel: "Forçar logout",
    danger: true
  }).then(function(ok){
    if(!ok) return;
    fetch("/dev/sessions/clear", {
      method:"POST",
      headers:{ "X-Token": authToken||"" }
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) throw new Error(res.message || "Não foi possível limpar as sessões.");
      setDevStatus("Sessões limpas com sucesso.", "ok");
      return loadDeveloperDashboard();
    })
    .catch(function(err){
      setDevStatus(err.message || "Não foi possível limpar as sessões.", "err");
    });
  });
}

