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

/** Latest Form 990 / 990-EZ filing, Part I summary plus Part X balance sheet (full 990 only). Dollar amounts. */
export interface IrsFiling {
  taxYear: number;
  form: '990' | '990EZ' | string;
  periodEnd: string | null;
  revenue: number | null;
  contributions: number | null;
  programRevenue: number | null;
  investmentIncome: number | null;
  expenses: number | null;
  grantsPaid: number | null;
  salaries: number | null;
  netIncome: number | null;
  assetsEOY: number | null;
  liabilitiesEOY: number | null;
  netAssetsEOY: number | null;
  employees: number | null;
  volunteers: number | null;
  cashAndSavingsEOY: number | null;
  pledgesReceivableEOY: number | null;
  notesLoansReceivableEOY: number | null;
  landBuildingsNetEOY: number | null;
  investPublicSecuritiesEOY: number | null;
  investOtherSecuritiesEOY: number | null;
  investProgramRelatedEOY: number | null;
  grantsPayableEOY: number | null;
  taxExemptBondsEOY: number | null;
  mortgagesNotesPayableEOY: number | null;
  unsecuredNotesPayableEOY: number | null;
  netAssetsUnrestrictedEOY: number | null;
  netAssetsTempRestrictedEOY: number | null;
  netAssetsPermRestrictedEOY: number | null;
}

export interface IrsTrendPoint {
  taxYear: number;
  revenue: number | null;
  expenses: number | null;
  assetsEOY: number | null;
  netAssetsEOY: number | null;
}

/** IRS profile joined by EIN: Business Master File codes plus 990 financials where the org e-files a 990/990-EZ. */
export interface OrgIrs {
  ein: string;
  /** false when the EIN is set in Airtable but not present in either IRS extract. */
  found: boolean;
  legalName?: string | null;
  subsection?: string | null;
  ntee?: string | null;
  nteeMajor?: string | null;
  foundation?: string | null;
  rulingYear?: number | null;
  yearFormation?: number | null;
  mission?: string | null;
  /** Business Master File amounts: the most recent the IRS has on file, also covers 990-PF filers. */
  bmf?: { assets: number | null; income: number | null; revenue: number | null; taxPeriod: string | null } | null;
  latest?: IrsFiling | null;
  trend?: IrsTrendPoint[];
}

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
  ein: string | null;
  einMatch: string | null;
  irs: OrgIrs | null;
  locationId: string | null;
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

export type Tab = 'explore' | 'capital' | 'framing' | 'glossary';

export interface EcosystemData {
  generatedAt: string;
  source: string;
  organizations: Organization[];
  capitalFlows: CapitalFlow[];
  capitalInstruments: CapitalInstrument[];
  locations: Location[];
  impactDimensions: ImpactDimension[];
}
