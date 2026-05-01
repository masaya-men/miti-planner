/**
 * 野良主流ビュー: コンテンツ別 上位 N 件のカード一覧 + 詳細ペイン
 * - 左: 順位カード（featured / hidden の状態バッジ付き）
 * - 右: 選択カードの詳細 + ★ Featured / 🚫 Hidden 操作
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, EyeOff, Eye, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { getContentDefinitions, getAllUltimates } from '../../data/contentRegistry';

interface PlanInfo {
    shareId: string;
    title: string;
    contentId: string;
    copyCount: number;
    score7d: number;
    featured: boolean;
    hidden: boolean;
    hiddenAt: number | null;
    createdAt: number | null;
    ownerUidSuffix: string;
    isOwn: boolean;
    partyMembers: { id: string; jobId: string | null; role: string | null }[];
    imageHash: string | null;
}

function getOgpUrl(plan: PlanInfo): string {
    return plan.imageHash
        ? `/og/${plan.imageHash}.png`
        : `/api/og?id=${encodeURIComponent(plan.shareId)}`;
}

export function PopularBrowseView() {
    const { t, i18n } = useTranslation();
    const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

    const savageContents = useMemo(
        () => getContentDefinitions().filter(c => c.category === 'savage'),
        []
    );
    const latestPatch = useMemo(
        () => savageContents.reduce((max, c) => (c.patch > max ? c.patch : max), '0'),
        [savageContents]
    );
    const savageList = useMemo(
        () => savageContents.filter(c => c.patch === latestPatch).sort((a, b) => a.order - b.order),
        [savageContents, latestPatch]
    );
    const ultimateList = useMemo(() => getAllUltimates().filter(c => c.id !== 'dsr_p1'), []);

    const [tab, setTab] = useState<'savage' | 'ultimate'>('savage');
    const [contentId, setContentId] = useState<string>(savageList[0]?.id ?? '');
    const [plans, setPlans] = useState<PlanInfo[] | null>(null);
    const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [patching, setPatching] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const list = tab === 'savage' ? savageList : ultimateList;

    // タブ切替時にコンテンツ選択を当該タブの先頭にリセット
    useEffect(() => {
        const ids = (tab === 'savage' ? savageList : ultimateList).map(c => c.id);
        if (!ids.includes(contentId)) {
            setContentId(ids[0] ?? '');
        }
    }, [tab, savageList, ultimateList, contentId]);

    const fetchPlans = useCallback(async (cid: string) => {
        if (!cid) return;
        setLoading(true);
        setError(null);
        setPlans(null);
        setSelectedShareId(null);
        try {
            const res = await apiFetch(
                `/api/admin?resource=popular&contentId=${encodeURIComponent(cid)}&limit=10`
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setError(body.error || `Error: ${res.status}`);
                return;
            }
            const data = await res.json();
            setPlans(data.plans as PlanInfo[]);
            if ((data.plans as PlanInfo[]).length > 0) {
                setSelectedShareId((data.plans as PlanInfo[])[0].shareId);
            }
        } catch (err: unknown) {
            setError((err as Error).message || 'Network error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlans(contentId);
    }, [contentId, fetchPlans]);

    const selected = plans?.find(p => p.shareId === selectedShareId) ?? null;

    const handleToggle = useCallback(async (
        plan: PlanInfo,
        kind: 'featured' | 'hidden',
        next: boolean
    ) => {
        const confirmKey =
            kind === 'hidden'
                ? next ? 'admin.popular_hide_confirm' : 'admin.popular_unhide_confirm'
                : next ? 'admin.featured_confirm_set' : 'admin.featured_confirm_unset';
        const confirmMsg = t(confirmKey, { title: plan.title || plan.shareId, content: plan.contentId });
        if (!confirm(confirmMsg)) return;

        setPatching(true);
        setError(null);
        setToast(null);
        try {
            const body: Record<string, unknown> = { shareId: plan.shareId };
            body[kind] = next;
            const res = await apiFetch('/api/popular', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                setError(errBody.error || `Error: ${res.status}`);
                return;
            }
            const successKey =
                kind === 'hidden'
                    ? next ? 'admin.popular_hide_success' : 'admin.popular_unhide_success'
                    : next ? 'admin.featured_set_success' : 'admin.featured_unset_success';
            setToast(t(successKey));
            await fetchPlans(contentId);
            setSelectedShareId(plan.shareId);
        } catch (err: unknown) {
            setError((err as Error).message || 'Network error');
        } finally {
            setPatching(false);
        }
    }, [t, fetchPlans, contentId]);

    return (
        <div className="max-w-6xl">
            <h1 className="text-app-3xl font-bold mb-4">{t('admin.featured_title')}</h1>

            {/* タブ */}
            <div className="flex gap-1 mb-3 border-b border-app-border">
                {(['savage', 'ultimate'] as const).map(k => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`px-4 py-2 text-app-lg font-semibold transition-colors ${
                            tab === k
                                ? 'text-app-text border-b-2 border-app-text -mb-px'
                                : 'text-app-text-muted hover:text-app-text'
                        }`}
                    >
                        {t(`admin.popular_tab_${k}`)}
                    </button>
                ))}
            </div>

            {/* コンテンツ選択 */}
            <div className="mb-4">
                <label className="block text-app-lg text-app-text-muted mb-1">
                    {t('admin.popular_select_content')}
                </label>
                <select
                    value={contentId}
                    onChange={e => setContentId(e.target.value)}
                    className="bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:border-app-text focus:outline-none"
                >
                    {list.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name[lang] || c.name.ja}
                        </option>
                    ))}
                </select>
            </div>

            {/* エラー / トースト */}
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
                    {error}
                </div>
            )}
            {toast && (
                <div className="mb-4 p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
                    {toast}
                </div>
            )}

            {/* リスト + 詳細 */}
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                {/* 左: カードリスト */}
                <div className="flex flex-col gap-2">
                    {loading && (
                        <div className="flex items-center gap-2 text-app-text-muted text-app-lg p-4">
                            <Loader2 size={14} className="animate-spin" />
                            {t('admin.popular_loading')}
                        </div>
                    )}
                    {!loading && plans?.length === 0 && (
                        <div className="text-app-text-muted text-app-lg p-4">
                            {t('admin.popular_no_plans')}
                        </div>
                    )}
                    {!loading && plans?.map((p, idx) => (
                        <button
                            key={p.shareId}
                            data-testid="popular-card"
                            data-hidden={p.hidden ? 'true' : 'false'}
                            onClick={() => setSelectedShareId(p.shareId)}
                            className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                                selectedShareId === p.shareId
                                    ? 'border-app-text bg-app-surface2'
                                    : 'border-app-border hover:bg-app-surface2'
                            } ${p.hidden ? 'opacity-50' : ''}`}
                        >
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-app-text-muted text-app-base font-mono w-6 shrink-0">
                                    #{idx + 1}
                                </span>
                                {p.isOwn && (
                                    <span className="text-app-text text-app-sm font-bold border border-app-text rounded px-1.5 py-0.5">
                                        {t('admin.popular_own_badge')}
                                    </span>
                                )}
                                {p.featured && (
                                    <span className="text-app-yellow text-app-sm font-bold">
                                        {t('admin.popular_featured_badge')}
                                    </span>
                                )}
                                {!p.featured && idx === 0 && !p.hidden && (
                                    <span className="text-app-blue text-app-sm font-bold">
                                        {t('admin.popular_visible_now')}
                                    </span>
                                )}
                                {p.hidden && (
                                    <span className="text-app-red text-app-sm font-bold">
                                        {t('admin.popular_hidden_badge')}
                                    </span>
                                )}
                            </div>
                            <div className="text-app-lg text-app-text truncate">
                                {p.title || '(no title)'}
                            </div>
                            <div className="text-app-base text-app-text-muted mt-1">
                                {t('admin.popular_score_7d')}: {p.score7d} / {t('admin.popular_total_copies')}: {p.copyCount}
                            </div>
                        </button>
                    ))}
                </div>

                {/* 右: 詳細ペイン */}
                <div className="border border-app-border rounded-lg p-4 min-h-[400px]">
                    {!selected ? (
                        <div className="text-app-text-muted text-app-lg flex items-center justify-center h-full">
                            {t('admin.popular_select_a_card')}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <img
                                src={getOgpUrl(selected)}
                                alt={selected.title || '(no title)'}
                                className="w-full max-w-md rounded-lg border border-app-border bg-app-surface2"
                                style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
                            />
                            <table className="w-full text-app-lg">
                                <tbody>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-32">
                                            {t('admin.featured_plan_title')}
                                        </th>
                                        <td className="py-1 break-words">{selected.title || '—'}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_score_7d')}
                                        </th>
                                        <td className="py-1">{selected.score7d}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_total_copies')}
                                        </th>
                                        <td className="py-1">{selected.copyCount}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.featured_created')}
                                        </th>
                                        <td className="py-1">
                                            {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_owner')}
                                        </th>
                                        <td className="py-1 font-mono">
                                            {selected.ownerUidSuffix || t('admin.popular_no_owner')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="border-t border-app-border pt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleToggle(selected, 'featured', !selected.featured)}
                                    disabled={patching || selected.hidden}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                                        selected.featured
                                            ? 'text-app-yellow hover:bg-app-yellow-dim'
                                            : 'bg-app-blue text-white hover:bg-app-blue-hover'
                                    }`}
                                >
                                    {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={selected.featured ? 'currentColor' : 'none'} />}
                                    {selected.featured
                                        ? t('admin.featured_unset_button')
                                        : t('admin.featured_set_button')}
                                </button>
                                <button
                                    onClick={() => handleToggle(selected, 'hidden', !selected.hidden)}
                                    disabled={patching}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                                        selected.hidden
                                            ? 'text-app-text border border-app-text hover:bg-app-surface2'
                                            : 'text-app-red border border-app-red-border hover:bg-app-red-dim'
                                    }`}
                                >
                                    {patching ? <Loader2 size={14} className="animate-spin" /> : selected.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                    {selected.hidden
                                        ? t('admin.popular_unhide_button')
                                        : t('admin.popular_hide_button')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
