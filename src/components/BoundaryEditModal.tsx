import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';
import { X, Trash2, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useThemeStore } from '../store/useThemeStore';
import type { LocalizedString } from '../types';

interface BoundaryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: LocalizedString, endTime?: number) => void;
    onDelete?: () => void;
    onStartTimelineSelect?: () => void;
    initial?: { name: LocalizedString; endTime?: number };
    isEdit?: boolean;
    mode: 'phase' | 'label';
    position?: { x: number; y: number };
}

/** MM:SS形式を秒に変換 */
function parseTimeInput(value: string): number | null {
    const match = value.match(/^(\d+):(\d{1,2})$/);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    const num = parseInt(value);
    return isNaN(num) ? null : num;
}

/** 秒をMM:SS形式に変換 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const BoundaryEditModal: React.FC<BoundaryEditModalProps> = ({
    isOpen, onClose, onSave, onDelete, onStartTimelineSelect,
    initial, isEdit = false, mode, position
}) => {
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);
    const { contentLanguage } = useThemeStore();

    const [nameInput, setNameInput] = useState('');
    const [preservedName, setPreservedName] = useState<LocalizedString>({ ja: '', en: '' });
    const [endTimeInput, setEndTimeInput] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    useEffect(() => {
        if (isOpen && initial) {
            setPreservedName(initial.name);
            const langValue = initial.name[contentLanguage as keyof LocalizedString] || initial.name.ja || initial.name.en || '';
            setNameInput(langValue);
            setEndTimeInput(initial.endTime !== undefined ? formatTime(initial.endTime) : '');
        } else if (isOpen) {
            setPreservedName({ ja: '', en: '' });
            setNameInput('');
            setEndTimeInput('');
        }
    }, [isOpen, initial, contentLanguage]);

    if (!mounted) return null;

    const buildName = (): LocalizedString => {
        const name = { ...preservedName };
        const lang = contentLanguage as keyof LocalizedString;
        (name as any)[lang] = nameInput.trim();
        // Ensure ja and en always exist
        if (!name.ja) name.ja = '';
        if (!name.en) name.en = '';
        return name;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
        onSave(buildName(), endTime);
        onClose();
    };

    const handleBackdropClick = () => {
        if (nameInput.trim()) {
            const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
            onSave(buildName(), endTime);
        }
        onClose();
    };

    const titleKey = isEdit
        ? (mode === 'phase' ? 'boundary_modal.edit_phase' : 'boundary_modal.edit_label')
        : (mode === 'phase' ? 'boundary_modal.add_phase' : 'boundary_modal.add_label');

    const x = position ? Math.min(position.x, window.innerWidth - 420) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 400) : '50%';
    const style = isMobile
        ? { bottom: 0, left: 0, right: 0, width: '100%', transform: 'none' }
        : (position ? { left: x, top: y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] text-left pointer-events-none flex flex-col justify-end">
                    <div
                        className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}`}
                        onClick={handleBackdropClick}
                    />
                    <motion.div
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.2 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
                        transition={isMobile
                            ? { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
                            : { scale: SPRING.dialog, opacity: { duration: 0.2 } }
                        }
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute shadow-sm overflow-hidden ring-1 ring-app-border glass-tier3 pointer-events-auto flex flex-col ${isMobile ? 'w-full rounded-t-2xl rounded-b-none border-b-0' : 'w-[400px] rounded-xl'}`}
                        style={style}
                    >
                        {isMobile && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mt-3 shrink-0" />}

                        <div className="flex justify-between items-center px-6 py-4 border-b border-app-border bg-app-surface2/40 shrink-0">
                            <h2 className="text-app-2xl font-bold text-app-text">{t(titleKey)}</h2>
                            <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_label')}</label>
                                <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                                    className="w-full bg-app-surface2 border border-app-border rounded-lg p-2.5 text-[16px] md:text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                    placeholder={t('boundary_modal.name_placeholder')} autoFocus />
                            </div>

                            {isEdit && (
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.end_time')}</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)}
                                            className="flex-1 bg-app-surface2 border border-app-border rounded-lg p-2 text-[16px] md:text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                            placeholder="M:SS" />
                                        {onStartTimelineSelect && (
                                            <button type="button" onClick={() => { onStartTimelineSelect(); }}
                                                className="px-3 py-2 text-app-text rounded-lg border border-app-border hover:bg-app-surface2 transition-colors flex items-center gap-1.5 text-app-sm cursor-pointer">
                                                <Crosshair size={14} />
                                                <span>{t('boundary_modal.select_on_timeline')}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                {isEdit && onDelete ? (
                                    <button type="button" onClick={() => { onDelete(); onClose(); }}
                                        className="px-3 py-1.5 text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-md flex items-center gap-1.5 transition-colors text-app-lg cursor-pointer">
                                        <Trash2 size={14} />
                                        <span>{t('modal.delete')}</span>
                                    </button>
                                ) : <div />}
                                <div className="flex gap-2">
                                    <button type="button" onClick={onClose}
                                        className="px-4 py-1.5 text-app-text rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 text-app-lg font-medium cursor-pointer active:scale-95">
                                        {t('modal.cancel')}
                                    </button>
                                    <button type="submit"
                                        className="px-4 py-1.5 bg-app-blue text-white hover:bg-app-blue-hover rounded-md text-app-lg font-semibold transition-all uppercase cursor-pointer">
                                        {t('modal.save')}
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
