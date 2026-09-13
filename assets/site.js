/* The Enterprise EPIC: shared page behaviour.
   Loaded on every page. Exposes a small window.EPIC namespace so later tools
   (the diagnostic, and the three experiences still to come) share one way of
   loading data and one way of recording events. */
(function () {
  'use strict';

  const EPIC = window.EPIC = window.EPIC || {};

  /* Fetch JSON relative to the site root. Pages declare their depth with
     <html data-root="../"> when they live in a subfolder. */
  const root = document.documentElement.dataset.root || '';
  EPIC.loadJSON = function (path) {
    return fetch(root + path).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  };

  /* Analytics hook. analytics.js replaces this when measurement is active;
     until then events go nowhere, and nothing on the page depends on them. */
  EPIC.track = EPIC.track || function () {};

  /* Render text safely. Content files may carry <i> and <b> only. */
  EPIC.richText = function (s) {
    const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/&lt;(\/?)(i|b)&gt;/g, '<$1$2>');
  };

  /* Plain text for use inside HTML. */
  EPIC.escape = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* An icon from the site's sprite, drawn in the line style of Figure 1.1.
     Always decorative: the text beside it carries the meaning. */
  EPIC.icon = function (name) {
    return '<svg class="ic" aria-hidden="true" focusable="false"><use href="' + root +
      'assets/icons.svg#i-' + name + '"></use></svg>';
  };

  /* Mark the current page in the nav. */
  const here = (location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav a.nl').forEach(function (a) {
    const target = (a.getAttribute('href') || '').split('#')[0];
    if (target && target === here) a.setAttribute('aria-current', 'page');
  });

  /* Buy cards, rendered from data/stores.json into any [data-stores] element.
     The noscript links inside that element keep the page usable without JS
     and when opened from the file system, where fetch is blocked. */
  const buy = document.querySelector('[data-stores]');
  if (buy) {
    EPIC.loadJSON('data/stores.json').then(function (data) {
      buy.innerHTML = '';
      data.stores.forEach(function (s, i) {
        const card = document.createElement('div');
        card.className = 'store';
        /* QR codes help someone reading on a laptop pick up the book on their
           phone. CSS hides them on phones, where they cannot be scanned. */
        const qr = document.createElement('div');
        qr.className = 'qr';
        try { qr.innerHTML = window.QR ? window.QR.svg(s.url) : ''; } catch (e) { qr.remove(); }
        card.appendChild(qr);

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = s.name;
        card.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = s.format + ' · ' + s.region;
        card.appendChild(meta);

        /* The first store is the main call to action; the rest are quieter.
           The spoken label begins with the visible words, then warns about the
           new tab, so voice control and screen readers agree with the screen. */
        const a = document.createElement('a');
        a.className = i === 0 ? 'btn' : 'btn ghost';
        a.href = s.url;
        a.rel = 'noopener';
        a.target = '_blank';
        a.innerHTML = 'Buy on ' + EPIC.escape(s.name) + EPIC.icon('external') +
          '<span class="vh"> (opens in a new tab)</span>';
        card.appendChild(a);

        buy.appendChild(card);
      });
    }).catch(function () { /* keep the noscript fallback visible */
      const ns = buy.querySelector('.fallback');
      if (ns) ns.hidden = false;
    });
  }

  /* Keep hyphenated words whole. A browser may break a line after a hyphen,
     leaving "innovate-" at the end of one line and "with-sanjeev" at the start
     of the next, which reads like a stray dash. Each hyphenated word, with any
     trailing punctuation, is wrapped so it moves to the next line intact.
     Pages that render text later (the diagnostic) call this again on it. */
  const COMPOUND = /[A-Za-z0-9’']+(?:-[A-Za-z0-9’']+)+[.,;:!?)]*/g;
  EPIC.keepWordsWhole = function (scope) {
    const base = scope || document.body;
    if (!base) return;
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const p = node.parentElement;
        if (!p || p.closest('script, style, svg, textarea, title, .nw')) return NodeFilter.FILTER_REJECT;
        return /\w-\w/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(COMPOUND, function (match, offset) {
        if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
        const span = document.createElement('span');
        span.className = 'nw';
        span.textContent = match;
        frag.appendChild(span);
        last = offset + match.length;
        return match;
      });
      if (last === 0) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  };
  EPIC.keepWordsWhole();

  /* Year in the footer. */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
