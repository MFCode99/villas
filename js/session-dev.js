// â”€â”€ CLIENTS / LOGIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Para adicionar clientes: {user, pass, name, nif}

var CLIENTS = [];
var USER_ORDERS = [];
var ADMIN_ORDERS = [];
var loggedClient = null;
var authToken = null;
var SESSION_TTL_MS = 30 * 60 * 1000;
var DEV_SUMMARY = null;
var DEV_STATUS_DATA = null;
var DEV_NOTES = [];
var DEV_ALL_LOGINS = [];
var DEV_LOGIN_LOGS = [];
var DEV_RECENT_ORDERS = [];
var ADMIN_NOTIFICATIONS = [];

var editingIdx = -1;
var areaTab = "minhas-encomendas";
var selectedOrderId = null;
var areaSearch = "";
var filterClientId = null;
var mobileCompact = false;
var mobileScrollTicking = false;

function updateAreaButton(){
  var btn = document.getElementById("admin-btn");
  if(!btn) return;
  if(!loggedClient){
    btn.classList.remove("on");
    btn.innerHTML = "&#9881; Área";
    return;
  }
  btn.classList.add("on");
  btn.innerHTML = isDeveloper()
    ? "&#128736; Painel Dev"
    : (loggedClient.admin ? "&#9881; Área Admin" : "&#128100; A Minha Área");
}

function updateUserGreeting(){
  var wrap = document.getElementById("user-greet");
  var nameEl = document.getElementById("user-greet-name");
  if(!wrap || !nameEl) return;
  var name = loggedClient ? (loggedClient.name || loggedClient.nome || loggedClient.user || "") : "";
  if(!name){
    wrap.classList.remove("on");
    nameEl.textContent = "cliente";
    return;
  }
  nameEl.textContent = name;
  wrap.classList.add("on");
}

function isDeveloper(){
  return !!(loggedClient && loggedClient.developer);
}

