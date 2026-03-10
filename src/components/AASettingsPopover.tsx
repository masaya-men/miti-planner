import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Info } from 'lucide-react';
import clsx from 'clsx';
import type { AASettings } from '../store/useMitigationStore';
import { useTranslation } from 'react-i18next';

interface AASettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AASettings;
    onSettingsChange: (settings: AASettings) => void;
    triggerRef?: React.RefObject<HTMLElement | null>;
}

export const AASettingsPopover: React.FC<AASettingsPopoverProps> = ({
    isOpen,
    onClose,
    settings,
    onSettingsChange,
    triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                // If triggerRef exists and the click is inside the trigger, do nothing (let the trigger handle the toggle)
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) {
                    return;
                }
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPopoverPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    if (!isOpen) return null;

    const handleChange = (field: keyof AASettings, value: any) => {
        onSettingsChange({
            ...settings,
            [field]: value
        });
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[280px] glass-panel rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{
                top: `${popoverPosition.top}px`,
                left: `${popoverPosition.left}px`,
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-glass-header border-b border-glass-border">
                <div className="flex items-center gap-2">
                    <Settings size={14} className="text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t('aa_settings.popover_header')}</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-slate-800 dark:text-white transition-colors cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">

                {/* Target */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">{t('aa_settings.target')}</label>
                    <div className="flex bg-glass-card p-1 rounded-md border border-glass-border">
                        {['MT', 'ST'].map((target) => (
                            <button
                                key={target}
                                className={clsx(
                                    "flex-1 py-1 px-2 text-xs font-bold rounded transition-colors cursor-pointer",
                                    settings.target === target
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-900/ dark:hover:bg-white/"
                                )}
                                onClick={() => handleChange('target', target)}
                            >
                                {target}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Damage Amount */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">{t('aa_settings.damage')}</label>
                        <div className="group relative">
                            <Info size={12} className="text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded text-[10px] text-slate-700 dark:text-slate-300 leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {t('aa_settings.help_text')}
                            </div>
                        </div>
                    </div>

                    <input
                        type="number"
                        value={settings.damage}
                        onChange={(e) => handleChange('damage', Number(e.target.value))}
                        className="w-full bg-glass-card border border-glass-border rounded-md px-3 py-1.5 text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors"
                        onFocus={(e) => e.target.select()}
                    />
                </div>

                {/* Damage Type */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">{t('aa_settings.type')}</label>
                    <div className="flex gap-2">
                        {[
                            { id: 'magical', label: t('aa_settings.magic'), icon: '/icons/type_magic.png', color: 'text-cyan-300' },
                            { id: 'physical', label: t('aa_settings.phys'), icon: '/icons/type_phys.png', color: 'text-orange-300' },
                            { id: 'unavoidable', label: t('aa_settings.dark'), icon: '/icons/type_dark.png', color: 'text-purple-300' }
                        ].map((type) => (
                            <button
                                key={type.id}
                                className={clsx(
                                    "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded border transition-all gap-1 cursor-pointer",
                                    settings.type === type.id
                                        ? `bg-blue-500/10 border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.2)]`
                                        : "bg-glass-card border-glass-border hover:bg-glass-hover hover:border-white/10"
                                )}
                                onClick={() => handleChange('type', type.id)}
                            >
                                <img src={type.icon} alt={String(type.label)} className="w-5 h-5 object-contain opacity-90" />
                                <span className={clsx("text-[9px] font-bold", settings.type === type.id ? 'text-blue-300' : 'text-slate-500')}>{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );
};
