var VILLAS_APP_VERSION = window.VILLAS_APP_VERSION || "20260811-10";
var VILLAS_STORAGE_VERSION_KEY = "villas_app_version";

function escH(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s){ return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function clearLegacyVillasStateIfNeeded(){
  try{
    var seenVersion = localStorage.getItem(VILLAS_STORAGE_VERSION_KEY);
    if(seenVersion === VILLAS_APP_VERSION) return;
    var keys = [
      "villas_token",
      "villas_client",
      "villas_session_expires",
      "villas_cart",
      "villas_show_inactive_products",
      "villas_collection_mode"
    ];
    keys.forEach(function(key){
      try{
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }catch(e){}
    });
    localStorage.setItem(VILLAS_STORAGE_VERSION_KEY, VILLAS_APP_VERSION);
  }catch(e){}
}

clearLegacyVillasStateIfNeeded();
