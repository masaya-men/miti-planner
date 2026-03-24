import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const TITLE_JA = '軽減表を作りましょう';
const TITLE_EN = 'Create a mitigation plan';
const DESC_JA = 'サイドバーからコンテンツを選んで、軽減プランを始めましょう。';
const DESC_EN = 'Select content from the sidebar to start building your mitigation plan.';

interface BubbleCardProps {
    label: string;
    children: React.ReactNode;
}

const BubbleCard: React.FC<BubbleCardProps> = ({ label, children }) => (
    <div className="flex flex-col items-center gap-3">
        <span className="text-[11px] font-black text-app-text-muted uppercase tracking-widest">{label}</span>
        <div className="relative w-[360px] h-[180px] flex items-center justify-center rounded-xl border border-app-border bg-app-bg/50">
            {children}
        </div>
    </div>
);

export const BubblePreview: React.FC = () => {
    const { i18n } = useTranslation();
    const title = i18n.language.startsWith('ja') ? TITLE_JA : TITLE_EN;
    const desc = i18n.language.startsWith('ja') ? DESC_JA : DESC_EN;

    return (
        <div className="min-h-screen bg-app-bg p-8">
            <h1 className="text-xl font-black text-app-text mb-8 text-center uppercase tracking-widest">
                Bubble Preview
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 max-w-[1200px] mx-auto">

                {/* 1: 三角吹き出し — 横揺れ */}
                <BubbleCard label="1 — Triangle">
                    <motion.div
                        animate={{ x: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="relative px-6 py-4 rounded-2xl border border-app-border bg-app-bg/95 shadow-lg text-center max-w-[280px]"
                    >
                        <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-app-border" />
                        <div className="absolute top-1/2 -left-[7px] -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[7px] border-r-app-bg" />
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 2: 漫画風丸吹き出し */}
                <BubbleCard label="2 — Comic">
                    <motion.div
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="relative px-6 py-4 rounded-[40px] border border-app-border bg-app-bg/95 shadow-lg text-center max-w-[280px]"
                    >
                        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-app-border bg-app-bg/95" />
                        <div className="absolute -left-5 top-1/2 translate-y-1 w-2 h-2 rounded-full border border-app-border bg-app-bg/95" />
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 3: 左バー付き — スライドイン */}
                <BubbleCard label="3 — Left Bar">
                    <motion.div
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-stretch rounded-2xl border border-app-border bg-app-bg/95 shadow-lg max-w-[280px] overflow-hidden"
                    >
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                            className="w-1.5 bg-app-text shrink-0"
                        />
                        <div className="px-5 py-4 text-left">
                            <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                            <p className="text-[10px] text-app-text-muted">{desc}</p>
                        </div>
                    </motion.div>
                </BubbleCard>

                {/* 4: 白黒反転 — バウンス */}
                <BubbleCard label="4 — Inverted">
                    <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        className="px-6 py-4 rounded-xl bg-app-text text-app-bg max-w-[280px] text-center shadow-lg"
                    >
                        <p className="text-sm font-bold mb-0.5">← {title}</p>
                        <p className="text-[10px] opacity-70">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 5: 点線枠 — パルス */}
                <BubbleCard label="5 — Dashed">
                    <motion.div
                        animate={{ scale: [1, 1.015, 1] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="px-6 py-4 rounded-2xl border-2 border-dashed border-app-text/30 bg-app-bg/90 max-w-[280px] text-center"
                    >
                        <motion.div
                            animate={{ x: [0, -6, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            className="text-lg mb-1"
                        >←</motion.div>
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 6: 角丸吹き出し下三角 */}
                <BubbleCard label="6 — Bottom Arrow">
                    <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="relative px-6 py-4 rounded-2xl border border-app-border bg-app-bg/95 shadow-lg text-center max-w-[280px]"
                    >
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-app-border" />
                        <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-app-bg" />
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 7: ピル型 — 左右揺れ */}
                <BubbleCard label="7 — Pill">
                    <motion.div
                        animate={{ x: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                        className="px-8 py-4 rounded-full border border-app-border bg-app-bg/95 shadow-lg text-center max-w-[300px]"
                    >
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 8: 二重枠 — 回転揺れ */}
                <BubbleCard label="8 — Double Border">
                    <motion.div
                        animate={{ rotate: [0, -0.5, 0.5, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="px-6 py-4 rounded-2xl border-2 border-app-text/20 shadow-lg text-center max-w-[280px] bg-app-bg/95"
                    >
                        <div className="px-4 py-3 rounded-xl border border-app-text/10">
                            <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                            <p className="text-[10px] text-app-text-muted">{desc}</p>
                        </div>
                    </motion.div>
                </BubbleCard>

                {/* 9: 影付き浮遊 — 上下 + 影変化 */}
                <BubbleCard label="9 — Floating">
                    <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="px-6 py-4 rounded-2xl border border-app-border bg-app-bg/95 text-center max-w-[280px]"
                        style={{ boxShadow: '0 12px 30px -8px rgba(0,0,0,0.2)' }}
                    >
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 10: 左三角 + グロー */}
                <BubbleCard label="10 — Glow">
                    <motion.div
                        animate={{ boxShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.1)', '0 0 0px rgba(255,255,255,0)'] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="relative px-6 py-4 rounded-2xl border border-app-border bg-app-bg/95 text-center max-w-[280px]"
                    >
                        <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-app-border" />
                        <div className="absolute top-1/2 -left-[7px] -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[7px] border-r-app-bg" />
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 11: タグ型（左に切り欠き） */}
                <BubbleCard label="11 — Tag">
                    <motion.div
                        animate={{ x: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        className="relative px-6 py-4 rounded-r-2xl rounded-l-none border border-l-4 border-app-text/40 bg-app-bg/95 shadow-lg text-center max-w-[280px]"
                    >
                        <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                        <p className="text-[10px] text-app-text-muted">{desc}</p>
                    </motion.div>
                </BubbleCard>

                {/* 12: 上部バー + フェードイン */}
                <BubbleCard label="12 — Top Bar">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="rounded-2xl border border-app-border bg-app-bg/95 shadow-lg text-center max-w-[280px] overflow-hidden"
                    >
                        <div className="h-1 bg-app-text" />
                        <div className="px-6 py-4">
                            <p className="text-sm font-bold text-app-text mb-0.5">{title}</p>
                            <p className="text-[10px] text-app-text-muted">{desc}</p>
                        </div>
                    </motion.div>
                </BubbleCard>

            </div>
        </div>
    );
};
