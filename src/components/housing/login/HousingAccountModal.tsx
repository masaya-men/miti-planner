import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, LogOut, Settings, Camera } from 'lucide-react';
import { HousingPanelModal } from '../HousingPanelModal';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useAccountActions } from '../../../hooks/auth/useAccountActions';
import { ConfirmDialog } from '../../ConfirmDialog';
import { DisplayNameEditor } from '../../DisplayNameEditor';
import { AvatarCropModal } from '../../AvatarCropModal';
import { showToast } from '../../Toast';

/**
 * ハウジング画面のログイン済みユーザー向けアカウント設定モーダル。
 *
 * 5 機能:
 * - アバター編集 (AvatarCropModal 流用)
 * - 表示名編集 (DisplayNameEditor 流用)
 * - 管理画面リンク (admin のみ表示)
 * - ログアウト
 * - 退会 (ConfirmDialog 流用で確認ダイアログ)
 *
 * UI は housing トンマナで独立実装。 ロジックは useAccountActions 経由で LoPo と共通化。
 * サブコンポーネント (ConfirmDialog / DisplayNameEditor / AvatarCropModal) は
 * LoPo 版を流用 (ハウジング版は将来必要なら追加)。
 */
export const HousingAccountModal: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const open = useHousingModalStore(s => s.account.open);
    const closeAccount = useHousingModalStore(s => s.closeAccount);
    const isAdmin = useAuthStore(s => s.isAdmin);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
    const actions = useAccountActions();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [isSavingName, setIsSavingName] = useState(false);
    const [showAvatarCrop, setShowAvatarCrop] = useState(false);
    const [isAvatarBusy, setIsAvatarBusy] = useState(false);

    const handleSaveName = async (newName: string) => {
        setIsSavingName(true);
        try {
            await actions.updateDisplayName(newName);
            setEditingName(false);
            showToast(t('profile.toast_name_updated'));
        } catch (err) {
            console.error('Display name update error:', err);
            showToast(t('profile.toast_name_error'), 'error');
        } finally {
            setIsSavingName(false);
        }
    };

    const handleAvatarComplete = async (blob: Blob) => {
        setIsAvatarBusy(true);
        setShowAvatarCrop(false);
        try {
            await actions.uploadAvatar(blob);
            showToast(t('avatar.toast_uploaded'));
        } catch (err) {
            console.error('Avatar upload error:', err);
            showToast(t('avatar.toast_upload_error'), 'error');
        } finally {
            setIsAvatarBusy(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await actions.deleteAccount();
            closeAccount();
            navigate('/');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleSignOut = async () => {
        await actions.signOut();
        closeAccount();
    };

    const handleAdminLink = () => {
        navigate('/admin');
        closeAccount();
    };

    if (!open) return null;

    return (
        <>
            <HousingPanelModal
                open={open}
                onClose={closeAccount}
                title={t('housing.account.title')}
                closeLabel={t('housing.account.closeLabel')}
                maxWidth={480}
                maxHeightRatio={0.86}
            >
                <div className="housing-account-profile">
                    <button
                        type="button"
                        className="housing-account-avatar"
                        onClick={() => setShowAvatarCrop(true)}
                        disabled={isAvatarBusy}
                        aria-label={t('housing.account.avatarChange')}
                    >
                        {profileAvatarUrl ? (
                            <img src={profileAvatarUrl} alt="" />
                        ) : (
                            <Camera size={24} />
                        )}
                    </button>
                    <div className="housing-account-info">
                        {editingName ? (
                            <DisplayNameEditor
                                value={profileDisplayName || ''}
                                onSave={handleSaveName}
                                onCancel={() => setEditingName(false)}
                                isSaving={isSavingName}
                            />
                        ) : (
                            <div className="housing-account-name-row">
                                <strong>{profileDisplayName || 'User'}</strong>
                                <button
                                    type="button"
                                    onClick={() => setEditingName(true)}
                                    aria-label={t('housing.account.displayNameEdit')}
                                    className="housing-account-name-edit-btn"
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {isAdmin && (
                    <button
                        type="button"
                        className="housing-account-button"
                        onClick={handleAdminLink}
                    >
                        <Settings size={14} />
                        {t('housing.account.adminLink')}
                    </button>
                )}

                <button
                    type="button"
                    className="housing-account-button housing-account-button-danger"
                    onClick={handleSignOut}
                >
                    <LogOut size={14} />
                    {t('housing.account.signOut')}
                </button>

                <button
                    type="button"
                    className="housing-account-delete-link"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    {t('housing.account.deleteAccount')}
                </button>
            </HousingPanelModal>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={t('housing.account.deleteConfirmTitle')}
                message={isDeleting ? '...' : t('housing.account.deleteConfirmBody')}
                confirmLabel={t('housing.account.deleteConfirmYes')}
                variant="danger"
            />

            <AvatarCropModal
                isOpen={showAvatarCrop}
                onClose={() => setShowAvatarCrop(false)}
                onComplete={handleAvatarComplete}
            />
        </>
    );
};
