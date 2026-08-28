import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export type DetailType = 'organization' | 'flow' | 'instrument' | 'location' | 'impactDimension';

interface DetailEntry {
  type: DetailType;
  id: string;
  /** Ids of the other records in the list this one was opened from. */
  siblings?: string[];
}

export type OpenDetail = (type: DetailType, id: string, siblings?: string[]) => void;

interface DetailContextValue {
  current: DetailEntry | null;
  open: OpenDetail;
  close: () => void;
  back: () => void;
  canGoBack: boolean;
  /** Move through the list the current record was opened from. */
  step: (delta: number) => void;
  /** 1-based place in that list, or null when the record has no siblings. */
  position: { index: number; total: number } | null;
}

const Ctx = createContext<DetailContextValue>({
  current: null,
  open: () => {},
  close: () => {},
  back: () => {},
  canGoBack: false,
  step: () => {},
  position: null,
});

export function DetailProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<DetailEntry | null>(null);
  const [stack, setStack] = useState<DetailEntry[]>([]);

  const open = useCallback<OpenDetail>((type, id, siblings) => {
    setCurrent((prev) => {
      if (prev) setStack((s) => [...s, prev]);
      return { type, id, siblings };
    });
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    setStack([]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) {
        setCurrent(null);
        return s;
      }
      const next = [...s];
      setCurrent(next.pop()!);
      return next;
    });
  }, []);

  // Paging within a list replaces the current record rather than stacking, so
  // "Back" still returns to wherever the reader entered the list.
  const step = useCallback((delta: number) => {
    setCurrent((prev) => {
      if (!prev?.siblings) return prev;
      const at = prev.siblings.indexOf(prev.id);
      const next = at + delta;
      if (at < 0 || next < 0 || next >= prev.siblings.length) return prev;
      return { ...prev, id: prev.siblings[next] };
    });
  }, []);

  const position = useMemo(() => {
    if (!current?.siblings || current.siblings.length < 2) return null;
    const at = current.siblings.indexOf(current.id);
    return at < 0 ? null : { index: at + 1, total: current.siblings.length };
  }, [current]);

  return (
    <Ctx.Provider value={{ current, open, close, back, canGoBack: stack.length > 0, step, position }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDetail() {
  return useContext(Ctx);
}
