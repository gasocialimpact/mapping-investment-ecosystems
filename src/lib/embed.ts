// Talking to the page that embeds us.
//
// A fixed-height iframe is a bad fit for this tool: the content is far taller
// than any sensible frame, so the reader ends up with a scrollbar inside a
// scrollbar, and anything the app pins to "the viewport" is really pinned to
// the frame — most of which is off screen.
//
// The fix is for the host page to own the scrolling. It resizes the frame to
// the content and tells us where the browser window sits, so the app can lay
// out in one continuous flow. Hosts that do not add the snippet still work;
// they just get the self-contained scrolling version.

const APP = 'ga-ecosystem-map';
const HOST = 'ga-ecosystem-map-host';

/** Sent up to the host page. */
type OutboundMessage =
  | { source: typeof APP; type: 'ready' }
  | { source: typeof APP; type: 'height'; height: number }
  | { source: typeof APP; type: 'scrollTo'; top: number };

/** Sent down by the host snippet. */
export interface HostViewport {
  /** Offset of the window's top edge within this frame; negative if below. */
  top: number;
  /** Height of the browser window. */
  height: number;
}

export type EmbedMode =
  /** Not in a frame — the window is the viewport. */
  | 'standalone'
  /** In a frame with no host snippet — fill the frame and scroll internally. */
  | 'framed'
  /** Host is resizing the frame to our content — lay out in one flow. */
  | 'flow';

export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access threw — we are definitely in a frame
  }
}

function post(message: OutboundMessage) {
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // Nothing to talk to; the fallback layout covers it.
  }
}

/**
 * Ask the host page to scroll so that a point inside this frame comes into
 * view. Cross-origin frames cannot scroll their parent themselves, so in flow
 * mode `scrollIntoView` is a no-op and this takes its place.
 */
export function requestHostScroll(top: number) {
  post({ source: APP, type: 'scrollTo', top: Math.round(top) });
}

interface Listeners {
  onViewport: (v: HostViewport) => void;
  onMode: (mode: EmbedMode) => void;
}

// How long to wait for the host snippet to answer before settling for the
// self-contained layout. Short enough that nobody watches a blank frame.
const HANDSHAKE_MS = 600;
// Ignore sub-pixel churn so a resize never ping-pongs with the host.
const HEIGHT_EPSILON = 2;

/**
 * Open the channel to the host page. Returns a teardown function.
 *
 * Height is reported from a ResizeObserver rather than on a timer, so the
 * frame follows tab switches, accordions and county selections without polling.
 */
export function connectToHost({ onViewport, onMode }: Listeners): () => void {
  if (!isEmbedded()) {
    onMode('standalone');
    return () => {};
  }

  let mode: EmbedMode = 'framed';
  let lastHeight = 0;
  let frame = 0;

  // Measure the app root, not the document. `documentElement.scrollHeight` is
  // floored at the frame's own height, so once the host grew the frame the
  // document could never report anything smaller and the frame would latch at
  // its tallest — leaving a slab of blank space under short tabs.
  const contentRoot = () => document.getElementById('root') ?? document.body;

  const measure = () => {
    frame = 0;
    const height = Math.ceil(contentRoot().getBoundingClientRect().height);
    if (!height || Math.abs(height - lastHeight) < HEIGHT_EPSILON) return;
    lastHeight = height;
    post({ source: APP, type: 'height', height });
  };

  const scheduleMeasure = () => {
    if (frame) return;
    frame = requestAnimationFrame(measure);
  };

  const onMessage = (e: MessageEvent) => {
    const data = e.data;
    if (!data || data.source !== HOST) return;
    if (data.type === 'ack') {
      if (mode !== 'flow') {
        mode = 'flow';
        onMode('flow');
      }
      // The host resizes us, so start reporting.
      lastHeight = 0;
      scheduleMeasure();
    }
    if (data.type === 'viewport' && typeof data.top === 'number') {
      onViewport({ top: data.top, height: data.height });
    }
  };

  window.addEventListener('message', onMessage);
  post({ source: APP, type: 'ready' });

  // Content changes: tab switches, unfurled accordions, a county report.
  const observer = new ResizeObserver(() => {
    if (mode === 'flow') scheduleMeasure();
  });
  observer.observe(contentRoot());

  const settle = window.setTimeout(() => {
    if (mode === 'framed') onMode('framed');
  }, HANDSHAKE_MS);

  return () => {
    window.clearTimeout(settle);
    window.removeEventListener('message', onMessage);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
