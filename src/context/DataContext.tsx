import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import type {
  EcosystemData, Organization, CapitalFlow, CapitalInstrument,
  Location, ImpactDimension,
} from '../types';
import { loadEcosystemData } from '../data/loadData';

interface LookupMaps {
  orgById: Map<string, Organization>;
  flowById: Map<string, CapitalFlow>;
  instrumentById: Map<string, CapitalInstrument>;
  locationById: Map<string, Location>;
  impactDimensionById: Map<string, ImpactDimension>;
}

interface DataContextValue {
  data: EcosystemData | null;
  error: string | null;
  maps: LookupMaps;
}

const empty: LookupMaps = {
  orgById: new Map(),
  flowById: new Map(),
  instrumentById: new Map(),
  locationById: new Map(),
  impactDimensionById: new Map(),
};

const Ctx = createContext<DataContextValue>({ data: null, error: null, maps: empty });

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEcosystemData().then(setData).catch((e) => setError(e.message));
  }, []);

  const maps = useMemo<LookupMaps>(() => {
    if (!data) return empty;
    const orgById = new Map(data.organizations.map((o) => [o.id, o]));
    const flowById = new Map(data.capitalFlows.map((f) => [f.id, f]));
    const instrumentById = new Map(data.capitalInstruments.map((i) => [i.id, i]));
    const locationById = new Map(data.locations.map((l) => [l.id, l]));
    const impactDimensionById = new Map(data.impactDimensions.map((d) => [d.id, d]));
    return { orgById, flowById, instrumentById, locationById, impactDimensionById };
  }, [data]);

  return <Ctx.Provider value={{ data, error, maps }}>{children}</Ctx.Provider>;
}

export function useData() {
  return useContext(Ctx);
}
