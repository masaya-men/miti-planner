import { Layout } from './components/Layout';
import { Timeline } from './components/Timeline';
import { MitigationGrid } from './components/MitigationGrid';
import { CheatSheetView } from './components/CheatSheetView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useState } from 'react';
import clsx from 'clsx';
import { List, LayoutGrid } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState<'timeline' | 'cheatsheet'>('timeline');

  return (
    <Layout>
      <div className="flex flex-col h-full relative">

        {/* Floating View Toggle */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-glass-header backdrop-blur-xl p-1.5 rounded-full flex items-center gap-1 border border-glass-border shadow-glass">

          {/* View Toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={clsx(
                "p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer",
                viewMode === 'timeline'
                  ? "bg-blue-500/40 text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
              title="Timeline View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('cheatsheet')}
              className={clsx(
                "p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer",
                viewMode === 'cheatsheet'
                  ? "bg-amber-500/40 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
              title="Cheat Sheet View"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Main Scrollable Container */}
        <div className="flex-1 overflow-auto relative flex">
          {viewMode === 'timeline' ? (
            <>
              <ErrorBoundary>
                <Timeline />
              </ErrorBoundary>
              <ErrorBoundary>
                <MitigationGrid />
              </ErrorBoundary>
            </>
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center">
              <ErrorBoundary>
                <CheatSheetView />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default App;
