import { toBlob, getFontEmbedCSS } from 'html-to-image';

// PNG rather than JPEG: these are mostly text, numbers and thin chart marks,
// and JPEG's ringing artefacts show badly on both.
const PIXEL_RATIO = 2; // crisp when pasted into slides at 100%
const BACKGROUND = '#ffffff'; // a transparent PNG pastes as a mess into Slides
const CLIPBOARD_TIMEOUT_MS = 4000; // past this the write is assumed stuck

/** Marks a node — the snapshot button itself, mostly — as not-for-capture. */
export const SNAPSHOT_EXCLUDE = { 'data-snapshot': 'hide' } as const;

// The capture renders into an isolated SVG document, so the webfont has to be
// inlined as a data URI or the text falls back to a system sans. Resolving it
// means fetching the Google Fonts CSS plus every font file it references, so
// it is done once and the promise reused for the rest of the session.
//
// Falling back to system type is NOT a graceful degradation here. The capture
// freezes every element to the width it has in the live font and only then
// re-renders the text, so a wider fallback overflows boxes it was never
// measured for: labels clip mid-word, ellipses appear where the text actually
// fits, and flex rows wrap. The font has to be there, so the budget is
// generous — it is paid once per session, and warmSnapshotFonts() usually
// spends it before the reader clicks.
const FONT_TIMEOUT_MS = 10_000;
let fontCss: Promise<string> | null = null;

async function resolveFontCss(node: HTMLElement): Promise<string> {
  // getFontEmbedCSS reads the loaded stylesheets, so wait for the document's
  // own webfonts to settle before asking.
  try {
    await document.fonts?.ready;
  } catch {
    // Font loading API unavailable — carry on and try the embed anyway.
  }
  return getFontEmbedCSS(node);
}

function embeddedFontCss(node: HTMLElement): Promise<string> {
  if (fontCss) return fontCss;
  const attempt = Promise.race([
    resolveFontCss(node),
    new Promise<string>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS, '')),
  ]).catch(() => '');
  fontCss = attempt;
  // Don't cache a failure — the next snapshot gets a fresh try.
  attempt.then((css) => {
    if (!css && fontCss === attempt) fontCss = null;
  });
  return attempt;
}

/**
 * Start resolving the webfont before it is needed. Called when a snapshot
 * button is hovered or focused, which almost always precedes the click.
 */
export function warmSnapshotFonts(node: HTMLElement) {
  void embeddedFontCss(node);
}

function isHidden(node: Node): boolean {
  return (node as HTMLElement).dataset?.snapshot === 'hide';
}

// scrollHeight covers content clipped by a scroll container but omits the
// borders, and offsetHeight is the other way round. Take whichever is taller
// so nothing is cropped either way.
function fullHeight(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const borders =
    (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  return Math.ceil(Math.max(node.scrollHeight + borders, node.offsetHeight));
}

// html-to-image finishes its canvas step inside a requestAnimationFrame, which
// browsers stop running for a hidden or fully offscreen frame. A reader who
// can click the button can see it, so this should not happen — but bound it
// anyway so the button reports a failure instead of staying disabled forever.
const RENDER_TIMEOUT_MS = 15_000;

async function renderPng(node: HTMLElement): Promise<Blob> {
  // Resolved before the render clock starts, so a slow font fetch does not eat
  // the drawing budget.
  const fontEmbedCSS = await embeddedFontCss(node);
  // Without the webfont the capture is not merely off-brand, it is wrong: text
  // clips and wraps inside boxes measured for a different typeface. Better a
  // retryable failure than a broken image pasted into a deck unnoticed.
  if (!fontEmbedCSS) throw new Error('The typeface could not be loaded for the image.');

  const blob = await withTimeout(
    capture(node, fontEmbedCSS),
    RENDER_TIMEOUT_MS,
    'The image took too long to render.',
  );
  if (!blob) throw new Error('The image came back empty.');
  return blob;
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function capture(node: HTMLElement, fontEmbedCSS: string): Promise<Blob | null> {
  return toBlob(node, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: BACKGROUND,
    // Styles land on the clone, not the live node, so nothing flickers on
    // screen. Un-clipping lets a scrolled panel capture its whole content.
    style: { maxHeight: 'none', overflow: 'visible' },
    height: fullHeight(node),
    filter: (n) => !isHidden(n),
    fontEmbedCSS,
  });
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'snapshot'
  );
}

function download(blob: Blob, label: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(label)}-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before the blob goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type SnapshotResult = 'copied' | 'downloaded';

/**
 * Copy an element to the clipboard as a PNG, falling back to a download.
 *
 * The fallback is not an edge case: `navigator.clipboard.write` needs the
 * `clipboard-write` permissions policy, and a cross-origin iframe does not get
 * it unless the host page puts `allow="clipboard-write"` on the embed tag. So
 * the copy is attempted, and whatever it does the reader still ends up with
 * the image.
 */
export async function snapshot(node: HTMLElement, label: string): Promise<SnapshotResult> {
  const pending = renderPng(node);
  pending.catch(() => {}); // a rejection is handled below, not at the top level

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      // Hand over the promise rather than an awaited blob: Safari drops the
      // user activation across an await and refuses the write.
      const write = navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]);
      await pending; // the render is the slow part; time the write on its own
      const timedOut = Symbol('timeout');
      const raced = await Promise.race([
        write.then(() => null),
        new Promise((resolve) => setTimeout(resolve, CLIPBOARD_TIMEOUT_MS, timedOut)),
      ]);
      // A pending permission prompt can leave the write hanging indefinitely;
      // stop waiting on it and save the file instead of freezing the button.
      if (raced !== timedOut) return 'copied';
    } catch {
      // No clipboard permission (or no user activation) — fall through.
    }
  }

  download(await pending, label);
  return 'downloaded';
}
