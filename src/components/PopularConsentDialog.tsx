import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface Props {
    isOpen: boolean;
    onCancel: () => void;
    onAccept: () => void;
}

export const PopularConsentDialog: React.FC<Props> = ({ isOpen, onCancel, onAccept }) => {
    useEscapeClose(isOpen, onCancel);
    const { t } = useTranslation();

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
            onClick={onCancel}
        >
            <div
                className="relative glass-tier3 rounded-2xl shadow-2xl w-[400px] max-w-[90vw] p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-app-2xl font-bold text-app-text mb-3">
                    {t('popular_consent.title')}
                </h3>
                <p className="text-app-lg text-app-text-muted leading-relaxed mb-3">
                    {t('popular_consent.body_1')}
                </p>
                <p className="text-app-lg text-app-text-muted leading-relaxed mb-5">
                    {t('popular_consent.body_2')}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-1.5 rounded-md border border-app-border text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                    >
                        {t('popular_consent.cancel')}
                    </button>
                    <button
                        onClick={onAccept}
                        className="px-4 py-1.5 rounded-md bg-app-blue text-white text-app-md font-bold hover:bg-app-blue-hover transition-all cursor-pointer active:scale-95"
                    >
                        {t('popular_consent.accept')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
