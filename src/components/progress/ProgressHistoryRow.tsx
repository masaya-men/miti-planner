// 進捗履歴の1行 — フェーズ名/最高/メモ（1行目）＋ バー/％/日時（2行目）＋ 右ガターのゴミ箱
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ProgressPoint } from '../../types';
import { pointPercent, formatTimeOfDay, formatMonthDay, dayBucket } from '../../lib/progressLogic';

interface ProgressHistoryRowProps {
    point: ProgressPoint;
    index: number;        // points 配列内の実 index
    isBest: boolean;
    totalSec: number;
    phaseLabel: string;   // 事前算出済み（フェーズ名 or "m:ss 地点"）
    onDelete: (index: number) => void;
    onSetNote: (index: number, note: string) => void;
}

const ProgressHistoryRow: React.FC<ProgressHistoryRowProps> = ({
    point, index, isBest, totalSec, phaseLabel, onDelete, onSetNote,
}) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const pct = pointPercent(point.reachedPos, totalSec);

    // 日時ラベル（JST・今日/昨日/M/D）
    const bucket = dayBucket(point.ts, Date.now());
    const time = formatTimeOfDay(point.ts);
    const dateLabel =
        bucket === 'today' ? `${t('progress.today', '今日')} ${time}`
        : bucket === 'yesterday' ? `${t('progress.yesterday', '昨日')} ${time}`
        : `${formatMonthDay(point.ts)} ${time}`;

    const startEdit = () => { setDraft(point.note ?? ''); setEditing(true); };
    const commit = () => { setEditing(false); if ((point.note ?? '') !== draft.trim()) onSetNote(index, draft); };

    return (
        <div className="group flex items-stretch border-b border-app-border/60 last:border-b-0 md:hover:bg-app-blue/5 transition-colors">
            <div className="flex-1 min-w-0 py-2.5 pl-3.5 pr-1">
                {/* 1行目: フェーズ / 最高 / メモ */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-blue shrink-0" style={{ boxShadow: '0 0 6px var(--app-blue)' }} />
                    <span className="text-app-sm font-semibold text-app-text shrink-0">{phaseLabel}</span>
                    {isBest && (
                        <span className="text-app-2xs font-black text-app-blue border border-app-blue/45 rounded px-1 shrink-0">
                            {t('progress.best', '最高')}
                        </span>
                    )}
                    {editing ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value.slice(0, 60))}
                            onBlur={commit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') { setEditing(false); }
                            }}
                            placeholder={t('progress.memo_placeholder', 'ひとことメモ')}
                            className="flex-1 min-w-0 text-app-xs text-app-text bg-app-blue/5 border border-app-blue/50 rounded px-1.5 py-0.5 outline-none"
                        />
                    ) : point.note ? (
                        <span onClick={startEdit} className="flex-1 min-w-0 text-app-xs italic text-app-text-sec truncate cursor-text">
                            {point.note}
                        </span>
                    ) : (
                        <span onClick={startEdit} className="flex-1 min-w-0 text-app-2xs text-app-text-muted cursor-text">
                            {t('progress.add_memo', '＋メモ')}
                        </span>
                    )}
                </div>
                {/* 2行目: バー / ％ / 日時 */}
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 min-w-0 h-1.5 rounded-full bg-app-blue/15 overflow-hidden">
                        <div className="h-full rounded-full bg-app-blue" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-app-xs font-black text-app-blue tabular-nums shrink-0">{pct}%</span>
                    <span className="text-app-2xs text-app-text-muted tabular-nums shrink-0">{dateLabel}</span>
                </div>
            </div>
            {/* 右ガター: ゴミ箱（PCはホバーで出現・スマホは常時） */}
            <button
                onClick={() => onDelete(index)}
                aria-label={t('progress.delete_record', 'この記録を削除')}
                className={clsx(
                    'w-11 shrink-0 flex items-center justify-center border-l border-app-border/60',
                    'text-app-text-muted hover:text-app-red transition-all duration-200 cursor-pointer active:scale-90',
                    'md:opacity-0 md:group-hover:opacity-100'
                )}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

export default ProgressHistoryRow;
