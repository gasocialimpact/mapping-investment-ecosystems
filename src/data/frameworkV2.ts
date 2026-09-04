import type { Organization } from '../types';

// Framework v2 — the five segments and twenty sub-examples, text as drafted.
// The frame stays high level; detail lives in subcards under each sub-example.
// Organizations roll up to a sub-example through their Airtable Org. Type
// (see ROLLUP below); the subcards are finer than Airtable and are labels for
// people, not a second taxonomy to maintain.

export type FnKey = 'provision' | 'origination' | 'execution' | 'opportunity';

export interface V2Segment {
  key: string;
  /** Airtable segment name; null for Infrastructure, which has no tracked orgs yet. */
  data: string | null;
  label: string;
  short: string;
  color: string;
  tint: string;
  desc: string;
}

export interface SubExample {
  id: string;
  seg: string;
  title: string;
  desc: string;
  subcards: string[];
  fn: FnKey[];
  /** Airtable Org. Type values that roll up to this card. */
  orgTypes: string[];
}

export const V2_FUNCTIONS: { key: FnKey; label: string; desc: string }[] = [
  { key: 'provision', label: 'Capital Provision', desc: 'Who controls and deploys investment capital.' },
  { key: 'origination', label: 'Deal Origination & Sourcing', desc: 'Who finds and develops investment opportunities.' },
  { key: 'execution', label: 'Evaluation, Structuring & Execution', desc: 'Who evaluates risk/impact, structures terms, and completes transactions.' },
  { key: 'opportunity', label: 'Opportunity Development', desc: 'Who helps capital seekers succeed and scale impact.' },
];

export const V2_SEGMENTS: V2Segment[] = [
  {
    key: 'supply', data: 'Capital Allocator', label: 'Capital Supply or Allocators', short: 'Supply', color: '#279a49', tint: '#e6f4ea',
    desc: 'These entities supply the financial capital that drives impact projects. Their functions vary based on risk tolerance, return expectations, and impact priorities.',
  },
  {
    key: 'aggs', data: 'Capital Aggregator', label: 'Capital Intermediaries or Aggregators', short: 'Intermediaries', color: '#4750a2', tint: '#e9eaf6',
    desc: 'Intermediaries function to connect capital providers with capital seekers, optimizing the flow of funds and managing investment vehicles.',
  },
  {
    key: 'seek', data: 'Capital Seeker', label: 'Capital Seekers', short: 'Seekers', color: '#f15921', tint: '#fdeae2',
    desc: 'These are the entities on the ground that need investment capital and other non-financial resources to solve real-world problems.',
  },
  {
    key: 'enab', data: 'Capital Enabler', label: 'Capital Enablers', short: 'Enablers', color: '#53c3c2', tint: '#e4f5f5',
    desc: 'Enablers provide the data, standards, and legal frameworks required for the ecosystem to operate transparently and efficiently.',
  },
  {
    key: 'infra', data: null, label: 'Infrastructure', short: 'Infrastructure', color: '#939699', tint: '#eeeff0',
    desc: 'The shared standards and systems the rest of the ecosystem runs on.',
  },
];

