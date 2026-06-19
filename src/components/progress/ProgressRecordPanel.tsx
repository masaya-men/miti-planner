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

// -------------------- クリアボタン（CLEAR! / 解除） --------------------

/**
 * CLEAR! ボタン（全言語共通の短ラベル）。クリア済みは 👑 + 解除。
 * 光の道の右端に置く想定の最小スタイル。
 */
const ClearSectionInline: React.FC = () => {
    const { t } = useTranslation();
    const cleared = useMitigationStore(s => s.progress.cleared);
    const setCleared = useMitigationStore(s => s.setCleared);

    return !cleared ? (
        <button
            onClick={() => setCleared(true)}
            className="px-2.5 py-1 rounded-md text-app-sm font-black tracking-wide text-app-blue border border-app-blue/40 hover:bg-app-blue/10 active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={{ textShadow: '0 0 8px rgba(120,200,255,.4)' }}
        >
            {t('progress.clear_action_short', 'CLEAR!')}
        </button>
    ) : (
        <div className="flex items-center gap-1.5">
            <span className="text-app-md font-black text-app-blue" style={{ textShadow: '0 0 8px var(--app-blue)' }}>👑</span>
            <button
                onClick={() => setCleared(false)}
                title={t('progress.clear_undo', 'クリア解除')}
                className="text-app-2xs text-app-text-muted border border-glass-border rounded px-1.5 py-0.5 hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
                {t('progress.clear_undo', 'クリア解除')}
            </button>
        </div>
    );
};

// -------------------- パネル本文（PC / スマホ共通） --------------------

