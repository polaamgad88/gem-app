/* GEM HR navigation enhancement. Opt-in, scoped to HR workspace only.
   Search uses visible labels and bilingual data attributes; no network or analytics. */
(() => {
  'use strict';
  const nav = document.getElementById('ws-hr-nav');
  const selector = document.getElementById('ws-selector');
  if (!nav || !selector || document.getElementById('gem-hr-nav-search')) return;

  const isHR = () => !nav.hidden;
  const groups = [...nav.querySelectorAll('details.gem-hr-time-subnav')];
  const links = [...nav.querySelectorAll('a[data-page]')];
  const norm = value => String(value || '').normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLocaleLowerCase().trim();
  const stored = (() => {
    try { return JSON.parse(sessionStorage.getItem('gem_hr_open_sections') || '[]'); }
    catch { return []; }
  })();
  const search = document.createElement('div');
  search.className = 'gem-hr-nav-search';
  search.id = 'gem-hr-nav-search';
  search.innerHTML = '<label for="gem-hr-nav-search-input" data-i18n-ar="دور على صفحة في الموارد البشرية" data-i18n-en="Search HR pages">دور على صفحة في الموارد البشرية</label>' +
    '<div class="gem-hr-nav-search-field">' +
    '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
    '<input id="gem-hr-nav-search-input" type="search" autocomplete="off" spellcheck="false" aria-keyshortcuts="Control+K Meta+K" placeholder="اسم الصفحة..." />' +
    '<kbd aria-hidden="true">⌘ K</kbd>' +
    '</div>' +
    '<p class="gem-hr-search-empty" id="gem-hr-search-empty" role="status" hidden></p>';
  nav.prepend(search);
  const input = search.querySelector('input');
  const label = search.querySelector('label');
  const empty = search.querySelector('#gem-hr-search-empty');
  const placeholder = () => document.documentElement.lang === 'en' ? 'Find a page...' : 'دور على صفحة...';

  const groupLabel = group => group.querySelector('summary span');
  const groupTitle = group => {
    const el = groupLabel(group);
    return el ? [el.textContent, el.dataset.i18nAr, el.dataset.i18nEn].join(' ') : '';
  };
  function saveState() {
    if (input.value.trim()) return;
    try { sessionStorage.setItem('gem_hr_open_sections', JSON.stringify(groups.filter(g => g.open).map(g => g.id))); }
    catch {}
  }
  function activateCurrent() {
    if (!isHR()) return;
    const selected = nav.querySelector('a.active');
    if (!selected) return;
    const parent = selected.closest('details');
    if (parent) parent.open = true;
    links.forEach(a => {
      if (a.classList.contains('active')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const title = selected.querySelector('[data-i18n-ar]') || selected.querySelector('span');
    if (title) {
      const heading = document.getElementById('page-title');
      if (heading) heading.textContent = title.textContent;
    }
    // Do not force-scroll the full document or steal keyboard focus.
    if (parent) parent.classList.add('gem-hr-section-active');
    groups.forEach(g => { if (g !== parent) g.classList.remove('gem-hr-section-active'); });
  }
  function applySearch() {
    const q = norm(input.value);
    const currentLanguage = document.documentElement.lang === 'en' ? 'en' : 'ar';
    label.textContent = currentLanguage === 'en' ? label.dataset.i18nEn : label.dataset.i18nAr;
    input.placeholder = placeholder();
    let visible = 0;
    links.forEach(a => {
      const span = a.querySelector('span');
      const parent = a.closest('details');
      const values = [a.textContent, span?.dataset.i18nAr, span?.dataset.i18nEn, parent && groupTitle(parent)];
      const found = !q || values.some(v => norm(v).includes(q));
      a.hidden = !found;
      if (found) visible++;
    });
    groups.forEach(g => {
      const hasMatches = [...g.querySelectorAll('a[data-page]')].some(a => !a.hidden);
      g.hidden = !!q && !hasMatches;
      if (q && hasMatches) g.open = true;
    });
    empty.hidden = !q || visible !== 0;
    empty.textContent = currentLanguage === 'en'
      ? 'No matching pages. Try a different term.'
      : 'مفيش صفحات بالاسم ده. جرب كلمة تانية.';
    search.classList.toggle('is-filtering', !!q);
  }
  function clearSearch() {
    if (!input.value) return;
    input.value = '';
    applySearch();
    let remembered = stored;
    try { remembered = JSON.parse(sessionStorage.getItem('gem_hr_open_sections') || '[]'); } catch {}
    groups.forEach(g => { g.open = remembered.includes(g.id) || !!g.querySelector('a.active'); });
  }
  groups.forEach(g => {
    if (stored.includes(g.id)) g.open = true;
    g.addEventListener('toggle', () => { if (isHR()) saveState(); });
  });
  input.addEventListener('input', applySearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); clearSearch(); input.blur(); }
    if (e.key === 'Enter') {
      const matches = links.filter(a => !a.hidden);
      if (matches.length === 1) { e.preventDefault(); matches[0].click(); clearSearch(); }
    }
  });
  document.addEventListener('keydown', e => {
    if (!isHR()) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); input.focus(); input.select();
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') &&
        !document.activeElement?.isContentEditable) {
      e.preventDefault(); input.focus();
    }
  });
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-page]');
    if (a && isHR()) { clearSearch(); requestAnimationFrame(activateCurrent); }
  });
  // The original shell sets the active link on load and workspace changes.
  const observer = new MutationObserver(() => {
    if (isHR()) {
      if (input.value) applySearch();
      activateCurrent();
    }
  });
  for (const a of links) observer.observe(a, { attributes: true, attributeFilter: ['class'] });
  observer.observe(nav, { attributes: true, attributeFilter: ['hidden'] });
  const langControl = document.getElementById('gem-hr-language');
  langControl?.addEventListener('click', () => setTimeout(applySearch, 0));
  document.getElementById('ws-menu')?.addEventListener('click', () => setTimeout(() => {
    if (isHR()) { activateCurrent(); applySearch(); }
  }, 0));
  activateCurrent();
  applySearch();
})();