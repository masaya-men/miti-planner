import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadTeamLogo, deleteTeamLogo, validateLogoFile } from '../../utils/logoUpload';
import { showToast } from '../toastBus';

interface UseTeamLogoArgs {
    showLogo: boolean;
    setShowLogo: (show: boolean) => void;
    updateShareLogo: (withLogo: boolean, logoUrlOverride?: string | null) => Promise<void>;
}

/** チームロゴのアップロード・削除・OGP への表示切替 */
export function useTeamLogo({ showLogo, setShowLogo, updateShareLogo }: UseTeamLogoArgs) {
    const { t } = useTranslation();
    // チームロゴ関連
    const { user, setTeamLogoUrl } = useAuthStore();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // ロゴ表示トグル変更時にOGP画像を再生成
    const handleToggleLogo = () => {
        const next = !showLogo;
        setShowLogo(next);
        // shareデータのロゴを更新（ON→ロゴ埋め込み、OFF→ロゴ削除）
        updateShareLogo(next);
    };

    // ロゴファイル処理（共通）
    const processLogoFile = async (file: File) => {
        if (!user) return;

        const error = validateLogoFile(file);
        if (error) {
            showToast(t(`team_logo.${error}`), 'error');
            return;
        }

        setUploading(true);
        try {
            const url = await uploadTeamLogo(user.uid, file, () => useAuthStore.getState().profileDisplayName);
            setTeamLogoUrl(url);
            showToast(t('team_logo.upload_success'));
            setShowLogo(true);
            // 既存shareデータのロゴを上書き更新
            // setTeamLogoUrl 直後の closure では teamLogoUrl がまだ null なので、
            // 引数で最新の url を直接渡す
            await updateShareLogo(true, url);
        } catch (err) {
            console.error('[LogoUpload] アップロードエラー詳細:', err);
            showToast(t('team_logo.error_upload_failed'), 'error');
        } finally {
            setUploading(false);
        }
    };

    // ファイル選択からのアップロード
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processLogoFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ロゴ削除処理
    const handleLogoDelete = async () => {
        if (!user) return;
        try {
            await deleteTeamLogo(user.uid, () => useAuthStore.getState().profileDisplayName);
            setTeamLogoUrl(null);
            setShowLogo(false);
            showToast(t('team_logo.remove_success'));
            // 既存shareデータからロゴを削除（closure 古い値回避のため null を明示渡し）
            await updateShareLogo(false, null);
        } catch {
            showToast(t('team_logo.error_remove_failed'), 'error');
        }
    };

    return { uploading, fileInputRef, handleToggleLogo, processLogoFile, handleLogoUpload, handleLogoDelete };
}
