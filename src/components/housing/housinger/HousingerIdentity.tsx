/**
 * ハウジンガーページのアイコン+名前の行。
 * 本人閲覧時のみ、カメラでアイコン変更 (切り抜き窓)・鉛筆で名前をその場編集できる。
 * 保存は HousingAccountModal.tsx と同じロジック (useAccountActions 経由)。成功後は useAuthStore が
 * 更新され、親が渡す displayName/avatarUrl が自動で最新表示に切り替わる。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Camera } from 'lucide-react';
import { useAccountActions } from '../../../hooks/auth/useAccountActions';
import { DisplayNameEditor } from '../../DisplayNameEditor';
import { HousingAvatarCropModal } from '../mypage/HousingAvatarCropModal';
import { HousingerAvatar } from './HousingerAvatar';
import { showToast } from '../../Toast';

interface Props {
  isSelf: boolean;
  displayName: string;
  avatarUrl: string | null;
}

export const HousingerIdentity: React.FC<Props> = ({ isSelf, displayName, avatarUrl }) => {
  const { t } = useTranslation();
  const accountActions = useAccountActions();
  const [editingName, setEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);

  const handleSaveName = async (newName: string) => {
    setIsSavingName(true);
    try {
      await accountActions.updateDisplayName(newName);
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
      await accountActions.uploadAvatar(blob);
      showToast(t('avatar.toast_uploaded'));
    } catch (err) {
      console.error('Avatar upload error:', err);
      showToast(t('avatar.toast_upload_error'), 'error');
    } finally {
      setIsAvatarBusy(false);
    }
  };

  return (
    <div className="housinger-page-identity">
      {isSelf ? (
        <div className="housinger-page-avatar-wrap">
          <HousingerAvatar
            avatarUrl={avatarUrl}
            name={displayName}
            className="housinger-page-avatar"
          />
          <button
            type="button"
            className="housinger-page-avatar-edit-btn"
            onClick={() => setShowAvatarCrop(true)}
            disabled={isAvatarBusy}
            aria-label={t('housing.account.avatarChange')}
            title={t('housing.account.avatarChange')}
          >
            <Camera size={13} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <HousingerAvatar
          avatarUrl={avatarUrl}
          name={displayName}
          className="housinger-page-avatar"
        />
      )}
      {/* 本人閲覧時のみ: 鉛筆アイコンで名前をその場編集 (旧: /housing/mypage への
          ナビゲーションだったが、マイページ自体でも押せる導線だったため意味を持たなかった)。 */}
      {isSelf && editingName ? (
        <div className="housinger-page-name-editor">
          <DisplayNameEditor
            value={displayName || ''}
            onSave={handleSaveName}
            onCancel={() => setEditingName(false)}
            isSaving={isSavingName}
          />
        </div>
      ) : (
        <>
          <h2 className="housinger-page-name">{displayName}</h2>
          {isSelf && (
            <button
              type="button"
              className="housinger-page-edit-btn"
              aria-label={t('housing.housinger.editProfile')}
              title={t('housing.housinger.editProfile')}
              onClick={() => setEditingName(true)}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
        </>
      )}
      {isSelf && (
        <HousingAvatarCropModal
          isOpen={showAvatarCrop}
          onClose={() => setShowAvatarCrop(false)}
          onComplete={handleAvatarComplete}
        />
      )}
    </div>
  );
};
