// Single-page PDF export. Instead of letting the browser paginate onto
// letter-size sheets, we set a custom @page size that exactly fits the
// content, and force a fixed layout width so every export is formatted
// identically regardless of the user's window size.

import { appRoot, inlineState, printClassTargets } from './inline';

const PAGE_MARGIN = 24; // px
export const APP_PDF_WIDTH = 1552; // px — the app's content width for exports
export const RECORD_PDF_WIDTH = 672; // px — matches the record modal (max-w-2xl)

// Inline, printing would print the host page, with the tool still inside the
// host's layout, where wrappers can crop it, offset it or paint behind it
// (the GSIC site's full-width rows do all three). So for the print the tool is
// lifted out to be a direct child of <body>, everything else is hidden, and
// it goes back where it was afterwards. Moving the element keeps its shadow
// root and the app inside it intact.
const INLINE_PRINT_ONLY_TOOL = `@media print {
  html, body { background: #ffffff !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
  body > *:not(gsic-ecosystem-map):not(gsic-ecosystem-map-modal) { display: none !important; }
  gsic-ecosystem-map, gsic-ecosystem-map-modal { position: static !important; width: auto !important; margin: 0 !important; transform: none !important; }
}`;

/** Lift the inline tool out of the host page's layout; returns the undo. */
function liftForPrint(): () => void {
  const inline = inlineState();
  if (!inline) return () => {};
  const { host } = inline;
  const scrollY = window.scrollY;
  const placeholder = document.createComment('gsic-ecosystem-map');
  host.parentNode?.insertBefore(placeholder, host);
  document.body.insertBefore(host, inline.modalHost);
  const style = document.createElement('style');
  style.textContent = INLINE_PRINT_ONLY_TOOL;
  document.head.appendChild(style);
  return () => {
    style.remove();
    placeholder.replaceWith(host);
    window.scrollTo(0, scrollY);
  };
}

function printWithPageSize(width: number, height: number, bodyClass: string, restore: () => void) {
  const style = document.createElement('style');
  style.textContent = `@media print { @page { size: ${width + PAGE_MARGIN * 2}px ${height + PAGE_MARGIN * 2}px; margin: ${PAGE_MARGIN}px; } }`;
  document.head.appendChild(style);
  const targets = printClassTargets();
  targets.forEach((t) => t.classList.add(bodyClass));
  const cleanup = () => {
    style.remove();
    targets.forEach((t) => t.classList.remove(bodyClass));
    restore();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// Save the current tab as one PDF page at a fixed 1552px layout width.
export async function saveAppAsPdf() {
  const el = appRoot().querySelector('.app-scroll') as HTMLElement | null;
  if (!el) {
    window.print();
    return;
  }
  // Inline, take the tool out of the host page's layout before measuring, so
  // the measurement is of the layout that prints.
  const restore = liftForPrint();
  // Apply the fixed export width first so the height measurement matches the
  // printed layout. The pdf-fixed class also switches the pdf: layout
  // variants on (grids that are viewport media queries on screen), so the
  // export keeps its columns even from a narrow window or embed iframe.
  printClassTargets().forEach((t) => t.classList.add('pdf-fixed'));
  // Let ResizeObserver-driven charts re-render at the export widths before
  // measuring — two frames for the observers, then a beat for React.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 300));
  // Inline the whole tool prints (title bar and tabs included), so measure
  // all of it rather than just the scroll area.
  const shell = inlineState() ? (appRoot().querySelector('.app-shell') as HTMLElement | null) : null;
  const height = (shell ?? el).scrollHeight;
  printWithPageSize(APP_PDF_WIDTH, height, 'pdf-fixed', restore);
}

// Save a single record modal as one PDF page.
export function saveRecordAsPdf(panel: HTMLElement) {
  // scrollHeight is the full content height even though the modal clips it.
  const height = panel.scrollHeight;
  printWithPageSize(RECORD_PDF_WIDTH, height, 'print-record', liftForPrint());
}
