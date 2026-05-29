import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type DetailType = 'organization' | 'flow' | 'instrument' | 'location' | 'contact' | 'impactDimension';

interface DetailEntry {
  type: DetailType;
  id: string;
}

interface DetailContextValue {
  current: DetailEntry | null;
  open: (type: DetailType, id: string) => void;
  close: () => void;
  back: () => void;
  canGoBack: boolean;
}

const Ctx = createContext<DetailContextValue>({
  current: null,
  open: () => {},
  close: () => {},
  back: () => {},
  canGoBack: false,
});

export function DetailProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<DetailEntry | null>(null);
  const [stack, setStack] = useState<DetailEntry[]>([]);

  const open = useCallback((type: DetailType, id: string) => {
    setCurrent((prev) => {
      if (prev) setStack((s) => [...s, prev]);
      return { type, id };
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

  return (
    <Ctx.Provider value={{ current, open, close, back, canGoBack: stack.length > 0 }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDetail() {
  return useContext(Ctx);
}
