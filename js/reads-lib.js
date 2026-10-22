/* Pure helpers for the Reads feature. No DOM access, so Node can test them (UMD). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ReadsLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = ['article', 'video', 'paper', 'podcast', 'tool'];
  /* The sections a read or book can belong to (SPEC-RC RC-01, RC-09). A closed list: adding a value here is the whole code change.
     Anything missing or unknown is shown as 'other' in the browser (never an error); CI rejects it (rule reads-category). */
  var CATEGORIES = ['technical', 'other'];
  var DEFAULT_NEW_CATEGORY = 'technical';   // what the admin gives a new read until the Section choice ships (RC Phase B)
  function categoryOf(e) {
    var c = e && typeof e === 'object' ? e.category : undefined;
    return typeof c === 'string' && CATEGORIES.indexOf(c) >= 0 ? c : 'other';
  }
  /* Whole-section counts, ignoring any tag or search filter. */
  function categoryCounts(list, cats) {
    var out = {};
    (cats || CATEGORIES).forEach(function (c) { out[c] = 0; });
    (list || []).forEach(function (e) { var c = categoryOf(e); if (c in out) out[c]++; });
    return out;
  }
  var LIMITS = { url: 2048, title: 140, comment: 280, tags: 5, tag: 24 };
  var TRACKING = /^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid|igshid)$/i;

  /* Returns a clean http(s) URL string, or null if the input is unusable or unsafe. */
  function normalizeUrl(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim();
    if (!s || s.length > LIMITS.url) return null;
    if (s.indexOf('//') === 0) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      if (/\s/.test(s) || s.indexOf('.') < 1) return null;
      s = 'https://' + s;
    }
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (!u.hostname || u.hostname.indexOf('.') < 1) return null;
    u.hash = '';
    var drop = [];
    u.searchParams.forEach(function (_, k) { if (TRACKING.test(k)) drop.push(k); });
    drop.forEach(function (k) { u.searchParams.delete(k); });
    var out = u.toString();
    if (out.length > LIMITS.url) return null;
    return out.replace(/\?$/, '');
  }

  /* Version of the shape of content/reads.json (SPEC-SH SH-04). The browser tolerates a missing or older version (documented defaults)
     and refuses only a NEWER one, so it never edits or publishes over a file it does not understand. CI requires the key. */
  var READS_SCHEMA_VERSION = 2;   // 2 = every read and book has a category (SPEC-RC RC-05); 1 = before
  function isSupportedReadsVersion(v) {
    return !(typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v > READS_SCHEMA_VERSION);
  }
  /* What the admin writes to reads.json: the version first, then the lists. Always the current version, so a publish never drops the key.
     An entry that somehow has no valid category (hand edit, legacy) gets the admin default, so a publish can never fail the CI category rule. */
  function withCategory(e) {
    if (!e || typeof e !== 'object' || CATEGORIES.indexOf(e.category) >= 0) return e;
    var o = {}; Object.keys(e).forEach(function (k) { o[k] = e[k]; }); o.category = DEFAULT_NEW_CATEGORY; return o;
  }
  function serializeReads(r) {
    r = r || {};
    return { schema_version: READS_SCHEMA_VERSION, books: (Array.isArray(r.books) ? r.books : []).map(withCategory), articles: (Array.isArray(r.articles) ? r.articles : []).map(withCategory) };
  }

  /* Strict check for a URL that is stored or published (CI and the admin screen): http(s) only, no whitespace or control
     characters anywhere (new URL() would silently trim or strip them), no credentials, a host, within the length limit.
     Unlike normalizeUrl it never repairs its input; it only says yes or no. */
  function isPublishableUrl(input) {
    if (typeof input !== 'string' || !input || input.length > LIMITS.url) return false;
    if (/[\u0000-\u0020\u007f-\u009f]/.test(input)) return false;
    if (!/^https?:\/\/[^\/?#\\]/i.test(input)) return false;   // the host must be written out (new URL() reads https:///x as host "x")
    var u;
    try { u = new URL(input); } catch (e) { return false; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    return !!u.hostname;
  }

  function domainOf(url) {
    var n = normalizeUrl(url);
    if (!n) return null;
    return new URL(n).hostname.replace(/^www\./, '');
  }

  function keyOf(url) {
    var n = normalizeUrl(url);
    if (!n) return null;
    var u = new URL(n);
    var path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '';
    return u.hostname.replace(/^www\./, '') + path + u.search;
  }

  /* excludeId lets the editor ignore the entry being edited. */
  function isDuplicate(list, url, excludeId) {
    var k = keyOf(url);
    if (!k || !Array.isArray(list)) return false;
    return list.some(function (e) {
      if (!e || (excludeId !== undefined && e.id === excludeId)) return false;
      return keyOf(e.url) === k;
    });
  }

  function parseTags(input) {
    var raw = Array.isArray(input) ? input : String(input == null ? '' : input).split(',');
    var out = [];
    raw.forEach(function (t) {
      t = String(t).trim().toLowerCase().replace(/[^a-z0-9#+._ -]/g, '').replace(/\s+/g, '-').replace(/^#+/, '').slice(0, LIMITS.tag);
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out.slice(0, LIMITS.tags);
  }

  /* -> { ok, errors:{field:msg}, value } ; value is only meaningful when ok. */
  function validateEntry(e) {
    e = e || {};
    var errors = {};
    var url = normalizeUrl(e.url);
    if (!url) errors.url = 'Enter a valid web address starting with http:// or https://';
    var title = String(e.title == null ? '' : e.title).trim();
    if (!title) errors.title = 'Add a title';
    else if (title.length > LIMITS.title) errors.title = 'Keep the title under ' + LIMITS.title + ' characters';
    var comment = String(e.comment == null ? '' : e.comment).trim();
    if (comment.length > LIMITS.comment) errors.comment = 'Keep your take under ' + LIMITS.comment + ' characters';
    var kind = e.kind == null || e.kind === '' ? 'article' : String(e.kind);
    if (KINDS.indexOf(kind) < 0) errors.kind = 'Choose a type from the list';
    var hasCat = e.category !== undefined && e.category !== null && e.category !== '';
    if (hasCat && CATEGORIES.indexOf(e.category) < 0) errors.category = 'Choose a section from the list';
    var ok = Object.keys(errors).length === 0, value = null;
    if (ok) { value = { url: url, title: title, comment: comment, kind: kind, tags: parseTags(e.tags) }; if (hasCat) value.category = e.category; }   // no category given: an edit keeps the entry's own
    return { ok: ok, errors: errors, value: value };
  }

  function shareLinks(url) {
    var n = normalizeUrl(url);
    if (!n) return null;
    return { url: n, linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(n) };
  }

  /* Normalises legacy {title,url,note} and new entries to one shape for rendering. */
  function entryView(e) {
    e = e || {};
    return {
      title: e.title || '',
      url: e.url || '',
      comment: e.comment != null && e.comment !== '' ? e.comment : (e.note || ''),
      kind: KINDS.indexOf(e.kind) >= 0 ? e.kind : 'article',
      tags: Array.isArray(e.tags) ? e.tags : [],
      category: categoryOf(e),
      added: e.added || ''
    };
  }

  function filterReads(list, opts) {
    opts = opts || {};
    var q = String(opts.q || '').trim().toLowerCase();
    return (list || []).filter(function (e) {
      var v = entryView(e);
      if (opts.category && v.category !== opts.category) return false;
      if (opts.tag && v.tags.indexOf(opts.tag) < 0) return false;
      if (!q) return true;
      return (v.title + ' ' + v.comment + ' ' + v.url + ' ' + v.tags.join(' ')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function allTags(list) {
    var count = {};
    (list || []).forEach(function (e) { entryView(e).tags.forEach(function (t) { count[t] = (count[t] || 0) + 1; }); });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || (a < b ? -1 : 1); });
  }

  /* Podcasts (SPEC-PC PC-01). Version of the shape of content/podcasts.json; same tolerance rule as reads (missing or older is fine, newer is refused). */
  var PODCASTS_SCHEMA_VERSION = 1;
  var PODCAST_LIMITS = { show: 80 };   // title, comment and tags share LIMITS with Reads
  function isSupportedPodcastsVersion(v) {
    return !(typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v > PODCASTS_SCHEMA_VERSION);
  }
  /* Closed list keyed on the host: the host itself or a subdomain of it (never a substring, so evilspotify.com is not Spotify). */
  var PLATFORMS = [['spotify.com', 'Spotify'], ['podcasts.apple.com', 'Apple Podcasts'], ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube']];
  /* Label for a card: a platform name, else the plain domain (text only, escaped by the page). '' when the URL is unusable. */
  function platformOf(url) {
    var n = normalizeUrl(url);
    if (!n) return '';
    var host = new URL(n).hostname.toLowerCase();
    for (var i = 0; i < PLATFORMS.length; i++) {
      var d = PLATFORMS[i][0];
      if (host === d || host.slice(-d.length - 1) === '.' + d) return PLATFORMS[i][1];
    }
    return host.replace(/^www\./, '');
  }
  /* One shape for rendering, whatever optional fields are missing. */
  function podcastView(e) {
    e = e && typeof e === 'object' ? e : {};
    var s = function (v) { return typeof v === 'string' ? v : ''; };
    return { title: s(e.title), url: s(e.url), show: s(e.show), comment: s(e.comment), tags: Array.isArray(e.tags) ? e.tags : [], added: s(e.added), platform: platformOf(e.url) };
  }

  /* Chooses the release file for a card's Download button (used by the products grid, not Reads).
     pattern: optional wildcard such as "PennyExpenseManager-*.zip" ('*' = any characters, case-insensitive).
     No pattern -> first asset (previous behavior). Pattern with no match -> null, so the card falls back
     to the release page instead of offering a wrong file. */
  function pickAsset(assets, pattern) {
    var list = Array.isArray(assets) ? assets.filter(function (a) { return a && a.name && a.download_url; }) : [];
    if (typeof pattern !== 'string' || !pattern.trim()) return list[0] || null;
    var re = new RegExp('^' + pattern.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
    return list.filter(function (a) { return re.test(a.name); })[0] || null;
  }

  /* '19 Oct 2026'. Date-only strings (2026-10-19) are calendar dates, so they are formatted in UTC;
     parsing them as local time would show the previous day to visitors west of Greenwich. */
  function formatDate(d) {
    var t = new Date(d);
    if (isNaN(t)) return '';
    var o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) o.timeZone = 'UTC';
    return t.toLocaleDateString('en-GB', o);
  }

  return { KINDS: KINDS, CATEGORIES: CATEGORIES, DEFAULT_NEW_CATEGORY: DEFAULT_NEW_CATEGORY, categoryOf: categoryOf, categoryCounts: categoryCounts, pickAsset: pickAsset, formatDate: formatDate, LIMITS: LIMITS, normalizeUrl: normalizeUrl, isPublishableUrl: isPublishableUrl, READS_SCHEMA_VERSION: READS_SCHEMA_VERSION, PODCASTS_SCHEMA_VERSION: PODCASTS_SCHEMA_VERSION, PODCAST_LIMITS: PODCAST_LIMITS, isSupportedPodcastsVersion: isSupportedPodcastsVersion, platformOf: platformOf, podcastView: podcastView, isSupportedReadsVersion: isSupportedReadsVersion, serializeReads: serializeReads, domainOf: domainOf, keyOf: keyOf, isDuplicate: isDuplicate,
    parseTags: parseTags, validateEntry: validateEntry, shareLinks: shareLinks, entryView: entryView,
    filterReads: filterReads, allTags: allTags };
});
