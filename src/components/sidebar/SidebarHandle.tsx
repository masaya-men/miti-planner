import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui/Tooltip';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { LocalDataSafetyHandleButton } from '../LocalDataSafetyHandleButton';
import { SystemNotificationHandleButton } from '../SystemNotificationHandleButton';

interface SidebarHandleProps {
    fullWidth?: boolean;
    isOpen: boolean;
    onToggle?: () => void;
    tutorialActive: boolean;
    currentStepIndex: number;
    isHovered: boolean;
    setIsHovered: (hovered: boolean) => void;
    setBackupExportOpen: (open: boolean) => void;
}

export const SidebarHandle: React.FC<SidebarHandleProps> = ({ fullWidth, isOpen, onToggle, tutorialActive, currentStepIndex, isHovered, setIsHovered, setBackupExportOpen }) => {
    const { t } = useTranslation();
    return (
            fullWidth ? null : <div
                className="h-full w-6 z-50 flex items-center justify-center shrink-0 relative"
            >
                {/* 折りたたみ時のみ: 未読通知ベルをハンドル上部に重ねる (未読が無ければ何も出ない) */}
                {!isOpen && <SystemNotificationHandleButton />}

                {/* 折りたたみ時のみ: ローカルデータ安全性アイコン (要確認の赤バッジがある時のみ) */}
                {!isOpen && <LocalDataSafetyHandleButton onOpenBackup={() => setBackupExportOpen(true)} />}

                {/* 固定ライン — チュートリアル中もハンドルが非表示でも常に表示 */}
                {tutorialActive && currentStepIndex <= 2 && (<>
                    <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border z-50" />
                    <div className="absolute inset-y-0 right-0 w-[1px] bg-app-border z-50" />
                </>)}

                <div
                    className={clsx(
                        "absolute left-0 h-full w-6 bg-glass-header z-50",
                        tutorialActive && currentStepIndex <= 2 ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                >
                    <Tooltip content={isOpen ? t('sidebar.close_menu') : t('sidebar.open_menu')} position="right" wrapperClassName="w-full h-full">
                        <button
                            onClick={() => onToggle?.()}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            className={clsx(
                                "relative w-full h-full cursor-pointer overflow-hidden group/btn outline-none",
                                "hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                            )}
                        >
                            {/* 左端の固定ライン（右端はサイドバーのframe-surface borderが担当） */}
                            <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />

                            <div className="relative flex items-center justify-center h-full">
                                <motion.div
                                    className="flex items-center justify-center"
                                    animate={{
                                        rotate: isOpen ? 0 : 180,
                                        x: isHovered ? (isOpen ? [-2, 2, -2] : [2, -2, 2]) : 0,
                                        scale: isHovered ? 1.8 : 1
                                    }}
                                    transition={{
                                        rotate: { type: "spring", stiffness: 260, damping: 20 },
                                        x: isHovered ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 },
                                        scale: { duration: 0.2 }
                                    }}
                                >
                                    <ChevronLeft
                                        size={18}
                                        className={clsx(
                                            "transition-all duration-200",
                                            "text-app-text-muted group-hover/btn:text-app-text-sec",
                                            isHovered && "text-app-text-sec"
                                        )}
                                    />
                                </motion.div>
                            </div>

                            {/* 右端の境界線 */}
                            <div className={clsx(
                                "absolute right-0 top-0 bottom-0 w-[1px] transition-all duration-200",
                                isOpen ? "bg-glass-border" : "bg-app-border",
                                "group-hover/btn:bg-app-text-muted"
                            )} />
                        </button>
                    </Tooltip>
                </div>
            </div>
    );
};
