#!/usr/bin/env python3
"""Builds public/data/cdfi-lending.json from data/cdfi-lending-ga.xlsx — the
Georgia-filtered CDFI Fund release workbook (Transaction Level Reports FY22 and
FY03-15, Consumer Lending Report FY22, plus its own GEO rollup sheets).

Python (openpyxl) rather than Node because the workbook is a full 8MB xlsx;
run manually after replacing the workbook:  python3 scripts/build-cdfi-lending.py

Conventions shared with the rest of the pipeline: unreported values become
null, never zero; sentinel codes (interest rate 99 = not reported) are
dropped; every county carries the same keys. The reconciliation block reads
the Fed CIE 'CDFI' program figures from public/data/capital-tables.json so the
UI can put the two sources side by side.
"""

import json
import statistics as st
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
WB = ROOT / "data" / "cdfi-lending-ga.xlsx"
OUT = ROOT / "public" / "data" / "cdfi-lending.json"

PURPOSE_LABELS = {
    "MICRO": "Microenterprise",
    "BUSINESS": "Small business",
    "BUSFIXED": "Business — fixed asset",
    "BUSWORKCAP": "Business — working capital",
    "HOMEPURCH": "Home purchase",
    "HOMEIMP": "Home improvement",
    "CONSUMER": "Consumer",
    "RECOSINGLE": "RE construction — single family",
    "RECOMULTI": "RE construction — multifamily",
    "RECOCOM": "RE construction — commercial",
    "RERHSINGLE": "RE rehab — single family",
    "RERHMULTI": "RE rehab — multifamily",
    "RERHCOM": "RE rehab — commercial",
    "OTHER": "Other",
}
GROUP_LABELS = {
    "BUSINESS_MICRO": "Business & microenterprise",
    "HOUSING": "Housing",
    "COMMERCIAL_RE": "Commercial real estate",
    "CONSUMER": "Consumer",
    "OTHER": "Other",
}


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f


def rate_pct(v):
    """Interest rates arrive in mixed units: most lenders report percent
    (4.25), a few report decimals (0.0425), and 99 is the Fund's not-reported
    sentinel. Normalize to percent; drop anything implausible."""
    f = num(v)
    if f is None or f > 40:
        return None
    if 0 < f < 0.5:
        return round(f * 100, 3)
    return round(f, 3)


def yes_no(v):
    return "yes" if v == "Yes" else "no" if v == "No" else "unknown"


def med(vals, digits=2):
    return round(st.median(vals), digits) if vals else None


def q(vals, which, digits=2):
    if len(vals) < 4:
        return None
    return round(st.quantiles(vals, n=4)[which], digits)


