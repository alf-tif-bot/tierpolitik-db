
const key='tierpolitik.review';
const uiKey='tierpolitik.review.ui';
const fastlaneTagKey='tierpolitik.review.fastlaneTags';
const initialFastlaneTags={"ch-parliament-business-de:20223210-de":{"fastlane":true,"taggedAt":"2026-02-14T10:46:37.937Z"},"ch-parliament-business-de:20250078-de":{"fastlane":true,"taggedAt":"2026-02-14T08:25:12.936Z"},"ch-parliament-business-de:20213835-de":{"fastlane":true,"taggedAt":"2026-02-14T08:25:24.389Z"},"ch-parliament-business-de:20213405-de":{"fastlane":true,"taggedAt":"2026-02-14T08:25:32.546Z"},"ch-parliament-business-de:20233515-de":{"fastlane":true,"taggedAt":"2026-02-14T08:25:44.286Z"},"ch-parliament-business-de:20237115-de":{"fastlane":true,"taggedAt":"2026-02-14T08:25:54.185Z"},"ch-parliament-business-de:20227807-de":{"fastlane":true,"taggedAt":"2026-02-14T08:26:08.828Z"},"ch-parliament-business-de:20258205-de":{"fastlane":true,"taggedAt":"2026-02-14T08:26:27.637Z"},"ch-parliament-business-de:20244696-de":{"fastlane":true,"taggedAt":"2026-02-14T08:28:00.545Z"},"ch-parliament-business-de:20244695-de":{"fastlane":true,"taggedAt":"2026-02-14T08:28:13.450Z"},"ch-parliament-business-de:20244465-de":{"fastlane":true,"taggedAt":"2026-02-14T10:34:56.969Z"},"ch-parliament-business-de:20240436-de":{"fastlane":true,"taggedAt":"2026-02-14T10:44:57.766Z"},"ch-parliament-business-de:20223300-de":{"fastlane":true,"taggedAt":"2026-02-14T10:45:09.382Z"},"ch-parliament-business-de:20213363-de":{"fastlane":true,"taggedAt":"2026-02-14T10:45:19.848Z"},"ch-parliament-business-de:20213364-de":{"fastlane":true,"taggedAt":"2026-02-14T10:45:28.520Z"},"ch-parliament-business-de:20212004-de":{"fastlane":true,"taggedAt":"2026-02-14T10:45:41.919Z"},"ch-parliament-business-de:20253976-de":{"fastlane":true,"taggedAt":"2026-02-14T10:46:04.703Z"},"ch-parliament-business-de:20250059-de":{"fastlane":true,"taggedAt":"2026-02-14T10:46:16.584Z"},"ch-parliament-business-de:20232009-de":{"fastlane":true,"taggedAt":"2026-02-14T10:46:29.666Z"},"ch-parliament-business-de:20214167-de":{"fastlane":true,"taggedAt":"2026-02-14T10:47:07.633Z"},"ch-parliament-business-de:20252027-de":{"fastlane":true,"taggedAt":"2026-02-14T10:47:24.017Z"},"ch-parliament-business-de:20244344-de":{"fastlane":true,"taggedAt":"2026-02-14T10:47:42.196Z"},"ch-parliament-business-de:20243296-de":{"fastlane":true,"taggedAt":"2026-02-14T10:47:57.369Z"},"ch-parliament-business-de:20223952-de":{"fastlane":true,"taggedAt":"2026-02-14T10:48:16.353Z"},"ch-parliament-business-de:20223808-de":{"fastlane":true,"taggedAt":"2026-02-14T10:48:30.730Z"},"ch-parliament-business-de:20258063-de":{"fastlane":true,"taggedAt":"2026-02-14T10:48:46.707Z"},"ch-parliament-business-de:20213229-de":{"fastlane":true,"taggedAt":"2026-02-14T10:50:13.054Z"},"ch-parliament-business-de:20223302-de":{"fastlane":true,"taggedAt":"2026-02-14T10:50:31.269Z"},"ch-parliament-business-de:20231034-de":{"fastlane":true,"taggedAt":"2026-02-14T10:50:39.327Z"},"ch-parliament-business-de:20243277-de":{"fastlane":true,"taggedAt":"2026-02-14T10:51:01.036Z"},"ch-parliament-business-de:20254144-de":{"fastlane":true,"taggedAt":"2026-02-14T10:51:22.151Z"},"ch-parliament-business-de:20213703-de":{"fastlane":true,"taggedAt":"2026-02-14T10:51:32.388Z"},"ch-parliament-business-de:20212027-de":{"fastlane":true,"taggedAt":"2026-02-14T10:51:44.244Z"},"ch-municipal-parliament-bern-zurich:municipal-bern-api-c6c65c8ce8a84435af97428996dadc64":{"fastlane":true,"taggedAt":"2026-02-14T18:37:06.036Z"},"ch-municipal-parliament-bern-zurich:municipal-bern-api-13284d70bb124c23a1bbba427e8a7c5c":{"fastlane":true,"taggedAt":"2026-02-14T18:37:25.611Z"},"user-input:user-bern-2026sr0019-tierpark-alternativen-toetung":{"fastlane":true,"taggedAt":"2026-02-14T18:43:35.637Z"},"ch-municipal-parliament-bern-zurich:municipal-bern-api-b7e265b3766d43119b5279f5ea795e91":{"fastlane":true,"taggedAt":"2026-02-14T18:44:17.747Z"},"user-input:user-bern-2026sr0056-biodiversitaet":{"fastlane":true,"taggedAt":"2026-02-14T22:33:21.861Z"},"ch-parliament-business-de:20203021-de":{"fastlane":true,"taggedAt":"2026-02-14T22:33:43.182Z"},"ch-cantonal-be-rss:www-gr-be-ch-de-start-geschaefte-geschaeftssuche-geschaeftsdetail-html-guid-57c34c78ddf541f098b29f4c2be2cbfa":{"fastlane":true,"taggedAt":"2026-02-15T09:51:04.074Z"}};
const lsGet=(k)=>{ try { return localStorage.getItem(k); } catch { return null; } };
const lsSet=(k,v)=>{ try { localStorage.setItem(k,v); } catch {} };
const LEGACY_API_BASE_KEY='tierpolitik.apiBase';
const LEGACY_NETLIFY_RE=/netlify.app/.netlify/functions/i;
const storedApiBaseRaw = lsGet(LEGACY_API_BASE_KEY) || '';
if (LEGACY_NETLIFY_RE.test(storedApiBaseRaw)) {
  try { localStorage.removeItem(LEGACY_API_BASE_KEY); } catch {}
}
const API_BASE='';
const apiUrl=(path)=> (API_BASE ? API_BASE : '') + path;
let DEBUG_REVIEW = /(?:\?|&)debug=1(?:&|$)/.test(location.search) || lsGet('tierpolitik.review.debug') === '1';
const debugState = { lines: [] };
const renderDebug = () => {
  const box = document.getElementById('review-debug-box');
  const pre = document.getElementById('review-debug-log');
  if (!box || !pre) return;
  box.style.display = DEBUG_REVIEW ? '' : 'none';
  pre.textContent = debugState.lines.slice(-30).join('\n');
};
const dbg = (...args) => {
  const line = args.map((a) => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
  debugState.lines.push(line);
  if (DEBUG_REVIEW) console.log('[review-debug]', ...args);
  renderDebug();
};
window.toggleDebugPanel = function toggleDebugPanel(){
  DEBUG_REVIEW = !DEBUG_REVIEW;
  lsSet('tierpolitik.review.debug', DEBUG_REVIEW ? '1' : '0');
  dbg('debug-panel', { enabled: DEBUG_REVIEW });
  renderDebug();
}
window.functions = window.functions || {}
window.functions.toggleDebugPanel = window.toggleDebugPanel
window.__reviewDebug = {
  hostname: location.hostname,
  storedApiBaseRaw,
  legacyApiBaseRemoved: LEGACY_NETLIFY_RE.test(storedApiBaseRaw),
  effectiveApiBase: API_BASE || '(same-origin)',
};
dbg('boot', window.__reviewDebug);
const safeJsonParse=(raw, fallback={})=>{
  try { return JSON.parse(raw || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const read=()=>safeJsonParse(lsGet(key),{});
const write=(v)=>lsSet(key,JSON.stringify(v,null,2));
const readFastlaneTags=()=>{
  const local = safeJsonParse(lsGet(fastlaneTagKey),{});
  return { ...initialFastlaneTags, ...local };
};
const writeFastlaneTags=(v)=>lsSet(fastlaneTagKey,JSON.stringify(v));
const readUi=()=>safeJsonParse(lsGet(uiKey),{});
const writeUi=(v)=>lsSet(uiKey,JSON.stringify(v));

const statusLabelFor = (status = '') => {
  const s = String(status || '').toLowerCase()
  if (s === 'queued' || s === 'new') return 'offen'
  if (s === 'approved') return 'gutgeheissen'
  if (s === 'published') return 'publiziert'
  if (s === 'rejected') return 'abgelehnt'
  return s || '-'
}
// Backward-compat alias for older handlers that may still call this name.
const reviewStatusLabel = statusLabelFor

let viewMode = 'open';

document.querySelectorAll('tr[data-id]').forEach((row, idx) => {
  row.setAttribute('data-base-order', String(idx))
});

function updateStatusSummary(){
  const stats = { offen: 0, gutgeheissen: 0, publiziert: 0 }
  let visibleRows = 0
  document.querySelectorAll('tr[data-id]').forEach((row)=>{
    const hidden = row.style.display === 'none'
    if (hidden) return
    visibleRows += 1
    const status = String(row.getAttribute('data-status') || '').toLowerCase()
    if (status === 'queued' || status === 'new') stats.offen += 1
    else if (status === 'approved') stats.gutgeheissen += 1
    else if (status === 'published') stats.publiziert += 1
  })
  const el = document.getElementById('status-summary')
  if (el) {
    el.textContent = 'Status-Summen (sichtbar): offen=' + stats.offen + ', gutgeheissen=' + stats.gutgeheissen + ', publiziert=' + stats.publiziert
    if (visibleRows === 0) el.textContent += ' · keine offenen Einträge'
  }
}

function hideDecidedRows(){
  const decisions = read();
  const rows = [...document.querySelectorAll('tr[data-id]')]
  const decidedById = {}

  const localAffairDecided = new Set(Object.keys(decisions)
    .filter((id) => String(id).startsWith('ch-parliament-'))
    .map((id) => {
      const external = String(id).split(':')[1] || ''
      return String(external).split('-')[0]
    })
    .filter(Boolean))

  rows.forEach((row)=>{
    const id = row.getAttribute('data-id');
    if (!id) return
    const rowStatus = String(row.getAttribute('data-status') || '').toLowerCase()
    const localStatus = String(decisions[id]?.status || '').toLowerCase()
    const effectiveStatus = localStatus || rowStatus

    const serverDecided = rowStatus !== 'queued' && rowStatus !== 'new'
    const localDecided = Boolean(decisions[id])
    const isParliamentEntry = String(id).startsWith('ch-parliament-')
    const affairId = isParliamentEntry ? (String(id).split(':')[1] || '').split('-')[0] : ''
    const localAffairHit = Boolean(affairId) && localAffairDecided.has(affairId)
    const decided = serverDecided || localDecided || localAffairHit
    decidedById[id] = decided

    if (localStatus) {
      row.setAttribute('data-status', localStatus)
    }

    const statusLabelEl = row.querySelector('[data-status-label]')
    const statusBadgeEl = row.querySelector('[data-status-badge]')
    if (statusLabelEl) statusLabelEl.textContent = statusLabelFor(effectiveStatus)
    if (statusBadgeEl) {
      statusBadgeEl.innerHTML = (effectiveStatus === 'queued' || effectiveStatus === 'new')
        ? '<strong class="pending">offen</strong>'
        : '<span class="historic">historisch</span>'
    }

    if (viewMode === 'rejected') {
      const isRejected = effectiveStatus === 'rejected'
      row.style.display = isRejected ? '' : 'none'
    } else {
      const isOpen = effectiveStatus === 'queued' || effectiveStatus === 'new'
      row.style.display = isOpen ? '' : 'none'
    }
  });

  const tbody = rows[0]?.parentElement
  if (tbody) {
    if (viewMode === 'rejected') {
      rows
        .filter((row) => row.style.display !== 'none')
        .sort((a, b) => {
          const aId = a.getAttribute('data-id') || ''
          const bId = b.getAttribute('data-id') || ''
          const aTs = Date.parse(String(decisions[aId]?.decidedAt || '')) || 0
          const bTs = Date.parse(String(decisions[bId]?.decidedAt || '')) || 0
          if (bTs !== aTs) return bTs - aTs
          return Number(a.getAttribute('data-base-order') || 0) - Number(b.getAttribute('data-base-order') || 0)
        })
        .forEach((row) => tbody.appendChild(row))
    } else {
      rows
        .sort((a, b) => Number(a.getAttribute('data-base-order') || 0) - Number(b.getAttribute('data-base-order') || 0))
        .forEach((row) => tbody.appendChild(row))
    }
  }

  document.querySelectorAll('.fastlane-card[data-id]').forEach((card)=>{
    const id = card.getAttribute('data-id')
    if (!id) return
    const decided = Boolean(decidedById[id]) || Boolean(decisions[id])
    card.style.display = (viewMode === 'rejected' || decided) ? 'none' : ''
  })

  const openBtn = document.getElementById('view-open')
  const rejectedBtn = document.getElementById('view-rejected')
  if (openBtn) openBtn.classList.toggle('active', viewMode === 'open')
  if (rejectedBtn) rejectedBtn.classList.toggle('active', viewMode === 'rejected')

  updateStatusSummary();
}

window.setViewMode = function setViewMode(mode){
  viewMode = mode === 'rejected' ? 'rejected' : 'open'
  hideDecidedRows()
}

window.clearLocalReviewState = function clearLocalReviewState(){
  lsSet(key, JSON.stringify({}))
  viewMode = 'open'
  const statusEl = document.getElementById('decision-status')
  if (statusEl) statusEl.textContent = 'Lokale Entscheidungen gelöscht.'
  hideDecidedRows()
}

function renderFastlaneTagButton(id){
  const tags = readFastlaneTags();
  const isTagged = Boolean(tags[id]?.fastlane);
  document.querySelectorAll('[data-tag-btn="' + id + '"]').forEach((btn)=>{
    btn.textContent = isTagged ? 'Fastlane: AN' : 'Fastlane: AUS';
  });
}

window.toggleFastlaneTag = async function toggleFastlaneTag(btn,id){
  const tags = readFastlaneTags();
  const next = !Boolean(tags[id]?.fastlane);
  const taggedAt = new Date().toISOString();
  if (btn) btn.disabled = true;

  let serverOk = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = apiUrl('/review-fastlane-tag');
    dbg('fastlane:request', { id, next, url });
    const res = await fetch(url, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, fastlane: next, taggedAt }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    dbg('fastlane:response', { id, next, code: res.status, ok: res.ok });
    if (res.ok) serverOk = true;
  } catch (err) {
    dbg('fastlane:error', { id, next, message: String(err?.message || err) });
  }

  tags[id] = { fastlane: next, taggedAt };
  writeFastlaneTags(tags);
  renderFastlaneTagButton(id);

  document.querySelectorAll('tr[data-id="' + id + '"]').forEach((row)=>{
    row.setAttribute('data-fastlane-tagged', next ? '1' : '0');
  })
  document.querySelectorAll('.fastlane-card[data-id="' + id + '"]').forEach((card)=>{
    card.setAttribute('data-fastlane-tagged', next ? '1' : '0');
  })

  const statusEl = document.getElementById('decision-status');
  if (statusEl) {
    statusEl.textContent = serverOk
      ? 'Fastlane-Markierung gespeichert.'
      : 'Fastlane lokal markiert (Server nicht erreichbar).';
  }

  if (btn) btn.disabled = false;
}

window.setDecision = async function setDecision(btn,id,status){
  const decidedAt = new Date().toISOString();
  const statusEl = document.getElementById('decision-status');
  if (statusEl) statusEl.textContent = 'Speichere Entscheidung…';

  if (btn) btn.disabled = true;

  // Optimistic UI: hide immediately, even if API is slow/unreachable.
  const clickedRow = btn ? btn.closest('tr[data-id]') : null;
  if (clickedRow) {
    clickedRow.setAttribute('data-status', status)
    clickedRow.style.opacity = '0.72'
    clickedRow.style.display='none'
  }

  document.querySelectorAll('tr[data-id="' + id + '"]').forEach((row)=>{
    row.setAttribute('data-status', status)
    row.style.opacity = '0.72'
    row.style.display='none'
  })

  let serverOk = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = apiUrl('/review-decision');
    dbg('setDecision:request', { id, status, url });

    const res = await fetch(url, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, status, decidedAt }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    dbg('setDecision:response', { id, status, code: res.status, ok: res.ok });
    if (res.ok) serverOk = true;
  } catch (err) {
    dbg('setDecision:error', { id, status, message: String(err?.message || err) });
  }

  try {
    const s=read();
    s[id]={status,decidedAt};
    write(s);
  } catch(err) {
    console.warn('Local decision persist failed', err)
  }

  document.querySelectorAll('.fastlane-card[data-id="' + id + '"]').forEach((card)=>{
    card.style.display = 'none'
  })
  updateStatusSummary();

  if (statusEl) {
    statusEl.textContent = serverOk
      ? 'Entscheidung gespeichert.'
      : 'Entscheidung lokal gespeichert (Server nicht erreichbar).';
  }
  if (btn) btn.disabled = false;
}
window.exportDecisions = function exportDecisions(){
  const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='review-decisions.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

for (const id of Object.keys(readFastlaneTags())) renderFastlaneTagButton(id)
window.functions.setDecision = (...args) => window.setDecision(...args)
window.functions.toggleFastlaneTag = (...args) => window.toggleFastlaneTag(...args)
window.functions.setViewMode = (...args) => window.setViewMode(...args)
window.functions.clearLocalReviewState = (...args) => window.clearLocalReviewState(...args)

hideDecidedRows();

