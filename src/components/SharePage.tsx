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
import { apiFetch } from '../lib/apiClient';
import { Copy } from 'lucide-react';
import clsx from 'clsx';
import type { PlanData } from '../types';

interface SharedSingle {
    shareId: string;
    title: string;
    contentId: string | null;
    planData: PlanData;
    createdAt: number;
}

interface BundlePlan {
    contentId: string | null;
    title: string;
    planData: PlanData;
}

interface SharedBundle {
    shareId: string;
    type: 'bundle';
    plans: BundlePlan[];
    createdAt: number;
}

type SharedData = SharedSingle | SharedBundle;
type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

function isBundle(data: SharedData): data is SharedBundle {
    return 'type' in data && data.type === 'bundle';
}

export const SharePage: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [state, setState] = useState<LoadState>('loading');
    const [sharedData, setSharedData] = useState<SharedData | null>(null);
    // バンドル時の選択タブ
    const [activeTab, setActiveTab] = useState(0);

    const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

    // 共有リンク訪問者にはチュートリアル自動起動しない
    useEffect(() => {
        import('../store/useTutorialStore').then(({ useTutorialStore }) => {
            useTutorialStore.setState({ hasVisitedShare: true });
        });
    }, []);

    useEffect(() => {
        if (!shareId) { setState('not_found'); return; }

        apiFetch(`/api/share?id=${encodeURIComponent(shareId)}`)
            .then(res => {
                if (res.status === 404) { setState('not_found'); return null; }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data) return;
                setSharedData(data as SharedData);

                // 最初のプランデータをストアに読み込み
                if (isBundle(data)) {
                    if (data.plans.length > 0) {
                        useMitigationStore.getState().loadSnapshot(data.plans[0].planData);
                    }
                } else {
                    useMitigationStore.getState().loadSnapshot(data.planData);
                }
                setState('loaded');
            })
            .catch(() => setState('error'));
    }, [shareId]);

    // タブ切り替え時にストアを入れ替え
    useEffect(() => {
        if (!sharedData || !isBundle(sharedData)) return;
        const plan = sharedData.plans[activeTab];
        if (plan) {
            useMitigationStore.getState().loadSnapshot(plan.planData);
        }
    }, [activeTab, sharedData]);

    // ページタイトル設定
    useEffect(() => {
        if (!sharedData) return;
        if (isBundle(sharedData)) {
            const names = sharedData.plans
                .map(p => {
                    const def = p.contentId ? getContentById(p.contentId) : null;
                    return def ? def.name[lang] || def.name.ja : p.title;
                })
                .filter(Boolean);
            document.title = `${names.join(' / ') || 'LoPo'} - ${t('app.shared_plan')}`;
        } else {
            const contentDef = sharedData.contentId ? getContentById(sharedData.contentId) : null;
            const contentName = contentDef ? (contentDef.name[lang] || contentDef.name.ja) : '';
            document.title = `${contentName || sharedData.title || 'LoPo'} - ${t('app.shared_plan')}`;
        }
    }, [sharedData, lang, t]);

    // コンテンツ名を取得するヘルパー
    const getContentName = (contentId: string | null, fallback: string) => {
        if (!contentId) return fallback;
        const def = getContentById(contentId);
        if (!def) return fallback;
        return def.shortName[lang] || def.shortName.ja || def.name[lang] || def.name.ja;
    };

    // 「自分のプランにコピー」（単一）
    const handleCopyToMine = () => {
        if (!sharedData) return;

        if (isBundle(sharedData)) {
            // バンドル: 全プランをコピー
            const planStore = usePlanStore.getState();
            for (const plan of sharedData.plans) {
                const contentName = getContentName(plan.contentId, plan.title || 'Shared Plan');
                const newPlan = {
                    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
                    ownerId: '',
                    ownerDisplayName: '',
                    title: plan.title || contentName,
                    contentId: plan.contentId,
                    isPublic: false,
                    copyCount: 0,
                    useCount: 0,
                    data: plan.planData,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                planStore.addPlan(newPlan);
            }
            // 最初のプランを開く
            if (sharedData.plans.length > 0) {
                const firstPlan = usePlanStore.getState().plans.find(
                    p => p.contentId === sharedData.plans[0].contentId
                );
                if (firstPlan) {
                    usePlanStore.getState().setCurrentPlanId(firstPlan.id);
                    useMitigationStore.getState().loadSnapshot(firstPlan.data);
                }
            }
            showToast(t('app.share_copied_toast'));
            // コピーカウント増加（重複防止）
            const copiedKey = 'lopo_copied_shares';
            const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
            const targetShareId = sharedData.shareId;
            if (targetShareId && !copiedList.includes(targetShareId)) {
                copiedList.push(targetShareId);
                localStorage.setItem(copiedKey, JSON.stringify(copiedList));
                apiFetch('/api/popular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shareId: targetShareId }),
                }).catch(() => {});
            }
            navigate('/miti');
        } else {
            // 単一プラン
            const snapshot = useMitigationStore.getState().getSnapshot();
            const contentDef = sharedData.contentId ? getContentById(sharedData.contentId) : null;
            const contentName = contentDef ? (contentDef.name[lang] || contentDef.name.ja) : '';

            const newPlan = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
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
            // コピーカウント増加（重複防止）
            const copiedKey = 'lopo_copied_shares';
            const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
            const targetShareId = sharedData.shareId;
            if (targetShareId && !copiedList.includes(targetShareId)) {
                copiedList.push(targetShareId);
                localStorage.setItem(copiedKey, JSON.stringify(copiedList));
                apiFetch('/api/popular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shareId: targetShareId }),
                }).catch(() => {});
            }
            navigate('/miti');
        }
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

    const isBundleView = sharedData && isBundle(sharedData);

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
                        {isBundleView
                            ? t('app.share_copy_all_to_mine')
                            : t('app.share_copy_to_mine')
                        }
                    </button>
                </div>

                {/* バンドル時のタブ */}
                {isBundleView && (
                    <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 bg-app-surface2/50 border-b border-app-border overflow-x-auto">
                        {(sharedData as SharedBundle).plans.map((plan, idx) => {
                            const label = getContentName(plan.contentId, plan.title || `${idx + 1}`);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setActiveTab(idx)}
                                    className={clsx(
                                        "px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap",
                                        idx === activeTab
                                            ? "bg-app-text text-app-bg"
                                            : "text-app-text-muted hover:text-app-text hover:bg-app-text/10"
                                    )}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}

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
