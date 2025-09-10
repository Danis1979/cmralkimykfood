(function(){
  var _fetch = window.fetch.bind(window);
  var warned = false;

  function currentKey(){
    try {
      if (window.getApiKey) {
        var k = (window.getApiKey() || '').trim();
        if (k) return k;
      }
      var ls = localStorage.getItem('api_key') || '';
      if (ls) return ls.trim();
    } catch(e) {}
    return '';
  }

  function ensureDevKeyIfLocalhost(){
    var k = currentKey();
    if (!k && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      k = 'supersecreta-123';
      try {
        localStorage.setItem('api_key', k);
        var i = document.getElementById('api_key'); if (i) i.value = k;
      } catch(e) {}
      if (!warned) { console.warn('DEV: usando x-api-key por defecto (supersecreta-123)'); warned = true; }
    }
    return k;
  }

  window.fetch = function(input, init){
    init = init || {};
    var baseHeaders =
      init.headers ||
      (typeof input !== 'string' && input && input.headers) ||
      {};
    var headers = new Headers(baseHeaders);

    if (!headers.has('x-api-key')) {
      var k = currentKey();
      if (!k) k = ensureDevKeyIfLocalhost();
      if (k) headers.set('x-api-key', k);
    }
    init.headers = headers;
    return _fetch(input, init);
  };
})();
