import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { MobileEffectBarMode } from '../../store/useThemeStore';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { EFFECT_MODE_ORDER, EFFECT_MODE_CHIP_LABELS, FAN_CHIP_SIZE, fanChipX, fanChipVariants } from './mobileFabChips';

interface FabEffectModeChipsProps {
    effectModeButtonRect: DOMRect | null;
    effectModeOpen: boolean;
    effectModeLabelWidth: number;
    mobileEffectBarMode: MobileEffectBarMode;
    handleEffectModeSelect: (mode: MobileEffectBarMode) => void;
}

export const FabEffectModeChips: React.FC<FabEffectModeChipsProps> = ({ effectModeButtonRect, effectModeOpen, effectModeLabelWidth, mobileEffectBarMode, handleEffectModeSelect }) => (
    <>
            {/* エフェクトモードチップ — 言語チップと同じPortalパターン(2026-08-14ユーザー要望)。 */}
            {effectModeButtonRect && createPortal(
                <AnimatePresence>
                    {effectModeOpen && EFFECT_MODE_ORDER.map((mode, i) => (
                        <motion.button
                            key={mode}
                            custom={{ i, targetX: fanChipX(i, EFFECT_MODE_ORDER.length, effectModeLabelWidth), count: EFFECT_MODE_ORDER.length, isSelected: mobileEffectBarMode === mode }}
                            variants={fanChipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            whileTap="tap"
                            onClick={() => handleEffectModeSelect(mode)}
                            className={clsx(
                                "fixed flex items-center justify-center rounded-full",
                                "font-semibold text-app-xl shadow-lg select-none",
                                mode === mobileEffectBarMode
                                    ? "bg-app-blue text-white shadow-app-blue/30"
                                    : "bg-black/70 text-white/90 backdrop-blur-sm"
                            )}
                            style={{
                                width: FAN_CHIP_SIZE,
                                height: FAN_CHIP_SIZE,
                                left: effectModeButtonRect.left + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                top: effectModeButtonRect.top + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                zIndex: 9999,
                            }}
                        >
                            {EFFECT_MODE_CHIP_LABELS[mode]}
                        </motion.button>
                    ))}
                </AnimatePresence>,
                document.body
            )}
    </>
);
