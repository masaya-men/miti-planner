/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 * 対応プロバイダー: Google, Discord, Twitter(X)
 *
 * 全プロバイダーでリダイレクト方式を採用（ポップアップブロック回避）
 */
import { create } from 'zustand';
import {
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
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

/** リダイレクト前に現在のURLを保存 */
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
        saveReturnUrl();
        switch (provider) {
            case 'google': {
                const googleProvider = new GoogleAuthProvider();
                signInWithRedirect(auth, googleProvider);
                break;
            }
            case 'discord':
                window.location.href = '/api/auth/discord';
                break;
            case 'twitter':
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
 * アプリ起動時の認証復元処理
 * 1. Discord/Twitter: localStorage の pending トークンをチェック
 * 2. Google: getRedirectResult でリダイレクト結果をチェック
 * 3. Firebase Auth の状態監視
 */
async function processPendingAuth() {
    // Discord / Twitter のリダイレクト結果を処理
    const pendingRaw = localStorage.getItem('lopo_auth_pending');
    if (pendingRaw) {
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
            // onAuthStateChanged が user を反映した後にトースト表示
            setTimeout(() => {
                showToast(i18n.t('login.success_toast'));
            }, 500);
        } catch (err) {
            console.error(`${pendingRaw} auth error:`, err);
        }
        return;
    }

    // Google のリダイレクト結果を処理
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            setTimeout(() => {
                showToast(i18n.t('login.success_toast'));
            }, 500);
        }
    } catch (err) {
        console.error('Google redirect result error:', err);
    }
}

// Auth状態の監視（アプリ起動時に1回だけ実行）
onAuthStateChanged(auth, (user) => {
    useAuthStore.setState({ user, loading: false });
});

// リダイレクト認証の結果を処理
processPendingAuth();
