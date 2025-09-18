/* Bell Beater v3.1.1 */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const SKEY_PREFS = 'bb.prefs.v3_1';
const SKEY_OVERRIDES = 'bb.overrides.v1';
const SKEY_USE_TEMPLATE = 'bb.useTemplateByDay.v1';
const SKEY_NOTES = 'bb.notes.v1';

let prefs = loadJSON(SKEY_PREFS, { lunch:null, pre5:true, pre1:true, chime:false, showPassing:true, double34:false, labels:{
  '1':'Period 1','2':'Period 2','hawk':'Hawk Time','3':'Period 3','4':'Period 4','5':'Period 5','6':'Period 6','7':'Period 7'
}, colors:{} });
let overrides = loadJSON(SKEY_OVERRIDES, {});
let useTemplate = loadJSON(SKEY_USE_TEMPLATE, {});
let notes = loadJSON(SKEY_NOTES, {});

function saveAll() { saveJSON(SKEY_PREFS, prefs); saveJSON(SKEY_OVERRIDES, overrides); saveJSON(SKEY_USE_TEMPLATE, useTemplate); saveJSON(SKEY_NOTES, notes); }
function loadJSON(k, def){ try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

function timeHM(t){ const [h,m]=t.split(':').map(n=>parseInt(n,10)); const d=new Date(); d.setHours(h,m,0,0); return d; }
function fmtHM(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function durFmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const mm=Math.floor(s/60), ss=s%60, hh=Math.floor(mm/60), mm2=mm%60; return hh>0?`${hh}:${String(mm2).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function todayDowKey(){ const d=new Date().getDay(); return String(Math.min(5, Math.max(1, d))); }
function ymd(d=new Date()){ return d.toISOString().slice(0,10); }

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

function labelFor(id) { return prefs.labels?.[id] || (id==='hawk'?'Hawk Time':('Period '+id)); }
function colorFor(id) { return prefs.colors?.[id] || ''; }

function mergedTemplateBlocks(isFriday){
  const base = (isFriday?tplFri:tplMonThu).map(([id,name,start,end])=>({id,name,start,end}));
  const L = prefs.lunch;
  const out=[];
  const push=(id,name,start,end,isLunch=false)=>out.push({ id, name, start, end, isLunch });
  const get=(id)=>base.find(x=>x.id===id);

  ['1','2','hawk','3'].forEach(id=>{ const b=get(id); if(b) push(b.id, labelFor(id), b.start,b.end,false); });

  const b4a=get('4A'), b4=get('4'), b4b=get('4B'), b5=get('5'), b5c=get('5C');

  if (L==='4A') {
    if (b4a) push('4A','Lunch', b4a.start,b4a.end,true);
    if (b4 && b4b) push('4', labelFor('4'), b4.start,b4b.end,false);
    if (b5 && b5c) push('5', labelFor('5'), b5.start,b5c.end,false); // merge 5+5C
  } else if (L==='4B') {
    if (b4a && b4) push('4', labelFor('4'), b4a.start,b4.end,false);
    if (b4b) push('4B','Lunch', b4b.start,b4b.end,true);
    if (b5 && b5c) push('5', labelFor('5'), b5.start,b5c.end,false); // merge 5+5C
  } else if (L==='5C') {
    if (b4a && b4b) push('4', labelFor('4'), b4a.start,b4b.end,false);
    if (b5) push('5', labelFor('5'), b5.start,b5.end,false);
    if (b5c) push('5C','Lunch', b5c.start,b5c.end,true);
  } else {
    ['4A','4','4B','5','5C'].forEach(id=>{ const b=get(id); if(b) push(b.id, labelFor(id), b.start,b.end,false); });
  }

  // Double period 3+4 if contiguous (no lunch between)
  if (prefs.double34) {
    const outIds = out.map(b=>b.id);
    const i3 = outIds.indexOf('3');
    const i4 = outIds.indexOf('4');
    const iLunch = out.findIndex(b=>b.isLunch && (b.id==='4A' || b.id==='4B' || b.id==='5C'));
    if (i3>=0 && i4>=0 && (iLunch<0 || iLunch<i3 || iLunch>i4)) {
      const b3 = out[i3], b4m = out[i4];
      out.splice(i3, i4-i3+1, { id:'3_4', name: labelFor('3') + ' + ' + labelFor('4'), start: b3.start, end: b4m.end, isLunch:false });
    }
  }

  ['6','7'].forEach(id=>{ const b=get(id); if(b) push(id, labelFor(id), b.start,b.end,false); });
  return out;
}

function noteKey(dateStr, id) { return `${dateStr}__${id}`; }
function getNote(dateStr, id) { return notes[noteKey(dateStr,id)] || { text:'', links:'' }; }
function setNote(dateStr, id, data) { notes[noteKey(dateStr,id)] = data; saveJSON(SKEY_NOTES, notes); }

// --- UI refs
const lunchLabel = $('#lunchLabel');
const periodName = $('#periodName');
const countdownEl = $('#countdown');
const progressBar = $('#progressBar');
const subline = $('#subline');
const nextName = $('#nextName');
const nextTime = $('#nextTime');
const todayList = $('#todayList');
const focusEnds = $('#focusEnds');
const focusNext = $('#focusNext');

// --- Intro
const intro = $('#intro');
function showIntro(){
  intro.classList.remove('hidden');
  $$('.intro-choice').forEach(btn => btn.onclick = () => {
    prefs.lunch = btn.dataset.lunch;
    saveJSON(SKEY_PREFS, prefs);
    intro.classList.add('hidden');
    lunchLabel.textContent = prefs.lunch;
    render();
  });
}
if (!prefs.lunch) showIntro(); else lunchLabel.textContent = prefs.lunch;

// --- Buttons
$('#btnLunch').onclick = () => showIntro();
$('#btnFullscreen').onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) document.body.classList.add('focus'); else document.body.classList.remove('focus'); });

// Mini widget (draggable in-page)
const widget = $('#widget'); const wClose = $('#wClose');
$('#btnWidget').onclick = () => widget.classList.toggle('hidden');
wClose.onclick = () => widget.classList.add('hidden');
widget.addEventListener('dragstart', e => { const rect=widget.getBoundingClientRect(); e.dataTransfer.setData('text/plain', JSON.stringify({dx:e.clientX-rect.left, dy:e.clientY-rect.top})); });
document.body.addEventListener('dragover', e => e.preventDefault());
document.body.addEventListener('drop', e => { e.preventDefault(); const d=JSON.parse(e.dataTransfer.getData('text/plain')||'{}'); const x=e.clientX-(d.dx||0), y=e.clientY-(d.dy||0); widget.style.left=x+'px'; widget.style.top=y+'px'; widget.style.right='auto'; widget.style.bottom='auto'; });

// Pop-out widget window
let pop = null;
$('#btnPopout').onclick = () => { if (pop && !pop.closed) { pop.focus(); return; } pop = window.open('widget.html', 'bb_widget', 'width=260,height=180'); };

// Install prompt
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt=e; const btn=$('#btnInstall'); btn.hidden=false; btn.onclick=async()=>{ btn.disabled=true; await deferredPrompt.prompt(); await deferredPrompt.userChoice; btn.hidden=true; }; });

// Notifications
$('#btnNotif').onclick = async () => { const res = await Notification.requestPermission(); alert(res==='granted'?'Notifications enabled.':'Notifications denied.'); };

// ICS
$('#btnICS').onclick = () => exportICS();

// Refresh app (clear SW cache quickly)
$('#btnRefresh').onclick = async () => { if ('serviceWorker' in navigator) { const reg = await navigator.serviceWorker.getRegistration(); await reg?.unregister(); } if (caches?.keys) { const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } location.reload(true); };

// Template toggle
const useTgl = $('#useTemplate');
useTgl.addEventListener('change', () => { const dow=todayDowKey(); useTemplate[dow]=useTgl.checked; saveJSON(SKEY_USE_TEMPLATE,useTemplate); render(); });

// Settings dialog
const dlg = $('#dlgSettings');
$('#btnSettings').onclick = () => openSettings();
$('#saveSettings').onclick = () => saveSettings();

function openSettings(){
  const setTabs = $$('.set-tab', dlg);
  const bodies = $$('.tab-body', dlg);
  setTabs.forEach(t => t.classList.remove('set-active')); setTabs[0].classList.add('set-active');
  bodies.forEach((b,i)=> b.classList.toggle('hidden', i!==0));

  setTabs.forEach(btn => btn.onclick = () => { setTabs.forEach(t=>t.classList.remove('set-active')); btn.classList.add('set-active'); bodies.forEach(b=>b.classList.add('hidden')); $('#tab-'+btn.dataset.tab).classList.remove('hidden'); });

  const tabs = $$('.tab', dlg);
  tabs.forEach(t => t.classList.remove('tab-active'));
  const dow = todayDowKey();
  const first = tabs.find(t => t.dataset.day === dow) || tabs[0];
  first.classList.add('tab-active');
  renderDay(first.dataset.day);
  tabs.forEach(btn => btn.onclick = () => { tabs.forEach(t=>t.classList.remove('tab-active')); btn.classList.add('tab-active'); renderDay(btn.dataset.day); });

  const labelsEditor = $('#labelsEditor');
  labelsEditor.innerHTML='';
  const ids=['1','2','hawk','3','4','5','6','7'];
  ids.forEach(id=>{
    const row = document.createElement('div'); row.className='labels-grid';
    row.innerHTML = `
      <div>Period ${"hawk"==id?"Hawk Time":id} </div>
      <input class="input label" data-id="${id}" value="${prefs.labels?.[id]||''}">
      <div>
        <input class="input color" data-id="${id}" type="color" value="${prefs.colors?.[id]||'#10b981'}">
        <span class="color-swatch" style="background:${prefs.colors?.[id]||'#10b981'}"></span>
      </div>`;
    labelsEditor.appendChild(row);
  });

  $('#pre5').checked = !!prefs.pre5;
  $('#pre1').checked = !!prefs.pre1;
  $('#double34').checked = !!prefs.double34;

  $('#dlgSettings').showModal();
}

function renderDay(dayKey){
  const container = $('#dayEditor'); container.innerHTML='';
  const rows = (overrides[dayKey] || []);
  const header = document.createElement('div'); header.className='grid muted'; header.innerHTML='<div>Name</div><div>Start</div><div>End</div><div></div>'; container.appendChild(header);
  rows.forEach((b,i)=>{
    const row=document.createElement('div'); row.className='grid';
    row.innerHTML=`
      <input class="input name" value="${b.name||''}" placeholder="e.g., Assembly">
      <input class="input start" value="${b.start||''}" placeholder="07:20">
      <input class="input end" value="${b.end||''}" placeholder="08:10">
      <div class="menu"><button class="up">↑</button><button class="down">↓</button><button class="del">Delete</button></div>`;
    row.querySelector('.up').onclick = () => { if(i>0){ const t=rows[i-1]; rows[i-1]=rows[i]; rows[i]=t; renderDay(dayKey); } };
    row.querySelector('.down').onclick = () => { if(i<rows.length-1){ const t=rows[i+1]; rows[i+1]=rows[i]; rows[i]=t; renderDay(dayKey); } };
    row.querySelector('.del').onclick = () => { rows.splice(i,1); renderDay(dayKey); };
    container.appendChild(row);
  });
  const add=document.createElement('div'); add.className='grid';
  add.innerHTML=`<input class="input" id="newName" placeholder="Add block name"><input class="input" id="newStart" placeholder="HH:MM"><input class="input" id="newEnd" placeholder="HH:MM"><button id="btnAdd">Add</button>`;
  container.appendChild(add);
  add.querySelector('#btnAdd').onclick=()=>{
    const n=add.querySelector('#newName').value.trim();
    const s=add.querySelector('#newStart').value.trim();
    const e=add.querySelector('#newEnd').value.trim();
    if(!/\d{1,2}:\d{2}/.test(s)||!/\d{1,2}:\d{2}/.test(e)||!n){ alert('Enter name + HH:MM start/end'); return; }
    overrides[dayKey] = rows.concat([{name:n,start:s,end:e}]);
    renderDay(dayKey);
  };
}

function saveSettings(){
  const activeDay = ($$('.tab.tab-active')[0]?.dataset.day) || todayDowKey();
  const rows=[];
  $$('.grid', $('#dayEditor')).forEach((row,idx)=>{
    if(idx===0) return;
    const name=row.querySelector('.name')?.value;
    const start=row.querySelector('.start')?.value;
    const end=row.querySelector('.end')?.value;
    if(!name||!start||!end) return;
    rows.push({name,start,end});
  });
  overrides[activeDay] = rows;

  $$('.label', $('#labelsEditor')).forEach(inp=>{ prefs.labels[inp.dataset.id]=inp.value||inp.dataset.id; });
  $$('.color', $('#labelsEditor')).forEach(inp=>{ prefs.colors[inp.dataset.id]=inp.value; });

  prefs.pre5 = $('#pre5').checked;
  prefs.pre1 = $('#pre1').checked;
  prefs.double34 = $('#double34').checked;

  saveAll();
  $('#dlgSettings').close();
  render();
}

// Build today's blocks (template or custom)
function blocksForToday(){
  const key = todayDowKey();
  const isFri = (new Date().getDay()===5);
  const useT = useTemplate[key] !== false; useTgl.checked = useT;
  return useT ? mergedTemplateBlocks(isFri) : (overrides[key]||[]);
}

function colorClass(msLeft){ const min=msLeft/60000; if(min<=3) return 'danger'; if(min<=10) return 'warn'; return 'ok'; }

let lastBellTime=0;
let tick=null;
let notifState = { pre5Sent:null, pre1Sent:null };

function updateNow(){
  try{
    lunchLabel.textContent = prefs.lunch || '—';
    const now = new Date();
    const today = ymd(now);
    const blocks = blocksForToday().map(b=>({...b, startD: timeHM(b.start), endD: timeHM(b.end)})).sort((a,b)=>a.startD-b.startD);

    todayList.innerHTML='';
    if (!blocks.length){
      periodName.textContent='—'; countdownEl.textContent='--:--'; subline.textContent='No school today';
      nextName.textContent='—'; nextTime.textContent='—'; focusEnds.textContent='—'; focusNext.textContent='—';
      const wc=document.getElementById('wCountdown'); const ws=document.getElementById('wSub');
      if (wc) wc.textContent='--:--'; if (ws) ws.textContent='—'; progressBar.style.width='0%'; return;
    }

    for(const b of blocks){
      const item=document.createElement('div'); item.className='block';
      const top=document.createElement('div'); top.className='top';
      const name=document.createElement('div'); name.className='name'; name.textContent=b.name;
      const col = colorFor(b.id);
      if (col) { const badge=document.createElement('span'); badge.className='badge color'; badge.style.background=col; badge.textContent=''; badge.title=b.name; name.appendChild(badge); }
      if (b.isLunch) { const lunchB=document.createElement('span'); lunchB.className='badge lunch'; lunchB.textContent='LUNCH'; name.appendChild(lunchB); }
      const time=document.createElement('div'); time.className='time'; time.textContent = `${fmtHM(b.startD)}–${fmtHM(b.endD)}`;
      top.appendChild(name); top.appendChild(time);
      const eta=document.createElement('div'); eta.className='eta';
      const tillEnd=b.endD - now;
      const inSession = now>=b.startD && now<b.endD;
      const cls = inSession ? colorClass(tillEnd) : (now<b.startD ? 'ok' : '');
      if (cls) item.classList.add(cls);
      eta.textContent = inSession ? durFmt(tillEnd)+' left' : (now<b.startD ? 'starts in '+durFmt(b.startD-now) : 'done');
      const prog = document.createElement('div'); prog.className='progress'; const bar=document.createElement('div'); bar.className='bar'; prog.appendChild(bar);
      if (inSession) { const total=b.endD - b.startD; const done=now - b.startD; bar.style.width = Math.min(100, Math.max(0, (done/total)*100)).toFixed(2)+'%'; }
      else if (now>=b.endD) { bar.style.width='100%'; } else { bar.style.width='0%'; }

      const det=document.createElement('details'); det.className='notes';
      const sum=document.createElement('summary'); sum.textContent='Notes & Links';
      const n = getNote(today, b.id);
      const textarea=document.createElement('textarea'); textarea.placeholder='Homework / notes for today'; textarea.value=n.text||'';
      textarea.onchange = ()=> setNote(today, b.id, { text: textarea.value, links: link.value });
      const link=document.createElement('input'); link.placeholder='Links (comma-separated URLs)'; link.value=n.links||'';
      link.onchange = ()=> setNote(today, b.id, { text: textarea.value, links: link.value });
      const row=document.createElement('div'); row.className='row'; row.appendChild(link);
      det.appendChild(sum); det.appendChild(textarea); det.appendChild(row);

      item.appendChild(top); item.appendChild(eta); item.appendChild(prog); item.appendChild(det);
      todayList.appendChild(item);
    }

    let current=null, next=null;
    for(const b of blocks){ if(now>=b.startD && now<b.endD){current=b; break;} if(now<b.startD){ next=b; break; } }
    if (current){
      const left=current.endD - now;
      const total=current.endD - current.startD;
      periodName.textContent=current.name + (current.isLunch?' (Lunch)':'');
      countdownEl.textContent=durFmt(left);
      subline.textContent='Ends at '+fmtHM(current.endD);
      focusEnds.textContent=fmtHM(current.endD);
      const pct = Math.min(100, Math.max(0, ((now - current.startD)/total)*100));
      progressBar.style.width=pct.toFixed(2)+'%';
      maybeNotifyWarnings(current, now);
      const bellSec=Math.floor(current.endD.getTime()/1000);
      if (left<=1000 && lastBellTime!==bellSec){ lastBellTime=bellSec; onBell(current); }
      const idx=blocks.indexOf(current); next=blocks[idx+1]||null;
    } else {
      periodName.textContent='Passing Time';
      progressBar.style.width='0%';
      if(next){ const until=next.startD - now; countdownEl.textContent=durFmt(until); subline.textContent=`Next: ${next.name}${next.isLunch?' (Lunch)':''} • ${fmtHM(next.startD)}`; focusEnds.textContent='—'; }
      else { countdownEl.textContent='--:--'; subline.textContent='School day finished'; focusEnds.textContent='—'; }
    }
    nextName.textContent = next ? next.name + (next.isLunch?' (Lunch)':'') : '—';
    nextTime.textContent = next ? `${fmtHM(next.startD)}–${fmtHM(next.endD)}` : '—';
    focusNext.textContent = next ? `${next.name} • ${fmtHM(next.startD)}` : '—';

    const wCount = document.getElementById('wCountdown'), wSub=document.getElementById('wSub');
    if(wCount && wSub){
      if(current){ wCount.textContent = countdownEl.textContent; wSub.textContent = 'Ends '+fmtHM(current.endD); }
      else if(next){ const until=next.startD-now; wCount.textContent=durFmt(until); wSub.textContent='Next '+next.name+' @ '+fmtHM(next.startD); }
      else { wCount.textContent='--:--'; wSub.textContent='—'; }
    }
  }catch(e){
    console.error('BellBeater update error', e);
  }
}

// ---- Define render() to fix the freeze bug
function render(){ updateNow(); }

// Start loop
let tick = setInterval(updateNow, 1000);
updateNow();

// Notifications helpers
function maybeNotifyWarnings(current, now){
  if (Notification.permission !== 'granted') return;
  const endMs = current.endD.getTime();
  const fiveMs = endMs - 5*60*1000;
  const oneMs = endMs - 1*60*1000;
  if (prefs.pre5 && now.getTime() >= fiveMs && (window.__pre5Sent||0) !== endMs) {
    window.__pre5Sent = endMs;
    showNotif(`${current.name} ends in 5 minutes`);
  }
  if (prefs.pre1 && now.getTime() >= oneMs && (window.__pre1Sent||0) !== endMs) {
    window.__pre1Sent = endMs;
    showNotif(`${current.name} ends in 1 minute`);
  }
}
function showNotif(body){
  navigator.serviceWorker?.getRegistration()?.then(reg=>{ reg?.showNotification('Bell Beater', { body, icon:'icons/icon-192.png' }); });
}
function onBell(block){
  showNotif(`${block.name}${block.isLunch?' (Lunch)':''} just ended.`);
}

// ICS export (4 weeks)
function exportICS(){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bell Beater//EN'];
  const start=new Date(); start.setHours(0,0,0,0);
  for(let i=0;i<28;i++){
    const d=new Date(start.getTime()+i*86400000);
    const wd=d.getDay(); if(wd===0||wd===6) continue;
    const blocks=mergedTemplateBlocks(wd===5);
    for(const b of blocks){
      const [sh,sm]=b.start.split(':').map(n=>parseInt(n,10));
      const [eh,em]=b.end.split(':').map(n=>parseInt(n,10));
      const dtS=new Date(d); dtS.setHours(sh,sm,0,0);
      const dtE=new Date(d); dtE.setHours(eh,em,0,0);
      lines.push('BEGIN:VEVENT');
      lines.push('SUMMARY:'+escapeICS(b.name));
      lines.push('DTSTART:'+toICS(dtS));
      lines.push('DTEND:'+toICS(dtE));
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='BellBeater.ics'; a.click(); URL.revokeObjectURL(url);
}
function toICS(d){ const p=n=>String(n).padStart(2,'0'); return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+'00Z'; }
function escapeICS(s){ return (s||'').replace(/[,;]/g,''); }

// SW
if ('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')); }