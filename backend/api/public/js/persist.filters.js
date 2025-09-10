(function(){
  const $ = (id)=>document.getElementById(id);
  function save(k, el){ localStorage.setItem(k, (el && el.value || '').trim()); }
  function load(k){ return localStorage.getItem(k) || ''; }

  function hook(id, key){
    const el = $(id);
    if(!el) return;
    if(!el.value) el.value = load(key);
    el.addEventListener('input', ()=>save(key, el));
    el.addEventListener('change', ()=>save(key, el));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    hook('api_base','api_base');
    hook('api_key','api_key');
    hook('global_from','global_from');
    hook('global_to','global_to');
  });
})();
