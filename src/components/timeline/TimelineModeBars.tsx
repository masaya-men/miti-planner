import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import { Sword, X, Settings, Crosshair } from 'lucide-react';
import VideoRecorderModal from '../VideoRecorderModal';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { useTimelinePreviewHighlight } from './useTimelinePreviewHighlight';

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type MitigationState = ReturnType<typeof useMitigationStore.getState>;

interface TimelineModeBarsProps {
    t: TFunction;
    isAaModeEnabled: boolean;
    setIsAaModeEnabled: (enabled: boolean) => void;
    setAaSettingsOpen: (open: boolean) => void;
    aaSettings: MitigationState['aaSettings'];
    timelineSelectMode: Dialogs['timelineSelectMode'];
    setTimelineSelectMode: Dialogs['setTimelineSelectMode'];
    labelSelectMode: Dialogs['labelSelectMode'];
    setLabelSelectMode: Dialogs['setLabelSelectMode'];
    throttledUpdatePreview: ReturnType<typeof useTimelinePreviewHighlight>['throttledUpdatePreview'];
    videoModalOpen: boolean;
    setVideoModalOpen: (open: boolean) => void;
}

/** AA 配置モード・TL 選択モードのフローティングバー(body へ portal)と動画埋め込みモーダル。Timeline 末尾から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineModeBars: React.FC<TimelineModeBarsProps> = ({
    t, isAaModeEnabled, setIsAaModeEnabled, setAaSettingsOpen, aaSettings, timelineSelectMode, setTimelineSelectMode,
    labelSelectMode, setLabelSelectMode, throttledUpdatePreview, videoModalOpen, setVideoModalOpen,
}) => {
    return (
        <>
            {/* AA 配置モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "float-surface rounded-2xl",
                    "transition-all duration-300",
                    isAaModeEnabled
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    {/* 現在の設定ラベル */}
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        <Sword size={12} className="inline mr-1.5 -mt-0.5" />
                        {t('aa_settings.floating_label', {
                            damage: aaSettings.damage.toLocaleString(),
                            target: aaSettings.target,
                            type: t(`aa_settings.${aaSettings.type === 'magical' ? 'magic' : aaSettings.type === 'physical' ? 'phys' : 'dark'}`)
                        })}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 設定変更ボタン */}
                    <button
                        onClick={() => setAaSettingsOpen(true)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <Settings size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.change_settings')}
                    </button>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 終了ボタン */}
                    <button
                        onClick={() => setIsAaModeEnabled(false)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.end_mode')}
                    </button>
                </div>,
                document.body
            )}

            {/* TL選択モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "float-surface rounded-2xl",
                    "transition-all duration-300",
                    (timelineSelectMode || labelSelectMode)
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    <Crosshair size={14} className="text-app-blue shrink-0" />
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        {(timelineSelectMode?.field === 'startTime' || labelSelectMode?.field === 'startTime')
                            ? t('boundary_modal.select_banner_start')
                            : t('boundary_modal.select_banner')}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    <button
                        onClick={() => {
                            if (timelineSelectMode) {
                                setTimelineSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                            if (labelSelectMode) {
                                setLabelSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                        }}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('modal.cancel')}
                    </button>
                </div>,
                document.body
            )}

            {/* 動画埋め込み式タイムライン作成モーダル */}
            <VideoRecorderModal isOpen={videoModalOpen} onClose={() => setVideoModalOpen(false)} />
        </>
    );
};
