import { Layout } from './components/Layout';
import { Timeline } from './components/Timeline';
import { MitigationGrid } from './components/MitigationGrid';
import { CheatSheetView } from './components/CheatSheetView';
import { CsvImportModal } from './components/CsvImportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useState } from 'react';
import clsx from 'clsx';
import { List, LayoutGrid, Upload, Sparkles } from 'lucide-react';
import { generateAutoPlan } from './utils/autoPlanner';

function App() {
  const [viewMode, setViewMode] = useState<'timeline' | 'cheatsheet'>('timeline');
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Function to handle auto planning
  const handleAutoPlan = () => {
    if (window.confirm("This will automatically generate a mitigation plan based on the current timeline events.\nWarning: Any overlapping logic might overwrite intended placements.\nContinue?")) {
      generateAutoPlan();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-screen pt-14 relative">

        {/* Top Controls */}
        <div className="absolute top-16 right-6 z-50 bg-black/40 backdrop-blur-md p-1 rounded-xl flex items-center gap-2 border border-white/10 shadow-lg">

          {/* Auto Plan Button */}
          <button
            onClick={handleAutoPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-300 cursor-pointer bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] mr-1"
            title="Auto Plan Mitigations"
          >
            <Sparkles size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Auto Plan</span>
          </button>

          {/* Import Button */}
          <button
            onClick={() => setImportModalOpen(true)}
            className="p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer text-slate-400 hover:text-white hover:bg-white/10"
            title="Import Timeline CSV"
          >
            <Upload size={18} />
          </button>

          <div className="w-[1px] h-5 bg-white/10" />

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

      <CsvImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </Layout>
  );
}

export default App;
