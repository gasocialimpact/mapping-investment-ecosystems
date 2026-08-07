import { useState, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, X, ArrowRight,
  Zap, AlertTriangle, Link2, Layers, BookOpen,
} from 'lucide-react';
import {
  FRAMEWORK_FUNCTIONS,
  GLOSSARY, STRATEGY_CATEGORIES, STRATEGY_PROGRESSION, STRATEGIES, getNodeById, getSegment,
} from '../data/frameworkData';
import type { FrameworkNode, StrategyCategory, Strategy } from '../data/frameworkData';

type SubView = 'glossary' | 'strategies';

export function FrameworkTab() {
  const [subView, setSubView] = useState<SubView>('glossary');
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {(['glossary', 'strategies'] as SubView[]).map((v) => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
              subView === v
                ? 'bg-brand-indigo text-white border-brand-indigo'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {v === 'glossary' ? 'Glossary' : 'Investment Strategies'}
          </button>
        ))}

        <div className="relative ml-auto min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={subView === 'glossary' ? 'Search terms...' : 'Search strategies...'}
            className="w-full text-sm border border-slate-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {subView === 'glossary' && <GlossaryView search={search} />}
      {subView === 'strategies' && <StrategiesView search={search} />}
    </div>
  );
}

// Inline card describing a stakeholder type — rendered between the framework
// grid and the records panel on Framing Our Ecosystem.
export function NodeDetailCard({ node, onNavigate }: { node: FrameworkNode; onNavigate: (n: FrameworkNode) => void }) {
  const seg = getSegment(node.seg);
  const fnLabels = FRAMEWORK_FUNCTIONS.filter((f) => node.fn.includes(f.key)).map((f) => f.label);

  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ borderLeft: `4px solid ${seg?.color ?? '#4750a2'}` }}>
        <div className="border-b border-slate-100 px-5 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: seg?.color }}>
            {seg?.label}
          </span>
          <h2 className="text-lg font-bold text-slate-800">{node.title}</h2>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {fnLabels.map((l) => (
              <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-indigo-soft text-brand-indigo font-medium">{l}</span>
            ))}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              <Zap size={12} /> Key Function
            </div>
            <p className="text-sm text-slate-700">{node.keyFunction}</p>
          </div>

          <p className="text-sm text-slate-600">{node.descLong}</p>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Layers size={12} /> Capacities
            </div>
            <ul className="space-y-1">
              {node.capacitiesLong.map((c, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-brand-green mt-1 shrink-0">+</span> {c}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <AlertTriangle size={12} /> Challenges
            </div>
            <ul className="space-y-1">
              {node.challenges.map((c, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-brand-orange mt-1 shrink-0">!</span> {c}
                </li>
              ))}
            </ul>
          </div>

          {node.deps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <Link2 size={12} /> Dependencies
              </div>
              <div className="space-y-1.5">
                {node.deps.map((d) => {
                  const target = getNodeById(d.id);
                  const targetSeg = target ? getSegment(target.seg) : null;
                  return (
                    <button
                      key={d.id}
                      onClick={() => target && onNavigate(target)}
                      className="w-full flex items-center gap-2 text-left text-sm border border-dashed border-brand-teal-soft rounded-md px-3 py-2 hover:bg-brand-teal-soft/20 transition-colors"
                    >
                      {targetSeg && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: targetSeg.color }} />}
                      <span className="font-medium text-slate-700">{target?.title ?? d.id}</span>
                      <ArrowRight size={12} className="text-slate-300 shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{d.why}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {node.subcats && node.subcats.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sub-categories</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {node.subcats.map((sc) => (
                  <div key={sc.title} className="border border-slate-100 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-slate-800">{sc.title}</h4>
                    <p className="text-[10px] text-slate-400 mb-2">{sc.mini}</p>
                    <ul className="space-y-0.5">
                      {sc.bullets.map((b, i) => (
                        <li key={i} className="text-[11px] text-slate-600">- {b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function GlossaryView({ search }: { search: string }) {
  const q = search.toLowerCase().trim();

  const filteredGroups = useMemo(() => {
    if (!q) return GLOSSARY;
    return GLOSSARY.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.term.toLowerCase().includes(q) || i.def.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set(GLOSSARY.map((g) => g.group)));

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={14} className="text-brand-indigo" />
          <h3 className="text-sm font-semibold text-slate-700">Investment Terminology Glossary</h3>
        </div>
        <p className="text-xs text-slate-500">Key terms and definitions for navigating the impact investing ecosystem.</p>
      </div>

      {filteredGroups.map((g) => (
        <div key={g.group} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded((prev) => {
              const next = new Set(prev);
              next.has(g.group) ? next.delete(g.group) : next.add(g.group);
              return next;
            })}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-700">{g.group}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{g.items.length} term{g.items.length !== 1 ? 's' : ''}</span>
              {expanded.has(g.group) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </div>
          </button>
          {expanded.has(g.group) && (
            <div className="border-t border-slate-100">
              {g.items.map((item) => (
                <div key={item.term} className="px-4 py-3 border-b border-slate-50 last:border-b-0">
                  <dt className="text-sm font-semibold text-slate-800">{item.term}</dt>
                  <dd className="text-sm text-slate-600 mt-0.5">{item.def}</dd>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filteredGroups.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No terms match your search.</p>
      )}
    </div>
  );
}

function StrategiesView({ search }: { search: string }) {
  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!q) return STRATEGY_CATEGORIES;
    return STRATEGY_CATEGORIES.filter((cat) =>
      cat.title.toLowerCase().includes(q) ||
      cat.items.some((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)),
    );
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Impact Investing Strategies</h3>
        <p className="text-xs text-slate-500">
          Not all impact investing looks the same. The strategies below show how foundation leaders can think about the spectrum, organized by three core approaches and the criteria that guide investment decisions in each.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((cat) => (
          <StrategyCategoryCard key={cat.key} category={cat} />
        ))}
      </div>

      {filtered.length >= 2 && (
        <div className="flex gap-0 rounded-lg overflow-hidden border border-slate-200">
          <div className="flex-1 px-4 py-3 bg-slate-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Guided By</p>
            <p className="text-xs text-slate-600">Environmental, Social, and Governance (ESG) criteria guide decisions.</p>
          </div>
          <div className="flex-[1.2] px-4 py-3 bg-slate-50 border-l border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Guided By</p>
            <p className="text-xs text-slate-600">Mission, Purpose, and Founding Charter criteria guide decisions.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Reading the Strategies</h3>
        <p className="text-xs text-slate-600">{STRATEGY_PROGRESSION}</p>
      </div>

      {STRATEGIES.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Strategy Examples & Case Studies</h3>
          <div className="space-y-3">
            {STRATEGIES.map((strategy) => (
              <StrategyExampleCard key={strategy.key} strategy={strategy} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StrategyCategoryCard({ category }: { category: StrategyCategory }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 font-bold text-white text-sm" style={{ background: category.color }}>
        {category.title}
      </div>
      <div className="p-4 space-y-4">
        {category.items.map((item) => (
          <div key={item.title}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h4>
            <p className="text-xs text-slate-600">{item.description}</p>
            {item.example && (
              <div className="mt-2 text-xs text-slate-500 border-l-2 pl-3" style={{ borderColor: category.color }}>
                <span className="font-bold uppercase text-[10px]" style={{ color: category.color }}>Example </span>
                {item.example}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyExampleCard({ strategy }: { strategy: Strategy }) {
  const [isOpen, setIsOpen] = useState(false);
  const stakeholders = strategy.stakeholders.map((id) => getNodeById(id)).filter(Boolean);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{strategy.title}</h3>
          {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
        <p className="text-xs text-slate-600 mt-1">{strategy.longDesc}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {stakeholders.map((s) => {
            if (!s) return null;
            const seg = getSegment(s.seg);
            return (
              <span
                key={s.id}
                className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                style={{ borderColor: seg?.color, color: seg?.color }}
              >
                {s.title}
              </span>
            );
          })}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {strategy.cases.map((c, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">{c.title}</h4>
              <ol className="space-y-1.5 mb-3">
                {c.steps.map((step, si) => (
                  <li key={si} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-brand-indigo font-bold shrink-0">{si + 1}.</span> {step}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-1.5">
                {c.instruments.map((inst) => (
                  <span key={inst} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green-soft text-brand-green font-medium">
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
