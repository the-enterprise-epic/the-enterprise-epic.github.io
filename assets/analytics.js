/* The Enterprise EPIC: privacy-first measurement.

   Written for this site. It follows the same privacy stance as the author's
   other book site: Google Analytics 4 in cookieless mode, advertising signals
   refused, nothing written to the visitor's device, and a permanent opt-out.

   Until a real measurement ID is set below, this file does nothing at all.

   To switch it on:
     1. Create a GA4 property and a web data stream for
        the-enterprise-epic.github.io
     2. Paste the Measurement ID (G-XXXXXXXXXX) into GA_MEASUREMENT_ID
     3. Publish                                                                */

const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

(function () {
  'use strict';

  if (!/^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;

  /* Local previews never count. */
  const host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return;

  /* Opt-out. Visit any page once with ?epic-optout=1 and this browser is never
     measured again; ?epic-optout=0 reverses it. The privacy page links both. */
  const KEY = 'epic-optout';
  const params = new URLSearchParams(location.search);
  if (params.has(KEY)) {
    try {
      if (params.get(KEY) === '0') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, '1');
    } catch (e) { /* storage blocked */ }
  }
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) { /* ignore */ }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted'
  });

  const cfg = {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    client_storage: 'none'
  };

  /* A printed QR or a talk slide can carry ?src=label. Record it as the
     campaign so offline traffic is distinguishable. */
  const src = params.get('src');
  if (src && !params.has('utm_source')) {
    cfg.campaign_source = src;
    cfg.campaign_medium = params.get('medium') || 'qr';
    cfg.campaign_name = 'offline-' + src;
  }

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, cfg);

  const me = document.currentScript;
  const page = (me && me.dataset.page) || 'index';

  /* Hand the shared hook to the rest of the site. */
  window.EPIC = window.EPIC || {};
  window.EPIC.track = function (name, props) {
    gtag('event', name, Object.assign({ source_page: page }, props || {}));
  };
  const track = window.EPIC.track;

  const STORES = {
    'notionpress.com': 'Notion Press',
    'www.amazon.in': 'Amazon.in',
    'www.amazon.com': 'Amazon.com',
    'www.amazon.co.uk': 'Amazon.co.uk'
  };

  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';

    if (href.startsWith('mailto:')) { track('pack_request', { method: 'email' }); return; }
    if (a.hasAttribute('data-request')) { track('pack_request', { method: 'contact_form' }); }
    if (a.hasAttribute('data-download')) { track('canvas_download', { canvas: a.dataset.download }); }

    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;

    track('outbound_click', { link_domain: url.hostname, link_url: url.href });
    const store = STORES[url.hostname];
    if (store) track('buy_click', { store: store });
  }, true);

  if (page === '404') {
    track('page_not_found', {
      not_found_path: location.pathname + location.search,
      not_found_referrer: document.referrer || '(none)'
    });
  }
})();
