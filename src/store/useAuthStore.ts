/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 * 対応プロバイダー: Google, Discord, Twitter(X)
 */
import { create } from 'zustand';
import {
    GoogleAuthProvider,
    TwitterAuthProvider,
    signInWithPopup,
    signInWithCustomToken,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

type AuthProvider = 'google' | 'discord' | 'twitter';

interface AuthState {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithDiscord: () => Promise<void>;
    signInWithTwitter: () => Promise<void>;
    signInWith: (provider: AuthProvider) => Promise<void>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    signInWithGoogle: async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            console.error('Google login error:', err);
            alert(`Googleログインエラー: ${err.code || err.message}`);
        }
    },

    signInWithDiscord: async () => {
        try {
            // Discord OAuth はVercel API経由でポップアップフロー
            const width = 500, height = 700;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;
            const popup = window.open(
                '/api/auth/discord',
                'discord-auth',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            // ポップアップからのpostMessageを待つ
            return new Promise<void>((resolve, reject) => {
                const handler = async (event: MessageEvent) => {
                    if (event.origin !== window.location.origin) return;
                    if (event.data?.type !== 'discord-auth') return;
                    window.removeEventListener('message', handler);
                    try {
                        await signInWithCustomToken(auth, event.data.token);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                window.addEventListener('message', handler);

                // ポップアップが閉じられた場合のタイムアウト
                const check = setInterval(() => {
                    if (popup?.closed) {
                        clearInterval(check);
                        window.removeEventListener('message', handler);
                        resolve();
                    }
                }, 500);
            });
        } catch (err: any) {
            console.error('Discord login error:', err);
            alert(`Discordログインエラー: ${err.code || err.message}`);
        }
    },

    signInWithTwitter: async () => {
        try {
            const provider = new TwitterAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            console.error('Twitter login error:', err);
            alert(`Twitterログインエラー: ${err.code || err.message}`);
        }
    },

    signInWith: async (provider: AuthProvider): Promise<void> => {
        const store = useAuthStore.getState();
        switch (provider) {
            case 'google': return store.signInWithGoogle();
            case 'discord': return store.signInWithDiscord();
            case 'twitter': return store.signInWithTwitter();
        }
    },

    signOut: async () => {
        await firebaseSignOut(auth);
        set({ user: null });
    },
}));

// Auth状態の監視（アプリ起動時に1回だけ実行）
onAuthStateChanged(auth, (user) => {
    useAuthStore.setState({ user, loading: false });
});
