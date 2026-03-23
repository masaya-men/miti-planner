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

type AuthProvider = 'google' | 'discord' | 'twitter';

/** リダイレクト前に現在のURLを保存（Discord/Twitter用） */
function saveReturnUrl() {
    localStorage.setItem('lopo_auth_return_url', window.location.href);
}

/** ログイン成功時のユーザー情報（オーバーレイ表示用） */
interface JustLoggedInUser {
    displayName: string | null;
    photoURL: string | null;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    justLoggedInUser: JustLoggedInUser | null;
    signInWith: (provider: AuthProvider) => void;
    signOut: () => Promise<void>;
    clearJustLoggedIn: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    justLoggedInUser: null,

    signInWith: (provider: AuthProvider) => {
        switch (provider) {
            case 'google': {
                const googleProvider = new GoogleAuthProvider();
                signInWithPopup(auth, googleProvider)
                    .then((result) => {
                        set({
                            justLoggedInUser: {
                                displayName: result.user.displayName,
                                photoURL: result.user.photoURL,
                            }
                        });
                    })
                    .catch((err) => {
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

    clearJustLoggedIn: () => set({ justLoggedInUser: null }),
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
        // オーバーレイ表示用にフラグを立てる
        useAuthStore.setState({
            justLoggedInUser: {
                displayName: pending.displayName || cred.user.displayName,
                photoURL: pending.photoURL || cred.user.photoURL,
            }
        });
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
