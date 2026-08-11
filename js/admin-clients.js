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
      "<button class='abtn-cancel' id='afrm-cancel' type='button'>Cancelar</button>" +
      "<button class='abtn-save' id='afrm-save' type='button'>&#10003; Guardar</button>" +
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
      closeClientModal();
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
    closeClientModal();
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
    closeClientModal();
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

function openClientModal(index){
  editingIdx = index;
  var bg = document.getElementById("client-modal-bg");
  var body = document.getElementById("client-modal-body");
  var title = document.getElementById("client-modal-title");
  if(!bg || !body || !title) return;
  var client = (index >= 0 && CLIENTS[index]) ? CLIENTS[index] : null;
  title.textContent = index === -2 ? "Novo Cliente" : "Editar Cliente";
  body.innerHTML = renderForm(client);
  bg.classList.add("on");
  setTimeout(function(){
    var first = document.getElementById("af-name");
    if(first) first.focus();
  }, 0);
}

function closeClientModal(){
  var bg = document.getElementById("client-modal-bg");
  if(bg) bg.classList.remove("on");
  editingIdx = -1;
}

function bindClientModalEvents(){
  if(window.__VILLAS_CLIENT_MODAL_BOUND__) return;
  window.__VILLAS_CLIENT_MODAL_BOUND__ = true;

  document.addEventListener("click", function(e){
    if(e.target && e.target.id === "client-modal-close"){
      closeClientModal();
      return;
    }
    if(e.target && e.target.id === "client-modal-bg"){
      closeClientModal();
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
  });

  document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      closeClientModal();
    }
  });
}

bindClientModalEvents();

