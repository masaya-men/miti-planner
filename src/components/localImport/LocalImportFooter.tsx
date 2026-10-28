import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ModalFooter, ModalButton } from '../ui/ModalParts';

interface LocalImportFooterProps {
    phase: 'idle' | 'uploading' | 'done';
    summaryKind: 'success' | 'partial' | 'failed' | null;
    snapshotPlansLength: number;
    retryLabel: string;
    handleClose: () => void;
    handleStartImport: () => void;
    handleRetryFailed: () => void;
}

export const LocalImportFooter: React.FC<LocalImportFooterProps> = ({
    phase, summaryKind, snapshotPlansLength, retryLabel, handleClose, handleStartImport, handleRetryFailed,
}) => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + snapshotPlansLength * 0.08 + 0.2, duration: 0.3 }}
            className="shrink-0"
        >
            <ModalFooter>
                {phase === 'idle' && (
                    <>
                        <ModalButton variant="secondary" onClick={handleClose}>
                            {t('local_import.cancel')}
                        </ModalButton>
                        <ModalButton variant="primary" onClick={handleStartImport}>
                            {t('local_import.confirm')}
                        </ModalButton>
                    </>
                )}
                {phase === 'uploading' && (
                    <span className="text-app-md text-app-text-muted">
                        {t('local_import.uploading_in_progress')}
                    </span>
                )}
                {phase === 'done' && summaryKind === 'success' && (
                    <ModalButton variant="primary" onClick={handleClose}>
                        {t('local_import.close')}
                    </ModalButton>
                )}
                {phase === 'done' && (summaryKind === 'partial' || summaryKind === 'failed') && (
                    <>
                        <ModalButton variant="secondary" onClick={handleClose}>
                            {t('local_import.close')}
                        </ModalButton>
                        <ModalButton variant="primary" onClick={handleRetryFailed}>
                            {retryLabel}
                        </ModalButton>
                    </>
                )}
            </ModalFooter>
        </motion.div>
    );
};
