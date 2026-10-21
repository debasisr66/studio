'use strict';
const OWNER = 'debasisr66', HUB = 'studio', BRANCH = 'main';
const PAT_KEY = 'studio-admin-pat';
const SEEN_KEY = 'studio-seen-version';
const IDLE_MS = 30 * 60 * 1000;
const RL = window.ReadsLib;
const IL = window.ImageLib;
const LANG = {JavaScript:'#F1E05A',TypeScript:'#3178C6',Swift:'#F05138',Python:'#3572A5',Kotlin:'#A97BFF',Java:'#B07219',Go:'#00ADD8',Rust:'#DEA584',HTML:'#E34C26',CSS:'#563D7C',Dart:'#00B4AB','C#':'#178600',Ruby:'#701516',Shell:'#89E051'};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const fmtDate = RL.formatDate;
const fmtSize = n => n > 1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1, Math.round(n/1024))+' KB';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch {} };

/* Admin token: sessionStorage (this tab only, forgotten when it closes), memory-only if the browser blocks it.
   See js/token-store.js. Earlier versions kept the token in localStorage; it is deleted here, deliberately not migrated. */
const tokenStore = window.TokenStore.create(() => window.sessionStorage, PAT_KEY);
window.TokenStore.purge(() => window.localStorage, PAT_KEY);
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const NEWTAB = '<span class="sr"> (opens in a new tab)</span>';

/* The CSP forbids style attributes in markup, so the two dynamic values (avatar hue, language dot colour)
   travel as data attributes and are applied through the CSSOM, which the CSP allows. */
function paint(root = document) {
  root.querySelectorAll('[data-h]').forEach(e => e.style.setProperty('--h', e.dataset.h));
  root.querySelectorAll('[data-bg]').forEach(e => e.style.setProperty('background', e.dataset.bg));
}

/* polite announcement for screen readers and sighted users */
let statusTimer;
function say(msg) {
  const el = $('#status'); el.textContent = msg; el.classList.add('show');
  clearTimeout(statusTimer); statusTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* very small, safe markdown subset: paragraphs, "-"/"*" bullets, headings as bold, **bold**, `code` */
function md(text) {
  // links: only explicit http(s) targets become anchors; anything else (e.g. relative paths) keeps just its label
  const link = (m, label, href) => {
    const raw = href.replace(/&amp;/g, '&');
    return /^https?:\/\//i.test(raw) && safeUrl(raw) ? `<a href="${esc(safeUrl(raw))}" rel="noopener noreferrer" target="_blank">${label}</a>` : label;
  };
  const inline = s => esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, link).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code class="mono">$1</code>');
  let html = '', list = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const li = line.match(/^[-*]\s+(.*)/);
    if (li) { if (!list) { html += '<ul>'; list = true; } html += '<li>'+inline(li[1])+'</li>'; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)/);
    html += h ? '<p><strong>'+inline(h[1])+'</strong></p>' : '<p>'+inline(line)+'</p>';
  }
  return html + (list ? '</ul>' : '');
}

/* ---------- state ---------- */
const state = { changelog: null, registry: [], cache: null, blog: {posts: []}, reads: {books: [], articles: []}, profile: {photo: null, updated: null}, profileDraft: null, profileShown: null, dirty: {blog:false, reads:false, profile:false}, filter: {tag:'', q:''}, editing: -1 };

/* time-limited (SafeLib.FETCH_TIMEOUT_MS): a content file that never answers degrades its section instead of holding the page forever */
const loadJson = path => window.SafeLib.fetchJson(fetch, path + '?t=' + Date.now(), { init: { cache: 'no-store' } });

async function boot() {
  $('#yr').textContent = new Date().getFullYear();
  const [reg, cache, blog, reads, changelog, profile] = await Promise.allSettled([
    loadJson('content/products.json'), loadJson('content/cache.json'),
    loadJson('content/blog.json'), loadJson('content/reads.json'), loadJson('content/changelog.json'), loadJson('content/profile.json')]);
  // a file that loaded as JSON `null` or a bare value must not abort boot: only objects are used
  const obj = r => (r.status === 'fulfilled' && r.value && typeof r.value === 'object') ? r.value : null;
  const vProfile = obj(profile), vCache = obj(cache), vBlog = obj(blog), vReads = obj(reads), vLog = obj(changelog);
  if (vProfile) state.profile = vProfile;
  if (reg.status === 'fulfilled' && Array.isArray(reg.value)) state.registry = reg.value;
  if (vCache && typeof vCache.products === 'object') state.cache = vCache;
  if (vBlog && Array.isArray(vBlog.posts)) state.blog = vBlog;
  if (vReads) {
    // a file newer than this page understands is not shown or edited (Reads falls back, nothing can be published over it)
    if (!RL.isSupportedReadsVersion(vReads.schema_version)) state.readsUnsupported = true;
    else state.reads = { books: Array.isArray(vReads.books) ? vReads.books : [], articles: Array.isArray(vReads.articles) ? vReads.articles : [] };
  }
  if (vLog && Array.isArray(vLog.releases)) {
    // tolerate bad entries at runtime (CI rejects them before they ship): keep only well-formed releases
    state.changelog = vLog.releases.filter(r => r && typeof r.version === 'string' && typeof r.title === 'string' && Array.isArray(r.items));
    if (!state.changelog.length) state.changelog = null;
  }
  $('#grid').removeAttribute('aria-busy');
  renderAll();
  if (tokenStore.get()) enableAdmin();   // always reached: renderAll never throws
}

