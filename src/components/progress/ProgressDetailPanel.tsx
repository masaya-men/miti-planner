// 進捗詳細パネル — 到達点の履歴（新しい順）/ 個別削除＋インラインUndo / 全消去（確認ダイアログ）
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getPhaseName, type ProgressPoint } from '../../types';
import { phaseAtTime, formatClock } from '../../lib/progressLogic';
import { ConfirmDialog } from '../ConfirmDialog';
import ProgressHistoryRow from './ProgressHistoryRow';

const ProgressDetailPanel: React.FC<{ open: boolean }> = ({ open }) => {
    const { t } = useTranslation();
    const contentLanguage = useThemeStore((s) => s.contentLanguage);
    const points = useMitigationStore((s) => s.progress.points);
    const phases = useMitigationStore((s) => s.phases);
    const timelineEvents = useMitigationStore((s) => s.timelineEvents);
    const removeProgressPoint = useMitigationStore((s) => s.removeProgressPoint);
    const clearAllProgressPoints = useMitigationStore((s) => s.clearAllProgressPoints);
    const setProgressPointNote = useMitigationStore((s) => s.setProgressPointNote);
    const insertProgressPointAt = useMitigationStore((s) => s.insertProgressPointAt);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pending, setPending] = useState<{ point: ProgressPoint; index: number } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const totalSec = timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0;
    const maxReached = points.length ? Math.max(...points.map((p) => p.reachedPos)) : -1;
    const bestIndex = points.findIndex((p) => p.reachedPos === maxReached);

    const labelFor = (p: ProgressPoint): string => {
        const ph = phaseAtTime(phases, p.reachedPos);
        return ph ? getPhaseName(ph.name, contentLanguage) : `${formatClock(p.reachedPos)} ${t('progress.reach_at_suffix', '地点')}`;
    };

    const handleDelete = (index: number) => {
        const point = points[index];
        if (!point) return;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        removeProgressPoint(index);
        setPending({ point, index });
        undoTimer.current = setTimeout(() => setPending(null), 5000);
    };
    const handleUndo = () => {
        if (!pending) return;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        insertProgressPointAt(pending.index, pending.point);
        setPending(null);
    };

    return (
        <div className="progress-detail" data-open={open}><div className="progress-detail-inner">
        <div className="border-t border-app-border progress-detail-content">
            {/* 見出し */}
            <div className="flex items-center justify-between px-3.5 py-2">
                <span className="text-app-xs font-bold text-app-text">
                    {t('progress.detail_title', '到達の記録')}
                </span>
                <span className="text-app-2xs text-app-text-muted">({points.length})</span>
            </div>

            {/* インラインUndo帯 */}
            {pending && (
                <div className="flex items-center justify-center gap-3 px-3.5 py-1.5 bg-app-blue/5 border-y border-app-border">
                    <span className="text-app-2xs text-app-text-sec">{t('progress.deleted_one', '1件削除しました')}</span>
                    <button onClick={handleUndo}
                        className="flex items-center gap-1 text-app-2xs font-bold text-app-blue hover:underline cursor-pointer active:scale-95">
                        <Undo2 size={12} /> {t('progress.undo', '元に戻す')}
                    </button>
                </div>
            )}

            {points.length === 0 ? (
                <div className="px-3.5 py-6 text-center">
                    <div className="text-app-sm text-app-text-sec font-semibold">{t('progress.empty_title', 'まだ記録がありません')}</div>
                    <div className="text-app-2xs text-app-text-muted mt-1">{t('progress.empty_hint', 'タイムラインの到達した時間をクリックで記録')}</div>
                </div>
            ) : (
                <>
                    {/* リスト（新しい順）— 表示は reverse だが操作は実 index */}
                    <div className="overflow-y-auto" style={{ maxHeight: '190px' }}>
                        {points.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => (
                            <ProgressHistoryRow
                                key={p.ts}
                                point={p}
                                index={i}
                                isBest={i === bestIndex}
                                totalSec={totalSec}
                                phaseLabel={labelFor(p)}
                                onDelete={handleDelete}
                                onSetNote={setProgressPointNote}
                            />
                        ))}
                    </div>
                    {/* フッター: 全消去 */}
                    <div className="flex justify-center px-3.5 py-2 border-t border-app-border">
                        <button onClick={() => setConfirmOpen(true)}
                            className="text-app-2xs text-app-red border border-app-red/35 rounded-md px-3 py-1 hover:bg-app-red/10 transition-all duration-200 cursor-pointer active:scale-95">
                            {t('progress.clear_all', '全消去')}
                        </button>
                    </div>
                </>
            )}

            <ConfirmDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => { clearAllProgressPoints(); setConfirmOpen(false); }}
                title={t('progress.clear_all_confirm_title', '全消去')}
                message={t('progress.clear_all_confirm_message', { count: points.length, defaultValue: '到達記録 {{count}} 件をすべて消します。元に戻せません。' })}
                confirmLabel={t('progress.clear_all_confirm_ok', '全部消す')}
                variant="danger"
            />
        </div></div></div>
    );
};

export default ProgressDetailPanel;
