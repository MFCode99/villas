var VILLAS_APP_VERSION = window.VILLAS_APP_VERSION || "20260814-01";

function escH(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s){ return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function normalizeChoiceText(value){
  return String(value || "").trim().replace(/\s+/g, " ");
}

function clearLegacyVillasStateIfNeeded(){}
