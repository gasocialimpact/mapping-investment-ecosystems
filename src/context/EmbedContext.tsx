import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { connectToHost, isEmbedded, requestHostScroll } from '../lib/embed';
import type { EmbedMode, HostViewport } from '../lib/embed';

export interface VisibleBand {
  /** Top of the on-screen slice, in this document's client coordinates. */
  top: number;
  /** Height of the on-screen slice, in px. */
  height: number;
}

interface EmbedContextValue {
  mode: EmbedMode;
  /** The part of this frame the reader can actually see. */
  band: VisibleBand;
  /** Scroll a point in this frame into view, whoever owns the scrollbar. */
  scrollIntoView: (el: HTMLElement | null) => void;
  /** Return to the top of the tool, whoever owns the scrollbar. */
  scrollToTop: () => void;
}

const Ctx = createContext<EmbedContextValue>({
  mode: 'standalone',
  band: { top: 0, height: 0 },
  scrollIntoView: () => {},
  scrollToTop: () => {},
});

// Tiling the frame with probes is how the visible slice is found when the host
// page has not been given the snippet: a single full-height probe stops
// reporting once the frame covers the window, because its visible *ratio* no
// longer changes even as the visible slice moves.
const PROBES = 24;
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

export function EmbedProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EmbedMode>(() => (isEmbedded() ? 'framed' : 'standalone'));
  const [band, setBand] = useState<VisibleBand>(() => ({ top: 0, height: window.innerHeight }));
  // Written by the observer/host and read by scrollIntoView without making it
  // a new function on every scroll.
  const bandRef = useRef(band);
  bandRef.current = band;

  const applyBand = (next: VisibleBand) => {
    setBand((prev) =>
      Math.abs(prev.top - next.top) < 1 && Math.abs(prev.height - next.height) < 1 ? prev : next,
    );
  };

  // Channel to the host page.
  useEffect(() => {
    return connectToHost({
      onMode: setMode,
      onViewport: (v: HostViewport) => {
        // The host reports where the window sits relative to this frame; clamp
        // it to the frame to get the slice that is really on screen.
        const frameHeight = document.documentElement.scrollHeight;
        const top = Math.max(0, -v.top);
        const bottom = Math.min(frameHeight, -v.top + v.height);
        applyBand({ top, height: Math.max(0, bottom - top) });
      },
    });
  }, []);

  // Fallback measurement, only while the host is not reporting.
  useEffect(() => {
    if (mode === 'flow') return;

    if (mode === 'standalone' || typeof IntersectionObserver === 'undefined') {
      const onResize = () => applyBand({ top: 0, height: window.innerHeight });
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const slice = 100 / PROBES;
    const probes = Array.from({ length: PROBES }, (_, i) => {
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        `position:fixed;left:0;right:0;pointer-events:none;z-index:-1;` +
        `top:${i * slice}%;height:${slice}%`;
      document.body.appendChild(el);
      return el;
    });

    const seen = new Map<Element, { top: number; bottom: number }>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const r = entry.intersectionRect;
          if (r.height > 0) seen.set(entry.target, { top: r.top, bottom: r.bottom });
          else seen.delete(entry.target);
        }
        if (seen.size === 0) return; // scrolled fully past — keep the last reading
        let top = Infinity;
        let bottom = -Infinity;
        for (const r of seen.values()) {
          if (r.top < top) top = r.top;
          if (r.bottom > bottom) bottom = r.bottom;
        }
        applyBand({ top, height: bottom - top });
      },
      { threshold: THRESHOLDS },
    );
    probes.forEach((p) => observer.observe(p));

    const onResize = () => {
      probes.forEach((p) => {
        observer.unobserve(p);
        observer.observe(p);
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      probes.forEach((p) => p.remove());
    };
  }, [mode]);

  const value = useMemo<EmbedContextValue>(
    () => ({
      mode,
      band,
      scrollIntoView: (el) => {
        if (!el) return;
        if (mode === 'flow') {
          // The host owns the scrollbar, and a cross-origin frame may not move
          // it directly — ask instead.
          requestHostScroll(el.getBoundingClientRect().top + window.scrollY);
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      scrollToTop: () => {
        if (mode === 'flow') requestHostScroll(0);
        else document.querySelector('.app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
      },
    }),
    [mode, band],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmbed() {
  return useContext(Ctx);
}

/** The slice of this document that is on screen. */
export function useVisibleBand(): VisibleBand {
  return useEmbed().band;
}
