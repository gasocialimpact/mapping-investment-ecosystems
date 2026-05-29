export interface FrameworkFunction {
  key: string;
  label: string;
  desc: string;
}

export interface FrameworkSubcat {
  title: string;
  mini: string;
  bullets: string[];
}

export interface FrameworkDependency {
  id: string;
  why: string;
}

export interface FrameworkNode {
  id: string;
  seg: string;
  fn: string[];
  title: string;
  meta: string;
  keyFunction: string;
  descLong: string;
  capacitiesLong: string[];
  challenges: string[];
  deps: FrameworkDependency[];
  subcats?: FrameworkSubcat[];
}

export interface FrameworkSegment {
  key: string;
  label: string;
  color: string;
}

export interface GlossaryGroup {
  group: string;
  items: { term: string; def: string }[];
}

export interface StrategyCase {
  title: string;
  steps: string[];
  instruments: string[];
  stakeholders: string[];
}

export interface Strategy {
  key: string;
  title: string;
  longDesc: string;
  stakeholders: string[];
  cases: StrategyCase[];
}

export const FRAMEWORK_FUNCTIONS: FrameworkFunction[] = [
  { key: 'provision', label: 'Capital Provision', desc: 'Who controls and deploys investment capital.' },
  { key: 'origination', label: 'Deal Origination & Sourcing', desc: 'Who finds and develops investment opportunities.' },
  { key: 'execution', label: 'Evaluation, Structuring & Execution', desc: 'Who evaluates risk/impact, structures terms, and completes transactions.' },
  { key: 'opportunity', label: 'Opportunity Development', desc: 'Who helps capital seekers succeed and scale impact.' },
];

export const FRAMEWORK_SEGMENTS: FrameworkSegment[] = [
  { key: 'supply', label: 'Capital Allocators', color: '#279a49' },
  { key: 'aggs', label: 'Capital Aggregators', color: '#53c3c2' },
  { key: 'seek', label: 'Capital Seekers', color: '#f1d25b' },
  { key: 'enab', label: 'Capital Enablers', color: '#4750a2' },
  { key: 'infra', label: 'Infrastructure', color: '#929adf' },
];

