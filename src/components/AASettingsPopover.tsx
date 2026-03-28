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
    onStartAdding: () => void;    // 「追加開始」ボタン押下時のコールバック
    isAaActive?: boolean;         // AAモード中かどうか（true の場合はボタン非表示）
}

export const AASettingsPopover: React.FC<AASettingsPopoverProps> = ({
    isOpen,
    onClose,
    settings,
    onSettingsChange,
    triggerRef,
    onStartAdding,
    isAaActive
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
                "fixed w-[280px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
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
                    <Settings size={14} className="text-app-text-sec" />
                    <span className="text-xs font-black text-app-text uppercase tracking-wider">{t('aa_settings.popover_header')}</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-app-text transition-colors cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">

                {/* Target */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-app-text uppercase tracking-wider block">{t('aa_settings.target')}</label>
                    <div className="flex bg-glass-card p-1 rounded-md border border-glass-border">
                        {['MT', 'ST'].map((target) => (
                            <button
                                key={target}
                                className={clsx(
                                    "flex-1 py-1 px-2 text-xs font-black rounded transition-colors cursor-pointer",
                                    settings.target === target
                                        ? "bg-app-text text-app-bg border border-app-text"
                                        : "text-app-text hover:bg-glass-hover"
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
                        <label className="text-[10px] font-black text-app-text uppercase tracking-wider block">{t('aa_settings.damage')}</label>
                        <div className="group relative">
                            <Info size={12} className="text-app-text-sec cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black/90 border border-app-border rounded text-[10px] text-gray-300 leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {t('aa_settings.help_text')}
                            </div>
                        </div>
                    </div>

                    <input
                        type="number"
                        value={settings.damage}
                        onChange={(e) => handleChange('damage', Number(e.target.value))}
                        className="w-full bg-glass-card border border-glass-border rounded-md px-3 py-1.5 text-sm font-black font-mono text-app-text focus:outline-none focus:border-app-text transition-colors"
                        onFocus={(e) => e.target.select()}
                    />
                </div>

                {/* Damage Type */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-app-text uppercase tracking-wider block">{t('aa_settings.type')}</label>
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
                                        ? "bg-app-text/10 border-app-text"
                                        : "bg-glass-card border-glass-border hover:bg-glass-hover hover:border-app-border"
                                )}
                                onClick={() => handleChange('type', type.id)}
                            >
                                <img src={type.icon} alt={String(type.label)} className="w-5 h-5 object-contain opacity-90" />
                                <span className={clsx("text-[9px] font-black", settings.type === type.id ? 'text-app-text' : 'text-app-text')}>{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* Footer — 追加開始ボタン（AAモード中は非表示） */}
            {!isAaActive && (
                <div className="px-4 pb-4 pt-1">
                    <button
                        onClick={() => {
                            if (settings.damage > 0) {
                                onStartAdding();
                                onClose();
                            }
                        }}
                        disabled={settings.damage <= 0}
                        className={clsx(
                            "w-full py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer",
                            settings.damage > 0
                                ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                                : "bg-app-text/20 text-app-text/40 cursor-not-allowed"
                        )}
                    >
                        {settings.damage > 0
                            ? t('aa_settings.start_adding')
                            : t('aa_settings.damage_required')
                        }
                    </button>
                </div>
            )}
        </div>,
        document.body
    );
};
