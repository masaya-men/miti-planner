import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';

interface FabMainButtonProps {
    open: boolean;
    isMobileScrolling: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    closeAllChips: () => void;
}

export const FabMainButton: React.FC<FabMainButtonProps> = ({ open, isMobileScrolling, setOpen, closeAllChips }) => (
    <>
            {/* メインFABボタン。タイムラインをスクロール中(かつメニューが開いていない時)だけ
                縮小+透明化して隠す(親指の邪魔になる実機FB対応)。メニューを開いたまま偶発的に
                スクロールされても本体ごと消えて宙に浮かないよう !open をガードに入れる。
                閉じる時はfan-outチップも道連れに閉じる(2026-08-14実機FB=言語チップが
                「言語を選択するまで消えない」バグの根治=このボタンでもチップを閉じる)。 */}
            <motion.button
                onClick={() => setOpen(prev => {
                    const next = !prev;
                    if (!next) closeAllChips();
                    return next;
                })}
                className="flex items-center justify-center border text-app-text shadow-2xl"
                style={{
                    width: MOBILE_TOKENS.fab.size,
                    height: MOBILE_TOKENS.fab.size,
                    borderRadius: MOBILE_TOKENS.fab.radius,
                    backgroundColor: 'var(--color-fab-bg)',
                    borderColor: 'var(--color-fab-border)',
                    pointerEvents: (isMobileScrolling && !open) ? 'none' : 'auto',
                }}
                // active:scale-90 + transition-all(CSS)を外した: framer-motionのanimate/whileTapと
                // 同じtransformを取り合ってカクつく原因になっていた(2026-08-13実機FB=消える/出現する
                // アニメがぎこちない)。press演出はwhileTapだけに一本化。
                // scroll中の縮小/透明化はバネ(spring)だとopacityとscaleの収束タイミングがズレて
                // ぎこちなく見えるため、両方が同じ速度で揃って動く一定時間のtween+MD3標準イージングに変更。
                animate={{ scale: (isMobileScrolling && !open) ? 0 : 1, opacity: (isMobileScrolling && !open) ? 0 : 1 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                whileTap={{ scale: 0.88, transition: { duration: 0.1 } }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {open ? (
                        <motion.span
                            key="close"
                            initial={{ rotate: -45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X size={22} />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="open"
                            initial={{ rotate: 45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MoreHorizontal size={22} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
    </>
);
