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
    isBgLight,
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

    // ── モーダル開閉 state（スマホ時のみ。null = 閉じている） ──
    const [menuTime, setMenuTime] = useState<number | null>(null);

    const closeMenu = useCallback(() => {
        setMenuTime(null);
        setEditingEventId(null);
    }, []);

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

    // ── PiP 非表示の軽減（自動配置の常駐スキル）──
    const filteredMitigations = useMemo(
        () => timelineMitigations.filter(m => m.mitigationId !== 'aetherflow'),
        [timelineMitigations],
    );

    // ── cueGroups（純粋関数で多選フィルタ → hydrate） ──
    const cueGroupsRaw = useMemo(
        () => computeCueItems(timelineEvents, filteredMitigations, selectedMemberIds),
        [timelineEvents, filteredMitigations, selectedMemberIds],
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

    // ── 背景色から文字色を自動切替（ライト bg → 暗文字、ダーク bg → 明文字） ──
    const fgColor = isBgLight(bgColor) ? '#171717' : '#F0F0F0';

    // ── スマホ全画面のときだけサイズを大きくする（PC PiP は現状維持） ──
    const isFs = mode === 'fullscreen';

    return (
        <div
            className="flex flex-col h-full select-none"
            style={{ background: bgColor, color: fgColor }}
        >
            {/* ── ツールバー（1 段構成） ── */}
            <div className={clsx(
                "shrink-0 border-b border-current/10 flex items-center",
                isFs ? "gap-2 px-2 py-1.5" : "gap-1 px-1.5 py-1",
            )}>
                {/* ALL ボタン */}
                <button
                    onClick={onAllClick}
                    className={clsx(
                        "rounded font-bold tracking-wider cursor-pointer transition-colors shrink-0",
                        isFs ? "h-8 px-3 text-xs" : "h-5 px-1.5 text-[9px]",
                        allSelected
                            ? "bg-current/30 text-current"
                            : "bg-current/10 text-current/60 hover:bg-current/20 hover:text-current/90"
                    )}
                >
                    ALL
                </button>

                {/* ジョブアイコン横並び（横スクロール可、スクロールバー非表示、右端フェード） */}
                <div
                    className="flex items-center min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                    style={{
                        scrollbarWidth: 'none',
                        ...(isFs && {
                            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 50px), transparent)',
                            maskImage: 'linear-gradient(to right, black calc(100% - 50px), transparent)',
                        }),
                    }}
                >
                    {activeMembers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => toggleMemberSelection(m.id)}
                            className={clsx(
                                "flex items-center justify-center cursor-pointer shrink-0",
                                isFs ? "w-9 h-9" : "w-5 h-5",
                            )}
                            title={m.id}
                        >
                            {m.job && (
                                <img
                                    src={m.job.icon}
                                    className={clsx(
                                        "object-contain transition-opacity",
                                        isFs ? "w-[28px] h-[28px]" : "w-[18px] h-[18px]",
                                        selectedMemberIds.has(m.id) ? "opacity-100" : "opacity-30 hover:opacity-60",
                                    )}
                                    alt=""
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* スペーサー */}
                <div className="flex-1 min-w-0" />

                {/* カラーピッカー: 細リム色相環 + 中央に現在色（ラッパー div 廃止で flex 直下に） */}
                <button
                    onClick={() => colorInputRef.current?.click()}
                    className={clsx(
                        "relative rounded-full cursor-pointer hover:scale-110 transition-transform shrink-0",
                        isFs ? "w-8 h-8" : "w-5 h-5",
                    )}
                    style={{
                        background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                    title={t('timeline.pip_bg_color')}
                >
                    <span
                        className={clsx(
                            "absolute rounded-full block",
                            isFs ? "inset-[3px]" : "inset-[2px]",
                        )}
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
                {/* ↑ input は absolute + opacity-0 + w-0 h-0 で flex layout に影響しない */}

                {/* デフォルト色スウォッチ（クリックでリセット）。現在色 === デフォルトのとき半透明 */}
                {(() => {
                    const defaultColor = getDefaultBgColor(theme, null);
                    const isAtDefault = bgColor.toLowerCase() === defaultColor.toLowerCase();
                    return (
                        <button
                            onClick={resetBgColor}
                            disabled={isAtDefault}
                            className={clsx(
                                "rounded-full border border-current/30 transition-opacity shrink-0",
                                isFs ? "w-8 h-8" : "w-5 h-5",
                                isAtDefault
                                    ? "opacity-30 cursor-default"
                                    : "opacity-90 hover:opacity-100 hover:border-current/60 cursor-pointer"
                            )}
                            style={{ background: defaultColor }}
                            title={t('timeline.pip_reset_color')}
                        />
                    );
                })()}

                {/* 閉じるボタン（fullscreen のみ。PC PiP は Chrome ネイティブ閉じるに任せる） */}
                {mode === 'fullscreen' && (
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded flex items-center justify-center cursor-pointer text-current/40 hover:text-current hover:bg-current/10 transition-colors shrink-0"
                        title={t('timeline.pip_close')}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* ── カンペリスト（スクロールバー非表示） ── */}
            <div
                className={clsx(
                    "flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden",
                    isFs ? "px-2 py-1" : "px-1.5 py-1",
                )}
                style={{ scrollbarWidth: 'none' }}
            >
                {cueGroups.length === 0 ? (
                    <p className={clsx(
                        "text-current/40 text-center",
                        isFs ? "text-base mt-8" : "text-[10px] mt-4",
                    )}>
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
                                        "flex items-center",
                                        isFs ? "gap-2 py-2 px-2" : "gap-1 py-0.5 px-1",
                                        i % 2 === 0 && "bg-current/[0.03]"
                                    )}
                                >
                                    {/* 時間 */}
                                    <span className={clsx(
                                        "text-current/40 font-mono shrink-0 text-right",
                                        isFs ? "text-[15px] w-11" : "text-[10px] w-8",
                                    )}>
                                        {formatTime(time)}
                                    </span>

                                    {/* 攻撃名 + 切替バッジ（ダブルクリックで編集） */}
                                    <div className={clsx(
                                        "flex-1 min-w-0 flex items-center",
                                        isFs ? "gap-1.5" : "gap-1",
                                    )}>
                                        {editingEventId === event.id ? (
                                            <input
                                                ref={editInputRef}
                                                defaultValue={notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                onBlur={(e) => handleEditConfirm(event.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleEditConfirm(event.id, (e.target as HTMLInputElement).value);
                                                    if (e.key === 'Escape') setEditingEventId(null);
                                                }}
                                                className={clsx(
                                                    "flex-1 min-w-0 bg-current/10 border border-current/30 rounded outline-none",
                                                    isFs ? "text-[17px] px-1.5 py-1" : "text-[10px] px-1 py-0",
                                                )}
                                                style={{ color: fgColor }}
                                            />
                                        ) : (
                                            <>
                                                <span
                                                    onDoubleClick={!isFs ? () => handleDoubleClick(event.id) : undefined}
                                                    onClick={isFs ? () => setMenuTime(time) : undefined}
                                                    className={clsx(
                                                        "min-w-0 truncate leading-tight text-current/80",
                                                        isFs ? "text-[17px] font-bold cursor-pointer" : "text-[10px] cursor-text",
                                                    )}
                                                    title={t('timeline.pip_edit_hint')}
                                                >
                                                    {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                </span>
                                                {/* メモあり時のリセットボタン（× クリックで元の名前に戻る） */}
                                                {notes[event.id] && (
                                                    <button
                                                        onClick={() => updateNote(event.id, '')}
                                                        className={clsx(
                                                            "shrink-0 rounded opacity-50 hover:opacity-100 hover:bg-current/10 text-current/70 transition-opacity cursor-pointer",
                                                            isFs ? "p-1" : "p-0.5",
                                                        )}
                                                        title={t('timeline.pip_reset_note')}
                                                        aria-label={t('timeline.pip_reset_note')}
                                                    >
                                                        <X size={isFs ? 14 : 10} />
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* +N 切替バッジ（イベント名のおしり、同時刻に他のイベントがあるとき） */}
                                        {hasExtra && (
                                            <button
                                                onClick={() => cycleEventAtTime(time, events.length)}
                                                className={clsx(
                                                    "shrink-0 rounded bg-current/10 hover:bg-current/25 text-current/60 hover:text-current font-mono cursor-pointer transition-colors",
                                                    isFs ? "px-1.5 py-0.5 text-xs" : "px-1 text-[8px]",
                                                )}
                                                title={t('timeline.pip_switch_event')}
                                            >
                                                +{events.length - 1}
                                            </button>
                                        )}
                                    </div>

                                    {/* 軽減スキルアイコン */}
                                    <div className="flex items-center shrink-0">
                                        {mitigations.map(({ applied, definition }) => (
                                            <img
                                                key={applied.id}
                                                src={definition.icon}
                                                className={clsx(
                                                    "object-contain shrink-0",
                                                    isFs ? "w-[26px] h-[26px]" : "w-4 h-4",
                                                )}
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

            {/* スマホ全画面: 編集モーダル */}
            {isFs && menuTime !== null && (() => {
                const group = cueGroups.find(g => g.time === menuTime);
                if (!group) return null;
                return (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4"
                        onClick={closeMenu}
                    >
                        <div
                            className="relative glass-tier3 rounded-xl shadow-2xl w-full max-w-[360px] py-4 px-3"
                            onClick={e => e.stopPropagation()}
                            style={{ color: fgColor }}
                        >
                            <button
                                onClick={closeMenu}
                                className="absolute top-2 right-2 w-8 h-8 rounded flex items-center justify-center cursor-pointer text-current/40 hover:text-current hover:bg-current/10 transition-colors"
                                title={t('timeline.pip_close')}
                                aria-label={t('timeline.pip_close')}
                            >
                                <X size={18} />
                            </button>
                            <div className="flex flex-col gap-1 mt-2 pr-8">
                                {group.events.map((ev, evIdx) => {
                                    const displayName = notes[ev.id] || ev.name[lang] || ev.name.ja || ev.name.en || '';
                                    const isCurrentlyShown = evIdx === ((eventIndexByTime[group.time] ?? 0) % group.events.length);
                                    return (
                                        <div
                                            key={ev.id}
                                            className={clsx(
                                                "flex items-center gap-2 rounded-lg px-3 py-2 min-h-[44px]",
                                                isCurrentlyShown ? "bg-current/10" : "hover:bg-current/5",
                                            )}
                                        >
                                            <button
                                                onClick={() => {
                                                    if (!isCurrentlyShown) {
                                                        setEventIndexByTime(prev => ({ ...prev, [group.time]: evIdx }));
                                                    }
                                                    closeMenu();
                                                }}
                                                className="flex-1 min-w-0 text-left text-[17px] font-bold text-current/90 truncate cursor-pointer"
                                                title={isCurrentlyShown ? t('timeline.pip_already_shown', '表示中') : t('timeline.pip_switch_to', 'この攻撃に切替')}
                                            >
                                                {displayName}
                                            </button>
                                            {/* TODO: Task 3 で編集ボタンを追加 */}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default PipView;
