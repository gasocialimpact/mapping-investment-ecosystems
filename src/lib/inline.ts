// Inline mode: the map mounted directly in a host page (no iframe), as the
// <gsic-ecosystem-map> element from src/embed.tsx.
//
// The app then lives in a shadow root, so the host page's CSS and the app's
// CSS can't reach each other. That changes a few things the rest of the app
// otherwise takes for granted:
// - `document.getElementById` can't see into the shadow root; use appRoot().
// - The host page owns the scrollbar, and the window is the viewport.
// - The record modal is rendered into a second shadow root attached to
//   <body>, so a transformed ancestor in the host page can't trap its
//   `position: fixed` inside the article.
// - Print classes go on the host element (`:host(.pdf-fixed)` in the CSS)
//   rather than <body>, which the app's stylesheet can no longer see.

interface InlineState {
  host: HTMLElement;
  root: ShadowRoot;
  /** Container inside the modal's own shadow root, attached to <body>. */
  modalContainer: HTMLElement;
  modalHost: HTMLElement;
  /** Fixed `top-offset` attribute, if the host page set one (px). */
  topOffset: number | null;
}

let state: InlineState | null = null;

export function setInline(next: InlineState) {
  state = next;
}

export const isInline = () => state !== null;

export const inlineState = () => state;

/** Where the app's own elements live: the shadow root inline, else the document. */
export function appRoot(): Document | ShadowRoot {
  return state?.root ?? document;
}

// Host-page chrome pinned to the top of the window (a sticky site header, the
// WordPress admin bar) that pop-ups and "scroll to" should clear. Candidates
// are collected once; whether each is pinned right now is checked at use, as
// themes often only fix the header after the page has scrolled.
let pinnedCandidates: Element[] | null = null;

function findPinnedCandidates(): Element[] {
  const named = document.querySelectorAll('#wpadminbar, #header, header, .site-header, #masthead, .sticky-header');
  const all = Array.from(document.body.querySelectorAll('*')).filter((e) => {
    const p = getComputedStyle(e).position;
    return p === 'fixed' || p === 'sticky';
  });
  return Array.from(new Set([...named, ...all])).filter(
    (e) => !state || (!state.host.contains(e) && !state.modalHost.contains(e)),
  );
}

/** Height of host-page chrome currently pinned over the top of the window, in px. */
export function topInset(): number {
  if (!state) return 0;
  if (state.topOffset !== null) return state.topOffset;
  pinnedCandidates ??= findPinnedCandidates();
  let inset = 0;
  for (const e of pinnedCandidates) {
    const s = getComputedStyle(e);
    if (s.position !== 'fixed' && s.position !== 'sticky') continue;
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    // Spans most of the width and sits against the top: a header, not a
    // floating button or chat widget.
    if (r.top <= 1 && r.height > 0 && r.height < window.innerHeight / 3 && r.width > window.innerWidth * 0.6) {
      inset = Math.max(inset, r.bottom);
    }
  }
  return Math.round(inset);
}

/** Elements that print classes (pdf-fixed, print-record) go on. */
export function printClassTargets(): HTMLElement[] {
  return state ? [state.host, state.modalHost] : [document.body];
}
