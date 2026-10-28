import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ContentLanguage } from '../../store/useThemeStore';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { LANG_LABELS, LANG_DISPLAY_ORDER, FAN_CHIP_SIZE, fanChipX, fanChipVariants } from './mobileFabChips';

interface FabLanguageChipsProps {
    langButtonRect: DOMRect | null;
    langOpen: boolean;
    langLabelWidth: number;
    selectedLang: ContentLanguage | null;
    handleLanguageSelect: (lang: ContentLanguage) => void;
}

export const FabLanguageChips: React.FC<FabLanguageChipsProps> = ({ langButtonRect, langOpen, langLabelWidth, selectedLang, handleLanguageSelect }) => {
    const { i18n } = useTranslation();
    return (
        <>
            {/* 言語チップ — Portal で body に出して、メニューの overflow に縛られず左に展開できる */}
            {langButtonRect && createPortal(
                <AnimatePresence>
                    {langOpen && LANG_DISPLAY_ORDER.map((lang: ContentLanguage, i: number) => (
                        <motion.button
                            key={lang}
                            custom={{ i, targetX: fanChipX(i, LANG_DISPLAY_ORDER.length, langLabelWidth), count: LANG_DISPLAY_ORDER.length, isSelected: selectedLang === lang }}
                            variants={fanChipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            whileTap="tap"
                            onClick={() => handleLanguageSelect(lang)}
                            className={clsx(
                                "fixed flex items-center justify-center rounded-full",
                                "font-semibold text-app-xl shadow-lg select-none",
                                lang === (i18n.language as ContentLanguage)
                                    ? "bg-app-blue text-white shadow-app-blue/30"
                                    : "bg-black/70 text-white/90 backdrop-blur-sm"
                            )}
                            style={{
                                width: FAN_CHIP_SIZE,
                                height: FAN_CHIP_SIZE,
                                left: langButtonRect.left + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                top: langButtonRect.top + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                zIndex: 9999,
                            }}
                        >
                            {LANG_LABELS[lang]}
                        </motion.button>
                    ))}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};
