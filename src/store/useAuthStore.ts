/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 * 対応プロバイダー: Google, Discord, Twitter(X)
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

/** OAuth 2.0 ポップアップフロー共通ヘルパー（Discord / Twitter 共用） */
function oauthPopupFlow(apiPath: string, messageType: string): Promise<void> {
    const width = 500, height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    const popup = window.open(
        apiPath,
        messageType,
        `width=${width},height=${height},left=${left},top=${top}`
    );

    return new Promise<void>((resolve, reject) => {
        const handler = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== messageType) return;
            window.removeEventListener('message', handler);
            try {
                const cred = await signInWithCustomToken(auth, event.data.token);
                // サーバーから渡されたプロフィール情報を Firebase ユーザーに反映
                if (cred.user && (event.data.displayName || event.data.photoURL)) {
                    await updateProfile(cred.user, {
                        displayName: event.data.displayName || cred.user.displayName,
                        photoURL: event.data.photoURL || cred.user.photoURL,
                    });
                }
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        window.addEventListener('message', handler);

        const check = setInterval(() => {
            if (popup?.closed) {
                clearInterval(check);
                window.removeEventListener('message', handler);
                resolve();
            }
        }, 500);
    });
}

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
        }
    },

    signInWithDiscord: async () => {
        try {
            await oauthPopupFlow('/api/auth/discord', 'discord-auth');
        } catch (err: any) {
            console.error('Discord login error:', err);
        }
    },

    signInWithTwitter: async () => {
        try {
            await oauthPopupFlow('/api/auth/twitter', 'twitter-auth');
        } catch (err: any) {
            console.error('Twitter login error:', err);
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
