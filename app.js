/* Bell Beater v3 — lunch merges, clean intro, fullscreen focus */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const SKEY_PREFS = 'bb.prefs.v3';            // { lunch, chime, showPassing }
const SKEY_OVERRIDES = 'bb.overrides.v1';    // custom per-day [{name,start,end}]
const SKEY_USE_TEMPLATE = 'bb.useTemplateByDay.v1'; // { '1': true/false }

let prefs = loadPrefs();
let overrides = loadJSON(SKEY_OVERRIDES, {});
let useTemplate = loadJSON(SKEY_USE_TEMPLATE, {});

// Base templates (24h)
const tplMonThu = [
  ['1','Period 1','07:20','08:10'],
  ['2','Period 2','08:15','09:05'],
  ['hawk','Hawk Time','09:10','09:46'],
  ['3','Period 3','09:51','10:41'],
  ['4A','4A','10:41','11:11'],
  ['4','4','11:16','11:36'],
  ['4B','4B','11:36','12:06'],
  ['5','5','12:11','12:31'],
  ['5C','5C','12:31','13:01'],
  ['6','6','13:06','13:56'],
  ['7','7','14:01','14:51'],
];
const tplFri = [
  ['1','Period 1','07:20','08:07'],
  ['2','Period 2','08:12','09:02'],
  ['3','Period 3','09:07','09:54'],
  ['4A','4A','09:54','10:24'],
  ['4','4','10:29','10:46'],
  ['4B','4B','10:46','11:16'],
  ['5','5','11:21','11:38'],
  ['5C','5C','11:38','12:08'],
  ['6','6','12:13','13:00'],
  ['7','7','13:05','13:52'],
];

