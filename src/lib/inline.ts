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
  /** Height of any host-page chrome pinned to the top of the window, in px. */
  topOffset: number;
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

/** Elements that print classes (pdf-fixed, print-record) go on. */
export function printClassTargets(): HTMLElement[] {
  return state ? [state.host, state.modalHost] : [document.body];
}
