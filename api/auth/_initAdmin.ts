/**
 * Firebase Admin SDK 初期化（Discord / Twitter 共用）
 * Vercel 環境変数の FIREBASE_PRIVATE_KEY は形式が不定なので、
 * 複数のパターンに対応する。
 */
import * as admin from 'firebase-admin';

/** Vercel 環境変数から private key を取得し、PEM 形式に正規化する */
function resolvePrivateKey(): string {
    let pk = process.env.FIREBASE_PRIVATE_KEY || '';

    // パターン1: JSON 文字列として格納されている（"..." で囲まれている）
    if (pk.startsWith('"')) {
        try {
            pk = JSON.parse(pk);
        } catch {
            // パース失敗なら次のパターンへ
        }
    }

    // パターン2: リテラル \n（2文字）→ 実際の改行に変換
    pk = pk.replace(/\\n/g, '\n');

    return pk;
}

export function initAdmin() {
    if (!admin.apps.length) {
        const pk = resolvePrivateKey();
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}
