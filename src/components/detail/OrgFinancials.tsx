import type { OrgIrs, IrsFiling } from '../../types';
import { formatCurrency } from '../../lib/format';

// "Organizational Financials" layer: IRS Form 990 data joined by EIN.
// Shown inside the organization record modal. Two depths of data:
//   - full 990 / 990-EZ e-filers: Part I summary + Part X investments + 3-year trend
//   - everyone else in the Business Master File (private foundations filing
//     990-PF, small 990-N filers): the assets / income / revenue the IRS has on file

const FORM_LABEL: Record<string, string> = { '990': 'Form 990', '990EZ': 'Form 990-EZ' };

export function OrgFinancials({ irs }: { irs: OrgIrs }) {
  if (!irs.found) {
    return (
      <Section title="IRS Profile">
        <p className="text-xs text-slate-400">
          EIN {formatEin(irs.ein)} is not in the current Georgia IRS extracts.
        </p>
      </Section>
    );
  }

  const latest = irs.latest ?? null;
  const trend = irs.trend ?? [];

  return (
    <>
      <Section title="IRS Profile">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <Row label="EIN">{formatEin(irs.ein)}</Row>
          {irs.legalName && <Row label="Legal name">{irs.legalName}</Row>}
          {irs.subsection && <Row label="Status">{irs.subsection}</Row>}
          {irs.foundation && <Row label="Classification">{irs.foundation}</Row>}
          {irs.ntee && (
            <Row label="NTEE">
              <span className="font-mono">{irs.ntee}</span>
              {irs.nteeMajor && <span className="text-slate-500"> · {irs.nteeMajor}</span>}
            </Row>
          )}
          {(irs.rulingYear || irs.yearFormation) && (
            <Row label="Since">
              {[irs.yearFormation && `formed ${irs.yearFormation}`, irs.rulingYear && `exempt ${irs.rulingYear}`]
                .filter(Boolean)
                .join(' · ')}
            </Row>
          )}
        </dl>
      </Section>

      {latest ? (
        <FilingFinancials latest={latest} trend={trend} />
      ) : irs.bmf && (irs.bmf.assets != null || irs.bmf.revenue != null) ? (
        <Section title={`Financials${irs.bmf.taxPeriod ? ` (tax period ${fmtPeriod(irs.bmf.taxPeriod)})` : ''}`}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total assets" value={irs.bmf.assets} />
            <Stat label="Total income" value={irs.bmf.income} />
            <Stat label="Revenue" value={irs.bmf.revenue} />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            From the IRS Business Master File. This organization does not appear in the 990 / 990-EZ e-file tables
            (private foundations file Form 990-PF; very small organizations file the 990-N postcard).
          </p>
        </Section>
      ) : null}

      {irs.mission && (
        <Section title="Mission (as filed)">
          <p className="text-xs text-slate-600 leading-relaxed">{sentenceCase(irs.mission)}</p>
        </Section>
      )}

      <p className="text-[10px] text-slate-400 mt-3">
        Source: IRS Form 990 e-file data via the Nonprofit Open Data Collective and NCCS; IRS Exempt Organizations
        Business Master File.
      </p>
    </>
  );
}