export const FRAMEWORK_NODES: FrameworkNode[] = [
  {
    id: 'inst_owners', seg: 'supply', fn: ['provision'],
    title: 'Institutional Asset Owners', meta: 'Mandates, large-scale capital',
    keyFunction: 'Provide patient, institutional capital to impact strategies.',
    descLong: 'Large fiduciary investors—public/corporate pensions, endowments, insurers, sovereign funds—set mandates and allocate at scale. They can anchor new funds, seed place-based vehicles, and influence market norms by requiring credible impact management.',
    capacitiesLong: [
      'Scale & duration: ability to commit sizable tickets with long holding periods.',
      'Governance influence: policy engagement and convening power with managers and peers.',
      'Portfolio construction: allocate across public/private markets to match risk/return and impact goals.',
    ],
    challenges: [
      'Fiduciary interpretation and board education slow adoption of non-traditional structures.',
      'Need for track record and pipeline at scale to justify allocation.',
      'Operational capacity to manage bespoke impact mandates.',
    ],
    deps: [
      { id: 'fund_managers', why: 'Intermediated access and portfolio management.' },
      { id: 'impact_mm', why: 'Standardized metrics and independent verification.' },
      { id: 'policy', why: 'Regulatory clarity on fiduciary duty and disclosure.' },
      { id: 'prof_services', why: 'Legal/tax structuring and governance.' },
      { id: 'intermediaries', why: 'Platforms and syndication for access.' },
    ],
    subcats: [
      { title: 'Pension Funds', mini: 'Public & corporate retirement assets', bullets: ['Liability-driven investing', 'Scale anchor commitments', 'Preference for established managers'] },
      { title: 'Endowments', mini: 'University & foundation pools', bullets: ['Long horizons', 'Mission alignment debates', 'Growing place-based side pockets'] },
      { title: 'Insurance', mini: 'General accounts & impact sidecars', bullets: ['Long-duration assets', 'Regulatory constraints', 'Risk-based capital considerations'] },
    ],
  },
  {
    id: 'foundations', seg: 'supply', fn: ['provision'],
    title: 'Foundations & Philanthropies', meta: 'Mission-aligned, flexible capital',
    keyFunction: 'Bridge grants and investments with flexible tools (e.g., PRIs, guarantees).',
    descLong: 'Mission-first capital that can absorb risk, fund pre-investment readiness, and crowd in others through guarantees or first-loss. Foundations often underwrite ecosystem costs (measurement, TA) and catalyze place-based strategies alongside grants.',
    capacitiesLong: [
      'Catalytic risk-taking: PRIs, recoverable grants, guarantees.',
      'Mission stewardship with community priorities.',
      'Ecosystem funding: willingness to cover TA and measurement.',
    ],
    challenges: [
      'Tension between grant-making and investing disciplines.',
      'Limited investment staff for direct deals.',
      'Board risk appetite and exit timing expectations.',
    ],
    deps: [
      { id: 'ta_providers', why: 'Funding for readiness and post-investment support.' },
      { id: 'cdfi', why: 'Community lending channels and local reach.' },
      { id: 'impact_mm', why: 'Shared learning and accountability on outcomes.' },
      { id: 'ecosystem_builders', why: 'Networks to coordinate actors.' },
    ],
  },
  {
    id: 'gov_supply', seg: 'supply', fn: ['provision'],
    title: 'Government & Public Funding', meta: 'Policy, incentives, catalytic capital',
    keyFunction: 'Create policy frameworks, tax incentives, and guarantees that de-risk private capital.',
    descLong: 'Public agencies shape market rules and supply catalytic instruments (e.g., tax credits, guarantees, direct programs) that unlock private investment into priority sectors.',
    capacitiesLong: [
      'Regulatory authority to clarify rules and reporting.',
      'Incentive design to mobilize private capital.',
      'Countercyclical capital during market stress.',
    ],
    challenges: [
      'Administrative complexity and compliance burden.',
      'Policy cycles and reauthorizations create uncertainty.',
      'Coordination across agencies and levels of government.',
    ],
    deps: [
      { id: 'policy', why: 'Statutory and regulatory frameworks (e.g., CRA, tax credits).' },
      { id: 'cdfi', why: 'Program delivery into underserved markets.' },
      { id: 'fund_managers', why: 'Co-investment and market uptake.' },
      { id: 'prof_services', why: 'Program structuring and compliance support.' },
    ],
  },
  {
    id: 'hnwi', seg: 'supply', fn: ['provision'],
    title: 'HNW & Individual Investors', meta: 'Flexible, values-aligned capital',
    keyFunction: 'Provide flexible early-stage/values-aligned capital.',
    descLong: 'Family offices and individuals fund seed-stage ventures, place-based efforts, and niche strategies. They often move quickly and can blend philanthropy with investment to prove concepts and attract later capital.',
    capacitiesLong: [
      'Speed & flexibility for bespoke terms.',
      'Operator experience and networks.',
      'Signaling effect for new managers or models.',
    ],
    challenges: [
      'Sourcing and diligence capacity vary widely.',
      'Liquidity needs may shorten horizons.',
      'Concentration risk without diversified vehicles.',
    ],
    deps: [
      { id: 'vc_funds', why: 'Access to early-stage pipelines and syndicates.' },
      { id: 'fund_managers', why: 'Diversification and professional oversight.' },
      { id: 'intermediaries', why: 'Platform access and custody/administration.' },
      { id: 'ta_providers', why: 'De-risking via investee readiness.' },
    ],
  },
  {
    id: 'banks_supply', seg: 'supply', fn: ['provision', 'execution'],
    title: 'Banks & Financial Institutions', meta: 'Debt capital & banking',
    keyFunction: 'Provide lending and banking services adapted for impact.',
    descLong: 'Banks, credit unions and community banks supply credit and treasury services, often in partnership with CDFIs and public programs. They can mainstream impact through underwriting, community reinvestment, and specialized lending desks.',
    capacitiesLong: [
      'Underwriting and risk management infrastructure.',
      'Local branch networks and data for credit decisions.',
      'Access to public programs and secondary markets.',
    ],
    challenges: [
      'Regulatory capital and compliance constraints.',
      'Limited equity risk appetite.',
      'Measuring non-financial outcomes within prudential rules.',
    ],
    deps: [
      { id: 'cdfi', why: 'Participations and referrals in underserved markets.' },
      { id: 'policy', why: 'CRA, tax credits, and guarantee programs.' },
      { id: 'prof_services', why: 'Complex deal structuring and opinions.' },
      { id: 'tech_platforms', why: 'Loan origination, KYC/AML, portfolio systems.' },
    ],
    subcats: [
      { title: 'Commercial Banks', mini: 'Deposit-taking lenders', bullets: ['Term loans & revolvers', 'Construction/permanent debt', 'Treasury services'] },
      { title: 'Credit Unions', mini: 'Member-owned depositories', bullets: ['Consumer/small business loans', 'Local presence & trust', 'Often CDFI-certified'] },
      { title: 'Investment Banks', mini: 'Capital markets & advisory', bullets: ['Underwriting & distribution', 'Syndication networks', 'M&A and structuring'] },
    ],
  },
  {
    id: 'fund_managers', seg: 'aggs', fn: ['origination', 'execution'],
    title: 'Impact Fund Managers', meta: 'Source, diligence, manage',
    keyFunction: 'Professional investment management with impact focus.',
    descLong: 'Specialist managers pool capital, originate and structure deals, govern portfolio companies, and manage impact performance using recognized standards.',
    capacitiesLong: [
      'Sourcing engines and sector expertise.',
      'Impact management systems and verification.',
      'Active ownership and value-creation playbooks.',
    ],
    challenges: [
      'Fundraising in competitive markets; exits.',
      'Data collection burden on small investees.',
      'Attracting and retaining experienced, diverse talent.',
    ],
    deps: [
      { id: 'inst_owners', why: 'Anchor commitments and mandate design.' },
      { id: 'foundations', why: 'Catalytic tranches and TA funding.' },
      { id: 'ta_providers', why: 'Readiness and post-investment support.' },
      { id: 'impact_mm', why: 'Metrics, benchmarks, and assurance.' },
    ],
  },
  {
    id: 'cdfi', seg: 'aggs', fn: ['origination', 'execution', 'opportunity'],
    title: 'CDFIs (Community Lenders)', meta: 'Mission lenders & TA',
    keyFunction: 'Bridge mainstream finance and underserved communities.',
    descLong: 'Certified community lenders deploy flexible debt and development services in low-income markets, blending public awards, bank capital, and philanthropy to meet local needs.',
    capacitiesLong: [
      'Place-based trust and relationships.',
      'Flexible underwriting and patient capital.',
      'Embedded technical assistance to borrowers.',
    ],
    challenges: [
      'Raising unrestricted and long-term capital.',
      'Regulatory and reporting burdens across programs.',
      'Balancing mission with portfolio risk.',
    ],
    deps: [
      { id: 'gov_supply', why: 'Program awards, tax credits, and guarantees.' },
      { id: 'banks_supply', why: 'Participations and CRA-motivated capital.' },
      { id: 'foundations', why: 'First-loss and operating grants.' },
      { id: 'ta_providers', why: 'Pre/post-loan support for borrowers.' },
    ],
  },
  {
    id: 'dfi', seg: 'aggs', fn: ['provision', 'execution'],
    title: 'Development Finance Institutions (DFIs)', meta: 'Catalytic & risk mitigation',
    keyFunction: 'Deploy public resources to crowd in private capital.',
    descLong: 'Bilateral and multilateral DFIs provide debt, equity, and risk-sharing instruments in emerging markets, aiming to mobilize private finance into priority sectors while maintaining development additionality.',
    capacitiesLong: [
      'Political risk tools and concessional windows.',
      'Safeguards and standards for co-investors.',
      'Scale to anchor complex blended structures.',
    ],
    challenges: [
      'Bureaucratic timelines and mandate constraints.',
      'Balancing development impact with financial sustainability.',
      'Crowding-in measurement and transparency expectations.',
    ],
    deps: [
      { id: 'inst_owners', why: 'Co-investment and fund-of-funds participation.' },
      { id: 'fund_managers', why: 'Local sourcing and execution partners.' },
      { id: 'policy', why: 'Country/sector regulatory environment.' },
    ],
  },
  {
    id: 'intermediaries', seg: 'aggs', fn: ['origination', 'execution'],
    title: 'Investment Platforms & Intermediaries', meta: 'Matchmaking & rails',
    keyFunction: 'Enable efficient capital allocation via tech and networks.',
    descLong: 'Platforms, broker-dealers, syndication networks, and funds-of-funds connect capital to opportunities, provide custody/administration, and streamline transactions.',
    capacitiesLong: [
      'Distribution networks and investor onboarding.',
      'Regulatory/compliance expertise.',
      'Workflow automation to reduce costs.',
    ],
    challenges: [
      'Maintaining quality control at scale.',
      'Unit economics in niche markets.',
      'Multi-jurisdiction compliance.',
    ],
    deps: [
      { id: 'hnwi', why: 'Retail and family-office demand.' },
      { id: 'inst_owners', why: 'Institutional flows and mandates.' },
      { id: 'tech_platforms', why: 'APIs, data, and transaction systems.' },
    ],
  },
  {
    id: 'private_debt', seg: 'aggs', fn: ['execution'],
    title: 'Private Debt Funds', meta: 'Specialized credit',
    keyFunction: 'Provide flexible debt to impact sectors.',
    descLong: 'Specialist lenders underwrite working capital, project finance, and revenue-based structures aligned to impact outcomes.',
    capacitiesLong: [
      'Credit underwriting and collateral structuring.',
      'Servicing and monitoring for smaller borrowers.',
      'Syndication with banks/CDFIs for scale.',
    ],
    challenges: [
      'Loss reserve needs and funding cost pressures.',
      'Data collection for outcome-linked features.',
      'Liquidity in down markets.',
    ],
    deps: [
      { id: 'banks_supply', why: 'Co-lending and warehousing.' },
      { id: 'cdfi', why: 'Local sourcing and servicing partnerships.' },
      { id: 'impact_mm', why: 'Target outcomes and reporting.' },
    ],
  },
  {
    id: 'pe_funds', seg: 'aggs', fn: ['origination', 'execution'],
    title: 'Private Equity Funds', meta: 'Control/growth capital',
    keyFunction: 'Invest in private companies for growth/impact.',
    descLong: 'Buyout and growth equity investors scale proven models, improve operations and governance, and pursue impact value creation across supply chains, workforce, and products.',
    capacitiesLong: [
      'Operational improvement and governance levers.',
      'Value-creation planning with management teams.',
      'Follow-on capital for scaling.',
    ],
    challenges: [
      'Exit pathways in impact-sensitive sectors.',
      'Embedding impact in 100-day plans.',
      'Measuring enterprise-level outcomes.',
    ],
    deps: [
      { id: 'inst_owners', why: 'Large commitments and co-invests.' },
      { id: 'prof_services', why: 'Transaction, legal, and ESG diligence.' },
      { id: 'impact_mm', why: 'Impact KPIs and assurance.' },
    ],
  },
  {
    id: 'vc_funds', seg: 'aggs', fn: ['origination', 'execution'],
    title: 'Venture Capital Funds', meta: 'Early-stage capital',
    keyFunction: 'Finance startups in high-growth, impact-aligned sectors.',
    descLong: 'Seed to Series investors back innovation where technology and new business models can deliver outsized impact (e.g., climate tech, health equity, edtech).',
    capacitiesLong: [
      'Sourcing via accelerators/universities/operators.',
      'Company-building and governance support.',
      'Syndication and staged financing discipline.',
    ],
    challenges: [
      'High failure rates and down-round risks.',
      'Impact measurement fit for early-stage realities.',
      'Founder diversity and access to networks.',
    ],
    deps: [
      { id: 'hnwi', why: 'Angel and family-office commitments.' },
      { id: 'inst_owners', why: 'Fund-of-funds and institutional LPs.' },
      { id: 'ta_providers', why: 'Accelerators and incubators for pipeline.' },
    ],
  },
  {
    id: 'mfi', seg: 'aggs', fn: ['origination', 'execution'],
    title: 'Microfinance Institutions', meta: 'Micro-loans & services',
    keyFunction: 'Provide small loans and adjacent services in underserved markets.',
    descLong: 'MFIs extend micro-credit (and, at times, insurance and savings) to households and micro-enterprises that lack access to traditional banking.',
    capacitiesLong: [
      'High-touch origination and collections.',
      'Community presence and trust.',
      'Financial inclusion product design.',
    ],
    challenges: [
      'Unit economics and operating risk.',
      'Interest rate caps and regulatory changes.',
      'Digital transition and client protection.',
    ],
    deps: [
      { id: 'foundations', why: 'Capacity-building and first-loss capital.' },
      { id: 'dfi', why: 'Wholesale funding and risk-sharing.' },
      { id: 'impact_mm', why: 'Client outcomes and protection standards.' },
    ],
  },
  {
    id: 'social_enterprises', seg: 'seek', fn: ['opportunity'],
    title: 'Social Enterprises & Impact Businesses', meta: 'Execute impact models',
    keyFunction: 'Create scalable solutions to social & environmental problems.',
    descLong: 'Mission-driven companies deliver products/services that directly address social or environmental needs while targeting financial sustainability.',
    capacitiesLong: [
      'Innovation and user-centered design.',
      'Impact delivery embedded in the model.',
      'Ability to attract mission-aligned talent and partners.',
    ],
    challenges: [
      'Access to risk-tolerant growth capital.',
      'Go-to-market in underserved segments.',
      'Building credible impact evidence while scaling.',
    ],
    deps: [
      { id: 'vc_funds', why: 'Early-stage capital and guidance.' },
      { id: 'fund_managers', why: 'Growth funding and governance.' },
      { id: 'ta_providers', why: 'Investment readiness and post-investment support.' },
      { id: 'impact_mm', why: 'Metrics to validate outcomes.' },
    ],
  },
  {
    id: 'community_orgs', seg: 'seek', fn: ['opportunity'],
    title: 'Community Development Organizations', meta: 'Place-based development',
    keyFunction: 'Channel investment into community-controlled development.',
    descLong: 'Local nonprofits and community-controlled entities develop affordable housing, main-street assets, and services with deep stakeholder engagement.',
    capacitiesLong: [
      'Community trust and governance legitimacy.',
      'Local knowledge of sites, stakeholders, and timelines.',
      'Coordinating multi-source capital stacks.',
    ],
    challenges: [
      'Complex financing across grants, credits, and loans.',
      'Capacity constraints in development and asset management.',
      'Extended timelines due to entitlement and community processes.',
    ],
    deps: [
      { id: 'cdfi', why: 'Flexible debt and TA.' },
      { id: 'gov_supply', why: 'Tax credits and public programs.' },
      { id: 'foundations', why: 'Predevelopment grants and guarantees.' },
      { id: 'prof_services', why: 'Legal, planning, and accounting.' },
      { id: 'banks_supply', why: 'Construction/permanent lending.' },
    ],
    subcats: [
      { title: 'CDCs', mini: 'Community Development Corporations', bullets: ['Community ownership & voice', 'Neighborhood revitalization', 'Mixed financing (credits, grants, debt)'] },
      { title: 'Nonprofit Developers', mini: 'Mission-first real estate developers', bullets: ['Affordable housing/community facilities', 'Long-horizon stewardship', 'Complex capital stack management'] },
      { title: 'REITs (Affordable/Community)', mini: 'Real estate investment trusts', bullets: ['Own/operate income-producing assets', 'Aggregate capital at scale', 'Potential for mission-aligned mandates'] },
    ],
  },
  {
    id: 'real_estate', seg: 'seek', fn: ['opportunity'],
    title: 'Real Estate Developers', meta: 'Community infrastructure',
    keyFunction: 'Transform capital into community infrastructure and housing.',
    descLong: 'Developers deliver affordable and mixed-use projects that combine private, public, and philanthropic capital within regulatory frameworks.',
    capacitiesLong: [
      'Project finance and construction management.',
      'Entitlement and regulatory navigation.',
      'Partnerships with community organizations and lenders.',
    ],
    challenges: [
      'Layered capital stacks increase complexity.',
      'Interest rate and construction cost volatility.',
      'Long lead times and policy/market risk.',
    ],
    deps: [
      { id: 'gov_supply', why: 'LIHTC/NMTC tools and permits.' },
      { id: 'banks_supply', why: 'Construction and permanent loans.' },
      { id: 'cdfi', why: 'Gap financing and acquisition loans.' },
      { id: 'prof_services', why: 'Legal, tax, and cost engineering.' },
    ],
  },
  {
    id: 'smb', seg: 'seek', fn: ['opportunity'],
    title: 'Small Businesses & Entrepreneurs', meta: 'Local jobs & wealth',
    keyFunction: 'Drive local economic development and wealth building.',
    descLong: 'SMEs create jobs and circulate wealth locally but often lack collateral and historic cashflows to access growth capital.',
    capacitiesLong: [
      'Proximity to customers and agility.',
      'Inclusive hiring and supplier potential.',
      'Digitization to formalize operations.',
    ],
    challenges: [
      'Collateral and credit history gaps.',
      'Business planning and financial management needs.',
      'Exposure to local shocks and cyclicality.',
    ],
    deps: [
      { id: 'cdfi', why: 'Flexible loans and TA.' },
      { id: 'banks_supply', why: 'Mainstream credit and treasury services.' },
      { id: 'ta_providers', why: 'Coaching on finance, operations, and sales.' },
    ],
  },
  {
    id: 'nonprofits', seg: 'seek', fn: ['opportunity'],
    title: 'Nonprofits (as capital users)', meta: 'Program delivery',
    keyFunction: 'Deploy grants/PRI-backed capital for mission outcomes.',
    descLong: 'Nonprofits implement services and infrastructure that markets alone may not support, using recoverable grants, PRIs, and specialized loans.',
    capacitiesLong: [
      'Program expertise and stakeholder relationships.',
      'Ability to absorb catalytic capital tied to outcomes.',
      'Data on beneficiary needs and results.',
    ],
    challenges: [
      'Restricted funding and limited reserves.',
      'Complex reporting across funders.',
      'Scaling successful pilots into durable operations.',
    ],
    deps: [
      { id: 'foundations', why: 'Program funding and PRIs.' },
      { id: 'gov_supply', why: 'Contracts and public programs.' },
      { id: 'impact_mm', why: 'Outcomes frameworks and learning.' },
      { id: 'ta_providers', why: 'Financial management and earned-revenue planning.' },
    ],
  },
  {
    id: 'ta_providers', seg: 'enab', fn: ['opportunity'],
    title: 'Technical Assistance Providers', meta: 'Investment readiness',
    keyFunction: 'Bridge the gap between capital supply and investment readiness.',
    descLong: 'Advisors, accelerators, and incubators help enterprises upgrade governance, financials, sales, and impact practices to meet investor requirements.',
    capacitiesLong: [
      'Specialized coaching and domain expertise.',
      'Network access to investors and partners.',
      'Tailored support pre- and post-investment.',
    ],
    challenges: [
      'Fragmented funding models for quality TA.',
      'Consistency and standards of delivery.',
      'Geographic reach outside major hubs.',
    ],
    deps: [
      { id: 'foundations', why: 'Grant funding for TA programs.' },
      { id: 'fund_managers', why: 'Sourcing cohorts and success metrics.' },
      { id: 'ecosystem_builders', why: 'Shared programming and referrals.' },
      { id: 'tech_platforms', why: 'Tools for diagnostics and tracking.' },
    ],
  },
  {
    id: 'ecosystem_builders', seg: 'enab', fn: ['opportunity', 'origination'],
    title: 'Ecosystem Builders & Networks', meta: 'Connectivity & advocacy',
    keyFunction: 'Create connective tissue and collective capacity.',
    descLong: 'Networks, associations, and conveners share knowledge, set norms, and advocate for enabling policy; they are multipliers for trust and coordination.',
    capacitiesLong: [
      'Relationship brokering and coalition-building.',
      'Knowledge aggregation and field guidance.',
      'Neutral convening across public/private/community actors.',
    ],
    challenges: [
      'Sustaining engagement and funding.',
      'Translating convenings into execution.',
      'Inclusive participation beyond usual suspects.',
    ],
    deps: [
      { id: 'inst_owners', why: 'Signal-setting and sponsorship.' },
      { id: 'gov_enab', why: 'Policy dialogues and programs.' },
      { id: 'ta_providers', why: 'Shared programming and pipelines.' },
      { id: 'policy', why: 'Evidence to inform rulemaking.' },
    ],
  },
  {
    id: 'prof_services', seg: 'enab', fn: ['execution'],
    title: 'Professional Services', meta: 'Specialized transaction expertise',
    keyFunction: 'Enable complex transactions with expertise.',
    descLong: 'Law, accounting, banking, evaluation and consulting providers reduce completion risk, ensure compliance, and strengthen governance and reporting.',
    capacitiesLong: [
      'Regulatory knowledge and technical opinions.',
      'Process efficiency and documentation quality.',
      'Independent assurance and evaluation.',
    ],
    challenges: [
      'Costs can exclude smaller deals and early-stage actors.',
      'Limited impact fluency among some providers.',
      'Capacity constraints during market upcycles.',
    ],
    deps: [
      { id: 'fund_managers', why: 'Repeat transactions and mandates.' },
      { id: 'inst_owners', why: 'Policy and governance expectations.' },
      { id: 'impact_mm', why: 'Assurance and evaluation methodologies.' },
      { id: 'intermediaries', why: 'Execution platforms and distribution.' },
    ],
  },
  {
    id: 'gov_enab', seg: 'enab', fn: ['execution', 'opportunity'],
    title: 'Government & Public Agencies (enablers)', meta: 'Incentives & programs',
    keyFunction: 'Provide credits, guarantees, and programs; shape enabling environment.',
    descLong: 'Agencies design and administer instruments that reduce risk and build markets, often partnering with CDFIs, banks, and fund managers to deliver capital.',
    capacitiesLong: [
      'Program design and regulatory enforcement.',
      'Targeting tools to reach underserved groups and places.',
      'Data access to guide and evaluate interventions.',
    ],
    challenges: [
      'Administrative load for applicants/awardees.',
      'Multi-year budget and authorization constraints.',
      'Inter-agency coordination and consistency.',
    ],
    deps: [
      { id: 'policy', why: 'Statutes, rules, and guidance.' },
      { id: 'cdfi', why: 'Local delivery capacity.' },
      { id: 'banks_supply', why: 'Credit channels and compliance.' },
      { id: 'fund_managers', why: 'Market adoption and scaling.' },
    ],
  },
  {
    id: 'fintech', seg: 'enab', fn: ['origination', 'execution'],
    title: 'Financial Services Technology', meta: 'Digital enablement',
    keyFunction: 'Improve and automate financial services delivery.',
    descLong: 'Fintech providers deliver rails for onboarding, KYC/AML, payments, custody, and portfolio/impact reporting—lowering transaction costs and expanding access.',
    capacitiesLong: [
      'Scalable infrastructure and APIs.',
      'Data management and transparency.',
      'User experience that broadens participation.',
    ],
    challenges: [
      'Integration into legacy systems.',
      'Security and privacy requirements.',
      'Adoption in low-resource contexts.',
    ],
    deps: [
      { id: 'intermediaries', why: 'Distribution and embedding.' },
      { id: 'tech_platforms', why: 'Data standards and interoperability.' },
      { id: 'impact_mm', why: 'Metrics capture and dashboards.' },
      { id: 'banks_supply', why: 'Core banking and payments.' },
    ],
  },
  {
    id: 'impact_mm', seg: 'infra', fn: ['execution', 'opportunity'],
    title: 'Impact Measurement & Management', meta: 'Standards & tracking',
    keyFunction: 'Enable accountability and performance management.',
    descLong: 'Shared standards, metrics sets, and assurance practices allow investors and enterprises to articulate, measure, and compare results while reducing reporting burden.',
    capacitiesLong: [
      'Common language for goals, indicators, and evidence.',
      'Performance tracking and learning systems.',
      'Third-party verification and data quality.',
    ],
    challenges: [
      'Cost and capacity burden for smaller actors.',
      'Attribution and counterfactual challenges.',
      'Fragmented standards without interoperability.',
    ],
    deps: [
      { id: 'fund_managers', why: 'Portfolio data and performance targets.' },
      { id: 'social_enterprises', why: 'Enterprise-level outcomes data.' },
      { id: 'dfi', why: 'Safeguards and disclosure alignment.' },
      { id: 'tech_platforms', why: 'Data capture and dashboards.' },
    ],
  },
  {
    id: 'policy', seg: 'infra', fn: ['execution', 'origination'],
    title: 'Policy & Regulatory Framework', meta: 'Market-shaping rules & incentives',
    keyFunction: 'Create enabling environment for impact investing.',
    descLong: 'Tax incentives, disclosure rules, and market regulations shape the viability, cost, and speed of impact transactions across sectors and geographies.',
    capacitiesLong: [
      'Incentives that crowd in private capital.',
      'Legal frameworks that protect stakeholders and ensure market integrity.',
      'Clarity that reduces risk and attracts long-term investment.',
    ],
    challenges: [
      'Political cycles and reauthorization risk.',
      'Complexity that can deter smaller participants.',
      'Potential unintended consequences requiring iteration.',
    ],
    deps: [
      { id: 'gov_supply', why: 'Legislative authority and program funding.' },
      { id: 'banks_supply', why: 'Prudential rules and community reinvestment.' },
      { id: 'cdfi', why: 'Certification and deployment channels.' },
      { id: 'fund_managers', why: 'Disclosure and reporting compliance.' },
    ],
  },
  {
    id: 'tech_platforms', seg: 'infra', fn: ['execution', 'origination', 'opportunity'],
    title: 'Technology Platforms', meta: 'Digital rails & transparency',
    keyFunction: 'Enable efficient capital deployment and management.',
    descLong: 'Investment, data, and communications systems connect participants, lower cost-to-serve, and make performance and impact more transparent.',
    capacitiesLong: [
      'Transaction efficiency and straight-through processing.',
      'Data integration and governance for decision-making.',
      'Scalability to support ecosystem growth.',
    ],
    challenges: [
      'Vendor lock-in and interoperability gaps.',
      'Cybersecurity and privacy risks.',
      'Change management in low-tech environments.',
    ],
    deps: [
      { id: 'intermediaries', why: 'Distribution and orchestration.' },
      { id: 'impact_mm', why: 'Standards-aligned data models.' },
      { id: 'banks_supply', why: 'Payments and compliance rails.' },
      { id: 'fund_managers', why: 'Portfolio systems and LP reporting.' },
    ],
  },
];

