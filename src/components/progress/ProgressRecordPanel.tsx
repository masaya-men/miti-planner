// 到達点記録パネル — PC: ヘッダー下のポップオーバー / スマホ: MobileBottomSheet
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useProgressRecording } from './useProgressRecording';
import { MobileBottomSheet } from '../MobileBottomSheet';

/** モバイル判定 — 既存コードと同パターン (window.innerWidth < 768) */
function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return isMobile;
}

// -------------------- PC ポップオーバー --------------------

const PCPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const { startRecordMode, recordMode } = useProgressRecording();
    const popoverRef = useRef<HTMLDivElement>(null);

    // クリック外閉じ
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Escape 閉じ
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                'fixed z-[9999] w-[260px] glass-tier3 rounded-lg shadow-sm',
                'animate-in fade-in zoom-in-95 duration-200 overflow-hidden'
            )}
            // ヘッダー直下（ヘッダー高さ = 約48px）の右寄せに配置
            style={{ top: '52px', right: '16px' }}
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-app-lg font-black text-app-text uppercase tracking-wider">
                    {t('progress.record_title')}
                </span>
                <button
                    onClick={onClose}
                    className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                >
                    <X size={14} />
                </button>
            </div>

            {/* 本文 */}
            <div className="px-3 py-4 flex flex-col gap-3">
                <button
                    onClick={startRecordMode}
                    className="w-full px-3 py-2 rounded-lg text-app-lg font-bold text-app-text border border-glass-border hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer"
                >
                    {t('progress.record_cta')}
                </button>
                {recordMode && (
                    <p className="text-app-2xs text-app-text-muted text-center">
                        {t('progress.record_hint')}
                    </p>
                )}
            </div>
        </div>,
        document.body
    );
};

// -------------------- メインコンポーネント --------------------

/**
 * 到達点記録パネル。props なし — useProgressRecording store 駆動。
 * panelOpen が false のとき何もレンダリングしない。
 * <ProgressRecordPanel /> のマウントは C2 (ProgressTrackingHUD) が行う。
 */
export const ProgressRecordPanel: React.FC = () => {
    const { panelOpen, closePanel, startRecordMode, recordMode } = useProgressRecording();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    if (!panelOpen) return null;

    if (isMobile) {
        return (
            <MobileBottomSheet
                isOpen={panelOpen}
                onClose={closePanel}
                title={t('progress.record_title')}
            >
                <div className="flex flex-col gap-3 py-2">
                    <button
                        onClick={startRecordMode}
                        className="w-full px-3 py-2.5 rounded-lg text-app-lg font-bold text-app-text border border-glass-border hover:bg-glass-hover active:scale-95 transition-all duration-200 cursor-pointer"
                    >
                        {t('progress.record_cta')}
                    </button>
                    {recordMode && (
                        <p className="text-app-2xs text-app-text-muted text-center">
                            {t('progress.record_hint')}
                        </p>
                    )}
                </div>
            </MobileBottomSheet>
        );
    }

    return <PCPopover onClose={closePanel} />;
};
