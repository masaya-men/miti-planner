import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './Layout';
import Timeline from './Timeline';

import { CheatSheetView } from './CheatSheetView';
import { ErrorBoundary } from './ErrorBoundary';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileGuide } from './MobileGuide';
import clsx from 'clsx';
import { List, LayoutGrid } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

const MOBILE_GUIDE_KEY = 'lopo_mobile_guide_completed';

/**
 * MitiPlannerPage — 軽減プランナーのメインページ。
 *
 * 旧 App.tsx から分離。Layout でラップされた状態で
 * Timeline / CheatSheet の表示切替を管理する。
 */
export const MitiPlannerPage: React.FC = () => {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'timeline' | 'cheatsheet'>('timeline');
    const [mobileGuideOpen, setMobileGuideOpen] = useState(false);

    // Set page title
    useEffect(() => {
        document.title = t('app.page_title_planner');
    }, [t]);

    // チュートリアル / モバイルガイドの自動起動
    // モバイル: 簡易ガイド（スワイプカード式）を表示
    // PC: 従来の25ステップチュートリアルを起動
    useEffect(() => {
        const isMobile = window.innerWidth < 768;
        const { isActive, hasCompleted, hasVisitedShare, startFromStep } = useTutorialStore.getState();
        const { timelineEvents } = useMitigationStore.getState();

        if (isMobile) {
            // モバイル: 簡易ガイドを未完了なら表示
            const guideCompleted = localStorage.getItem(MOBILE_GUIDE_KEY) === 'true';
            if (!guideCompleted && !hasVisitedShare && timelineEvents.length === 0) {
                const timer = setTimeout(() => setMobileGuideOpen(true), 600);
                return () => clearTimeout(timer);
            }
        } else {
            // PC: 従来のチュートリアル
            if (!hasCompleted && !isActive && !hasVisitedShare && timelineEvents.length === 0) {
                const timer = setTimeout(() => startFromStep(1), 500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleMobileGuideClose = () => {
        setMobileGuideOpen(false);
        localStorage.setItem(MOBILE_GUIDE_KEY, 'true');
        // デスクトップチュートリアルのhasCompletedもtrueにして、PC切替時に再発火しないようにする
        useTutorialStore.getState().completeTutorial();
    };

    return (
        <Layout>
            {/* モバイル簡易ガイド */}
            <MobileGuide isOpen={mobileGuideOpen} onClose={handleMobileGuideClose} />

            <div className="flex flex-col h-full relative z-10">

                {/* Floating View Toggle */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-glass-header p-1.5 rounded-full hidden md:flex items-center gap-1 border border-glass-border">
                    <div className="flex items-center gap-1">
                        <Tooltip content={t('app.timeline')} position="bottom">
                            <button
                                onClick={() => setViewMode('timeline')}
                                className={clsx(
                                    "p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer",
                                    viewMode === 'timeline'
                                        ? "bg-app-text text-app-bg"
                                        : "text-app-text hover:bg-app-surface2"
                                )}
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </Tooltip>
                        <Tooltip content={t('app.cheat_sheet', 'Cheat Sheet')} position="bottom">
                            <button
                                onClick={() => setViewMode('cheatsheet')}
                                className={clsx(
                                    "p-2 rounded-lg transition-all duration-300 flex items-center justify-center cursor-pointer",
                                    viewMode === 'cheatsheet'
                                        ? "bg-app-text text-app-bg"
                                        : "text-app-text hover:bg-app-surface2"
                                )}
                            >
                                <List size={18} />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Main Scrollable Container */}
                <div className="flex-1 overflow-auto relative flex">
                    {viewMode === 'timeline' ? (
                        <>
                            <ErrorBoundary>
                                <Timeline />
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