export const GLOSSARY: GlossaryGroup[] = [
  {
    group: 'Investment Tools',
    items: [
      { term: 'Equity', def: 'Ownership capital with upside through dividends or capital gains; patient but higher-risk.' },
      { term: 'Debt', def: 'Loans/bonds requiring repayment with interest; preserves ownership but affects cash flow.' },
      { term: 'Guarantee', def: 'Third-party promise to absorb losses on default, de-risking lenders and unlocking credit.' },
    ],
  },
  {
    group: 'Asset Classes',
    items: [
      { term: 'Bonds (incl. Green/Social)', def: 'Debt securities, including labeled bonds whose proceeds fund environmental or social projects.' },
      { term: 'Stocks', def: 'Equity ownership in companies; traded on exchanges.' },
      { term: 'Real Assets', def: 'Physical assets like real estate and infrastructure.' },
      { term: 'Commodities', def: 'Tradable raw materials such as cocoa, gold, oil.' },
      { term: 'Money Market & Cash', def: 'Short-term instruments for liquidity.' },
      { term: 'Crypto/Digital Assets', def: 'Digitally-native assets on blockchains.' },
    ],
  },
  {
    group: 'Financial Markets',
    items: [
      { term: 'Banking', def: 'A network of financial institutions that take deposits and lend money, providing a range of financial services and acting as a conduit of capital to businesses.' },
      { term: 'Investment Services', def: 'Specialists and firms that advise clients on financial products, planning and fund-raising, including the policies, rules and standards that apply to these activities.' },
    ],
  },
  {
    group: 'Investment Services',
    items: [
      { term: 'Investment Fund Managers', def: 'Professionals who construct and manage diversified investment portfolios on behalf of clients or sponsors.' },
      { term: 'Financial Advisors', def: 'Advisors who provide financial guidance and planning services to individuals and organizations.' },
      { term: 'Investment Consultants', def: 'Consultants who formulate investment strategies and planning for their clients.' },
      { term: 'Proxy Voting Agencies', def: 'Specialized firms that advise on and execute shareholder votes for fund managers.' },
    ],
  },
  {
    group: 'Fintech & Platforms',
    items: [
      { term: 'Financial Technology', def: 'Technology, software and algorithms that improve and automate the delivery and use of financial services.' },
      { term: 'Online Investment Platforms', def: 'Digital platforms that allow individuals to buy, sell and hold investments through a single online account.' },
      { term: 'Crowdfunding Platforms', def: 'Internet-based platforms that raise small amounts of money from a large number of people to fund projects or ventures.' },
    ],
  },
  {
    group: 'Investment Vehicles',
    items: [
      { term: 'Debt Funds', def: 'Funds investing in fixed-income securities like bonds and treasury bills, offering relatively steady income.' },
      { term: 'Private Equity', def: 'Investments made in private companies either directly or through specialized funds.' },
      { term: 'Venture Capital Funds', def: 'Funds that finance start-up companies and businesses in high-growth sectors.' },
      { term: 'Exchange Traded Funds & Notes', def: 'Marketable securities that track an index, commodity or basket of assets and trade like stocks.' },
      { term: 'Mutual Funds & Investment Trusts', def: 'Collective investment schemes that pool money from investors to purchase diversified securities.' },
      { term: 'Pooled Funds', def: 'Investment structures where multiple investors combine capital to benefit from diversification and economies of scale.' },
    ],
  },
];

