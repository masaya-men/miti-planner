import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CloudDownload, AlertCircle, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface FFLogsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FFLogsImportModal: React.FC<FFLogsImportModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<{ reportId: string, fightId: string | null } | null>(null);

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setError(null);
        setParsedData(null);

        if (!newUrl.trim()) return;

        // Simple Regex to extract reportId and fightId
        const reportMatch = newUrl.match(/reports\/([a-zA-Z0-9]+)/);
        const fightMatch = newUrl.match(/[#?]fight=([^&]+)/);

        if (reportMatch && reportMatch[1]) {
            setParsedData({
                reportId: reportMatch[1],
                fightId: fightMatch ? fightMatch[1] : null
            });
        } else {
            setError('Invalid FFLogs URL. Expected format: https://fflogs.com/reports/...');
        }
    };

    const handleImport = () => {
        if (!parsedData) return;

        // Phase 2: This will be replaced with actual FFLogs API call
        console.log('[FFLogs Import] Parsed:', parsedData);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
                {/* Backdrop overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-lg bg-[#0f1115] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <CloudDownload size={18} className="text-purple-400" />
                            Import from FFLogs
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-white hover:bg-slate-900/ dark:hover:bg-white/ transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1">
                        <div className="mb-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                                Paste your FFLogs log URL to automatically generate a timeline.
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                                Example: <span className="font-mono text-slate-700 dark:text-slate-300">https://ja.fflogs.com/reports/a1b2C3d4E5f6G7H8#fight=12</span>
                            </p>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Link size={16} className="text-slate-500" />
                            </div>
                            <input
                                type="text"
                                value={url}
                                onChange={handleUrlChange}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 placeholder:text-slate-600"
                                placeholder="https://fflogs.com/reports/..."
                                spellCheck={false}
                            />
                        </div>

                        {error && (
                            <div className="mt-4 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        {parsedData && !error && (
                            <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Extracted Data</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-slate-500 block text-xs">Report ID</span>
                                        <span className="font-mono text-slate-300">{parsedData.reportId}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs">Fight ID</span>
                                        <span className="font-mono text-slate-300">{parsedData.fightId || 'Auto (Latest)'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-800 dark:text-white hover:bg-slate-900/ dark:hover:bg-white/ transition-colors"
                        >
                            {t('common.cancel', 'キャンセル')}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!parsedData || !!error}
                            className={clsx(
                                "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300",
                                parsedData && !error
                                    ? "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] uppercase"
                                    : "bg-slate-900/ dark:bg-white/ text-slate-500 cursor-not-allowed uppercase"
                            )}
                        >
                            <CloudDownload size={16} />
                            Parse
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
