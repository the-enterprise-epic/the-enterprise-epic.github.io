/* The Enterprise EPIC: "Where does your enterprise stand?"

   Nine situations, scored against the five levels of Figure 1.1.
   Scoring follows a principle adapted from the book: strength at one level
   cannot make up for failure at another. A level holds only when its mean
   reaches the threshold AND no answer in it scored zero. The result is the
   number of consecutive levels that hold, counted from the bottom.

   Runs entirely in the browser. Nothing is sent anywhere. The only thing kept
   is this tab's own latest result, so returning to it is not shown as a result
   someone else shared. The pure scoring function is EPIC.diagnostic.score. */
(function () {
  'use strict';

  const EPIC = window.EPIC = window.EPIC || {};

  /* ---------------------------------------------------------------------------
     Scoring. Pure: same input, same output, no DOM.
     --------------------------------------------------------------------------- */

  function isValid(digits, data) {
    const n = data.questions.length;
    return typeof digits === 'string' && new RegExp('^[1-4]{' + n + '}$').test(digits);
  }

  function score(digits, data) {
    if (!isValid(digits, data)) return null;

    const scores = data.questions.map(function (q, i) {
      return q.options[Number(digits[i]) - 1].score;
    });

    const gates = data.gates.map(function (g) {
      const vals = [];
      data.questions.forEach(function (q, i) { if (q.gate === g.id) vals.push(scores[i]); });
      const mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      const hardFail = vals.some(function (v) { return v === 0; });
      return { id: g.id, name: g.name, mean: mean, pass: mean >= data.thresholds.pass && !hardFail };
    });

    let climbed = 0;
    for (let i = 0; i < gates.length; i++) { if (gates[i].pass) climbed++; else break; }

    const level = Math.max(1, climbed);
    const breakGate = climbed < gates.length ? gates[climbed].id : null;
    const standing = gates[level - 1].mean >= data.thresholds.held ? 'held' : 'provisional';
    const means = gates.map(function (g) { return g.mean; });

    let strongest = null, weakest = null;
    const allEqual = means.every(function (m) { return m === means[0]; });
    if (!allEqual) {
      /* Weakest resolves ties to the lower level, the more urgent one.
         Strongest resolves ties to the higher level. */
      weakest = gates.reduce(function (best, g) { return g.mean < best.mean ? g : best; }).id;
      strongest = gates.reduce(function (best, g) { return g.mean >= best.mean ? g : best; }).id;
    }

    return { level: level, standing: standing, breakGate: breakGate,
             means: means, scores: scores, strongest: strongest, weakest: weakest };
  }

  EPIC.diagnostic = { score: score, isValid: isValid };

  /* ---------------------------------------------------------------------------
     Page. Only runs where the diagnostic container exists.
     --------------------------------------------------------------------------- */

  const root = document.getElementById('diagnose');
  if (!root) return;

  const ICONS = {
    1: '<rect x="4" y="14" width="16" height="4" rx="2"/><rect x="6" y="9.5" width="12" height="4" rx="2"/><rect x="8.5" y="5" width="7" height="4" rx="2"/>',
    2: '<circle cx="8" cy="10" r="3.5"/><line x1="10.5" y1="12.5" x2="19" y2="21"/><line x1="16" y1="18" x2="18.5" y2="15.5"/><line x1="18" y1="20" x2="20.5" y2="17.5"/>',
    3: '<path d="M3 12 C8 6 16 6 21 12 C16 18 8 18 3 12 Z"/><circle cx="12" cy="12" r="2.6"/>',
    4: '<line x1="12" y1="4" x2="12" y2="19"/><line x1="4.5" y1="8" x2="19.5" y2="8"/><path d="M4.5 8 L2.5 13 L6.5 13 Z"/><path d="M19.5 8 L17.5 13 L21.5 13 Z"/><line x1="8" y1="19.5" x2="16" y2="19.5"/>',
    5: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="6.3" y1="6.3" x2="17.7" y2="17.7"/><line x1="17.7" y1="6.3" x2="6.3" y2="17.7"/>'
  };

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rich = EPIC.richText || function (s) { return String(s); };
  const esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const fmt = function (m) { return (Math.round(m * 10) / 10).toString(); };
  const icon = function (name) { return EPIC.icon ? EPIC.icon(name) : ''; };
  const OWN_KEY = 'epic-own-result';
  const baseTitle = document.title;

  const els = {
    notice: root.querySelector('[data-notice]'),
    intro: root.querySelector('[data-intro]'),
    ladderIntro: root.querySelector('[data-ladder-intro]'),
    form: root.querySelector('[data-form]'),
    questions: root.querySelector('[data-questions]'),
    progress: root.querySelector('[data-progress]'),
    reveal: root.querySelector('[data-reveal]'),
    missing: root.querySelector('[data-missing]'),
    result: root.querySelector('[data-result]')
  };

  let data = null;
  let started = false;
  let lastPointer = 0;
  root.addEventListener('pointerdown', function () { lastPointer = Date.now(); }, true);

  function remember(digits) { try { sessionStorage.setItem(OWN_KEY, digits); } catch (e) { /* storage blocked */ } }
  function isOwn(digits) { try { return sessionStorage.getItem(OWN_KEY) === digits; } catch (e) { return false; } }

  function levelName(id) {
    const g = data.gates.find(function (x) { return x.id === id; });
    return g ? g.name : '';
  }

  /* Level 1 is the floor: when it does not hold, the result is not "reached
     provisionally" and there is no separate break to point at. */
  function notSecure(r) { return r.breakGate === r.level; }

  /* --- ladder ------------------------------------------------------------- */

  function ladder(r) {
    function tier(g) {
      let cls = 'tier';
      let mark = '';
      if (r) {
        if (g.id <= r.level) cls += ' reached';
        if (g.id > r.level) cls += ' above';
        if (g.id === r.level) {
          if (notSecure(r)) { cls += ' break'; mark = '<span class="mark brk">Not yet secure</span>'; }
          else { cls += ' here'; mark = '<span class="mark">You are here</span>'; }
        } else if (r.breakGate === g.id) {
          cls += ' break';
          mark = '<span class="mark brk">The break</span>';
        }
      }
      return '<div class="' + cls + '"><div class="tk"><svg class="ti" viewBox="0 0 24 24" aria-hidden="true">' +
        ICONS[g.id] + '</svg><span class="tn">' + g.id + '</span></div><div class="tt"><b>' + esc(g.name) +
        ':</b>&nbsp; <i>' + esc(g.question) + '</i><br><span class="tf">' + esc(g.facets) + '</span></div>' + mark + '</div>';
    }
    const g = data.gates;
    return '<div class="figure"><div class="grouplabel gl-top"><span aria-hidden="true">▲</span> &nbsp;Where Project EPIC begins</div>' +
      '<div class="grp grp-top">' + tier(g[4]) + tier(g[3]) + tier(g[2]) + '</div>' +
      '<div class="split"><span class="l"></span><span>the threshold most data strategies never cross</span><span class="l"></span></div>' +
      '<div class="grp grp-bot">' + tier(g[1]) + tier(g[0]) + '</div>' +
      '<div class="grouplabel gl-bot">Where most data strategies stop&nbsp; <span aria-hidden="true">▼</span></div>' +
      '<p class="figcap">Figure 1.1 · The climb from data-rich to intelligent</p></div>';
  }

  /* --- form --------------------------------------------------------------- */

  function renderForm() {
    els.questions.innerHTML = data.questions.map(function (q, qi) {
      const opts = q.options.map(function (o, oi) {
        const id = q.id + '-' + (oi + 1);
        return '<label class="opt" for="' + id + '"><input type="radio" id="' + id + '" name="' + q.id +
          '" value="' + (oi + 1) + '"><span>' + rich(o.text) + '</span></label>';
      }).join('');
      return '<fieldset class="q" id="f-' + q.id + '"><legend><span class="qn">' + (qi + 1) +
        '</span><span class="eyebrow"><svg class="gi" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[q.gate] + '</svg>' +
        esc(q.eyebrow) + '</span><span class="prompt">' + rich(q.prompt) +
        '</span></legend><div class="opts">' + opts + '</div></fieldset>';
    }).join('');
  }

  function answers() {
    return data.questions.map(function (q) {
      const c = els.form.querySelector('input[name="' + q.id + '"]:checked');
      return c ? c.value : '';
    });
  }

  function updateProgress() {
    const a = answers();
    const done = a.filter(Boolean).length;
    els.progress.textContent = done + ' of ' + a.length + ' answered';
    els.progress.parentElement.style.setProperty('--pct', (done / a.length * 100) + '%');
    els.reveal.setAttribute('aria-disabled', done === a.length ? 'false' : 'true');
    if (done === a.length) els.missing.textContent = '';
  }

  function onChange(e) {
    if (!e.target.matches('input[type="radio"]')) return;
    if (!started) { started = true; EPIC.track('diagnose_start', {}); }
    updateProgress();

    /* Move on to the next unanswered question only after a tap or click.
       Keyboard users change answers with the arrow keys, and scrolling away
       from the focused answer would lose their place. */
    if (Date.now() - lastPointer > 1000) return;

    const a = answers();
    const current = data.questions.findIndex(function (q) { return q.id === e.target.name; });
    let next = -1;
    for (let i = current + 1; i < a.length; i++) { if (!a[i]) { next = i; break; } }
    if (next >= 0) {
      const target = document.getElementById('f-' + data.questions[next].id);
      if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }
  }

  function onReveal(e) {
    e.preventDefault();
    const a = answers();
    const missing = [];
    a.forEach(function (v, i) { if (!v) missing.push(i + 1); });
    if (missing.length) {
      els.missing.textContent = 'Still to answer: question' + (missing.length > 1 ? 's ' : ' ') + missing.join(', ') + '.';
      const first = els.form.querySelector('#f-' + data.questions[missing[0] - 1].id + ' input');
      if (first) first.focus();
      return;
    }
    const digits = a.join('');
    remember(digits);
    history.replaceState(null, '', location.pathname + '?v=' + data.version + '&a=' + digits);
    showResult(digits, false, true);
  }

  /* --- result ------------------------------------------------------------- */

  function standingLabel(r) {
    if (notSecure(r)) return 'Not yet secure';
    return r.standing === 'provisional' ? 'Reached provisionally' : '';
  }

  function breakLine(r) {
    if (!r.breakGate) return 'Every level holds.';
    if (notSecure(r)) return 'The climb has not started: ' + levelName(1) + ' does not hold yet.';
    return 'The climb breaks at ' + levelName(r.breakGate) + '.';
  }

  function profileLine(r) {
    if (r.means.every(function (m) { return m === 0; })) return 'None of the five levels holds yet.';
    if (!r.strongest) return 'Your answers score the same at every level.';
    const s = 'Strongest at ' + levelName(r.strongest) + ', weakest at ' + levelName(r.weakest) + '.';
    if (r.strongest > r.level) {
      return s + ' Strength above the break does not lift the result: an enterprise cannot make up for failure at one level by excelling at another.';
    }
    return s;
  }

  function provisionalNote(r) {
    return (r.standing === 'provisional' && !notSecure(r))
      ? ' Provisionally means this level holds, but not by a wide margin.'
      : '';
  }

  /* The profile is drawn in HTML rather than SVG so its text stays at a real,
     readable size on every screen instead of shrinking with the drawing. */
  function profileChart(r) {
    const passAt = data.thresholds.pass / 3 * 100;
    const cols = data.gates.map(function (g, i) {
      const m = r.means[i];
      const h = m / 3 * 100;
      let state = 'reached';
      if (g.id === r.level) state = notSecure(r) ? 'above' : 'here';
      if (g.id > r.level) state = 'above';
      return '<div class="pcol ' + state + '"><span class="pbar" style="height:' + h + '%"></span>' +
        '<span class="pval" style="bottom:calc(' + h + '% + 4px)">' + fmt(m) + '</span></div>';
    }).join('');
    const names = data.gates.map(function (g) {
      return '<span><b class="pnum">' + g.id + '</b><span class="pname">' + esc(g.name) + '</span></span>';
    }).join('');
    const label = 'Level scores out of 3, pass mark 2. ' +
      data.gates.map(function (g, i) { return g.name + ' ' + fmt(r.means[i]); }).join(', ') + '.';
    return '<figure class="prof" role="img" aria-label="' + esc(label) + '">' +
      '<figcaption class="pcap" aria-hidden="true">Level scores, out of 3</figcaption>' +
      '<div class="pplot" aria-hidden="true"><div class="ppass" style="bottom:' + passAt + '%"></div>' + cols + '</div>' +
      '<div class="pnames" aria-hidden="true">' + names + '</div>' +
      '<p class="pkey" aria-hidden="true"><span class="ki"><span class="k reached"></span>Holds</span><span class="ki"><span class="k here"></span>Your result</span><span class="ki"><span class="k above"></span>Above the break</span><span class="ki"><span class="k pass"></span>Pass mark</span></p>' +
      '</figure>';
  }

  function shareText(r, lvl) {
    const url = location.origin + location.pathname + '?v=' + data.version + '&a=' + r.digits;
    const standing = standingLabel(r);
    return data.share.template
      .replace('{level}', r.level)
      .replace('{name}', lvl.name)
      .replace('{standing}', standing ? ', ' + standing.toLowerCase() : '')
      .replace('{breakLine}', breakLine(r))
      .replace('{chapters}', lvl.chapters.map(function (c) { return c.n; }).join(', '))
      .replace('{url}', url);
  }

  function copy(text, button) {
    const label = button.querySelector('.bl') || button;
    const done = function () {
      const was = label.textContent;
      label.textContent = 'Copied';
      const live = root.querySelector('[data-live]');
      if (live) live.textContent = 'Copied to clipboard.';
      setTimeout(function () { label.textContent = was; }, 2000);
    };
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* nothing more to do */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
  }

  function showResult(digits, shared, fromReveal) {
    const r = score(digits, data);
    if (!r) return;
    r.digits = digits;
    const lvl = data.levels[r.level - 1];
    const standing = standingLabel(r);

    const chapters = lvl.chapters.map(function (c) {
      const ch = data.chapters[String(c.n)];
      return '<div class="card chap"><p class="eyebrow">' + icon('book') + 'In the book · Adhyaya&nbsp;' + c.n + '</p>' +
        '<h3>' + esc(ch.title) + '</h3><p>' + rich(c.why) + '</p>' +
        '<p class="chap-link"><a href="canvases.html#adhyaya-' + c.n + '">See its canvas</a></p></div>';
    }).join('');

    els.result.innerHTML =
      (shared ? '<p class="shared">This result was shared with you. <a href="diagnose.html">Take the diagnostic yourself</a>.</p>' : '') +
      '<div class="res-grid"><div class="res-head">' +
      '<p class="eyebrow">' + (shared ? 'Shared result' : 'Your result') + '</p>' +
      '<h2 id="res-title" tabindex="-1">Level ' + r.level + ' · ' + esc(lvl.name) +
      (standing ? ' <span class="prov">' + standing + '</span>' : '') + '</h2>' +
      '<p class="verdict">' + rich(lvl.verdict) + '</p>' +
      '<p class="brk-line"><strong>' + esc(breakLine(r)) + '</strong> ' + esc(profileLine(r) + provisionalNote(r)) + '</p>' +
      profileChart(r) +
      '</div><div class="res-ladder">' + ladder(r) + '</div></div>' +
      '<div class="res-body">' +
      '<div class="glance"><p class="lbl">You will recognise this</p><p>' + rich(lvl.symptom) + '</p></div>' +
      '<div class="vidura"><p class="lbl">Vidura\'s Challenge</p><p>' + rich(lvl.challenge) + '</p></div>' +
      '<h3 class="read-first">Read first</h3><div class="grid three chaps">' + chapters + '</div>' +
      '<p class="capability"><span class="eyebrow">The capability that addresses it</span> ' + rich(lvl.capability) + '</p>' +
      '<div class="principle cta"><p class="lbl">The Enterprise EPIC</p><p>' + rich(lvl.cta) + '</p>' +
      '<div class="btn-row"><a class="btn gold" href="./#buy">Get the book</a></div></div>' +
      '<div class="share"><p class="eyebrow">Share or keep this result</p><div class="btn-row">' +
      '<button class="btn ghost" type="button" data-copy-link>' + icon('link') + '<span class="bl">Copy link</span></button>' +
      '<button class="btn ghost" type="button" data-copy-text>' + icon('copy') + '<span class="bl">Copy result</span></button>' +
      '<a class="btn ghost" href="diagnose.html" data-retake>' + icon('retake') + '<span class="bl">' + (shared ? 'Take it yourself' : 'Retake') + '</span></a>' +
      '<a class="btn ghost" href="canvases.html">' + icon('scroll') + '<span class="bl">Browse the canvases</span></a></div>' +
      '<p class="vh" aria-live="polite" data-live></p></div>' +
      '<p class="note">This is a short reflection, not an assessment. Treat the result as a question to test with your own evidence.</p>' +
      '</div>';

    els.intro.hidden = true;
    els.form.hidden = true;
    els.result.hidden = false;
    if (EPIC.keepWordsWhole) EPIC.keepWordsWhole(els.result);
    document.title = 'Level ' + r.level + ' · ' + lvl.name + ' · The Enterprise EPIC';

    els.result.querySelector('[data-copy-link]').addEventListener('click', function (e) {
      copy(location.origin + location.pathname + '?v=' + data.version + '&a=' + digits, e.currentTarget);
      EPIC.track('diagnose_share', { method: 'link' });
    });
    els.result.querySelector('[data-copy-text]').addEventListener('click', function (e) {
      copy(shareText(r, lvl), e.currentTarget);
      EPIC.track('diagnose_share', { method: 'text' });
    });
    els.result.querySelector('[data-retake]').addEventListener('click', function (e) {
      e.preventDefault();
      history.replaceState(null, '', location.pathname);
      els.form.reset();
      els.result.hidden = true;
      els.result.innerHTML = '';
      els.intro.hidden = false;
      els.form.hidden = false;
      document.title = baseTitle;
      started = false;
      updateProgress();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });

    /* The intro and form are hidden, so the result begins at the top of the page. */
    if (fromReveal) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    const title = document.getElementById('res-title');
    if (title) title.focus({ preventScroll: true });

    EPIC.track(shared ? 'diagnose_shared_open' : 'diagnose_complete', { level: r.level, standing: r.standing });
  }

  /* --- boot --------------------------------------------------------------- */

  (EPIC.loadJSON ? EPIC.loadJSON('data/diagnostic.json') :
    fetch('data/diagnostic.json').then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); }))
    .then(function (d) {
      data = d;
      els.ladderIntro.innerHTML = ladder(null);
      renderForm();
      if (EPIC.keepWordsWhole) { EPIC.keepWordsWhole(els.ladderIntro); EPIC.keepWordsWhole(els.questions); }
      els.form.addEventListener('change', onChange);
      els.reveal.addEventListener('click', onReveal);
      updateProgress();
      root.classList.add('ready');

      const p = new URLSearchParams(location.search);
      if (p.has('a')) {
        const v = p.has('v') ? Number(p.get('v')) : 1;
        const a = p.get('a');
        if (v === data.version && isValid(a, data)) {
          showResult(a, !isOwn(a), false);
        } else {
          els.notice.hidden = false;
          els.notice.textContent = 'That link did not contain a valid result. Take the diagnostic below.';
          history.replaceState(null, '', location.pathname);
        }
      }
    })
    .catch(function () {
      els.notice.hidden = false;
      els.notice.innerHTML = 'The diagnostic could not load just now. <button class="btn ghost" type="button" data-retry>Try again</button>';
      const retry = els.notice.querySelector('[data-retry]');
      if (retry) retry.addEventListener('click', function () { location.reload(); });
    });
})();
