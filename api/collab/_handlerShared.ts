// 共同編集③ 受付係(Vercel)の共有グルー。load.ts / save.ts が使う。
// firebase-admin 初期化(既存 api/cron/cleanup-og-images の initAdmin パターン踏襲)と
// タイミング安全なシークレット比較を1か所に集約(DRY)。
// 先頭 `_` のため Vercel はこのファイルを関数ルートにしない。
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';
import { COLLAB_SECRET_HEADER, isCollabAuthorized } from './_logic';

/** firebase-admin を一度だけ初期化して Firestore を返す。 */
export function getDb(): Firestore {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch { /* 生 PEM はそのまま */ } }
    pk = pk.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: pk,
      }),
    });
  }
  return getFirestore();
}

/** タイミング安全な文字列比較。長さ不一致は即 false(timingSafeEqual は同長を要求)。 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * リクエストの x-collab-secret ヘッダを環境変数 COLLAB_SHARED_SECRET と
 * タイミング安全に照合する。未設定シークレットは常に拒否(誤設定の素通り防止)。
 */
export function authorizeCollab(headerValue: string | undefined): boolean {
  const req = new Request('https://collab.internal', {
    headers: { [COLLAB_SECRET_HEADER]: headerValue ?? '' },
  });
  return isCollabAuthorized(req, process.env.COLLAB_SHARED_SECRET ?? '', safeEqual);
}
