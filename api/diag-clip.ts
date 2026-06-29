/**
 * 【診断用・一時エンドポイント】スマホ実機のスプレッドシート貼り付け本文(text/plain=TSV)を
 * 1件だけ Firestore に保存し、GET で読み返す。スマホで長大なシートを取り込めない原因を
 * 調べるため、実データ(パーサ入力そのもの)を採取する目的。
 *
 * POST /api/diag-clip   body: { plain: string }  → diag_clip/latest を上書き保存
 * GET  /api/diag-clip                            → 最新の { plain, at, len } を返す
 *
 * 認証なし・公開シート前提の短命な診断。原因特定後はルートごと撤去する。
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const MAX_LEN = 300_000; // 約300KB 上限(乱用防止・TSV は通常数十KB)

function initAdmin() {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch { /* 生 PEM */ } }
    pk = pk.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: pk,
      }),
    });
  }
}

export default async function handler(req: any, res: any) {
  initAdmin();
  const db = getFirestore();
  const ref = db.collection('diag_clip').doc('latest');

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
    const plain = typeof body?.plain === 'string' ? body.plain.slice(0, MAX_LEN) : '';
    if (!plain) return res.status(400).json({ ok: false, error: 'plain がありません' });
    await ref.set({ plain, len: plain.length, at: Date.now() });
    return res.status(200).json({ ok: true, len: plain.length });
  }

  if (req.method === 'GET') {
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'まだ保存がありません' });
    return res.status(200).json({ ok: true, ...snap.data() });
  }

  return res.status(405).json({ ok: false, error: 'POST か GET のみ' });
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}
