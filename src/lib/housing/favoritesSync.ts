/**
 * ハウジングお気に入りのサーバー同期 (2026-07-17)。
 *
 * これまでお気に入りは useHousingFavoritesStore の zustand persist (localStorage) のみで
 * 端末間 (PC⇔スマホ) 同期しなかった。ログイン中は Firestore `users/{uid}/housing_favorites/main`
 * (1 ユーザー 1 ドキュメント) にも保存し、端末間で合流させる。
 *
 * 方針: 「初回は端末とサーバーを合体、以降はサーバー正」
 * - ログイン検知時に 1 回だけ: サーバー ids とローカル ids を union (サーバー順を先頭、
 *   ローカルにしかない id を末尾へ追加・dedupe) し、差分があれば書き戻す。
 * - ただし共有端末対策として「このローカル ids を最後に同期した uid」を localStorage に
 *   記録し、別 uid のローカル分が新しいアカウントへ union されるのを防ぐ
 *   (記録が別 uid のときはサーバー ids をそのまま採用してストアを置き換える)。
 * - 以降はサーバー doc を onSnapshot 購読し、リモート変更をストアへ反映する
 *   (自分の書き込みエコーは ids 配列一致 or hasPendingWrites で無視)。
 * - ストアの ids 変化を購読し、1.5 秒デバウンスでサーバーへ書き込む。
 * - 未ログイン時は何もしない (従来どおり localStorage のみ)。
 *
 * 呼び出し側 (HousingShell) が /housing 滞在中だけ start/stop する
 * (他画面でリスナー・書き込みのコストを払わない)。
 */
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';

/** ストアの変更をサーバーへ書き込むまでの待ち時間。連続した追加/解除をまとめる。 */
const WRITE_DEBOUNCE_MS = 1500;

/**
 * 「このローカル ids を最後に同期した uid」の localStorage キー。
 * 共有端末で前ユーザーのローカルお気に入りが別アカウントへ union されるのを防ぐための記録。
 * ログアウトでは消さない (次回ログイン時の判定に使う)。
 */
const SYNCED_UID_STORAGE_KEY = 'housing-favorites-synced-uid';

