import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Link, Loader2 } from 'lucide-react';
import { INPUT_CLASS } from '../ui/ModalParts';
import type { ImportStatus } from './importStatus';

interface FFLogsUrlInputProps {
    url: string;
    handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    status: ImportStatus;
    urlError: string | null;
}

export const FFLogsUrlInput: React.FC<FFLogsUrlInputProps> = ({ url, handleUrlChange, isLoading, status, urlError }) => {
    const { t } = useTranslation();
    return (
        <>
            <p className="text-app-2xl text-app-text-muted mb-1 leading-relaxed">
                {t('fflogs.description')}
            </p>
            <p className="text-app-lg text-app-text-muted mb-4 font-mono">
                {t('fflogs.url_format')}
            </p>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link size={16} className="text-app-text-muted" />
                </div>
                <input
                    type="text"
                    value={url}
                    onChange={handleUrlChange}
                    disabled={isLoading || status.phase === 'preview'}
                    className={`${INPUT_CLASS} !pl-10 font-mono`}
                    placeholder={t('fflogs.placeholder')}
                    spellCheck={false}
                />
            </div>

            {urlError && (
                <div className="mt-3 flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{urlError}</p>
                </div>
            )}


            {status.phase === 'loading' && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-app-text/5 border border-app-border text-app-text text-app-2xl">
                    <Loader2 size={16} className="shrink-0 animate-spin" />
                    <span>{status.message}</span>
                </div>
            )}

            {status.phase === 'error' && (
                <div className="mt-4 flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="whitespace-pre-wrap">{status.message}</p>
                </div>
            )}
        </>
    );
};
