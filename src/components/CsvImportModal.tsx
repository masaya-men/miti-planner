import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, AlertCircle } from 'lucide-react';
import { parseCSVToEvents } from '../utils/csvParser';
import { useMitigationStore } from '../store/useMitigationStore';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, INPUT_CLASS } from './ui/ModalParts';

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
                setError(t('csv_import.no_events'));
                return;
            }

            // For now, we simply add all imported events. In the future we might want options to replace or merge.
            const addEvent = useMitigationStore.getState().addEvent;
            events.forEach(addEvent);

            setCsvText('');
            onClose();
        } catch (e) {
            setError(t('csv_import.parse_error'));
        }
    };

    return (
        <ModalShell isOpen={isOpen} onClose={onClose} className="w-full max-w-lg">
            <ModalHeader
                icon={<Download size={18} className="text-app-text" />}
                title={t('csv_import.title')}
                onClose={onClose}
                closeLabel={t('common.close')}
            />

            {/* Content */}
            <div className="p-5 flex-1 overflow-y-auto">
                <div className="mb-4">
                    <p className="text-app-2xl text-app-text mb-2 leading-relaxed">
                        {t('csv_import.description')}
                        <br />
                        <code className="bg-app-surface2 px-2 py-1 rounded mt-1 block w-fit border border-app-border text-app-text">
                            {t('csv_import.format')}
                        </code>
                    </p>
                    <p className="text-app-lg text-app-text mb-2">
                        {t('csv_import.example')}<br />
                        {t('csv_import.note')}
                    </p>
                </div>

                <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className={`${INPUT_CLASS} h-48 font-mono resize-none`}
                    placeholder="0:00, Start&#10;0:15, First AOE, 100000, magical, PT"
                    spellCheck={false}
                />

                {error && (
                    <div className="mt-3 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-app-2xl">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <ModalFooter>
                <ModalButton variant="secondary" onClick={onClose}>
                    {t('common.cancel')}
                </ModalButton>
                <ModalButton variant="primary" onClick={handleImport} disabled={!csvText.trim()}>
                    <Download size={16} />
                    {t('csv_import.import_button')}
                </ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
