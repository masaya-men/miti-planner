import { backdropClose } from '../utils/backdropClose';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { clampToViewport } from '../utils/clampToViewport';
import { useThemeStore } from '../store/useThemeStore';
import type { LocalizedString } from '../types';
import { TimeInput } from './ui/TimeInput';
import { ModalHeader, ModalButton, INPUT_CLASS } from './ui/ModalParts';

interface BoundaryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: LocalizedString, startTime?: number, endTime?: number) => void;
    onDelete?: () => void;
    onTimelineSelectStart?: () => void;
    onTimelineSelectEnd?: () => void;
    initial?: { name: LocalizedString; startTime?: number; endTime?: number };
    isEdit?: boolean;
    mode: 'phase' | 'label';
    position?: { x: number; y: number };
}


export const BoundaryEditModal: React.FC<BoundaryEditModalProps> = ({
    isOpen, onClose, onSave, onDelete, onTimelineSelectStart, onTimelineSelectEnd,
    initial, isEdit = false, mode, position
}) => {
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);
    const { contentLanguage } = useThemeStore();

    const [nameInput, setNameInput] = useState('');
    const [preservedName, setPreservedName] = useState<LocalizedString>({ ja: '', en: '' });
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    // PC: モーダル実寸を測って画面内にクランプ(固定値400での概算をやめる)。
    // useLayoutEffect はペイント前に走るので、初回フレームの中央位置は表示前に確定位置へ補正される。
    const modalRef = useRef<HTMLDivElement>(null);
    const [clampedPos, setClampedPos] = useState<{ left: number; top: number } | null>(null);
    useLayoutEffect(() => {
        if (!isOpen || isMobile || !position) return;
        const el = modalRef.current;
        if (!el) return;
        const c = clampToViewport(
            { x: position.x, y: position.y },
            { w: el.offsetWidth, h: el.offsetHeight },
            { w: window.innerWidth, h: window.innerHeight },
            8,
        );
        setClampedPos({ left: c.x, top: c.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 位置は position の x / y が変わった時だけ測り直す(position オブジェクトは毎回作り直されるため座標値で比較)
    }, [isOpen, isMobile, position?.x, position?.y]);

    useEffect(() => {
        if (isOpen && initial) {
            setPreservedName(initial.name);
            const langValue = initial.name[contentLanguage as keyof LocalizedString] || initial.name.ja || initial.name.en || '';
            setNameInput(langValue);
            setStartTime(initial.startTime ?? null);
            setEndTime(initial.endTime ?? null);
        } else if (isOpen) {
            setPreservedName({ ja: '', en: '' });
            setNameInput('');
            setStartTime(null);
            setEndTime(null);
        }
    }, [isOpen, initial, contentLanguage]);

    if (!mounted) return null;

    const buildName = (): LocalizedString => {
        const name = { ...preservedName };
        const lang = contentLanguage as keyof LocalizedString;
        name[lang] = nameInput.trim();
        // Ensure ja and en always exist
        if (!name.ja) name.ja = '';
        if (!name.en) name.en = '';
        return name;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(buildName(), startTime ?? undefined, endTime ?? undefined);
        onClose();
    };

    const handleBackdropClick = () => {
        if (nameInput.trim()) {
            onSave(buildName(), startTime ?? undefined, endTime ?? undefined);
        }
        onClose();
    };

    const titleKey = isEdit
        ? (mode === 'phase' ? 'boundary_modal.edit_phase' : 'boundary_modal.edit_label')
        : (mode === 'phase' ? 'boundary_modal.add_phase' : 'boundary_modal.add_label');

    // 測位前(clampedPos 未確定)は中央でペイント前に補正(ちらつきなし)。framer は transform/opacity を
    // アニメするだけで left/top は遷移しないため、EventModal のような「滑り」は出ない。
    const centerStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as const;
    const style: React.CSSProperties = isMobile
        ? { bottom: 0, left: 0, right: 0, width: '100%', transform: 'none' }
        : (!position
            ? centerStyle
            : (clampedPos ? { left: clampedPos.left, top: clampedPos.top } : centerStyle));

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] text-left pointer-events-none flex flex-col justify-end">
                    <div
                        className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}`}
                        {...backdropClose(handleBackdropClick, { autoGuard: false })}
                    />
                    <motion.div
                        ref={modalRef}
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.1 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute overflow-hidden float-surface pointer-events-auto flex flex-col ${isMobile ? 'w-full rounded-t-[20px] rounded-b-none glass-border-b-0' : 'w-[400px] rounded-xl'}`}
                        style={style}
                    >
                        {isMobile && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mt-3 shrink-0" />}

                        <ModalHeader title={t(titleKey)} onClose={onClose} closeLabel={t('common.close')} />

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_label')}</label>
                                <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder={t('boundary_modal.name_placeholder')} autoFocus />
                            </div>

                            {isEdit && (
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.start_time')}</label>
                                    <div className="flex gap-2">
                                        <TimeInput value={startTime} onChange={setStartTime}
                                            className={`${INPUT_CLASS} flex-1`}
                                            placeholder="M:SS" />
                                        {onTimelineSelectStart && (
                                            <ModalButton variant="secondary" onClick={() => { onTimelineSelectStart(); }}>
                                                <Crosshair size={14} />
                                                <span>{t('boundary_modal.select_on_timeline')}</span>
                                            </ModalButton>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isEdit && (
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.end_time')}</label>
                                    <div className="flex gap-2">
                                        <TimeInput value={endTime} onChange={setEndTime}
                                            className={`${INPUT_CLASS} flex-1`}
                                            placeholder="M:SS" />
                                        {onTimelineSelectEnd && (
                                            <ModalButton variant="secondary" onClick={() => { onTimelineSelectEnd(); }}>
                                                <Crosshair size={14} />
                                                <span>{t('boundary_modal.select_on_timeline')}</span>
                                            </ModalButton>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                {isEdit && onDelete ? (
                                    <ModalButton variant="danger" onClick={() => { onDelete(); onClose(); }}>
                                        <Trash2 size={14} />
                                        <span>{t('modal.delete')}</span>
                                    </ModalButton>
                                ) : <div />}
                                <div className="flex gap-2">
                                    <ModalButton variant="secondary" onClick={onClose}>
                                        {t('modal.cancel')}
                                    </ModalButton>
                                    <ModalButton variant="primary" type="submit">
                                        {t('modal.save')}
                                    </ModalButton>
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
