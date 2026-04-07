import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface SaveDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string) => void;
    defaultTitle?: string;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    defaultTitle = '' 
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState(defaultTitle);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEscapeClose(isOpen, onClose);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTitle(defaultTitle);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultTitle]);

    const handleSave = () => {
        if (title.trim()) {
            onSave(title.trim());
        }
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative w-full max-w-[400px] glass-tier3 rounded-2xl shadow-sm overflow-hidden flex flex-col pointer-events-auto"
                >
                    <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                        <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                            <span className="w-1.5 h-4 bg-app-text rounded-full" />
                            {t('save_dialog.title', 'Save Plan')}
                        </h2>
                        <button 
                            onClick={onClose} 
                            className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-3.5">
                            <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('save_dialog.plan_name_label', 'Plan Name')}
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') onClose();
                                }}
                                placeholder={t('save_dialog.plan_name_placeholder', 'Enter plan name...')}
                                className="w-full px-5 py-4 bg-glass-card/40 border border-glass-border/30 rounded-2xl text-[16px] md:text-app-xl focus:outline-none focus:border-app-text transition-all font-black text-app-text placeholder:text-app-text-muted/50"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-app-md font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim()}
                            className={clsx(
                                "flex-[2] py-3.5 rounded-2xl text-app-md font-black transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95 flex items-center justify-center gap-2",
                                title.trim()
                                    ? "bg-app-blue text-white hover:bg-app-blue-hover"
                                    : "bg-glass-card/40 text-app-text-muted cursor-not-allowed opacity-40 grayscale"
                            )}
                        >
                            <Save size={16} />
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
