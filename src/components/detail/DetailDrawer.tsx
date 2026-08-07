import { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { useDetail } from '../../context/DetailContext';
import { OrgDetail } from './OrgDetail';
import { FlowDetail } from './FlowDetail';
import { InstrumentDetail } from './InstrumentDetail';
import { LocationDetail } from './LocationDetail';
import { ImpactDimensionDetail } from './ImpactDimensionDetail';

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
    <div className="fixed inset-0 z-30 flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        className="relative w-full max-w-2xl bg-white h-full shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            {canGoBack && (
              <button onClick={back} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>
          <button onClick={close} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{content}</div>
      </aside>
    </div>
  );
}
