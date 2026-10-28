import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LoadingDots } from './LoadingDots';

interface ShareImportLoadingOverlayProps {
    isLoadingPhase: boolean;
}

export function ShareImportLoadingOverlay({ isLoadingPhase }: ShareImportLoadingOverlayProps) {
    const { t } = useTranslation();
    return (
        <AnimatePresence>
            {isLoadingPhase && (
                <motion.div
                    key="loading-overlay"
                    className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-6 px-6 py-12 bg-app-surface/95 rounded-t-sheet-sm"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                >
                    <h2
                        id="share-import-title"
                        className="text-app-4xl font-black text-app-text tracking-wide text-center"
                    >
                        {t('share_import.loading')}
                    </h2>
                    <LoadingDots />
                    <p className="text-app-md text-app-text-muted text-center">
                        {t('share_import.loading_sub')}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
