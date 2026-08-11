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

function finishAuthCheck(){
  document.documentElement.classList.remove("auth-checking");
  document.body.classList.remove("auth-checking");
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
  mobileCompact = false;
  document.body.classList.remove("mobile-ui-compact");
  setTimeout(updateStickyOffsets, 0);
}

function syncMobileCompactState(){
  setMobileCompact(false);
}

function handleMobileChromeScroll(){
  return;
}

function clearAuthenticatedState(){
  loggedClient = null;
  authToken = null;
  ADMIN_NOTIFICATIONS = [];
  DEV_SUMMARY = null;
  DEV_STATUS_DATA = null;
  DEV_NOTES = [];
  DEV_ALL_LOGINS = [];
  DEV_LOGIN_LOGS = [];
  DEV_RECENT_ORDERS = [];
}

function applyAuthenticatedState(client){
  loggedClient = client;
  if(client && client.token) authToken = client.token;
  var loginScreen = document.getElementById("login-screen");
  if(loginScreen) loginScreen.style.display="none";
  if(typeof setLoginScreenActive === "function") setLoginScreenActive(false);
  finishAuthCheck();
  if(typeof setDeveloperMode === "function") setDeveloperMode(!!(client && client.developer));
  var n = client && (client.name || client.nome || "");
  if(n){
    var cname = document.getElementById("cname");
    if(cname) cname.value = n;
  }
  if(client && client.nif){
    var cnif = document.getElementById("cnif");
    if(cnif) cnif.value = client.nif;
  }
  if(typeof updateAreaButton === "function") updateAreaButton();
  if(typeof updateUserGreeting === "function") updateUserGreeting();
  if(client && client.admin && !client.developer){
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
  if(client && client.developer && typeof openDeveloperDashboard === "function"){
    openDeveloperDashboard();
  }
  setTimeout(function(){
    if(typeof updateStickyOffsets === "function") updateStickyOffsets();
    if(typeof syncMobileCompactState === "function") syncMobileCompactState();
  }, 0);
  if(typeof ensureCatalogReadyOnStartup === "function"){
    ensureCatalogReadyOnStartup();
  }
  if(typeof syncCartFromServer === "function"){
    syncCartFromServer().catch(function(){ return false; });
  }
}

function shouldAutoBootstrapSession(){
  return String(window.VILLAS_INITIAL_VIEW || "catalog").toLowerCase() !== "login";
}

function bootstrapSessionFromServer(){
  return fetch("/me", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "X-Token": authToken || "" }
  })
  .then(function(r){
    return r.text().then(function(text){
      var res = {};
      try{ res = text ? JSON.parse(text) : {}; }catch(e){}
      if(!r.ok || !res.ok) return false;
      applyAuthenticatedState({
        user: res.user || res.nome || "",
        name: res.nome,
        nif: res.nif,
        email: res.email || "",
        telefone: res.telefone || "",
        admin: !!res.admin,
        developer: !!res.developer,
        id: res.id,
        token: res.token || ""
      });
      return true;
    });
  })
  .catch(function(){ return false; })
  .then(function(ok){
    if(ok) return true;
    clearAuthenticatedState();
    var errBox = document.getElementById("login-err");
    if(errBox) errBox.classList.remove("on");
    if(typeof updateUserGreeting === "function") updateUserGreeting();
    if(typeof setLoginScreenActive === "function") setLoginScreenActive(true);
    finishAuthCheck();
    if(typeof setMobileCompact === "function") setMobileCompact(false);
    if(typeof ensureCatalogReadyOnStartup === "function") ensureCatalogReadyOnStartup();
    var loginUser = document.getElementById("l-user");
    if(loginUser) loginUser.focus();
    return false;
  });
}

function logoutSessionOnServer(){
  return fetch("/logout", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "X-Token": authToken || "" }
  }).catch(function(){ return false; });
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
    applyAuthenticatedState(client);
  }catch(e){}
  try{
    // UI updates handled in applyAuthenticatedState.
    if(window.location && window.location.pathname !== "/catalogo"){
      window.location.replace("/catalogo");
      return;
    }
  } catch (err) {
    console.error("Login success flow failed:", err);
    clearAuthenticatedState();
    var errBox = document.getElementById("login-err");
    if(errBox){
      errBox.textContent = "Login aceite, mas houve um erro ao abrir a área. Atualiza a página e tenta de novo.";
      errBox.classList.add("on");
    }
    var loginScreen2 = document.getElementById("login-screen");
    if(loginScreen2) loginScreen2.style.display = "";
    if(typeof setLoginScreenActive === "function") setLoginScreenActive(true);
    finishAuthCheck();
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

setTimeout(function(){
  if(typeof bootstrapSessionFromServer === "function" && shouldAutoBootstrapSession()){
    bootstrapSessionFromServer().catch(function(){ return false; });
    return;
  }
  if(typeof setLoginScreenActive === "function") setLoginScreenActive(true);
  finishAuthCheck();
}, 50);

