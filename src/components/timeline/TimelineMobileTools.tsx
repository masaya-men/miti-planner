import React from 'react';
import type { TFunction } from 'i18next';
import { Undo2, Redo2, CloudDownload } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { useTimelineMobileScrollChrome } from './useTimelineMobileScrollChrome';
import './TimelineMobileTools.css';

type Dialogs = ReturnType<typeof useTimelineDialogs>;

interface TimelineMobileToolsProps {
    t: TFunction;
    tutorialActive: boolean;
    undoRedoWrapRef: ReturnType<typeof useTimelineMobileScrollChrome>['undoRedoWrapRef'];
    canUndo: boolean;
    canRedo: boolean;
    readOnly: boolean;
    mobileToolsSheetOpen: boolean;
    setMobileToolsSheetOpen: (open: boolean) => void;
    setImportModalOpen: Dialogs['setImportModalOpen'];
}

/** スマホの元に戻す/やり直し・ツールシート。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineMobileTools: React.FC<TimelineMobileToolsProps> = ({
    t, tutorialActive, undoRedoWrapRef, canUndo, canRedo, readOnly, mobileToolsSheetOpen, setMobileToolsSheetOpen,
    setImportModalOpen,
}) => {
    return (
        <>
            {/* スマホ: 画面左端に Undo/Redo 常設（編集系は常設ツールバー・ナビ枠を消費しない。チュートリアル中は FAB と同様に隠す）。
                以前は FAB のすぐ左(右端寄り)に置いていたが、スクロールする親指の可動域に重なるという
                実機FBがあり、反対側の左端に移動(2026-08-13)。右端のFABと見た目を揃えるため、
                スクロール中はこちらも同じように隠す(ユーザー要望・2026-08-13)。 */}
            {!tutorialActive && <div
                ref={undoRedoWrapRef}
                className="mobile-undo-redo-wrap fixed z-[300] md:hidden flex items-center gap-2"
                style={{
                    // ボトムナビゲーションになるべく近づける(2026-08-13ユーザー要望)。MobileFAB.tsx の
                    // FAB本体と同じ計算式(bottomNav.height + 少しの余白)に揃える。
                    bottom: `calc(${MOBILE_TOKENS.bottomNav.height}px + 0.5rem)`,
                    left: '1rem',
                }}
            >
                <button
                    onClick={() => useMitigationStore.getState().undo()}
                    disabled={!canUndo || readOnly}
                    aria-label={t('timeline.undo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={() => useMitigationStore.getState().redo()}
                    disabled={!canRedo || readOnly}
                    aria-label={t('timeline.redo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Redo2 size={18} />
                </button>
            </div>}

            <MobileBottomSheet
                isOpen={mobileToolsSheetOpen}
                onClose={() => setMobileToolsSheetOpen(false)}
                title={t('mobile.import_title')}
                height="55vh"
                swipeArea="handle"
            >
                <div className="flex flex-col gap-3">
                    {/* FFLogs Import */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-app-2xl font-bold">FF Logs</div>
                            <div className="text-app-base text-app-text-muted">{t('fflogs.tooltip_generate')}</div>
                        </div>
                    </button>
                    {/* スプレッドシート取込: スマホでは非表示(有名スプシのマトリクス構造はスマホ貼付で
                        構造的に取り込めず、URL直読みは「あらゆるスプシ対応」を目指す前提で棚上げ。2026-06-30 判断)。
                        PC の入口(menu イベント→setShowGridImport)は別経路で維持。 */}
                </div>
            </MobileBottomSheet>
        </>
    );
};
