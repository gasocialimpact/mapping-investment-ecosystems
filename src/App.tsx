import { useState } from 'react';
import { Map, TrendingUp, Network, BookOpen, RotateCcw } from 'lucide-react';
import type { Tab } from './types';
import { DataProvider, useData } from './context/DataContext';
import { PlaceProvider, usePlace } from './context/PlaceContext';
import { DetailProvider } from './context/DetailContext';
import { useVisibleBand } from './lib/useVisibleBand';
import { DetailDrawer } from './components/detail/DetailDrawer';
import { ExploreTab } from './components/explore/ExploreTab';
import { SavePdfButton } from './components/SavePdfButton';
import { CapitalTab } from './components/capital/CapitalTab';
import { FramingTab } from './components/FramingTab';
import { FrameworkTab } from './components/FrameworkTab';

const TABS: { id: Tab; label: string; icon: typeof Map }[] = [
  { id: 'explore', label: 'Explore', icon: Map },
  { id: 'capital', label: 'Tracking Capital Changes Over Time', icon: TrendingUp },
  { id: 'framing', label: 'Framing Our Ecosystem', icon: Network },
  { id: 'glossary', label: 'Glossary & Key Terms', icon: BookOpen },
];

export default function App() {
  return (
    <DataProvider>
      <PlaceProvider>
        <DetailProvider>
          <Dashboard />
          <DetailDrawer />
        </DetailProvider>
      </PlaceProvider>
    </DataProvider>
  );
}

// Below this the app is too cramped to be worth reflowing into, so it stops
// tracking the window and simply scrolls out of view with the rest of the page.
const MIN_SHELL_HEIGHT = 420;

function Dashboard() {
  const { data, error } = useData();
  const { setSelectedFips } = usePlace();
  const [activeTab, setActiveTab] = useState<Tab>('explore');
  const band = useVisibleBand();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-lg border border-red-200 p-6 max-w-md text-center shadow-sm">
          <p className="text-red-600 font-semibold">Could not load data</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading ecosystem data...
      </div>
    );
  }

  // Fit the app to what the reader can actually see. Standalone this is the
  // whole viewport; embedded in an iframe taller than the browser window it
  // keeps the header, tabs and scroll area inside the on-screen slice instead
  // of stranding them above it.
  const shellHeight = Math.min(band.frameHeight, Math.max(band.height, MIN_SHELL_HEIGHT));
  const shellTop = Math.max(
    0,
    Math.min(band.top + (band.height - shellHeight) / 2, band.frameHeight - shellHeight),
  );

  return (
    <div
      className="app-shell flex flex-col overflow-hidden bg-white print-unclip"
      style={{ position: 'fixed', top: shellTop, left: 0, right: 0, height: shellHeight }}
    >
      <header className="bg-white border-b border-slate-200 shrink-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-[14px] flex items-center justify-between gap-[14px] flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg shrink-0" style={{ background: 'conic-gradient(from 90deg, #4750a2, #53c3c2, #f1d25b, #279a49)', border: '1px solid #e4e8f2' }} />
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Georgia's Impact Investing Ecosystem Map</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('explore'); setSelectedFips(null); window.scrollTo(0, 0); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={12} /> Reset View
            </button>
          </div>
        </div>
        <nav className="max-w-[1600px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-brand-indigo text-brand-indigo'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-h-0 print-unclip">
        <div className="app-scroll max-w-[1600px] mx-auto h-full overflow-y-scroll px-6 print-unclip">
          <SavePdfButton />
          {activeTab === 'explore' && <ExploreTab />}
          {activeTab === 'capital' && <CapitalTab />}
          {activeTab === 'framing' && <FramingTab />}
          {activeTab === 'glossary' && <div className="pb-10 pt-2"><FrameworkTab /></div>}
        </div>
      </main>
    </div>
  );
}
