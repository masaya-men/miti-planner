import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { CONTENT_DEFINITIONS, getContentById } from '../data/contentRegistry';
import { JOBS } from '../data/mockData';
import type { PlanData, SavedPlan } from '../types';
import { ArrowLeft } from 'lucide-react';

// --- 型定義 ---

interface PopularEntry {
    shareId: string;
    contentId: string;
    title: string;
    copyCount: number;
    viewCount: number;
    featured: boolean;
    partyMembers: { jobId: string | null }[];
}

interface PopularApiResponse {
    [contentId: string]: PopularEntry[];
}

// --- トースト（新タブ用の簡易実装） ---

const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-app-text text-app-bg px-4 py-2 rounded-full text-sm font-bold z-50';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1500);
    setTimeout(() => el.remove(), 2000);
};

// --- コンテンツID算出 ---

const savageContents = CONTENT_DEFINITIONS.filter(c => c.category === 'savage');
const latestPatch = savageContents.reduce((max, c) => c.patch > max ? c.patch : max, '0');
const savageIds = savageContents.filter(c => c.patch === latestPatch).map(c => c.id);

const ultimateIds = CONTENT_DEFINITIONS.filter(c => c.category === 'ultimate').map(c => c.id);

// --- コンポーネント ---

export const PopularPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme } = useThemeStore();
    const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

    const [data, setData] = useState<PopularApiResponse>({});
    const [loading, setLoading] = useState(true);

    // テーマ同期（新タブなので手動適用）
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(`theme-${theme}`);
    }, [theme]);

    // ページタイトル
    useEffect(() => {
        document.title = `${t('popular.title')} - LoPo`;
    }, [t]);

    // データ取得
    useEffect(() => {
        const allIds = [...savageIds, ...ultimateIds];
        fetch(`/api/popular?contentIds=${allIds.join(',')}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json: { results: { contentId: string; plans: PopularEntry[] }[] }) => {
                // APIレスポンス { results: [...] } をフラットマップに変換
                const map: PopularApiResponse = {};
                for (const item of json.results) {
                    map[item.contentId] = item.plans;
                }
                setData(map);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    // 単一プランをコピー
    const handleCopy = useCallback(async (entry: PopularEntry) => {
        try {
            const res = await fetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
            if (!res.ok) throw new Error();
            const shared = await res.json();

            const planData: PlanData = shared.planData ?? shared.data;
            const newPlan: SavedPlan = {
                id: crypto.randomUUID?.() ?? 'evt_' + Math.random().toString(36).substring(2, 9),
                ownerId: '',
                ownerDisplayName: '',
                title: entry.title,
                contentId: entry.contentId,
                isPublic: false,
                copyCount: 0,
                useCount: 0,
                data: planData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            usePlanStore.getState().addPlan(newPlan);

            // コピーカウント増加（重複防止）
            const copiedKey = 'lopo_copied_shares';
            const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
            if (!copiedList.includes(entry.shareId)) {
                copiedList.push(entry.shareId);
                localStorage.setItem(copiedKey, JSON.stringify(copiedList));
                fetch('/api/popular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shareId: entry.shareId }),
                }).catch(() => {});
            }

            showToast(t('popular.copied_toast'));
        } catch {
            // エラー時は何もしない
        }
    }, [t]);

    // まとめてコピー（rank指定: 0=1位, 1=2位）— 並列取得
    const handleCopyAllRank = useCallback(async (rank: number) => {
        const targets = savageIds
            .map(id => data[id]?.[rank])
            .filter((e): e is PopularEntry => !!e);

        if (targets.length === 0) return;

        const results = await Promise.allSettled(
            targets.map(async (entry) => {
                const res = await fetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
                if (!res.ok) throw new Error();
                const shared = await res.json();
                return { entry, planData: (shared.planData ?? shared.data) as PlanData };
            })
        );

        let copied = 0;
        const copiedKey = 'lopo_copied_shares';
        const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const { entry, planData } = result.value;

            const newPlan: SavedPlan = {
                id: crypto.randomUUID?.() ?? 'evt_' + Math.random().toString(36).substring(2, 9),
                ownerId: '',
                ownerDisplayName: '',
                title: entry.title,
                contentId: entry.contentId,
                isPublic: false,
                copyCount: 0,
                useCount: 0,
                data: planData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            usePlanStore.getState().addPlan(newPlan);

            if (!copiedList.includes(entry.shareId)) {
                copiedList.push(entry.shareId);
                fetch('/api/popular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shareId: entry.shareId }),
                }).catch(() => {});
            }
            copied++;
        }

        localStorage.setItem(copiedKey, JSON.stringify(copiedList));
        if (copied > 0) {
            showToast(t('popular.copied_all_toast', { count: copied }));
        }
    }, [data, t]);

    // コンテンツ名取得ヘルパー
    const getContentName = (contentId: string): string => {
        const def = getContentById(contentId);
        if (!def) return contentId;
        return def.name[lang] || def.name.ja;
    };

    // ジョブアイコン取得ヘルパー
    const getJobIcon = (jobId: string | null): string | null => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job?.icon ?? null;
    };

    // プランカードの描画
    const renderCard = (entry: PopularEntry, rank: number) => {
        const contentName = getContentName(entry.contentId);
        return (
            <div
                key={`${entry.contentId}-${rank}`}
                className="glass-tier3 rounded-xl p-4 flex flex-col gap-3"
            >
                {/* ランクバッジ + 注目バッジ + コンテンツ名 */}
                <div className="flex items-center gap-2">
                    {entry.featured ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-app-text text-app-bg">
                            {t('popular.featured')}
                        </span>
                    ) : (
                        <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                rank === 0
                                    ? 'bg-app-text text-app-bg'
                                    : 'bg-app-border text-app-text-muted'
                            }`}
                        >
                            {t('popular.rank', { rank: rank + 1 })}
                        </span>
                    )}
                    <span className="text-sm font-bold text-app-text truncate">
                        {contentName}
                    </span>
                </div>

                {/* プランタイトル */}
                <p className="text-xs text-app-text-muted truncate">{entry.title}</p>

                {/* 閲覧数 + コピー数 */}
                <div className="flex items-center gap-3 text-xs text-app-text-muted">
                    <span>{t('popular.view_count', { count: entry.viewCount })}</span>
                    <span>{t('popular.copy_count', { count: entry.copyCount })}</span>
                </div>

                {/* パーティ構成（ジョブアイコン） */}
                {entry.partyMembers && entry.partyMembers.length > 0 && (
                    <div className="flex items-center gap-1">
                        {entry.partyMembers.map((member, idx) => {
                            const icon = getJobIcon(member.jobId);
                            return icon ? (
                                <img
                                    key={idx}
                                    src={icon}
                                    alt=""
                                    className="w-5 h-5 rounded-sm"
                                />
                            ) : (
                                <div
                                    key={idx}
                                    className="w-5 h-5 rounded-sm bg-app-border"
                                />
                            );
                        })}
                    </div>
                )}

                {/* コピーボタン */}
                <button
                    onClick={() => handleCopy(entry)}
                    className="mt-auto w-full py-1.5 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-colors cursor-pointer"
                >
                    {t('popular.copy_button')}
                </button>
            </div>
        );
    };

    // セクション描画
    const renderSection = (
        title: string,
        contentIds: string[],
        showBulkCopy: boolean
    ) => {
        const hasAny = contentIds.some(id => data[id] && data[id].length > 0);

        return (
            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h2 className="text-lg font-bold text-app-text">{title}</h2>
                    {showBulkCopy && hasAny && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleCopyAllRank(0)}
                                className="px-3 py-1.5 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-colors cursor-pointer"
                            >
                                {t('popular.copy_all_rank1')}
                            </button>
                            <button
                                onClick={() => handleCopyAllRank(1)}
                                className="px-3 py-1.5 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-colors cursor-pointer"
                            >
                                {t('popular.copy_all_rank2')}
                            </button>
                        </div>
                    )}
                </div>

                {!hasAny && (
                    <p className="text-sm text-app-text-muted">{t('popular.no_data')}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {contentIds.map(contentId => {
                        const entries = data[contentId];
                        if (!entries || entries.length === 0) return null;
                        return entries.slice(0, 2).map((entry, rank) =>
                            renderCard(entry, rank)
                        );
                    })}
                </div>
            </section>
        );
    };

    // --- ローディング ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-app-text border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-app-text-muted">{t('popular.title')}</p>
                </div>
            </div>
        );
    }

    // --- メインレンダリング ---
    return (
        <div className="min-h-screen bg-app-bg text-app-text">
            <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
                {/* ヘッダー */}
                <header className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold">{t('popular.title')}</h1>
                        <p className="text-sm text-app-text-muted">{t('popular.subtitle')}</p>
                    </div>
                    <button
                        onClick={() => { window.close(); window.location.href = '/miti'; }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                    >
                        <ArrowLeft size={12} />
                        {t('popular.back_to_miti')}
                    </button>
                </header>

                {/* 零式（最新） */}
                {renderSection(t('popular.savage_section'), savageIds, true)}

                {/* 絶 */}
                {renderSection(t('popular.ultimate_section'), ultimateIds, false)}
            </div>
        </div>
    );
};