/* ---------- render: products, updates, blog ---------- */
function productView(e) {
  const live = state.cache && state.cache.products[e.repo];
  const name = e.name || e.repo.split('/')[1];
  return {
    e, live, name,
    tagline: e.tagline || (live && live.description) || '',
    url: (live && live.html_url) || 'https://github.com/' + e.repo,
    rel: live && live.latest_release,
  };
}

function renderProducts() {
  const list = state.registry.filter(p => p && p.repo && !p.hidden).map(productView)
    .sort((a,b) => (b.e.featured?1:0) - (a.e.featured?1:0));
  const notice = $('#notice');
  notice.innerHTML = '';
  if (!state.cache && list.length) notice.innerHTML = '<div class="notice" role="status">Live data is unavailable right now — showing basic product info.</div>';
  if (!list.length) { $('#grid').innerHTML = '<div class="empty grid-full">No products to show yet.</div>'; return; }
  $('#grid').innerHTML = list.map(p => {
    const l = p.live, lang = l && l.language;
    const site = safeUrl(p.e.url);
    const asset = p.rel ? RL.pickAsset(p.rel.assets, p.e.download_asset) : null;   // registry "download_asset" wildcard picks the app build
    const hasAsset = !!asset;
    const dl = p.rel && safeUrl(hasAsset ? asset.download_url : p.rel.download_url);
    return `<article class="card${p.e.featured ? ' featured' : ''}">
      <div class="row">${p.e.category ? `<span class="tag">${esc(p.e.category)}</span>` : ''}${p.rel ? `<span class="tag ver mono">${esc(p.rel.tag)}</span>` : ''}</div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.tagline)}</p>
      <div class="meta">
        ${lang ? `<span><i class="dot" data-bg="${esc(LANG[lang] || 'var(--muted)')}"></i>${esc(lang)}</span>` : ''}
        ${l ? `<span><span aria-hidden="true">★</span> ${Number(l.stars) || 0}<span class="sr"> stars</span></span>` : ''}
        ${l && l.pushed_at ? `<span>Updated ${esc(fmtDate(l.pushed_at))}</span>` : ''}
      </div>
      <div class="actions">
        ${site ? `<a class="primary" href="${esc(site)}" rel="noopener noreferrer" aria-label="Open ${esc(p.name)} (opens in a new tab)" target="_blank">Open app</a>` : ''}
        ${dl ? `<a class="${site ? '' : 'primary'}" href="${esc(dl)}" rel="noopener noreferrer" target="_blank" aria-label="${hasAsset ? 'Download' : 'Release notes for'} ${esc(p.name)} (opens in a new tab)">${hasAsset ? 'Download' : 'Release'}</a>` : ''}
        <a href="${esc(safeUrl(p.url))}" rel="noopener noreferrer" target="_blank" aria-label="${esc(p.name)} source code (opens in a new tab)">Source</a>
      </div></article>`;
  }).join('');
  paint($('#grid'));
  $('#syncnote').textContent = state.cache ? 'Live from GitHub' : '';
  $('#synced').textContent = state.cache && state.cache.synced_at ? fmtDate(state.cache.synced_at) : 'unavailable';
}

/* long release notes are collapsed (progressive disclosure); short ones show inline */
function notesHtml(body) {
  const html = md(body);
  if (!html) return '';
  return String(body).length > 500
    ? `<details class="notes"><summary>Show release notes</summary><div class="body">${html}</div></details>`
    : `<div class="body">${html}</div>`;
}

function renderUpdates() {
  const items = state.registry.filter(p => p && !p.hidden).map(productView).filter(p => p.rel)
    .sort((a,b) => new Date(b.rel.published_at) - new Date(a.rel.published_at));
  $('#updatesFeed').innerHTML = items.length ? items.map(p => `
    <article class="item">
      <div class="row"><span class="tag ver mono">${esc(p.rel.tag)}</span><span class="when">${esc(fmtDate(p.rel.published_at))}</span></div>
      <h3>${esc(p.name)} — ${esc(p.rel.name)}</h3>
      ${notesHtml(p.rel.body)}
      <div class="row mt10">${(p.rel.assets || []).map(a => safeUrl(a.download_url) ? `<a class="tag mono" href="${esc(safeUrl(a.download_url))}" rel="noopener noreferrer">⬇ ${esc(a.name)} · ${esc(fmtSize(a.size))}</a>` : '').join('')}
      <a class="more" href="${esc(safeUrl(p.rel.download_url))}" rel="noopener noreferrer" target="_blank">Release notes →${NEWTAB}</a></div>
    </article>`).join('') : '<div class="empty">No releases published yet. Release notes will appear here automatically.</div>';
}

