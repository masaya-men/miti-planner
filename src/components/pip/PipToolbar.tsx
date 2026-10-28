import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { Job, PartyMember } from '../../types';
import { getDefaultBgColor } from '../../utils/pipViewLogic';

interface PipToolbarProps {
    mode: 'pip' | 'fullscreen';
    isFs: boolean;
    onClose: () => void;
    theme: 'dark' | 'light';
    allSelected: boolean;
    onAllClick: () => void;
    activeMembers: (PartyMember & { job: Job | undefined })[];
    selectedMemberIds: Set<string>;
    toggleMemberSelection: (memberId: string) => void;
    bgColor: string;
    colorInputRef: React.RefObject<HTMLInputElement | null>;
    handleBgColorChange: (color: string) => void;
    resetBgColor: () => void;
}

export const PipToolbar: React.FC<PipToolbarProps> = ({
    mode, isFs, onClose, theme, allSelected, onAllClick, activeMembers, selectedMemberIds,
    toggleMemberSelection, bgColor, colorInputRef, handleBgColorChange, resetBgColor,
}) => {
    const { t } = useTranslation();
    return (
            <div className={clsx(
                "shrink-0 border-b border-current/10 flex items-center",
                isFs ? "gap-2 px-2 py-1.5" : "gap-1 px-1.5 py-1",
            )}>
                {/* ALL ボタン */}
                <button
                    onClick={onAllClick}
                    className={clsx(
                        "rounded font-bold tracking-wider cursor-pointer transition-colors shrink-0",
                        isFs ? "h-8 px-3 text-xs" : "h-5 px-1.5 text-app-sm",
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

                {/* カラーピッカー & デフォルト色スウォッチ: PC のみ（iOS Safari で input type="color" が動かないためスマホ非表示） */}
                {!isFs && (
                    <>
                        <button
                            onClick={() => colorInputRef.current?.click()}
                            className="relative rounded-full cursor-pointer hover:scale-110 transition-transform shrink-0 w-5 h-5"
                            style={{
                                background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                            }}
                            title={t('timeline.pip_bg_color')}
                        >
                            <span
                                className="absolute rounded-full block inset-[2px]"
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
                        {(() => {
                            const defaultColor = getDefaultBgColor(theme, null);
                            const isAtDefault = bgColor.toLowerCase() === defaultColor.toLowerCase();
                            return (
                                <button
                                    onClick={resetBgColor}
                                    disabled={isAtDefault}
                                    className={clsx(
                                        "rounded-full border border-current/30 transition-opacity shrink-0 w-5 h-5",
                                        isAtDefault
                                            ? "opacity-30 cursor-default"
                                            : "opacity-90 hover:opacity-100 hover:border-current/60 cursor-pointer"
                                    )}
                                    style={{ background: defaultColor }}
                                    title={t('timeline.pip_reset_color')}
                                />
                            );
                        })()}
                    </>
                )}

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
    );
};
