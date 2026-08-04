/**
 * GET /api/housing?action=search-housingers&q=...
 *
 * マイページ公開中のハウジンガー名を前方一致検索する (ヘッダー検索窓のサジェスト用)。
 * 旧 search-personal-tags (personal_tags コレクション) の置き換え
 * (2026-08-04 設計変更。 detail: docs/superpowers/specs/2026-08-04-housing-tag-search-by-owner-design.md)。
 * 認証不要 (公開検索)、 isPublished=true && isModerationHidden=false のみ返す。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';

const COLLECTION = 'housing_profiles';
const MAX_QUERY_LENGTH = 40;
const SEARCH_LIMIT = 20;

/**
 * 前方一致検索の定石 (Firestore に LIKE 演算子は無いため):
 * endAt に Unicode Private Use Area の最終コードポイント (U+F8FF) を付けた文字列を渡すと、
 * 「prefix で始まる文字列すべて」の範囲になる。
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

  // 公開検索 (認証不要)。 匿名の探すページから呼ばれるため App Check は課さない。 DoW は rate limit で担う。
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    const q = req.query?.q;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({ housingers: [] });
    }
    const normalized = normalizeDisplayNameForSearch(q).slice(0, MAX_QUERY_LENGTH);

    initAdmin();
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection(COLLECTION)
      .where('isPublished', '==', true)
      .where('isModerationHidden', '==', false)
      .orderBy('displayNameLower')
      .startAt(normalized)
      .endAt(buildPrefixRangeEnd(normalized))
      .limit(SEARCH_LIMIT)
      .get();

    const housingers = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    return res.status(200).json({ housingers });
  } catch (error: any) {
    console.error('[housing/search-housingers] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
