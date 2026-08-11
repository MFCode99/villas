var VILLAS_APP_VERSION = window.VILLAS_APP_VERSION || "20260811-12";

function escH(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s){ return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function clearLegacyVillasStateIfNeeded(){}
