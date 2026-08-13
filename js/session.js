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

  if(!u || !p){ err.textContent="Preenche o utilizador e a password."; err.classList.add("on"); return; }

  btn.disabled = true; btn.textContent = "A entrar...";
  err.classList.remove("on");

  fetch(SERVER_URL.replace("/encomenda","/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: u, pass: p })
  })
  .then(function(r){ return r.json(); })
  .then(function(res){
    if(res.ok){
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
    } else {
      loginFail(err, box, btn, res.message||"Utilizador ou password incorrectos");
    }
  })
  .catch(function(){
    loginFail(err, box, btn, "Nao foi possivel ligar ao servidor.");
  });
}

function loginSuccess(client){
  loggedClient = client;
  if(client.token) authToken = client.token;
  try{
    var expiresAt = Date.now() + SESSION_TTL_MS;
    sessionStorage.setItem("villas_token", authToken||"");
    sessionStorage.setItem("villas_client", JSON.stringify(client));
    localStorage.setItem("villas_token", authToken||"");
    localStorage.setItem("villas_client", JSON.stringify(client));
    localStorage.setItem("villas_session_expires", String(expiresAt));
  }catch(e){}
  document.getElementById("login-screen").style.display="none";
  setLoginScreenActive(false);
  setDeveloperMode(!!client.developer);
  var n = client.name||client.nome||"";
  if(n) document.getElementById("cname").value = n;
  if(client.nif) document.getElementById("cnif").value = client.nif;
  updateAreaButton();
  updateUserGreeting();
  if(client.admin && !client.developer){
    document.getElementById("admin-settings-btn").classList.add("on");
    document.getElementById("new-prod-btn").classList.add("on");
    enableAdminProductEdit();
    loadAdminNotifications();
  } else {
    ADMIN_NOTIFICATIONS = [];
    updateNotificationButton();
  }
  document.getElementById("logout-btn").classList.add("on");
  clearOrderRequestId();
  if(client.developer){
    openDeveloperDashboard();
  }
  var btn = document.getElementById("login-btn");
  btn.disabled = false; btn.textContent = "Entrar";
  if(typeof loadCartFromServer === "function"){
    setTimeout(function(){ loadCartFromServer(); }, 0);
  }
  setTimeout(function(){
    updateStickyOffsets();
    syncMobileCompactState();
  }, 0);
  if(typeof ensureCatalogReadyOnStartup === "function"){
    ensureCatalogReadyOnStartup();
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

