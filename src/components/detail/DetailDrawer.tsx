import { useEffect } from 'react';
import { X, ArrowLeft, FileDown } from 'lucide-react';
import { useDetail } from '../../context/DetailContext';
import { OrgDetail } from './OrgDetail';
import { FlowDetail } from './FlowDetail';
import { InstrumentDetail } from './InstrumentDetail';
import { LocationDetail } from './LocationDetail';
import { ImpactDimensionDetail } from './ImpactDimensionDetail';

// Prints only the open record: the print-record body class hides everything
// else (see index.css), and the browser's dialog saves it as a PDF.
function printRecord() {
  document.body.classList.add('print-record');
  const done = () => {
    document.body.classList.remove('print-record');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

// Centered record modal (no sliding drawers anywhere in the app).
export function DetailDrawer() {
  const { current, close, back, canGoBack } = useDetail();

  useEffect(() => {
    if (!current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [current, close]);

  if (!current) return null;

  let content: React.ReactNode = null;
  switch (current.type) {
    case 'organization':
      content = <OrgDetail id={current.id} />;
      break;
    case 'flow':
      content = <FlowDetail id={current.id} />;
      break;
    case 'instrument':
      content = <InstrumentDetail id={current.id} />;
      break;
    case 'location':
      content = <LocationDetail id={current.id} />;
      break;
    case 'impactDimension':
      content = <ImpactDimensionDetail id={current.id} />;
      break;
  }

  return (
    <div className="record-modal fixed inset-0 z-30 flex items-start justify-center pt-[7vh] px-4 pb-6" onClick={close}>
      <div className="record-overlay absolute inset-0 bg-black/30" />
      <div
        className="record-panel relative w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b border-slate-100 print:hidden">
          <div>
            {canGoBack && (
              <button onClick={back} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printRecord}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <FileDown size={12} /> Download PDF
            </button>
            <button onClick={close} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-5">{content}</div>
      </div>
    </div>
  );
}
