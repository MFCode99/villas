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
  var preview = document.getElementById("pedit-img-preview");
  var imageCard = document.getElementById("pedit-image-card");
  var title = document.getElementById("pedit-title");
  var imageStatus = document.getElementById("pedit-image-status");
  preview.src = img || "";
  if(imageCard) imageCard.classList.toggle("has-image", !!img);
  if(title) title.textContent = editingRef === "__new__" ? "Adicionar Produto" : "Editar Produto";
  if(imageStatus){
    imageStatus.textContent = img ? "Imagem pronta para o catálogo." : "Escolhe uma imagem para o site ajustar automaticamente.";
    imageStatus.className = "pedit-image-status" + (img ? " ok" : "");
  }
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
function closeProductEditor(){
  var bg = document.getElementById("pedit-bg");
  if(bg) bg.classList.remove("on");
  editingRef = "";
}
window.closeProductEditor = closeProductEditor;
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
function syncProductEditorAfterSave(targetCat, successMessage){
  if(targetCat) activeCat = targetCat;
  closeProductEditor();
  return refreshCatalogUiFromServer(successMessage || "Produto atualizado com sucesso.");
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
    return syncProductEditorAfterSave(payload.cat, isNewProduct ? "Produto criado com sucesso." : "Produto atualizado com sucesso.");
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
    closeProductEditor();
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
      return syncProductEditorAfterSave(activeCat, "Produto apagado com sucesso.");
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
      return syncProductEditorAfterSave(base.cat, "Produto reposto com sucesso.");
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
  var isField = target && (target.closest("input, textarea, select, label, button, a, [role='button']") || target.isContentEditable);
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

