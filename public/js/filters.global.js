(function(){
  function el(id){ return document.getElementById(id); }
  function setVal(id,v){ const x=el(id); if(x) x.value=v; }
  function getVal(id){ const x=el(id); return x? x.value.trim(): ''; }
  function todayMonth(){ return new Date().toISOString().slice(0,7); }
  function todayDate(){ return new Date().toISOString().slice(0,10); }

  function loadSaved(){
    setVal('global_from', localStorage.getItem('global_from') || todayMonth());
    setVal('global_to',   localStorage.getItem('global_to')   || todayMonth());
    setVal('global_as_of',localStorage.getItem('global_as_of')|| todayDate());
  }
  function save(){
    localStorage.setItem('global_from', getVal('global_from'));
    localStorage.setItem('global_to',   getVal('global_to'));
    localStorage.setItem('global_as_of',getVal('global_as_of'));
  }
  function apply(){
    save();
    const btn = document.getElementById('qa_refresh_all');
    if (btn) btn.click(); else if (window.loadAll) window.loadAll(); else location.reload();
  }
  function clearAll(){
    setVal('global_from',''); setVal('global_to',''); setVal('global_as_of',''); save(); apply();
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    loadSaved();
    document.getElementById('btn_apply_filters')?.addEventListener('click', apply);
    document.getElementById('btn_clear_filters')?.addEventListener('click', clearAll);
    window.getGlobalRange = function(){
      const F=getVal('global_from'), T=getVal('global_to'); const qs=[];
      if(F) qs.push('from='+encodeURIComponent(F)); if(T) qs.push('to='+encodeURIComponent(T));
      return qs.length? '?'+qs.join('&') : '';
    };
    window.getAsOf = function(){
      const A=getVal('global_as_of'); return A? ('?as_of='+encodeURIComponent(A)) : '';
    };
  });
})();
