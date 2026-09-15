// CDFI Fund loan-level lending detail (TLR FY22 + FY03-15, CLR FY22),
// Georgia-filtered — built by scripts/build-cdfi-lending.py from
// data/cdfi-lending-ga.xlsx. Unreported cells are null, never zero; interest
// rates cover only the ~third of transactions where lenders reported one.

export interface LendingBucket {
  group?: string;
  txns: number;
  amount: number;
  avg: number | null;
  med_rate: number | null;
  rate_n: number;
  med_term: number | null;
  term_n: number;
  fixed_share: number | null;
}

export interface YesNoUnknown { yes: number; no: number; unknown?: number }

export interface CdfiCounty {
  loans: number;
  amount: number;
  tlr22_txns: number;
  tlr22_amount: number;
  clr_loans: number;
  clr_amount: number;
  legacy_txns: number;
  legacy_amount: number;
  groups: Record<string, number>;
  tracts_with_lending: number;
  litp_amount: number;
  years: { year: number; loans: number; amount: number }[];
  med_rate: number | null;
  rate_n: number;
  med_term: number | null;
  term_n: number;
  fixed_share: number | null;
  profile: Record<'minority' | 'women' | 'low_income', YesNoUnknown> | null;
  investee: Record<string, number> | null;
  groups_txns: Record<string, number> | null;
}

export interface CdfiLending {
  generatedAt: string;
  source: string;
  purpose_labels: Record<string, string>;
  group_labels: Record<string, string>;
  state: {
    tlr22: {
      txns: number; amount: number; orgs: number;
      by_purpose: Record<string, LendingBucket>;
      by_group: Record<string, LendingBucket>;
      txn_type: Record<string, { txns: number; amount: number }>;
      investee: Record<string, { txns: number; amount: number }>;
      amortization: Record<string, number>;
      profile: Record<'minority' | 'women' | 'low_income', Required<YesNoUnknown>>;
      rates: { n: number; median: number | null; p25: number | null; p75: number | null };
      terms: { n: number; median: number | null };
      by_submission_year: Record<string, { txns: number; amount: number }>;
    };
    clr: {
      records: number; loans: number; amount: number; orgs: number;
      litp_amount: number; litp_loans: number; otp_amount: number;
      by_fiscal_year: Record<string, { records: number; loans: number; amount: number }>;
    };
    legacy: { txns: number; amount: number; orgs: number };
    combined_by_year: {
      year: number;
      legacy_amount: number | null;
      tlr22_amount: number | null;
      clr_amount: number | null;
      clr_loans: number | null;
      total: number;
    }[];
  };
  reconciliation: {
    year: number; cie_cdfi: number; fund_reported: number; fund_tlr: number; fund_clr: number;
  }[];
  counties: Record<string, CdfiCounty>;
}

export const CDFI_GROUP_COLORS: Record<string, string> = {
  BUSINESS_MICRO: '#4750a2',
  HOUSING: '#279a49',
  COMMERCIAL_RE: '#d4a72c',
  CONSUMER: '#53c3c2',
  OTHER: '#94a3b8',
};

export const CDFI_SOURCE_COLORS = {
  legacy: '#94a3b8',
  tlr22: '#4750a2',
  clr: '#53c3c2',
} as const;

let promise: Promise<CdfiLending> | null = null;

export function loadCdfiLending(): Promise<CdfiLending> {
  promise ??= fetch(`${import.meta.env.BASE_URL}data/cdfi-lending.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load CDFI lending data (${r.status})`);
    return r.json();
  });
  return promise;
}
