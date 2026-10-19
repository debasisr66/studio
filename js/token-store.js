/* Where the admin token lives. No DOM access, so Node can test it (UMD).
   create(getStorage, key): token in the given storage (the page passes sessionStorage: this tab only, forgotten when
   the tab closes). If that storage is blocked or full, the token is held in memory only, so a reload simply locks.
   purge(getStorage, key): deletes a token that an earlier version left in persistent storage (never migrated). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokenStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function probe(getStorage) {
    try {
      var s = getStorage();
      s.setItem('__probe', '1');
      s.removeItem('__probe');
      return s;
    } catch (e) { return null; }
  }

  function create(getStorage, key) {
    var storage = probe(getStorage), mem = null;
    return {
      get: function () {
        if (storage) { try { var v = storage.getItem(key); if (v !== null) return v; } catch (e) {} }
        return mem;
      },
      set: function (v) {
        if (storage) { try { storage.setItem(key, v); mem = null; return; } catch (e) {} }
        mem = v;
      },
      del: function () {
        mem = null;
        if (storage) { try { storage.removeItem(key); } catch (e) {} }
      }
    };
  }

  function purge(getStorage, key) {
    try {
      var s = getStorage();
      var had = s.getItem(key) !== null;
      s.removeItem(key);
      return had;
    } catch (e) { return false; }
  }

  return { create: create, purge: purge };
});
