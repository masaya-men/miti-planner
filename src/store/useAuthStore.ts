/**
 * 認証状態管理ストア
 * Firebase Authのログイン状態をZustandで管理
 * 対応プロバイダー: Discord
 *
 * Discord: ページ遷移（リダイレクト）方式（ポップアップブロック回避）
 * Twitter(X) ログインは 2026-05-17 に廃止 (X API 仕様変更による pay-per-use 化のため)
 */
import { create } from 'zustand';
import {
    signInWithCustomToken,
    signOut as firebaseSignOut,
    deleteUser,
    onAuthStateChanged,
    type User
} from 'firebase/auth';
import { auth, db, ensureAppCheck } from '../lib/firebase';
import { doc, collection, getDocs, getDoc, query, where, writeBatch, setDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../types/firebase';
import { usePlanStore } from './usePlanStore';
import { useMitigationStore } from './useMitigationStore';
import { ensureUserDocument } from '../utils/userDocHelper';
import { deleteTeamLogo } from '../utils/logoUpload';
import { deleteAvatar } from '../utils/avatarUpload';
import { apiFetch } from '../lib/apiClient';
import { isAdminSandbox } from '../dev/sandboxMode';

type AuthProvider = 'discord';

/** 戻り URL に register=open を付ける必要があるかを判定して URL を組み立てる純粋関数 (testable) */
export function buildReturnUrl(href: string, withRegisterFlag: boolean): string {
    if (!withRegisterFlag) return href;
    const url = new URL(href);
    url.searchParams.set('register', 'open');
    return url.toString();
}

/** リダイレクト前に現在のURLを保存（Discord用） */
function saveReturnUrl(withRegisterFlag = false) {
    const url = buildReturnUrl(window.location.href, withRegisterFlag);
    localStorage.setItem('lopo_auth_return_url', url);
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
    profileDisplayName: string | null;  // Firestoreの表示名
    profileAvatarUrl: string | null;    // Firestoreのアバター
    isNewUser: boolean;                 // 初回ログイン判定（Firestoreにドキュメントなし）
    signInWith: (provider: AuthProvider, opts?: { withRegisterFlag?: boolean }) => void;
    updateDisplayName: (newName: string) => Promise<void>;
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
    profileDisplayName: null,
    profileAvatarUrl: null,
    isNewUser: false,

    signInWith: (provider: AuthProvider, opts?: { withRegisterFlag?: boolean }) => {
        switch (provider) {
            case 'discord':
                saveReturnUrl(opts?.withRegisterFlag ?? false);
                localStorage.setItem('lopo_auth_redirecting', 'true');
                // 2026-07-14 (P2): ログイン POST 自体が App Check 必須 (_discordHandler)。
                // この時点で未ログインなので、能動的なログイン試行として App Check を初期化する
                // (閲覧だけの匿名は通らない = コスト源を再導入しない)。apiFetch が peek で拾う。
                ensureAppCheck();
                apiFetch('/api/auth?provider=discord', { method: 'POST' })
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
        }
    },

    updateDisplayName: async (newName: string) => {
        const trimmed = newName.trim();
        if (trimmed.length < 1) throw new Error('name_too_short');
        if (trimmed.length > 30) throw new Error('name_too_long');

        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('not_signed_in');

        // Firestoreのドキュメントが欠損（または古い）場合、安全に初期化・補完する
        await ensureUserDocument(currentUser);
        // 新規作成された可能性があるので、isNewUserフラグを下ろしておく
        set({ isNewUser: false });

        const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        await setDoc(userRef, {
            displayName: trimmed,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        set({ profileDisplayName: trimmed });
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
                const profileName = useAuthStore.getState().profileDisplayName || 'User';
                await planState.forceSyncAll(
                    currentUser.uid,
                    profileName,
                );
            } catch (err) {
                console.error('ログアウト前の同期エラー:', err);
            }
        }

        // ② Firebase Auth ログアウト
        await firebaseSignOut(auth);
        set({
            user: null,
            isAdmin: false,
            teamLogoUrl: null,
            profileDisplayName: null,
            profileAvatarUrl: null,
            isNewUser: false,
        });

        // ③ Zustand ストアの整理 (B-1 Revision 3: `ownerId='local'` プランは残す)
        // 「ローカルにあるプラン」はユーザーの私物 → ログアウトしても消さない
        // 「アカウントに紐づくプラン (ownerId=uid)」は logout でローカル state から外す → 再ログインで Firestore から復元
        const localPlans = usePlanStore.getState().plans.filter(p => p.ownerId === 'local');
        const prevCurrentId = usePlanStore.getState().currentPlanId;
        const newCurrentId = prevCurrentId && localPlans.some(p => p.id === prevCurrentId) ? prevCurrentId : null;
        usePlanStore.setState({
            plans: localPlans,
            currentPlanId: newCurrentId,
            lastActivePlanId: newCurrentId,
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        // currentPlan が消えた場合のみ MitigationStore をリセット
        if (newCurrentId === null) {
            localStorage.removeItem('mitigation-storage');
            useMitigationStore.getState().resetForTutorial();
        }
    },

    deleteAccount: async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const uid = currentUser.uid;

        // ① Firebase Storageのチームロゴ・アバターを削除
        try {
            await deleteTeamLogo(uid);
        } catch {
            // ロゴが存在しない場合は無視
        }
        try {
            await deleteAvatar(uid);
        } catch {
            // アバターが存在しない場合は無視
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
        set({
            user: null,
            isAdmin: false,
            teamLogoUrl: null,
            profileDisplayName: null,
            profileAvatarUrl: null,
            isNewUser: false,
        });
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
        await signInWithCustomToken(auth, pending.token);
        // ログイン成功 → LoginModal自動クローズ用フラグをセット
        useAuthStore.setState({ justLoggedInUser: { displayName: null, photoURL: null } });
        // リダイレクトフラグ削除
        localStorage.removeItem('lopo_auth_redirecting');
    } catch (err) {
        console.error('Auth restore error:', err);
        localStorage.removeItem('lopo_auth_redirecting');
    }
}

// サンドボックスでは本物の認証を一切起動しない（偽管理者が bootstrap で注入される）。
// 先頭の import.meta.env.DEV は本番でこの条件を常に true 側へ静的解決させ通常起動を保証する。
if (!(import.meta.env.DEV && isAdminSandbox())) {
    // Auth状態の監視（アプリ起動時に1回だけ実行）
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 2026-07-14 (P2): ログイン確定 (セッション復元含む) で App Check を初期化保証。
            // これ以降の書き込み (直 Firestore / API) にトークンが載る。
            ensureAppCheck();

            // Custom Claimsから管理者フラグを取得（認証に必須 → awaitで待つ）
            const tokenResult = await user.getIdTokenResult();
            const isAdmin = tokenResult.claims.role === 'admin';

            // 認証完了 → loading: false を先に設定（画面表示をブロックしない）
            useAuthStore.setState({ user, loading: false, isAdmin });

            // Firestoreからプロフィール読み込み（バックグラウンド）
            try {
                const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    useAuthStore.setState({
                        profileDisplayName: data.displayName || null,
                        profileAvatarUrl: data.avatarUrl || null,
                        teamLogoUrl: data.teamLogoUrl || null,
                        isNewUser: false,
                    });
                } else {
                    useAuthStore.setState({ isNewUser: true });
                }
            } catch {
                // Firestore読み込み失敗は無視
            }
        } else {
            useAuthStore.setState({
                user: null,
                loading: false,
                isAdmin: false,
                profileDisplayName: null,
                profileAvatarUrl: null,
                teamLogoUrl: null,
                isNewUser: false,
            });
        }
    });

    // リダイレクト認証の結果を処理
    processPendingAuth();
}
