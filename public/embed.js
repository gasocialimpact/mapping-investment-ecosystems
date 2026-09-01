/**
 * Host-page snippet for the Georgia Impact Investing Ecosystem Map.
 *
 * A fixed-height iframe cannot fit this tool: the content is taller than any
 * frame you would want on a page, so readers get a scrollbar inside a
 * scrollbar and the map ends up floating in dead space. This script lets the
 * frame grow to its content, so the page has one scrollbar and the embed
 * behaves like the rest of the page.
 *
 * Usage — no build step, works on any CMS that allows a script tag:
 *
 *   <iframe
 *     src="https://gasocialimpact.github.io/mapping-investment-ecosystems/"
 *     data-ecosystem-map
 *     width="100%" height="1200"
 *     title="Georgia's Impact Investing Ecosystem Map"
 *     allow="clipboard-write"
 *     style="border:none;border-radius:8px;display:block;width:100%"></iframe>
 *   <script src="https://gasocialimpact.github.io/mapping-investment-ecosystems/embed.js"></script>
 *
 * The height attribute is only the height before the tool reports its own.
 */
(function () {
  'use strict';

  var APP = 'ga-ecosystem-map';
  var HOST = 'ga-ecosystem-map-host';
  var MIN_HEIGHT = 400;

  function frames() {
    return [].slice.call(document.querySelectorAll('iframe[data-ecosystem-map]'));
  }

  function send(frame, message) {
    if (!frame.contentWindow) return;
    message.source = HOST;
    frame.contentWindow.postMessage(message, '*');
  }

  // Tell the tool where the browser window sits relative to the frame, so it
  // can open record modals in view instead of at the top of a tall frame.
  function reportViewport(frame) {
    send(frame, {
      type: 'viewport',
      top: frame.getBoundingClientRect().top,
      height: window.innerHeight,
    });
  }

  var ticking = false;
  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    // One report per frame, so scrolling stays smooth.
    requestAnimationFrame(function () {
      ticking = false;
      frames().forEach(reportViewport);
    });
  }

  function findFrame(win) {
    var list = frames();
    for (var i = 0; i < list.length; i++) {
      if (list[i].contentWindow === win) return list[i];
    }
    return null;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== APP) return;
    var frame = findFrame(event.source);
    if (!frame) return;

    if (data.type === 'ready') {
      // Acknowledge so the tool knows it may lay out in one continuous flow.
      send(frame, { type: 'ack', autoHeight: true });
      reportViewport(frame);
      return;
    }

    if (data.type === 'height') {
      var height = Math.max(MIN_HEIGHT, Math.round(data.height));
      if (parseInt(frame.style.height, 10) !== height) {
        frame.style.height = height + 'px';
        // The frame just moved everything below it; re-report immediately.
        reportViewport(frame);
      }
      return;
    }

    if (data.type === 'scrollTo') {
      // A point inside the frame the tool wants brought into view.
      var top = frame.getBoundingClientRect().top + window.scrollY + (data.top || 0);
      window.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);

  // The frame may already be loaded when this script runs.
  frames().forEach(function (frame) {
    frame.setAttribute('scrolling', 'no');
    reportViewport(frame);
  });
})();
