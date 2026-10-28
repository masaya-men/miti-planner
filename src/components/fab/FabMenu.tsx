import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { itemVariants } from './mobileFabChips';

export interface FabMenuItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    accent: boolean;
}

interface FabMenuProps {
    open: boolean;
    menuRef: React.RefObject<HTMLDivElement | null>;
    updateScrollState: () => void;
    menuMaskImage: string;
    canScrollDown: boolean;
    allItems: (FabMenuItem | 'divider')[];
    langOpen: boolean;
    effectModeOpen: boolean;
    partyVisOpen: boolean;
    langButtonRef: React.RefObject<HTMLButtonElement | null>;
    effectModeButtonRef: React.RefObject<HTMLButtonElement | null>;
    partyVisButtonRef: React.RefObject<HTMLButtonElement | null>;
    langLabelRef: React.RefObject<HTMLSpanElement | null>;
    effectModeLabelRef: React.RefObject<HTMLSpanElement | null>;
    partyVisLabelRef: React.RefObject<HTMLSpanElement | null>;
}

export const FabMenu: React.FC<FabMenuProps> = ({
    open, menuRef, updateScrollState, menuMaskImage, canScrollDown, allItems,
    langOpen, effectModeOpen, partyVisOpen,
    langButtonRef, effectModeButtonRef, partyVisButtonRef,
    langLabelRef, effectModeLabelRef, partyVisLabelRef,
}) => (
    <>
            {/* メニュー項目 */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-menu"
                        ref={menuRef}
                        onScroll={updateScrollState}
                        className="flex flex-col items-end gap-2 mb-3 max-h-[calc(100svh-180px)] overflow-y-auto [&::-webkit-scrollbar]:hidden"
                        style={{
                            scrollbarWidth: 'none',
                            maskImage: menuMaskImage,
                            WebkitMaskImage: menuMaskImage,
                        }}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {allItems.map((item, idx) => {
                            if (item === 'divider') {
                                return (
                                    <motion.div
                                        key="divider"
                                        custom={idx}
                                        variants={itemVariants}
                                        className="w-28 h-px bg-app-border/60 my-0.5 mr-1"
                                    />
                                );
                            }
                            const isSync = item.key === 'sync';
                            const isLang = item.key === 'language';
                            const isEffectMode = item.key === 'effect-bar-mode';
                            const isPartyVis = item.key === 'party-visibility';
                            const isChipButton = isLang || isEffectMode || isPartyVis;
                            const chipRef = isLang ? langButtonRef : isEffectMode ? effectModeButtonRef : partyVisButtonRef;
                            const chipOpen = isLang ? langOpen : isEffectMode ? effectModeOpen : partyVisOpen;
                            const chipLabelRef = isLang ? langLabelRef : isEffectMode ? effectModeLabelRef : isPartyVis ? partyVisLabelRef : undefined;
                            return (
                                <motion.div
                                    key={item.key}
                                    custom={idx}
                                    variants={itemVariants}
                                    className="flex items-center gap-2.5"
                                    style={isChipButton ? { position: 'relative', zIndex: 50 } : undefined}
                                >
                                    {/* ラベル（ボタンの左） */}
                                    <span
                                        ref={isChipButton ? chipLabelRef : undefined}
                                        className="text-app-xl font-semibold text-white/90 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 select-none whitespace-nowrap shadow-md"
                                    >
                                        {item.label}
                                    </span>

                                    {/* ボタン */}
                                    {isChipButton ? (
                                        <motion.button
                                            ref={chipRef}
                                            onClick={item.onClick}
                                            className={clsx(
                                                "flex items-center justify-center border",
                                                "shadow-xl active:scale-90 transition-transform duration-100",
                                                "text-app-text"
                                            )}
                                            style={{
                                                width: MOBILE_TOKENS.fab.itemSize,
                                                height: MOBILE_TOKENS.fab.itemSize,
                                                borderRadius: MOBILE_TOKENS.fab.radius,
                                                backgroundColor: 'var(--color-fab-bg)',
                                                borderColor: 'var(--color-fab-border)',
                                            }}
                                            animate={chipOpen ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                            whileTap={{ scale: 0.9 }}
                                            transition={{ duration: 0.12 }}
                                        >
                                            {item.icon}
                                        </motion.button>
                                    ) : (
                                        <button
                                            onClick={item.onClick}
                                            disabled={'disabled' in item ? Boolean(item.disabled) : false}
                                            className={clsx(
                                                "flex items-center justify-center border",
                                                "shadow-xl active:scale-90 transition-transform duration-100",
                                                "disabled:pointer-events-none disabled:opacity-40",
                                                isSync
                                                    ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                                                    : "text-app-text"
                                            )}
                                            style={{
                                                width: MOBILE_TOKENS.fab.itemSize,
                                                height: MOBILE_TOKENS.fab.itemSize,
                                                borderRadius: MOBILE_TOKENS.fab.radius,
                                                ...(!isSync ? {
                                                    backgroundColor: 'var(--color-fab-bg)',
                                                    borderColor: 'var(--color-fab-border)',
                                                } : {}),
                                            }}
                                        >
                                            {item.icon}
                                        </button>
                                    )}

                                </motion.div>
                            );
                        })}

                        {/* スクロール可能ヒント: ↓ アイコン（canScrollDown のみ。sticky bottom でメニュー下端に常駐） */}
                        {canScrollDown && (
                            <div
                                className="sticky bottom-0 self-center pointer-events-none -mt-1"
                                aria-hidden
                            >
                                <ChevronDown size={20} className="text-white drop-shadow-md animate-bounce" />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
    </>
);
