// Data model for the layered investment-ecosystem base.
// Mirrors the Airtable structure in the uploaded `index.tsx` fodder:
// Organizations grouped by Segment, the Capital Flows between them, and the
// Capital Instruments those flows use. The export script (scripts/export-airtable.mjs)
// produces this exact shape from Airtable so the UI is source-agnostic.

export type Segment =
  | 'Capital Aggregator'
  | 'Capital Allocator'
  | 'Capital Enabler'
  | 'Capital Seeker'
  | 'Uncategorized';

export interface Organization {
  id: string;
  name: string;
  segment: Segment;
  city: string | null;
  state: string | null;
  /** Latitude in decimal degrees. Records without coordinates are skipped on the map. */
  lat: number | null;
  /** Longitude in decimal degrees. */
  lng: number | null;
  website: string | null;
  description: string | null;
}

export interface CapitalFlow {
  id: string;
  /** Display label for the flow (e.g. "Flow #1"). */
  label: string;
  /** Organization id of the capital source, when resolvable. */
  sourceId: string | null;
  sourceName: string | null;
  /** Organization id of the recipient, when resolvable. */
  recipientId: string | null;
  recipientName: string | null;
  amount: number | null;
  year: number | null;
  /** Free-text capital flow type / instrument definition. */
  type: string | null;
  description: string | null;
}

export interface CapitalInstrument {
  id: string;
  name: string;
  capitalFlowType: string | null;
  investmentStrategy: string | null;
  segment: Segment | null;
  description: string | null;
}

export interface EcosystemData {
  /** ISO timestamp of when this snapshot was generated. */
  generatedAt: string;
  /** Human label for the data source (base name, or "sample"). */
  source: string;
  organizations: Organization[];
  capitalFlows: CapitalFlow[];
  capitalInstruments: CapitalInstrument[];
}

export const SEGMENT_ORDER: Segment[] = [
  'Capital Aggregator',
  'Capital Allocator',
  'Capital Enabler',
  'Capital Seeker',
  'Uncategorized',
];

export interface SegmentStyle {
  /** Hex color used for map markers and accents. */
  color: string;
  /** Tailwind classes for the segment chip/header. */
  chip: string;
  /** Tailwind classes for a soft accent background. */
  soft: string;
}

export const SEGMENT_STYLES: Record<Segment, SegmentStyle> = {
  'Capital Aggregator': {
    color: '#2563eb',
    chip: 'bg-blue-100 text-blue-800 border-blue-200',
    soft: 'bg-blue-50',
  },
  'Capital Allocator': {
    color: '#16a34a',
    chip: 'bg-green-100 text-green-800 border-green-200',
    soft: 'bg-green-50',
  },
  'Capital Enabler': {
    color: '#9333ea',
    chip: 'bg-purple-100 text-purple-800 border-purple-200',
    soft: 'bg-purple-50',
  },
  'Capital Seeker': {
    color: '#ea580c',
    chip: 'bg-orange-100 text-orange-800 border-orange-200',
    soft: 'bg-orange-50',
  },
  Uncategorized: {
    color: '#64748b',
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    soft: 'bg-slate-50',
  },
};
