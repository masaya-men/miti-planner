import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTutorialStore } from '../store/useTutorialStore';

interface PhaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, time?: number) => void;
    onDelete?: () => void;
    initialName?: string;
    initialTime?: number; // End Time
    isEdit?: boolean;
    position?: { x: number; y: number };
}

export const PhaseModal: React.FC<PhaseModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialName = '',
    initialTime,
    isEdit = false,
    position
}) => {
    const [name, setName] = useState(initialName);
    const [time, setTime] = useState(initialTime || 0);
    const [mounted, setMounted] = useState(false);
    const { t } = useTranslation();

    // Mobile Detection
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setTime(initialTime || 0);
        }
    }, [isOpen, initialName, initialTime]);

    if (!mounted) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(name, time);
        onClose();
    };

    const handleBackdropClick = () => {
        // Tutorial: block closing the modal during the tutorial
        if (useTutorialStore.getState().isActive) return;

        if (name.trim()) {
            onSave(name, time);
        }
        onClose();
    };

    const x = position ? Math.min(position.x, window.innerWidth - 420) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 300) : '50%';
    const style = isMobile ? { bottom: 0, left: 0, right: 0, width: '100%', transform: 'none' } : (position ? { left: x, top: y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] text-left pointer-events-none flex flex-col justify-end">
                    {/* Transparent Backdrop to close on click outside */}
                    <div className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`} onClick={handleBackdropClick} />

                    <motion.div
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.1 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute bg-[#020203] border border-white/[0.08] shadow-2xl overflow-hidden ring-1 ring-white/5 glass-panel pointer-events-auto flex flex-col ${isMobile ? 'w-full rounded-t-2xl rounded-b-none border-b-0' : 'w-[400px] rounded-xl'}`}
                        style={style}
                    >
                        {/* Mobile Drag Handle Indicator */}
                        {isMobile && <div className="w-12 h-1 bg-slate-700 dark:bg-slate-600 rounded-full mx-auto mt-3 shrink-0" />}

                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.05] bg-black/40 shrink-0">
                            <h2 className="text-sm font-bold text-slate-200">
                                {isEdit ? t('timeline.edit_phase') : t('phase_modal.title')}
                            </h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('phase_modal.name_label')}</label>
                                <input
                                    type="text"
                                    inputMode="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500/50 focus:bg-blue-500/[0.05] focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-barlow"
                                    placeholder={t('phase_modal.placeholder')}
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                {isEdit && onDelete ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete();
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-md flex items-center gap-1.5 transition-colors text-xs cursor-pointer"
                                    >
                                        <Trash2 size={14} />
                                        <span>{t('modal.delete')}</span>
                                    </button>
                                ) : <div></div>}

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors text-xs font-medium cursor-pointer"
                                    >
                                        {t('modal.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all border border-blue-500/50 uppercase cursor-pointer"
                                    >
                                        {t('phase_modal.add_button')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
