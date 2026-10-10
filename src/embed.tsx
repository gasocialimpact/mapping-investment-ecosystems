// <gsic-ecosystem-map>: the map mounted directly in a host page, no iframe.
//
// Usage (e.g. a WordPress "Custom HTML" block):
//
//   <script type="module" src="https://ecosystem-map.gasocialimpact.com/embed/ecosystem-map.js"></script>
//   <gsic-ecosystem-map></gsic-ecosystem-map>
//
// Optional attribute: top-offset="80" — the height in px of a header the host
// page pins to the top of the window, so record pop-ups and "scroll to" clear
// it. Normally not needed: a pinned header is detected automatically.
//
// The app renders into a shadow root so the host page's theme CSS and the
// app's Tailwind CSS can't restyle each other. Fonts are the exception:
// @font-face only works at the document level, so those go in <head>.
// Built by vite.embed.config.ts with an absolute base, so the app's data,
// fonts and code chunks all load from the map's own site.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import appCss from './index.css?inline';
import fontCss from './fonts.css?inline';
import { setInline } from './lib/inline';

// Applied before the app's CSS: stop the host page's inherited styles (font,
// colour, line height, alignment) leaking into the tool. Tailwind's preflight
// then sets the app's own defaults on :host.
const HOST_RESET = `:host { all: initial; display: block; position: relative; text-align: left; }`;

// Applied after the app's CSS: the standalone app clips to the window and
// scrolls inside itself; inline it grows and the page scrolls.
const INLINE_LAYOUT = `
  #root, .modal-root { height: auto !important; overflow: visible !important; }
  #root { background: #ffffff; color: #1e293b; }
`;

function styleEl(css: string) {
  const el = document.createElement('style');
  el.textContent = css;
  return el;
}

function injectDocumentHead() {
  if (document.getElementById('gsic-ecosystem-map-head')) return;
  const fonts = styleEl(fontCss);
  fonts.id = 'gsic-ecosystem-map-head';
  document.head.appendChild(fonts);
  // Start the two big data fetches straight away, as the standalone page does.
  // (Only across sites: same-site requests send cookies and wouldn't match.)
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  if (base.origin === window.location.origin) return;
  for (const path of ['data/ecosystem.json', 'data/place-counties.json']) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    link.href = `${import.meta.env.BASE_URL}${path}`;
    document.head.appendChild(link);
  }
}

let mounted = false;

class GsicEcosystemMap extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    if (mounted) {
      // The app keeps page-wide state (scroll lock, print), so one per page.
      root.textContent = 'The ecosystem map can only appear once per page.';
      return;
    }
    mounted = true;
    injectDocumentHead();
    root.append(styleEl(HOST_RESET), styleEl(appCss), styleEl(INLINE_LAYOUT));
    const container = document.createElement('div');
    container.id = 'root';
    root.appendChild(container);

    // The record modal gets its own shadow root on <body> (see lib/inline.ts).
    const modalHost = document.createElement('gsic-ecosystem-map-modal');
    const modalRoot = modalHost.attachShadow({ mode: 'open' });
    modalRoot.append(styleEl(HOST_RESET), styleEl(appCss), styleEl(INLINE_LAYOUT));
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-root';
    modalRoot.appendChild(modalContainer);
    document.body.appendChild(modalHost);

    setInline({
      host: this,
      root,
      modalHost,
      modalContainer,
      // Normally detected (lib/inline.ts topInset); the attribute overrides.
      topOffset: this.hasAttribute('top-offset') ? Number(this.getAttribute('top-offset')) || 0 : null,
    });

    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}

if (!customElements.get('gsic-ecosystem-map')) {
  customElements.define('gsic-ecosystem-map', GsicEcosystemMap);
}
