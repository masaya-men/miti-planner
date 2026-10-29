import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { MobileTriggersContext } from '../../contexts/MobileTriggersContext';
import { Tooltip } from '../ui/Tooltip';
import { SyncButton } from '../SyncButton';

/** [2] ── 常設ハンドル領域 ── ヘッダーの開閉と、折りたたみ時の同期ボタン */
export const HeaderCollapseHandle: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
    const { t } = useTranslation();
    const {
        isHeaderCollapsed, setIsHeaderCollapsed, isSidebarOpen
    } = useContext(MobileTriggersContext);
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        /* data-progress-drawer-anchor: 記録ドロワーがこの領域の下端1px線を上辺として密着配置するためのアンカー */
        <div data-progress-drawer-anchor className="w-full relative shrink-0" style={{ height: '24px' }}>
            {/* ハンドル本体 */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[25px] z-50 pointer-events-auto frame-surface glass-frame glass-border-t-0 glass-border-b-0 glass-border-l-0 glass-border-r-0 glass-shadow-none"
            >
                {/* ヘッダー折りたたみ時: 同期ボタンをハンドル左端に表示
                     PCフォーカスモード時（header collapsed + sidebar closed）は右パネルに表示するため非表示 */}
                {isHeaderCollapsed && (
                    <div className={clsx(
                        "absolute left-1.5 top-0 bottom-0 flex items-center z-10 pointer-events-auto",
                        !isSidebarOpen && "md:hidden"
                    )}>
                        <SyncButton />
                    </div>
                )}
                <Tooltip content={!isHeaderCollapsed ? t('sidebar.collapse_header') : t('sidebar.expand_header')} position="bottom" wrapperClassName={clsx("w-full h-full", readOnly && "cursor-not-allowed")}>
                <button
                    disabled={readOnly}
                    onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={clsx(
                        "relative w-full h-full overflow-hidden group/btn outline-none",
                        readOnly
                            ? "pointer-events-none"
                            : "cursor-pointer hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                    )}
                >
                    {/* 上端の固定ライン */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />
                    {/* 下端の固定ライン */}
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />

                    <div className="relative flex items-center justify-center h-full">
                        <motion.div
                            className="flex items-center justify-center"
                            animate={{
                                y: isHovered
                                    ? (isHeaderCollapsed ? [2, -2, 2] : [-2, 2, -2])
                                    : 0,
                                scale: isHovered ? 1.8 : 1
                            }}
                            transition={{
                                y: isHovered
                                    ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
                                    : { duration: 0.2 },
                                scale: { duration: 0.2 }
                            }}
                        >
                            {isHeaderCollapsed ? (
                                <ChevronDown
                                    size={18}
                                    className={clsx("transition-all duration-200", isHovered ? "text-app-text-sec" : "text-app-text-muted group-hover/btn:text-app-text-sec")}
                                />
                            ) : (
                                <ChevronUp
                                    size={18}
                                    className={clsx("transition-all duration-200", isHovered ? "text-app-text-sec" : "text-app-text-muted group-hover/btn:text-app-text-sec")}
                                />
                            )}
                        </motion.div>
                    </div>
                </button>
                </Tooltip>
            </div>
        </div>
    );
};
