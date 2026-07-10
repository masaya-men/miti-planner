/**
 * GET /api/housing?action=search-personal-tags&q=...
 *
 * 個人タグの検索 (探すページのフィルタ用オートコンプリート)。 計画書 Phase B-3。
 * 認証不要 (公開検索)、 isHidden=false のみ返す。
 * displayNameLower への前方一致 (Firestore は大文字小文字非依存検索を native サポートしないため、
 * 作成時に正規化して保存した displayNameLower を使う)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';
import { PERSONAL_TAG_SEARCH_LIMIT } from '../../src/constants/housing.js';
import type { PersonalTag } from '../../src/types/housing.js';

const COLLECTION = 'personal_tags';
const MAX_QUERY_LENGTH = 40;

/**
 * 前方一致検索の定石 (Firestore に LIKE 演算子は無いため):
 * endAt に Unicode Private Use Area の最終コードポイント (U+F8FF) を付けた文字列を渡すと、
 * 「prefix で始まる文字列すべて」の範囲になる。 String.fromCharCode 経由で組み立て、
 * ソースに不可視文字を直書きしない。
 */
function buildPrefixRangeEnd(prefix: string): string {
  return prefix + String.fromCharCode(0xf8ff);
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    const q = req.query?.q;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({ tags: [] });
    }
    const normalized = normalizeDisplayNameForSearch(q).slice(0, MAX_QUERY_LENGTH);

    initAdmin();
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection(COLLECTION)
      .where('isHidden', '==', false)
      .orderBy('displayNameLower')
      .startAt(normalized)
      .endAt(buildPrefixRangeEnd(normalized))
      .limit(PERSONAL_TAG_SEARCH_LIMIT)
      .get();

    const tags = snap.docs.map((d) => d.data() as PersonalTag);
    return res.status(200).json({ tags });
  } catch (error: any) {
    console.error('[housing/search-personal-tags] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
