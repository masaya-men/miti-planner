// src/components/PipView.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { usePipNotes } from '../hooks/usePipNotes';
import { useShallow } from 'zustand/react/shallow';
import { X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import type { AppliedMitigation } from '../types';
import {
    computeCueItems,
    computeInitialSelection,
    getDefaultBgColor,
} from '../utils/pipViewLogic';

/** 時間(秒)を mm:ss 形式に変換 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PipViewProps {
    /** 'pip'=PC別ウィンドウ, 'fullscreen'=スマホ全画面（X 閉じボタン表示） */
    mode: 'pip' | 'fullscreen';
    onClose: () => void;
}

const PipView: React.FC<PipViewProps> = ({ mode, onClose }) => {
    const { t, i18n } = useTranslation();
    const JOBS = useJobs();
    const MITIGATIONS = useMitigations();
    const theme = useThemeStore(s => s.theme);

    const { timelineEvents, timelineMitigations, partyMembers, myMemberId } = useMitigationStore(
        useShallow(s => ({
            timelineEvents: s.timelineEvents,
            timelineMitigations: s.timelineMitigations,
            partyMembers: s.partyMembers,
            myMemberId: s.myMemberId,
        }))
    );

    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const { notes, updateNote } = usePipNotes(currentPlanId);
    const lang = (i18n.language || 'ja') as 'ja' | 'en' | 'zh' | 'ko';

    // ── 多選 state ──
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
        () => computeInitialSelection(myMemberId, partyMembers),
    );

    // ── 背景色 state ──
    const [bgColor, setBgColor] = useState<string>(() => {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pip-bg-color') : null;
        return getDefaultBgColor(theme, stored);
    });
    const colorInputRef = useRef<HTMLInputElement>(null);

    const handleBgColorChange = useCallback((color: string) => {
        setBgColor(color);
        try { localStorage.setItem('pip-bg-color', color); } catch { /* quota */ }
    }, []);

    const resetBgColor = useCallback(() => {
        try { localStorage.removeItem('pip-bg-color'); } catch { /* quota */ }
        setBgColor(getDefaultBgColor(theme, null));
    }, [theme]);

    // ── メンバー選択トグル ──
    const toggleMemberSelection = useCallback((memberId: string) => {
        setSelectedMemberIds(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) next.delete(memberId);
            else next.add(memberId);
            return next;
        });
    }, []);

    // ── メモ編集 ──
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    const handleDoubleClick = useCallback((eventId: string) => {
        setEditingEventId(eventId);
    }, []);

    const handleEditConfirm = useCallback((eventId: string, value: string) => {
        updateNote(eventId, value.trim());
        setEditingEventId(null);
    }, [updateNote]);

    useEffect(() => {
        if (editingEventId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingEventId]);

    // ── アクティブメンバー（jobId 設定済み） ──
    const activeMembers = useMemo(() =>
        partyMembers.filter(m => m.jobId).map(m => ({
            ...m,
            job: JOBS.find(j => j.id === m.jobId),
        })),
        [partyMembers, JOBS]
    );

    // ── ALL ボタンの状態（全アクティブメンバーが選択中か） ──
    const allSelected = activeMembers.length > 0 && activeMembers.every(m => selectedMemberIds.has(m.id));

    const onAllClick = useCallback(() => {
        if (allSelected) {
            setSelectedMemberIds(new Set());
        } else {
            setSelectedMemberIds(new Set(activeMembers.map(m => m.id)));
        }
    }, [allSelected, activeMembers]);

    // ── cueGroups（純粋関数で多選フィルタ → hydrate） ──
    const cueGroupsRaw = useMemo(
        () => computeCueItems(timelineEvents, timelineMitigations, selectedMemberIds),
        [timelineEvents, timelineMitigations, selectedMemberIds],
    );

    const cueGroups = useMemo(() => cueGroupsRaw.map(({ time, events, mitigations }) => ({
        time,
        events,
        mitigations: mitigations
            .map(m => {
                const def = MITIGATIONS.find(d => d.id === m.mitigationId);
                return def ? { applied: m, definition: def } : null;
            })
            .filter(Boolean) as { applied: AppliedMitigation; definition: typeof MITIGATIONS[number] }[],
    })), [cueGroupsRaw, MITIGATIONS]);

    // ── 同時刻イベントの表示切替 state（time → 表示中の event index） ──
    const [eventIndexByTime, setEventIndexByTime] = useState<Record<number, number>>({});
    const cycleEventAtTime = useCallback((time: number, total: number) => {
        setEventIndexByTime(prev => ({
            ...prev,
            [time]: ((prev[time] ?? 0) + 1) % total,
        }));
    }, []);

    return (
        <div
            className="flex flex-col h-full select-none"
            style={{ background: bgColor }}
        >
            {/* ── ツールバー（2 段構成） ── */}
            <div className="shrink-0 border-b border-white/10">
                {/* 1 段目: ALL + アクティブメンバージョブアイコン横並び */}
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                    <button
                        onClick={onAllClick}
                        className={clsx(
                            "h-6 px-2 rounded text-[9px] font-bold tracking-wider cursor-pointer transition-colors shrink-0",
                            allSelected
                                ? "bg-white/30 text-white"
                                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/90"
                        )}
                    >
                        ALL
                    </button>
                    {activeMembers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => toggleMemberSelection(m.id)}
                            className={clsx(
                                "w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all shrink-0",
                                selectedMemberIds.has(m.id)
                                    ? "bg-white/25 ring-1 ring-white/40"
                                    : "opacity-40 hover:opacity-100 hover:bg-white/10"
                            )}
                            title={m.id}
                        >
                            {m.job && <img src={m.job.icon} className="w-4 h-4 object-contain" alt="" />}
                        </button>
                    ))}
                </div>

                {/* 2 段目: スペーサー + カラーピッカー + リセット + (fullscreen のみ閉じる) */}
                <div className="flex items-center gap-1 px-2 pb-1.5">
                    <div className="flex-1" />

                    {/* カラーピッカー: 色相環 + 中央に現在色 */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => colorInputRef.current?.click()}
                            className="relative w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform"
                            style={{
                                background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            }}
                            title={t('timeline.pip_bg_color')}
                        >
                            <span
                                className="absolute inset-1 rounded-full border border-white/30 block"
                                style={{ background: bgColor }}
                            />
                        </button>
                        <input
                            ref={colorInputRef}
                            type="color"
                            value={bgColor}
                            onChange={e => handleBgColorChange(e.target.value)}
                            className="absolute opacity-0 w-0 h-0 pointer-events-none"
                            tabIndex={-1}
                            aria-hidden
                        />
                    </div>

                    {/* リセットボタン */}
                    <button
                        onClick={resetBgColor}
                        className="w-5 h-5 rounded flex items-center justify-center cursor-pointer text-white/40 hover:text-white/90 hover:bg-white/10 transition-colors shrink-0"
                        title={t('timeline.pip_reset_color')}
                    >
                        <RotateCcw size={11} />
                    </button>

                    {/* 閉じるボタン（fullscreen のみ。PC PiP は Chrome ネイティブ閉じるに任せる） */}
                    {mode === 'fullscreen' && (
                        <button
                            onClick={onClose}
                            className="w-5 h-5 rounded flex items-center justify-center cursor-pointer text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title={t('timeline.pip_close')}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── カンペリスト（スクロールバー非表示） ── */}
            <div
                className="flex-1 overflow-y-auto px-1.5 py-1 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
            >
                {cueGroups.length === 0 ? (
                    <p className="text-white/40 text-[10px] text-center mt-4">
                        {t('timeline.pip_no_mitigations')}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {cueGroups.map(({ time, events, mitigations }, i) => {
                            const idx = (eventIndexByTime[time] ?? 0) % events.length;
                            const event = events[idx];
                            const hasExtra = events.length > 1;
                            return (
                                <div
                                    key={time}
                                    className={clsx(
                                        "flex items-center gap-1 py-0.5 px-1",
                                        i % 2 === 0 && "bg-white/[0.03]"
                                    )}
                                >
                                    {/* 時間 */}
                                    <span className="text-white/40 text-[10px] font-mono w-8 shrink-0 text-right">
                                        {formatTime(time)}
                                    </span>

                                    {/* 攻撃名（ダブルクリックで編集） */}
                                    {editingEventId === event.id ? (
                                        <input
                                            ref={editInputRef}
                                            defaultValue={notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                            onBlur={(e) => handleEditConfirm(event.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditConfirm(event.id, (e.target as HTMLInputElement).value);
                                                if (e.key === 'Escape') setEditingEventId(null);
                                            }}
                                            className="flex-1 min-w-0 bg-white/10 border border-white/30 rounded px-1 py-0 text-[10px] text-white outline-none"
                                        />
                                    ) : (
                                        <span
                                            onDoubleClick={() => handleDoubleClick(event.id)}
                                            className={clsx(
                                                "flex-1 min-w-0 text-[10px] truncate cursor-default leading-tight",
                                                notes[event.id] ? "text-yellow-300" : "text-white/80"
                                            )}
                                            title={t('timeline.pip_edit_hint')}
                                        >
                                            {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                        </span>
                                    )}

                                    {/* +1 切替バッジ（同時刻に他のイベントがあるとき） */}
                                    {hasExtra && (
                                        <button
                                            onClick={() => cycleEventAtTime(time, events.length)}
                                            className="shrink-0 px-1 rounded bg-white/10 hover:bg-white/25 text-white/60 hover:text-white text-[8px] font-mono cursor-pointer transition-colors"
                                            title={t('timeline.pip_switch_event')}
                                        >
                                            +{events.length - 1}
                                        </button>
                                    )}

                                    {/* 軽減スキルアイコン */}
                                    <div className="flex items-center shrink-0">
                                        {mitigations.map(({ applied, definition }) => (
                                            <img
                                                key={applied.id}
                                                src={definition.icon}
                                                className="w-4 h-4 object-contain"
                                                title={definition.name[lang] || definition.name.ja || definition.name.en || ''}
                                                alt=""
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PipView;
