import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './Layout';
import Timeline from './Timeline';

import { ErrorBoundary } from './ErrorBoundary';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCanonicalUrl } from '../hooks/useCanonicalUrl';
import { MobileGuide } from './MobileGuide';

const MOBILE_GUIDE_KEY = 'lopo_mobile_guide_completed';

/**
 * MitiPlannerPage — 軽減プランナーのメインページ。
 *
 * 旧 App.tsx から分離。Layout でラップされた状態で
 * Timeline を表示する。
 */
export const MitiPlannerPage: React.FC = () => {
    useCanonicalUrl('/miti');
    const { t } = useTranslation();
    const [mobileGuideOpen, setMobileGuideOpen] = useState(false);

    // Set page title
    useEffect(() => {
        document.title = t('app.page_title_planner');
    }, [t]);

    // チュートリアル / モバイルガイドの自動起動
    // モバイル: 簡易ガイド（スワイプカード式）を表示
    // PC: 従来の25ステップチュートリアルを起動
    // ※ ログイン中はmigrateOnLogin完了後まで待つ（プランデータ消失防止）
    const authUser = useAuthStore((s) => s.user);
    const migrationDone = usePlanStore((s) => s._migrationDone);
    useEffect(() => {
        // ログイン中だがマイグレーション未完了 → まだチェックしない
        if (authUser && !migrationDone) return;

        const isMobile = window.innerWidth < 768;
        const { isActive, hasCompleted, hasVisitedShare } = useTutorialStore.getState();
        const mitiState = useMitigationStore.getState();
        let { timelineEvents } = mitiState;

        // リロード時のクリーンアップ: チュートリアルが非アクティブなのに
        // テンプレートイベント（tut_evt_*）が残っている場合は除去する
        if (!isActive && timelineEvents.some(e => e.id.startsWith('tut_evt_'))) {
            const cleaned = timelineEvents.filter(e => !e.id.startsWith('tut_evt_'));
            mitiState.loadSnapshot({
                ...mitiState.getSnapshot(),
                timelineEvents: cleaned,
                timelineMitigations: cleaned.length === 0 ? [] : mitiState.timelineMitigations,
            });
            timelineEvents = cleaned;

            // チュートリアル専用プランが残っていれば削除
            const planStore = usePlanStore.getState();
            const tutPlan = planStore.plans.find(p =>
                p.title.endsWith('_チュートリアル') || p.title.endsWith('_Tutorial')
            );
            if (tutPlan) planStore.deletePlan(tutPlan.id);
        }

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
                const timer = setTimeout(() => useTutorialStore.getState().startTutorial('main'), 500);
                return () => clearTimeout(timer);
            }
        }
    }, [authUser, migrationDone]);

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
                {/* Main Scrollable Container */}
                <div className="flex-1 overflow-auto relative flex">
                    <ErrorBoundary>
                        <Timeline />
                    </ErrorBoundary>
                </div>
            </div>
        </Layout>
    );
};
