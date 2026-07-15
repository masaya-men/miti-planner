/**
 * Firebase初期化モジュール
 * Auth, Firestore, Analyticsのインスタンスをエクスポート
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: "AIzaSyDI7aT8XS1fWWK9Z-lgnyxOcR_7KVkG6F0",
    authDomain: "auth.lopoly.app",
    projectId: "lopo-7793e",
    storageBucket: "lopo-7793e.firebasestorage.app",
    messagingSenderId: "1005853596423",
    appId: "1:1005853596423:web:3bf8585834c0c2c44903a2",
    measurementId: "G-HCQPS9N74D"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestoreオフライン永続化（読み取り回数50%削減）
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// Analytics（SSR/テスト環境では無効化）
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

// Storage（アイコン管理用）
export const storage = getStorage(app);

// App Check（アプリの正当性検証）— 2026-07-14 (P2): 遅延初期化。
// import 副作用では初期化しない(匿名の閲覧で reCAPTCHA を発火させない)。
// ensureAppCheck() = ログイン試行/確定・書き込み直前で初期化。getActiveAppCheck() = peek。
import { createLazyAppCheck } from './appCheck';
export const { ensureAppCheck, getActiveAppCheck } = createLazyAppCheck(app);
