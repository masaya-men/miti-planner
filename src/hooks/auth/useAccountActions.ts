import { useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadAvatar as uploadAvatarUtil, deleteAvatar as deleteAvatarUtil } from '../../utils/avatarUpload';
import { syncHousingerProfileBestEffort } from '../../lib/housing/housingerProfileService';

/**
 * Account 設定操作 (アバター / displayName / ログアウト / 退会) を一箇所にまとめる hook。
 *
 * LoPo `LoginModal` と Housing `HousingAccountModal` の両方から使う。
 * UI は各モーダルで独自実装、 データ操作のみ共通化。
 */
export function useAccountActions() {
    const user = useAuthStore(s => s.user);
    const storeSignOut = useAuthStore(s => s.signOut);
    const storeDeleteAccount = useAuthStore(s => s.deleteAccount);
    const storeUpdateDisplayName = useAuthStore(s => s.updateDisplayName);

    const uploadAvatar = useCallback(async (blob: Blob): Promise<string> => {
        if (!user) throw new Error('not_signed_in');
        const url = await uploadAvatarUtil(user.uid, blob);
        useAuthStore.setState({ profileAvatarUrl: url });
        // ハウジンガー公開プロフィール (housing_profiles) にアイコンを転記する。
        // 未公開ユーザーではサーバーが isPublished:false のまま転記するだけで無害 (冪等)。
        syncHousingerProfileBestEffort();
        return url;
    }, [user]);

    const removeAvatar = useCallback(async (): Promise<void> => {
        if (!user) throw new Error('not_signed_in');
        await deleteAvatarUtil(user.uid);
        useAuthStore.setState({ profileAvatarUrl: null });
        syncHousingerProfileBestEffort();
    }, [user]);

    const updateDisplayName = useCallback(async (newName: string): Promise<void> => {
        await storeUpdateDisplayName(newName);
        syncHousingerProfileBestEffort();
    }, [storeUpdateDisplayName]);

    const signOut = useCallback(async (): Promise<void> => {
        await storeSignOut();
    }, [storeSignOut]);

    const deleteAccount = useCallback(async (): Promise<void> => {
        await storeDeleteAccount();
    }, [storeDeleteAccount]);

    return { uploadAvatar, removeAvatar, updateDisplayName, signOut, deleteAccount };
}
