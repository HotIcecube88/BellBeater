/* Bell Beater v2 — default templates + lunch selection */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const SKEY_SCHEDULE = 'bb.schedule.v2';       // custom per-day overrides
const SKEY_PREFS = 'bb.prefs.v2';
const SKEY_USE_TEMPLATE = 'bb.useTemplateByDay.v1'; // { '1': true/false, ... }

let prefs = loadPrefs();
let overrides = loadOverrides();
let useTemplate = loadUseTemplate();

// Default templates (24h HH:MM). Mon–Thu vs Fri.
const templates = {
  monThu: [
    {id:'1', name:'Period 1', start:'07:20', end:'08:10'},
    {id:'2', name:'Period 2', start:'08:15', end:'09:05'},
    {id:'hawk', name:'Hawk Time', start:'09:10', end:'09:46'},
    {id:'3', name:'Period 3', start:'09:51', end:'10:41'},
    {id:'4A', name:'4A', start:'10:41', end:'11:11'},
    {id:'4',  name:'4',  start:'11:16', end:'11:36'},
    {id:'4B', name:'4B', start:'11:36', end:'12:06'},
    {id:'5',  name:'5',  start:'12:11', end:'12:31'},
    {id:'5C', name:'5C', start:'12:31', end:'13:01'},
    {id:'6',  name:'6',  start:'13:06', end:'13:56'},
    {id:'7',  name:'7',  start:'14:01', end:'14:51'},
  ],
  fri: [
    {id:'1', name:'Period 1', start:'07:20', end:'08:07'},
    {id:'2', name:'Period 2', start:'08:12', end:'09:02'},
    {id:'3', name:'Period 3', start:'09:07', end:'09:54'},
    {id:'4A', name:'4A', start:'09:54', end:'10:24'},
    {id:'4',  name:'4',  start:'10:29', end:'10:46'},
    {id:'4B', name:'4B', start:'10:46', end:'11:16'},
    {id:'5',  name:'5',  start:'11:21', end:'11:38'},
    {id:'5C', name:'5C', start:'11:38', end:'12:08'},
    {id:'6',  name:'6',  start:'12:13', end:'13:00'},
    {id:'7',  name:'7',  start:'13:05', end:'13:52'},
  ]
};

// First-run: ask for lunch if missing
if (!prefs.lunch) {
  openLunchDialog(true);
} else {
  $('#lunchLabel').textContent = prefs.lunch;
}

// UI refs
const periodName = $('#periodName');
const countdownEl = $('#countdown');
const subline = $('#subline');
const nextName = $('#nextName');
const nextTime = $('#nextTime');
const todayList = $('#todayList');

$('#btnLunch').onclick = () => openLunchDialog(false);

$('#btnFullscreen').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// template toggle per day
const useTgl = $('#useTemplate');
useTgl.addEventListener('change', () => {
  const dow = todayDowKey();
  useTemplate[dow] = useTgl.checked;
  saveUseTemplate();
  render();
});

// Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredPrompt = e;
  const btn = $('#btnInstall'); btn.hidden = false;
  btn.onclick = async () => { btn.disabled = true; await deferredPrompt.prompt(); await deferredPrompt.userChoice; btn.hidden = true; };
});

// Notifications & ICS
$('#btnNotif').onclick = async () => {
  const res = await Notification.requestPermission();
  alert(res === 'granted' ? 'Notifications enabled.' : 'Notifications denied.');
};
$('#btnICS').onclick = () => exportICS();

// Settings (custom overrides editor)
const dlg = $('#dlgSettings');
$('#btnSettings').onclick = () => openSettings();
$('#saveSettings').onclick = () => saveSettings();

function loadPrefs(){
  try { return JSON.parse(localStorage.getItem(SKEY_PREFS)) || { lunch:null, chime:false, showPassing:true }; }
  catch { return { lunch:null, chime:false, showPassing:true }; }
}
function savePrefs(){ localStorage.setItem(SKEY_PREFS, JSON.stringify(prefs)); }

function loadOverrides(){
  try { return JSON.parse(localStorage.getItem(SKEY_SCHEDULE)) || {}; }
  catch { return {}; }
}
function saveOverrides(){ localStorage.setItem(SKEY_SCHEDULE, JSON.stringify(overrides)); }

function loadUseTemplate(){
  try { return JSON.parse(localStorage.getItem(SKEY_USE_TEMPLATE)) || {}; }
  catch { return {}; }
}
function saveUseTemplate(){ localStorage.setItem(SKEY_USE_TEMPLATE, JSON.stringify(useTemplate)); }

