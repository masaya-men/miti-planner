import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';

const PipView = React.lazy(() => import('../PipView'));

interface TimelinePipLayerProps {
    t: TFunction;
    pipWindow: Window | null;
    pipContainer: HTMLDivElement | null;
    pipMenuOpen: boolean;
    pipMenuPos: { top: number; left: number } | null;
    setPipMenuOpen: (open: boolean) => void;
    cancelClosePipMenu: () => void;
    scheduleClosePipMenu: () => void;
    handleOpenPip: (mode: 'cue' | 'recorder') => Promise<void>;
    handleClosePip: () => void;
    onOpenVideoModal: () => void;
}

/** PiP 選択メニュー(body へ portal)と PiP 本体(別窓へ portal)。Timeline 末尾から移したもの。 */
export const TimelinePipLayer: React.FC<TimelinePipLayerProps> = ({
    t, pipWindow, pipContainer, pipMenuOpen, pipMenuPos, setPipMenuOpen,
    cancelClosePipMenu, scheduleClosePipMenu, handleOpenPip, handleClosePip, onOpenVideoModal,
}) => {
    const pipMenuPanelRef = useRef<HTMLDivElement>(null);
    return (
        <>
            {/* PiP 選択メニュー — ツールバーの overflow-hidden を避けて body へ固定配置 */}
            {pipMenuOpen && !pipWindow && pipMenuPos && createPortal(
                <div
                    ref={pipMenuPanelRef}
                    onMouseEnter={cancelClosePipMenu}
                    onMouseLeave={scheduleClosePipMenu}
                    style={{ position: 'fixed', top: pipMenuPos.top, left: pipMenuPos.left, zIndex: 9999 }}
                    className="w-max overflow-hidden rounded-menu float-surface"
                >
                    <button
                        onClick={() => { setPipMenuOpen(false); handleOpenPip('cue'); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-app-md text-app-text whitespace-nowrap hover:bg-glass-hover transition-colors cursor-pointer"
                    >
                        {t('timeline.recorder.menu_cue')}
                    </button>
                    <button
                        onClick={() => { setPipMenuOpen(false); onOpenVideoModal(); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-app-md text-app-text whitespace-nowrap hover:bg-glass-hover transition-colors cursor-pointer"
                    >
                        {t('timeline.recorder.menu_record')}
                    </button>
                </div>,
                document.body
            )}

            {/* PiP — 別窓にReactPortalでレンダリング（cue のみ） */}
            {pipContainer && createPortal(
                <React.Suspense fallback={null}>
                    <PipView mode="pip" onClose={handleClosePip} />
                </React.Suspense>,
                pipContainer
            )}
        </>
    );
};
