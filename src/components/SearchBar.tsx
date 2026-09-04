import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Building2, MapPin } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useDetail } from '../context/DetailContext';
import { SEGMENT_STYLES } from '../types';

// Header search: organizations (by name, IRS legal name, EIN, city, type) and
// places (cities / counties). Selecting a result opens its record modal, so a
// reader can reach any organization without first navigating to its county.

const MAX_RESULTS = 8;

type Result =
  | { kind: 'organization'; id: string; label: string; sub: string; color: string }
  | { kind: 'location'; id: string; label: string; sub: string };

const fold = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function SearchBar() {
  const { data } = useData();
  const { open } = useDetail();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Precompute a searchable haystack per record once per data load.
  const index = useMemo(() => {
    if (!data) return { orgs: [], locs: [] };
    const orgs = data.organizations.map((o) => ({
      o,
      name: fold(o.name),
      hay: fold([o.name, o.irs?.legalName, o.city, o.orgType, o.segment, o.ein, o.irs?.ntee].filter(Boolean).join(' ')),
      ein: o.ein ?? '',
    }));
    const locs = data.locations.map((l) => ({
      l,
      name: fold(l.cityName),
      hay: fold([l.cityName, l.countyName, l.stateId, l.fipsCode].filter(Boolean).join(' ')),
    }));
    return { orgs, locs };
  }, [data]);

  const results = useMemo<Result[]>(() => {
    const q = fold(query);
    const qDigits = query.replace(/\D/g, '');
    if (q.length < 2 && qDigits.length < 3) return [];
    const terms = q.split(' ').filter(Boolean);

    const scored: { score: number; r: Result }[] = [];
    for (const { o, name, hay, ein } of index.orgs) {
      let score = 0;
      if (qDigits.length >= 3 && ein.includes(qDigits)) score = 90;
      else if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (terms.length && terms.every((t) => hay.includes(t))) score = 40;
      if (!score) continue;
      const style = SEGMENT_STYLES[o.segment] ?? SEGMENT_STYLES.Uncategorized;
      scored.push({
        score,
        r: {
          kind: 'organization',
          id: o.id,
          label: o.name,
          sub: [o.orgType, [o.city, o.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
          color: style.color,
        },
      });
    }
    for (const { l, name, hay } of index.locs) {
      let score = 0;
      if (name === q) score = 70;
      else if (name.startsWith(q)) score = 50;
      else if (terms.length && terms.every((t) => hay.includes(t))) score = 30;
      if (!score) continue;
      scored.push({
        score,
        r: {
          kind: 'location',
          id: l.id,
          label: [l.cityName, l.stateId].filter(Boolean).join(', '),
          sub: [l.countyName && `${l.countyName} County`, `${l.organizationIds.length} organizations`].filter(Boolean).join(' · '),
        },
      });
    }
    scored.sort((a, b) => b.score - a.score || a.r.label.localeCompare(b.r.label));
    return scored.slice(0, MAX_RESULTS).map((s) => s.r);
  }, [query, index]);

  useEffect(() => setActive(0), [query]);

  // Close on outside click.
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [focused]);

  const select = (r: Result) => {
    const siblings = results.filter((x) => x.kind === r.kind).map((x) => x.id);
    open(r.kind, r.id, siblings);
    setFocused(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === 'Escape') {
      if (query) setQuery('');
      else inputRef.current?.blur();
      setFocused(false);
    }
  };

  const showList = focused && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full sm:w-72 md:w-80">
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-brand-indigo focus-within:ring-2 focus-within:ring-brand-indigo/20">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search organizations and places"
          aria-expanded={showList}
          aria-controls="global-search-results"
          aria-activedescendant={showList && results[active] ? `search-opt-${active}` : undefined}
          placeholder="Search organizations, EINs, places…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg py-1"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">No matches for “{query}”.</li>
          )}
          {results.map((r, i) => (
            <li
              key={`${r.kind}:${r.id}`}
              id={`search-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(r)}
              className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-xs ${
                i === active ? 'bg-slate-50' : ''
              }`}
            >
              {r.kind === 'organization' ? (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              ) : (
                <MapPin size={12} className="text-slate-400 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800 font-medium">{r.label}</span>
                {r.sub && <span className="block truncate text-[10px] text-slate-400">{r.sub}</span>}
              </span>
              {r.kind === 'organization' && <Building2 size={12} className="text-slate-300 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
