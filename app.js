
/* Minimal Bell Beater v3.1.2 (fixes + cache-bust) */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const SKEY_PREFS = 'bb.prefs.v3_1';
const SKEY_OVERRIDES = 'bb.overrides.v1';
const SKEY_USE_TEMPLATE = 'bb.useTemplateByDay.v1';
const SKEY_NOTES = 'bb.notes.v1';

function loadJSON(k, def){ try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; } }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

let prefs = loadJSON(SKEY_PREFS, { lunch:null, pre5:true, pre1:true, double34:false, labels:{ '1':'Period 1','2':'Period 2','hawk':'Hawk Time','3':'Period 3','4':'Period 4','5':'Period 5','6':'Period 6','7':'Period 7' }, colors:{} });
let overrides = loadJSON(SKEY_OVERRIDES, {});
let useTemplate = loadJSON(SKEY_USE_TEMPLATE, {});
let notes = loadJSON(SKEY_NOTES, {});

function timeHM(t){ const [h,m]=t.split(':').map(n=>parseInt(n,10)); const d=new Date(); d.setHours(h,m,0,0); return d; }
function fmtHM(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function durFmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const mm=Math.floor(s/60), ss=s%60, hh=Math.floor(mm/60), mm2=mm%60; return hh>0?`${hh}:${String(mm2).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function todayDowKey(){ const d=new Date().getDay(); return String(Math.min(5, Math.max(1, d))); }
function ymd(d=new Date()){ return d.toISOString().slice(0,10); }
function labelFor(id){ return prefs.labels?.[id] || (id==='hawk'?'Hawk Time':('Period '+id)); }

const tplMonThu=[['1','Period 1','07:20','08:10'],['2','Period 2','08:15','09:05'],['hawk','Hawk Time','09:10','09:46'],['3','Period 3','09:51','10:41'],['4A','4A','10:41','11:11'],['4','4','11:16','11:36'],['4B','4B','11:36','12:06'],['5','5','12:11','12:31'],['5C','5C','12:31','13:01'],['6','6','13:06','13:56'],['7','7','14:01','14:51']];
const tplFri=[['1','Period 1','07:20','08:07'],['2','Period 2','08:12','09:02'],['3','Period 3','09:07','09:54'],['4A','4A','09:54','10:24'],['4','4','10:29','10:46'],['4B','4B','10:46','11:16'],['5','5','11:21','11:38'],['5C','5C','11:38','12:08'],['6','6','12:13','13:00'],['7','7','13:05','13:52']];

function mergedTemplateBlocks(isFriday){
  const base=(isFriday?tplFri:tplMonThu).map(([id,name,start,end])=>({id,name,start,end}));
  const L=prefs.lunch; const out=[]; const get=id=>base.find(x=>x.id===id);
  const push=(id,name,start,end,isLunch=false)=>out.push({id,name,start,end,isLunch});
  ['1','2','hawk','3'].forEach(id=>{ const b=get(id); if(b) push(b.id,labelFor(id),b.start,b.end,false); });
  const b4a=get('4A'), b4=get('4'), b4b=get('4B'), b5=get('5'), b5c=get('5C');
  if (L==='4A'){ if(b4a) push('4A','Lunch',b4a.start,b4a.end,true); if(b4&&b4b) push('4',labelFor('4'),b4.start,b4b.end,false); if(b5&&b5c) push('5',labelFor('5'),b5.start,b5c.end,false); }
  else if (L==='4B'){ if(b4a&&b4) push('4',labelFor('4'),b4a.start,b4.end,false); if(b4b) push('4B','Lunch',b4b.start,b4b.end,true); if(b5&&b5c) push('5',labelFor('5'),b5.start,b5c.end,false); }
  else if (L==='5C'){ if(b4a&&b4b) push('4',labelFor('4'),b4a.start,b4b.end,false); if(b5) push('5',labelFor('5'),b5.start,b5.end,false); if(b5c) push('5C','Lunch',b5c.start,b5c.end,true); }
  else { ['4A','4','4B','5','5C','6','7'].forEach(id=>{ const b=get(id); if(b) push(b.id,labelFor(id),b.start,b.end,false); }); return out; }
  ['6','7'].forEach(id=>{ const b=get(id); if(b) push(id,labelFor(id),b.start,b.end,false); });
  return out;
}

const lunchLabel=$('#lunchLabel'), periodName=$('#periodName'), countdownEl=$('#countdown'), progressBar=$('#progressBar'), subline=$('#subline'), nextName=$('#nextName'), nextTime=$('#nextTime'), todayList=$('#todayList'), focusEnds=$('#focusEnds'), focusNext=$('#focusNext');
const intro=$('#intro');
function showIntro(){
  intro.classList.remove('hidden');
  $$('.intro-choice').forEach(btn => btn.onclick=()=>{ prefs.lunch=btn.dataset.lunch; saveJSON(SKEY_PREFS,prefs); intro.classList.add('hidden'); lunchLabel.textContent=prefs.lunch; render(); });
}
if(!prefs.lunch) showIntro(); else lunchLabel.textContent=prefs.lunch;

$('#btnLunch').onclick=()=>showIntro();
$('#btnFullscreen').onclick=()=>{ if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
document.addEventListener('fullscreenchange',()=>{ if(document.fullscreenElement) document.body.classList.add('focus'); else document.body.classList.remove('focus'); });

const widget=$('#widget'), wClose=$('#wClose'); $('#btnWidget').onclick=()=>widget.classList.toggle('hidden'); wClose.onclick=()=>widget.classList.add('hidden');

const useTgl=$('#useTemplate'); useTgl.addEventListener('change',()=>{ const dow=todayDowKey(); useTemplate[dow]=useTgl.checked; localStorage.setItem(SKEY_USE_TEMPLATE, JSON.stringify(useTemplate)); render(); });

$('#btnNotif').onclick=async()=>{ const res=await Notification.requestPermission(); alert(res==='granted'?'Notifications enabled.':'Notifications denied.'); };
$('#btnICS').onclick=()=>exportICS();
$('#btnSettings').onclick=()=>alert('Settings dialog in minimal build not interactive here (use full build).');
$('#btnRefresh').onclick=async()=>{ if('serviceWorker' in navigator){ const reg=await navigator.serviceWorker.getRegistration(); await reg?.unregister(); } if(caches?.keys){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } location.reload(true); };

function colorClass(msLeft){ const min=msLeft/60000; if(min<=3) return 'danger'; if(min<=10) return 'warn'; return 'ok'; }

function blocksForToday(){ const key=todayDowKey(); const isFri=(new Date().getDay()===5); const useT=(useTemplate[key]!==false); useTgl.checked=useT; return useT?mergedTemplateBlocks(isFri):(overrides[key]||[]); }

function updateNow(){
  lunchLabel.textContent=prefs.lunch||'—';
  const now=new Date();
  const blocks = blocksForToday().map(b=>({...b, startD:timeHM(b.start), endD:timeHM(b.end)})).sort((a,b)=>a.startD-b.startD);
  todayList.innerHTML='';
  if(!blocks.length){ periodName.textContent='—'; countdownEl.textContent='--:--'; subline.textContent='No school today'; nextName.textContent='—'; nextTime.textContent='—'; focusEnds.textContent='—'; focusNext.textContent='—'; progressBar.style.width='0%'; return; }
  for(const b of blocks){
    const item=document.createElement('div'); item.className='card'; const title=document.createElement('div'); title.textContent=b.name; const when=document.createElement('div'); when.textContent=fmtHM(b.startD)+'–'+fmtHM(b.endD); item.appendChild(title); item.appendChild(when); todayList.appendChild(item);
  }
  let current=null, next=null;
  for(const b of blocks){ if(now>=b.startD && now<b.endD){current=b; break;} if(now<b.startD){ next=b; break; } }
  if(current){ const left=current.endD-now; const total=current.endD-current.startD; periodName.textContent=current.name; countdownEl.textContent=durFmt(left); subline.textContent='Ends at '+fmtHM(current.endD); const pct=Math.min(100,Math.max(0,((now-current.startD)/total)*100)); progressBar.style.width=pct.toFixed(2)+'%'; const idx=blocks.indexOf(current); next=blocks[idx+1]||null; }
  else { periodName.textContent='Passing Time'; progressBar.style.width='0%'; if(next){ const until=next.startD-now; countdownEl.textContent=durFmt(until); subline.textContent='Next: '+next.name+' • '+fmtHM(next.startD); } else { countdownEl.textContent='--:--'; subline.textContent='School day finished'; } }
  nextName.textContent = next ? next.name : '—';
  nextTime.textContent = next ? fmtHM(next.startD)+'–'+fmtHM(next.endD) : '—';
  focusEnds.textContent = current ? fmtHM(current.endD) : '—';
  focusNext.textContent = next ? (next.name+' • '+fmtHM(next.startD)) : '—';
}
function render(){ updateNow(); }
setInterval(updateNow,1000); updateNow();

function exportICS(){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Bell Beater//EN'];
  const start=new Date(); start.setHours(0,0,0,0);
  function addEvt(d, name, sh, sm, eh, em){
    const ds=new Date(d), de=new Date(d); ds.setHours(sh,sm,0,0); de.setHours(eh,em,0,0);
    const p=n=>String(n).padStart(2,'0');
    const toICS=t=>t.getUTCFullYear()+p(t.getUTCMonth()+1)+p(t.getUTCDate())+'T'+p(t.getUTCHours())+p(t.getUTCMinutes())+'00Z';
    lines.push('BEGIN:VEVENT','SUMMARY:'+name,'DTSTART:'+toICS(ds),'DTEND:'+toICS(de),'END:VEVENT');
  }
  for(let i=0;i<28;i++){ const d=new Date(start.getTime()+i*86400000); const wd=d.getDay(); if(wd===0||wd===6) continue; const list=mergedTemplateBlocks(wd===5); for(const b of list){ const [sh,sm]=b.start.split(':').map(n=>+n); const [eh,em]=b.end.split(':').map(n=>+n); addEvt(d,b.name,sh,sm,eh,em); } }
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='BellBeater.ics'; a.click(); URL.revokeObjectURL(url);
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js')); }
