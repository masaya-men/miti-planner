import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { LogOut } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';

// ── モバイル用アカウントメニュー（ログイン済み時） ──
export const MobileAccountMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
    const signOut = useAuthStore((s) => s.signOut);
    const deleteAccount = useAuthStore((s) => s.deleteAccount);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        onClose();
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteAccount();
            onClose();
            navigate('/');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col gap-4">
            {/* ユーザー情報 */}
            <div className="flex items-center gap-3 px-1">
                {profileAvatarUrl ? (
                    <img
                        src={profileAvatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-app-border"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-app-surface2 border border-app-border flex items-center justify-center">
                        <span className="text-app-2xl font-bold text-app-text">
                            {(profileDisplayName || '?')[0]}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-app-2xl font-bold text-app-text truncate">
                        {profileDisplayName || t('nav.account')}
                    </p>
                </div>
            </div>

            {/* ログアウトボタン */}
            <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-app-border text-app-2xl font-bold text-app-text bg-app-surface2 active:bg-app-text/10 transition-colors cursor-pointer"
            >
                <LogOut size={16} />
                {t('nav.logout')}
            </button>

            {/* アカウント削除（控えめ配置） */}
            <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-app-base text-app-text-muted/50 hover:text-app-text-muted transition-colors cursor-pointer py-1"
            >
                {t('nav.deleteAccount')}
            </button>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
                title={t('nav.deleteAccountTitle')}
                message={isDeleting ? '...' : t('nav.deleteAccountMessage')}
                confirmLabel={t('nav.deleteAccountConfirm')}
                variant="danger"
            />
        </div>
    );
};
