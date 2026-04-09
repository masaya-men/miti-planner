// src/components/PipView.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { usePipNotes } from '../hooks/usePipNotes';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { AppliedMitigation } from '../types';

/** 時間(秒)を mm:ss 形式に変換 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PipViewProps {
    /** PC版: 透過率スライダーと閉じるボタンを表示 */
    mode: 'pip' | 'fullscreen';
    onClose: () => void;
}

const PipView: React.FC<PipViewProps> = ({ mode, onClose }) => {
    const { t, i18n } = useTranslation();
    const JOBS = useJobs();
    const MITIGATIONS = useMitigations();

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

    // 表示中のメンバーID（デフォルトは自分のジョブ）
    const [selectedMemberId, setSelectedMemberId] = useState<string>(myMemberId || 'MT');
    const [opacity, setOpacity] = useState(0.85);
    const [jobMenuOpen, setJobMenuOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // 選択中メンバーのジョブ
    const selectedJob = useMemo(() => {
        const member = partyMembers.find(m => m.id === selectedMemberId);
        return member ? JOBS.find(j => j.id === member.jobId) : null;
    }, [partyMembers, selectedMemberId, JOBS]);

    // 選択メンバーの軽減 → 該当イベントだけ抽出
    const cueItems = useMemo(() => {
        const memberMitis = timelineMitigations.filter(m => m.ownerId === selectedMemberId);
        if (memberMitis.length === 0) return [];

        // 軽減が配置されているイベント時間のセットを作る
        const mitiTimes = new Set(memberMitis.map(m => m.time));

        // イベントを時間順にフィルタ
        const events = timelineEvents
            .filter(e => mitiTimes.has(e.time))
            .sort((a, b) => a.time - b.time);

        return events.map(event => ({
            event,
            mitigations: memberMitis
                .filter(m => m.time === event.time)
                .map(m => {
                    const mitDef = MITIGATIONS.find(d => d.id === m.mitigationId);
                    return mitDef ? { applied: m, definition: mitDef } : null;
                })
                .filter(Boolean) as { applied: AppliedMitigation; definition: typeof MITIGATIONS[number] }[],
        }));
    }, [timelineEvents, timelineMitigations, selectedMemberId, MITIGATIONS]);

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

    // ジョブがセットされているメンバーだけ切替対象
    const activeMembers = useMemo(() =>
        partyMembers.filter(m => m.jobId).map(m => ({
            ...m,
            job: JOBS.find(j => j.id === m.jobId),
        })),
        [partyMembers, JOBS]
    );

    // ジョブメニュー外クリックで閉じる
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
            style={mode === 'pip' ? { background: `rgba(15, 15, 16, ${opacity})` } : { background: '#0F0F10' }}
        >
            {/* ── ツールバー ── */}
            <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 border-b border-white/10">
                {/* ジョブアイコン + Popover切替 */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setJobMenuOpen(!jobMenuOpen)}
                        className="w-6 h-6 rounded border border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                    >
                        {selectedJob ? (
                            <img src={selectedJob.icon} className="w-4 h-4 object-contain" />
                        ) : (
                            <span className="text-[9px] text-white/50">?</span>
                        )}
                    </button>

                    {/* ジョブ切替メニュー */}
                    {jobMenuOpen && (
                        <div className="absolute top-7 left-0 z-50 bg-black/95 border border-white/20 rounded-md p-1 flex flex-wrap gap-0.5 w-[140px]">
                            {activeMembers.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => { setSelectedMemberId(m.id); setJobMenuOpen(false); }}
                                    className={clsx(
                                        "w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors",
                                        m.id === selectedMemberId
                                            ? "bg-white/25 ring-1 ring-white/40"
                                            : "hover:bg-white/10"
                                    )}
                                    title={m.id}
                                >
                                    {m.job && <img src={m.job.icon} className="w-4 h-4 object-contain" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 選択中メンバーID */}
                <span className="text-[9px] font-bold text-white/50 w-5">{selectedMemberId}</span>

                {/* 透過率スライダー（PC PiPモードのみ） */}
                {mode === 'pip' && (
                    <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        className="flex-1 h-0.5 accent-white/60 cursor-pointer"
                    />
                )}

                {/* スマホモードではスペーサー */}
                {mode === 'fullscreen' && <div className="flex-1" />}

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="w-5 h-5 rounded flex items-center justify-center cursor-pointer text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