function readSyncedUid(): string | null {
    try {
        return localStorage.getItem(SYNCED_UID_STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeSyncedUid(uid: string) {
    try {
        localStorage.setItem(SYNCED_UID_STORAGE_KEY, uid);
    } catch {
        // localStorage が使えない環境では記録なし (次回も union 判定になるだけ)。
    }
}

function favoritesDocRef(uid: string) {
    return doc(db, 'users', uid, 'housing_favorites', 'main');
}

function readIds(data: Record<string, unknown> | undefined): string[] {
    return Array.isArray(data?.ids) ? (data.ids as string[]) : [];
}

function idsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

/**
 * サーバー ids を優先順位の先頭に、ローカルにしかない id を末尾へ追加した union を返す
 * (dedupe 込み)。初回ログイン合流専用の純関数 (テスト容易性のため切り出し)。
 */
export function mergeFavoriteIds(serverIds: string[], localIds: string[]): string[] {
    const merged = [...serverIds];
    const seen = new Set(serverIds);
    for (const id of localIds) {
        if (!seen.has(id)) {
            merged.push(id);
            seen.add(id);
        }
    }
    return merged;
}

/**
 * ハウジングお気に入りのサーバー同期を開始する。戻り値の関数を呼ぶと停止する
 * (リスナー解除・デバウンスタイマー解除・auth 購読解除)。
 *
 * HousingShell の useEffect で mount 時に start / unmount 時に stop する想定。
 */
export function startFavoritesSync(): () => void {
    let stopped = false;
    let remoteUnsub: Unsubscribe | null = null;
    let storeUnsub: (() => void) | null = null;
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    let currentUid: string | null = null;

    function clearWriteTimer() {
        if (writeTimer != null) {
            clearTimeout(writeTimer);
            writeTimer = null;
        }
    }

    function scheduleWrite(uid: string) {
        clearWriteTimer();
        writeTimer = setTimeout(() => {
            writeTimer = null;
            const ids = useHousingFavoritesStore.getState().ids;
            void setDoc(favoritesDocRef(uid), { ids, updatedAt: serverTimestamp() });
        }, WRITE_DEBOUNCE_MS);
    }

    function detach() {
        remoteUnsub?.();
        remoteUnsub = null;
        storeUnsub?.();
        storeUnsub = null;
        clearWriteTimer();
        currentUid = null;
    }

    async function attach(uid: string) {
        currentUid = uid;

        // ① 初回マージ (ログイン検知時に1回)。
        try {
            const ref = favoritesDocRef(uid);
            const snap = await getDoc(ref);
            // 待機中に stop されたか、別ユーザーへ切り替わっていたら何もしない。
            if (stopped || currentUid !== uid) return;

            const serverIds = readIds(snap.data());
            const localIds = useHousingFavoritesStore.getState().ids;

            // 共有端末対策: このローカル ids を最後に同期したのが別 uid なら union しない
            // (前ユーザーのローカル分を新アカウントへ持ち込まない)。記録が無い (未ログインで
            // 貯めたローカル) か現 uid と一致するときだけ従来どおり union する。
            const syncedUid = readSyncedUid();
            const carryLocal = syncedUid === null || syncedUid === uid;
            const merged = carryLocal ? mergeFavoriteIds(serverIds, localIds) : serverIds;

            if (!idsEqual(merged, localIds)) {
                useHousingFavoritesStore.getState().setAll(merged);
            }

            // doc が無ければローカル ids で新規作成 (空なら作らない)。
            // doc があってサーバーと異なるなら書き戻す。
            const needsWrite = snap.exists() ? !idsEqual(merged, serverIds) : merged.length > 0;
            if (needsWrite) {
                await setDoc(ref, { ids: merged, updatedAt: serverTimestamp() });
            }

            // マージ/採用が完了したので「このローカル ids は現 uid と同期済み」と記録する。
            writeSyncedUid(uid);
        } catch {
            // オフライン等での初回マージ失敗は無視 (以降の onSnapshot/書き込みで復帰)。
        }

        if (stopped || currentUid !== uid) return;

        // ② リモート変更の購読 (単一 doc)。
        remoteUnsub = onSnapshot(favoritesDocRef(uid), (snap) => {
            // 自分の書き込みが確定する前のローカルエコーは無視 (echo ループ防止)。
            if (snap.metadata.hasPendingWrites) return;
            const remoteIds = readIds(snap.data());
            const localIds = useHousingFavoritesStore.getState().ids;
            // 内容が一致するなら (= 自分の書き込みが反映されただけ) 何もしない。
            if (idsEqual(remoteIds, localIds)) return;
            useHousingFavoritesStore.getState().setAll(remoteIds);
        });

        // ③ ローカル変更 → デバウンス書き込み。
        // 初回マージの書き戻しは上で直接 setDoc 済みなので、ここで登録するのはマージ後の
        // 「以降のユーザー操作」だけにする (マージ直後の setAll を二重に書き込まないため)。
        storeUnsub = useHousingFavoritesStore.subscribe((state, prevState) => {
            if (idsEqual(state.ids, prevState.ids)) return;
            scheduleWrite(uid);
        });
    }

    const authUnsub = useAuthStore.subscribe((state, prevState) => {
        const uid = state.user?.uid ?? null;
        const prevUid = prevState.user?.uid ?? null;
        if (uid === prevUid) return;
        detach();
        if (uid) void attach(uid);
    });

    // 開始時点で既にログイン済みなら即座にアタッチする。
    const initialUid = useAuthStore.getState().user?.uid ?? null;
    if (initialUid) void attach(initialUid);

    return () => {
        stopped = true;
        authUnsub();
        detach();
    };
}
