import { useEffect, useState } from 'react';
import { loadCdfiLending, CDFI_GROUP_COLORS, CDFI_SOURCE_COLORS } from '../../data/cdfiLending';
import type { CdfiLending, LendingBucket } from '../../data/cdfiLending';
import { fmtDollars } from '../../data/capital';
import { StackedBarChart, LineChart, niceTicks } from './charts';
import type { StackSeries, LineSeries } from './charts';
import { SnapshotCard } from '../SnapshotButton';
import { DataTable, pct, NO_DATA } from './DataTable';
import type { TableRow } from './DataTable';

// CDFI Fund loan-level detail (TLR + CLR), rendered inside the Capital tab's
// statewide and county views. Where the Fed CIE tables above answer "how much
// moved", this answers what the loans were — product, term, pricing, and who
// borrowed — from the same underlying CDFI Fund reporting.

function Card({ title, sub, children, note, span = 'half' }: {
  title: string; sub?: string; note?: string; span?: 'half' | 'full';
  children: React.ReactNode;
}) {
  return (
    // The wrapper is the grid item, so the card inside needs h-full for
    // side-by-side pairs to mirror heights.
    <div className={`[&>div]:h-full ${span === 'full' ? 'xl:col-span-6 pdf:col-span-6' : 'xl:col-span-3 pdf:col-span-3'}`}>
      <SnapshotCard title={title} sub={sub && <span className="block max-w-3xl">{sub}</span>} note={note}>
        <div className="mt-3">{children}</div>
      </SnapshotCard>
    </div>
  );
}

function useCdfi(): { data: CdfiLending | null; error: string | null } {
  const [data, setData] = useState<CdfiLending | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadCdfiLending().then(setData).catch((e) => setError(e.message)); }, []);
  return { data, error };
}

const rateCell = (rate: number | null, n: number) =>
  rate == null ? NO_DATA : (
    <span title={`Median across the ${n.toLocaleString()} transactions with a reported rate`}>
      {rate}%<span className="text-slate-400 font-normal"> (n={n.toLocaleString()})</span>
    </span>
  );

const termCell = (months: number | null, n: number) =>
  months == null ? NO_DATA : (
    <span title={`Median across the ${n.toLocaleString()} transactions with a reported term`}>
      {months >= 24 ? `${Math.round(months / 12)} yrs` : `${months} mo`}
      <span className="text-slate-400 font-normal"> (n={n.toLocaleString()})</span>
    </span>
  );

/** Share of yes among loans answering yes or no, with how many answered. */
function profileShare(p: { yes: number; no: number }) {
  const reported = p.yes + p.no;
  return reported ? { share: p.yes / reported, reported } : null;
}

const RATE_NOTE = 'Rates and terms are medians over the transactions whose lender reported one — about a third of TLR transactions carry a rate (the Fund’s 99 placeholder is treated as not reported), so they describe the reporting lenders, not the whole portfolio.';

// --- Statewide ---------------------------------------------------------------

