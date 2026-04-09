import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';
import { createPortal } from 'react-dom';
import { Settings, X } from 'lucide-react';
import clsx from 'clsx';
import { SegmentButton } from './ui/SegmentButton';
import type { AASettings } from '../store/useMitigationStore';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';

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
    useEscapeClose(isOpen, onClose);

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
        <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={isPositioned ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }}
            transition={{
                scale: SPRING.dialog,
                opacity: { duration: 0.2 },
            }}
            className="fixed w-[280px] glass-tier3 rounded-lg z-[9999] overflow-hidden shadow-sm"
            style={{
                top: `${popoverPosition.top}px`,
                left: `${popoverPosition.left}px`,
                transformOrigin: 'top left',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-glass-header border-b border-glass-border">
                <div className="flex items-center gap-2">
                    <Settings size={14} className="text-app-text-sec" />
                    <span className="text-app-lg font-black text-app-text uppercase tracking-wider">{t('aa_settings.popover_header')}</span>
                </div>
                <button
                    onClick={onClose}
                    className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">

                {/* Target */}
                <div className="space-y-1.5">
                    <label className="text-app-base font-black text-app-text uppercase tracking-wider block">{t('aa_settings.target')}</label>
                    <SegmentButton
                        options={[
                            { value: 'MT', label: 'MT' },
                            { value: 'ST', label: 'ST' },
                        ]}
                        value={settings.target}
                        onChange={(v) => handleChange('target', v)}
                        size="sm"
                    />
                </div>

                {/* Damage Amount */}
                <div className="space-y-1.5">
                    <label className="text-app-base font-black text-app-text uppercase tracking-wider block">{t('aa_settings.damage')}</label>

                    <input
                        type="number"
                        value={settings.damage}
                        onChange={(e) => handleChange('damage', Number(e.target.value))}
                        className="w-full bg-glass-card border border-glass-border rounded-md px-3 py-1.5 text-[16px] md:text-app-2xl font-black font-mono text-app-text focus:outline-none focus:border-app-text transition-colors"
                        onFocus={(e) => e.target.select()}
                    />
                </div>

                {/* Damage Type */}
                <div className="space-y-1.5">
                    <label className="text-app-base font-black text-app-text uppercase tracking-wider block">{t('aa_settings.type')}</label>
                    <SegmentButton
                        options={[
                            { value: 'magical', label: t('aa_settings.magic'), icon: '/icons/type_magic.png' },
                            { value: 'physical', label: t('aa_settings.phys'), icon: '/icons/type_phys.png' },
                            { value: 'unavoidable', label: t('aa_settings.dark'), icon: '/icons/type_dark.png' },
                        ]}
                        value={settings.type}
                        onChange={(v) => handleChange('type', v)}
                        size="sm"
                    />
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
                            "w-full py-2 rounded-md text-app-lg font-black uppercase tracking-wider transition-all duration-200 cursor-pointer border",
                            settings.damage > 0
                                ? "border-app-text text-app-text bg-transparent hover:bg-app-toggle hover:text-app-toggle-text active:scale-[0.98]"
                                : "border-app-text/20 text-app-text/40 bg-transparent cursor-not-allowed"
                        )}
                    >
                        {settings.damage > 0
                            ? t('aa_settings.start_adding')
                            : t('aa_settings.damage_required')
                        }
                    </button>
                </div>
            )}
        </motion.div>,
        document.body
    );
};
