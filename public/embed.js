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

  // Height of the host page's own fixed/sticky chrome at the top of the window
  // — a site nav, a cookie bar. The tool cannot see any of this from inside the
  // frame, so without it a modal opens underneath the nav with its close button
  // out of reach.
  function topChromeInset() {
    if (!document.elementsFromPoint) return 0;
    var found = 0;
    var els = document.elementsFromPoint(Math.floor(window.innerWidth / 2), 2);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === document.body || el === document.documentElement) continue;
      if (el.tagName === 'IFRAME') continue;
      var pos = window.getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      var box = el.getBoundingClientRect();
      if (box.top <= 2 && box.bottom > found) found = box.bottom;
    }
    // Never let an oversized fixed element swallow the usable area.
    return Math.min(Math.round(found), Math.round(window.innerHeight * 0.4));
  }

  // Tell the tool where the browser window sits relative to the frame, so it
  // can open record modals in view instead of at the top of a tall frame.
  function reportViewport(frame) {
    send(frame, {
      type: 'viewport',
      top: frame.getBoundingClientRect().top,
      height: window.innerHeight,
      inset: topChromeInset(),
    });
  }

  // Hold the page still while the tool has a record modal open. The modal
  // learns where the window is over postMessage, so a scrolling page would
  // always leave it a frame behind and visibly drifting.
  var locked = null;
  function setScrollLock(on) {
    var doc = document.documentElement;
    var body = document.body;
    if (on) {
      if (locked) return;
      // Swapping the scrollbar for padding keeps the page from jumping sideways.
      var scrollbar = window.innerWidth - doc.clientWidth;
      var padding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      locked = { overflow: doc.style.overflow, paddingRight: body.style.paddingRight };
      doc.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = padding + scrollbar + 'px';
    } else {
      if (!locked) return;
      doc.style.overflow = locked.overflow;
      body.style.paddingRight = locked.paddingRight;
      locked = null;
    }
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

    if (data.type === 'scrollLock') {
      setScrollLock(!!data.locked);
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
    // Never let a reload strand the page in a locked state.
    frame.addEventListener('load', function () {
      setScrollLock(false);
      reportViewport(frame);
    });
  });
})();
