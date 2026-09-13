/* The Enterprise EPIC: "Where does your enterprise stand?"

   Nine situations, scored against the five gates of Figure 1.1.
   Scoring follows the book's Gate Rule: strength at one gate cannot make up for
   failure at another. A gate passes only when its mean reaches the threshold AND
   no answer in it scored zero. The level is the number of consecutive passing
   gates from the bottom of the ladder.

   Runs entirely in the browser. Nothing is stored or sent.
   The pure scoring function is exposed as EPIC.diagnostic.score for testing. */
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
      /* Weakest resolves ties to the lower gate, the more urgent one.
         Strongest resolves ties to the higher gate. */
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

  /* --- ladder ------------------------------------------------------------- */

  function ladder(result) {
    function tier(g) {
      let cls = 'tier';
      let mark = '';
      if (result) {
        if (g.id < result.level || (g.id === result.level)) cls += ' reached';
        if (g.id === result.level) { cls += ' here'; mark = '<span class="mark">You are here</span>'; }
        if (g.id > result.level) cls += ' above';
        if (result.breakGate === g.id) { cls += ' break'; mark = '<span class="mark brk">The break</span>'; }
        if (g.id === result.level && result.breakGate === g.id) mark = '<span class="mark">You are here</span><span class="mark brk">The break</span>';
      }
      return '<div class="' + cls + '"><div class="tk"><svg class="ti" viewBox="0 0 24 24" aria-hidden="true">' +
        ICONS[g.id] + '</svg><span class="tn">' + g.id + '</span></div><div class="tt"><b>' + esc(g.name) +
        ':</b>&nbsp; <i>' + esc(g.question) + '</i><br><span class="tf">' + esc(g.facets) + '</span></div>' + mark + '</div>';
    }
    const g = data.gates;
    return '<div class="figure"><div class="grouplabel gl-top">▲ &nbsp;Where Project EPIC begins</div>' +
      '<div class="grp grp-top">' + tier(g[4]) + tier(g[3]) + tier(g[2]) + '</div>' +
      '<div class="split"><span class="l"></span><span>the threshold most data strategies never cross</span><span class="l"></span></div>' +
      '<div class="grp grp-bot">' + tier(g[1]) + tier(g[0]) + '</div>' +
      '<div class="grouplabel gl-bot">Where most data strategies stop&nbsp; ▼</div>' +
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
        '</span><span class="eyebrow">' + esc(q.eyebrow) + '</span><span class="prompt">' + rich(q.prompt) +
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
    history.replaceState(null, '', location.pathname + '?v=' + data.version + '&a=' + digits);
    showResult(digits, false);
  }

  /* --- result ------------------------------------------------------------- */

  function profileChart(r) {
    const W = 430, H = 178, base = 136, top = 20, bw = 52, gap = (W - bw * 5) / 6;
    let bars = '';
    data.gates.forEach(function (g, i) {
      const m = r.means[i];
      const h = Math.max(2, (m / 3) * (base - top));
      const x = gap + i * (bw + gap);
      const y = base - h;
      let fill = '#20374F', stroke = 'none', text = '#20374F';
      if (g.id === r.level) fill = '#9C7D33';
      if (g.id > r.level) { fill = 'none'; stroke = '#C9B48A'; text = '#5C4A2E'; }
      bars += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="2" fill="' + fill +
        '" stroke="' + stroke + '" stroke-width="1.5"' + (stroke !== 'none' ? ' stroke-dasharray="4 3"' : '') + '/>';
      bars += '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="12" fill="' + text + '">' + fmt(m) + '</text>';
      bars += '<text x="' + (x + bw / 2) + '" y="' + (base + 18) + '" text-anchor="middle" font-size="10.5" fill="#5C4A2E">' + esc(g.name) + '</text>';
    });
    const label = 'Gate scores out of 3. ' + data.gates.map(function (g, i) { return g.name + ' ' + fmt(r.means[i]); }).join(', ') + '.';
    return '<svg class="profile" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '" font-family="Alegreya Sans, system-ui, sans-serif">' +
      '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" stroke="#9C7D33" stroke-width="1"/>' + bars + '</svg>' +
      '<table class="vh"><caption>Gate scores out of 3</caption><tbody>' + data.gates.map(function (g, i) {
        return '<tr><th scope="row">' + esc(g.name) + '</th><td>' + fmt(r.means[i]) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function gateName(id) {
    const g = data.gates.find(function (x) { return x.id === id; });
    return g ? g.name : '';
  }

  function breakLine(r) {
    if (!r.breakGate) return 'Every gate passes.';
    return 'The climb breaks at ' + gateName(r.breakGate) + '.';
  }

  function profileLine(r) {
    if (!r.strongest) return 'Your scores are even across all five gates.';
    const s = 'Strongest at ' + gateName(r.strongest) + ', weakest at ' + gateName(r.weakest) + '.';
    if (r.strongest > r.level) return s + ' Strength above the break does not lift the level: an enterprise cannot make up for failure at one gate by excelling at another.';
    return s;
  }

  function shareText(r, lvl) {
    const url = location.origin + location.pathname + '?v=' + data.version + '&a=' + r.digits;
    return data.share.template
      .replace('{level}', r.level)
      .replace('{name}', lvl.name)
      .replace('{standing}', r.standing === 'provisional' ? ', provisionally' : '')
      .replace('{breakLine}', breakLine(r))
      .replace('{chapters}', lvl.chapters.map(function (c) { return c.n; }).join(', '))
      .replace('{url}', url);
  }

  function copy(text, button) {
    const done = function () {
      const was = button.textContent;
      button.textContent = 'Copied';
      const live = root.querySelector('[data-live]');
      if (live) live.textContent = 'Copied to clipboard.';
      setTimeout(function () { button.textContent = was; }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* nothing more to do */ }
      document.body.removeChild(ta);
    }
  }

  function showResult(digits, shared) {
    const r = score(digits, data);
    if (!r) return;
    r.digits = digits;
    const lvl = data.levels[r.level - 1];

    const chapters = lvl.chapters.map(function (c) {
      const ch = data.chapters[String(c.n)];
      return '<a class="card chap" href="canvases.html#adhyaya-' + c.n + '"><span class="eyebrow">Adhyaya ' + c.n +
        ' · Parva ' + esc(ch.parva) + '</span><h3>' + esc(ch.title) + '</h3><p>' + rich(c.why) + '</p></a>';
    }).join('');

    els.result.innerHTML =
      (shared ? '<p class="shared">This result was shared with you. <a href="diagnose.html">Take the diagnostic yourself</a>.</p>' : '') +
      '<div class="res-grid"><div class="res-ladder">' + ladder(r) + '</div><div class="res-head">' +
      '<p class="eyebrow">Your result</p>' +
      '<h2 id="res-title" tabindex="-1">Level ' + r.level + ' · ' + esc(lvl.name) +
      (r.standing === 'provisional' ? '<span class="prov">Reached provisionally</span>' : '') + '</h2>' +
      '<p class="verdict">' + rich(lvl.verdict) + '</p>' +
      '<p class="brk-line"><strong>' + esc(breakLine(r)) + '</strong> ' + esc(profileLine(r)) + '</p>' +
      '<div class="prof">' + profileChart(r) + '</div>' +
      '</div></div>' +
      '<div class="res-body">' +
      '<div class="glance"><p class="lbl">You will recognise this</p><p>' + rich(lvl.symptom) + '</p></div>' +
      '<div class="vidura"><p class="lbl">Vidura\'s Challenge</p><p>' + rich(lvl.challenge) + '</p></div>' +
      '<h3 class="read-first">Read first</h3><div class="grid three chaps">' + chapters + '</div>' +
      '<p class="capability"><span class="eyebrow">The capability that addresses it</span><br>' + rich(lvl.capability) + '</p>' +
      '<div class="principle cta"><p class="lbl">The Enterprise EPIC</p><p>' + rich(lvl.cta) + '</p>' +
      '<div class="btn-row"><a class="btn gold" href="index.html#buy">Get the book</a></div></div>' +
      '<div class="share"><p class="eyebrow">Share or keep this result</p><div class="btn-row">' +
      '<button class="btn ghost" type="button" data-copy-link>Copy link</button>' +
      '<button class="btn ghost" type="button" data-copy-text>Copy result</button>' +
      '<a class="btn ghost" href="diagnose.html" data-retake>Retake</a>' +
      '<a class="btn ghost" href="canvases.html">Browse the canvases</a></div>' +
      '<p class="vh" aria-live="polite" data-live></p></div>' +
      '<p class="note">This is a two-minute reflection, not an assessment. Treat the result as a question to test with your own evidence.</p>' +
      '</div>';

    els.intro.hidden = true;
    els.form.hidden = true;
    els.result.hidden = false;
    if (EPIC.keepWordsWhole) EPIC.keepWordsWhole(els.result);

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
      started = false;
      updateProgress();
      els.intro.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });

    /* The intro and form are now hidden, so the result begins at the top of the
       page. Go there (a shared link already opens at the top), then move focus to
       the heading without jumping, so the eyebrow and shared note stay in view. */
    if (!shared) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    const title = document.getElementById('res-title');
    if (title) { title.focus({ preventScroll: true }); }

    EPIC.track(shared ? 'diagnose_shared_open' : 'diagnose_complete', { level: r.level, standing: r.standing });
  }

  /* --- boot --------------------------------------------------------------- */

  (EPIC.loadJSON ? EPIC.loadJSON('data/diagnostic.json') :
    fetch('data/diagnostic.json').then(function (r) { return r.json(); }))
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
          showResult(a, true);
        } else {
          els.notice.hidden = false;
          els.notice.textContent = 'That link did not contain a valid result. Take the check below.';
          history.replaceState(null, '', location.pathname);
        }
      }
    })
    .catch(function () {
      els.notice.hidden = false;
      els.notice.textContent = 'The diagnostic could not load. If you opened this file directly, serve the folder with a local web server instead.';
    });
})();
