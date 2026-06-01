
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { clsx } from 'clsx';
import { useTutorialStore } from '../store/useTutorialStore';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import EventForm from './EventForm';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    initialData?: TimelineEvent | null;
    initialTime?: number;
    position?: { x: number; y: number };
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData, initialTime, position }) => {
    useEscapeClose(isOpen, onClose);
    const { t } = useTranslation();
    const isTutorialActive = useTutorialStore(s => s.isActive);

    // Mobile Detection (positioning / chrome 用)
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!isOpen) return null;

    const handleBackdropClick = () => {
        // Tutorial: block closing the modal during the tutorial
        if (useTutorialStore.getState().isActive) return;
        onClose();
    };

    // 保存後はモーダルを閉じる (従来挙動を維持)
    const handleSave = (ev: Omit<TimelineEvent, 'id'>) => {
        onSave(ev);
        onClose();
    };

    // 削除後はモーダルを閉じる (従来挙動を維持)
    const handleDelete = onDelete
        ? () => {
              onDelete();
              onClose();
          }
        : undefined;

    // Right-side positioning logic (offset by 20px from cursor)
    const x = position ? Math.min(position.x + 20, window.innerWidth - 520) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 600) : '50%'; // Approx height

    // Style logic:
    // 1. Mobile -> Bottom sheet (fixed to bottom, above bottom nav)
    // 2. Tutorial Active -> Force Center
    // 3. Desktop with position -> Follow cursor
    // 4. Desktop without position -> Center
    const desktopStyle = isTutorialActive
        ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        : (position
            ? { left: x, top: y }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        );

    return createPortal(
        <div className="fixed inset-0 z-[9999] text-left pointer-events-none">
            {/* Transparent Backdrop */}
            <div className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? '' : 'bg-transparent'}`} style={{ backgroundColor: isMobile ? 'var(--color-overlay)' : 'transparent' }} onClick={handleBackdropClick} />

            <div
                data-tutorial-modal
                data-lenis-prevent
                onClick={(e) => e.stopPropagation()}
                className={clsx(
                    "flex flex-col overflow-hidden shadow-sm ring-1 ring-inset pointer-events-auto",
                    !isMobile && "glass-tier3",
                    "ring-black/[0.02] dark:ring-white/5",
                    isMobile
                        ? "fixed bottom-14 left-0 right-0 z-[9999] w-full max-h-[75vh] border-b-0"
                        : "absolute w-[500px] rounded-2xl transition-all duration-200"
                )}
                style={isMobile ? {
                    backgroundColor: 'var(--color-sheet-bg)',
                    borderTopLeftRadius: MOBILE_TOKENS.sheet.radius,
                    borderTopRightRadius: MOBILE_TOKENS.sheet.radius,
                } : desktopStyle}
            >
                {/* Mobile Drag Handle Indicator */}
                {isMobile && (
                    <div className="flex justify-center pt-2.5 pb-1">
                        <div
                            className="bg-[var(--app-text)]/20"
                            style={{
                                width: MOBILE_TOKENS.sheet.handleWidth,
                                height: MOBILE_TOKENS.sheet.handleHeight,
                                borderRadius: MOBILE_TOKENS.sheet.handleRadius,
                            }}
                        />
                    </div>
                )}

                {isMobile ? (
                    /* Mobile iOS-style Navbar: キャンセル + タイトル + 保存 */
                    <div className="flex justify-between items-center px-4 py-2.5 border-b flex-shrink-0 border-app-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-app-blue text-app-2xl font-medium cursor-pointer"
                        >
                            {t('app.event_cancel', { defaultValue: 'キャンセル' })}
                        </button>
                        <h2 className="text-app-2xl font-bold text-app-text">
                            {initialData ? t('app.event_edit_title', { defaultValue: 'イベント編集' }) : t('app.event_add_title', { defaultValue: 'イベント追加' })}
                        </h2>
                        <button
                            type="submit"
                            form="event-modal-form"
                            className="text-app-blue text-app-2xl font-bold cursor-pointer"
                        >
                            {t('app.event_save', { defaultValue: '保存' })}
                        </button>
                    </div>
                ) : (
                    /* PC Title Row */
                    <div className={clsx(
                        "flex justify-between items-center px-6 py-4 border-b flex-shrink-0 transition-colors",
                        "border-app-border bg-app-surface2"
                    )}>
                        <h2 className={clsx(
                            "text-app-2xl font-bold transition-colors",
                            "text-app-text"
                        )}>
                            {initialData ? t('modal.edit_event') : t('modal.add_event')}
                        </h2>
                        <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90">
                            <X size={16} />
                        </button>
                    </div>
                )}

                <EventForm
                    variant="modal"
                    onSave={handleSave}
                    onDelete={handleDelete}
                    initialData={initialData}
                    initialTime={initialTime}
                />
            </div>
        </div>,
        document.body
    );
};
