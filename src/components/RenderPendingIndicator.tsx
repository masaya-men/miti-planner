// src/components/RenderPendingIndicator.tsx
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useRenderPendingStore } from '../store/useRenderPendingStore';

/**
 * 「今すごく重い再描画が走っている」ことを画面中央で知らせるインジケーター。
 *
 * 表示メンバー絞り込みのトグルは Timeline 全体(数百アイコン規模)の再計算を伴い、
 * その間メインスレッドが JS 実行でブロックされる(2026-08-19実測、詳細は
 * docs/.private/2026-08-19-party-visibility-switch-handoff.md)。Loader2 + `animate-spin`
 * は純CSSの `@keyframes` 駆動(Layout.tsx のログイン中オーバーレイと同じ部品)なので、
 * メインスレッドがブロックされていても回り続ける。show/hide のフェード自体はブロック区間の
 * 前後でしか起きないので framer-motion で問題ない。文言は無し(回っていること自体で十分伝わる)。
 */
export function RenderPendingIndicator() {
    const pending = useRenderPendingStore(s => s.pending);

    return createPortal(
        <AnimatePresence>
            {pending && (
                <motion.div
                    key="render-pending-indicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-none"
                >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full border border-app-text/15 bg-app-bg shadow-lg">
                        <Loader2 size={22} className="animate-spin text-app-text-muted" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