export function CdfiStatewideSection() {
  const { data, error } = useCdfi();
  if (error) return <p className="xl:col-span-6 pdf:col-span-6 text-sm text-red-500">{error}</p>;
  if (!data) return null;

  const s = data.state;
  const years = s.combined_by_year.map((r) => r.year).filter((y) => y >= 2003);
  const yearRows = s.combined_by_year.filter((r) => r.year >= 2003);
  const sourceSeries: StackSeries[] = [
    { key: 'TLR transactions 2003–15', color: CDFI_SOURCE_COLORS.legacy,
      values: new Map(yearRows.map((r) => [r.year, r.legacy_amount ?? 0])) },
    { key: 'TLR transactions FY18–22', color: CDFI_SOURCE_COLORS.tlr22,
      values: new Map(yearRows.map((r) => [r.year, r.tlr22_amount ?? 0])) },
    { key: 'Consumer loans (CLR) FY18–22', color: CDFI_SOURCE_COLORS.clr,
      values: new Map(yearRows.map((r) => [r.year, r.clr_amount ?? 0])) },
  ];

  const groups = Object.entries(s.tlr22.by_group);
  const purposes = Object.entries(s.tlr22.by_purpose);
  const totalAmt = s.tlr22.amount;

  const minority = profileShare(s.tlr22.profile.minority);
  const women = profileShare(s.tlr22.profile.women);
  const lowIncome = profileShare(s.tlr22.profile.low_income);
  const fixedTotal = Object.entries(s.tlr22.txn_type);

  return (
    <>
      <div className="xl:col-span-6 pdf:col-span-6 flex items-baseline gap-3 flex-wrap mt-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">CDFI lending in detail</h2>
        <span className="text-xs text-slate-400">
          Loan-level CDFI Fund reporting (TLR & CLR) behind the CDFI line above — {fmtDollars(s.legacy.amount + s.tlr22.amount + s.clr.amount)} across {(s.tlr22.txns + s.legacy.txns).toLocaleString()} reported transactions and {s.clr.loans.toLocaleString()} consumer loans
        </span>
      </div>

      <Card
        span="full"
        title="CDFI Fund lending by year"
        sub={`Three public releases stacked: the FY2003–15 transaction archive (by close year), the FY22 transaction release (by submission year, ${s.tlr22.orgs} organizations), and the FY22 consumer-lending release (by fiscal year, aggregated rows covering ${s.clr.loans.toLocaleString()} small consumer loans).`}
        note="Year bases differ by release — the FY22 transaction file is dated by when the lender submitted, not when the loan closed — so read each series' shape, not single-year totals, and see the reconciliation card for how this lines up with the Fed CIE figures."
      >
        <StackedBarChart years={years} series={sourceSeries} />
        <DataTable
          rowHeader="Source"
          columns={['Records', 'Dollars', 'First–last year']}
          rows={[
            { label: 'TLR transactions 2003–15', color: CDFI_SOURCE_COLORS.legacy,
              cells: [s.legacy.txns.toLocaleString(), fmtDollars(s.legacy.amount), '2003–2015'] },
            { label: 'TLR transactions FY18–22', color: CDFI_SOURCE_COLORS.tlr22,
              cells: [s.tlr22.txns.toLocaleString(), fmtDollars(s.tlr22.amount), '2017–2022'] },
            { label: 'Consumer loans (CLR) FY18–22', color: CDFI_SOURCE_COLORS.clr,
              cells: [`${s.clr.loans.toLocaleString()} loans`, fmtDollars(s.clr.amount), '2018–2022'] },
            { label: 'Total', strong: true,
              cells: ['', fmtDollars(s.legacy.amount + s.tlr22.amount + s.clr.amount), ''] },
          ]}
        />
      </Card>

      <Card
        span="full"
        title="What the loans are for"
        sub={`Every purpose the FY18–22 transaction file reports, with pricing and tenure where lenders reported them. Business & microenterprise carries ${pct(s.tlr22.by_group.BUSINESS_MICRO ? s.tlr22.by_group.BUSINESS_MICRO.amount / totalAmt : 0)} of the dollars and ${pct(s.tlr22.by_group.BUSINESS_MICRO ? s.tlr22.by_group.BUSINESS_MICRO.txns / s.tlr22.txns : 0)} of the transactions.`}
        note={RATE_NOTE}
      >
        <DataTable
          rowHeader="Loan purpose"
          columns={['Loans', 'Dollars', '% of $', 'Avg size', 'Median rate', 'Median term']}
          rows={[
            ...purposes.map(([code, b]): TableRow => ({
              label: data.purpose_labels[code] ?? code,
              color: CDFI_GROUP_COLORS[b.group ?? 'OTHER'],
              cells: purposeCells(b, totalAmt),
            })),
            { label: 'All purposes', strong: true,
              cells: [s.tlr22.txns.toLocaleString(), fmtDollars(totalAmt), '100%',
                fmtDollars(totalAmt / s.tlr22.txns),
                rateCell(s.tlr22.rates.median, s.tlr22.rates.n),
                termCell(s.tlr22.terms.median, s.tlr22.terms.n)] },
          ]}
          note="Row color marks the product family: indigo business & microenterprise, green housing, gold commercial real estate, teal consumer, gray other."
        />
      </Card>

      <Card
        title="Pricing, tenure and structure"
        sub="By product family, FY18–22 transactions. The interquartile rate range across all reporting transactions runs from"
        note={RATE_NOTE}
      >
        <p className="text-sm text-slate-600 -mt-2 mb-2">
          <b>{s.tlr22.rates.p25}%</b> to <b>{s.tlr22.rates.p75}%</b> (median {s.tlr22.rates.median}%),
          and {pct(fixedShareOverall(s.tlr22.amortization, s.tlr22.txns))} of transactions fully amortize.
        </p>
        <DataTable
          rowHeader="Product family"
          columns={['Median rate', 'Fixed-rate', 'Median term']}
          rows={groups.map(([code, b]): TableRow => ({
            label: data.group_labels[code] ?? code,
            color: CDFI_GROUP_COLORS[code],
            cells: [
              rateCell(b.med_rate, b.rate_n),
              b.fixed_share == null ? NO_DATA : pct(b.fixed_share),
              termCell(b.med_term, b.term_n),
            ],
          }))}
        />
        <DataTable
          rowHeader="Transaction type"
          columns={['Loans', 'Dollars']}
          rows={fixedTotal.map(([code, v]): TableRow => ({
            label: TXN_TYPE_LABELS[code] ?? code,
            cells: [v.txns.toLocaleString(), fmtDollars(v.amount)],
          }))}
        />
      </Card>

      <Card
        title="Who borrows"
        sub="Borrower characteristics as lenders reported them, FY18–22 transactions. Shares are of loans where the lender answered yes or no — the caption under each shows how many did."
      >
        <div className="space-y-3">
          {[
            ['Minority-owned or -controlled', minority],
            ['Women-owned or -controlled', women],
            ['Low-income-owned or -controlled', lowIncome],
          ].map(([label, p]) => (p == null ? null : (
            <div key={label as string}>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-slate-600">{label as string}</span>
                <b className="tabular-nums">{pct((p as { share: number }).share)}</b>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-indigo" style={{ width: `${(p as { share: number }).share * 100}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {(p as { reported: number }).reported.toLocaleString()} of {s.tlr22.txns.toLocaleString()} transactions answered ({pct((p as { reported: number }).reported / s.tlr22.txns)})
              </p>
            </div>
          )))}
        </div>
        <DataTable
          rowHeader="Borrower type"
          columns={['Loans', 'Dollars']}
          rows={Object.entries(s.tlr22.investee).map(([code, v]): TableRow => ({
            label: INVESTEE_LABELS[code] ?? code,
            cells: [v.txns.toLocaleString(), fmtDollars(v.amount)],
          }))}
        />
        <p className="text-[11px] text-slate-500 mt-3">
          In the consumer-lending file, {pct(s.clr.litp_amount / s.clr.amount)} of dollars
          ({fmtDollars(s.clr.litp_amount)}) went to low-income targeted populations —
          {' '}{s.clr.litp_loans.toLocaleString()} of {s.clr.loans.toLocaleString()} loans.
        </p>
      </Card>

    </>
  );
}

