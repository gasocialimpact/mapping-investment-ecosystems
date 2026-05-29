export type Segment =
  | 'Capital Aggregator'
  | 'Capital Allocator'
  | 'Capital Enabler'
  | 'Capital Seeker'
  | 'Uncategorized';

export const SEGMENT_ORDER: Segment[] = [
  'Capital Aggregator',
  'Capital Allocator',
  'Capital Enabler',
  'Capital Seeker',
  'Uncategorized',
];

export interface SegmentStyle {
  color: string;
  light: string;
  soft: string;
}

export const SEGMENT_STYLES: Record<Segment, SegmentStyle> = {
  'Capital Aggregator': { color: '#4750a2', light: '#929adf', soft: '#bdc7ec' },
  'Capital Allocator':  { color: '#279a49', light: '#66b445', soft: '#e0f1d9' },
  'Capital Enabler':    { color: '#53c3c2', light: '#369b99', soft: '#d4f1f0' },
  'Capital Seeker':     { color: '#f15921', light: '#f15921', soft: '#f8dcd3' },
  'Uncategorized':      { color: '#939699', light: '#939699', soft: '#eeeeee' },
};

export interface Organization {
  id: string;
  name: string;
  segment: Segment;
  orgType: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  description: string | null;
  locationId: string | null;
  contactIds: string[];
  capitalFlowIds: string[];
  capitalAllocationIds: string[];
  sdgIds: string[];
  sectorIds: string[];
  populationIds: string[];
  ownershipIds: string[];
}

export interface CapitalFlow {
  id: string;
  label: string;
  sourceId: string | null;
  sourceName: string | null;
  recipientId: string | null;
  recipientName: string | null;
  amount: number | null;
  year: number | null;
  type: string | null;
  description: string | null;
  capitalInstrumentIds: string[];
  impactDimensionIds: string[];
}

export interface CapitalInstrument {
  id: string;
  name: string;
  capitalFlowType: string | null;
  investmentStrategy: string | null;
  description: string | null;
  capitalFlowIds: string[];
}

export interface Location {
  id: string;
  cityName: string;
  stateName: string | null;
  stateId: string | null;
  countyName: string | null;
  countryName: string | null;
  lat: number | null;
  lng: number | null;
  fipsCode: string | null;
  cviToxPi: number | null;
  cviBaselineHealth: number | null;
  cviBaselineSocialEconomic: number | null;
  cviBaselineInfrastructure: number | null;
  cviBaselineEnvironment: number | null;
  cviCCHealth: number | null;
  cviCCSocialEconomic: number | null;
  cviCCExtremeEvents: number | null;
  cviNationalPercentile: number | null;
  organizationIds: string[];
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  organizationIds: string[];
  isKeyContact: boolean;
}

export type ImpactDimensionType =
  | 'SDG Alignment'
  | 'Population Focus'
  | 'Sector Focus'
  | 'Alternative Ownership Component'
  | 'IMM Classification';

export interface ImpactDimension {
  id: string;
  type: ImpactDimensionType;
  label: string;
  notes: string | null;
  iconUrl: string | null;
}

export type Tab = 'overview' | 'organizations' | 'flows' | 'instruments' | 'locations' | 'framework';

export interface EcosystemData {
  generatedAt: string;
  source: string;
  organizations: Organization[];
  capitalFlows: CapitalFlow[];
  capitalInstruments: CapitalInstrument[];
  locations: Location[];
  contacts: Contact[];
  impactDimensions: ImpactDimension[];
}
