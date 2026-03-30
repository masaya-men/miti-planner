import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import {
    getContentDefinitions,
    getContentById,
    getProjectLabel,
} from '../data/contentRegistry';
import { useJobs } from '../hooks/useSkillsData';
import type { PlanData, SavedPlan, ContentLevel } from '../types';
import { ArrowLeft, Sun, Moon, Link2, Download } from 'lucide-react';
import { GridOverlay } from './GridOverlay';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LoPoButton } from './LoPoButton';
import { PulseSettings } from './PulseSettings';
import { apiFetch } from '../lib/apiClient';

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

interface ContentResult {
    contentId: string;
    plans: PopularEntry[];       // viewCount順 top2
    featured: PopularEntry | null; // ピックアップ（なければnull）
}

interface PopularApiResponse {
    [contentId: string]: { plans: PopularEntry[]; featured: PopularEntry | null };
}

// --- トースト ---

const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-app-text text-app-bg px-4 py-2 rounded-full text-sm font-bold z-50';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1500);
    setTimeout(() => el.remove(), 2000);
};

// --- コンテンツID算出 ---
const savageContents = getContentDefinitions().filter(c => c.category === 'savage');
const latestPatch = savageContents.reduce((max, c) => c.patch > max ? c.patch : max, '0');
const savageIds = savageContents
    .filter(c => c.patch === latestPatch)
    .sort((a, b) => a.order - b.order)
    .map(c => c.id);

// 零式のレベル（PROJECT_LABELS取得用）
const savageLevel = savageContents.find(c => c.patch === latestPatch)?.level as ContentLevel | undefined;

// 全絶コンテンツ（dsr_p1はランキングから除外）
const ultimateIds = getContentDefinitions()
    .filter(c => c.category === 'ultimate' && c.id !== 'dsr_p1')
    .map(c => c.id);

// --- ダミージョブ構成 ---
const DUMMY_JOBS = ['PLD', 'WAR', 'WHM', 'SCH', 'DRG', 'NIN', 'BRD', 'BLM'];

// 層の短い表示名を取得（"1層", "4層前半" など）
const getFloorLabel = (contentId: string, lang: 'ja' | 'en'): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    // shortNameに改行が含まれる場合があるので除去してスペースに
    const short = (lang === 'ja' ? def.shortName.ja : def.shortName.en).replace(/\n/g, ' ');
    return short;
};

// --- コンポーネント ---

