// 共同編集⑤-2a: オーナーが共同編集ルーム(roomToken)を発行/失効/再発行/上限設定する受付係。
// 認証はオーナー本人(Firebase ID Token・既存 apiFetch が付与)。plans/{planId}.ownerId と
// 照合し、本人だけが collabRooms/{roomToken} を操作できる。冪等性は plan.activeCollabRoomToken
// で逆引き(token → plan の単純 get のみ。複合インデックス不要)。緊急停止中は発行を拒否。
// load/save(③/⑤-1)とは認証経路が違う(あちらは DO↔Vercel の共有シークレット)。
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';
import { parseRoomManageRequest } from './_roomManageLogic.js';
import { clampMaxParticipants, isCollabDisabled } from './_roomLogic.js';

/** plans/{planId} のうちこのハンドラが必要とするフィールドだけの型。 */
interface PlanOwnerDoc {
  ownerId?: string;
  deleted?: boolean;
  activeCollabRoomToken?: string;
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

/** 推測不能な room トークン(≒144bit)。bearer URL の鍵になるため share の 8 文字より長く。 */
function newRoomToken(): string {
  return nanoid(24);
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  // 緊急停止中はルーム発行/変更を全拒否(既存部屋は load/save 側で止血される)。
  if (isCollabDisabled(process.env)) return res.status(503).json({ error: 'collab_disabled' });

  // オーナー認証(本人の ID Token)。
  initAdmin();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  const parsed = parseRoomManageRequest(req.body);
  // 'error' in parsed で失敗バリアントへ narrow する(`!parsed.ok` の boolean discriminant narrow は
  // @vercel/node の strictNullChecks-off ビルドでは効かないため。`in` 演算子の narrow は strict 非依存)。
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const reqData = parsed.req;
  const planId = reqData.planId;

  const db = getAdminFirestore();
  const planRef = db.collection('plans').doc(planId);

  // トークンはトランザクション外で先に確定(リトライ非依存・冪等)。
  const freshToken = newRoomToken();

  try {
    const result = await db.runTransaction(async (tx: Transaction) => {
      const planSnap = await tx.get(planRef);
      if (!planSnap.exists) throw new Error('not_found');
      const plan = planSnap.data() as PlanOwnerDoc;
      if (plan.deleted === true) throw new Error('not_found'); // 墓標はリーク防止で not_found
      if (plan.ownerId !== uid) throw new Error('forbidden');  // 本人以外は操作不可

      const current = plan.activeCollabRoomToken;

      if (reqData.action === 'revoke') {
        if (current) {
          tx.update(db.collection('collabRooms').doc(current), { revoked: true });
        }
        tx.update(planRef, { activeCollabRoomToken: FieldValue.delete() });
        return { revoked: true };
      }

      if (reqData.action === 'set-max') {
        if (!current) throw new Error('no_room'); // 発行前の上限変更は不可
        const clamped = clampMaxParticipants(reqData.maxParticipants);
        tx.update(db.collection('collabRooms').doc(current), { maxParticipants: clamped });
        return { roomToken: current, maxParticipants: clamped, revoked: false };
      }

      // create: 既存の有効ルームがあれば再利用(冪等)。reissue: 旧を失効し必ず新規発行。
      if (reqData.action === 'create' && current) {
        const curSnap = await tx.get(db.collection('collabRooms').doc(current));
        const cur = curSnap.exists ? (curSnap.data() as { revoked?: boolean; maxParticipants?: number }) : null;
        if (cur && cur.revoked !== true) {
          return { roomToken: current, maxParticipants: clampMaxParticipants(cur.maxParticipants), revoked: false };
        }
      }
      if (reqData.action === 'reissue' && current) {
        tx.update(db.collection('collabRooms').doc(current), { revoked: true });
      }

      // create は maxParticipants 任意(未指定は clamp が既定 8 にする)。reissue は持たない。
      const requestedMax = reqData.action === 'create' ? reqData.maxParticipants : undefined;
      const clamped = clampMaxParticipants(requestedMax);
      // ⑤-3c: label は create/reissue のときだけオーナーが任意で付ける(検証済・trim 済)。
      const label = (reqData.action === 'create' || reqData.action === 'reissue') ? reqData.label : undefined;
      const roomDoc: Record<string, unknown> = {
        roomToken: freshToken,
        planId,
        ownerId: uid,
        maxParticipants: clamped,
        revoked: false,
        createdAt: Date.now(),
      };
      if (label !== undefined) roomDoc.label = label;
      tx.set(db.collection('collabRooms').doc(freshToken), roomDoc);
      tx.update(planRef, { activeCollabRoomToken: freshToken });
      return { roomToken: freshToken, maxParticipants: clamped, revoked: false };
    });

    return res.status(200).json(result);
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'no_room') return res.status(409).json({ error: 'no_room' });
    console.error('[collab/room] error:', error);
    return res.status(500).json({ error: 'internal' });
  }
}
