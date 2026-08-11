function escH(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s){ return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
