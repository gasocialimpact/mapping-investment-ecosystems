import { FileDown } from 'lucide-react';

// Prints the full tab content (the print CSS un-clips the scroll layout),
// letting the browser's print dialog save it as a PDF.
export function SavePdfButton() {
  return (
    <div className="flex justify-end pt-4 -mb-2 print:hidden">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <FileDown size={12} /> Save as PDF
      </button>
    </div>
  );
}
