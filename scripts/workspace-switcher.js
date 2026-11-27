/* GEM HR workspace switcher. Operations behavior stays intact. */
(() => {
  const trigger=document.getElementById('ws-trigger'), menu=document.getElementById('ws-menu');
  const ops=document.getElementById('ws-operations-nav'),hr=document.getElementById('ws-hr-nav');
  const current=document.getElementById('ws-current'),langBox=document.getElementById('gem-hr-language');
  if(!trigger||!menu||!ops||!hr)return;
  const links=[...document.querySelectorAll('#nav a[data-page]')];
  let lang=localStorage.getItem('gem_hr_lang')==='en'?'en':'ar';
  const req=new URLSearchParams(location.search).get('page')||'';
  let workspace=/^(hr-|time-|finance-|workflow-|report-)/.test(req)?'hr':'operations';
  function localize(){
    document.body.classList.toggle('gem-hr-rtl',workspace==='hr'&&lang==='ar');
    document.body.classList.toggle('gem-hr-ltr',workspace==='hr'&&lang==='en');
    langBox.hidden=workspace!=='hr';
    langBox.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('is-selected',b.dataset.lang===lang));
    hr.querySelectorAll('[data-i18n-ar]').forEach(e=>{e.textContent=e.dataset[lang==='ar'?'i18nAr':'i18nEn'];});
    current.textContent=workspace==='hr'?(lang==='ar'?'الموارد البشرية':'GEM Human Resources'):'GEM Operations';
    trigger.querySelector('.ws-trigger-copy small').textContent=workspace==='hr'?(lang==='ar'?'مساحة العمل':'WORKSPACE'):'WORKSPACE';
    trigger.querySelector('.ws-symbol').innerHTML=workspace==='hr'?'<i class="fa-solid fa-people-group"></i>':'<i class="fa-solid fa-building"></i>';
    document.documentElement.lang=workspace==='hr'?lang:'en';
    document.documentElement.dir=workspace==='hr'&&lang==='ar'?'rtl':'ltr';
    const active=document.querySelector('#ws-hr-nav a.active span');
    if(workspace==='hr'&&active)document.getElementById('page-title').textContent=active.textContent;
  }
  function show(ws,navigate){
    workspace=ws==='hr'?'hr':'operations';ops.hidden=workspace!=='operations';hr.hidden=workspace!=='hr';
    menu.hidden=true;trigger.setAttribute('aria-expanded','false');
    menu.querySelectorAll('[data-workspace]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.workspace===workspace)));
    localize();
    if(navigate){const page=workspace==='hr'?'hr-dashboard.html':'dashboard.html';const link=links.find(a=>a.dataset.page===page);if(link)link.click();}
  }
  trigger.addEventListener('click',()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});
  menu.addEventListener('click',e=>{const b=e.target.closest('[data-workspace]');if(b)show(b.dataset.workspace,true);});
  langBox.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(!b)return;lang=b.dataset.lang;localStorage.setItem('gem_hr_lang',lang);localize();const f=document.getElementById('main-frame');try{f.contentWindow.postMessage({gemHrLang:lang},location.origin);}catch{} });
  document.addEventListener('click',e=>{if(!e.target.closest('#ws-selector')){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}});
  document.getElementById('nav').addEventListener('click',e=>{const a=e.target.closest('a[data-page]');if(!a)return;setTimeout(()=>{if(a.closest('#ws-hr-nav'))show('hr',false); else if(a.closest('#ws-operations-nav'))show('operations',false);localize();},0);});
  show(workspace,false);
})();