export interface StrategyCategory {
  key: string;
  title: string;
  color: string;
  guidedBy: string;
  items: {
    title: string;
    description: string;
    example?: string;
  }[];
}

export const STRATEGY_CATEGORIES: StrategyCategory[] = [
  {
    key: 'responsible',
    title: 'Responsible Investing',
    color: '#53c3c2',
    guidedBy: 'Environmental, Social, and Governance (ESG) criteria guide decisions.',
    items: [
      {
        title: 'Divesting and Negative ESG Screening',
        description: 'Selling or screening out stocks that are not ESG-aligned or are detrimental to the asset holder\'s mission or purpose. This usually encompasses the entire portfolio.',
        example: 'A health conversion foundation instructs its investment manager to "screen out" alcohol, tobacco, and firearm stocks because of adverse health impacts.',
      },
      {
        title: 'Activist Investing (Shareholder Activism)',
        description: 'Buying stock in publicly traded companies to become a shareholder "activist" and promote an agenda aligned with the foundation\'s mission.',
        example: 'A foundation buys stock in a company to promote better workplace practices or conditions through shareholder advocacy.',
      },
    ],
  },
  {
    key: 'values',
    title: 'Values-Aligned Investing',
    color: '#4750a2',
    guidedBy: 'Mission, Purpose, and Founding Charter criteria guide decisions.',
    items: [
      {
        title: 'ESG Inclusion Investing',
        description: 'Buying stocks in companies that are highly aligned with ESG factors or values.',
        example: 'A foundation buys stock in a publicly traded company with diverse executive leadership and governing bodies, or a company with strong sustainability or environmental stewardship practices.',
      },
      {
        title: 'Thematic Impact Investing',
        description: 'Using a particular "thematic lens" to invest across asset classes and return profiles to advance a targeted impact area like environment, health, or education. Investment firms increasingly offer these kinds of impact funds.',
        example: 'A foundation or DAF platform creates a clean energy investment pool, which fundholders can elect to direct a percentage of assets to.',
      },
    ],
  },
  {
    key: 'impact_first',
    title: 'Impact-First Investing',
    color: '#149a49',
    guidedBy: '',
    items: [
      {
        title: 'Catalytic Impact Investing',
        description: 'Catalytic investments take on greater risk, more flexible terms, more patient timelines, and impact-adjusted financial returns. They accept higher risk than traditional investments, provide flexibility for the investee\'s needs, give a capital runway for adaptation, and allow lower financial returns to ensure higher social impact returns.',
      },
      {
        title: 'Place-Based Impact Investing',
        description: 'Investing in local companies, organizations, or funds with the intention to generate measurable community benefit and financial returns.',
        example: 'A foundation seeds a new microlender to invest in local small businesses, or makes a bridge loan to a nonprofit awaiting government reimbursement.',
      },
    ],
  },
];

