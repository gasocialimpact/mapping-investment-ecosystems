import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Segment } from '../types';
import { useData } from './DataContext';

interface FilterState {
  search: string;
  segments: Set<Segment>;
  locationIds: Set<string>;
  impactDimensionIds: Set<string>;
  instrumentIds: Set<string>;
}

interface FilterContextValue extends FilterState {
  setSearch: (v: string) => void;
  toggleSegment: (s: Segment) => void;
  toggleLocation: (id: string) => void;
  toggleImpactDimension: (id: string) => void;
  toggleInstrument: (id: string) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
  filteredOrgIds: Set<string>;
  filteredFlowIds: Set<string>;
}

const Ctx = createContext<FilterContextValue>(null!);

function toggle<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  next.has(item) ? next.delete(item) : next.add(item);
  return next;
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [search, setSearch] = useState('');
  const [segments, setSegments] = useState<Set<Segment>>(new Set());
  const [locationIds, setLocationIds] = useState<Set<string>>(new Set());
  const [impactDimensionIds, setImpactDimensionIds] = useState<Set<string>>(new Set());
  const [instrumentIds, setInstrumentIds] = useState<Set<string>>(new Set());

  const clearAll = useCallback(() => {
    setSearch('');
    setSegments(new Set());
    setLocationIds(new Set());
    setImpactDimensionIds(new Set());
    setInstrumentIds(new Set());
  }, []);

  const hasActiveFilters =
    search.trim() !== '' ||
    segments.size > 0 ||
    locationIds.size > 0 ||
    impactDimensionIds.size > 0 ||
    instrumentIds.size > 0;

  const filteredOrgIds = useMemo(() => {
    if (!data) return new Set<string>();
    const q = search.toLowerCase().trim();

    const flowOrgIds = new Set<string>();
    if (instrumentIds.size > 0) {
      data.capitalFlows.forEach((f) => {
        if (f.capitalInstrumentIds.some((id) => instrumentIds.has(id))) {
          if (f.sourceId) flowOrgIds.add(f.sourceId);
          if (f.recipientId) flowOrgIds.add(f.recipientId);
        }
      });
    }

    const ids = new Set<string>();
    for (const o of data.organizations) {
      if (q && !o.name.toLowerCase().includes(q) && !(o.city ?? '').toLowerCase().includes(q) && !(o.description ?? '').toLowerCase().includes(q)) continue;
      if (segments.size > 0 && !segments.has(o.segment)) continue;
      if (locationIds.size > 0 && (!o.locationId || !locationIds.has(o.locationId))) continue;
      if (impactDimensionIds.size > 0) {
        const orgDims = [...o.sdgIds, ...o.sectorIds, ...o.populationIds, ...o.ownershipIds];
        if (!orgDims.some((id) => impactDimensionIds.has(id))) continue;
      }
      if (instrumentIds.size > 0 && !flowOrgIds.has(o.id)) continue;
      ids.add(o.id);
    }
    return ids;
  }, [data, search, segments, locationIds, impactDimensionIds, instrumentIds]);

  const filteredFlowIds = useMemo(() => {
    if (!data) return new Set<string>();
    const ids = new Set<string>();
    for (const f of data.capitalFlows) {
      const srcMatch = !f.sourceId || filteredOrgIds.has(f.sourceId);
      const recMatch = !f.recipientId || filteredOrgIds.has(f.recipientId);
      if (srcMatch || recMatch) {
        if (instrumentIds.size > 0 && !f.capitalInstrumentIds.some((id) => instrumentIds.has(id))) continue;
        ids.add(f.id);
      }
    }
    return ids;
  }, [data, filteredOrgIds, instrumentIds]);

  return (
    <Ctx.Provider
      value={{
        search, segments, locationIds, impactDimensionIds, instrumentIds,
        setSearch,
        toggleSegment: (s) => setSegments((prev) => toggle(prev, s)),
        toggleLocation: (id) => setLocationIds((prev) => toggle(prev, id)),
        toggleImpactDimension: (id) => setImpactDimensionIds((prev) => toggle(prev, id)),
        toggleInstrument: (id) => setInstrumentIds((prev) => toggle(prev, id)),
        clearAll,
        hasActiveFilters,
        filteredOrgIds,
        filteredFlowIds,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFilters() {
  return useContext(Ctx);
}