const tools = (kind, i, what) => `<span class="tools"><button type="button" data-edit="${kind}:${i}" aria-label="Edit ${esc(what)}">Edit</button><button type="button" data-del="${kind}:${i}" aria-label="Delete ${esc(what)}">Delete</button></span>`;

function renderBlog() {
  const posts = [...state.blog.posts].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  $('#blogFeed').innerHTML = posts.length ? posts.map(p => {
    const i = state.blog.posts.indexOf(p), link = safeUrl(p.link);
    return `<article class="item">${tools('post', i, 'post ' + (p.title || ''))}<div class="when">${esc(fmtDate(p.date))}</div><h3>${esc(p.title)}</h3>
      <div class="body">${md(p.body)}${link ? `<a class="more" href="${esc(link)}" rel="noopener noreferrer" target="_blank">Read more →${NEWTAB}</a>` : ''}</div></article>`;
  }).join('') : '<div class="empty">No posts yet.</div>';
}

/* ---------- render: reads ---------- */
function readCard(entry, index, preview) {
  const v = RL.entryView(entry), url = RL.normalizeUrl(v.url), dom = url ? RL.domainOf(url) : null;
  const meta = [dom, v.kind, v.added ? fmtDate(v.added) : ''].filter(Boolean).map(esc).join(' · ');
  const share = !preview && url ? RL.shareLinks(url) : null;
  const title = v.title ? esc(v.title) : '<em>Untitled</em>';
  return `<article class="item read"${preview ? ' aria-hidden="true"' : ''}>${preview ? '' : tools('article', index, 'read ' + v.title)}
    <div class="read-head"><span class="avatar" aria-hidden="true" data-h="${hue(dom || v.title)}">${esc((dom || v.title || '?').charAt(0))}</span>
      <div>${url && !preview ? `<a class="read-title" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}${NEWTAB}</a>` : `<span class="read-title">${title}</span>`}
      <div class="when">${meta}</div></div></div>
    ${v.comment ? `<p class="read-comment">${esc(v.comment)}</p>` : ''}
    ${v.tags.length ? `<div class="read-tags">${v.tags.map(t => preview ? `<span class="tag">#${esc(t)}</span>` : `<button type="button" class="chip" data-tag="${esc(t)}" aria-label="Filter by tag ${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${share ? `<div class="share-row">
      <a href="${esc(share.linkedin)}" target="_blank" rel="noopener noreferrer">Share on LinkedIn${NEWTAB}</a>
      <button type="button" data-copy="${index}">Copy link</button>
      ${navigator.share ? `<button type="button" data-share="${index}">Share…</button>` : ''}</div>` : ''}
  </article>`;
}

function renderReads() {
  if (state.readsUnsupported) throw new Error('reads.json has a newer schema_version than this page supports');   // guarded: shows the fallback line
  const all = state.reads.articles.map((e, i) => ({e, i}));
  // newest first: dated entries by date, undated keep their original order after them
  all.sort((a, b) => { const da = (a.e && a.e.added) || '', db = (b.e && b.e.added) || ''; return da === db ? a.i - b.i : (da < db ? 1 : -1); });
  const shown = new Set(RL.filterReads(all.map(x => x.e), state.filter));
  const rows = all.filter(x => shown.has(x.e));

  const tags = RL.allTags(state.reads.articles);
  $('#toolbar').hidden = state.reads.articles.length < 4;
  $('#tagChips').innerHTML = tags.length ? [['', 'All'], ...tags.map(t => [t, '#' + t])].map(([t, label]) =>
    `<button type="button" class="chip" data-filter="${esc(t)}" aria-pressed="${state.filter.tag === t}">${esc(label)}</button>`).join('') : '';
  $('#readCount').textContent = state.reads.articles.length && (state.filter.tag || state.filter.q) ? `Showing ${rows.length} of ${state.reads.articles.length}` : '';

  $('#articlesFeed').innerHTML = rows.length ? rows.map(x => readCard(x.e, x.i, false)).join('')
    : state.reads.articles.length ? '<div class="empty">No reads match. <button type="button" class="chip" data-filter="">Clear filters</button></div>'
    : '<div class="empty">Nothing here yet. Check back soon.</div>';
  paint($('#articlesFeed'));

  const b = state.reads.books;
  $('#booksFeed').innerHTML = b.length ? b.map((x, i) => `
    <article class="item">${tools('book', i, 'book ' + (x.title || ''))}<h3>${esc(x.title)}</h3><div class="when">${esc(x.author)}${x.year ? ' · ' + esc(x.year) : ''}</div>${x.note ? `<div class="body">${esc(x.note)}</div>` : ''}</article>`).join('') : '<div class="empty">Nothing here yet.</div>';
}

/* Profile photo: shown when the manifest names one (path restricted to content/*.jpg, versioned by its timestamp so a new photo
   is never served stale), or when the owner has a draft. Otherwise the monogram stays. */
function renderProfile() {
  const img = $('#profileImg'), mono = $('#profileMono'), p = state.profile || {};
  let src = null;
  if (state.profileDraft) src = state.profileDraft.dataUrl;
  else if (state.profileShown) src = state.profileShown;   // just published: keep the local copy until the page is reloaded (Pages needs a minute or two)
  else if (typeof p.photo === 'string' && /^content\/[A-Za-z0-9._-]+\.jpg$/.test(p.photo)) src = p.photo + (p.updated ? '?v=' + encodeURIComponent(p.updated) : '');
  if (!src) { img.hidden = true; mono.hidden = false; img.removeAttribute('src'); return; }
  img.onerror = () => { img.hidden = true; mono.hidden = false; };
  if (img.getAttribute('src') !== src) img.src = src;
  img.hidden = false; mono.hidden = true;
}

/* One section failing must never stop another, or the admin unlock (SPEC-SH SH-01). Each renderer runs guarded; a failed one shows the
   fixed fallback line in its content box and logs the real error to the console only. */
const SECTION_BOX = { products: ['#grid'], updates: ['#updatesFeed'], blog: ['#blogFeed'], reads: ['#articlesFeed', '#booksFeed'] };
function renderAll() {
  window.SafeLib.runGuarded([
    { name: 'products', run: renderProducts }, { name: 'updates', run: renderUpdates }, { name: 'blog', run: renderBlog },
    { name: 'reads', run: renderReads }, { name: 'version', run: renderVersion }, { name: 'profile', run: renderProfile },
  ], (name, err) => {
    console.error('Studio: the ' + name + ' section failed to render', err);
    (SECTION_BOX[name] || []).forEach((sel, i) => { const el = $(sel); if (el) el.innerHTML = i === 0 ? window.SafeLib.fallbackHtml() : ''; });
  });
}

/* ---------- version + What's new ---------- */
const storageOk = (() => { try { localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe'); return true; } catch { return false; } })();
const latestRelease = () => (state.changelog && state.changelog[0]) || null;
const isUnseen = () => !!latestRelease() && storageOk && lsGet(SEEN_KEY) !== latestRelease().version;

function renderVersion() {
  const r = latestRelease();
  ['#whatsNewBtn', '#versionBtn'].forEach(sel => { $(sel).hidden = !r; });
  if (!r) return;
  $('#versionBtn').textContent = 'Studio v' + r.version;
  $('#versionBtn').setAttribute('aria-label', 'Studio version ' + r.version + ', open What\'s new');
  const unseen = isUnseen();
  $('#wnDot').hidden = !unseen;
  $('#whatsNewBtn').setAttribute('aria-label', unseen ? "What's new, new updates available" : "What's new");
}

function openWhatsNew() {
  const list = state.changelog; if (!list) return;
  modal.open(`<h3 id="modalTitle" tabindex="-1">What's new in Studio</h3>
    <ol class="releases">${list.map((r, i) => `<li class="rel">
      <div class="row"><span class="tag ver mono">v${esc(r.version)}</span>${i === 0 ? '<span class="tag">Latest</span>' : ''}<span class="when">${esc(fmtDate(r.date))}</span></div>
      <h4>${esc(r.title)}</h4>
      <ul>${r.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></li>`).join('')}</ol>
    <div class="btns"><button type="button" class="cta" id="mc">Close</button></div>`, '#modalTitle');
  $('#mc').onclick = modal.close;
  if (storageOk) lsSet(SEEN_KEY, list[0].version);
  renderVersion();
}
$('#whatsNewBtn').onclick = openWhatsNew;
$('#versionBtn').onclick = openWhatsNew;

/* ---------- theme + nav highlight ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t; lsSet('studio-theme', t);
  $('#theme').setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
setTheme(lsGet('studio-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
}), {rootMargin:'-40% 0px -55% 0px'});
document.querySelectorAll('section.block').forEach(s => io.observe(s));

/* ---------- admin: GitHub contents API ---------- */
const ghApi = (path, opts = {}) => fetch('https://api.github.com' + path, {...opts, headers: {
  Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tokenStore.get(), ...(opts.headers || {})}});
const b64enc = s => { const b = new TextEncoder().encode(s); let bin = ''; b.forEach(x => bin += String.fromCharCode(x)); return btoa(bin); };
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

/* GET current sha -> validate -> skip if unchanged -> PUT with sha. One file per commit. */
async function publishFile(path, obj, message) {
  let text;
  try { text = JSON.stringify(JSON.parse(JSON.stringify(obj)), null, 2) + '\n'; }
  catch (e) { throw new Error('Refusing to publish ' + path + ': invalid JSON (' + e.message + ')'); }
  const cur = await ghApi(`/repos/${OWNER}/${HUB}/contents/${path}?ref=${BRANCH}`);
  let sha;
  if (cur.status === 200) {
    const j = await cur.json(); sha = j.sha;
    if (b64dec(j.content) === text) return 'unchanged';
  } else if (cur.status !== 404) throw new Error('Could not read ' + path + ' (' + cur.status + ')');
  const put = await ghApi(`/repos/${OWNER}/${HUB}/contents/${path}`, {
    method: 'PUT', body: JSON.stringify({message, content: b64enc(text), branch: BRANCH, ...(sha ? {sha} : {})})});
  if (!put.ok) { const t = await put.text(); throw new Error('Publish of ' + path + ' failed (' + put.status + '): ' + t.slice(0, 200)); }
  return 'committed';
}

/* Binary twin of publishFile: GET sha -> skip if identical -> PUT with sha. One file per commit. */
async function publishBinary(path, b64, message) {
  if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) throw new Error('Refusing to publish ' + path + ': not valid base64');
  const cur = await ghApi(`/repos/${OWNER}/${HUB}/contents/${path}?ref=${BRANCH}`);
  let sha;
  if (cur.status === 200) {
    const j = await cur.json(); sha = j.sha;
    if (String(j.content || '').replace(/\s/g, '') === b64) return 'unchanged';
  } else if (cur.status !== 404) throw new Error('Could not read ' + path + ' (' + cur.status + ')');
  const put = await ghApi(`/repos/${OWNER}/${HUB}/contents/${path}`, {
    method: 'PUT', body: JSON.stringify({message, content: b64, branch: BRANCH, ...(sha ? {sha} : {})})});
  if (!put.ok) { const t = await put.text(); throw new Error('Publish of ' + path + ' failed (' + put.status + '): ' + t.slice(0, 200)); }
  return 'committed';
}

/* auto-lock after 30 minutes without interaction; unpublished drafts stay in memory */
const idle = window.TokenStore.createIdleLock(IDLE_MS, () => { lock(); say('Admin locked after 30 minutes of inactivity.'); });
const onActivity = () => { if (document.body.classList.contains('admin')) idle.arm(); };
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, onActivity, {passive: true}));

function enableAdmin() { document.body.classList.add('admin'); updateDirty(); idle.arm(); }
function lock() { tokenStore.del(); document.body.classList.remove('admin'); idle.disarm(); closeComposer(); }
function updateDirty() {
  const LABEL = {blog: 'blog.json', reads: 'reads.json', profile: 'profile photo'};
  const d = Object.entries(state.dirty).filter(([,v]) => v).map(([k]) => LABEL[k] || k);
  $('#dirtyinfo').innerHTML = d.length ? `<span class="dirty">Unpublished: ${d.join(', ')}</span>` : 'No pending changes';
  $('#publishBtn').disabled = !d.length;
}

/* ---------- modal: focus trap, restore focus, Escape ---------- */
let lastFocus = null;
const modal = {
  open(html, focusSel) {
    lastFocus = document.activeElement;
    $('#modal').innerHTML = html; $('#modalBg').classList.add('open');
    const f = $(focusSel || '#modal input,#modal textarea,#modal button'); f && f.focus();
  },
  close() {
    $('#modalBg').classList.remove('open'); $('#modal').innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); lastFocus = null;
  },
  err(m) {
    let e = $('#modal .err');
    if (!e) { e = document.createElement('div'); e.className = 'err'; e.setAttribute('role', 'alert'); $('#modal').appendChild(e); }
    e.textContent = m;
  },
};
$('#modalBg').addEventListener('mousedown', e => { if (e.target.id === 'modalBg') modal.close(); });
document.addEventListener('keydown', e => {
  if (!$('#modalBg').classList.contains('open')) return;
  if (e.key === 'Escape') return modal.close();
  if (e.key !== 'Tab') return;
  const f = [...$('#modal').querySelectorAll('button:not([disabled]),input,textarea,select,a[href]')];
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

$('#gear').onclick = () => {
  if (document.body.classList.contains('admin')) { say('Admin mode is on. Use "Lock & sign out" at the bottom to leave it.'); return; }
  modal.open(`<h3 id="modalTitle">Admin access</h3>
    <p class="muted-sm">Paste a GitHub personal access token with write access to <span class="mono">${OWNER}/${HUB}</span>. It stays in this tab only and is forgotten when you close it.</p>
    <label for="pat">Token</label><input id="pat" type="password" autocomplete="off" placeholder="github_pat_…">
    <div class="btns"><button type="button" class="cta ghost" id="mc">Cancel</button><button type="button" class="cta" id="mu">Unlock</button></div>`);
  $('#mc').onclick = modal.close;
  const go = async () => {
    const pat = $('#pat').value.trim(); if (!pat) return modal.err('Paste your token to continue.');
    $('#mu').disabled = true;
    try {
      const r = await fetch('https://api.github.com/user', {headers: {Authorization: 'Bearer ' + pat, Accept: 'application/vnd.github+json'}});
      if (!r.ok) throw new Error('GitHub rejected the token (' + r.status + '). Check it has not expired.');
      const u = await r.json();
      if (u.login !== OWNER) throw new Error('This token belongs to "' + u.login + '", but admin is limited to "' + OWNER + '".');
      tokenStore.set(pat); modal.close(); enableAdmin(); say('Admin unlocked.');
    } catch (e) { modal.err(e.message); $('#mu').disabled = false; }
  };
  $('#mu').onclick = go;
  $('#pat').onkeydown = e => { if (e.key === 'Enter') go(); };
};
$('#lockBtn').onclick = () => {
  if (Object.values(state.dirty).some(Boolean) && !confirm('You have unpublished changes. Sign out anyway? (Changes stay on this page until you reload.)')) return;
  lock(); say('Admin locked.');
};

/* ---------- reads composer (LinkedIn-style "Share a read") ---------- */
const cf = id => $('#cf-' + id);
const COMPOSER_FIELDS = ['url', 'title', 'comment'];

function openComposer(editIndex = -1) {
  state.editing = editIndex;
  const e = editIndex >= 0 ? RL.entryView(state.reads.articles[editIndex]) : {url:'', title:'', comment:'', kind:'article', tags:[]};
  cf('url').value = e.url; cf('title').value = e.title; cf('comment').value = e.comment;
  cf('kind').value = e.kind; cf('tags').value = e.tags.join(', ');
  $('#composerTitle').textContent = editIndex >= 0 ? 'Edit read' : 'Share a read';
  cf('submit').textContent = editIndex >= 0 ? 'Save changes' : 'Post';
  clearErrors(); updateCount(); updatePreview();
  $('#composer').classList.add('open'); $('#composerOpen').setAttribute('aria-expanded', 'true');
  $('#composer').scrollIntoView({block: 'nearest'});
  cf('url').focus();
}
function closeComposer() {
  state.editing = -1; $('#composer').classList.remove('open');
  $('#composerOpen').setAttribute('aria-expanded', 'false'); $('#composerForm').reset();
}
function clearErrors() {
  COMPOSER_FIELDS.forEach(f => { cf(f + '-err').textContent = ''; cf(f).removeAttribute('aria-invalid'); });
}
function showErrors(errors) {
  clearErrors();
  COMPOSER_FIELDS.forEach(f => { if (errors[f]) { cf(f + '-err').textContent = errors[f]; cf(f).setAttribute('aria-invalid', 'true'); } });
  const first = COMPOSER_FIELDS.find(f => errors[f]); if (first) cf(first).focus();
}
function composerValue() {
  return {url: cf('url').value, title: cf('title').value, comment: cf('comment').value, kind: cf('kind').value, tags: cf('tags').value};
}
function updateCount() {
  const n = cf('comment').value.length, c = $('#cf-count');
  c.textContent = n; c.parentElement.classList.toggle('bad', n > RL.LIMITS.comment);
}
function updatePreview() {
  const v = composerValue(), n = RL.normalizeUrl(v.url);
  $('#cf-preview').innerHTML = (n || v.title) ? readCard({url: n || '', title: v.title.trim(), comment: v.comment.trim(), kind: v.kind, tags: RL.parseTags(v.tags), added: new Date().toISOString().slice(0, 10)}, -1, true)
    : '<div class="empty">Your post will appear here as you type.</div>';
  paint($('#cf-preview'));
}

$('#composerOpen').onclick = () => openComposer(-1);
$('#cf-cancel').onclick = () => { closeComposer(); $('#composerOpen').focus(); };
$('#composerForm').addEventListener('input', () => { updateCount(); updatePreview(); });
$('#composerForm').addEventListener('keydown', e => { if (e.key === 'Escape') { closeComposer(); $('#composerOpen').focus(); } });
$('#composerForm').addEventListener('submit', ev => {
  ev.preventDefault();
  if (!document.body.classList.contains('admin')) return;
  const r = RL.validateEntry(composerValue());
  const errors = {...r.errors};
  if (r.ok && RL.isDuplicate(state.reads.articles, r.value.url, state.editing >= 0 ? state.reads.articles[state.editing].id : undefined) &&
      !(state.editing >= 0 && RL.normalizeUrl(state.reads.articles[state.editing].url) === r.value.url)) errors.url = 'This link is already in your reading list.';
  if (r.errors.kind) errors.title = errors.title || r.errors.kind;
  if (Object.keys(errors).length) return showErrors(errors);

  if (state.editing >= 0) {
    const old = state.reads.articles[state.editing], next = {...old, ...r.value};
    delete next.note;   // legacy field replaced by "comment"
    if (!next.id) next.id = Date.now();
    state.reads.articles[state.editing] = next;
    say('Changes saved. Publish to make them public.');
  } else {
    state.reads.articles.unshift({id: Date.now(), added: new Date().toISOString().slice(0, 10), ...r.value});
    say('Added. Publish to make it public.');
  }
  state.dirty.reads = true; updateDirty(); closeComposer(); renderAll(); $('#composerOpen').focus();
});

/* ---------- generic editor for blog posts and books ---------- */
const SCHEMAS = {
  post: {title:'Blog post', fields:[['title','Title','input',1],['date','Date (YYYY-MM-DD)','input',1],['body','Body (supports - bullets, **bold**)','textarea',1],['link','Link (optional)','input']], list:()=>state.blog.posts, file:'blog', make:()=>({id:Date.now(), date:new Date().toISOString().slice(0,10), title:'', body:'', link:''})},
  article: {title:'Read', list:()=>state.reads.articles, file:'reads'},
  book: {title:'Book', fields:[['title','Title','input',1],['author','Author','input',1],['year','Year','input'],['note','Note','textarea']], list:()=>state.reads.books, file:'reads', make:()=>({title:'', author:'', year:'', note:''})},
};
function editItem(kind, idx) {
  if (kind === 'article') return openComposer(idx);
  const s = SCHEMAS[kind], list = s.list(), isNew = idx < 0, item = isNew ? s.make() : {...list[idx]};
  modal.open(`<h3 id="modalTitle">${isNew ? 'Add' : 'Edit'} ${s.title.toLowerCase()}</h3>` + s.fields.map(([k,l,t]) =>
    `<label for="f-${k}">${esc(l)}</label>${t === 'textarea' ? `<textarea id="f-${k}" data-k="${k}">${esc(item[k])}</textarea>` : `<input id="f-${k}" data-k="${k}" value="${esc(item[k])}">`}`).join('') +
    `<div class="btns"><button type="button" class="cta ghost" id="mc">Cancel</button><button type="button" class="cta" id="ms">Save</button></div>`);
  $('#mc').onclick = modal.close;
  $('#ms').onclick = () => {
    for (const [k,,,req] of s.fields) {
      const v = $(`#modal [data-k="${k}"]`).value.trim();
      if (req && !v) return modal.err('Please fill in: ' + s.fields.find(f => f[0] === k)[1]);
      item[k] = v;
    }
    if (kind === 'post' && !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return modal.err('Date must be YYYY-MM-DD');
    if (kind === 'post' && item.link && !safeUrl(item.link)) return modal.err('Link must start with http:// or https://');
    if (kind === 'book') item.year = item.year && /^\d+$/.test(item.year) ? Number(item.year) : item.year;
    if (isNew) list.push(item); else list[idx] = item;
    state.dirty[s.file] = true; updateDirty(); renderAll(); modal.close();
  };
}
$('#addPost').onclick = () => editItem('post', -1);
$('#addBook').onclick = () => editItem('book', -1);

/* ---------- delegated clicks: edit, delete, filter, share ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} t.remove(); return ok;
}
document.addEventListener('click', async e => {
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (ed) { const [k,i] = ed.dataset.edit.split(':'); editItem(k, +i); return; }
  if (del) {
    const [k,i] = del.dataset.del.split(':'), s = SCHEMAS[k];
    if (confirm('Delete this ' + s.title.toLowerCase() + '? (Takes effect when you publish.)')) { s.list().splice(+i, 1); state.dirty[s.file] = true; updateDirty(); renderAll(); say('Deleted. Publish to make it public.'); }
    return;
  }
  const flt = e.target.closest('[data-filter]'), tag = e.target.closest('[data-tag]');
  if (flt || tag) {
    state.filter.tag = flt ? flt.dataset.filter : (state.filter.tag === tag.dataset.tag ? '' : tag.dataset.tag);
    if (flt && flt.dataset.filter === '') { state.filter.q = ''; $('#readSearch').value = ''; }
    renderReads(); return;
  }
  const cp = e.target.closest('[data-copy]'), sh = e.target.closest('[data-share]');
  if (cp || sh) {
    const entry = state.reads.articles[+(cp || sh).dataset[cp ? 'copy' : 'share']], links = entry && RL.shareLinks(entry.url);
    if (!links) return;
    if (cp) say(await copyText(links.url) ? 'Link copied.' : 'Could not copy. Select the link and copy it manually.');
    else { try { await navigator.share({title: entry.title, url: links.url}); } catch {} }
  }
});
$('#readSearch').addEventListener('input', e => { state.filter.q = e.target.value; renderReads(); });

$('#publishBtn').onclick = async () => {
  const files = [['blog', 'content/blog.json', () => ({posts: state.blog.posts}), 'blog'], ['reads', 'content/reads.json', () => RL.serializeReads(state.reads), 'reading list']];
  const todo = files.filter(f => state.dirty[f[0]]);
  const hasPhoto = !!(state.dirty.profile && state.profileDraft);
  if (!todo.length && !hasPhoto) return;
  $('#publishBtn').disabled = true;
  const out = [];
  for (const [key, path, get, label] of todo) {   // one file per commit; a failure leaves the others untouched
    if (key === 'reads' && state.readsUnsupported) { out.push(path + ': not published: this file is newer than the page understands (reload the page)'); continue; }
    try { const r = await publishFile(path, get(), `cms: update ${label}`); state.dirty[key] = false; out.push(path + ': ' + r); }
    catch (e) { out.push(path + ': ' + e.message); }
  }
  if (hasPhoto) {   // photo first, then the manifest that shows it, so the manifest never points at a missing file
    try {
      const r1 = await publishBinary('content/profile.jpg', state.profileDraft.base64, 'cms: update profile photo');
      let updated = state.profile && state.profile.updated;
      if (r1 === 'committed' || !(state.profile && state.profile.photo)) updated = new Date().toISOString();
      const r2 = await publishFile('content/profile.json', {photo: 'content/profile.jpg', updated}, 'cms: show profile photo');
      state.profile = {photo: 'content/profile.jpg', updated}; state.profileShown = state.profileDraft.dataUrl; state.profileDraft = null; state.dirty.profile = false;
      out.push('content/profile.jpg: ' + r1, 'content/profile.json: ' + r2);
    } catch (e) { out.push('profile photo: ' + e.message); }
  }
  updateDirty();
  modal.open('<h3 id="modalTitle">Publish result</h3><pre class="mono pre-result">' + esc(out.join('\n')) + '</pre><p class="muted-xs">GitHub Pages usually reflects changes within a minute or two.</p><div class="btns"><button type="button" class="cta" id="mc">Close</button></div>');
  $('#mc').onclick = modal.close;
};
window.addEventListener('beforeunload', e => { if (Object.values(state.dirty).some(Boolean)) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- profile photo: choose, crop, re-encode, preview ---------- */
async function processPhoto(file) {
  const chk = IL.checkFile(file); if (!chk.ok) throw new Error(chk.error);
  let bmp;
  try { bmp = await createImageBitmap(file, {imageOrientation: 'from-image'}); }
  catch { try { bmp = await createImageBitmap(file); } catch { throw new Error("That file isn't a usable image."); } }
  const dim = IL.checkDimensions(bmp.width, bmp.height);
  if (!dim.ok) { bmp.close(); throw new Error(dim.error); }
  const {sx, sy, side} = IL.cropSquare(bmp.width, bmp.height), S = IL.LIMITS.outSide;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);   // transparent PNGs become white, not black
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, S, S); bmp.close();
  const bytesAt = q => IL.base64Bytes(IL.dataUrlToBase64(canvas.toDataURL('image/jpeg', q)) || '');
  const pick = IL.chooseQuality(bytesAt, IL.LIMITS.outMaxBytes);
  if (!pick.ok) throw new Error('That photo could not be made small enough. Try a simpler image.');
  const dataUrl = canvas.toDataURL('image/jpeg', pick.quality), base64 = IL.dataUrlToBase64(dataUrl);
  if (!base64) throw new Error("That file isn't a usable image.");
  return {dataUrl, base64, bytes: IL.base64Bytes(base64), quality: pick.quality};
}
function showPhotoError(msg) {
  modal.open(`<h3 id="modalTitle" tabindex="-1">Can't use that photo</h3><p class="muted-sm">${esc(msg)}</p><div class="btns"><button type="button" class="cta" id="mc">Close</button></div>`, '#modalTitle');
  $('#mc').onclick = modal.close;
}
function openPhotoPreview(res) {
  modal.open(`<h3 id="modalTitle" tabindex="-1">Use this photo?</h3>
    <img class="photo-preview" src="${esc(res.dataUrl)}" alt="Preview of your profile photo">
    <p class="muted-sm">${IL.LIMITS.outSide} × ${IL.LIMITS.outSide} px, ${Math.max(1, Math.round(res.bytes / 1024))} KB. The photo will be public once published. Location and camera details are removed.</p>
    <div class="btns"><button type="button" class="cta ghost" id="mc">Cancel</button><button type="button" class="cta" id="mu">Use this photo</button></div>`, '#modalTitle');
  $('#mc').onclick = modal.close;
  $('#mu').onclick = () => {
    state.profileDraft = res; state.dirty.profile = true; updateDirty(); renderProfile(); modal.close();
    say('Photo ready. Publish to make it public.');
  };
}
$('#changePhoto').onclick = () => $('#photoFile').click();
$('#photoFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { openPhotoPreview(await processPhoto(f)); } catch (err) { showPhotoError(err.message); }
});

boot();
