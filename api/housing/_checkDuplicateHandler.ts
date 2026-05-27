/**
 * POST /api/housing?action=check-duplicate
 * Body: AddressInput (DC/サーバー/エリア/区/番地/サイズ + Apartment なら room)
 * Response: { duplicates: Array<{ id, ownerUid, createdAt, tags }> }
 *
 * 認証不要 (登録ボタン押下前のプレチェックなので)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { validateAddress, type AddressInput } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const addr = req.body as AddressInput;

    const validation = validateAddress(addr);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_address', errors: validation.errors });
    }

    const addressKey = buildAddressKey(addr);
    const adminDb = getAdminFirestore();
    // 2026-05-27 hotfix: soft-deleted (deletedAt 立ってる) listing が重複扱いされていたバグ修正。
    // Firestore の where('deletedAt', '==', null) はフィールド未定義 doc にマッチしないので、
    // 広めに取って handler 側で filter する (null / undefined / 0 全てを「生きてる」 扱い)。
    const snap = await adminDb
      .collection('housing_listings')
      .where('addressKey', '==', addressKey)
      .where('isHidden', '==', false)
      .limit(20)
      .get();

    const duplicates = snap.docs
      .filter((doc) => !doc.data().deletedAt)
      .slice(0, 5)
      .map((doc) => ({
        id: doc.id,
        ownerUid: doc.data().ownerUid,
        createdAt: doc.data().createdAt,
        tags: doc.data().tags ?? [],
      }));

    return res.status(200).json({ duplicates });
  } catch (error: any) {
    console.error('[housing/check-duplicate] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
