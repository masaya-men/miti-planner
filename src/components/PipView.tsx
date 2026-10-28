// src/components/PipView.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useThemeStore } from '../store/useThemeStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { usePipNotes } from '../hooks/usePipNotes';
import { useShallow } from 'zustand/react/shallow';
import type { AppliedMitigation } from '../types';
import {
    computeCueItems,
    computeInitialSelection,
    getDefaultBgColor,
    isBgLight,
} from '../utils/pipViewLogic';
import { filterCheatSheetMitigations } from '../utils/cheatSheetFilters';
import { PipToolbar } from './pip/PipToolbar';
import { PipCueList } from './pip/PipCueList';
import { PipEditMenu } from './pip/PipEditMenu';

interface PipViewProps {
    /** 'pip'=PC別ウィンドウ, 'fullscreen'=スマホ全画面（X 閉じボタン表示） */
    mode: 'pip' | 'fullscreen';
    onClose: () => void;
}

const PipView: React.FC<PipViewProps> = ({ mode, onClose }) => {
    const { i18n } = useTranslation();
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

    // ── カンペ非表示の軽減（挑発/エーテルフロー/ドロー系=軽減でないユーティリティ技）──
    //    CheatSheetView と同じ filterCheatSheetMitigations で除外条件を一箇所に統一(表示専用)
    const filteredMitigations = useMemo(
        () => filterCheatSheetMitigations(timelineMitigations, id => MITIGATIONS.find(d => d.id === id)),
        [timelineMitigations, MITIGATIONS],
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
            <PipToolbar
                mode={mode}
                isFs={isFs}
                onClose={onClose}
                theme={theme}
                allSelected={allSelected}
                onAllClick={onAllClick}
                activeMembers={activeMembers}
                selectedMemberIds={selectedMemberIds}
                toggleMemberSelection={toggleMemberSelection}
                bgColor={bgColor}
                colorInputRef={colorInputRef}
                handleBgColorChange={handleBgColorChange}
                resetBgColor={resetBgColor}
            />

            {/* ── カンペリスト（スクロールバー非表示） ── */}
            <PipCueList
                isFs={isFs}
                lang={lang}
                fgColor={fgColor}
                cueGroups={cueGroups}
                eventIndexByTime={eventIndexByTime}
                cycleEventAtTime={cycleEventAtTime}
                notes={notes}
                updateNote={updateNote}
                editingEventId={editingEventId}
                setEditingEventId={setEditingEventId}
                editInputRef={editInputRef}
                handleEditConfirm={handleEditConfirm}
                handleDoubleClick={handleDoubleClick}
                setMenuTime={setMenuTime}
            />

            {/* スマホ全画面: 編集モーダル */}
            {isFs && menuTime !== null && (
                <PipEditMenu
                    menuTime={menuTime}
                    lang={lang}
                    fgColor={fgColor}
                    cueGroups={cueGroups}
                    eventIndexByTime={eventIndexByTime}
                    setEventIndexByTime={setEventIndexByTime}
                    notes={notes}
                    editingEventId={editingEventId}
                    setEditingEventId={setEditingEventId}
                    editInputRef={editInputRef}
                    handleEditConfirm={handleEditConfirm}
                    closeMenu={closeMenu}
                />
            )}
        </div>
    );
};

export default PipView;
