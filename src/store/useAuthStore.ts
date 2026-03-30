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
    signInWithRedirect,
    getRedirectResult,
    signInWithCustomToken,
    updateProfile,
    signOut as firebaseSignOut,
    deleteUser,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, collection, getDocs, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../types/firebase';
import { usePlanStore } from './usePlanStore';
import { useMitigationStore } from './useMitigationStore';
import { deleteTeamLogo } from '../utils/logoUpload';
import { apiFetch } from '../lib/apiClient';

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
    isAdmin: boolean;
    justLoggedInUser: JustLoggedInUser | null;
    teamLogoUrl: string | null;      // チームロゴの Firebase Storage ダウンロード URL
    signInWith: (provider: AuthProvider) => void;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    clearJustLoggedIn: () => void;
    setTeamLogoUrl: (url: string | null) => void;  // ロゴ URL を即時更新するセッター
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    isAdmin: false,
    justLoggedInUser: null,
    teamLogoUrl: null,

    signInWith: (provider: AuthProvider) => {
        switch (provider) {
            case 'google': {
                const googleProvider = new GoogleAuthProvider();
                googleProvider.setCustomParameters({ prompt: 'select_account' });

                // PWA（ホーム画面から起動）時はリダイレクト方式に切り替え
                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                if (isPWA) {
                    saveReturnUrl();
                    localStorage.setItem('lopo_auth_redirecting', 'true');
                    signInWithRedirect(auth, googleProvider);
                } else {
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
                }
                break;
            }
            case 'discord':
                saveReturnUrl();
                localStorage.setItem('lopo_auth_redirecting', 'true');
                apiFetch('/api/auth/discord', { method: 'POST' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.url) {
                            window.location.href = data.url;
                        } else {
                            console.error('Discord OAuth: URL not received');
                            localStorage.removeItem('lopo_auth_redirecting');
                        }
                    })
                    .catch(err => {
                        console.error('Discord login error:', err);
                        localStorage.removeItem('lopo_auth_redirecting');
                    });
                break;
            case 'twitter':
                saveReturnUrl();
                localStorage.setItem('lopo_auth_redirecting', 'true');
                apiFetch('/api/auth/twitter', { method: 'POST' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.url) {
                            window.location.href = data.url;
                        } else {
                            console.error('Twitter OAuth: URL not received');
                            localStorage.removeItem('lopo_auth_redirecting');
                        }
                    })
                    .catch(err => {
                        console.error('Twitter login error:', err);
                        localStorage.removeItem('lopo_auth_redirecting');
                    });
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
        set({ user: null, isAdmin: false, teamLogoUrl: null });

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

        // ① Firebase Storageのチームロゴを削除
        try {
            await deleteTeamLogo(uid);
        } catch {
            // ロゴが存在しない場合は無視
        }

        // ② Firestoreからユーザーデータを全削除（バッチ）
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

        // ③ Firebase Authアカウント削除
        try {
            await deleteUser(currentUser);
        } catch (err) {
            // セッション切れ等で再認証が必要な場合はログアウトにフォールバック
            console.error('アカウント削除エラー（ログアウトにフォールバック）:', err);
            await firebaseSignOut(auth);
        }

        // ④ ローカルストレージとストアをクリア
        set({ user: null, isAdmin: false, teamLogoUrl: null });
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

    setTeamLogoUrl: (url) => set({ teamLogoUrl: url }),
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
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Custom Claimsから管理者フラグを取得
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.role === 'admin';

        // FirestoreからチームロゴURLを読み込み（非ブロッキング）
        let teamLogoUrl: string | null = null;
        try {
            const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
            if (userDoc.exists()) {
                teamLogoUrl = userDoc.data().teamLogoUrl || null;
            }
        } catch {
            // ロゴ読み込み失敗は無視（ログインには影響させない）
        }

        useAuthStore.setState({ user, loading: false, isAdmin, teamLogoUrl });
    } else {
        useAuthStore.setState({ user: null, loading: false, isAdmin: false, teamLogoUrl: null });
    }
});

// リダイレクト認証の結果を処理
processPendingAuth();

// PWA Google リダイレクト結果を処理
getRedirectResult(auth).then((result) => {
    if (result?.user) {
        useAuthStore.setState({
            justLoggedInUser: {
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
            }
        });
    }
}).catch((err) => {
    console.error('Google redirect result error:', err);
});
