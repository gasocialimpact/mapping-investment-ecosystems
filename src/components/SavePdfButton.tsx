import { FileDown } from 'lucide-react';
import { saveAppAsPdf } from '../lib/savePdf';

// Saves the full tab as a single-page PDF at a fixed export width, so every
// export is formatted identically regardless of window size. `bare` drops the
// right-aligned banner wrapper so the button can sit inside another row (the
// Explore tab parks it in the place-report header).
export function SavePdfButton({ bare }: { bare?: boolean }) {
  const button = (
    <button
      onClick={saveAppAsPdf}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors print:hidden"
    >
      <FileDown size={12} /> Save as PDF
    </button>
  );
  if (bare) return button;
  return <div className="flex justify-end pt-4 -mb-2 print:hidden">{button}</div>;
}
