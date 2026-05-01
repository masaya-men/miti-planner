// src/components/PipView.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { usePipNotes } from '../hooks/usePipNotes';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
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
    /** PC版: 閉じるボタンを表示（mode prop は呼び出し側互換性のため維持） */
    mode: 'pip' | 'fullscreen';
    onClose: () => void;
}

const PipView: React.FC<PipViewProps> = ({ onClose }) => {
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

    // ── メンバー選択トグル ──
    const toggleMemberSelection = useCallback((memberId: string) => {
        setSelectedMemberIds(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) next.delete(memberId);
            else next.add(memberId);
            return next;
        });
    }, []);

    const selectAllMembers = useCallback(() => {
        setSelectedMemberIds(new Set(partyMembers.filter(m => m.jobId).map(m => m.id)));
    }, [partyMembers]);

    const deselectAllMembers = useCallback(() => {
        setSelectedMemberIds(new Set());
    }, []);

    // ── ジョブメニュー ──
    const [jobMenuOpen, setJobMenuOpen] = useState(false);

    // ── メモ編集 ──
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // 攻撃名のダブルクリック → 編集モードに
    const handleDoubleClick = useCallback((eventId: string) => {
        setEditingEventId(eventId);
    }, []);

    // 編集確定
    const handleEditConfirm = useCallback((eventId: string, value: string) => {
        updateNote(eventId, value.trim());
        setEditingEventId(null);
    }, [updateNote]);

    // 編集中にフォーカス
    useEffect(() => {
        if (editingEventId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingEventId]);

    // ── アクティブメンバー（jobId 設定済み）──
    const activeMembers = useMemo(() =>
        partyMembers.filter(m => m.jobId).map(m => ({
            ...m,
            job: JOBS.find(j => j.id === m.jobId),
        })),
        [partyMembers, JOBS]
    );

    // ── 代表ジョブ（ボタン表示用）──
    const representativeJob = useMemo(() => {
        const firstId = [...selectedMemberIds][0];
        if (!firstId) return null;
        const member = partyMembers.find(m => m.id === firstId);
        return member ? JOBS.find(j => j.id === member.jobId) ?? null : null;
    }, [partyMembers, selectedMemberIds, JOBS]);

    // 追加選択数（2人目以降の数）
    const extraCount = selectedMemberIds.size > 1 ? selectedMemberIds.size - 1 : 0;

    // ── cueItems（純粋関数で多選フィルタ → hydrate）──
    const cueItemsRaw = useMemo(
        () => computeCueItems(timelineEvents, timelineMitigations, selectedMemberIds),
        [timelineEvents, timelineMitigations, selectedMemberIds],
    );

    const cueItems = useMemo(() => cueItemsRaw.map(({ event, mitigations }) => ({
        event,
        mitigations: mitigations
            .map(m => {
                const def = MITIGATIONS.find(d => d.id === m.mitigationId);
                return def ? { applied: m, definition: def } : null;
            })
            .filter(Boolean) as { applied: AppliedMitigation; definition: typeof MITIGATIONS[number] }[],
    })), [cueItemsRaw, MITIGATIONS]);

    // ── ジョブメニュー外クリックで閉じる ──
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!jobMenuOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setJobMenuOpen(false);
            }
        };
        const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
        return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
    }, [jobMenuOpen]);

    return (
        <div
            className="flex flex-col h-full select-none"
            style={{ background: bgColor }}
        >
            {/* ── ツールバー ── */}
            <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 border-b border-white/10">

                {/* ジョブピッカーボタン + Popover */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setJobMenuOpen(!jobMenuOpen)}
                        className="h-6 px-1 rounded border border-white/20 flex items-center gap-0.5 cursor-pointer hover:border-white/40 transition-colors"
                        title={t('timeline.pip_switch_job')}
                    >
                        {selectedMemberIds.size === 0 ? (
                            <span className="text-[9px] text-white/50">?</span>
                        ) : (
                            <>
                                {representativeJob ? (
                                    <img src={representativeJob.icon} className="w-4 h-4 object-contain" />
                                ) : (
                                    <span className="text-[9px] text-white/50">?</span>
                                )}
                                {extraCount > 0 && (
                                    <span className="text-[8px] text-white/60 font-mono">+{extraCount}</span>
                                )}
                            </>
                        )}
                    </button>

                    {/* 多選 Popover メニュー */}
                    {jobMenuOpen && (
                        <div className="absolute top-7 left-0 z-50 bg-black/95 border border-white/20 rounded-md p-1.5 w-[160px]">
                            {/* 全員 / 解除 ボタン */}
                            <div className="flex gap-1 mb-1.5">
                                <button
                                    onClick={selectAllMembers}
                                    className="flex-1 text-[9px] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded px-1 py-0.5 transition-colors"
                                >
                                    {t('timeline.pip_select_all')}
                                </button>
                                <button
                                    onClick={deselectAllMembers}
                                    className="flex-1 text-[9px] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded px-1 py-0.5 transition-colors"
                                >
                                    {t('timeline.pip_deselect_all')}
                                </button>
                            </div>

                            {/* メンバートグル */}
                            <div className="flex flex-wrap gap-0.5">
                                {activeMembers.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => toggleMemberSelection(m.id)}
                                        className={clsx(
                                            "w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors",
                                            selectedMemberIds.has(m.id)
                                                ? "bg-white/25 ring-1 ring-white/40"
                                                : "hover:bg-white/10"
                                        )}
                                        title={m.id}
                                    >
                                        {m.job && <img src={m.job.icon} className="w-4 h-4 object-contain" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* スペーサー */}
                <div className="flex-1" />

                {/* 背景カラーピッカー（小色丸ボタン + 隠し input） */}
                <div className="relative">
                    <button
                        onClick={() => colorInputRef.current?.click()}
                        className="w-4 h-4 rounded-full border border-white/40 cursor-pointer hover:border-white/70 transition-colors shrink-0"
                        style={{ background: bgColor }}
                        title={t('timeline.pip_bg_color')}
                    />
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

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="w-5 h-5 rounded flex items-center justify-center cursor-pointer text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title={t('timeline.pip_close')}
                >
                    <X size={10} />
                </button>
            </div>

            {/* ── カンペリスト ── */}
            <div className="flex-1 overflow-y-auto px-1.5 py-1">
                {cueItems.length === 0 ? (
                    <p className="text-white/40 text-[10px] text-center mt-4">
                        {t('timeline.pip_no_mitigations')}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {cueItems.map(({ event, mitigations }, i) => (
                            <div
                                key={event.id}
                                className={clsx(
                                    "flex items-center gap-1 py-0.5 px-1",
                                    i % 2 === 0 && "bg-white/[0.03]"
                                )}
                            >
                                {/* 時間 */}
                                <span className="text-white/40 text-[10px] font-mono w-8 shrink-0 text-right">
                                    {formatTime(event.time)}
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

                                {/* 軽減スキルアイコン */}
                                <div className="flex items-center shrink-0">
                                    {mitigations.map(({ applied, definition }) => (
                                        <img
                                            key={applied.id}
                                            src={definition.icon}
                                            className="w-4 h-4 object-contain"
                                            title={definition.name[lang] || definition.name.ja || definition.name.en || ''}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PipView;