def main():
    wb = openpyxl.load_workbook(WB, read_only=True, data_only=True)

    # --- TLR FY22 — one row per transaction --------------------------------
    ws = wb["GA Filtered_tlr_fy22_release"]
    rows = ws.iter_rows(values_only=True)
    hdr = {str(h): i for i, h in enumerate(next(rows))}

    def make_bucket():
        return {
            "txns": 0, "amount": 0.0, "rates": [], "terms": [],
            "fixed": 0, "adj": 0, "group": None,
        }

    by_purpose = defaultdict(make_bucket)
    by_group = defaultdict(make_bucket)
    txn_type = defaultdict(lambda: {"txns": 0, "amount": 0.0})
    investee = defaultdict(lambda: {"txns": 0, "amount": 0.0})
    amort = defaultdict(int)
    profile = {k: {"yes": 0, "no": 0, "unknown": 0} for k in ("minority", "women", "low_income")}
    by_sub_year = defaultdict(lambda: {"txns": 0, "amount": 0.0})
    by_orig_year = defaultdict(lambda: {"txns": 0, "amount": 0.0})
    orgs = set()
    all_rates, all_terms = [], []
    counties = defaultdict(lambda: {
        "tlr22_rates": [], "tlr22_terms": [], "tlr22_fixed": 0, "tlr22_adj": 0,
        "profile": {k: {"yes": 0, "no": 0} for k in ("minority", "women", "low_income")},
        "investee": defaultdict(int),
        "groups_txns": defaultdict(int),
    })

    def col(prefix):
        # Column names vary slightly between exports; match on prefix.
        hit = [i for h, i in hdr.items() if h.startswith(prefix)]
        assert len(hit) == 1, f"{prefix}: {hit}"
        return hit[0]

    c = {k: col(k) for k in (
        "org_id", "original_loan_investment_amo", "purpose__c", "purpose_group",
        "transaction_type__c", "investee_type__c", "interest_rate__c",
        "interest_type__c", "term_in_months__c", "amortization_type__c",
        "tlr_submission_year__c", "date_originated__c", "county_fips",
        "minority_owned_or_controll", "women_owned_or_controlled_",
        "low_income_owned_or_contro",
    )}

    tlr22_total = 0.0
    tlr22_txns = 0
    for r in rows:
        amt = num(r[c["original_loan_investment_amo"]]) or 0.0
        tlr22_total += amt
        tlr22_txns += 1
        orgs.add(r[c["org_id"]])
        purpose = str(r[c["purpose__c"]] or "OTHER")
        group = str(r[c["purpose_group"]] or "OTHER")
        fips = str(r[c["county_fips"]] or "")
        rate = rate_pct(r[c["interest_rate__c"]])
        term = num(r[c["term_in_months__c"]])
        term = term if term and 0 < term < 600 else None
        itype = r[c["interest_type__c"]]

        by_purpose[purpose]["group"] = group
        for bucket in (by_purpose[purpose], by_group[group]):
            bucket["txns"] += 1
            bucket["amount"] += amt
            if rate is not None:
                bucket["rates"].append(rate)
            if term is not None:
                bucket["terms"].append(term)
            if itype == "FIXED":
                bucket["fixed"] += 1
            elif itype == "ADJ":
                bucket["adj"] += 1
        if rate is not None:
            all_rates.append(rate)
        if term is not None:
            all_terms.append(term)

        tt = txn_type[str(r[c["transaction_type__c"]] or "OTHER")]
        tt["txns"] += 1
        tt["amount"] += amt
        iv = investee[str(r[c["investee_type__c"]] or "OTHER")]
        iv["txns"] += 1
        iv["amount"] += amt
        amort[str(r[c["amortization_type__c"]] or "NULL")] += 1

        for key, col in (("minority", "minority_owned_or_controll"),
                         ("women", "women_owned_or_controlled_"),
                         ("low_income", "low_income_owned_or_contro")):
            profile[key][yes_no(r[c[col]])] += 1

        sy = num(r[c["tlr_submission_year__c"]])
        if sy:
            b = by_sub_year[int(sy)]
            b["txns"] += 1
            b["amount"] += amt
        d = r[c["date_originated__c"]]
        oy = d.year if isinstance(d, datetime) else None
        if oy:
            b = by_orig_year[oy]
            b["txns"] += 1
            b["amount"] += amt

        if fips.startswith("13"):
            cn = counties[fips]
            if rate is not None:
                cn["tlr22_rates"].append(rate)
            if term is not None:
                cn["tlr22_terms"].append(term)
            if itype == "FIXED":
                cn["tlr22_fixed"] += 1
            elif itype == "ADJ":
                cn["tlr22_adj"] += 1
            for key, col in (("minority", "minority_owned_or_controll"),
                             ("women", "women_owned_or_controlled_"),
                             ("low_income", "low_income_owned_or_contro")):
                v = yes_no(r[c[col]])
                if v != "unknown":
                    cn["profile"][key][v] += 1
            cn["investee"][str(r[c["investee_type__c"]] or "OTHER")] += 1
            cn["groups_txns"][group] += 1

    # --- CLR FY22 — aggregated consumer-lending rows ------------------------
    ws = wb["GA Filtered_clr_fy22_release"]
    rows = ws.iter_rows(values_only=True)
    chdr = {str(h): i for i, h in enumerate(next(rows))}
    clr = {"records": 0, "loans": 0, "amount": 0.0, "litp_amount": 0.0,
           "litp_loans": 0, "otp_amount": 0.0, "orgs": set()}
    clr_by_fy = defaultdict(lambda: {"records": 0, "loans": 0, "amount": 0.0})
    clr_county = defaultdict(lambda: {"loans": 0, "amount": 0.0, "litp_amount": 0.0})
    for r in rows:
        amt = num(r[chdr["originated_total_amount__c"]]) or 0.0
        loans = int(num(r[chdr["originated_total_number__c"]]) or 0)
        clr["records"] += 1
        clr["loans"] += loans
        clr["amount"] += amt
        clr["litp_amount"] += num(r[chdr["litp_amount__c"]]) or 0.0
        clr["litp_loans"] += int(num(r[chdr["litp_number__c"]]) or 0)
        clr["otp_amount"] += num(r[chdr["otp_amount__c"]]) or 0.0
        clr["orgs"].add(r[chdr["org_id"]])
        fy = num(r[chdr["fiscal_year_del__c"]])
        if fy:
            b = clr_by_fy[int(fy)]
            b["records"] += 1
            b["loans"] += loans
            b["amount"] += amt
        fips = str(r[chdr["county_fips"]] or "")
        if fips.startswith("13"):
            cc = clr_county[fips]
            cc["loans"] += loans
            cc["amount"] += amt
            cc["litp_amount"] += num(r[chdr["litp_amount__c"]]) or 0.0

    # --- TLR FY03-15 — legacy transactions ----------------------------------
    ws = wb["GA Filtered_tlr_fy03-15"]
    rows = ws.iter_rows(values_only=True)
    lhdr = {str(h): i for i, h in enumerate(next(rows))}
    legacy = {"txns": 0, "amount": 0.0, "orgs": set()}
    legacy_by_year = defaultdict(lambda: {"txns": 0, "amount": 0.0})
    for r in rows:
        amt = num(r[lhdr["originalamount"]]) or 0.0
        legacy["txns"] += 1
        legacy["amount"] += amt
        legacy["orgs"].add(r[lhdr["org_id"]])
        yr = num(r[lhdr["transaction_year"]])
        key = int(yr) if yr and yr >= 2003 else 2002  # 2002 = "before 2003"
        b = legacy_by_year[key]
        b["txns"] += 1
        b["amount"] += amt

    # --- GEO rollups (the workbook's own county aggregation) -----------------
    ws = wb["GEO_County"]
    rows = ws.iter_rows(values_only=True)
    ghdr = {str(h): i for i, h in enumerate(next(rows))}
    geo_county = {}
    for r in rows:
        fips = str(r[ghdr["COUNTY_FIPS"]] or "")
        if not fips.startswith("13"):
            continue
        geo_county[fips] = {
            "loans": int(num(r[ghdr["LOANS_TOTAL"]]) or 0),
            "amount": round(num(r[ghdr["AMOUNT_TOTAL"]]) or 0.0, 2),
            "tlr22_txns": int(num(r[ghdr["TLR22_TXNS"]]) or 0),
            "tlr22_amount": round(num(r[ghdr["TLR22_AMOUNT"]]) or 0.0, 2),
            "clr_loans": int(num(r[ghdr["CLR22_LOANS"]]) or 0),
            "clr_amount": round(num(r[ghdr["CLR22_AMOUNT"]]) or 0.0, 2),
            "legacy_txns": int(num(r[ghdr["TLR0315_TXNS"]]) or 0),
            "legacy_amount": round(num(r[ghdr["TLR0315_AMOUNT"]]) or 0.0, 2),
            "groups": {
                "BUSINESS_MICRO": round(num(r[ghdr["AMT_BUSINESS_MICRO"]]) or 0.0, 2),
                "HOUSING": round(num(r[ghdr["AMT_HOUSING"]]) or 0.0, 2),
                "COMMERCIAL_RE": round(num(r[ghdr["AMT_COMMERCIAL_RE"]]) or 0.0, 2),
                "CONSUMER": round(num(r[ghdr["AMT_CONSUMER"]]) or 0.0, 2),
                "OTHER": round(num(r[ghdr["AMT_OTHER"]]) or 0.0, 2),
            },
            "tracts_with_lending": int(num(r[ghdr["TRACTS_WITH_LENDING"]]) or 0),
        }

    ws = wb["GEO_County_Year"]
    rows = ws.iter_rows(values_only=True)
    yhdr = {str(h): i for i, h in enumerate(next(rows))}
    county_years = defaultdict(list)
    for r in rows:
        fips = str(r[yhdr["COUNTY_FIPS"]] or "")
        yr = num(r[yhdr["YEAR"]])
        if not fips.startswith("13") or not yr:
            continue
        county_years[fips].append({
            "year": int(yr),
            "loans": int(num(r[yhdr["LOANS"]]) or 0),
            "amount": round(num(r[yhdr["AMOUNT"]]) or 0.0, 2),
        })

    # --- Reconciliation against the Fed CIE 'CDFI' program -------------------
    # Only the submission/fiscal-year basis is usable: date_originated is
    # populated for barely 20k of the 27,920 TLR rows and only for 2020-22
    # vintages, so an origination-year series would understate every year.
    cie = json.loads((ROOT / "public" / "data" / "capital-tables.json").read_text())
    cie_cdfi = {r["year"]: r["total_amount"] for r in cie["program_year_totals"] if r["program"] == "CDFI"}
    recon = []
    for year in sorted(cie_cdfi):
        fund_sub = by_sub_year.get(year, {}).get("amount", 0.0) + clr_by_fy.get(year, {}).get("amount", 0.0)
        recon.append({
            "year": year,
            "cie_cdfi": cie_cdfi[year],
            "fund_reported": round(fund_sub, 2),
            "fund_tlr": round(by_sub_year.get(year, {}).get("amount", 0.0), 2),
            "fund_clr": round(clr_by_fy.get(year, {}).get("amount", 0.0), 2),
        })

    # --- Assemble ------------------------------------------------------------
    def finish(bucket):
        return {
            **({"group": bucket["group"]} if bucket["group"] else {}),
            "txns": bucket["txns"],
            "amount": round(bucket["amount"], 2),
            "avg": round(bucket["amount"] / bucket["txns"], 2) if bucket["txns"] else None,
            "med_rate": med(bucket["rates"]),
            "rate_n": len(bucket["rates"]),
            "med_term": med(bucket["terms"], 0),
            "term_n": len(bucket["terms"]),
            "fixed_share": round(bucket["fixed"] / (bucket["fixed"] + bucket["adj"]), 3)
            if bucket["fixed"] + bucket["adj"] else None,
        }

    combined_years = sorted(set(list(legacy_by_year) + list(by_sub_year) + list(clr_by_fy)))
    combined = [{
        "year": y,
        "legacy_amount": round(legacy_by_year[y]["amount"], 2) if y in legacy_by_year else None,
        "tlr22_amount": round(by_sub_year[y]["amount"], 2) if y in by_sub_year else None,
        "clr_amount": round(clr_by_fy[y]["amount"], 2) if y in clr_by_fy else None,
        "clr_loans": clr_by_fy[y]["loans"] if y in clr_by_fy else None,
        "total": round(legacy_by_year.get(y, {}).get("amount", 0.0)
                       + by_sub_year.get(y, {}).get("amount", 0.0)
                       + clr_by_fy.get(y, {}).get("amount", 0.0), 2),
    } for y in combined_years]

    county_out = {}
    for fips, g in geo_county.items():
        cn = counties.get(fips, None)
        cc = clr_county.get(fips, {})
        prof = cn["profile"] if cn else None
        county_out[fips] = {
            **g,
            "litp_amount": round(cc.get("litp_amount", 0.0), 2),
            "years": sorted(county_years.get(fips, []), key=lambda r: r["year"]),
            "med_rate": med(cn["tlr22_rates"]) if cn else None,
            "rate_n": len(cn["tlr22_rates"]) if cn else 0,
            "med_term": med(cn["tlr22_terms"], 0) if cn else None,
            "term_n": len(cn["tlr22_terms"]) if cn else 0,
            "fixed_share": round(cn["tlr22_fixed"] / (cn["tlr22_fixed"] + cn["tlr22_adj"]), 3)
            if cn and cn["tlr22_fixed"] + cn["tlr22_adj"] else None,
            "profile": {k: dict(v) for k, v in prof.items()} if prof else None,
            "investee": dict(cn["investee"]) if cn else None,
            "groups_txns": dict(cn["groups_txns"]) if cn else None,
        }

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": ("CDFI Fund public data releases, Georgia-filtered: Transaction Level Report FY22 "
                   "release and FY2003-15 archive; Consumer Lending Report FY22 release"),
        "purpose_labels": PURPOSE_LABELS,
        "group_labels": GROUP_LABELS,
        "state": {
            "tlr22": {
                "txns": tlr22_txns, "amount": round(tlr22_total, 2), "orgs": len(orgs),
                "by_purpose": {k: finish(v) for k, v in sorted(by_purpose.items(), key=lambda x: -x[1]["amount"])},
                "by_group": {k: finish(v) for k, v in sorted(by_group.items(), key=lambda x: -x[1]["amount"])},
                "txn_type": {k: {"txns": v["txns"], "amount": round(v["amount"], 2)}
                             for k, v in sorted(txn_type.items(), key=lambda x: -x[1]["amount"])},
                "investee": {k: {"txns": v["txns"], "amount": round(v["amount"], 2)}
                             for k, v in sorted(investee.items(), key=lambda x: -x[1]["amount"])},
                "amortization": dict(sorted(amort.items(), key=lambda x: -x[1])),
                "profile": profile,
                "rates": {"n": len(all_rates), "median": med(all_rates),
                          "p25": q(all_rates, 0), "p75": q(all_rates, 2)},
                "terms": {"n": len(all_terms), "median": med(all_terms, 0)},
                "by_submission_year": {y: {"txns": v["txns"], "amount": round(v["amount"], 2)}
                                       for y, v in sorted(by_sub_year.items())},
            },
            "clr": {
                "records": clr["records"], "loans": clr["loans"], "amount": round(clr["amount"], 2),
                "orgs": len(clr["orgs"]),
                "litp_amount": round(clr["litp_amount"], 2), "litp_loans": clr["litp_loans"],
                "otp_amount": round(clr["otp_amount"], 2),
                "by_fiscal_year": {y: {"records": v["records"], "loans": v["loans"],
                                       "amount": round(v["amount"], 2)}
                                   for y, v in sorted(clr_by_fy.items())},
            },
            "legacy": {"txns": legacy["txns"], "amount": round(legacy["amount"], 2),
                       "orgs": len(legacy["orgs"])},
            "combined_by_year": combined,
        },
        "reconciliation": recon,
        "counties": county_out,
    }

    # Gut checks against the workbook's own Summary tab.
    assert abs(tlr22_total - 1870031091.0672) < 1, tlr22_total
    assert tlr22_txns == 27920, tlr22_txns
    assert abs(clr["amount"] - 335160239.03414) < 1, clr["amount"]
    assert clr["loans"] == 157290, clr["loans"]
    assert abs(legacy["amount"] - 299965732) < 1, legacy["amount"]
    combined_total = sum(r["total"] for r in combined)
    assert abs(combined_total - 2505157062.10134) < 2, combined_total

    OUT.write_text(json.dumps(out))
    print(f"Wrote {OUT.name} — {len(county_out)} counties, "
          f"${combined_total/1e9:.3f}B across {tlr22_txns + legacy['txns']} TLR txns + {clr['loans']} CLR loans")


if __name__ == "__main__":
    main()
