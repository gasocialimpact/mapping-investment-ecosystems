// Single-page PDF export. Instead of letting the browser paginate onto
// letter-size sheets, we set a custom @page size that exactly fits the
// content, and force a fixed layout width so every export is formatted
// identically regardless of the user's window size.

const PAGE_MARGIN = 24; // px
export const APP_PDF_WIDTH = 1552; // px — the app's content width for exports
export const RECORD_PDF_WIDTH = 672; // px — matches the record modal (max-w-2xl)

function printWithPageSize(width: number, height: number, bodyClass: string) {
  const style = document.createElement('style');
  style.textContent = `@media print { @page { size: ${width + PAGE_MARGIN * 2}px ${height + PAGE_MARGIN * 2}px; margin: ${PAGE_MARGIN}px; } }`;
  document.head.appendChild(style);
  document.body.classList.add(bodyClass);
  const cleanup = () => {
    style.remove();
    document.body.classList.remove(bodyClass);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

// Save the current tab as one PDF page at a fixed 1552px layout width.
export async function saveAppAsPdf() {
  const el = document.querySelector('.app-scroll') as HTMLElement | null;
  if (!el) {
    window.print();
    return;
  }
  // Apply the fixed export width first so the height measurement matches the
  // printed layout. The pdf-fixed class also switches the pdf: layout
  // variants on (grids that are viewport media queries on screen), so the
  // export keeps its columns even from a narrow window or embed iframe.
  document.body.classList.add('pdf-fixed');
  // Let ResizeObserver-driven charts re-render at the export widths before
  // measuring — two frames for the observers, then a beat for React.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 300));
  const height = el.scrollHeight;
  printWithPageSize(APP_PDF_WIDTH, height, 'pdf-fixed');
}

// Save a single record modal as one PDF page.
export function saveRecordAsPdf(panel: HTMLElement) {
  // scrollHeight is the full content height even though the modal clips it.
  const height = panel.scrollHeight;
  printWithPageSize(RECORD_PDF_WIDTH, height, 'print-record');
}