export const PopularPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const JOBS = useJobs();
    const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

    const [data, setData] = useState<PopularApiResponse>({});
    const [loading, setLoading] = useState(true);

    // テーマ同期
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(`theme-${theme}`);
    }, [theme]);

    // bodyのoverflow-hidden解除
    useEffect(() => {
        document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // ページタイトル
    useEffect(() => {
        document.title = `${t('popular.title')} - LoPo`;
    }, [t]);

    // データ取得
    useEffect(() => {
        const allIds = [...savageIds, ...ultimateIds];
        apiFetch(`/api/popular?contentIds=${allIds.join(',')}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((json: { results: ContentResult[] }) => {
                const map: PopularApiResponse = {};
                for (const item of json.results) {
                    map[item.contentId] = {
                        plans: item.plans,
                        featured: item.featured,
                    };
                }
                setData(map);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    // --- コピーロジック ---
    const handleCopy = useCallback(async (entry: PopularEntry) => {
        try {
            const res = await apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
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

            const copiedKey = 'lopo_copied_shares';
            const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
            if (!copiedList.includes(entry.shareId)) {
                copiedList.push(entry.shareId);
                localStorage.setItem(copiedKey, JSON.stringify(copiedList));
                apiFetch('/api/popular', {
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

    // まとめてコピー
    const handleCopyAllRank = useCallback(async (rank: number) => {
        const targets = savageIds
            .map(id => data[id]?.plans?.[rank])
            .filter((e): e is PopularEntry => !!e);

        if (targets.length === 0) return;

        const results = await Promise.allSettled(
            targets.map(async (entry) => {
                const res = await apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
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
                apiFetch('/api/popular', {
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

    // --- ヘルパー ---
    const getContentName = (contentId: string): string => {
        const def = getContentById(contentId);
        if (!def) return contentId;
        return def.name[lang] || def.name.ja;
    };

    const getJobIcon = (jobId: string | null): string | null => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job?.icon ?? null;
    };

    // --- ランクの合計使用数 ---
    const getRankTotalCount = (contentIds: string[], rank: number): number => {
        return contentIds.reduce((sum, id) => {
            const entry = data[id]?.plans?.[rank];
            return sum + (entry?.copyCount ?? 0);
        }, 0);
    };

    // --- カード共通 ---
    const renderJobIcons = (partyMembers: { jobId: string | null }[]) => (
        <div className="flex items-center gap-1">
            {partyMembers.map((member, idx) => {
                const icon = getJobIcon(member.jobId);
                return icon ? (
                    <img key={idx} src={icon} alt="" className="w-5 h-5 rounded-sm" />
                ) : (
                    <div key={idx} className="w-5 h-5 rounded-sm bg-app-border" />
                );
            })}
        </div>
    );

    const renderDummyJobIcons = () => (
        <div className="flex items-center gap-1">
            {DUMMY_JOBS.map((jobId, i) => {
                const icon = getJobIcon(jobId);
                return icon ? (
                    <img key={i} src={icon} alt="" className="w-5 h-5 rounded-sm opacity-40 grayscale" />
                ) : (
                    <div key={i} className="w-5 h-5 rounded-sm bg-app-border" />
                );
            })}
        </div>
    );

    // --- 共有URL生成 ---
    const getShareUrl = (shareId: string) =>
        `${window.location.origin}/share/${shareId}`;

    // --- Xで共有 ---
    const handleShareX = useCallback((entry: PopularEntry) => {
        const url = getShareUrl(entry.shareId);
        const contentName = getContentName(entry.contentId);
        const text = contentName
            ? `${contentName} - ${entry.title}`
            : entry.title;
        window.open(
            `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
            '_blank',
            'noopener'
        );
    }, [lang]);

    // --- リンクコピー ---
    const handleCopyLink = useCallback((entry: PopularEntry) => {
        navigator.clipboard.writeText(getShareUrl(entry.shareId)).then(() => {
            showToast(t('popular.link_copied'));
        }).catch(() => {});
    }, [t]);

    // --- 実データカード ---
    const renderCard = (entry: PopularEntry, label: string) => (
        <div
            key={`${entry.shareId}-${label}`}
            className="glass-popular-card rounded-xl p-4 flex flex-col gap-2.5 transition-all duration-300 hover:scale-[1.02] min-w-0"
        >
            <div className="glass-card-sweep" />
            <div className="glass-card-corner glass-card-corner-tl" />
            <div className="glass-card-corner glass-card-corner-tr" />
            <div className="glass-card-corner glass-card-corner-bl" />
            <div className="glass-card-corner glass-card-corner-br" />
            <div className="glass-card-sheen" />
            <span className="text-[11px] font-bold text-app-text-muted truncate">{label}</span>
            <p className="text-xs text-app-text truncate font-semibold">{entry.title}</p>
            {entry.partyMembers?.length > 0 && renderJobIcons(entry.partyMembers)}
            {/* アクションボタン: 保存 / X / リンク */}
            <div className="mt-auto flex gap-1.5">
                <button
                    onClick={() => handleCopy(entry)}
                    className="flex-1 h-8 rounded-full border border-app-border text-[11px] font-bold hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                >
                    <Download size={10} />
                    {t('popular.save_to_mine')}
                </button>
                <button
                    onClick={() => handleShareX(entry)}
                    className="h-8 w-8 rounded-full border border-app-border text-[11px] font-bold hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                    title={t('popular.share_x')}
                >
                    {t('popular.share_x')}
                </button>
                <button
                    onClick={() => handleCopyLink(entry)}
                    className="h-8 w-8 rounded-full border border-app-border text-[11px] font-bold hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
                    title={t('popular.share_link')}
                >
                    <Link2 size={12} />
                </button>
            </div>
        </div>
    );

    // --- スケルトンカード ---
    const renderSkeletonCard = (label: string, keyStr: string) => (
        <div
            key={`skel-${keyStr}`}
            className="glass-popular-card rounded-xl p-4 flex flex-col gap-2.5 opacity-25 pointer-events-none select-none min-w-0"
        >
            <div className="glass-card-sweep" />
            <div className="glass-card-corner glass-card-corner-tl" />
            <div className="glass-card-corner glass-card-corner-tr" />
            <div className="glass-card-corner glass-card-corner-bl" />
            <div className="glass-card-corner glass-card-corner-br" />
            <div className="glass-card-sheen" />
            <span className="text-[11px] font-bold text-app-text-muted truncate">{label}</span>
            <div className="h-3 w-2/3 rounded bg-app-border" />
            {renderDummyJobIcons()}
            {/* ダミーボタン（実カードと同じ構成） */}
            <div className="mt-auto flex gap-1.5">
                <div className="flex-1 h-8 rounded-full border border-app-border" />
                <div className="h-8 w-8 rounded-full border border-app-border shrink-0" />
                <div className="h-8 w-8 rounded-full border border-app-border shrink-0" />
            </div>
        </div>
    );

    // --- 零式のシリーズ名 ---
    const savageSeriesName = useMemo(() => {
        if (!savageLevel) return '';
        const label = getProjectLabel(savageLevel, 'savage');
        if (!label) return '';
        return lang === 'ja' ? label.ja : label.en;
    }, [lang]);

    // (savageFloorGroups削除 — フラットグリッドに変更済み)

    // --- 零式ランク行の描画 ---
    const renderSavageRankRow = (rank: number, rankLabel: string) => {
        const totalCount = getRankTotalCount(savageIds, rank);
        const hasAny = savageIds.some(id => data[id]?.plans?.[rank]);

        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-bold text-app-text">{rankLabel}</h3>
                    <div className="flex items-center gap-3">
                        {totalCount > 0 && (
                            <span className="text-[11px] text-app-text-muted">
                                {t('popular.used_by', { count: totalCount })}
                            </span>
                        )}
                        {hasAny && (
                            <button
                                onClick={() => handleCopyAllRank(rank)}
                                className="px-3 h-8 rounded-full border border-app-border text-[11px] font-bold hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95"
                            >
                                {rank === 0 ? t('popular.copy_all_rank1') : t('popular.copy_all_rank2')}
                            </button>
                        )}
                    </div>
                </div>

                {/* 層カード: フラットグリッドで均等配置 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {savageIds.map((contentId) => {
                        const entry = data[contentId]?.plans?.[rank];
                        const floorLabel = getFloorLabel(contentId, lang);
                        return entry
                            ? renderCard(entry, floorLabel)
                            : renderSkeletonCard(floorLabel, `${contentId}-r${rank}`);
                    })}
                </div>
            </div>
        );
    };

    // --- 零式ピックアップ行 ---
    const renderSavagePickupRow = () => {
        // 各コンテンツのfeaturedを収集（1位・2位と重複しないもののみ）
        const pickups: { contentId: string; entry: PopularEntry }[] = [];
        for (const id of savageIds) {
            const d = data[id];
            if (!d?.featured) continue;
            const rank1Id = d.plans[0]?.shareId;
            const rank2Id = d.plans[1]?.shareId;
            if (d.featured.shareId !== rank1Id && d.featured.shareId !== rank2Id) {
                pickups.push({ contentId: id, entry: d.featured });
            }
        }
        if (pickups.length === 0) return null;

        return (
            <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-app-text">{t('popular.pickup_label')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {pickups.map(({ contentId, entry }) => {
                        const floorLabel = getFloorLabel(contentId, lang);
                        return renderCard(entry, floorLabel);
                    })}
                </div>
            </div>
        );
    };

    // --- 零式セクション ---
    const renderSavageSection = () => {
        const sectionTitle = savageSeriesName
            ? `${t('popular.savage_section')} — ${savageSeriesName}`
            : t('popular.savage_section');

        return (
            <section id="savage" className="glass-popular-section rounded-none sm:rounded-2xl p-3 sm:p-6 flex flex-col gap-5 sm:gap-6 scroll-mt-24">
                <div className="glass-card-sweep" />
                <div className="glass-card-sheen" />
                <h2 className="text-lg font-bold text-app-text">{sectionTitle}</h2>

                {!savageIds.some(id => data[id]?.plans?.length) && (
                    <p className="text-sm text-app-text-muted">
                        {t('popular.no_data')} — {t('popular.no_data_desc')}
                    </p>
                )}

                {/* イチオシ */}
                {renderSavageRankRow(0, t('popular.rank1_label'))}

                {/* こちらも人気 */}
                {renderSavageRankRow(1, t('popular.rank2_label'))}

                {/* ピックアップ（あれば） */}
                {renderSavagePickupRow()}
            </section>
        );
    };

    // --- 絶セクション ---
    const renderUltimateSection = () => {
        return (
            <section id="ultimate" className="glass-popular-section rounded-none sm:rounded-2xl p-3 sm:p-6 flex flex-col gap-5 sm:gap-6 scroll-mt-24">
                <div className="glass-card-sweep" />
                <div className="glass-card-sheen" />
                <h2 className="text-lg font-bold text-app-text">{t('popular.ultimate_section')}</h2>

                {!ultimateIds.some(id => data[id]?.plans?.length) && (
                    <p className="text-sm text-app-text-muted">
                        {t('popular.no_data')} — {t('popular.no_data_desc')}
                    </p>
                )}

                {ultimateIds.map(contentId => {
                    const d = data[contentId];
                    const contentName = getContentName(contentId);
                    const rank1 = d?.plans?.[0];
                    const rank2 = d?.plans?.[1];

                    // ピックアップ: 1位・2位と重複しなければ表示
                    const pickup = d?.featured
                        && d.featured.shareId !== rank1?.shareId
                        && d.featured.shareId !== rank2?.shareId
                        ? d.featured
                        : null;

                    return (
                        <div key={contentId} className="flex flex-col gap-3">
                            <h3 className="text-sm font-bold text-app-text">{contentName}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {/* イチオシ */}
                                {rank1
                                    ? renderCard(rank1, t('popular.rank1_label'))
                                    : renderSkeletonCard(t('popular.rank1_label'), `${contentId}-r0`)
                                }
                                {/* こちらも人気 */}
                                {rank2
                                    ? renderCard(rank2, t('popular.rank2_label'))
                                    : renderSkeletonCard(t('popular.rank2_label'), `${contentId}-r1`)
                                }
                                {/* ピックアップ（あれば） */}
                                {pickup && renderCard(pickup, t('popular.pickup_label'))}
                            </div>
                        </div>
                    );
                })}
            </section>
        );
    };

    // --- スムーススクロール ---
    const scrollTo = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // --- 共通レイアウト ---
    const renderLayout = (children: React.ReactNode) => (
        <div className="min-h-screen bg-app-bg text-app-text relative">
            <GridOverlay />
            {/* 固定ヘッダー（画面幅いっぱい） */}
            <header className="fixed top-0 left-0 right-0 z-50 glass-popular-header">
                <div className="w-full px-5 h-20 flex items-center justify-between gap-4">
                    {/* 左: ロゴ + ナビ */}
                    <div className="flex items-center gap-4 min-w-0">
                        <a href="/" className="shrink-0">
                            {/* モバイルではsmサイズ、PCではlgサイズ */}
                            <span className="hidden sm:inline"><LoPoButton size="lg" /></span>
                            <span className="inline sm:hidden"><LoPoButton size="sm" /></span>
                        </a>
                        {/* アンカーナビ */}
                        <nav className="hidden sm:flex items-center gap-1 ml-1">
                            <button
                                onClick={() => scrollTo('savage')}
                                className="px-3 h-7 rounded-full text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors duration-200 cursor-pointer"
                            >
                                {t('popular.savage_section')}
                            </button>
                            <button
                                onClick={() => scrollTo('ultimate')}
                                className="px-3 h-7 rounded-full text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors duration-200 cursor-pointer"
                            >
                                {t('popular.ultimate_section')}
                            </button>
                        </nav>
                    </div>

                    {/* 右: コントロール群 */}
                    <div className="flex items-center gap-2 shrink-0">
                        <LanguageSwitcher />
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 rounded-full border border-app-border flex items-center justify-center hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <div className="w-px h-5 bg-app-border" />
                        <button
                            onClick={() => { window.close(); window.location.href = '/miti'; }}
                            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 h-9 rounded-full border border-app-border text-xs font-bold hover:bg-app-text hover:text-app-bg transition-colors duration-200 cursor-pointer active:scale-95"
                        >
                            <ArrowLeft size={12} />
                            <span className="hidden sm:inline">{t('popular.back_to_miti')}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ（フル幅） */}
            <main className="relative z-10 w-full px-3 sm:px-5 pt-[108px] pb-8 flex flex-col gap-6 popular-ja-text">
                {children}
            </main>

            {/* フッター */}
            <footer className="relative z-10 border-t border-app-border px-3 sm:px-5 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-[8px] text-app-text-muted tracking-wide">
                <span>{t('footer.copyright')} · {t('footer.disclaimer')}</span>
                <span className="flex flex-wrap items-center justify-center gap-x-2">
                    <a href="/privacy" className="underline hover:text-app-text transition-colors">{t('footer.privacy_policy')}</a>
                    <span>·</span>
                    <a href="/terms" className="underline hover:text-app-text transition-colors">{t('footer.terms')}</a>
                    <span>·</span>
                    <a href="/commercial" className="underline hover:text-app-text transition-colors">{t('footer.commercial')}</a>
                    <span>·</span>
                    <a href="https://discord.gg/z7uypbJSnN" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.discord')}</a>
                    <span>·</span>
                    <a href="https://x.com/lopoly_app" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.x_official')}</a>
                    <span>·</span>
                    <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.kofi')}</a>
                    <span>·</span>
                    <PulseSettings />
                </span>
            </footer>
        </div>
    );

    // --- ローディング ---
    if (loading) {
        return renderLayout(
            <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-app-text border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // --- メインレンダリング ---
    return renderLayout(
        <>
            {renderSavageSection()}
            {renderUltimateSection()}
        </>
    );
};