export const SUB_EXAMPLES: SubExample[] = [
  // ---- Capital Supply or Allocators ----
  {
    id: 'institutional', seg: 'supply', title: 'Institutional Investors',
    desc: 'Pension funds, insurance companies, and sovereign wealth funds. They provide large-scale, commercial-rate capital to bring impact projects to a mainstream scale.',
    subcards: ['Public pension', 'Insurer', 'University endowment', 'Sovereign / other'],
    fn: ['provision'], orgTypes: [],
  },
  {
    id: 'dfi', seg: 'supply', title: 'Development Finance Institutions (DFIs)',
    desc: 'Multilateral banks (like the World Bank or IFC) and bilateral agencies. They function as anchors, providing high-volume capital, taking on early-stage risk, and unlocking private investment in emerging markets.',
    subcards: ['Federal (CDFI Fund, SBA, USDA RD)', 'Multilateral', 'State program'],
    fn: ['provision', 'execution'], orgTypes: [],
  },
  {
    id: 'foundations', seg: 'supply', title: 'Philanthropic Foundations & Nonprofit Endowments',
    desc: 'Entities that provide highly flexible capital. They use program-related investments (PRIs), low-interest loans, or "first-loss" capital to absorb risk for early-stage social enterprises.',
    subcards: ['Private foundation', 'Corporate foundation', 'Community foundation', 'DAF sponsor', 'DAF / charitable fund', 'Hospital or university endowment', 'Faith-based institution'],
    fn: ['provision', 'opportunity'],
    orgTypes: ['Foundation (Private)', 'Foundation (Corporate)', 'Foundation (Public DAF Sponsor)', 'DAF or Charitable Fund', 'Healthcare System', 'Higher Education Institution', 'Faith Based Institution'],
  },
  {
    id: 'hnwi', seg: 'supply', title: 'High-Net-Worth Individuals (HNWIs) & Family Offices',
    desc: 'Private wealth owners who function as agile, mission-driven investors, often funding niche, highly innovative, or long-term projects.',
    subcards: ['Family office', 'Angel investor', 'Individual DAF holder'],
    fn: ['provision'], orgTypes: ['HNWI or Family Office'],
  },
  {
    id: 'retail', seg: 'supply', title: 'Retail Investors',
    desc: 'Everyday individuals participating through crowdfunding platforms, green bonds, and community investment funds.',
    subcards: ['Community investment note', 'Crowdfunding backer', 'Green bond holder', 'Credit union member'],
    fn: ['provision'], orgTypes: [],
  },

  // ---- Capital Intermediaries or Aggregators ----
  {
    id: 'fund_managers', seg: 'aggs', title: 'Impact Fund Managers',
    desc: 'Private equity, venture capital, and debt funds specialized in impact. They source deals, perform due diligence, manage portfolios, and ensure both financial exits and impact delivery.',
    subcards: ['Private equity', 'Venture capital', 'Private debt fund', 'Real assets fund'],
    fn: ['origination', 'execution'], orgTypes: ['PE or Venture Capital Firm', 'Loan or Private Investment Fund'],
  },
  {
    id: 'ibanks', seg: 'aggs', title: 'Investment Banks & Advisors',
    desc: 'Financial institutions that structure impact financial products (like Social Impact Bonds) and advise clients on capital allocation.',
    subcards: ['Investment bank', 'Impact advisory', 'Wealth manager / RIA', 'Placement agent'],
    fn: ['execution'], orgTypes: ['Financial Services Firm'],
  },
  {
    id: 'banks', seg: 'aggs', title: 'Commercial or Community Banks',
    desc: 'Depository institutions lending into communities, including community development banking arms and minority depository institutions.',
    subcards: ['Commercial bank', 'Community bank', 'Minority depository institution', 'Community development entity (NMTC)'],
    fn: ['provision', 'execution'], orgTypes: ['Bank (Commercial)', 'Bank (Community)'],
  },
  {
    id: 'fintech', seg: 'aggs', title: 'Crowdfunding & Fintech Platforms',
    desc: 'Digital marketplaces that democratize impact investing by allowing direct, lower-minimum investments into social enterprises or green projects.',
    subcards: ['Crowdfunding platform', 'Fintech lender', 'Online marketplace'],
    fn: ['origination'], orgTypes: [],
  },
  {
    id: 'cdfi', seg: 'aggs', title: 'CDFIs, Revolving Loan Funds, & Credit Unions',
    desc: 'Bridge national capital providers directly with underserved regional economies. They focus heavily on localized small-business lending, micro-enterprise financing, and affordable housing.',
    subcards: ['CDFI loan fund', 'Credit union', 'Revolving loan fund', 'CDC / SBA lender'],
    fn: ['origination', 'execution', 'opportunity'], orgTypes: ['CDFI or Credit Union'],
  },

  // ---- Capital Seekers ----
  {
    id: 'social_enterprises', seg: 'seek', title: 'Social Enterprises, Impact Businesses, & Entrepreneurs',
    desc: 'For-profit or hybrid businesses whose core mission is to solve a social or environmental issue (e.g., affordable healthcare, clean energy startups).',
    subcards: ['Social enterprise', 'Certified B Corp', 'Startup', 'Cooperative / ESOP'],
    fn: ['opportunity'], orgTypes: ['Business or Social Enterprise'],
  },
  {
    id: 'public_cos', seg: 'seek', title: 'Publicly Traded Companies & Corporate Issuers',
    desc: 'Listed companies and corporate issuers raising capital for sustainability programs, green bonds, and community commitments.',
    subcards: ['Public company', 'Green / social bond issuer', 'REIT'],
    fn: ['origination'], orgTypes: ['Publicly Traded Company'],
  },
  {
    id: 'ngos', seg: 'seek', title: 'Non-Governmental Organizations (NGOs) & Non-Profits',
    desc: 'Organizations utilizing innovative financing structures (like outcome-based contracts) to fund scalable, operational programs.',
    subcards: ['Human services', 'Housing operator', 'Food bank', 'Health & recovery provider', 'Conservation / land trust'],
    fn: ['opportunity'], orgTypes: ['Nonprofit (Community Dev. or Social Services)'],
  },

  // ---- Capital Enablers ----
  {
    id: 'developers', seg: 'enab', title: 'Sustainable Real Estate & Infrastructure Developers',
    desc: 'Firms building green buildings, affordable housing, clean water systems, and renewable energy grids.',
    subcards: ['Affordable housing developer', 'Green building', 'Clean energy', 'Water / infrastructure'],
    fn: ['origination', 'opportunity'], orgTypes: ['Real Estate Development Firm'],
  },
  {
    id: 'raters', seg: 'enab', title: 'Rating & Verification Agencies',
    desc: 'Independent firms (like B Lab, S&P, or Sustainalytics) that audit, certify, and rate companies on their actual Environmental, Social, and Governance (ESG) performance or net impact.',
    subcards: ['B Lab', 'CDFI rating (Aeris)', 'ESG rater'],
    fn: ['execution'], orgTypes: [],
  },
  {
    id: 'networks', seg: 'enab', title: 'Networks & Industry Bodies',
    desc: 'Groups that foster collaboration, share research, and advocate for policy changes (e.g., Toniic, GSG Impact, and local national advisory boards).',
    subcards: ['Network / coalition', 'Chamber of commerce', 'Think tank / research center'],
    fn: ['opportunity'], orgTypes: ['Ecosystem Builder or Think-Tank'],
  },
  {
    id: 'policy', seg: 'enab', title: 'Policymakers & Regulators',
    desc: 'Governments that shape the market by offering tax incentives for impact investments, setting green taxonomy laws, or mandating sustainability disclosures.',
    subcards: ['State agency', 'Local government / authority', 'Regional commission', 'Regulator'],
    fn: ['provision', 'opportunity'], orgTypes: ['Government Agency'],
  },
  {
    id: 'coaches', seg: 'enab', title: 'Business Coaches, Incubators, & Accelerators',
    desc: 'Bridge the gap between capital supply and investment readiness. Organizations that provide early-stage social entrepreneurs with mentorship, seed funding, and business development to make them "investment-ready." Advisors, accelerators, and incubators help enterprises upgrade governance, financials, sales, and impact practices to meet investor requirements.',
    subcards: ['Accelerator', 'Incubator', 'Business coach / TA provider', 'University program'],
    fn: ['opportunity'], orgTypes: ['Higher Education Institution'],
  },
  {
    id: 'advisors', seg: 'enab', title: 'Technical Advisors, Strategic Consultants, & Specialized Professional Services',
    desc: 'Law, accounting, banking, evaluation and consulting providers reduce completion risk, ensure compliance, and strengthen governance and reporting.',
    subcards: ['Consulting', 'Accounting', 'Law', 'Evaluation', 'Technology services'],
    fn: ['execution'], orgTypes: ['Professional Service Provider'],
  },

  // ---- Infrastructure ----
  {
    id: 'standards', seg: 'infra', title: 'Standard Setters & Frameworks',
    desc: 'Organizations that define how impact is defined and measured. Key entities include the Global Impact Investing Network (GIIN), IRIS+, the Operating Principles for Impact Management, and the Impact Management Project (IMP).',
    subcards: ['GIIN / IRIS+', 'Operating Principles', 'IMP', 'SASB / ISSB'],
    fn: ['execution'], orgTypes: [],
  },
  {
    id: 'platforms', seg: 'infra', title: 'Technology Platforms or Marketplaces',
    desc: 'Enable efficient capital deployment and management. Investment, data, and communications systems connect participants, lower cost-to-serve, and make performance and impact more transparent.',
    subcards: ['Data / information exchange', 'Investment platform', 'Marketplace'],
    fn: ['execution', 'opportunity'], orgTypes: [],
  },
];

