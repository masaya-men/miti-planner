import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { Layout } from './Layout';
import Timeline from './Timeline';
import { ErrorBoundary } from './ErrorBoundary';
import { showToast } from './Toast';
import { Copy } from 'lucide-react';
import type { PlanData } from '../types';

interface SharedData {
    shareId: string;
    title: string;
    contentId: string | null;
    planData: PlanData;
    createdAt: number;
}

type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

export const SharePage: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [state, setState] = useState<LoadState>('loading');
    const [sharedData, setSharedData] = useState<SharedData | null>(null);

    useEffect(() => {
        if (!shareId) { setState('not_found'); return; }

        fetch(`/api/share?id=${encodeURIComponent(shareId)}`)
            .then(res => {
                if (res.status === 404) { setState('not_found'); return null; }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data) return;
                setSharedData(data as SharedData);
                // スナップショットをストアに読み込み
                useMitigationStore.getState().loadSnapshot(data.planData);
                setState('loaded');
            })
            .catch(() => setState('error'));
    }, [shareId]);

    // ページタイトル設定
    useEffect(() => {
        if (sharedData) {
            const contentDef = sharedData.contentId ? getContentById(sharedData.contentId) : null;
            const contentName = contentDef
                ? (i18n.language.startsWith('ja') ? contentDef.name.ja : contentDef.name.en)
                : '';
            document.title = `${contentName || sharedData.title || 'LoPo'} - ${t('app.shared_plan')}`;
        }
    }, [sharedData, i18n.language, t]);

    // 「自分のプランにコピー」
    const handleCopyToMine = () => {
        if (!sharedData) return;
        const snapshot = useMitigationStore.getState().getSnapshot();
        const contentDef = sharedData.contentId ? getContentById(sharedData.contentId) : null;
        const contentName = contentDef
            ? (i18n.language.startsWith('ja') ? contentDef.name.ja : contentDef.name.en)
            : '';

        const newPlan = {
            id: crypto.randomUUID(),
            ownerId: '',
            ownerDisplayName: '',
            title: sharedData.title || contentName || 'Shared Plan',
            contentId: sharedData.contentId,
            isPublic: false,
            copyCount: 0,
            useCount: 0,
            data: snapshot,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        usePlanStore.getState().addPlan(newPlan);
        usePlanStore.getState().setCurrentPlanId(newPlan.id);
        showToast(t('app.share_copied_toast'));
        navigate('/miti');
    };

    if (state === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-app-text border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-app-text-muted">{t('app.share_loading')}</p>
                </div>
            </div>
        );
    }

    if (state === 'not_found' || state === 'error') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text">
                <div className="flex flex-col items-center gap-4 text-center px-6">
                    <p className="text-lg font-bold">
                        {state === 'not_found' ? t('app.share_not_found') : t('app.share_error')}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 rounded-full border border-app-border text-sm hover:bg-app-text hover:text-app-bg transition-colors cursor-pointer"
                    >
                        {t('app.return_home')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Layout>
            <div className="flex flex-col h-full relative z-10">
                {/* 共有バナー */}
                <div className="shrink-0 flex items-center justify-center gap-3 py-2 px-4 bg-app-surface2 border-b border-app-border">
                    <span className="text-xs text-app-text-muted tracking-wide uppercase">
                        {t('app.shared_plan')}
                    </span>
                    <button
                        onClick={handleCopyToMine}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-colors cursor-pointer"
                    >
                        <Copy size={12} />
                        {t('app.share_copy_to_mine')}
                    </button>
                </div>

                {/* タイムライン表示 */}
                <div className="flex-1 overflow-auto relative flex">
                    <ErrorBoundary>
                        <Timeline />
                    </ErrorBoundary>
                </div>
            </div>
        </Layout>
    );
};