export const STRATEGY_PROGRESSION = 'The three categories form a progression. Responsible Investing focuses on avoiding harm and shaping company behavior. Values-Aligned Investing actively selects companies and themes that match what the foundation stands for. Impact-First Investing prioritizes measurable community outcomes, with capital structured to support the investee rather than to maximize returns. Each foundation can pick where to start and grow into deeper alignment over time.';

export const STRATEGIES: Strategy[] = [
  {
    key: 'divesting',
    title: 'Divesting (Exclusions) + Reallocation',
    longDesc: 'Exclude sectors or issuers misaligned with mission and reallocate to aligned assets. Common in endowments, foundations, faith investors, and HNW portfolios.',
    stakeholders: ['inst_owners', 'fund_managers', 'intermediaries', 'policy', 'prof_services'],
    cases: [
      {
        title: 'University endowment excludes fossil fuels and reallocates',
        steps: [
          'Board updates Investment Policy Statement with exclusions, timeline, and monitoring.',
          'OCIO and managers implement screens and transition portfolios with tracking-error controls.',
          'Reallocate a portion to climate solutions (thematic funds/ETFs) and green/social bonds.',
          'Publish stewardship report and decarbonization KPIs.',
        ],
        instruments: ['Exclusions policy', 'Screened public equity', 'Green/Social bonds', 'Thematic equity funds'],
        stakeholders: ['inst_owners', 'fund_managers', 'intermediaries', 'impact_mm'],
      },
    ],
  },
  {
    key: 'esg',
    title: 'ESG Integration & Stewardship',
    longDesc: 'Systematically consider financially material ESG risks/opportunities and use ownership rights (voting, engagement, escalation) to protect and enhance long-term value.',
    stakeholders: ['inst_owners', 'fund_managers', 'prof_services', 'impact_mm', 'intermediaries'],
    cases: [
      {
        title: 'Listed equities: active ownership on worker safety',
        steps: [
          'Set stewardship priorities and company-level KPIs.',
          'Engage; file/support shareholder proposals where needed.',
          'Vote proxies aligned to stewardship goals; escalate if progress stalls.',
          'Report outcomes to LPs with KPI movement.',
        ],
        instruments: ['ESG integration', 'Stewardship & engagement', 'Proxy voting'],
        stakeholders: ['fund_managers', 'impact_mm', 'prof_services'],
      },
    ],
  },
  {
    key: 'thematic',
    title: 'Thematic Impact Investing',
    longDesc: 'Proactively invest for measurable solutions in a chosen theme (e.g., climate/energy transition, health equity, inclusive entrepreneurship, gender).',
    stakeholders: ['inst_owners', 'fund_managers', 'banks_supply', 'prof_services', 'tech_platforms'],
    cases: [
      {
        title: 'Climate: distributed solar fund using ITC & PPAs',
        steps: [
          'Commit to specialist solar/infra fund targeting C&I/municipal rooftops.',
          'Fund structures tax equity (ITC) partnerships; secures PPAs with offtakers.',
          'Project-level senior debt closes; construction proceeds.',
          'Track generation, avoided emissions, and community benefits.',
        ],
        instruments: ['Tax equity (ITC)', 'Senior project debt', 'PPAs'],
        stakeholders: ['inst_owners', 'fund_managers', 'banks_supply', 'prof_services'],
      },
    ],
  },
  {
    key: 'place_based',
    title: 'Place-Based Impact Investing',
    longDesc: 'Deploy blended capital into a defined geography, aligning public programs, community lenders, banks, developers, and foundations.',
    stakeholders: ['foundations', 'cdfi', 'banks_supply', 'community_orgs', 'real_estate', 'gov_supply', 'ecosystem_builders', 'ta_providers', 'impact_mm'],
    cases: [
      {
        title: 'Affordable housing via LIHTC',
        steps: [
          'Developer secures LIHTC allocation; syndicator organizes equity.',
          'Bank provides construction/permanent loans.',
          'CDFI provides subordinate/community debt; foundation supports pre-development.',
          'Project delivers restricted affordable units; compliance/reporting ongoing.',
        ],
        instruments: ['LIHTC equity', 'Senior bank debt', 'Subordinate/CDFI debt', 'Guarantees/PRIs'],
        stakeholders: ['real_estate', 'community_orgs', 'banks_supply', 'cdfi', 'foundations', 'policy', 'prof_services'],
      },
      {
        title: 'Inclusive SMB growth via CDFI fund',
        steps: [
          'Anchor investors seed loan fund; bank participates (often for CRA).',
          'TA providers prepare borrowers; blended LLR de-risks lending.',
          'Graduation pathway to bank credit over time.',
        ],
        instruments: ['CDFI notes', 'Loan loss reserve/guarantee', 'TA grants'],
        stakeholders: ['cdfi', 'banks_supply', 'inst_owners', 'ta_providers', 'community_orgs', 'gov_supply'],
      },
    ],
  },
];

export function getNodeById(id: string): FrameworkNode | undefined {
  return FRAMEWORK_NODES.find((n) => n.id === id);
}

export function getSegment(key: string): FrameworkSegment | undefined {
  return FRAMEWORK_SEGMENTS.find((s) => s.key === key);
}
