// 到達点記録パネル — PC: ヘッダー下のポップオーバー / スマホ: MobileBottomSheet
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useProgressRecording } from './useProgressRecording';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getPhaseName } from '../../types';
import { makeDayKey } from '../../lib/progressLogic';

// -------------------- フェーズジャンプボタン群 --------------------

/**
 * フェーズ一覧ボタン — クリックで `progress:jump-to-time` を発火し
 * Timeline.tsx 側の handleNavJump を呼び出す。
 * phases が空の場合はセクションごと非表示にする。
 */
const PhaseJumpButtons: React.FC = () => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const phases = useMitigationStore(s => s.phases);

    const handleJump = useCallback((startTime: number) => {
        window.dispatchEvent(
            new CustomEvent('progress:jump-to-time', { detail: { time: startTime } })
        );
    }, []);

    if (phases.length === 0) return null;

    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);

    return (
        <div className="flex flex-col gap-1">
            <p className="text-app-2xs text-app-text-muted uppercase tracking-wider px-0.5">
                {t('progress.phase_jump', 'Phase')}
            </p>
            <div className="flex flex-col gap-1">
                {sorted.map(phase => (
                    <button
                        key={phase.id}
                        onClick={() => handleJump(phase.startTime)}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-app-sm text-app-text border border-glass-border hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                        {getPhaseName(phase.name, contentLanguage)}
                    </button>
                ))}
            </div>
        </div>
    );
};

// -------------------- クリアボタン --------------------

/**
 * クリア（踏破）ボタン + クリア解除。
 * setCleared(true) を呼ぶのみ。お祝い演出の発火は E1 で接続する。
 */
const ClearSection: React.FC = () => {
    const { t } = useTranslation();
    const cleared = useMitigationStore(s => s.progress.cleared);
    const setCleared = useMitigationStore(s => s.setCleared);

    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-app-2xs text-app-text-muted uppercase tracking-wider px-0.5">
                {t('progress.clear_section', 'クリア（踏破）')}
            </p>
            {!cleared ? (
                <button
                    onClick={() => setCleared(true)}
                    className="w-full px-3 py-2 rounded-lg text-app-sm font-bold text-app-text border border-blue-500/40 hover:bg-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                    {t('progress.clear', 'クリア（踏破）')}
                </button>
            ) : (
                <div className="flex flex-col gap-1">
                    <p className="text-app-2xs text-center text-blue-400 px-0.5 font-bold">
                        {t('progress.cleared', '踏破 👑')}
                    </p>
                    <button
                        onClick={() => setCleared(false)}
                        className="w-full px-3 py-1.5 rounded-lg text-app-2xs text-app-text-muted border border-glass-border hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                        {t('progress.clear_undo', 'クリア解除')}
                    </button>
                </div>
            )}
        </div>
    );
};

// -------------------- ±カウンター（活動日数・時間） --------------------

/**
 * ステッパーボタン — 値を増減するシンプルな +/- UI。
 * value が undefined（未設定）の場合は「+」で 0 からスタート。
 */
