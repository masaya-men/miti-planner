// 到達点記録パネル — PC: 中央下から降りるドロワー / スマホ: MobileBottomSheet
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProgressRecording } from './useProgressRecording';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { useMitigationStore } from '../../store/useMitigationStore';
import { PhaseRoad } from './PhaseRoad';
import { ActivityScrub } from './ActivityScrub';

// -------------------- クリアボタン（インライン最小版） --------------------

/**
 * 踏破ボタン + クリア解除。インラインで下段に並ぶ最小スタイル。
 */
const ClearSectionInline: React.FC = () => {
    const { t } = useTranslation();
    const cleared = useMitigationStore(s => s.progress.cleared);
    const setCleared = useMitigationStore(s => s.setCleared);

    return (
        <div className="flex items-center gap-2">
            {!cleared ? (
                <button
                    onClick={() => setCleared(true)}
                    className="px-3 py-1.5 rounded-lg text-app-sm font-bold text-app-text border border-blue-500/40 hover:bg-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                    {t('progress.clear', '踏破')}
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="text-app-2xs text-blue-400 font-bold">
                        {t('progress.cleared', '踏破 👑')}
                    </span>
                    <button
                        onClick={() => setCleared(false)}
                        className="px-2 py-1 rounded-lg text-app-2xs text-app-text-muted border border-glass-border hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                        {t('progress.clear_undo', 'クリア解除')}
                    </button>
                </div>
            )}
        </div>
    );
};

// -------------------- パネル本文（PC / スマホ共通） --------------------

/**
 * プロンプト・PhaseRoad・活動スクラブ・踏破・直前undo を並べた本文。
 * 記録開始トグル・record_hint・DailyBestList・PhaseJumpButtons・Stepper・ActiveTimeSection は撤去済み。
 */
