/**
 * POST /api/housing?action=create-personal-tag
 *
 * 個人タグ (ハウジンガー名タグ) の作成。 計画書 Phase B-2。
 * Body: { displayName }
 *  - 認証: Bearer (Firebase idToken) 必須
 *  - 1 ユーザー 1 個 (PERSONAL_TAG_LIMIT_PER_USER) をサーバー側 transaction で強制
 *  - 既に持っている場合は 409 already_exists (tag を含めて返す)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { validatePersonalTagDisplayName } from '../../src/utils/housingValidation.js';
import { buildPersonalTagId, canCreatePersonalTag, normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';
import { PERSONAL_TAG_LIMIT_PER_USER } from '../../src/constants/housing.js';
import type { PersonalTag } from '../../src/types/housing.js';

const COLLECTION = 'personal_tags';

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
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { displayName } = req.body || {};
    const validation = validatePersonalTagDisplayName(displayName);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_display_name', errors: validation.errors });
    }
    const trimmed = String(displayName).trim();

    const adminDb = getAdminFirestore();
    const col = adminDb.collection(COLLECTION);

    let created: PersonalTag | null = null;
    let alreadyExists: PersonalTag | null = null;

    await adminDb.runTransaction(async (tx) => {
      const existingSnap = await tx.get(
        col.where('ownerUid', '==', uid).limit(PERSONAL_TAG_LIMIT_PER_USER),
      );
      if (!canCreatePersonalTag(existingSnap.size, PERSONAL_TAG_LIMIT_PER_USER)) {
        alreadyExists = (existingSnap.docs[0]?.data() as PersonalTag | undefined) ?? null;
        if (!alreadyExists) throw new Error('limit_reached');
        return;
      }

      const now = Date.now();
      const id = buildPersonalTagId(trimmed);
      const tag: PersonalTag = {
        id,
        displayName: trimmed,
        displayNameLower: normalizeDisplayNameForSearch(trimmed),
        ownerUid: uid,
        createdAt: now,
        reportCount: 0,
        isHidden: false,
      };
      tx.set(col.doc(id), tag);
      created = tag;
    });

    if (alreadyExists) {
      return res.status(409).json({ error: 'already_exists', tag: alreadyExists });
    }
    return res.status(201).json({ tag: created });
  } catch (error: any) {
    if (error?.message === 'limit_reached') {
      return res.status(409).json({ error: 'limit_reached' });
    }
    console.error('[housing/create-personal-tag] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
