import { useEffect, useRef } from 'react';
import { X, ArrowLeft, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDetail } from '../../context/DetailContext';
import { useVisibleBand } from '../../lib/useVisibleBand';
import { saveRecordAsPdf } from '../../lib/savePdf';
import { SnapshotButton } from '../SnapshotButton';
import { OrgDetail } from './OrgDetail';
import { FlowDetail } from './FlowDetail';
import { InstrumentDetail } from './InstrumentDetail';
import { LocationDetail } from './LocationDetail';
import { ImpactDimensionDetail } from './ImpactDimensionDetail';

const EDGE_GAP = 16; // px of breathing room at the bottom of the visible band

// Centered record modal (no sliding drawers anywhere in the app). It is placed
// inside the on-screen slice of the frame rather than at the top of the
// document, so an embed taller than the browser window still opens records
// where the reader is looking.
export function DetailDrawer() {
  const { current, close, back, canGoBack, step, position } = useDetail();
  const band = useVisibleBand();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [current, close, step]);

  // Start each record at the top, including when paging through a list.
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [current?.type, current?.id]);

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

  // The record's own heading makes the better filename than its type.
  const recordLabel = () => panelRef.current?.querySelector('h2')?.textContent?.trim() || 'record';

  const offset = Math.min(Math.round(band.height * 0.06), 48);
  const maxHeight = Math.max(band.height - offset - EDGE_GAP, 240);
  const atStart = !!position && position.index === 1;
  const atEnd = !!position && position.index === position.total;

  return (
    <div
      className="record-modal fixed inset-0 z-30 flex items-start justify-center px-4"
      style={{ paddingTop: band.top + offset, paddingBottom: EDGE_GAP }}
      onClick={close}
    >
      <div className="record-overlay absolute inset-0 bg-black/30" />
      <div
        ref={panelRef}
        className="record-panel relative w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-y-auto"
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Excluded from snapshots for the same reason it is hidden in print:
            the toolbar is chrome, not part of the record. */}
        <div data-snapshot="hide" className="sticky top-0 bg-white z-10 flex items-center gap-2 px-5 py-3 border-b border-slate-100 print:hidden">
          <div className="flex-1 min-w-0">
            {canGoBack && (
              <button onClick={back} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>

          {position && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => step(-1)}
                disabled={atStart}
                aria-label="Previous record"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                {position.index} of {position.total}
              </span>
              <button
                onClick={() => step(1)}
                disabled={atEnd}
                aria-label="Next record"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div className="flex-1 flex items-center justify-end gap-2">
            <SnapshotButton target={panelRef} label={recordLabel} />
            <button
              onClick={() => panelRef.current && saveRecordAsPdf(panelRef.current)}
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
