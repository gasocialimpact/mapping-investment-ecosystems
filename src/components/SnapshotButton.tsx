import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Camera, Check, Download, AlertCircle } from 'lucide-react';
import { snapshot, warmSnapshotFonts } from '../lib/snapshot';

type Status = 'idle' | 'working' | 'copied' | 'downloaded' | 'error';

const FEEDBACK: Record<Exclude<Status, 'idle' | 'working'>, { icon: typeof Camera; label: string }> = {
  copied: { icon: Check, label: 'Copied' },
  downloaded: { icon: Download, label: 'Saved' },
  error: { icon: AlertCircle, label: "Couldn't capture" },
};

/**
 * Copies the referenced element to the clipboard as a PNG. Sits on cards,
 * charts and tables so a reader can lift one piece of the page into a deck
 * without exporting the whole tab as a PDF.
 */
export function SnapshotButton({
  target,
  label,
  className = '',
}: {
  target: RefObject<HTMLElement>;
  /** Filename stem. A function is resolved on click, for titles that change. */
  label: string | (() => string);
  className?: string;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<number>();

  const run = async () => {
    if (!target.current || status === 'working') return;
    window.clearTimeout(timer.current);
    setStatus('working');
    try {
      setStatus(await snapshot(target.current, typeof label === 'string' ? label : label()));
    } catch {
      setStatus('error');
    }
    timer.current = window.setTimeout(() => setStatus('idle'), 2200);
  };

  // Hovering the button reliably precedes clicking it, so use that to get the
  // font embedding underway before the reader asks for the image.
  const warm = () => {
    if (target.current) warmSnapshotFonts(target.current);
  };

  const feedback = status === 'idle' || status === 'working' ? null : FEEDBACK[status];
  const Icon = feedback?.icon ?? Camera;

  return (
    <button
      type="button"
      data-snapshot="hide"
      onClick={run}
      onMouseEnter={warm}
      onFocus={warm}
      disabled={status === 'working'}
      title="Copy this as an image"
      aria-label={typeof label === 'string' ? `Copy "${label}" as an image` : 'Copy this as an image'}
      className={`flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-1 transition-colors ${
        status === 'error'
          ? 'text-brand-orange'
          : feedback
            ? 'text-brand-green'
            : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
      } ${className}`}
    >
      <Icon size={13} className={status === 'working' ? 'animate-pulse' : ''} />
      {feedback && <span className="whitespace-nowrap">{feedback.label}</span>}
    </button>
  );
}

/**
 * The standard white card, with a snapshot button parked in its top-right
 * corner. Shared by the capital charts, the place report and the Explore
 * sidebar callouts, which were already identical boxes.
 */
export function SnapshotCard({
  title,
  sub,
  note,
  snapshotLabel,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  note?: ReactNode;
  /** Filename stem for the download fallback; defaults to the title. */
  snapshotLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const label = snapshotLabel ?? (typeof title === 'string' ? title : 'snapshot');

  return (
    <div ref={ref} className="relative bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <div className="absolute top-2.5 right-2.5 print:hidden">
        <SnapshotButton target={ref} label={label} />
      </div>
      <h3 className="text-base font-bold text-slate-800 pr-8">{title}</h3>
      {sub && <p className="text-xs text-slate-500 mt-1 max-w-xl">{sub}</p>}
      {children}
      {note && <p className="text-[10px] text-slate-400 mt-2">{note}</p>}
    </div>
  );
}
