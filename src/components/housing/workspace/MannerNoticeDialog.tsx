import { useTranslation } from 'react-i18next';

/**
 * ツアー開始前の「マナー注意」ダイアログ。
 * ユーザー方針(#4): 「次回から表示しない」は設けず、ツアー開始のたびに毎回確認する
 * (実プレイヤーの家を訪問する前の意識づけ・主催者の責任を明確化)。
 */
export interface MannerNoticeDialogProps {
    open: boolean;
    onCancel: () => void;
    onStart: () => void;
}

export const MannerNoticeDialog: React.FC<MannerNoticeDialogProps> = ({
    open,
    onCancel,
    onStart,
}) => {
    const { t } = useTranslation();

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('housing.workspace.manner.title')}
            className="housing-manner-backdrop"
            onClick={onCancel}
        >
            <div className="housing-manner-card" onClick={(e) => e.stopPropagation()}>
                <h2 className="housing-manner-title">
                    <span aria-hidden="true">🏠</span> {t('housing.workspace.manner.title')}
                </h2>
                <p className="housing-manner-body">{t('housing.workspace.manner.body')}</p>
                <div className="housing-manner-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="housing-manner-btn housing-manner-btn-cancel"
                    >
                        {t('housing.workspace.manner.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onStart}
                        className="housing-manner-btn housing-manner-btn-start"
                    >
                        {t('housing.workspace.manner.start')}
                    </button>
                </div>
            </div>
        </div>
    );
};