function setDeveloperMode(active){
  document.body.classList.toggle("dev-mode", !!active);
  setTimeout(function(){
    updateStickyOffsets();
    syncMobileCompactState();
  }, 0);
}

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
  if(!document.getElementById("panel").classList.contains("on") && !document.getElementById("apanel").classList.contains("on")){
    document.getElementById("ov").classList.remove("on");
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
  closeAdmin();
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
  return fetch(BASE_URL + "/admin/notificacoes", {
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
    fetch(BASE_URL + "/dev/summary", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/dev/notes", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/dev/status", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/dev/logins?limit=24", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/dev/logins?failed=1", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); }),
    fetch(BASE_URL + "/dev/encomendas-recentes", { headers: { "X-Token": authToken||"" } }).then(function(r){ return r.json(); })
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
  fetch(BASE_URL + "/dev/notes", {
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
  fetch(BASE_URL + "/dev/notes/" + noteId, {
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
    fetch(BASE_URL + "/dev/notes/" + noteId, {
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
    fetch(BASE_URL + "/dev/sessions/clear", {
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

function updateStickyOffsets(){
  var hdr = document.querySelector(".hdr");
  var srch = document.querySelector(".srch-wrap");
  var root = document.documentElement;
  if(!root) return;
  var hdrH = ((hdr ? hdr.offsetHeight : 53) || 53);
  var srchH = ((srch ? srch.offsetHeight : 50) || 50);
  root.style.setProperty("--hdr-h", hdrH + "px");
  root.style.setProperty("--srch-h", srchH + "px");
  root.style.setProperty("--tabs-top", (hdrH + srchH) + "px");
}

function setMobileCompact(next){
  next = !!next;
  if(window.innerWidth > 640) next = false;
  if(document.body.classList.contains("login-active")) next = false;
  if(mobileCompact === next) return;
  mobileCompact = next;
  document.body.classList.toggle("mobile-ui-compact", mobileCompact);
  setTimeout(updateStickyOffsets, 0);
}

function syncMobileCompactState(){
  if(window.innerWidth > 640 || document.body.classList.contains("login-active")){
    setMobileCompact(false);
    return;
  }
  var sentinel = document.getElementById("mobile-header-sentinel");
  var threshold = sentinel ? Math.max(24, sentinel.offsetTop) : 80;
  setMobileCompact((window.scrollY || 0) > threshold);
}

function handleMobileChromeScroll(){
  if(mobileScrollTicking) return;
  mobileScrollTicking = true;
  window.requestAnimationFrame(function(){
    mobileScrollTicking = false;
    syncMobileCompactState();
  });
}


function doLogin(){
  var u = document.getElementById("l-user").value.trim().toLowerCase();
  var p = document.getElementById("l-pass").value;
  var err = document.getElementById("login-err");
  var box = document.getElementById("login-box");
  var btn = document.getElementById("login-btn");
  var loginUrls = [];
  var base = (typeof BASE_URL === "string" && BASE_URL) ? BASE_URL.replace(/\/$/, "") : "";
  if(base) loginUrls.push(base + "/login");
  loginUrls.push("/login");
  if(window.location && window.location.origin && window.location.origin !== "null" && window.location.protocol !== "file:"){
    loginUrls.push(window.location.origin.replace(/\/$/, "") + "/login");
  }
  loginUrls.push("https://villas.mlabcorp.net/login");
  loginUrls = loginUrls.filter(function(url, idx, arr){ return !!url && arr.indexOf(url) === idx; });

  if(!u || !p){ err.textContent="Preenche o utilizador e a password."; err.classList.add("on"); return; }

  btn.disabled = true; btn.textContent = "A entrar...";
  err.classList.remove("on");

  (function tryLogin(index){
    if(index >= loginUrls.length){
      loginFail(err, box, btn, "Nao foi possivel ligar ao servidor.");
      return;
    }
    fetch(loginUrls[index], {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: u, pass: p })
    })
    .then(function(r){
      return r.text().then(function(text){
        var res = {};
        try{ res = text ? JSON.parse(text) : {}; }catch(e){}
        if(!r.ok || !res.ok){
          if(index + 1 < loginUrls.length) return tryLogin(index + 1);
          loginFail(err, box, btn, (res && res.message) || "Utilizador ou password incorrectos");
          return;
        }
        authToken = res.token||"";
        loginSuccess({
          user:u,
          name:res.nome,
          nif:res.nif,
          email: res.email || "",
          telefone: res.telefone || "",
          admin:res.admin,
          developer:res.developer,
          id:res.id,
          token:res.token
        });
      });
    })
    .catch(function(){
      if(index + 1 < loginUrls.length) return tryLogin(index + 1);
      loginFail(err, box, btn, "Nao foi possivel ligar ao servidor.");
    });
  })(0);
}

function loginSuccess(client){
  var btn = document.getElementById("login-btn");
  try{
    loggedClient = client;
    if(client.token) authToken = client.token;
    var expiresAt = Date.now() + SESSION_TTL_MS;
    sessionStorage.setItem("villas_token", authToken||"");
    sessionStorage.setItem("villas_client", JSON.stringify(client));
    localStorage.setItem("villas_token", authToken||"");
    localStorage.setItem("villas_client", JSON.stringify(client));
    localStorage.setItem("villas_session_expires", String(expiresAt));
  }catch(e){}
  try{
    var loginScreen = document.getElementById("login-screen");
    if(loginScreen) loginScreen.style.display="none";
    if(typeof setLoginScreenActive === "function") setLoginScreenActive(false);
    if(typeof setDeveloperMode === "function") setDeveloperMode(!!client.developer);
    var n = client.name||client.nome||"";
    if(n){
      var cname = document.getElementById("cname");
      if(cname) cname.value = n;
    }
    if(client.nif){
      var cnif = document.getElementById("cnif");
      if(cnif) cnif.value = client.nif;
    }
    if(typeof updateAreaButton === "function") updateAreaButton();
    if(typeof updateUserGreeting === "function") updateUserGreeting();
    if(client.admin && !client.developer){
      var adminSettingsBtn = document.getElementById("admin-settings-btn");
      var newProdBtn = document.getElementById("new-prod-btn");
      if(adminSettingsBtn) adminSettingsBtn.classList.add("on");
      if(newProdBtn) newProdBtn.classList.add("on");
      if(typeof enableAdminProductEdit === "function") enableAdminProductEdit();
      if(typeof loadAdminNotifications === "function") loadAdminNotifications();
    } else {
      ADMIN_NOTIFICATIONS = [];
      if(typeof updateNotificationButton === "function") updateNotificationButton();
    }
    var logoutBtn = document.getElementById("logout-btn");
    if(logoutBtn) logoutBtn.classList.add("on");
    if(client.developer && typeof openDeveloperDashboard === "function"){
      openDeveloperDashboard();
    }
    setTimeout(function(){
      if(typeof updateStickyOffsets === "function") updateStickyOffsets();
      if(typeof syncMobileCompactState === "function") syncMobileCompactState();
    }, 0);
  } catch (err) {
    console.error("Login success flow failed:", err);
  } finally {
    if(btn){
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  }
}

function loginFail(err, box, btn, msg){
  err.textContent = msg||"Utilizador ou password incorrectos";
  err.classList.add("on");
  box.classList.remove("login-shake");
  void box.offsetWidth;
  box.classList.add("login-shake");
  document.getElementById("l-pass").value = "";
  btn.disabled = false; btn.textContent = "Entrar";
}
document.getElementById("login-btn").addEventListener("click", doLogin);
document.getElementById("l-pass").addEventListener("keydown", function(e){
  if(e.key==="Enter") doLogin();
});
document.getElementById("l-user").addEventListener("keydown", function(e){
  if(e.key==="Enter") document.getElementById("l-pass").focus();
});

