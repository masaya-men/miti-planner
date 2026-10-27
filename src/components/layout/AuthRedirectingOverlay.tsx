import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

/** リダイレクト認証中オーバーレイ — Discord/Twitter からの戻り時、 processPendingAuth
 *  完了前に表示。 実際にログイン処理中の場面のみ出る。 */
export const AuthRedirectingOverlay: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg">
            <div className="flex flex-col items-center gap-4">
                <Loader2 size={28} className="animate-spin text-app-text-muted" />
                <p className="text-app-2xl font-medium text-app-text-muted">{t('login.authenticating')}</p>
            </div>
        </div>
    );
};
