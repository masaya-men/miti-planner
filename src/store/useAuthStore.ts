/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 */
import { create } from 'zustand';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    signInWithGoogle: async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
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
