/* NurtureLoop — shared runtime.
   One file powers: i18n (EN/தமிழ்/हिन्दी), cross-screen routing, language switcher,
   bottom sheets, toasts, SakhiVoice prototype, CareCircle consent, JananiConnect offline demo. */
(function () {
  'use strict';
  var NL = window.NL || {};
  window.NL = NL;

  var DICT = window.NL_I18N || {};
  var LANG_KEY = 'nl-lang';
  var SET_KEY = 'nl-settings';
  var lang = 'en';

  var LANGS = [
    { code: 'en', label: 'English', short: 'EN', speech: 'en-IN' },
    { code: 'ta', label: 'தமிழ்', short: 'த', speech: 'ta-IN' },
    { code: 'hi', label: 'हिन्दी', short: 'हि', speech: 'hi-IN' }
  ];

  function norm(s) {
    return String(s)
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function lookup(source) {
    if (lang === 'en') return null;
    var entry = DICT[norm(source)];
    if (!entry) return null;
    return entry[lang === 'ta' ? 0 : 1] || null;
  }

  /* For programmatic copy (sheets, toasts): entries may carry an English slot at [2]. */
  function lookupAny(source) {
    var entry = DICT[norm(source)];
    if (!entry) return null;
    if (lang === 'en') return entry[2] || null;
    return entry[lang === 'ta' ? 0 : 1] || null;
  }

  /* ── DOM translation ──────────────────────────── */
  var ATTRS = ['placeholder', 'aria-label', 'title'];

  function isSkipped(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return true;
    /* Icon ligatures (Material Symbols) are glyph names, never copy. */
    if (el.closest('.material-symbols-outlined, .material-icons')) return true;
    return !!el.closest('[data-nl-skip]');
  }

  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (isSkipped(node)) continue;
      if (node.__nlSrc === undefined) node.__nlSrc = node.nodeValue;
      var out = lookup(node.__nlSrc);
      var next;
      if (out === null) {
        next = node.__nlSrc;
      } else {
        /* Keep the surrounding spaces: inline markup often carries its own
           leading/trailing whitespace inside the text node. */
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.__nlSrc) || [];
        next = (m[1] || '') + out + (m[3] || '');
      }
      if (node.nodeValue !== next) node.nodeValue = next;
    }
  }

  function translateAttrs(root) {
    var els = root.querySelectorAll(ATTRS.map(function (a) { return '[' + a + ']'; }).join(','));
    Array.prototype.forEach.call(els, function (el) {
      if (isSkipped(el)) return;
      ATTRS.forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (!v) return;
        var store = '__nlA_' + attr;
        if (el[store] === undefined) el[store] = v;
        var out = lookup(el[store]);
        el.setAttribute(attr, out === null ? el[store] : out);
      });
    });
  }

  function applyLang(root) {
    root = root || document.body;
    translateTextNodes(root);
    translateAttrs(root);
    document.documentElement.lang = lang === 'ta' ? 'ta' : lang === 'hi' ? 'hi' : 'en';
  }
  NL.applyLang = applyLang;

  /* ── Language switcher ────────────────────────── */
  function switcherEl(compact) {
    var wrap = document.createElement('div');
    wrap.className = 'nl-lang' + (compact ? ' nl-lang-compact' : '');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language');
    wrap.setAttribute('data-nl-skip', '');
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.langCode = l.code;
      b.textContent = compact ? l.short : l.label;
      b.className = 'nl-lang-btn';
      b.addEventListener('click', function () { NL.setLang(l.code); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function paintSwitchers() {
    Array.prototype.forEach.call(document.querySelectorAll('.nl-lang'), function (w) {
      Array.prototype.forEach.call(w.querySelectorAll('button'), function (b) {
        b.classList.toggle('is-active', b.dataset.langCode === lang);
        b.setAttribute('aria-pressed', String(b.dataset.langCode === lang));
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-btn]'), function (b) {
      var on = b.getAttribute('data-lang-btn') === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
      if (b.classList.contains('lang-pill')) {
        b.className = 'lang-pill px-3 py-1 rounded-lg font-label-md text-label-md transition-all' +
          (on ? ' bg-surface-container-lowest text-primary shadow-xs' : ' text-secondary hover:text-on-surface');
      }
    });
  }

  function wireLangButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-btn]'), function (b) {
      if (b.dataset.nlLangBound) return;
      b.dataset.nlLangBound = '1';
      b.addEventListener('click', function () { NL.setLang(b.getAttribute('data-lang-btn')); });
    });
  }
  NL.wireLangButtons = wireLangButtons;

  function injectAppSwitcher() {
    if (document.querySelector('.nl-lang-holder') || !document.querySelector('header')) return;
    var bar = document.querySelector('header > div');
    if (!bar) return;
    var holder = document.createElement('div');
    holder.className = 'nl-lang-holder';
    holder.appendChild(switcherEl(true));
    var right = bar.lastElementChild;
    if (right) bar.insertBefore(holder, right); else bar.appendChild(holder);
  }

  NL.lang = function () { return lang; };
  NL.t = function (source) {
    var v = lookupAny(source);
    if (v) return v;
    if (lang === 'en') return source.charAt(0).toUpperCase() + source.slice(1);
    return source;
  };

  NL.setLang = function (code) {
    if (code !== 'en' && code !== 'ta' && code !== 'hi') code = 'en';
    lang = code;
    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
    document.documentElement.setAttribute('data-lang', code);
    document.querySelectorAll('.nl-lang-holder, .nl-lang').forEach(function (w) { w.setAttribute('data-nl-skip', ''); });
    applyLang(document.body);
    paintSwitchers();
    if (typeof paintNet === 'function') paintNet();
    document.dispatchEvent(new CustomEvent('nl:lang', { detail: { lang: code } }));
  };

  /* Re-translate anything the page renders later (inline scripts, sheets, etc.) */
  function observeDynamic() {
    if (!window.MutationObserver) return;
    var pending = false;
    var obs = new MutationObserver(function (records) {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        records.forEach(function (r) {
          if (r.type === 'attributes') return;
          Array.prototype.forEach.call(r.addedNodes, function (n) {
            if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-nl-skip')) return;
            if (n.nodeType === 1 || n.nodeType === 3) applyLang(n.nodeType === 3 ? (n.parentElement || document.body) : n);
          });
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Routing ──────────────────────────────────── */
  var ROUTES = {
    home: 'app.html',
    journey: 'journey.html',
    care: 'care-plan.html',
    carebridge: 'carebridge.html',
    messages: 'more.html#messages',
    circle: 'more.html#circle',
    family: 'more.html#family',
    privacy: 'more.html#privacy',
    settings: 'more.html#settings',
    more: 'more.html'
  };
  NL.routes = ROUTES;

  function currentRouteKey() {
    var file = location.pathname.split('/').pop() || 'app.html';
    var hash = location.hash.replace('#', '');
    for (var k in ROUTES) {
      var target = ROUTES[k].split('#')[0];
      if (target === file && (!hash || ROUTES[k].indexOf('#') === -1 || ROUTES[k].indexOf(hash) > -1)) {
        if (ROUTES[k].indexOf('#') > -1) return k;
        if (!hash) return k;
      }
    }
    return file === 'index.html' ? null : 'home';
  }

  function wireRoutes() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-path]'), function (a) {
      var key = a.getAttribute('data-path');
      var target = ROUTES[key];
      if (!target) return;
      a.setAttribute('href', target);
      a.addEventListener('click', function () { /* native navigation */ });
    });
    var active = currentRouteKey();
    Array.prototype.forEach.call(document.querySelectorAll('[data-path]'), function (a) {
      if (a.getAttribute('data-path') === active && !a.hasAttribute('aria-current')) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('text-primary', 'font-semibold');
        a.classList.remove('text-secondary');
      }
    });
  }

  /* ── Styles ───────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('nl-styles')) return;
    var css = [
      '.nl-lang-holder{display:flex;align-items:center;margin-right:.5rem}',
      '.nl-lang{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:9999px;background:rgba(147,69,43,.06);border:1px solid rgba(218,193,186,.7)}',
      '.nl-lang-btn{font:inherit;font-size:11px;font-weight:600;letter-spacing:.04em;color:#556254;background:transparent;border:0;border-radius:9999px;padding:5px 10px;cursor:pointer;transition:background .25s,color .25s}',
      '.nl-lang-btn.is-active{background:#93452b;color:#fff}',
      '.nl-lang-btn:hover:not(.is-active){color:#1d1b19}',
      '.nl-lang-compact .nl-lang-btn{padding:5px 9px}',
      '.nl-scrim{position:fixed;inset:0;background:rgba(37,35,33,.42);backdrop-filter:blur(3px);z-index:70;opacity:0;transition:opacity .3s}',
      '.nl-scrim.is-open{opacity:1}',
      '.nl-sheet{position:fixed;z-index:71;left:50%;bottom:0;transform:translate(-50%,110%);width:min(560px,100%);max-height:88vh;overflow-y:auto;background:#fef8f4;border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(37,35,33,.18);transition:transform .38s cubic-bezier(.2,.8,.25,1);padding:1.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom,0px))}',
      '.nl-sheet.is-open{transform:translate(-50%,0)}',
      '@media (min-width:768px){.nl-sheet{bottom:auto;top:50%;border-radius:18px;transform:translate(-50%,-42%) scale(.97);opacity:0}.nl-sheet.is-open{transform:translate(-50%,-50%) scale(1);opacity:1}}',
      '.nl-sheet-grab{width:42px;height:4px;border-radius:9999px;background:#dac1ba;margin:0 auto .9rem}',
      '.nl-sheet h3{font-family:"Playfair Display",Georgia,serif;font-size:22px;line-height:1.25;color:#1d1b19;margin:0 0 .35rem}',
      '.nl-sheet p.nl-sub{margin:0 0 1rem;font-size:13px;line-height:1.6;color:#556254}',
      '.nl-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.7rem .1rem;border-bottom:1px solid #efe7e1}',
      '.nl-row:last-of-type{border-bottom:0}',
      '.nl-row-label{font-size:14px;font-weight:500;color:#1d1b19}',
      '.nl-row-hint{font-size:12px;color:#8a7f78;margin-top:2px}',
      '.nl-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;font:inherit;font-size:14px;font-weight:600;border-radius:12px;padding:.75rem 1.1rem;border:1px solid transparent;cursor:pointer;transition:background .25s,color .25s,transform .15s}',
      '.nl-btn:active{transform:scale(.985)}',
      '.nl-btn-primary{background:#93452b;color:#fff}.nl-btn-primary:hover{background:#a5563a}',
      '.nl-btn-ghost{background:#f3ede9;color:#1d1b19}.nl-btn-ghost:hover{background:#e7e1de}',
      '.nl-btn-olive{background:#d8e7d5;color:#324a35}.nl-btn-olive:hover{background:#c9dcc6}',
      '.nl-actions{display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap}',
      '.nl-actions .nl-btn{flex:1 1 46%;white-space:normal;text-align:center}',
      '.nl-toast{position:fixed;left:50%;bottom:84px;transform:translate(-50%,16px);z-index:80;background:#32302e;color:#f6f0ec;font-size:13px;padding:.8rem 1.1rem;border-radius:12px;box-shadow:0 12px 30px rgba(37,35,33,.28);opacity:0;transition:opacity .3s,transform .3s;max-width:min(90vw,420px);text-align:center}',
      '.nl-toast.is-open{opacity:1;transform:translate(-50%,0)}',
      '.nl-toggle{position:relative;width:46px;height:26px;border-radius:9999px;background:#e7e1de;border:0;cursor:pointer;transition:background .25s;flex:none}',
      '.nl-toggle::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(37,35,33,.25);transition:transform .25s}',
      '.nl-toggle[aria-pressed="true"]{background:#94a893}.nl-toggle[aria-pressed="true"]::after{transform:translateX(20px)}',
      '.nl-chip{display:inline-flex;align-items:center;gap:.35rem;font-size:11px;font-weight:600;padding:.25rem .6rem;border-radius:9999px;background:#f3ede9;color:#556254}',
      '.nl-conn{display:inline-flex;align-items:center;gap:.4rem;font-size:11px;font-weight:600;padding:.3rem .6rem;border-radius:9999px;background:#d8e7d5;color:#324a35;cursor:pointer;border:0}',
      '.nl-conn.is-offline{background:#f1e2dd;color:#8a4a35}',
      '.nl-banner{position:fixed;left:0;right:0;top:64px;z-index:60;background:#32302e;color:#f6f0ec;font-size:12.5px;text-align:center;padding:.55rem 1rem;transform:translateY(calc(-100% - 64px));transition:transform .35s;pointer-events:none}',
      '.nl-banner.is-open{transform:translateY(0);pointer-events:auto}',
      '.nl-mic{width:64px;height:64px;border-radius:9999px;background:#93452b;color:#fff;display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;margin:0 auto;position:relative}',
      '.nl-mic.is-live{background:#a5563a}',
      '.nl-mic.is-live::after{content:"";position:absolute;inset:-10px;border-radius:9999px;border:2px solid rgba(147,69,43,.35);animation:nl-ping 1.6s ease-out infinite}',
      '@keyframes nl-ping{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.25);opacity:0}}',
      '.nl-wave{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:46px;margin:1rem 0}',
      '.nl-wave span{width:4px;border-radius:9999px;background:#c98a76;height:18%;transition:height .18s ease-out}',
      '.nl-brain{display:flex;flex-wrap:wrap;gap:.4rem;margin:.25rem 0 1rem}',
      '.nl-brain button{font:inherit;font-size:12px;padding:.4rem .7rem;border-radius:9999px;border:1px solid #dac1ba;background:#fff;color:#556254;cursor:pointer}',
      '.nl-brain button:hover{border-color:#93452b;color:#93452b}',
      '.nl-answer{background:#f3ede9;border-radius:14px;padding:.9rem 1rem;font-size:14px;line-height:1.6;color:#1d1b19}',
      '.nl-note{font-size:11.5px;color:#8a7f78;margin-top:.75rem;line-height:1.55}',
      'html.nl-reduce *,html.nl-reduce *::before,html.nl-reduce *::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}',
      'html.nl-reduce .nl-wave span{transition:none}',
      '[data-nl-go],[data-nl-sheet],[data-nl-toast],[data-nl-speak],.nl-pressable{cursor:pointer}',
      'body.nl-sheet-open{overflow:hidden}',
      /* ── Mobile & language hardening ── */
      '@media (max-width:379px){header > div{padding-left:.7rem;padding-right:.7rem}header .font-headline-md{font-size:17px}.nl-lang-holder{margin-right:.3rem}.nl-lang-btn{padding:5px 7px;font-size:10.5px}}',
      /* Bottom nav must hold five labels even in Tamil at 320px. */
      '@media (max-width:379px){nav.fixed .font-label-sm{font-size:9.5px;letter-spacing:0}nav.fixed a{padding-left:.35rem;padding-right:.35rem;min-width:40px}}',
      /* Tamil status badges are long: let them wrap instead of pushing rows wide. */
      'html[data-lang="ta"] [data-nl-status]{white-space:normal !important;text-align:right;max-width:60%}',
      'html[data-lang="hi"] [data-nl-status]{white-space:normal !important;text-align:right;max-width:60%}',
      '@media (max-width:359px){body.nl-landing #landing-nav a[href="#top"] span{display:none}}',
      '@media (pointer:coarse){.nl-lang-btn{padding:7px 11px}}',
      '@media (max-width:767px){.nl-sheet input,[data-nl-composer] input,[data-nl-composer] textarea{font-size:16px !important}}',
      'html[data-lang="ta"] h1,html[data-lang="ta"] h2,html[data-lang="ta"] h3,html[data-lang="ta"] .font-serif,html[data-lang="ta"] .font-headline-md,html[data-lang="ta"] .font-headline-lg-mobile,html[data-lang="ta"] .font-display-mobile{line-height:1.28 !important}',
      'html[data-lang="hi"] h1,html[data-lang="hi"] h2,html[data-lang="hi"] h3,html[data-lang="hi"] .font-serif,html[data-lang="hi"] .font-headline-md,html[data-lang="hi"] .font-headline-lg-mobile,html[data-lang="hi"] .font-display-mobile{line-height:1.22 !important}',
      '@media (min-width:1024px){body.nl-landing .nl-banner{top:80px}}'
    ].join('\n');
    var s = document.createElement('style');
    s.id = 'nl-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── Toast ────────────────────────────────────── */
  var toastEl = null, toastTimer = null;
  NL.toast = function (msg, tone) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'nl-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.background = tone === 'olive' ? '#324a35' : '#32302e';
    // Apply directly rather than inside rAF: backgrounded tabs and some
    // mobile embedders pause rAF, which would leave the toast invisible.
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-open'); }, 2600);
  };

  /* ── Bottom sheet ─────────────────────────────── */
  var openSheet = null;
  NL.sheet = function (opts) {
    opts = opts || {};
    if (openSheet) openSheet.close();
    var scrim = document.createElement('div');
    scrim.className = 'nl-scrim';
    var panel = document.createElement('div');
    panel.className = 'nl-sheet';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (opts.title) panel.setAttribute('aria-label', opts.title);
    panel.innerHTML =
      '<div class="nl-sheet-grab" aria-hidden="true"></div>' +
      (opts.eyebrow ? '<p class="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mb-1">' + opts.eyebrow + '</p>' : '') +
      (opts.title ? '<h3>' + opts.title + '</h3>' : '') +
      (opts.subtitle ? '<p class="nl-sub">' + opts.subtitle + '</p>' : '') +
      '<div class="nl-sheet-body"></div>';
    var body = panel.querySelector('.nl-sheet-body');
    if (opts.html) body.innerHTML = opts.html;
    if (opts.node) body.appendChild(opts.node);

    var actions = document.createElement('div');
    actions.className = 'nl-actions';
    (opts.actions || [{ label: 'Close', kind: 'ghost' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'nl-btn nl-btn-' + (a.kind || 'primary');
      b.textContent = a.label;
      b.addEventListener('click', function () { if (a.onClick) a.onClick(); if (a.keepOpen !== true) close(); });
      actions.appendChild(b);
    });
    body.appendChild(actions);

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.body.classList.add('nl-sheet-open');
    requestAnimationFrame(function () { scrim.classList.add('is-open'); panel.classList.add('is-open'); });

    function close() {
      scrim.classList.remove('is-open');
      panel.classList.remove('is-open');
      document.body.classList.remove('nl-sheet-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { scrim.remove(); panel.remove(); }, 380);
      openSheet = null;
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('click', close);
    openSheet = { close: close, panel: panel, body: body };

    applyLang(panel);
    paintSwitchers();
    var first = panel.querySelector('.nl-btn-primary, .nl-mic, button');
    if (first && opts.focus !== false) setTimeout(function () { first.focus(); }, 380);
    return openSheet;
  };

  NL.hasSheetOpen = function () { return !!openSheet; };
  NL.closeSheet = function () { if (openSheet) openSheet.close(); };

  /* ── Settings ─────────────────────────────────── */
  function readSettings() {
    try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; }
  }
  NL.settings = readSettings;
  NL.setSetting = function (k, v) {
    var s = readSettings();
    s[k] = v;
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) {}
    if (k === 'reducedMotion') document.documentElement.classList.toggle('nl-reduce', !!v);
    document.dispatchEvent(new CustomEvent('nl:settings', { detail: s }));
  };

  /* ── Boot ─────────────────────────────────────── */
  NL.boot = function () {
    injectStyles();
    try { lang = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { lang = 'en'; }
    if (lang !== 'en' && lang !== 'ta' && lang !== 'hi') lang = 'en';
    var s = readSettings();
    if (s.reducedMotion) document.documentElement.classList.add('nl-reduce');
    /* Landing pages opt into their own header rules via this class. */
    if (document.getElementById('landing-nav')) document.body.classList.add('nl-landing');
    injectAppSwitcher();
    wireRoutes();
    wireLangButtons();
    document.documentElement.setAttribute('data-lang', lang);
    applyLang(document.body);
    paintSwitchers();
    paintSettings();
    observeDynamic();
    if (NL.wireDeclarative) NL.wireDeclarative();
  };

  /* ── Voice output ─────────────────────────── */
  function speechLang() {
    var m = LANGS.filter(function (l) { return l.code === lang; })[0];
    return m ? m.speech : 'en-IN';
  }
  NL.speak = function (text) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      NL.toast('Voice playback is not available in this browser');
      return false;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    u.rate = 0.92;
    u.pitch = 1.02;
    window.speechSynthesis.speak(u);
    return true;
  };
  NL.stopSpeak = function () { try { window.speechSynthesis.cancel(); } catch (e) {} };

  /* ── Approved mock care information (assistive only) ── */
  var QA = [
    {
      id: 'appointment',
      q: { en: 'What is my next appointment?', ta: 'என் அடுத்த சந்திப்பு எப்போது?', hi: 'मेरी अगली अपॉइंटमेंट कब है?' },
      a: {
        en: 'Your next appointment is 15 October, 10:30 AM at City Maternity Hospital with Dr. Ananya Rao. Pooja is driving you.',
        ta: 'உங்கள் அடுத்த சந்திப்பு அக்டோபர் 15, காலை 10:30, சிட்டி மெட்டர்னிட்டி மருத்துவமனையில், டாக்டர் அனன்யா ராவுடன். பூஜா உங்களை அழைத்துச் செல்கிறார்.',
        hi: 'आपकी अगली अपॉइंटमेंट 15 अक्टूबर, सुबह 10:30, सिटी मैटर्निटी अस्पताल में डॉ. अनन्या राव के साथ है। पूजा आपको ले जाएँगी।'
      }
    },
    {
      id: 'documents',
      q: { en: 'Which documents should I bring?', ta: 'எந்த ஆவணங்களை கொண்டு வர வேண்டும்?', hi: 'कौन से दस्तावेज़ लाने हैं?' },
      a: {
        en: 'Bring your hospital discharge summary and the CBC blood test report you completed last Friday. Both are already saved in your document vault.',
        ta: 'மருத்துவமனை வெளியேற்றச் சுருக்கம் மற்றும் கடந்த வெள்ளிக்கிழமை எடுத்த CBC இரத்தப் பரிசோதனை அறிக்கையை கொண்டு வரவும். இரண்டும் உங்கள் ஆவணக் காப்பகத்தில் சேமிக்கப்பட்டுள்ளன.',
        hi: 'अस्पताल का डिस्चार्ज सारांश और पिछले शुक्रवार की CBC रक्त जाँच रिपोर्ट साथ लाएँ। दोनों आपके दस्तावेज़ संग्रह में सहेजी हैं।'
      }
    },
    {
      id: 'referral',
      q: { en: 'Where is my referral going?', ta: 'என் பரிந்துரை எங்கே செல்கிறது?', hi: 'मेरा रेफ़रल कहाँ जा रहा है?' },
      a: {
        en: 'Your physiotherapy referral has reached the Women health centre, and City Maternity is reviewing your appointment request. You can follow every step in CareBridge.',
        ta: 'உங்கள் பிசியோதெரபி பரிந்துரை மகளிர் சுகாதார மையத்தை அடைந்தது; சிட்டி மெட்டர்னிட்டி உங்கள் சந்திப்பு கோரிக்கையை பரிசீலிக்கிறது. ஒவ்வொரு படியையும் CareBridge-இல் பார்க்கலாம்.',
        hi: 'आपका फ़िज़ियोथेरेपी रेफ़रल महिला स्वास्थ्य केंद्र पहुँच गया है, और सिटी मैटर्निटी आपके अपॉइंटमेंट अनुरोध की समीक्षा कर रहा है। हर चरण CareBridge में देखें।'
      }
    }
  ];

  function pick(map) { return map[lang] || map.en; }

  /* ── SakhiVoice prototype ─────────────────────── */
  NL.voiceSheet = function (seedId) {
    var bars = '';
    for (var i = 0; i < 22; i++) bars += '<span style="height:' + (14 + Math.round(Math.random() * 70)) + '%"></span>';
    var chips = QA.map(function (item) {
      return '<button type="button" data-voice-q="' + item.id + '">' + pick(item.q) + '</button>';
    }).join('');

    var sheet = NL.sheet({
      eyebrow: 'SakhiVoice',
      title: NL.lang() === 'ta' ? 'சகி கேட்கிறாள்' : NL.lang() === 'hi' ? 'सखी सुन रही है' : 'Sakhi is listening',
      subtitle: 'Tap the microphone, or choose a question. Answers come only from clinician-approved care information.',
      html: '<button type="button" class="nl-mic" id="nl-mic" aria-label="Start listening">' +
              '<span class="material-symbols-outlined" style="font-size:28px">mic</span></button>' +
            '<div class="nl-wave" id="nl-wave">' + bars + '</div>' +
            '<p class="font-label-sm text-label-sm text-secondary text-center mb-3" id="nl-voice-state">Tap the microphone to ask a question</p>' +
            '<div class="nl-brain" id="nl-chips">' + chips + '</div>' +
            '<div class="nl-answer" id="nl-answer">No question yet. SakhiVoice will read clinician-approved answers aloud.</div>' +
            '<p class="nl-note">Approved care information only. NurtureLoop is assistive, not diagnostic.</p>',
      actions: [{ label: 'Close', kind: 'ghost' }]
    });

    var mic = sheet.panel.querySelector('#nl-mic');
    var wave = sheet.panel.querySelector('#nl-wave');
    var barsEls = wave.querySelectorAll('span');
    var state = sheet.panel.querySelector('#nl-voice-state');
    var answer = sheet.panel.querySelector('#nl-answer');
    var timer = null;
    var active = false;

    function idle() {
      active = false;
      mic.classList.remove('is-live');
      clearInterval(timer);
      Array.prototype.forEach.call(barsEls, function (b) { b.style.height = '18%'; });
      state.textContent = 'Tap the microphone to ask a question';
    }
    function listen() {
      active = true;
      mic.classList.add('is-live');
      state.textContent = 'Sakhi is listening…';
      answer.textContent = '…';
      NL.toast('Listening — speak naturally');
      timer = setInterval(function () {
        Array.prototype.forEach.call(barsEls, function (b) { b.style.height = (16 + Math.random() * 74) + '%'; });
      }, 140);
      setTimeout(function () { if (active) answerQuestion(QA[0]); }, 1900);
    }
    function answerQuestion(item) {
      active = false;
      mic.classList.remove('is-live');
      clearInterval(timer);
      Array.prototype.forEach.call(barsEls, function (b) { b.style.height = (20 + Math.random() * 60) + '%'; });
      state.textContent = pick(item.q);
      answer.textContent = pick(item.a);
      NL.speak(pick(item.a));
    }
    mic.addEventListener('click', function () { if (active) { idle(); NL.stopSpeak(); } else listen(); });
    sheet.panel.querySelector('#nl-chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-voice-q]');
      if (!b) return;
      var item = QA.filter(function (x) { return x.id === b.getAttribute('data-voice-q'); })[0];
      if (item) answerQuestion(item);
    });
    sheet.panel.addEventListener('nl:closed', idle);
    return sheet;
  };

  /* ── CareCircle: invite + manage access ───────── */
  var RELATIONS = [
    { id: 'partner', label: 'Partner', ta: 'துணை', hi: 'साथी' },
    { id: 'sister', label: 'Sister', ta: 'சகோதரி', hi: 'बहन' },
    { id: 'mother', label: 'Mother', ta: 'தாய்', hi: 'माँ' },
    { id: 'friend', label: 'Trusted friend', ta: 'நம்பிக்கையான நண்பர்', hi: 'भरोसेमंद मित्र' }
  ];
  var PERMS = [
    { id: 'appointments', label: 'Appointment reminders' },
    { id: 'transport', label: 'Transport & escort' },
    { id: 'location', label: 'Visit location' },
    { id: 'notes', label: 'Private medical notes', locked: true }
  ];

  function permRow(p, on) {
    return '<div class="nl-row"><div><div class="nl-row-label">' + NL.t(p.label) + '</div>' +
      (p.locked ? '<div class="nl-row-hint">' + (lang === 'en' ? 'Only you and your care team' : 'Only you and your care team') + '</div>' : '') +
      '</div><button type="button" class="nl-toggle" data-perm="' + p.id + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + NL.t(p.label) + '"></button></div>';
  }

  function bindToggles(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-perm], [data-nl-consent], [data-nl-setting]'), function (t) {
      if (t.dataset.nlBound) return;
      t.dataset.nlBound = '1';
      t.addEventListener('click', function () {
        var on = t.getAttribute('aria-pressed') !== 'true';
        t.setAttribute('aria-pressed', String(on));
        var key = t.getAttribute('data-nl-consent') || t.getAttribute('data-nl-setting');
        if (key) {
          NL.setSetting(key, on);
          NL.toast(NL.t('your choices are saved on this device.'), 'olive');
        }
      });
    });
  }

  function paintSettings() {
    var s = readSettings();
    Object.keys(s).forEach(function (k) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-nl-setting="' + k + '"],[data-nl-consent="' + k + '"]'), function (t) {
        t.setAttribute('aria-pressed', String(!!s[k]));
      });
    });
  }

  NL.inviteSheet = function () {
    var relChips = RELATIONS.map(function (r, i) {
      return '<button type="button" class="nl-btn ' + (i === 0 ? 'nl-btn-primary' : 'nl-btn-ghost') + '" data-rel="' + r.id + '" style="flex:1 1 40%">' + NL.t(r.label) + '</button>';
    }).join('');
    var sheet = NL.sheet({
      eyebrow: 'CareCircle',
      title: NL.t('invite to care circle'),
      subtitle: 'Choose what this person can see. You can change or revoke it at any time.',
      html: '<p class="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-2">' + NL.t('relationship') + '</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:.5rem" id="nl-rels">' + relChips + '</div>' +
            '<p class="font-label-sm text-label-sm uppercase tracking-widest text-secondary mt-4 mb-2">' + NL.t('permissions') + '</p>' +
            '<div id="nl-perms">' + PERMS.map(function (p, i) { return permRow(p, i < 2); }).join('') + '</div>' +
            '<p class="nl-note">' + NL.t('only you decide what each person can see. revoke anytime.') + '</p>',
      actions: [
        { label: NL.t('send invitation'), kind: 'primary', onClick: sendInvite },
        { label: NL.t('cancel'), kind: 'ghost' }
      ]
    });
    var rel = RELATIONS[0];
    sheet.panel.querySelector('#nl-rels').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rel]');
      if (!b) return;
      rel = RELATIONS.filter(function (r) { return r.id === b.getAttribute('data-rel'); })[0];
      Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) {
        x.className = 'nl-btn ' + (x === b ? 'nl-btn-primary' : 'nl-btn-ghost');
      });
    });
    bindToggles(sheet.panel);
    function sendInvite() {
      var host = document.querySelector('[data-nl-caregivers]');
      if (host) {
        var card = document.createElement('div');
        card.className = 'bg-surface-container-low rounded-xl p-space-md flex items-center justify-between shadow-sm';
        card.innerHTML = '<div class="flex items-center gap-space-md min-w-0"><div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-semibold shrink-0"><span class="font-headline-md text-headline-md">' +
          (lang === 'ta' ? 'அ' : lang === 'hi' ? 'आ' : 'N') + '</span></div><div class="min-w-0"><div class="flex items-center gap-2"><h3 class="font-title-md text-title-md text-on-surface">' +
          NL.t(rel.label) + '</h3><span class="font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full">' + NL.t('invited') +
          '</span></div><p class="font-body-sm text-body-sm text-secondary flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-sm">hourglass_top</span>' +
          NL.t('waiting to accept the invitation') + '</p></div></div>';
        host.appendChild(card);
        applyLang(card);
      }
      NL.toast(NL.t('invitation sent'), 'olive');
    }
    return sheet;
  };

  /* A calm two-step check before anything is removed. */
  NL.confirm = function (opts) {
    opts = opts || {};
    return NL.sheet({
      eyebrow: opts.eyebrow,
      title: opts.title,
      subtitle: opts.subtitle,
      html: opts.body ? '<p class="nl-answer">' + opts.body + '</p>' : '',
      actions: [
        {
          label: opts.confirmLabel || NL.t('confirm'),
          kind: 'primary',
          onClick: function () { if (opts.onConfirm) opts.onConfirm(); }
        },
        { label: opts.cancelLabel || NL.t('cancel'), kind: 'ghost' }
      ]
    });
  };

  NL.accessSheet = function (name, role) {
    var sheet = NL.sheet({
      eyebrow: 'CareCircle',
      title: (name || 'Caregiver') + (role ? ' · ' + role : ''),
      subtitle: 'Change what this person can see, or revoke their access entirely.',
      html: '<div id="nl-access">' + PERMS.map(function (p, i) { return permRow(p, i < 2); }).join('') + '</div>' +
            '<p class="nl-note">' + NL.t('only you decide what each person can see. revoke anytime.') + '</p>',
      actions: [
        { label: NL.t('save'), kind: 'primary', onClick: function () { NL.toast(NL.t('access updated'), 'olive'); } },
        {
          label: NL.t('revoke access'),
          kind: 'ghost',
          onClick: function () {
            NL.confirm({
              eyebrow: 'CareCircle',
              title: NL.t('revoke access'),
              subtitle: name ? name + ' — ' + NL.t('no access') : NL.t('no access'),
              body: NL.t('they will no longer see any part of your journey.'),
              confirmLabel: NL.t('revoke access'),
              onConfirm: function () {
                NL.toast(name ? name + ' · ' + NL.t('no access') : NL.t('no access'));
              }
            });
          }
        }
      ]
    });
    bindToggles(sheet.panel);
    return sheet;
  };

  /* ── Ask the care team ────────────────────────── */
  NL.askTeamSheet = function (prefill) {
    var sheet = NL.sheet({
      eyebrow: 'Messages',
      title: NL.t('ask my care team'),
      subtitle: 'Your question goes to the care team with your care plan attached. Typical reply within 2 hours.',
      html: '<label class="font-label-sm text-label-sm uppercase tracking-widest text-secondary" for="nl-q">' + NL.t('your question') + '</label>' +
            '<textarea id="nl-q" rows="4" style="width:100%;margin-top:.5rem;border:1px solid #dac1ba;border-radius:12px;padding:.8rem;font:inherit;font-size:14px;background:#fff;resize:vertical" placeholder="' + NL.t('type your question here…') + '">' + (prefill || '') + '</textarea>' +
            '<p class="nl-note">' + NL.t('only you decide what each person can see. revoke anytime.') + '</p>',
      actions: [
        { label: NL.t('send to my care team'), kind: 'primary', onClick: function () {
          var ta = sheet.panel.querySelector('#nl-q');
          var text = (ta && ta.value || '').trim();
          if (!text) { NL.toast('Please type your question first'); return; }
          var thread = document.querySelector('[data-nl-thread]');
          if (thread) NL.appendMessage(thread, text, 'me');
          NL.toast(NL.t('question sent'), 'olive');
          setTimeout(function () { if (thread) NL.appendMessage(thread, 'Thank you — Dr. Ananya Rao will review this with your care plan and reply shortly.', 'team'); }, 1100);
        } },
        { label: NL.t('cancel'), kind: 'ghost' }
      ]
    });
    return sheet;
  };

  NL.appendMessage = function (thread, text, who) {
    var wrap = document.createElement('div');
    var mine = who === 'me';
    wrap.style.cssText = 'display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:.6rem';
    wrap.innerHTML = '<div style="max-width:82%;background:' + (mine ? '#93452b' : '#f3ede9') + ';color:' + (mine ? '#fff' : '#1d1b19') + ';padding:.7rem .9rem;border-radius:14px;font-size:13.5px;line-height:1.55">' + text + '</div>';
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return wrap;
  };

  /* ── JananiConnect: offline demo ──────────────── */
  var online = true;
  var chip = null;
  var banner = null;

  function ensureNetUI() {
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'nl-conn';
      chip.setAttribute('data-nl-skip', '');
      chip.addEventListener('click', function () { NL.setOnline(!online); });
      var holder = document.querySelector('.nl-lang-holder');
      if (holder && holder.parentElement) holder.parentElement.insertBefore(chip, holder);
      else if (document.querySelector('header > div')) document.querySelector('header > div').appendChild(chip);
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'nl-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('data-nl-skip', '');
      document.body.appendChild(banner);
    }
  }

  function paintNet() {
    ensureNetUI();
    chip.textContent = '';
    var icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.style.fontSize = '14px';
    icon.textContent = online ? 'cloud_done' : 'cloud_off';
    chip.appendChild(icon);
    chip.appendChild(document.createTextNode(online ? NL.t('online') : NL.t('offline')));
    chip.classList.toggle('is-offline', !online);
    banner.classList.toggle('is-open', !online);
    if (!online) banner.textContent = NL.t('signal lost — your saved journey stays readable.');
    document.body.setAttribute('data-connection', online ? 'online' : 'offline');
    document.querySelectorAll('[data-nl-net-badge]').forEach(function (el) {
      el.textContent = online ? NL.t('online') : NL.t('offline');
      el.className = 'nl-chip' + (online ? '' : ' is-offline');
      el.style.background = online ? '#d8e7d5' : '#f1e2dd';
      el.style.color = online ? '#324a35' : '#8a4a35';
    });
  }

  NL.setOnline = function (next) {
    online = !!next;
    /* Let a page that has its own offline showcase mirror the global state. */
    if (typeof window.__nlOnNet === 'function') window.__nlOnNet(online);
    if (!online) {
      paintNet();
      NL.toast(NL.t('signal lost — your saved journey stays readable.'));
      document.querySelectorAll('[data-nl-offline-panel]').forEach(function (p) { p.classList.remove('hidden'); });
      return;
    }
    banner.classList.add('is-open');
    banner.textContent = NL.t('back online — restoring changes…');
    chip.classList.remove('is-offline');
    var bar = document.querySelector('[data-nl-sync-bar]');
    if (bar) bar.style.width = '0%';
    var pct = 0;
    var t = setInterval(function () {
      pct += 12 + Math.random() * 20;
      if (pct >= 100) {
        pct = 100;
        clearInterval(t);
        paintNet();
        setTimeout(function () { banner.classList.remove('is-open'); }, 1200);
        NL.toast(NL.t('everything is up to date.'), 'olive');
      }
      if (bar) bar.style.width = pct + '%';
      var label = document.querySelector('[data-nl-sync-label]');
      if (label) label.textContent = Math.round(pct) + '%';
    }, 240);
    if (bar) bar.style.width = '0%';
  };

  NL.connection = function () { return online; };

  /* ── Guide sheet + declarative wiring ─────────── */
  var GUIDE = {
    title: 'The 40-day recovery window',
    body: 'Rest, warmth and unhurried days help your body heal. Gentle walking, warm fluids and asking for help are all part of recovery. Your care team is one message away whenever something feels unclear.'
  };

  NL.guideSheet = function () {
    return NL.sheet({
      eyebrow: 'Gentle guidance',
      title: GUIDE.title,
      subtitle: 'A calm note from your care team. This is general guidance, not medical advice.',
      html: '<div class="nl-answer">' + GUIDE.body + '</div><p class="nl-note">Assistive, not diagnostic. Please ask your clinician about anything specific to you.</p>',
      actions: [{ label: NL.t('listen'), kind: 'olive', onClick: function () { NL.speak(GUIDE.body); } }, { label: NL.t('close'), kind: 'ghost' }]
    });
  };

  NL.detailSheet = function (el) {
    var card = el.closest('[data-nl-card]');
    var done = NL.t(el.getAttribute('data-detail-done') || 'done');
    var primary = el.getAttribute('data-detail-primary');
    if (primary) primary = NL.t(primary);
    var actions = [];
    if (primary) {
      actions.push({
        label: primary,
        kind: 'primary',
        onClick: function () {
          NL.toast(done, 'olive');
          var status = card && card.querySelector('[data-nl-status]');
          if (status) {
            status.textContent = done;
            status.className = 'font-label-sm text-label-sm text-secondary bg-secondary-container/60 px-2 py-0.5 rounded-full';
          }
          document.dispatchEvent(new CustomEvent('nl:action', { detail: { action: el.getAttribute('data-nl-detail') } }));
        }
      });
    }
    actions.push({ label: NL.t('close'), kind: 'ghost' });
    return NL.sheet({
      eyebrow: NL.t(el.getAttribute('data-detail-eyebrow') || ''),
      title: NL.t(el.getAttribute('data-detail-title') || ''),
      subtitle: NL.t(el.getAttribute('data-detail-sub') || ''),
      html: '<div class="nl-answer">' + NL.t(el.getAttribute('data-detail-body') || '') + '</div>' +
            '<p class="nl-note">' + NL.t(el.getAttribute('data-detail-note') || 'NurtureLoop is assistive, not diagnostic. Your care team decides care.') + '</p>',
      actions: actions
    });
  };

  var NAMED_SHEETS = {
    voice: function () { return NL.voiceSheet(); },
    invite: function () { return NL.inviteSheet(); },
    ask: function () { return NL.askTeamSheet(); },
    guide: function () { return NL.guideSheet(); },
    access: function (el) { return NL.accessSheet(el && el.getAttribute('data-name'), el && el.getAttribute('data-role')); },
    offline: function () { NL.setOnline(!online); }
  };
  NL.openNamed = function (name, el) {
    var fn = NAMED_SHEETS[name];
    if (fn) fn(el);
    else NL.toast('This action arrives in the next release.');
  };

  NL.wireDeclarative = function () {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-nl-go],[data-nl-sheet],[data-nl-toast],[data-nl-speak],[data-nl-back],[data-nl-offline-toggle],[data-nl-detail]');
      if (!t) return;
      var navigates = t.hasAttribute('data-nl-go');
      if (!navigates && t.tagName === 'A') e.preventDefault();
      if (navigates) { location.href = t.getAttribute('data-nl-go'); return; }
      if (t.hasAttribute('data-nl-back')) { if (history.length > 1) history.back(); else location.href = 'index.html'; return; }
      if (t.hasAttribute('data-nl-offline-toggle')) { NL.setOnline(!online); return; }
      if (t.hasAttribute('data-nl-speak')) {
        var key = t.getAttribute('data-nl-speak');
        var src = t.getAttribute('data-nl-speak-text') || key;
        NL.speak(NL.t(src));
        return;
      }
      if (t.hasAttribute('data-nl-detail')) { NL.detailSheet(t); return; }
      if (t.hasAttribute('data-nl-toast')) { NL.toast(NL.t(t.getAttribute('data-nl-toast')), t.getAttribute('data-tone') || undefined); return; }
      if (t.hasAttribute('data-nl-sheet')) { NL.openNamed(t.getAttribute('data-nl-sheet'), t); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var t = e.target.closest('[role="button"][data-nl-detail],[role="button"][data-nl-sheet]');
      if (!t) return;
      e.preventDefault();
      t.click();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-nl-tab]'), function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-nl-tab');
        Array.prototype.forEach.call(document.querySelectorAll('[data-nl-tab]'), function (b) { b.classList.toggle('is-active', b === btn); });
        Array.prototype.forEach.call(document.querySelectorAll('[data-nl-panel]'), function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-nl-panel') !== key);
        });
      });
    });

    var timeline = document.querySelector('[data-nl-timeline]');
    if (timeline) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-nl-filter]'), function (chip) {
        chip.addEventListener('click', function () {
          var cat = chip.getAttribute('data-nl-filter');
          Array.prototype.forEach.call(document.querySelectorAll('[data-nl-filter]'), function (c) {
            var on = c === chip;
            c.className = on ? 'relative py-1 font-title-md text-title-md text-primary shrink-0' : 'py-1 font-body-md text-body-md text-secondary shrink-0 hover:text-on-surface transition-colors';
          });
          var shown = 0;
          Array.prototype.forEach.call(timeline.querySelectorAll('[data-cat]'), function (item) {
            var match = cat === 'all' || item.getAttribute('data-cat').split(' ').indexOf(cat) > -1;
            item.classList.toggle('hidden', !match);
            if (match) shown++;
          });
          var empty = timeline.querySelector('[data-nl-empty]');
          if (empty) empty.classList.toggle('hidden', shown > 0);
        });
      });
    }

    var composer = document.querySelector('[data-nl-composer]');
    if (composer) {
      composer.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = composer.querySelector('input, textarea');
        var thread = document.querySelector('[data-nl-thread]');
        var text = (input && input.value || '').trim();
        if (!text) return;
        if (thread) NL.appendMessage(thread, text, 'me');
        input.value = '';
        NL.toast(NL.t('question sent'), 'olive');
      });
    }

    bindToggles(document);
  };

  document.addEventListener('DOMContentLoaded', function () {
    NL.boot();
    paintNet();
  });
  if (document.readyState !== 'loading') { NL.boot(); paintNet(); }
})();
