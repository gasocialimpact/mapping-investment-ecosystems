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
// borders, and offsetHeight is the other way round. Both are ROUNDED integers,
// so a card whose true border-box is fractional (grid and flex tracks produce
// e.g. 599.5px all the time) loses its last sliver — which is exactly where
// the 1px border lives. Measure the true rect too, round everything UP, and
// keep a pixel of slack; the background fill makes the slack invisible.
function captureSize(node: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(node);
  const borders =
    (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  const rect = node.getBoundingClientRect();
  return {
    width: Math.ceil(rect.width) + 1,
    height: Math.ceil(Math.max(node.scrollHeight + borders, node.offsetHeight, rect.height)) + 1,
  };
}

// html-to-image finishes its canvas step inside a requestAnimationFrame, which
// browsers stop running for a hidden or fully offscreen frame. A reader who
// can click the button can see it, so this should not happen — but bound it
// anyway so the button reports a failure instead of staying disabled forever.
const RENDER_TIMEOUT_MS = 15_000;

// Safari and other non-Blink WebKit browsers routinely botch the FIRST
// foreignObject paint — fonts missing, content shifted or cut at the top —
// and settle only on a repeat draw.
const WEBKIT =
  typeof navigator !== 'undefined' &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

// Every capture target is a bordered card, so a fully white top edge always
// means a bad paint (shifted or half-drawn), never a real result.
async function topEdgeBlank(blob: Blob): Promise<boolean> {
  try {
    const img = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = Math.min(4, img.height);
    const cx = cv.getContext('2d');
    if (!cx) return false;
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return false;
    }
    return true;
  } catch {
    return false; // can't inspect — don't block the capture on it
  }
}

async function renderPng(node: HTMLElement): Promise<Blob> {
  // Resolved before the render clock starts, so a slow font fetch does not eat
  // the drawing budget.
  const fontEmbedCSS = await embeddedFontCss(node);
  // Without the webfont the capture is not merely off-brand, it is wrong: text
  // clips and wraps inside boxes measured for a different typeface. Better a
  // retryable failure than a broken image pasted into a deck unnoticed.
  if (!fontEmbedCSS) throw new Error('The typeface could not be loaded for the image.');

  const render = () =>
    withTimeout(capture(node, fontEmbedCSS), RENDER_TIMEOUT_MS, 'The image took too long to render.');

  // Discarded warm-up pass so WebKit's first-paint bugs land on a throwaway.
  if (WEBKIT) await render().catch(() => null);

  let blob = await render();
  // Re-render when the paint came back visibly wrong; two retries covers the
  // stragglers without stalling the button on a genuine failure.
  for (let i = 0; i < 2 && blob && (await topEdgeBlank(blob)); i++) {
    blob = await render();
  }
  if (!blob) throw new Error('The image came back empty.');
  return withDpi(blob);
}

// Canvas PNGs carry no physical-resolution metadata, so Word reads the 2×
// render as a 96 DPI picture twice the intended size, overflows the page, and
// visually crops it from the top (PowerPoint shrinks pasted images to fit;
// Word does not). Stamping a pHYs chunk at 96 × PIXEL_RATIO DPI makes every
// consumer size the image at the card's natural on-screen dimensions.
async function withDpi(blob: Blob): Promise<Blob> {
  try {
    const buf = new Uint8Array(await blob.arrayBuffer());
    // PNG signature (8 bytes) + IHDR chunk (4 len + 4 type + 13 data + 4 crc).
    const IHDR_END = 33;
    const isPng =
      buf.length > IHDR_END &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!isPng) return blob;

    const ppm = Math.round((96 * PIXEL_RATIO) / 0.0254); // pixels per metre
    const chunk = new Uint8Array(21); // 4 length + 4 "pHYs" + 9 data + 4 crc
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    view.setUint32(8, ppm);
    view.setUint32(12, ppm);
    chunk[16] = 1; // unit: metre
    let crc = 0xffffffff;
    for (let i = 4; i < 17; i++) {
      crc ^= chunk[i];
      for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    view.setUint32(17, (crc ^ 0xffffffff) >>> 0);

    return new Blob([buf.slice(0, IHDR_END), chunk, buf.slice(IHDR_END)], { type: 'image/png' });
  } catch {
    return blob; // metadata is a nicety — never fail the capture over it
  }
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function capture(node: HTMLElement, fontEmbedCSS: string): Promise<Blob | null> {
  const { width, height } = captureSize(node);
  return toBlob(node, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: BACKGROUND,
    // Styles land on the clone, not the live node, so nothing flickers on
    // screen. Un-clipping lets a scrolled panel capture its whole content;
    // zeroing the margin matters because a space-y stack gives cards a real
    // margin-top, which would shift the clone down inside the frame and push
    // its bottom border off the canvas.
    style: { maxHeight: 'none', overflow: 'visible', margin: '0' },
    width,
    height,
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
