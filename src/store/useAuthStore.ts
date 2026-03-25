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
    deleteUser,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../types/firebase';
import { usePlanStore } from './usePlanStore';
import { useMitigationStore } from './useMitigationStore';

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
    deleteAccount: () => Promise<void>;
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
                googleProvider.setCustomParameters({ prompt: 'select_account' });
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
                localStorage.setItem('lopo_auth_redirecting', 'true');
                window.location.href = '/api/auth/discord';
                break;
            case 'twitter':
                saveReturnUrl();
                localStorage.setItem('lopo_auth_redirecting', 'true');
                window.location.href = '/api/auth/twitter';
                break;
        }
    },

    signOut: async () => {
        const currentUser = auth.currentUser;
        // ① ログアウト前にFirestoreに未同期の変更を全て反映
        if (currentUser) {
            try {
                const planState = usePlanStore.getState();
                // 現在の表データをプランに保存（最新状態をFirestoreに送るため）
                if (planState.currentPlanId) {
                    planState.updatePlan(planState.currentPlanId, {
                        data: useMitigationStore.getState().getSnapshot(),
                    });
                    planState.markDirty(planState.currentPlanId);
                }
                // 全プランをFirestoreに強制同期（_isSyncingバイパス）
                await planState.forceSyncAll(
                    currentUser.uid,
                    currentUser.displayName || 'Guest',
                );
            } catch (err) {
                console.error('ログアウト前の同期エラー:', err);
            }
        }

        // ② Firebase Auth ログアウト
        await firebaseSignOut(auth);
        set({ user: null });

        // ③ localStorageとZustandストアをクリア
        localStorage.removeItem('plan-storage');
        localStorage.removeItem('mitigation-storage');
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        useMitigationStore.getState().resetForTutorial();
    },

    deleteAccount: async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const uid = currentUser.uid;

        // ① Firestoreからユーザーデータを全削除（バッチ）
        try {
            const batch = writeBatch(db);

            // plans（ownerId === uid のもの全て）
            const plansQ = query(
                collection(db, COLLECTIONS.PLANS),
                where('ownerId', '==', uid),
            );
            const plansSnap = await getDocs(plansQ);
            plansSnap.docs.forEach((d) => batch.delete(d.ref));

            // sharedPlanMeta（ownerId === uid）
            const sharedQ = query(
                collection(db, COLLECTIONS.SHARED_PLAN_META),
                where('ownerId', '==', uid),
            );
            const sharedSnap = await getDocs(sharedQ);
            sharedSnap.docs.forEach((d) => batch.delete(d.ref));

            // userPlanCounts/{uid}
            batch.delete(doc(db, COLLECTIONS.USER_PLAN_COUNTS, uid));

            // users/{uid}
            batch.delete(doc(db, COLLECTIONS.USERS, uid));

            await batch.commit();
        } catch (err) {
            console.error('Firestoreデータ削除エラー:', err);
        }

        // ② Firebase Authアカウント削除
        try {
            await deleteUser(currentUser);
        } catch (err) {
            // セッション切れ等で再認証が必要な場合はログアウトにフォールバック
            console.error('アカウント削除エラー（ログアウトにフォールバック）:', err);
            await firebaseSignOut(auth);
        }

        // ③ ローカルストレージとストアをクリア
        set({ user: null });
        localStorage.removeItem('plan-storage');
        localStorage.removeItem('mitigation-storage');
        usePlanStore.setState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        useMitigationStore.getState().resetForTutorial();
    },

    clearJustLoggedIn: () => set({ justLoggedInUser: null }),
}));

/**
 * アプリ起動時: Discord/Twitter のリダイレクト結果をlocalStorageからチェック
 */
async function processPendingAuth() {
    const pendingRaw = localStorage.getItem('lopo_auth_pending');
    if (!pendingRaw) {
        // リダイレクトフラグがあるが認証データがない → タイムアウトまたは失敗
        localStorage.removeItem('lopo_auth_redirecting');
        return;
    }

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
        // リダイレクトフラグ削除 + オーバーレイ表示用にフラグを立てる
        localStorage.removeItem('lopo_auth_redirecting');
        useAuthStore.setState({
            justLoggedInUser: {
                displayName: pending.displayName || cred.user.displayName,
                photoURL: pending.photoURL || cred.user.photoURL,
            }
        });
    } catch (err) {
        console.error('Auth restore error:', err);
        localStorage.removeItem('lopo_auth_redirecting');
    }
}

// Auth状態の監視（アプリ起動時に1回だけ実行）
onAuthStateChanged(auth, (user) => {
    useAuthStore.setState({ user, loading: false });
});

// リダイレクト認証の結果を処理
processPendingAuth();
