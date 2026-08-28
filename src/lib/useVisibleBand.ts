import { useEffect, useState } from 'react';

export interface VisibleBand {
  /** Top of the on-screen slice, in this document's client coordinates. */
  top: number;
  /** Height of the on-screen slice, in px. */
  height: number;
  /** This frame's own viewport height, in px. */
  frameHeight: number;
  /** True while part of this frame is scrolled out of the browser window. */
  clipped: boolean;
}

// The frame is tiled with this many probes. A single full-height probe is not
// enough: once the frame covers the whole window its visible *ratio* stops
// changing, and the observer — which only fires on ratio changes — goes quiet
// while the visible slice keeps moving. With tiles, whichever tile a band edge
// falls inside is always partially covered, so scrolling always reports.
const PROBES = 24;
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

function fullBand(): VisibleBand {
  return { top: 0, height: window.innerHeight, frameHeight: window.innerHeight, clipped: false };
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access threw — we are definitely in a frame
  }
}

/**
 * The slice of this document that is actually on screen.
 *
 * Standalone, that is simply the viewport. Embedded in an iframe taller than
 * the browser window it is the part of the frame the reader can see, which is
 * what the layout and the record modal need to follow. An IntersectionObserver
 * with a null root measures against the *top-level* viewport, so this works
 * even when the host page is on another origin and its scroll position is
 * unreadable from here.
 */
export function useVisibleBand(): VisibleBand {
  const [band, setBand] = useState<VisibleBand>(fullBand);

  useEffect(() => {
    if (!isEmbedded() || typeof IntersectionObserver === 'undefined') {
      const onResize = () => setBand(fullBand());
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    // Percentages on a fixed element resolve against the viewport, so the
    // tiles track the frame through any resize.
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

    // Each tile reports the part of itself that is on screen, in this
    // document's coordinates; their union is the visible band.
    const seen = new Map<Element, { top: number; bottom: number }>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const rect = entry.intersectionRect;
          if (rect.height > 0) seen.set(entry.target, { top: rect.top, bottom: rect.bottom });
          else seen.delete(entry.target);
        }
        if (seen.size === 0) return; // scrolled fully past — keep the last reading

        let top = Infinity;
        let bottom = -Infinity;
        for (const r of seen.values()) {
          if (r.top < top) top = r.top;
          if (r.bottom > bottom) bottom = r.bottom;
        }

        const frameHeight = window.innerHeight;
        const next: VisibleBand = {
          top,
          height: bottom - top,
          frameHeight,
          clipped: bottom - top < frameHeight - 1,
        };
        setBand((prev) =>
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.height - next.height) < 1 &&
          Math.abs(prev.frameHeight - next.frameHeight) < 1
            ? prev
            : next,
        );
      },
      { threshold: THRESHOLDS },
    );
    probes.forEach((p) => observer.observe(p));

    // Thresholds fire on ratio changes; resizing the frame resizes the tiles
    // with it, so re-observe to force a fresh reading.
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
  }, []);

  return band;
}
