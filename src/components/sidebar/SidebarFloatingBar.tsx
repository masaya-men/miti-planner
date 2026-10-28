import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { Share2, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import './SidebarFloatingBar.css';

interface SidebarFloatingBarProps {
    multiSelect: MultiSelectState;
    setMultiSelect: React.Dispatch<React.SetStateAction<MultiSelectState>>;
    floatingBarRef: React.RefObject<HTMLDivElement | null>;
    floatingBarFlash: boolean;
    bundleModalOpen: boolean;
    handleShareBundle: () => void;
    setShowDeleteConfirm: (show: boolean) => void;
}

export const SidebarFloatingBar: React.FC<SidebarFloatingBarProps> = ({ multiSelect, setMultiSelect, floatingBarRef, floatingBarFlash, bundleModalOpen, handleShareBundle, setShowDeleteConfirm }) => {
    const { t } = useTranslation();
    return (
<>
                    {/* フローティングアクションバー — 画面下部中央（createPortalでbody直下） */}
                    {createPortal(
                        <div className={clsx(
                            "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                            "bg-app-bg border border-app-text/15 rounded-2xl",
                            "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                            "transition-all duration-300",
                            multiSelect.isEnabled && !bundleModalOpen
                                ? "opacity-100 translate-x-[-50%] translate-y-0 pointer-events-auto"
                                : "opacity-0 translate-x-[-50%] translate-y-10 pointer-events-none"
                        )}
                            ref={floatingBarRef}
                        >
                            {/* 選択件数 */}
                            <span className={clsx(
                                "text-app-md font-black text-app-text whitespace-nowrap min-w-[72px] text-center",
                                floatingBarFlash && "animate-[floatingCountBounce_.3s_cubic-bezier(.34,1.56,.64,1)]"
                            )}
                                key={multiSelect.selectedIds.length}
                            >
                                {multiSelect.mode === 'delete'
                                    ? t('sidebar.selected_count_simple', { count: multiSelect.selectedIds.length })
                                    : t('sidebar.selected_count', { count: multiSelect.selectedIds.length })
                                }
                            </span>
                            <div className="w-px h-5 bg-app-text/10 shrink-0" />
                            {/* キャンセル */}
                            <button
                                onClick={() => setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' })}
                                className="py-1.5 px-4 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            >
                                {t('sidebar.cancel')}
                            </button>
                            {/* アクションボタン */}
                            {multiSelect.mode === 'share' ? (
                                <button
                                    onClick={handleShareBundle}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-blue text-white hover:bg-app-blue-hover active:scale-95"
                                            : "bg-app-blue-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Share2 size={13} />
                                    <span>{t('sidebar.share_together')}</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (multiSelect.selectedIds.length === 0) return;
                                        setShowDeleteConfirm(true);
                                    }}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-red text-white hover:bg-app-red-hover active:scale-95"
                                            : "bg-app-red-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Trash2 size={13} />
                                    <span>{t('sidebar.delete')}</span>
                                </button>
                            )}
                        </div>,
                        document.body
                    )}
</>
    );
};