// Helpers
function timeHM(t){ const [h,m] = t.split(':').map(n=>parseInt(n,10)); const d=new Date(); d.setHours(h, m, 0, 0); return d; }
function fmtHM(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function durFmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const mm=Math.floor(s/60), ss=s%60, hh=Math.floor(mm/60), mm2=mm%60; return hh>0 ? `${hh}:${String(mm2).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function todayDowKey(){ const d = new Date().getDay(); return String(Math.min(5, Math.max(1, d))); } // 1..5

function getTemplateBlocksForToday(){
  const d = new Date().getDay(); // 0-6
  const base = (d === 5) ? templates.fri : templates.monThu; // Friday=5
  // annotate lunch
  return base.map(b => ({...b, lunch: (b.id === prefs.lunch)}));
}

function getCustomBlocksForToday(){
  const key = todayDowKey();
  return (overrides[key] || []).map(b => ({...b, lunch:false}));
}

function blocksForToday(){
  const key = todayDowKey();
  const useT = useTemplate[key] !== false; // default true if unset
  useTgl.checked = useT;
  return useT ? getTemplateBlocksForToday() : getCustomBlocksForToday();
}

function colorClass(msLeft){
  const min = msLeft/60000;
  if (min <= 3) return 'danger';
  if (min <= 10) return 'warn';
  return 'ok';
}

// Render loop
let lastBellTime = 0;
let tickHandle = null;
function startLoop(){ clearInterval(tickHandle); updateNow(); tickHandle=setInterval(updateNow,1000); }
startLoop();

function updateNow(){
  $('#lunchLabel').textContent = prefs.lunch || '—';
  const now = new Date();
  const blocks = blocksForToday().map(b => ({...b, startD: timeHM(b.start), endD: timeHM(b.end)})).sort((a,b)=>a.startD-b.startD);
  todayList.innerHTML = '';
  if (!blocks.length){
    periodName.textContent = '—'; countdownEl.textContent = '--:--'; subline.textContent = 'No school today'; nextName.textContent = '—'; nextTime.textContent = '—'; return;
  }
  // Build today list
  for (const b of blocks){
    const item = document.createElement('div');
    item.className = 'block';
    const tillEnd = b.endD - now;
    const inSession = now >= b.startD && now < b.endD;
    const cls = inSession ? colorClass(tillEnd) : (now < b.startD ? 'ok' : '');
    if (cls) item.classList.add(cls);
    item.innerHTML = `<div><div class="name">${b.name}${b.lunch ? '<span class="badge lunch">LUNCH</span>' : ''}</div><div class="time">${fmtHM(b.startD)}–${fmtHM(b.endD)}</div></div><div class="eta">${inSession ? durFmt(tillEnd)+' left' : now < b.startD ? 'starts in '+durFmt(b.startD-now) : 'done'}</div>`;
    todayList.appendChild(item);
  }
  // Current/next
  let current = null, next = null;
  for (const b of blocks){
    if (now >= b.startD && now < b.endD){ current = b; break; }
    if (now < b.startD){ next = b; break; }
  }
  if (current){
    const left = current.endD - now;
    periodName.textContent = current.name + (current.lunch ? ' (Lunch)' : '');
    countdownEl.textContent = durFmt(left);
    subline.textContent = `Ends at ${fmtHM(current.endD)}`;
    const bellSec = Math.floor(current.endD.getTime()/1000);
    if (lastBellTime !== bellSec && left <= 1000){ lastBellTime = bellSec; onBell(current); }
    const idx = blocks.indexOf(current); next = blocks[idx+1] || null;
  } else {
    periodName.textContent = 'Passing Time';
    if (next){
      const until = next.startD - now;
      countdownEl.textContent = durFmt(until);
      subline.textContent = `Next: ${next.name}${next.lunch ? ' (Lunch)' : ''} • starts at ${fmtHM(next.startD)}`;
    } else {
      countdownEl.textContent = '--:--'; subline.textContent = 'School day finished';
    }
  }
  nextName.textContent = next ? next.name + (next.lunch ? ' (Lunch)' : '') : '—';
  nextTime.textContent = next ? `${fmtHM(next.startD)}–${fmtHM(next.endD)}` : '—';
}

// Bell behavior
function onBell(block){
  if (prefs.chime) playChime();
  if (Notification.permission === 'granted'){
    navigator.serviceWorker?.getRegistration()?.then(reg => {
      reg?.showNotification('Bell Beater', { body: `${block.name}${block.lunch ? ' (Lunch)' : ''} just ended.`, icon:'icons/icon-192.png' });
    });
  }
}
function playChime(){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.45);
}

// Lunch dialog
function openLunchDialog(force){
  const dlg = $('#dlgLunch');
  const radios = $$('input[name="lunch"]', dlg);
  radios.forEach(r => r.checked = (r.value === prefs.lunch));
  dlg.showModal();
  $('#saveLunch').onclick = () => {
    const sel = $('input[name="lunch"]:checked', dlg)?.value;
    if (!sel){ if (!force) dlg.close(); return; }
    prefs.lunch = sel; savePrefs(); dlg.close(); render();
  };
}

// Settings dialog (custom overrides)
function openSettings(){
  const tabs = $$('.tab', $('#dlgSettings'));
  tabs.forEach(t => t.classList.remove('tab-active'));
  const dow = todayDowKey();
  const first = tabs.find(t => t.dataset.day === dow) || tabs[0];
  first.classList.add('tab-active');
  renderDay(first.dataset.day);
  tabs.forEach(btn => btn.onclick = () => { tabs.forEach(t=>t.classList.remove('tab-active')); btn.classList.add('tab-active'); renderDay(btn.dataset.day); });
  $('#chime').checked = !!prefs.chime;
  $('#passShow').checked = prefs.showPassing !== false;
  $('#dlgSettings').showModal();
}

function renderDay(dayKey){
  const container = $('#dayEditor'); container.innerHTML = '';
  const rows = overrides[dayKey] || [];
  const header = document.createElement('div');
  header.className = 'grid muted';
  header.innerHTML = '<div>Name</div><div>Start</div><div>End</div><div></div>';
  container.appendChild(header);

  rows.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'grid';
    row.innerHTML = `
      <input class="input name" value="${b.name||''}" placeholder="e.g., AP Bio">
      <input class="input start" value="${b.start||''}" placeholder="07:20">
      <input class="input end" value="${b.end||''}" placeholder="08:10">
      <div class="menu">
        <button class="up">↑</button>
        <button class="down">↓</button>
        <button class="del">Delete</button>
      </div>`;
    row.querySelector('.up').onclick = () => { if (i>0){ const t = rows[i-1]; rows[i-1]=rows[i]; rows[i]=t; renderDay(dayKey);} };
    row.querySelector('.down').onclick = () => { if (i<rows.length-1){ const t = rows[i+1]; rows[i+1]=rows[i]; rows[i]=t; renderDay(dayKey);} };
    row.querySelector('.del').onclick = () => { rows.splice(i,1); renderDay(dayKey); };
    container.appendChild(row);
  });

  const add = document.createElement('div'); add.className = 'grid';
  add.innerHTML = `
    <input class="input" id="newName" placeholder="Add block name">
    <input class="input" id="newStart" placeholder="HH:MM">
    <input class="input" id="newEnd" placeholder="HH:MM">
    <button id="btnAdd">Add</button>`;
  container.appendChild(add);
  add.querySelector('#btnAdd').onclick = () => {
    const n = add.querySelector('#newName').value.trim();
    const s = add.querySelector('#newStart').value.trim();
    const e = add.querySelector('#newEnd').value.trim();
    if (!/\d{1,2}:\d{2}/.test(s) || !/\d{1,2}:\d{2}/.test(e) || !n) { alert('Enter name + HH:MM start/end'); return; }
    overrides[dayKey] = rows.concat([{name:n, start:s, end:e}]);
    renderDay(dayKey);
  };
}

function saveSettings(){
  const active = $('.tab.tab-active')?.dataset.day || todayDowKey();
  const rows = [];
  $$('.grid', $('#dayEditor')).forEach((row, idx) => {
    if (idx===0) return;
    const name = row.querySelector('.name')?.value;
    const start = row.querySelector('.start')?.value;
    const end = row.querySelector('.end')?.value;
    if (!name || !start || !end) return;
    rows.push({ name, start, end });
  });
  overrides[active] = rows;
  prefs.chime = $('#chime').checked;
  prefs.showPassing = $('#passShow').checked;
  saveOverrides(); savePrefs();
  $('#dlgSettings').close();
  render();
}

// ICS export (4 weeks from today using *template* blocks for each weekday)
function exportICS(){
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bell Beater//EN'];
  const start = new Date(); start.setHours(0,0,0,0);
  for (let i=0; i<28; i++){
    const d = new Date(start.getTime() + i*86400000);
    const wd = d.getDay();
    if (wd===0 || wd===6) continue;
    const base = (wd === 5) ? templates.fri : templates.monThu;
    const blocks = base.map(b => ({...b, lunch:(b.id===prefs.lunch)}));
    for (const b of blocks){
      const [sh,sm] = b.start.split(':').map(n=>parseInt(n,10));
      const [eh,em] = b.end.split(':').map(n=>parseInt(n,10));
      const dtStart = new Date(d); dtStart.setHours(sh,sm,0,0);
      const dtEnd = new Date(d); dtEnd.setHours(eh,em,0,0);
      lines.push('BEGIN:VEVENT');
      lines.push('SUMMARY:'+escapeICS(b.name + (b.lunch?' (Lunch)':'')));
      lines.push('DTSTART:'+toICS(dtStart));
      lines.push('DTEND:'+toICS(dtEnd));
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], {type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'BellBeater.ics'; a.click();
  URL.revokeObjectURL(url);
  alert('ICS downloaded. Import to Google Calendar (Settings → Import).');
}
function toICS(d){ const pad=n=>String(n).padStart(2,'0'); return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z'; }
function escapeICS(s){ return (s||'').replace(/[,;]/g,''); }

// SW
if ('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')); }

function render(){ updateNow(); }