/**
 * コンパクト3段: ①プロンプト + 活動スクラブ ②記録の促し（大きめ） ③光の道 + 直前undo + CLEAR!(右端)。
 * 上段右の余白(pr)は PCDrawer が右上に重ねる ✕ ボタンと被らないため。
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
        <div className="flex flex-col gap-2.5">
            {/* ①上段: プロンプト（左）+ 活動日数/時間（右） */}
            <div className="flex items-center justify-between gap-4 pr-7">
                <div className="text-app-md font-bold text-app-text" style={{ textShadow: '0 0 12px rgba(120,200,255,.4)' }}>
                    {t('progress.drawer_prompt_main')}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <ActivityScrub value={activeDays} unit={t('progress.active_days_unit', '日')} onChange={setActiveDays} />
                    <ActivityScrub value={activeHours} unit={t('progress.active_hours_unit', 'h')} onChange={setActiveHours} />
                </div>
            </div>
            {/* ②記録の促し（読めるサイズに拡大） */}
            <div className="text-app-sm text-app-text-muted">{t('progress.drawer_prompt_sub')}</div>
            {/* ③光の道 + 直前undo + CLEAR!（右端） */}
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0"><PhaseRoad /></div>
                <div className="flex items-center gap-2 shrink-0">
                    {lastRecordedTs != null && (
                        <button onClick={undoLastRecord} title={t('progress.undo_last', '直前の記録を取り消す')}
                            className="text-app-md text-app-text-sec hover:text-red-400 cursor-pointer active:scale-90">↶</button>
                    )}
                    <ClearSectionInline />
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

    // 横位置=画面（ビューポート）中央。
    // 縦位置=ヘッダー下端の1px線（常設ハンドル領域の下端 = data-progress-drawer-anchor の bottom）に密着。
    //   → ドロワーの上辺をヘッダーの開閉ハンドル線に一致させ、ヘッダーから引き出された見た目にする（隙間ゼロ）。
    //   帯（data-progress-hud-band）は幅の算出にだけ使う（帯幅に追従）。
    const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
    useLayoutEffect(() => {
        const anchor = document.querySelector('[data-progress-drawer-anchor]');
        const band = document.querySelector('[data-progress-hud-band]');
        const left = window.innerWidth / 2;
        // ハンドル領域の「上端線」に密着させる（下端だと中央シェブロン以外の左右に 24px の空き帯が
        // 残り隙間に見えるため）。ヘッダー本文の真下＝ハンドル上端1px線をドロワーの上辺にする。
        const top = anchor ? Math.round(anchor.getBoundingClientRect().top) : 92;
        const width = band
            ? Math.min(720, Math.max(band.getBoundingClientRect().width, 480), window.innerWidth * 0.92)
            : Math.min(720, window.innerWidth * 0.92);
        setPos({ left, top, width });
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
            { duration: 153, easing: 'cubic-bezier(.7,0,.84,.2)', fill: 'forwards' }
        );
        a.onfinish = () => onClose();
    }, [onClose]);

    // 記録確定（タイムライン打点）による閉じも同じミラー演出で閉じる。
    // store の commitReachedPos は panelOpen を保持したまま pendingClose(nonce) を立てる →
    // ここで requestClose を再生 → 完了後 onClose で実際に閉じる。
    const pendingClose = useProgressRecording(s => s.pendingClose);
    useEffect(() => {
        if (pendingClose) requestClose();
    }, [pendingClose, requestClose]);

    // 外側クリックで閉じる。ドロワー外をクリックしたら閉じる（記録モード中でも閉じる）。
    // タイムラインのセルは click で commitReachedPos が走り記録＋閉じになる（その場合もここで閉じ演出に入るが
    // closingRef で二重化しない / 記録自体は click 時点で recordMode=true のため成立する）。
    useEffect(() => {
        const handler = (e: MouseEvent) => {
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
            { duration: 360, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' }
        );
    }, []);

    // 注意: 中央寄せに transform: translateX(-50%) を使わない。
    // 開演出(下記 useEffect の WAAPI)が transform を fill:forwards で translateY(0) に固定するため、
    // transform で水平センタリングすると上書きされて右へ半幅ぶんズレる（実機で 240px 右ズレの根因）。
    // → 数値 left（中心 − 半幅）で寄せ、transform は開演出専用にする。
    // light モードで他モーダルと同じ白基調にする（glass-tier3 既定の半透明を上書き）。
    // --share-modal-bg = light:#ffffff / dark:transparent（reference_modal_light_mode_white_bg）。
    // U 型（下を閉じて上を空ける）: 上辺の枠線を消し（glass-border-t-0）、左右下＋下角丸を残す。
    // box-shadow の inset 上ハイライト（1px 光線）は残るのでヘッダーと地続きに見える＝「変化して出てきた」感。
    return createPortal(
        <div ref={drawerRef}
            className="fixed z-[9999] glass-tier3 glass-border-t-0 rounded-b-lg shadow-sm overflow-hidden"
            style={{
                '--glass-tier3-bg': 'var(--share-modal-bg)',
                // 上辺の内側ハイライト(inset)を消す → ヘッダー下端線が唯一の上辺になる（ドロワー自身は上辺を描かない）。
                '--glass-tier3-inset': 'inset 0 0 0 0 transparent',
                ...(pos
                    ? { top: `${pos.top}px`, left: `${pos.left - pos.width / 2}px`, width: `${pos.width}px` }
                    : { top: '92px', left: 'calc(50% - min(360px, 46vw))', width: 'min(720px, 92vw)' }),
            } as React.CSSProperties}
        >
            {/* ✕ は右上に重ねる（ヘッダー帯を廃止してコンパクト化） */}
            <button onClick={requestClose}
                className="absolute top-2 right-2 z-10 text-app-text p-1 rounded-lg hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 cursor-pointer active:scale-90">
                <X size={14} />
            </button>
            <div className="px-5 py-3.5"><PanelBody /></div>
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
    const pendingClose = useProgressRecording(s => s.pendingClose);

    // モバイルでパネルが開いた時に記録モードを ON にする（PCDrawer は自身の useEffect で行う）
    useEffect(() => {
        if (panelOpen && isMobile) {
            startRecordMode();
        }
    }, [panelOpen, isMobile, startRecordMode]);

    // 記録確定時の閉じ: モバイルは MobileBottomSheet 自前の閉じアニメで閉じる
    // （PC は PCDrawer が pendingClose を見てミラー演出を再生する）。
    useEffect(() => {
        if (pendingClose && isMobile) closePanel();
    }, [pendingClose, isMobile, closePanel]);

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
