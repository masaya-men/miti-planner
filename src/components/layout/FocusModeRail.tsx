import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'framer-motion';
import { Sun, Moon, Star } from 'lucide-react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { SyncButton } from '../SyncButton';

interface FocusModeRailProps {
    /** フォーカスモード(ヘッダー折りたたみ+サイドバー閉)のときだけ開く */
    visible: boolean;
    theme: string;
    onToggleTheme: () => void;
}

/** 右罫線 — サイドバー左ハンドルと対称（PC only, フォーカスモード時のみ表示） */
export const FocusModeRail: React.FC<FocusModeRailProps> = ({ visible, theme, onToggleTheme }) => {
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
        useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
    );
    return (
        <motion.div
            className="hidden md:flex flex-col h-full shrink-0 relative z-40 frame-surface glass-frame glass-border-t-0 glass-border-l-0 glass-shadow-none overflow-hidden"
            initial={false}
            animate={{ width: visible ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
        >
            {/* 左端ライン（コンテンツとの境界） */}
            <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border" />
            {/* 右端ライン（画面端から1px内側 — 左側と同じ太さに2px） */}
            <div className="absolute inset-y-0 right-[1px] w-[2px] bg-app-border" />

            {/* フォーカスモード用ボタン — 狭い空間からんーーっぽん！と飛び出すアニメーション */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1 w-6">
                {[
                    { key: 'theme', delay: 0.6, render: () => (
                        <button
                            onClick={onToggleTheme}
                            className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                    )},
                    { key: 'highlight', delay: 0.75, render: () => (
                        <button
                            onClick={() => {
                                const current = useMitigationStore.getState().myJobHighlight;
                                setMyJobHighlight(!current);
                            }}
                            className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                        >
                            <Star size={14} className={myJobHighlight ? "fill-current text-app-text" : ""} />
                        </button>
                    )},
                    { key: 'sync', delay: 0.9, render: () => (
                        <SyncButton size={14} className="w-6 h-6 justify-center" />
                    )},
                ].map(({ key, delay, render }) => (
                    <motion.div
                        key={key}
                        initial={{ scaleX: 0.3, scaleY: 0.1, opacity: 0 }}
                        animate={visible
                            ? { scaleX: 1, scaleY: 1, opacity: 1 }
                            : { scaleX: 0.3, scaleY: 0.1, opacity: 0 }
                        }
                        transition={{
                            type: "spring",
                            stiffness: 800,
                            damping: 8,
                            delay: visible ? delay : 0,
                        }}
                    >
                        {render()}
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};
