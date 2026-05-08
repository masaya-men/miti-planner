import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Download, X } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface LocalImportDialogProps {
    isOpen: boolean;
    /** 取り込み対象のローカルプラン件数 */
    count: number;
    /** true のとき「次回から自動で表示しない」チェックを非表示 (LoginModal 明示ボタン経由用) */
    ignoreDontShow: boolean;
    onConfirm: (opts: { dontShow: boolean }) => void;
    onCancel: (opts: { dontShow: boolean }) => void;
}

export const LocalImportDialog: React.FC<LocalImportDialogProps> = ({
    isOpen, count, ignoreDontShow, onConfirm, onCancel,
}) => {
    const { t } = useTranslation();
    const [dontShow, setDontShow] = useState(false);
    const handleCancel = () => onCancel({ dontShow: ignoreDontShow ? false : dontShow });
    useEscapeClose(isOpen, handleCancel);

    if (!isOpen) return null;

    const effectiveDontShow = ignoreDontShow ? false : dontShow;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
                onClick={handleCancel}
            />
            <div
                className={clsx(
                    "relative w-[400px] max-w-[90vw] rounded-2xl glass-tier3",
                    "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                )}
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                    <div className="p-2 rounded-xl bg-app-toggle/10">
                        <Download size={18} className="text-app-toggle" />
                    </div>
                    <h3 className="text-app-2xl font-black text-app-text tracking-wide">
                        {t('local_import.title')}
                    </h3>
                    <button
                        onClick={handleCancel}
                        aria-label={t('common.close')}
                        className="ml-auto p-1 rounded-lg text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-3">
                    <p className="text-app-lg text-app-text-sec leading-relaxed font-medium">
                        {t('local_import.body', { count })}
                    </p>
                    {!ignoreDontShow && (
                        <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={dontShow}
                                onChange={e => setDontShow(e.target.checked)}
                                className="w-4 h-4 cursor-pointer accent-app-toggle"
                            />
                            <span className="text-app-md text-app-text-muted">
                                {t('local_import.dont_show_again')}
                            </span>
                        </label>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-app-border">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 rounded-xl text-app-md font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                    >
                        {t('local_import.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm({ dontShow: effectiveDontShow })}
                        className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                    >
                        {t('local_import.confirm')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
