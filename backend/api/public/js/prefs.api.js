(function(){
  function el(id){ return document.getElementById(id); }
  function get(k){ try{ return localStorage.getItem(k)||'' }catch(e){ return '' } }
  function set(k,v){ try{ localStorage.setItem(k, v||'') }catch(e){} }

  // origen de API (input -> localStorage -> location.origin), normalizando https en localhost
  window.base = function(){
    var v = (el('api_base')?.value || get('api_base') || location.origin).trim();
    try{
      var u = new URL(v);
      // si el dashboard está en https y apuntás a http://localhost => forzá https
      if (location.protocol==='https:' && u.protocol==='http:' && (u.hostname==='localhost'||u.hostname==='127.0.0.1')) {
        u.protocol = 'https:';
      }
      v = u.origin;
    }catch(e){}
    return v;
  };

  window.getApiKey = function(){
    return (el('api_key')?.value || get('api_key') || '').trim();
  };

  document.addEventListener('DOMContentLoaded', function(){
    var b = el('api_base'); if (b && !b.value) b.value = get('api_base') || location.origin;
    var k = el('api_key');  if (k && !k.value) k.value = get('api_key')  || '';
    b && b.addEventListener('input', ()=>set('api_base', b.value));
    k && k.addEventListener('input', ()=>set('api_key',  k.value));
  });
})();