export const getV2Segment = (key: string) => V2_SEGMENTS.find((s) => s.key === key);

// Roll-up: an organization belongs to the first sub-example in ITS segment
// whose orgTypes include its Org. Type. Types that appear in two segments
// (Higher Education Institution is both an endowment and a university program)
// resolve by the organization's segment, so nothing is double counted.
const BY_SEG_TYPE = new Map<string, SubExample>();
for (const s of SUB_EXAMPLES) for (const t of s.orgTypes) BY_SEG_TYPE.set(`${s.seg}|${t}`, s);
const SEG_KEY_BY_DATA = new Map(V2_SEGMENTS.filter((s) => s.data).map((s) => [s.data as string, s.key]));

export function segmentKeyFor(org: Organization): string | null {
  return SEG_KEY_BY_DATA.get(org.segment) ?? null;
}

export function subExampleFor(org: Organization): SubExample | null {
  const seg = segmentKeyFor(org);
  if (!seg || !org.orgType) return null;
  return BY_SEG_TYPE.get(`${seg}|${org.orgType}`) ?? null;
}

/** Ids of every impact dimension linked to an organization, any axis. */
export function impactIdsOf(org: Organization): string[] {
  return [...org.sdgIds, ...org.sectorIds, ...org.populationIds, ...org.ownershipIds];
}