const Stepper: React.FC<{
    label: string;
    value: number | undefined;
    onChange: (n: number | undefined) => void;
    unit: string;
}> = ({ label, value, onChange, unit }) => {
    const handleDecrement = () => {
        if (value === undefined || value <= 0) {
            // 0 以下はクリア（未設定に戻す）
            onChange(undefined);
        } else {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        onChange((value ?? 0) + 1);
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-app-2xs text-app-text-muted flex-1">{label}</span>
            <div className="flex items-center gap-1">
                <button
                    onClick={handleDecrement}
                    disabled={value === undefined}
                    className="p-0.5 rounded border border-glass-border hover:bg-glass-hover active:scale-90 transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Minus size={10} />
                </button>
                <span className="text-app-xs text-app-text w-10 text-center tabular-nums">
                    {value !== undefined ? `${value}${unit}` : '-'}
                </span>
                <button
                    onClick={handleIncrement}
                    className="p-0.5 rounded border border-glass-border hover:bg-glass-hover active:scale-90 transition-all duration-150 cursor-pointer"
                >
                    <Plus size={10} />
                </button>
            </div>
        </div>
    );
};

/**
 * 活動日数・時間の折りたたみセクション。
 * デフォルト非表示。展開した人だけ入力できる。
 */
const ActiveTimeSection: React.FC = () => {
    const { t } = useTranslation();
    const activeDays = useMitigationStore(s => s.progress.activeDays);
    const activeHours = useMitigationStore(s => s.progress.activeHours);
    const setActiveDays = useMitigationStore(s => s.setActiveDays);
    const setActiveHours = useMitigationStore(s => s.setActiveHours);
    // 既に値が入っている場合は開いた状態で表示
    const [open, setOpen] = useState(activeDays !== undefined || activeHours !== undefined);

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 text-app-2xs text-app-text-muted uppercase tracking-wider px-0.5 hover:text-app-text transition-colors duration-150 cursor-pointer"
            >
                {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {t('progress.active_input_toggle', '活動日数・時間を入力（任意）')}
            </button>
            {open && (
                <div className="flex flex-col gap-1.5 pl-1 border-l border-glass-border">
                    <Stepper
                        label={t('progress.active_days', '活動日数')}
                        value={activeDays}
                        onChange={setActiveDays}
                        unit={t('progress.active_days_unit', '日')}
                    />
                    <Stepper
                        label={t('progress.active_hours', '活動時間')}
                        value={activeHours}
                        onChange={setActiveHours}
                        unit={t('progress.active_hours_unit', 'h')}
                    />
                </div>
            )}
        </div>
    );
};

// -------------------- 誤記録修正（打点一覧 + 削除） --------------------

/** 秒 → M:SS（タイムライン上の到達位置表示） */
function formatReached(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 記録済みの打点を新しい順に一覧し、各点に削除ボタンを表示する。
 * 記録がない場合はセクションごと非表示。
 */
const DailyBestList: React.FC = () => {
    const { t } = useTranslation();
    const points = useMitigationStore(s => s.progress.points) ?? [];
    const removeProgressPoint = useMitigationStore(s => s.removeProgressPoint);

    if (points.length === 0) return null;

    // 新しい順に表示（削除は元の index で行う）
    const rows = points.map((p, i) => ({ p, i })).reverse();

    return (
        <div className="flex flex-col gap-1">
            <p className="text-app-2xs text-app-text-muted uppercase tracking-wider px-0.5">
                {t('progress.record_list', '記録一覧')}
            </p>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {rows.map(({ p, i }) => (
                    <div
                        key={p.ts}
                        className="flex items-center justify-between px-2 py-1 rounded-lg border border-glass-border text-app-2xs"
                    >
                        <span className="text-app-text-muted tabular-nums">{makeDayKey(new Date(p.ts))}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-app-text tabular-nums">{formatReached(p.reachedPos)}</span>
                            <button
                                onClick={() => removeProgressPoint(i)}
                                className="text-red-400/70 hover:text-red-400 border border-transparent hover:border-red-400/40 rounded px-1.5 py-0.5 transition-all duration-150 cursor-pointer active:scale-90"
                            >
                                {t('progress.delete_day', '削除')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// -------------------- パネル本文（PC / スマホ共通） --------------------

/**
 * 記録ボタン・フェーズジャンプ・クリア・活動日数・記録一覧を並べた本文。
 * PC ポップオーバーとスマホ BottomSheet で共有する。
 */
const PanelBody: React.FC = () => {
    const { t } = useTranslation();
    const { startRecordMode, stopRecordMode, recordMode } = useProgressRecording();

    return (
        <div className="flex flex-col gap-3">
            {/* 到達点記録トグル: 記録中は連続で打点でき、もう一度押す/×/Esc で終了 */}
            <button
                onClick={recordMode ? stopRecordMode : startRecordMode}
                className={clsx(
                    'w-full px-3 py-2 rounded-lg text-app-lg font-bold active:scale-95 transition-all duration-200 cursor-pointer border',
                    recordMode
                        ? 'bg-app-toggle text-app-toggle-text border-app-toggle animate-pulse'
                        : 'text-app-text border-glass-border hover:bg-glass-hover'
                )}
            >
                {recordMode ? t('progress.record_stop', '記録を終了') : t('progress.record_cta')}
            </button>
            {recordMode && (
                <p className="text-app-2xs text-app-text-muted text-center">
                    {t('progress.record_hint')}
                </p>
            )}
            {/* フェーズジャンプ */}
            <PhaseJumpButtons />
            {/* クリア（踏破） */}
            <ClearSection />
            {/* 活動日数・時間（折りたたみ） */}
            <ActiveTimeSection />
            {/* 誤記録修正 */}
            <DailyBestList />
        </div>
    );
};

// -------------------- モバイル判定 --------------------

/** モバイル判定 — 既存コードと同パターン (window.innerWidth < 768) */
function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return isMobile;
}

// -------------------- PC ポップオーバー --------------------

const PCPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const popoverRef = useRef<HTMLDivElement>(null);

    // クリック外閉じ。
    // ただし記録モード中はタイムラインのクリック(=「外側」)で打点するため閉じない。
    // (閉じると closePanel が recordMode を false にしてしまい、直後の onClick で記録されない)
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (useProgressRecording.getState().recordMode) return;
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Escape 閉じ
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                'fixed z-[9999] w-[260px] glass-tier3 rounded-lg shadow-sm',
                'animate-in fade-in zoom-in-95 duration-200 overflow-hidden'
            )}
            // ヘッダー直下（ヘッダー高さ = 約48px）の右寄せに配置
            style={{ top: '52px', right: '16px' }}
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                    {t('progress.record_title')}
                </span>
                <button
                    onClick={onClose}
                    className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                >
                    <X size={14} />
                </button>
            </div>

            {/* 本文 */}
            <div className="px-3 py-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                <PanelBody />
            </div>
        </div>,
        document.body
    );
};

// -------------------- メインコンポーネント --------------------

/**
 * 到達点記録パネル。props なし — useProgressRecording store 駆動。
 * panelOpen が false のとき何もレンダリングしない。
 * <ProgressRecordPanel /> のマウントは C2 (ProgressTrackingHUD) が行う。
 */
export const ProgressRecordPanel: React.FC = () => {
    const { panelOpen, closePanel } = useProgressRecording();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    if (!panelOpen) return null;

    if (isMobile) {
        return (
            <MobileBottomSheet
                isOpen={panelOpen}
                onClose={closePanel}
                title={t('progress.record_title')}
            >
                <div className="py-2">
                    <PanelBody />
                </div>
            </MobileBottomSheet>
        );
    }

    return <PCPopover onClose={closePanel} />;
};
