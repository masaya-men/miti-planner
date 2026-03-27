import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, AlertCircle } from 'lucide-react';
import { parseCSVToEvents } from '../utils/csvParser';
import { useMitigationStore } from '../store/useMitigationStore';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [csvText, setCsvText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleImport = () => {
        try {
            setError(null);
            const events = parseCSVToEvents(csvText);

            if (events.length === 0) {
                setError('No valid events found in the CSV text.');
                return;
            }

            // For now, we simply add all imported events. In the future we might want options to replace or merge.
            const addEvent = useMitigationStore.getState().addEvent;
            events.forEach(addEvent);

            setCsvText('');
            onClose();
        } catch (e) {
            setError('Failed to parse CSV. Please check the format.');
        }
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
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-lg bg-[#0f1115] border border-app-border shadow-sm rounded-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
                        <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
                            <Download size={18} className="text-app-text" />
                            Import Timeline (CSV)
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-app-text hover:bg-app-surface2 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 overflow-y-auto">
                        <div className="mb-4">
                            <p className="text-sm text-app-text mb-2 leading-relaxed">
                                Paste CSV text to import timeline events. The expected format is:
                                <br />
                                <code className="bg-black/50 px-2 py-1 rounded mt-1 block w-fit border border-app-border text-cyan-300">
                                    Time, Name, DamageAmount, DamageType, Target
                                </code>
                            </p>
                            <p className="text-xs text-app-text mb-2">
                                Example: <span className="font-mono text-app-text">0:15, Raidwide, 120000, magical, PT</span><br />
                                Note: Only Time and Name are strictly required.
                            </p>
                        </div>

                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            className="w-full h-48 bg-app-surface2 border border-app-border rounded-xl p-3 text-sm font-mono text-app-text focus:outline-none focus:border-app-text resize-none placeholder:text-app-text-muted"
                            placeholder="0:00, Start&#10;0:15, First AOE, 100000, magical, PT"
                            spellCheck={false}
                        />

                        {error && (
                            <div className="mt-3 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-app-text hover:text-app-text hover:bg-app-surface2 transition-colors"
                        >
                            {t('common.cancel', 'キャンセル')}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!csvText.trim()}
                            className={clsx(
                                "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300",
                                csvText.trim()
                                    ? "bg-app-text text-app-bg hover:opacity-80 uppercase"
                                    : "bg-app-surface2 text-app-text-muted cursor-not-allowed uppercase"
                            )}
                        >
                            <Download size={16} />
                            {t('common.ok', 'OK')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
