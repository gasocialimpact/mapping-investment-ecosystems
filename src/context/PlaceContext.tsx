import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { PlaceCountyData, PlaceTractData, PlaceCounty, PlaceMetric } from '../types/place';
import { loadCountyPlaceData, loadTractPlaceData } from '../data/loadData';
import { useData } from './DataContext';

type TractStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PlaceContextValue {
  place: PlaceCountyData | null;
  countyByFips: Map<string, PlaceCounty>;
  metric: PlaceMetric;
  setMetric: (m: PlaceMetric) => void;
  selectedFips: string | null;
  setSelectedFips: (f: string | null) => void;
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
  selectedFips: null,
  setSelectedFips: () => {},
  tracts: null,
  tractStatus: 'idle',
  ensureTracts: () => {},
  orgsByCountyFips: new Map(),
});

export function PlaceProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [place, setPlace] = useState<PlaceCountyData | null>(null);
  const [metric, setMetric] = useState<PlaceMetric>('cvi');
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [tracts, setTracts] = useState<PlaceTractData | null>(null);
  const [tractStatus, setTractStatus] = useState<TractStatus>('idle');
  const tractFetchStarted = useRef(false);

  useEffect(() => {
    // Place data is optional: if the file is missing the map simply has no
    // choropleth, so failures are logged rather than surfaced as app errors.
    loadCountyPlaceData()
      .then(setPlace)
      .catch((e) => console.warn('Place data unavailable:', e.message));
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
        selectedFips, setSelectedFips,
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
