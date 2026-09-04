import { useMemo, useState } from 'react';
import type { Organization } from '../../types';
import { V2_SEGMENTS, SUB_EXAMPLES, subExampleFor, segmentKeyFor } from '../../data/frameworkV2';
import { useDetail } from '../../context/DetailContext';

// The framework-off view: organization type cards down the left, and a
// large searchable, sortable list on the right that readers page through
// themselves. Selecting a card narrows the list; search and sort apply on
// top of that.

type Pick = { kind: 'all' } | { kind: 'card'; id: string } | { kind: 'segment'; key: string } | { kind: 'untagged'; key: string } | { kind: 'uncategorized' };
type SortKey = 'name' | 'city' | 'segment' | 'type';
const PAGE = 60;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City' },
  { key: 'segment', label: 'Segment' },
  { key: 'type', label: 'Org. Type' },
];

const cmp = (a: string | null | undefined, b: string | null | undefined) => {
  // Blanks sort last regardless of direction.
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
};

export function OrgDirectory({ orgs }: { orgs: Organization[] }) {
  const { open } = useDetail();
  const [pick, setPick] = useState<Pick>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [desc, setDesc] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Roll-up once per data change.
  const { byCard, bySeg, untagged, uncategorized } = useMemo(() => {
    const byCard = new Map<string, Organization[]>();
    const bySeg = new Map<string, Organization[]>();
    const untagged = new Map<string, Organization[]>();
    const uncategorized: Organization[] = [];
    for (const o of orgs) {
      const seg = segmentKeyFor(o);
      if (!seg) { uncategorized.push(o); continue; }
      (bySeg.get(seg) ?? bySeg.set(seg, []).get(seg)!).push(o);
      const card = subExampleFor(o);
      if (card) (byCard.get(card.id) ?? byCard.set(card.id, []).get(card.id)!).push(o);
      else (untagged.get(seg) ?? untagged.set(seg, []).get(seg)!).push(o);
    }
    return { byCard, bySeg, untagged, uncategorized };
  }, [orgs]);

  const scoped = useMemo(() => {
    switch (pick.kind) {
      case 'all': return orgs;
      case 'card': return byCard.get(pick.id) ?? [];
      case 'segment': return bySeg.get(pick.key) ?? [];
      case 'untagged': return untagged.get(pick.key) ?? [];
      case 'uncategorized': return uncategorized;
    }
  }, [pick, orgs, byCard, bySeg, untagged, uncategorized]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? scoped.filter((o) =>
          o.name.toLowerCase().includes(q) ||
          (o.city ?? '').toLowerCase().includes(q) ||
          (o.orgType ?? '').toLowerCase().includes(q) ||
          (o.ein ?? '').replace('-', '').includes(q.replace('-', '')))
      : scoped;
    const sorted = [...filtered].sort((a, b) => {
      let r = 0;
      if (sort === 'name') r = cmp(a.name, b.name);
      else if (sort === 'city') r = cmp(a.city, b.city) || cmp(a.state, b.state) || cmp(a.name, b.name);
      else if (sort === 'segment') r = cmp(a.segment, b.segment) || cmp(a.name, b.name);
      else r = cmp(a.orgType, b.orgType) || cmp(a.name, b.name);
      return desc ? -r : r;
    });
    return sorted;
  }, [scoped, query, sort, desc]);

  const visible = rows.slice(0, limit);
  const ids = useMemo(() => rows.map((o) => o.id), [rows]);

  const choose = (p: Pick) => { setPick(p); setLimit(PAGE); };
  const same = (p: Pick) => JSON.stringify(p) === JSON.stringify(pick);
  const scopeTitle =
    pick.kind === 'all' ? 'All organizations'
    : pick.kind === 'card' ? SUB_EXAMPLES.find((c) => c.id === pick.id)?.title ?? ''
    : pick.kind === 'segment' ? V2_SEGMENTS.find((s) => s.key === pick.key)?.label ?? ''
    : pick.kind === 'untagged' ? `${V2_SEGMENTS.find((s) => s.key === pick.key)?.short} · not yet tagged`
    : 'Uncategorized';

  const segColor = (o: Organization) => V2_SEGMENTS.find((s) => s.data === o.segment)?.color ?? '#94a3b8';

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
      {/* Left: organization type cards */}
      <aside className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <button
          onClick={() => choose({ kind: 'all' })}
          className={`w-full flex items-center justify-between text-sm font-semibold rounded-md px-3 py-2 border ${same({ kind: 'all' }) ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'}`}
        >
          <span>All organizations</span>
          <span className="text-xs font-bold tabular-nums">{orgs.length}</span>
        </button>

        {V2_SEGMENTS.filter((s) => s.data).map((s) => {
          const segList = bySeg.get(s.key) ?? [];
          const un = untagged.get(s.key) ?? [];
          return (
            <section key={s.key}>
              <button
                onClick={() => choose({ kind: 'segment', key: s.key })}
                className={`w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5 border ${same({ kind: 'segment', key: s.key }) ? 'text-white border-transparent' : 'border-transparent hover:bg-slate-50'}`}
                style={same({ kind: 'segment', key: s.key }) ? { background: s.color } : undefined}
              >
                <span className="w-2 h-5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="text-[13px] font-bold leading-tight">{s.label}</span>
                <span className="ml-auto text-xs font-bold tabular-nums opacity-80">{segList.length}</span>
              </button>
              <ul className="mt-1 space-y-0.5 pl-2">
                {SUB_EXAMPLES.filter((c) => c.seg === s.key).map((c) => {
                  const n = byCard.get(c.id)?.length ?? 0;
                  const on = same({ kind: 'card', id: c.id });
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => choose({ kind: 'card', id: c.id })}
                        disabled={n === 0}
                        className={`w-full flex items-center gap-2 text-left text-xs rounded px-2 py-1 border transition-colors ${on ? 'border-slate-300 bg-slate-50 text-slate-900 font-semibold' : n ? 'border-transparent text-slate-600 hover:bg-slate-50' : 'border-transparent text-slate-300 cursor-default'}`}
                      >
                        <span className="truncate">{c.title}</span>
                        <span className="ml-auto tabular-nums shrink-0">{n}</span>
                      </button>
                    </li>
                  );
                })}
                {un.length > 0 && (
                  <li>
                    <button
                      onClick={() => choose({ kind: 'untagged', key: s.key })}
                      className={`w-full flex items-center gap-2 text-left text-xs rounded px-2 py-1 border border-dashed ${same({ kind: 'untagged', key: s.key }) ? 'border-slate-300 bg-slate-50 text-slate-900 font-semibold' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                      <span>Not yet tagged</span>
                      <span className="ml-auto tabular-nums">{un.length}</span>
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <button
            onClick={() => choose({ kind: 'uncategorized' })}
            className={`w-full flex items-center justify-between text-xs rounded-md px-3 py-1.5 border border-dashed ${same({ kind: 'uncategorized' }) ? 'border-slate-300 bg-slate-50 text-slate-900 font-semibold' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
          >
            <span>Uncategorized</span>
            <span className="tabular-nums">{uncategorized.length}</span>
          </button>
        )}
      </aside>

      {/* Right: searchable, sortable list */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mr-2">{scopeTitle}</h3>
          <span className="text-xs text-slate-400 tabular-nums">{rows.length} of {scoped.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
              placeholder="Search name, city, type, EIN…"
              aria-label="Search this list"
              className="text-sm border border-slate-200 rounded-md px-3 py-1.5 w-56 focus:outline-none focus:border-brand-indigo"
            />
            <label className="text-xs text-slate-500 flex items-center gap-1">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by" className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <button
              onClick={() => setDesc(!desc)}
              aria-label={desc ? 'Sorted descending; switch to ascending' : 'Sorted ascending; switch to descending'}
              title={desc ? 'Z → A' : 'A → Z'}
              className="text-xs font-semibold border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 hover:border-slate-300 w-14"
            >
              {desc ? 'Z → A' : 'A → Z'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                {SORTS.map((s) => (
                  <th key={s.key} className="px-4 py-2 font-semibold">
                    <button onClick={() => { if (sort === s.key) setDesc(!desc); else { setSort(s.key); setDesc(false); } }} className={`hover:text-slate-700 ${sort === s.key ? 'text-slate-800' : ''}`}>
                      {s.label}{sort === s.key ? (desc ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => open('organization', o.id, ids)}
                  onKeyDown={(e) => { if (e.key === 'Enter') open('organization', o.id, ids); }}
                  tabIndex={0}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-slate-50"
                >
                  <td className="px-4 py-2 font-medium text-slate-800">
                    <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: segColor(o) }} />
                    {o.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{o.city ? `${o.city}${o.state && o.state !== 'GA' && o.state !== '-' ? `, ${o.state}` : ''}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{o.segment.replace('Capital ', '')}</td>
                  <td className="px-4 py-2 text-slate-500">{o.orgType ?? <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No organizations match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > limit && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
            <button onClick={() => setLimit(limit + PAGE)} className="text-xs font-semibold text-brand-indigo hover:underline">Show {Math.min(PAGE, rows.length - limit)} more</button>
            <button onClick={() => setLimit(rows.length)} className="text-xs text-slate-400 hover:text-slate-600">Show all {rows.length}</button>
          </div>
        )}
      </div>
    </div>
  );
}
