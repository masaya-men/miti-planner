import { useState, useEffect } from 'react';
import { Layout } from './Layout';
import { Timeline } from './Timeline';
import { MitigationGrid } from './MitigationGrid';
import { CheatSheetView } from './CheatSheetView';
import { ErrorBoundary } from './ErrorBoundary';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import clsx from 'clsx';
import { List, LayoutGrid } from 'lucide-react';

/**
 * MitiPlannerPage — 軽減プランナーのメインページ。
 *
 * 旧 App.tsx から分離。Layout でラップされた状態で
 * Timeline / CheatSheet の表示切替を管理する。
 */
export const MitiPlannerPage: React.FC = () => {
    const [viewMode, setViewMode] = useState<'timeline' | 'cheatsheet'>('timeline');

    // Auto-start tutorial if timeline is empty (fresh state)
    // Shows once per page load — not blocked by previous "skip"
    useEffect(() => {
        const { isActive, startFromStep } = useTutorialStore.getState();
        const { timelineEvents } = useMitigationStore.getState();

        if (!isActive && timelineEvents.length === 0) {
            // Start from step 1 (sidebar new-plan), skipping step 0 (portal)
            const timer = setTimeout(() => startFromStep(1), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <Layout>
            <div className="flex flex-col h-full relative z-10">

                {/* Floating View Toggle */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-glass-header backdrop-blur-xl p-1.5 rounded-full hidden md:flex items-center gap-1 border border-glass-border shadow-glass">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={clsx(
                                "p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer",
                                viewMode === 'timeline'
                                    ? "bg-blue-500/40 text-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-white hover:bg-slate-900/ dark:hover:bg-white/"
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
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-white hover:bg-slate-900/ dark:hover:bg-white/"
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
};
