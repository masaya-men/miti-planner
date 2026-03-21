import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import clsx from 'clsx';

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
                    className="absolute inset-0 bg-black/40 backdrop-blur-md cursor-pointer"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative w-full max-w-[400px] bg-glass-panel/70 backdrop-blur-2xl border border-glass-border/50 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto"
                >
                    <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                        <h2 className="text-[13px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                            <span className="w-1.5 h-4 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
                            {t('save_dialog.title', 'Save Plan')}
                        </h2>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-glass-hover rounded-full transition-colors text-app-text-muted hover:text-app-text cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-3.5">
                            <label className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.25em] pl-1">
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
                                className="w-full px-5 py-4 bg-glass-card/40 border border-glass-border/30 rounded-2xl text-[13px] focus:outline-none focus:border-emerald-500/50 focus:ring-4 ring-emerald-500/15 transition-all font-black text-app-text placeholder:text-app-text-muted/50"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[11px] font-black text-app-text-muted hover:bg-glass-hover hover:text-app-text transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim()}
                            className={clsx(
                                "flex-[2] py-3.5 rounded-2xl text-[11px] font-black transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95 flex items-center justify-center gap-2",
                                title.trim()
                                    ? "bg-emerald-500 text-white shadow-[0_12px_24px_-4px_rgba(16,185,129,0.4)] hover:brightness-110"
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
