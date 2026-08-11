import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PlaceCountyData, PlaceTractData, PlaceCounty, PlaceMetric } from '../types/place';
import { loadCountyPlaceData, loadTractPlaceData } from '../data/loadData';
import { useData } from './DataContext';

type TractStatus = 'idle' | 'loading' | 'ready' | 'error';
export type PlaceScope = 'county' | 'tract';

interface PlaceContextValue {
  place: PlaceCountyData | null;
  countyByFips: Map<string, PlaceCounty>;
  metric: PlaceMetric;
  setMetric: (m: PlaceMetric) => void;
  scope: PlaceScope;
  setScope: (s: PlaceScope) => void;
  selectedFips: string | null;
  setSelectedFips: (f: string | null) => void;
  // Selected census tract (11-digit GEOID), used in tract scope.
  selectedGeoid: string | null;
  setSelectedGeoid: (g: string | null) => void;
  tracts: PlaceTractData | null;
  tractStatus: TractStatus;
  ensureTracts: () => void;
  orgsByCountyFips: Map<string, string[]>;
}

const Ctx = createContext<PlaceContextValue>({
  place: null,
  countyByFips: new Map(),
  metric: 'cvi',
  setMetric: () => {},
  scope: 'county',
  setScope: () => {},
  selectedFips: null,
  setSelectedFips: () => {},
  selectedGeoid: null,
  setSelectedGeoid: () => {},
  tracts: null,
  tractStatus: 'idle',
  ensureTracts: () => {},
  orgsByCountyFips: new Map(),
});

export function PlaceProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [place, setPlace] = useState<PlaceCountyData | null>(null);
  const [metric, setMetric] = useState<PlaceMetric>('cvi');
  const [scope, setScope] = useState<PlaceScope>('county');
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [selectedGeoid, setSelectedGeoid] = useState<string | null>(null);
  const [tracts, setTracts] = useState<PlaceTractData | null>(null);
  const [tractStatus, setTractStatus] = useState<TractStatus>('idle');
  const tractFetchStarted = useRef(false);

  useEffect(() => {
    // Retry the place-data fetch a few times with backoff: a transient network
    // hiccup here used to leave the map blank until a manual page refresh.
    let cancelled = false;
    const attempt = (n: number) => {
      loadCountyPlaceData()
        .then((d) => { if (!cancelled) setPlace(d); })
        .catch((e) => {
          if (cancelled) return;
          if (n < 3) setTimeout(() => attempt(n + 1), 1200 * (n + 1));
          else console.warn('Place data unavailable after retries:', e.message);
        });
    };
    attempt(0);
    return () => { cancelled = true; };
  }, []);

  const ensureTracts = useCallback(() => {
    if (tractFetchStarted.current) return;
    tractFetchStarted.current = true;
    setTractStatus('loading');
    loadTractPlaceData()
      .then((d) => {
        setTracts(d);
        setTractStatus('ready');
      })
      .catch((e) => {
        console.warn('Tract data unavailable:', e.message);
        setTractStatus('error');
        tractFetchStarted.current = false;
      });
  }, []);

  const countyByFips = useMemo(
    () => new Map((place?.counties ?? []).map((c) => [c.fips, c])),
    [place],
  );

  // Locations carry a 5-digit county FIPS; grouping their organizationIds by
  // it gives the county→orgs join used by map tooltips, the county panel,
  // and the gap analysis.
  const orgsByCountyFips = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const loc of data?.locations ?? []) {
      if (!loc.fipsCode || loc.organizationIds.length === 0) continue;
      const existing = map.get(loc.fipsCode);
      if (existing) {
        for (const id of loc.organizationIds) {
          if (!existing.includes(id)) existing.push(id);
        }
      } else {
        map.set(loc.fipsCode, [...loc.organizationIds]);
      }
    }
    return map;
  }, [data]);

  return (
    <Ctx.Provider
      value={{
        place, countyByFips, metric, setMetric,
        scope, setScope,
        selectedFips, setSelectedFips,
        selectedGeoid, setSelectedGeoid,
        tracts, tractStatus, ensureTracts, orgsByCountyFips,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlace() {
  return useContext(Ctx);
}