function FilingFinancials({ latest, trend }: { latest: IrsFiling; trend: OrgIrs['trend'] }) {
  const investments: [string, number | null][] = [
    ['Publicly traded securities', latest.investPublicSecuritiesEOY],
    ['Other securities', latest.investOtherSecuritiesEOY],
    ['Program-related investments', latest.investProgramRelatedEOY],
    ['Cash & savings', latest.cashAndSavingsEOY],
    ['Notes & loans receivable', latest.notesLoansReceivableEOY],
    ['Land, buildings & equipment (net)', latest.landBuildingsNetEOY],
  ];
  const debt: [string, number | null][] = [
    ['Mortgages & notes payable', latest.mortgagesNotesPayableEOY],
    ['Unsecured notes payable', latest.unsecuredNotesPayableEOY],
    ['Tax-exempt bonds', latest.taxExemptBondsEOY],
    ['Grants payable', latest.grantsPayableEOY],
  ];
  const netAssetClasses: [string, number | null][] = [
    ['Without donor restrictions', latest.netAssetsUnrestrictedEOY],
    ['With donor restrictions (temporary)', latest.netAssetsTempRestrictedEOY],
    ['With donor restrictions (permanent)', latest.netAssetsPermRestrictedEOY],
  ];
  const nonZero = (rows: [string, number | null][]) => rows.filter(([, v]) => v != null && v !== 0);
  const invRows = nonZero(investments);
  const debtRows = nonZero(debt);
  const nacRows = nonZero(netAssetClasses);
  const invested =
    (latest.investPublicSecuritiesEOY ?? 0) + (latest.investOtherSecuritiesEOY ?? 0) + (latest.investProgramRelatedEOY ?? 0);
  const investedShare = latest.assetsEOY ? invested / latest.assetsEOY : null;

  return (
    <>
      <Section title={`Financials · FY${latest.taxYear} · ${FORM_LABEL[latest.form] ?? latest.form}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Revenue" value={latest.revenue} />
          <Stat label="Expenses" value={latest.expenses} />
          <Stat label="Total assets" value={latest.assetsEOY} />
          <Stat label="Net assets" value={latest.netAssetsEOY} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-3">
          {latest.contributions != null && <Row label="Contributions & grants">{formatCurrency(latest.contributions)}</Row>}
          {latest.programRevenue != null && <Row label="Program service revenue">{formatCurrency(latest.programRevenue)}</Row>}
          {latest.investmentIncome != null && <Row label="Investment income">{formatCurrency(latest.investmentIncome)}</Row>}
          {latest.grantsPaid != null && latest.grantsPaid !== 0 && <Row label="Grants paid">{formatCurrency(latest.grantsPaid)}</Row>}
          {latest.salaries != null && <Row label="Salaries & benefits">{formatCurrency(latest.salaries)}</Row>}
          {latest.netIncome != null && (
            <Row label="Surplus / (deficit)">
              <span className={latest.netIncome < 0 ? 'text-brand-orange' : 'text-brand-green'}>
                {formatCurrency(latest.netIncome)}
              </span>
            </Row>
          )}
          {(latest.employees != null || latest.volunteers != null) && (
            <Row label="People">
              {[
                latest.employees != null && `${latest.employees.toLocaleString()} employees`,
                latest.volunteers != null && `${latest.volunteers.toLocaleString()} volunteers`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Row>
          )}
        </dl>
      </Section>

      {(invRows.length > 0 || debtRows.length > 0 || nacRows.length > 0) && (
        <Section title="Balance Sheet Detail (end of year)">
          {invRows.length > 0 && (
            <SubTable
              title={investedShare != null && invested > 0 ? `Investments & holdings · ${Math.round(investedShare * 100)}% of assets invested` : 'Investments & holdings'}
              rows={invRows}
            />
          )}
          {debtRows.length > 0 && <SubTable title="Debt & payables" rows={debtRows} />}
          {nacRows.length > 0 && <SubTable title="Net assets by restriction" rows={nacRows} />}
        </Section>
      )}

      {trend && trend.length > 1 && (
        <Section title="Trend">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                <th className="text-left font-semibold pb-1">FY</th>
                <th className="text-right font-semibold pb-1">Revenue</th>
                <th className="text-right font-semibold pb-1">Expenses</th>
                <th className="text-right font-semibold pb-1">Net assets</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => (
                <tr key={t.taxYear} className="border-t border-slate-100">
                  <td className="py-1 text-slate-600">{t.taxYear}</td>
                  <td className="py-1 text-right tabular-nums text-slate-700">{formatCurrency(t.revenue)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-700">{formatCurrency(t.expenses)}</td>
                  <td className="py-1 text-right tabular-nums text-slate-700">{formatCurrency(t.netAssetsEOY)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700 min-w-0 break-words">{children}</dd>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}

function SubTable({ title, rows }: { title: string; rows: [string, number | null][] }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{title}</p>
      <ul className="text-xs divide-y divide-slate-100">
        {rows.map(([label, v]) => (
          <li key={label} className="flex justify-between gap-3 py-1">
            <span className="text-slate-600">{label}</span>
            <span className="tabular-nums text-slate-800 shrink-0">{formatCurrency(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatEin(ein: string): string {
  return ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein;
}

function fmtPeriod(p: string): string {
  // BMF TAX_PERIOD is YYYYMM
  return p.length === 6 ? `${p.slice(0, 4)}-${p.slice(4)}` : p;
}

// 990 text is usually shouted in all caps; soften it for reading.
function sentenceCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
}
