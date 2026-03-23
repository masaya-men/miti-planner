/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 * 対応プロバイダー: Google, Discord, Twitter(X)
 *
 * Google: signInWithPopup（標準的なポップアップで問題が少ない）
 * Discord/Twitter: ページ遷移（リダイレクト）方式（ポップアップブロック回避）
 */
import { create } from 'zustand';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCustomToken,
    updateProfile,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { showToast } from '../components/Toast';
import i18n from '../i18n';

type AuthProvider = 'google' | 'discord' | 'twitter';

/** リダイレクト前に現在のURLを保存（Discord/Twitter用） */
function saveReturnUrl() {
    localStorage.setItem('lopo_auth_return_url', window.location.href);
}

interface AuthState {
    user: User | null;
    loading: boolean;
    signInWith: (provider: AuthProvider) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    signInWith: (provider: AuthProvider) => {
        switch (provider) {
            case 'google': {
                const googleProvider = new GoogleAuthProvider();
                signInWithPopup(auth, googleProvider)
                    .then(() => {
                        showToast(i18n.t('login.success_toast'));
                    })
                    .catch((err) => {
                        // ユーザーがポップアップを閉じた場合は無視
                        if (err.code !== 'auth/popup-closed-by-user') {
                            console.error('Google login error:', err);
                        }
                    });
                break;
            }
            case 'discord':
                saveReturnUrl();
                window.location.href = '/api/auth/discord';
                break;
            case 'twitter':
                saveReturnUrl();
                window.location.href = '/api/auth/twitter';
                break;
        }
    },

    signOut: async () => {
        await firebaseSignOut(auth);
        set({ user: null });
    },
}));

/**
 * アプリ起動時: Discord/Twitter のリダイレクト結果をlocalStorageからチェック
 */
async function processPendingAuth() {
    const pendingRaw = localStorage.getItem('lopo_auth_pending');
    if (!pendingRaw) return;

    localStorage.removeItem('lopo_auth_pending');
    try {
        const pending = JSON.parse(pendingRaw);
        const cred = await signInWithCustomToken(auth, pending.token);
        if (cred.user && (pending.displayName || pending.photoURL)) {
            await updateProfile(cred.user, {
                displayName: pending.displayName || cred.user.displayName,
                photoURL: pending.photoURL || cred.user.photoURL,
            });
        }
        showToast(i18n.t('login.success_toast'));
    } catch (err) {
        console.error('Auth restore error:', err);
    }
}

// Auth状態の監視（アプリ起動時に1回だけ実行）
onAuthStateChanged(auth, (user) => {
    useAuthStore.setState({ user, loading: false });
});

// リダイレクト認証の結果を処理
processPendingAuth();