function loadPrefs(){
  try { return JSON.parse(localStorage.getItem(SKEY_PREFS)) || { lunch:null, chime:false, showPassing:true }; }
  catch { return { lunch:null, chime:false, showPassing:true }; }
}
function savePrefs(){ localStorage.setItem(SKEY_PREFS, JSON.stringify(prefs)); }
function loadJSON(k, def){ try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

function timeHM(t){ const [h,m] = t.split(':').map(n=>parseInt(n,10)); const d=new Date(); d.setHours(h,m,0,0); return d; }
function fmtHM(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function durFmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const mm=Math.floor(s/60), ss=s%60, hh=Math.floor(mm/60), mm2=mm%60; return hh>0 ? `${hh}:${String(mm2).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function todayDowKey(){ const d = new Date().getDay(); return String(Math.min(5, Math.max(1, d))); } // 1..5

// Merge logic: returns merged template blocks according to lunch
function mergedTemplateBlocks(isFriday){
  const base = (isFriday ? tplFri : tplMonThu).map(([id,name,start,end]) => ({id,name,start,end}));
  const L = prefs.lunch; // '4A'|'4B'|'5C'
  const out = [];
  const push = (name,start,end, isLunch=false) => out.push({ name, start, end, isLunch });

  // Always keep 1,2,hawk,3 as-is
  for (const id of ['1','2','hawk','3']){
    const b = base.find(x=>x.id===id); if (b) push(b.name,b.start,b.end,false);
  }

  // Lunch-aware middle
  const b4a = base.find(x=>x.id==='4A');
  const b4  = base.find(x=>x.id==='4');
  const b4b = base.find(x=>x.id==='4B');
  const b5  = base.find(x=>x.id==='5');
  const b5c = base.find(x=>x.id==='5C');

  if (L === '4A'){
    // Lunch first, then combined class for the rest of 4 (4 + 4B)
    if (b4a) push('Lunch', b4a.start, b4a.end, true);
    if (b4 && b4b) push('Period 4', b4.start, b4b.end, false);
    if (b5) push('Period 5', b5.start, b5.end, false);
    if (b5c) push('5C', b5c.start, b5c.end, false);
  } else if (L === '4B'){
    // Class first (4A+4 combined), then Lunch, then 5 and 5C normal
    if (b4a && b4) push('Period 4', b4a.start, b4.end, false);
    if (b4b) push('Lunch', b4b.start, b4b.end, true);
    if (b5) push('Period 5', b5.start, b5.end, false);
    if (b5c) push('5C', b5c.start, b5c.end, false);
  } else if (L === '5C'){
    // All of 4A+4+4B is one long class, then Period 5 class, then Lunch (5C)
    if (b4a && b4b) push('Period 4', b4a.start, b4b.end, false);
    if (b5) push('Period 5', b5.start, b5.end, false);
    if (b5c) push('Lunch', b5c.start, b5c.end, true);
  } else {
    // No lunch selected yet: show raw blocks
    for (const id of ['4A','4','4B','5','5C']){
      const b = base.find(x=>x.id===id);
      if (b) push(b.name,b.start,b.end, false);
    }
  }

  // Finish 6 & 7
  for (const id of ['6','7']){
    const b = base.find(x=>x.id===id); if (b) push('Period '+id, b.start, b.end, false);
  }
  return out;
}

// UI refs
const periodName = $('#periodName');
const countdownEl = $('#countdown');
const subline = $('#subline');
const nextName = $('#nextName');
const nextTime = $('#nextTime');
const todayList = $('#todayList');
const lunchLabel = $('#lunchLabel');
const focusEnds = $('#focusEnds');
const focusNext = $('#focusNext');

// Intro flow
const intro = $('#intro');
function showIntro(){
  intro.classList.remove('hidden');
  $$('.intro-choice').forEach(btn => {
    btn.onclick = () => {
      prefs.lunch = btn.dataset.lunch;
      savePrefs();
      intro.classList.add('hidden');
      lunchLabel.textContent = prefs.lunch;
      render();
    };
  });
}
if (!prefs.lunch){ showIntro(); }
else { lunchLabel.textContent = prefs.lunch; }

// Buttons
$('#btnLunch').onclick = () => { showIntro(); };
$('#btnFullscreen').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) document.body.classList.add('focus');
  else document.body.classList.remove('focus');
});

// Template toggle per day
const useTgl = $('#useTemplate');
useTgl.addEventListener('change', () => {
  const dow = todayDowKey();
  useTemplate[dow] = useTgl.checked;
  saveJSON(SKEY_USE_TEMPLATE, useTemplate);
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

function getBlocksForToday(){
  const d = new Date();
  const isFri = d.getDay() === 5;
  const key = todayDowKey();
  const useT = useTemplate[key] !== false; // default true
  useTgl.checked = useT;
  return useT ? mergedTemplateBlocks(isFri) : (overrides[key] || []);
}

function timeObj(t){ return timeHM(t); }
function colorClass(msLeft){ const min=msLeft/60000; if(min<=3) return 'danger'; if(min<=10) return 'warn'; return 'ok'; }

let lastBellTime = 0;
let tickHandle = null;
function startLoop(){ clearInterval(tickHandle); updateNow(); tickHandle=setInterval(updateNow,1000); }
startLoop();

function updateNow(){
  lunchLabel.textContent = prefs.lunch || '—';
  const now = new Date();
  const blocks = getBlocksForToday().map(b => ({...b, startD: timeObj(b.start), endD: timeObj(b.end)})).sort((a,b)=>a.startD-b.startD);
  todayList.innerHTML = '';
  if (!blocks.length){
    periodName.textContent = '—'; countdownEl.textContent = '--:--'; subline.textContent = 'No school today'; nextName.textContent = '—'; nextTime.textContent = '—'; focusEnds.textContent='—'; focusNext.textContent='—'; return;
  }
  // Build list
  for (const b of blocks){
    const item = document.createElement('div'); item.className='block';
    const tillEnd = b.endD - now;
    const inSession = now >= b.startD && now < b.endD;
    const cls = inSession ? colorClass(tillEnd) : (now < b.startD ? 'ok' : '');
    if (cls) item.classList.add(cls);
    item.innerHTML = `<div><div class="name">${b.name}${b.isLunch ? '<span class="badge lunch">LUNCH</span>' : ''}</div><div class="time">${fmtHM(b.startD)}–${fmtHM(b.endD)}</div></div><div class="eta">${inSession ? durFmt(tillEnd)+' left' : now < b.startD ? 'starts in '+durFmt(b.startD-now) : 'done'}</div>`;
    todayList.appendChild(item);
  }
  // Current/Next
  let current = null, next = null;
  for (const b of blocks){
    if (now >= b.startD && now < b.endD){ current = b; break; }
    if (now < b.startD){ next = b; break; }
  }
  if (current){
    const left = current.endD - now;
    periodName.textContent = current.name + (current.isLunch ? ' (Lunch)' : '');
    countdownEl.textContent = durFmt(left);
    subline.textContent = `Ends at ${fmtHM(current.endD)}`;
    focusEnds.textContent = fmtHM(current.endD);
    // bell
    const bellSec = Math.floor(current.endD.getTime()/1000);
    if (lastBellTime !== bellSec && left <= 1000){ lastBellTime = bellSec; onBell(current); }
    const idx = blocks.indexOf(current); next = blocks[idx+1] || null;
  } else {
    periodName.textContent = 'Passing Time';
    if (next){
      const until = next.startD - now;
      countdownEl.textContent = durFmt(until);
      subline.textContent = `Next: ${next.name}${next.isLunch ? ' (Lunch)' : ''} • ${fmtHM(next.startD)}`;
      focusEnds.textContent = '—';
    } else {
      countdownEl.textContent = '--:--'; subline.textContent = 'School day finished'; focusEnds.textContent='—';
    }
  }
  nextName.textContent = next ? next.name + (next.isLunch ? ' (Lunch)' : '') : '—';
  nextTime.textContent = next ? `${fmtHM(next.startD)}–${fmtHM(next.endD)}` : '—';
  focusNext.textContent = next ? `${next.name} • ${fmtHM(next.startD)}` : '—';
}

function onBell(block){
  if (prefs.chime) playChime();
  if (Notification.permission === 'granted'){
    navigator.serviceWorker?.getRegistration()?.then(reg => {
      reg?.showNotification('Bell Beater', { body: `${block.name}${block.isLunch?' (Lunch)':''} just ended.`, icon:'icons/icon-192.png' });
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

// Settings editor: per-day custom overrides
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
  const container = $('#dayEditor'); container.innerHTML='';
  const rows = overrides[dayKey] || [];
  const header = document.createElement('div'); header.className='grid muted'; header.innerHTML='<div>Name</div><div>Start</div><div>End</div><div></div>'; container.appendChild(header);
  rows.forEach((b,i)=>{
    const row = document.createElement('div'); row.className='grid';
    row.innerHTML = `
      <input class="input name" value="${b.name||''}" placeholder="e.g., Assembly">
      <input class="input start" value="${b.start||''}" placeholder="07:20">
      <input class="input end" value="${b.end||''}" placeholder="08:10">
      <div class="menu"><button class="up">↑</button><button class="down">↓</button><button class="del">Delete</button></div>`;
    row.querySelector('.up').onclick = () => { if(i>0){ const t=rows[i-1]; rows[i-1]=rows[i]; rows[i]=t; renderDay(dayKey);} };
    row.querySelector('.down').onclick = () => { if(i<rows.length-1){ const t=rows[i+1]; rows[i+1]=rows[i]; rows[i]=t; renderDay(dayKey);} };
    row.querySelector('.del').onclick = () => { rows.splice(i,1); renderDay(dayKey); };
    container.appendChild(row);
  });
  const add = document.createElement('div'); add.className='grid';
  add.innerHTML = `<input class="input" id="newName" placeholder="Add block name"><input class="input" id="newStart" placeholder="HH:MM"><input class="input" id="newEnd" placeholder="HH:MM"><button id="btnAdd">Add</button>`;
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
  saveJSON(SKEY_OVERRIDES, overrides);
  savePrefs();
  $('#dlgSettings').close();
  render();
}

// ICS uses merged templates for next 4 weeks
function exportICS(){
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bell Beater//EN'];
  const start = new Date(); start.setHours(0,0,0,0);
  for (let i=0;i<28;i++){
    const d = new Date(start.getTime()+i*86400000);
    const wd = d.getDay(); if (wd===0||wd===6) continue;
    const blocks = mergedTemplateBlocks(wd===5);
    for (const b of blocks){
      const [sh,sm] = b.start.split(':').map(n=>parseInt(n,10));
      const [eh,em] = b.end.split(':').map(n=>parseInt(n,10));
      const dtStart = new Date(d); dtStart.setHours(sh,sm,0,0);
      const dtEnd = new Date(d); dtEnd.setHours(eh,em,0,0);
      lines.push('BEGIN:VEVENT');
      lines.push('SUMMARY:'+escapeICS(b.name));
      lines.push('DTSTART:'+toICS(dtStart));
      lines.push('DTEND:'+toICS(dtEnd));
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], {type:'text/calendar'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='BellBeater.ics'; a.click();
  URL.revokeObjectURL(url);
  alert('ICS downloaded. Import to Google Calendar.');
}
function toICS(d){ const p=n=>String(n).padStart(2,'0'); return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+'00Z'; }
function escapeICS(s){ return (s||'').replace(/[,;]/g,''); }

// SW
if ('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')); }