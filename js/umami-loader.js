/* Optional Umami page analytics. Never part of the app startup or module graph.
 * Load only after the page has finished loading so a slow/unreachable analytics
 * host cannot delay the Three.js application, DOM readiness or its assets.
 */
(() => {
  'use strict';

  const scriptUrl = 'https://analytics.mielniczuk.com/script.js';
  const websiteId = '2e279074-e8b2-46b5-a5d9-d425d0b2b619';
  const networkTimeoutMs = 8000;
  let attempted = false;

  function loadAnalytics() {
    if (attempted) return;
    attempted = true;
    try {
      const tracker = document.createElement('script');
      tracker.async = true;
      tracker.src = scriptUrl;
      tracker.dataset.websiteId = websiteId;

      let settled = false;
      const expiry = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        tracker.remove(); // Stop a hanging analytics fetch; never retry in a loop.
      }, networkTimeoutMs);

      tracker.addEventListener('load', () => {
        settled = true;
        window.clearTimeout(expiry);
      }, {once: true});
      tracker.addEventListener('error', () => {
        settled = true;
        window.clearTimeout(expiry);
        tracker.remove();
      }, {once: true});
      (document.head || document.documentElement).appendChild(tracker);
    } catch (_) {
      // Analytics is optional. Browser failures must not affect SOLVI.help.
    }
  }

  function scheduleAnalytics() {
    try {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(loadAnalytics, {timeout: 1500});
      } else {
        window.setTimeout(loadAnalytics, 0);
      }
    } catch (_) {
      // Never allow a blocked timer/analytics API to disrupt the main app.
    }
  }

  if (document.readyState === 'complete') scheduleAnalytics();
  else window.addEventListener('load', scheduleAnalytics, {once: true});
})();