const PanelBody: React.FC = () => {
    const { t } = useTranslation();
    const activeDays = useMitigationStore(s => s.progress.activeDays);
    const activeHours = useMitigationStore(s => s.progress.activeHours);
    const setActiveDays = useMitigationStore(s => s.setActiveDays);
    const setActiveHours = useMitigationStore(s => s.setActiveHours);
    const lastRecordedTs = useProgressRecording(s => s.lastRecordedTs);
    const undoLastRecord = useProgressRecording(s => s.undoLastRecord);

    return (
        <div className="flex flex-col gap-4">
            {/* プロンプト */}
            <div className="text-center">
                <div className="text-app-lg font-bold text-app-text" style={{ textShadow: '0 0 12px rgba(120,200,255,.4)' }}>
                    {t('progress.drawer_prompt_main')}
                </div>
                <div className="text-app-2xs text-app-text-muted mt-0.5">{t('progress.drawer_prompt_sub')}</div>
            </div>
            {/* 光の道（フェーズナビ） */}
            <PhaseRoad />
            {/* 下段: 活動スクラブ / 踏破 / 直前undo */}
            <div className="flex items-end justify-between gap-4 flex-wrap border-t border-glass-border pt-3">
                <div className="flex items-center gap-6">
                    <ActivityScrub label={t('progress.active_days', '活動')} value={activeDays} unit={t('progress.active_days_unit', '日')} onChange={setActiveDays} />
                    <ActivityScrub value={activeHours} unit={t('progress.active_hours_unit', 'h')} onChange={setActiveHours} />
                </div>
                <div className="flex items-center gap-4">
                    <ClearSectionInline />
                    {lastRecordedTs != null && (
                        <button onClick={undoLastRecord} title={t('progress.undo_last', '直前の記録を取り消す')}
                            className="text-app-md text-app-text-sec hover:text-red-400 cursor-pointer active:scale-90">↶</button>
                    )}
                </div>
            </div>
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

// -------------------- PC ドロワー --------------------

/**
 * 中央グラフ下から降りる横長ドロワー。createPortal で body 直下に配置。
 * マウント時に startRecordMode() を呼び、記録モードを自動 ON にする。
 * clip 展開 + ホログラム明滅の開演出（WAAPI）。
 */
const PCDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const drawerRef = useRef<HTMLDivElement>(null);
    const startRecordMode = useProgressRecording(s => s.startRecordMode);

    // 横位置=画面（ビューポート）中央、縦位置=HUD 帯の真下から降ろす。
    // 帯の中心は左右非対称ヘッダーのぶん右に寄るため、横は画面中央に揃える方が自然
    // （2026-06-19 ユーザー実機判断）。帯は縦位置（top）を測るためだけに使う。
    // 帯が見つからない場合のフォールバックは画面中央 / top:92px。
    const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
    useLayoutEffect(() => {
        const band = document.querySelector('[data-progress-hud-band]');
        const left = window.innerWidth / 2;
        if (!band) { setPos({ left, top: 92, width: Math.min(720, window.innerWidth * 0.92) }); return; }
        const r = band.getBoundingClientRect();
        const width = Math.min(720, Math.max(r.width, 480), window.innerWidth * 0.92);
        setPos({ left, top: r.bottom + 6, width });
    }, []);

    // 開いた瞬間に記録モード ON（PC のみ）
    useEffect(() => { startRecordMode(); }, [startRecordMode]);

    // 閉じる演出: 開演出のミラー（clip を上へ畳む + 上スライド + フェードアウト）を再生してから実際に閉じる。
    // easing は開演出 cubic-bezier(.16,.8,.3,1) の時間反転（= ease-in 相当）で対称にする。
    // closingRef で二重発火を防止。drawerRef 不在時は即閉じ（保険）。
    const closingRef = useRef(false);
    const requestClose = useCallback(() => {
        if (closingRef.current) return;
        const el = drawerRef.current;
        if (!el) { onClose(); return; }
        closingRef.current = true;
        const a = el.animate(
            [{ clipPath: 'inset(0 0 0% 0)', opacity: 1, transform: 'translateY(0)' },
             { clipPath: 'inset(0 0 100% 0)', opacity: 0, transform: 'translateY(-6px)' }],
            { duration: 460, easing: 'cubic-bezier(.7,0,.84,.2)', fill: 'forwards' }
        );
        a.onfinish = () => onClose();
    }, [onClose]);

    // 外側クリック閉じ（記録モード中はタイムライン打点に使うため閉じない）
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (useProgressRecording.getState().recordMode) return;
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) requestClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [requestClose]);

    // Escape 閉じ
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [requestClose]);

    // 開演出: clip 上→下 + 明滅
    useEffect(() => {
        const el = drawerRef.current; if (!el) return;
        el.animate(
            [{ clipPath: 'inset(0 0 100% 0)', opacity: 0, transform: 'translateY(-6px)' },
             { clipPath: 'inset(0 0 0% 0)', opacity: 1, transform: 'translateY(0)' }],
            { duration: 460, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' }
        );
    }, []);

    // 注意: 中央寄せに transform: translateX(-50%) を使わない。
    // 開演出(下記 useEffect の WAAPI)が transform を fill:forwards で translateY(0) に固定するため、
    // transform で水平センタリングすると上書きされて右へ半幅ぶんズレる（実機で 240px 右ズレの根因）。
    // → 数値 left（中心 − 半幅）で寄せ、transform は開演出専用にする。
    // light モードで他モーダルと同じ白基調にする（glass-tier3 既定の半透明を上書き）。
    // --share-modal-bg = light:#ffffff / dark:transparent（reference_modal_light_mode_white_bg）。
    return createPortal(
        <div ref={drawerRef}
            className="fixed z-[9999] glass-tier3 rounded-b-lg shadow-sm overflow-hidden"
            style={{
                '--glass-tier3-bg': 'var(--share-modal-bg)',
                ...(pos
                    ? { top: `${pos.top}px`, left: `${pos.left - pos.width / 2}px`, width: `${pos.width}px` }
                    : { top: '92px', left: 'calc(50% - min(360px, 46vw))', width: 'min(720px, 92vw)' }),
            } as React.CSSProperties}
        >
            <div className="flex items-center justify-end px-3 py-1.5 border-b border-glass-border">
                <button onClick={requestClose} className="text-app-text p-1 rounded-lg hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>
            <div className="px-5 py-4"><PanelBody /></div>
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
    const startRecordMode = useProgressRecording(s => s.startRecordMode);

    // モバイルでパネルが開いた時に記録モードを ON にする（PCDrawer は自身の useEffect で行う）
    useEffect(() => {
        if (panelOpen && isMobile) {
            startRecordMode();
        }
    }, [panelOpen, isMobile, startRecordMode]);

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

    return <PCDrawer onClose={closePanel} />;
};
