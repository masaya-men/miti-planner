import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Users, Crosshair, Wrench, X } from 'lucide-react';
import clsx from 'clsx';

interface MobileGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const STEPS = [
    { titleKey: 'step1_title', descKey: 'step1_desc', Icon: Menu },
    { titleKey: 'step2_title', descKey: 'step2_desc', Icon: Users },
    { titleKey: 'step3_title', descKey: 'step3_desc', Icon: Crosshair },
    { titleKey: 'step4_title', descKey: 'step4_desc', Icon: Wrench },
] as const;

export const MobileGuide: React.FC<MobileGuideProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(0);

    const handleNext = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setDirection(1);
            setCurrentStep(prev => prev + 1);
        } else {
            onClose();
        }
    }, [currentStep, onClose]);

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            setDirection(-1);
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    if (!isOpen) return null;

    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;

    return createPortal(
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={clsx(
                    "w-full max-w-xs rounded-2xl overflow-hidden flex flex-col",
                    "bg-app-surface border border-app-border shadow-lg"
                )}
            >
                {/* ヘッダー */}
                <div className={clsx(
                    "px-4 pt-4 pb-2 flex items-center justify-between",
                )}>
                    <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">
                        {t('mobile_guide.title')}
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-app-surface2 text-app-text-muted cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* カード本体 */}
                <div className="px-6 py-6 flex flex-col items-center text-center min-h-[180px] relative overflow-hidden">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            initial={{ opacity: 0, x: direction >= 0 ? 40 : -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction >= 0 ? -40 : 40 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="flex flex-col items-center gap-4"
                        >
                            <div className={clsx(
                                "w-14 h-14 rounded-2xl flex items-center justify-center",
                                "bg-app-text/10"
                            )}>
                                <step.Icon size={28} className="text-app-text" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-app-text mb-1.5">
                                    {t(`mobile_guide.${step.titleKey}`)}
                                </h3>
                                <p className="text-[13px] text-app-text-muted leading-relaxed">
                                    {t(`mobile_guide.${step.descKey}`)}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ドットインジケーター */}
                <div className="flex justify-center gap-1.5 pb-3">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                i === currentStep ? "bg-app-text w-4" : "bg-app-text/20"
                            )}
                        />
                    ))}
                </div>

                {/* ボタン */}
                <div className={clsx(
                    "px-4 pb-4 flex gap-2",
                )}>
                    {currentStep > 0 && (
                        <button
                            onClick={handlePrev}
                            className={clsx(
                                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
                                "bg-app-surface2 text-app-text border border-app-border"
                            )}
                        >
                            {t('mobile_guide.prev')}
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={clsx(
                            "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
                            "bg-app-text text-app-bg"
                        )}
                    >
                        {isLast ? t('mobile_guide.done') : t('mobile_guide.next')}
                    </button>
                </div>
            </motion.div>
        </div>,
        document.body
    );
};
