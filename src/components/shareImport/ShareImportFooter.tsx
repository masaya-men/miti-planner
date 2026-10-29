import { useTranslation } from 'react-i18next';
import type { useShareImportFlow } from '../../store/useShareImportFlow';
import { ModalButton } from '../ui/ModalParts';

type FlowState = ReturnType<typeof useShareImportFlow.getState>;

interface ShareImportFooterProps {
    isBundle: boolean;
    selectedCount: number;
    status: FlowState['status'];
    close: FlowState['close'];
    handleImport: () => void;
}

export function ShareImportFooter({ isBundle, selectedCount, status, close, handleImport }: ShareImportFooterProps) {
    const { t } = useTranslation();
    // Footer (キャンセルボタン追加)
    return (
        <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
            {isBundle ? (
                <span className="text-app-sm text-app-text-muted">
                    {t('limit_resolution.selection_count', { count: selectedCount })}
                </span>
            ) : (
                <span />
            )}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={close}
                    disabled={status !== 'preview'}
                    aria-label={t('share_import.button_cancel')}
                    className="px-4 py-2 rounded-md text-app-text border border-app-border hover:bg-app-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {t('share_import.button_cancel')}
                </button>
                <ModalButton
                    variant="primary"
                    disabled={selectedCount === 0 || status !== 'preview'}
                    onClick={handleImport}
                    aria-label={
                        isBundle
                            ? t('share_import.button_import_count', { count: selectedCount })
                            : t('share_import.button_import_single')
                    }
                >
                    {isBundle
                        ? t('share_import.button_import_count', { count: selectedCount })
                        : t('share_import.button_import_single')}
                </ModalButton>
            </div>
        </div>
    );
}