// --- County ------------------------------------------------------------------

export function CdfiCountySection({ fips, name }: { fips: string; name: string }) {
  const { data, error } = useCdfi();
  if (error) return <p className="xl:col-span-6 pdf:col-span-6 text-sm text-red-500">{error}</p>;
  if (!data) return null;
  const county = data.counties[fips];
  const label = name.replace(/ County$/, '');
  if (!county || county.amount <= 0) {
    return (
      <p className="xl:col-span-6 pdf:col-span-6 text-sm text-slate-400">
        No CDFI Fund loan-level lending reported in {label} County across the three releases.
      </p>
    );
  }

  const stateTotal = data.state.legacy.amount + data.state.tlr22.amount + data.state.clr.amount;
  const years = county.years.filter((r) => r.year >= 2003);
  const trend: LineSeries[] = [{
    key: 'CDFI Fund lending',
    color: '#4750a2',
    points: years.map((r) => ({
      year: r.year, value: r.amount,
      label: `${fmtDollars(r.amount)} · ${r.loans.toLocaleString()} loans`,
    })),
  }];
  const maxTrend = Math.max(...years.map((r) => r.amount), 1);
  const groupRows = Object.entries(county.groups).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const minority = county.profile ? profileShare(county.profile.minority) : null;
  const women = county.profile ? profileShare(county.profile.women) : null;

  return (
    <>
      <div className="xl:col-span-6 pdf:col-span-6 flex items-baseline gap-3 flex-wrap mt-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">CDFI lending in detail</h2>
        <span className="text-xs text-slate-400">
          {fmtDollars(county.amount)} across {county.loans.toLocaleString()} loans in {label} County — {pct(county.amount / stateTotal)} of the statewide total, reaching {county.tracts_with_lending} census tract{county.tracts_with_lending === 1 ? '' : 's'}
        </span>
      </div>

      <Card
        title={`CDFI Fund lending in ${label} County by year`}
        sub="All three releases combined, by each release's reporting year. Hover a point for the loan count."
      >
        {years.length > 0
          ? <LineChart years={years.map((r) => r.year)} series={trend} ticks={niceTicks(maxTrend)} format={fmtDollars} />
          : <p className="text-sm text-slate-400">No year-level detail reported.</p>}
        <DataTable
          rowHeader="Source"
          columns={['Loans', 'Dollars']}
          rows={[
            { label: 'TLR transactions FY18–22', color: CDFI_SOURCE_COLORS.tlr22,
              cells: [county.tlr22_txns.toLocaleString(), fmtDollars(county.tlr22_amount)] },
            { label: 'Consumer loans (CLR) FY18–22', color: CDFI_SOURCE_COLORS.clr,
              cells: [county.clr_loans.toLocaleString(), fmtDollars(county.clr_amount)] },
            { label: 'TLR transactions 2003–15', color: CDFI_SOURCE_COLORS.legacy,
              cells: [county.legacy_txns.toLocaleString(), fmtDollars(county.legacy_amount)] },
          ]}
          note={county.litp_amount > 0 ? `${fmtDollars(county.litp_amount)} of the consumer lending went to low-income targeted populations.` : undefined}
        />
      </Card>

      <Card
        title="Products, pricing and borrowers"
        sub={`What the ${label} County lending was for, and the loan characteristics lenders reported.`}
        note={RATE_NOTE}
      >
        <DataTable
          rowHeader="Product family"
          columns={['Dollars', '% of county $']}
          rows={groupRows.map(([code, amt]): TableRow => ({
            label: data.group_labels[code] ?? code,
            color: CDFI_GROUP_COLORS[code],
            cells: [fmtDollars(amt), pct(amt / county.amount)],
          }))}
        />
        <div className="mt-3 space-y-1.5 text-[13px] text-slate-600">
          {county.med_rate != null && (
            <p>Median interest rate <b>{county.med_rate}%</b> across {county.rate_n.toLocaleString()} reporting transactions{county.fixed_share != null && <> · {pct(county.fixed_share)} fixed-rate</>}.</p>
          )}
          {county.med_term != null && (
            <p>Median term <b>{county.med_term >= 24 ? `${Math.round(county.med_term / 12)} years` : `${county.med_term} months`}</b> across {county.term_n.toLocaleString()} reporting transactions.</p>
          )}
          {minority && minority.reported >= 30 && (
            <p><b>{pct(minority.share)}</b> of transaction borrowers minority-owned ({minority.reported.toLocaleString()} answered).</p>
          )}
          {women && women.reported >= 30 && (
            <p><b>{pct(women.share)}</b> women-owned ({women.reported.toLocaleString()} answered).</p>
          )}
          {(!minority || minority.reported < 30) && (!women || women.reported < 30) && (
            <p className="text-slate-400">Too few transactions answered the ownership questions here to report shares.</p>
          )}
        </div>
      </Card>
    </>
  );
}

// --- Small helpers -----------------------------------------------------------

const TXN_TYPE_LABELS: Record<string, string> = {
  TERM: 'Term loan', LOC: 'Line of credit', EQTYINV: 'Equity investment',
  LNGUARANTEE: 'Loan guarantee', DEBTEQTY: 'Debt with equity', OTHER: 'Other',
};
const INVESTEE_LABELS: Record<string, string> = {
  BUS: 'Businesses', IND: 'Individuals', CDFI: 'Other CDFIs', OTHER: 'Other',
};

function purposeCells(b: LendingBucket, totalAmt: number) {
  return [
    b.txns.toLocaleString(),
    fmtDollars(b.amount),
    pct(b.amount / totalAmt),
    b.avg == null ? NO_DATA : fmtDollars(b.avg),
    rateCell(b.med_rate, b.rate_n),
    termCell(b.med_term, b.term_n),
  ];
}

function fixedShareOverall(amort: Record<string, number>, txns: number): number {
  return (amort.FULLAMORT ?? 0) / (txns || 1);
}

