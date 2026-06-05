# リアルタイム共同編集 段取り⑤-2a (ルーム管理API + ワーカー結線) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** オーナーが共同編集リンク(roomToken)を発行/失効/再発行/上限設定できる `/api/collab/room` を新設し、ワーカー(DO)が受付係を planId ではなく **roomToken** で叩くよう結線する。これで「別IDの共有相手が同じ部屋に実際に繋がる」⑤の核心が動く(満員拒否=⑤-2bは別計画)。

**Architecture:** 受付係(Vercel)に新エンドポイント `api/collab/room.ts` を追加。既存の管理API認証パターン(`Authorization: Bearer` の Firebase ID Token を `getAuth().verifyIdToken` → uid 取得 → `plans/{planId}.ownerId === uid` を runTransaction 内で照合)を踏襲し、`collabRooms/{roomToken}` を発行/失効する。入力検証は firebase-admin 非依存の純関数 `_roomManageLogic.ts` に切り出して root vitest で決定的にテスト(③/⑤-1 と同方針)。ワーカー側は `collabPersistence.ts` の HTTP 引数を planId → roomToken に変える(load/save ハンドラは ⑤-1 で既に roomToken 解決対応済み・非破壊)。

**Tech Stack:** Vercel Node Functions + firebase-admin (auth/firestore) / nanoid / vitest(root, vmThreads) / vitest-pool-workers(ワーカー) / TypeScript(erasableSyntaxOnly・nodenext)

**設計書:** [../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md](../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md) (§4 リンクのライフサイクル / §6 データモデル / §8 クライアント差分 / §9 受付係の変更)
**前段:** [2026-06-05-realtime-collab-stage5-1-room-resolution.md](./2026-06-05-realtime-collab-stage5-1-room-resolution.md) (⑤-1 ルーム解決層)

---

## ⑤ 全体の分解 (この計画は ⑤-2a)

| 段 | 内容 | 状態 |
|---|---|---|
| ⑤-1 | ルーム解決層: collabRooms 解決 + load/save の roomToken 対応 + 緊急停止ゲート。 | ✅ 完了(main) |
| **⑤-2a** | **ルーム管理API(本計画)**: `/api/collab/room`(発行/失効/再発行/上限) + ワーカーが roomToken 送信。「実際に繋がる」土台。 | この計画 |
| ⑤-2b | 満員拒否(安全弁): `onBeforeConnect` で接続前に DO へ在室数を問い合わせ、上限超過は upgrade 拒否。 | 後続(別計画) |
| ⑤-3 | クライアントUI(オーナーパネル / ジョイナー一時ビュー / 注意モーダル+赤バナー / ログインゲート) + 実データ往復検証。 | 後続(別計画) |

---

## 確定済みの一次情報 (実装前提・調査済)

すべて本リポジトリのコードで確認済み。推測なし。

- **オーナー認証の既存パターン** = Firebase ID Token。クライアントの [src/lib/apiClient.ts:26-30](../../../src/lib/apiClient.ts#L26-L30) `apiFetch` が `auth.currentUser.getIdToken()` を `Authorization: Bearer <token>` で自動付与。サーバーは [api/housing/_updateListingHandler.ts:43-48](../../../api/housing/_updateListingHandler.ts#L43-L48) のように `getAuth().verifyIdToken(token)` → `decoded.uid`(= `hashed:...` 形式)を得る。
- **所有者照合の既存パターン** = [api/housing/_updateListingHandler.ts:86-90](../../../api/housing/_updateListingHandler.ts#L86-L90) `runTransaction` 内で `data.ownerUid !== uid` を比較し `throw new Error('forbidden')`。**plan のオーナーフィールドは `ownerId`**([planService.ts:46](../../../src/lib/planService.ts#L46) `ownerId: uid` / [:293](../../../src/lib/planService.ts#L293) `if (current.ownerId !== uid)`)。uid と ownerId は両方 hash 済みなので直接比較可。
- **admin 初期化** = [src/lib/adminAuth.ts:10-26](../../../src/lib/adminAuth.ts#L10-L26) `initAdmin()` + `getAdminFirestore()`。`getAuth()` は `firebase-admin/auth`。
- **App Check / rate limit** = [api/housing/_updateListingHandler.ts:38-39](../../../api/housing/_updateListingHandler.ts#L38-L39) `await verifyAppCheck(req, res)` / `await applyRateLimit(req, res, 20, 60_000)`(いずれも false なら処理打ち切り。`../../src/lib/appCheckVerify.js` / `../../src/lib/rateLimit.js`)。
- **トークン生成** = `nanoid`。api/ でも使用実績あり([api/share/index.ts:15,153](../../../api/share/index.ts#L15) `import { nanoid } from 'nanoid'` / `nanoid(8)`)。room トークンは推測耐性のため **長め(24文字 ≒ 144bit)**。
- **plan 型** = [src/types/firebase.ts:42-73](../../../src/types/firebase.ts#L42-L73) `FirestorePlan`(ownerId / deleted? / deletedAt?)。**COLLECTIONS 定数([:187](../../../src/types/firebase.ts#L187))に `COLLAB_ROOMS` は未定義** → 追加。
- **firestore.rules** = `plans/{planId}` は `isOwner(resource.data.ownerId)`([firestore.rules:54](../../../firestore.rules#L54))。**collabRooms ルールは未定義** → 追加(admin SDK は rules をバイパスするが、public repo の明示防御として `if false` を置く)。
- **⑤-1 の受付係** = [api/collab/load.ts](../../../api/collab/load.ts) は `?roomToken=` を受け `collabRooms/{roomToken}` を `resolveRoom` で解決済み(planId 直接経路も残存)。[api/collab/save.ts](../../../api/collab/save.ts) は body `{roomToken}` を解決。`_roomLogic.ts` の `resolveRoom`/`clampMaxParticipants`/`isCollabDisabled`/`CollabRoomDoc`/`DEFAULT_MAX_PARTICIPANTS`/`SYSTEM_MAX_PARTICIPANTS` を再利用できる。
- **ワーカーの現状** = [workers/collab/src/collabPersistence.ts:21,48](../../../workers/collab/src/collabPersistence.ts#L21) が `?planId=` と body `{planId, mitigations}` を送信。`server.ts` は `this.name`(= クライアント接続の部屋名)をそのまま渡すだけ([server.ts:44,60](../../../workers/collab/src/server.ts#L44))。**`collabPersistence.ts` を roomToken 送信に変えるのが「ワーカー結線」**。
- **api/ の相対 import は `.js` 拡張子必須**(Vercel Node ESM・memory `reference_vercel_api_esm_js_extension`)。`erasableSyntaxOnly` 有効 = enum / パラメータプロパティ禁止(type union・const array・interface は OK・memory `reference_erasable_syntax_test_mocks`)。push 前は `npm run build` + `vitest run` 必須(memory `feedback_vercel_tsc_strict`)。

### スコープ外 (この計画では触らない)

- **満員拒否**(⑤-2b)。`onBeforeConnect` での接続前判定が必要で技術的に独立。
- **クライアント `startCollabSession` の引数リネーム・API 呼び出しヘルパー・UI**(⑤-3)。`collabProvider.ts` は休眠(呼び出し元 UI なし)のため ⑤-2a では触らない([feedback_scope_discipline])。本番結線テストは ⑤-2a では Claude が node スクリプトで roomToken 接続して行う(クライアント UI 不要)。

## ファイル構成 (作成/変更)

- 作成: `api/collab/_roomManageLogic.ts` — 管理リクエストの入力検証の純ロジック(`parseRoomManageRequest`)。admin 非依存。
- 作成: `src/lib/__tests__/collabRoomManageLogic.test.ts` — 上記の root vitest テスト。
- 作成: `api/collab/room.ts` — `/api/collab/room` ハンドラ(ID Token 認証 + ownerId 照合 + collabRooms 発行/失効/再発行/上限)。admin を叩くため build で型担保。
- 変更: `src/types/firebase.ts` — `COLLECTIONS.COLLAB_ROOMS` 追加 + `FirestorePlan.activeCollabRoomToken?` 追加。
- 変更: `firestore.rules` — `collabRooms/{roomToken}` ルール追加。
- 変更: `workers/collab/src/collabPersistence.ts` — load `?roomToken=` / save body `{roomToken}` に変更(引数名 planId → roomToken)。
- 変更: `workers/collab/src/collabPersistence.test.ts` — 上記に追従。
- 変更: `workers/collab/src/server.ts` — `this.name` が roomToken である旨にコメント更新(ロジック不変)。

---

## Task 1: 管理リクエストの入力検証 純ロジック (`api/collab/_roomManageLogic.ts`)

DB も admin も使わない純関数を先に TDD で固める。room.ts ハンドラがこれを wrap する。トークン生成(nanoid)は非決定的なので純ロジックには入れず、ハンドラ側で行う。

**Files:**
- Create: `api/collab/_roomManageLogic.ts`
- Test: `src/lib/__tests__/collabRoomManageLogic.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/lib/__tests__/collabRoomManageLogic.test.ts
import { describe, it, expect } from 'vitest';
import { parseRoomManageRequest, ROOM_ACTIONS } from '../../../api/collab/_roomManageLogic';

describe('parseRoomManageRequest', () => {
  it('body が object でない → invalid_body', () => {
    expect(parseRoomManageRequest(null)).toEqual({ ok: false, error: 'invalid_body' });
    expect(parseRoomManageRequest('x')).toEqual({ ok: false, error: 'invalid_body' });
  });
  it('action 不正 → invalid_action', () => {
    expect(parseRoomManageRequest({ action: 'nope', planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_action' });
    expect(parseRoomManageRequest({ planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_action' });
  });
  it('planId 欠落/空 → invalid_planId', () => {
    expect(parseRoomManageRequest({ action: 'create' }))
      .toEqual({ ok: false, error: 'invalid_planId' });
    expect(parseRoomManageRequest({ action: 'create', planId: '' }))
      .toEqual({ ok: false, error: 'invalid_planId' });
  });
  it('create(maxParticipants 省略可) → ok', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'create', planId: 'p1' } });
  });
  it('create(maxParticipants 指定) → ok で素通し(clamp はハンドラ)', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', maxParticipants: 4 }))
      .toEqual({ ok: true, req: { action: 'create', planId: 'p1', maxParticipants: 4 } });
  });
  it('create で maxParticipants が数値でない → invalid_maxParticipants', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', maxParticipants: '4' }))
      .toEqual({ ok: false, error: 'invalid_maxParticipants' });
  });
  it('revoke / reissue は planId のみで ok', () => {
    expect(parseRoomManageRequest({ action: 'revoke', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'revoke', planId: 'p1' } });
    expect(parseRoomManageRequest({ action: 'reissue', planId: 'p1' }))
      .toEqual({ ok: true, req: { action: 'reissue', planId: 'p1' } });
  });
  it('set-max は maxParticipants 必須(数値)', () => {
    expect(parseRoomManageRequest({ action: 'set-max', planId: 'p1' }))
      .toEqual({ ok: false, error: 'invalid_maxParticipants' });
    expect(parseRoomManageRequest({ action: 'set-max', planId: 'p1', maxParticipants: 6 }))
      .toEqual({ ok: true, req: { action: 'set-max', planId: 'p1', maxParticipants: 6 } });
  });
  it('ROOM_ACTIONS は 4 アクション', () => {
    expect(ROOM_ACTIONS).toEqual(['create', 'revoke', 'reissue', 'set-max']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: FAIL — `Failed to resolve import "../../../api/collab/_roomManageLogic"`(モジュール未作成)

- [ ] **Step 3: 最小実装を書く**

```typescript
// api/collab/_roomManageLogic.ts
// 共同編集⑤-2a: /api/collab/room の入力検証 純ロジック。firebase-admin 非依存。
// トークン生成(nanoid)・Firestore 読み書き・所有者照合はハンドラ(room.ts)が行い、
// ここは「リクエスト body が正しい形か」だけを決定的に判定する(③/⑤-1 と同じ純関数分離方針)。

/** ルーム管理アクション。create=発行(冪等) / revoke=失効 / reissue=再発行 / set-max=上限変更。 */
export type RoomAction = 'create' | 'revoke' | 'reissue' | 'set-max';

/** 受理可能なアクション一覧(検証と一覧表示の単一の真実)。 */
export const ROOM_ACTIONS: RoomAction[] = ['create', 'revoke', 'reissue', 'set-max'];

export interface RoomManageRequest {
  action: RoomAction;
  planId: string;
  /** create では任意・set-max では必須。範囲の丸めは clampMaxParticipants(ハンドラ)で行う。 */
  maxParticipants?: number;
}

export type ParseResult =
  | { ok: true; req: RoomManageRequest }
  | { ok: false; error: 'invalid_body' | 'invalid_action' | 'invalid_planId' | 'invalid_maxParticipants' };

/** リクエスト body を RoomManageRequest に検証する。不正は理由付きで弾く。 */
export function parseRoomManageRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;

  const action = b.action;
  if (typeof action !== 'string' || !ROOM_ACTIONS.includes(action as RoomAction)) {
    return { ok: false, error: 'invalid_action' };
  }
  const planId = b.planId;
  if (typeof planId !== 'string' || planId.length === 0) {
    return { ok: false, error: 'invalid_planId' };
  }

  const req: RoomManageRequest = { action: action as RoomAction, planId };

  if (action === 'set-max') {
    // set-max は新しい上限が必須。
    if (typeof b.maxParticipants !== 'number') return { ok: false, error: 'invalid_maxParticipants' };
    req.maxParticipants = b.maxParticipants;
  } else if (action === 'create') {
    // create は省略可(省略時はハンドラが既定 8)。指定するなら数値であること。
    if (b.maxParticipants !== undefined) {
      if (typeof b.maxParticipants !== 'number') return { ok: false, error: 'invalid_maxParticipants' };
      req.maxParticipants = b.maxParticipants;
    }
  }
  // revoke / reissue は maxParticipants を取らない(あっても無視)。

  return { ok: true, req };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: PASS(全 9 ケース緑)

- [ ] **Step 5: コミット**

```bash
git add api/collab/_roomManageLogic.ts src/lib/__tests__/collabRoomManageLogic.test.ts
git commit -m "feat(collab): 段取り⑤-2a ルーム管理リクエスト検証の純ロジック(parseRoomManageRequest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 定数・型・Firestore ルールの追加

ハンドラが使う `COLLAB_ROOMS` コレクション名と `activeCollabRoomToken` フィールド、collabRooms の rules を先に用意する。

**Files:**
- Modify: `src/types/firebase.ts`(COLLECTIONS + FirestorePlan)
- Modify: `firestore.rules`(collabRooms ルール)

- [ ] **Step 1: COLLECTIONS に COLLAB_ROOMS を追加**

[src/types/firebase.ts:187-192](../../../src/types/firebase.ts#L187) の `COLLECTIONS` を以下に変更(末尾に1行追加):

```typescript
/** Firestoreコレクション名 */
export const COLLECTIONS = {
  USERS: 'users',
  PLANS: 'plans',
  SHARED_PLAN_META: 'sharedPlanMeta',
  USER_PLAN_COUNTS: 'userPlanCounts',
  /** 共同編集⑤: roomToken → plan の対応表。発行/失効は /api/collab/room(admin)経由のみ。 */
  COLLAB_ROOMS: 'collabRooms',
} as const;
```

- [ ] **Step 2: FirestorePlan に activeCollabRoomToken? を追加**

[src/types/firebase.ts:72](../../../src/types/firebase.ts#L72) の `deletedAt?` 行の直後(`}` の前)に追加:

```typescript
  /** 墓標化された日時 (GC の安全期間判定用) */
  deletedAt?: Timestamp | null;
  /** 共同編集⑤: 現在有効な共同編集ルームトークン(逆引き用)。失効/未発行なら未設定。 */
  activeCollabRoomToken?: string;
}
```

- [ ] **Step 3: firestore.rules に collabRooms ルールを追加**

[firestore.rules](../../../firestore.rules) の `match /plans/{planId} { ... }` ブロックと同じ階層(同じ `match /databases/{database}/documents { ... }` 直下)に、以下を追加する:

```
    // 共同編集⑤: roomToken → plan 対応表。発行・取得・失効はすべて
    // /api/collab/room と /api/collab/{load,save}(admin SDK・rules バイパス)経由。
    // クライアントからの直接アクセスは一切許可しない(public repo の明示防御)。
    match /collabRooms/{roomToken} {
      allow read, write: if false;
    }
```

- [ ] **Step 4: ビルドが通ることを確認**

Run: `npm run build`
Expected: 成功(tsc -b エラーなし)。`COLLECTIONS.COLLAB_ROOMS`・`FirestorePlan.activeCollabRoomToken` が型に乗る。

- [ ] **Step 5: firestore ルールの構文確認(任意・dry-run)**

Run: `npx firebase deploy --only firestore:rules --dry-run`
Expected: 構文エラーなし(認証情報が無い環境ではデプロイ手前で止まるが、ルール構文の検証は行われる。失敗してもこのステップは情報目的でスキップ可)。

- [ ] **Step 6: コミット**

```bash
git add src/types/firebase.ts firestore.rules
git commit -m "feat(collab): 段取り⑤-2a collabRooms 定数/型/Firestoreルール追加(クライアント直アクセス禁止)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ルーム管理ハンドラ `/api/collab/room` (`api/collab/room.ts`)

オーナー認証(ID Token)→ ownerId 照合 → collabRooms 発行/失効/再発行/上限変更。admin を叩くためユニットテストは持たず(③/⑤-1 と同方針)、純ロジック(Task 1)+ build で型担保 + Task 5 の結線で動作確認。冪等性は `plans/{planId}.activeCollabRoomToken` で逆引き(複合インデックス不要)。

**Files:**
- Create: `api/collab/room.ts`

- [ ] **Step 1: room.ts を作成する**

```typescript
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
import { clampMaxParticipants, isCollabDisabled, DEFAULT_MAX_PARTICIPANTS } from './_roomLogic.js';

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
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { action, planId, maxParticipants } = parsed.req;

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

      if (action === 'revoke') {
        if (current) {
          tx.update(db.collection('collabRooms').doc(current), { revoked: true });
        }
        tx.update(planRef, { activeCollabRoomToken: FieldValue.delete() });
        return { revoked: true };
      }

      if (action === 'set-max') {
        if (!current) throw new Error('no_room'); // 発行前の上限変更は不可
        const clamped = clampMaxParticipants(maxParticipants);
        tx.update(db.collection('collabRooms').doc(current), { maxParticipants: clamped });
        return { roomToken: current, maxParticipants: clamped, revoked: false };
      }

      // create: 既存の有効ルームがあれば再利用(冪等)。reissue: 旧を失効し必ず新規発行。
      if (action === 'create' && current) {
        const curSnap = await tx.get(db.collection('collabRooms').doc(current));
        const cur = curSnap.exists ? (curSnap.data() as { revoked?: boolean; maxParticipants?: number }) : null;
        if (cur && cur.revoked !== true) {
          return { roomToken: current, maxParticipants: clampMaxParticipants(cur.maxParticipants), revoked: false };
        }
      }
      if (action === 'reissue' && current) {
        tx.update(db.collection('collabRooms').doc(current), { revoked: true });
      }

      const clamped = clampMaxParticipants(maxParticipants ?? DEFAULT_MAX_PARTICIPANTS);
      tx.set(db.collection('collabRooms').doc(freshToken), {
        roomToken: freshToken,
        planId,
        ownerId: uid,
        maxParticipants: clamped,
        revoked: false,
        createdAt: Date.now(),
      });
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
```

> **Firestore transaction の制約に注意**: 全 read は全 write より前に行う。本実装は `tx.get(planRef)` と create 再利用判定の `tx.get(collabRooms/current)` を、いずれの `tx.set`/`tx.update` よりも前に置いている(create の再利用 get は早期 return か、その後の write へ進む)。reissue/revoke の `tx.update(collabRooms/current)` は plan read 済みの後・新規 set の前で制約を満たす。

- [ ] **Step 2: 型・ビルドが通ることを確認**

Run: `npm run build`
Expected: 成功(tsc -b エラーなし)。`parseRoomManageRequest`/`clampMaxParticipants`/`isCollabDisabled`/`DEFAULT_MAX_PARTICIPANTS`/`FieldValue`/`Transaction`/`nanoid` の import がすべて使用されていること。未使用変数なし。

- [ ] **Step 3: 既存純ロジックテストの非破壊を確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts src/lib/__tests__/collabRoomLogic.test.ts src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: PASS(③ collabLogic + ⑤-1 collabRoomLogic + ⑤-2a collabRoomManageLogic がすべて緑)

- [ ] **Step 4: コミット**

```bash
git add api/collab/room.ts
git commit -m "feat(collab): 段取り⑤-2a ルーム管理API /api/collab/room(発行/失効/再発行/上限・オーナー認証)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: ワーカー結線 (`collabPersistence.ts` を roomToken 送信に)

DO が受付係を叩くときの引数を planId → roomToken に変える。`this.name`(= クライアント接続の部屋名)は ⑤-3 で roomToken になる。⑤-2a の本番結線テスト(Task 5)では Claude が node から roomToken で接続するので、`this.name` = roomToken として正しく流れる。load/save ハンドラは ⑤-1 で roomToken 解決済みなので、ここを変えると roomToken 経路が貫通する。

**Files:**
- Modify: `workers/collab/src/collabPersistence.ts`
- Modify: `workers/collab/src/collabPersistence.test.ts`
- Modify: `workers/collab/src/server.ts`(コメントのみ)

- [ ] **Step 1: collabPersistence.test.ts を roomToken 期待に書き換える(先に失敗させる)**

[workers/collab/src/collabPersistence.test.ts](../../../workers/collab/src/collabPersistence.test.ts) を以下に置き換える(`planId` クエリ/body を `roomToken` に変更):

```typescript
import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMitigations, postMitigations, type MitigationRecord } from "./collabPersistence";

const BASE = "https://lopoly.app";
const m = (id: string): MitigationRecord => ({ id, mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" });

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("fetchMitigations (seed 取得)", () => {
  it("live → mitigations 配列を返す", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-a", method: "GET" })
      .reply(200, { mitigations: [m("a")] });
    expect(await fetchMitigations(BASE, "sec", "room-a")).toEqual([m("a")]);
  });

  it("墓標(deleted) → null(破壊保存ガードのため seed しない)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-b", method: "GET" })
      .reply(200, { deleted: true });
    expect(await fetchMitigations(BASE, "sec", "room-b")).toBeNull();
  });

  it("5xx(障害) → null", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-c", method: "GET" })
      .reply(500, "boom");
    expect(await fetchMitigations(BASE, "sec", "room-c")).toBeNull();
  });

  it("roomToken を URL エンコードする", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=a%20b", method: "GET" })
      .reply(200, { mitigations: [] });
    expect(await fetchMitigations(BASE, "sec", "a b")).toEqual([]);
  });
});

describe("postMitigations (書き戻し)", () => {
  it("live → roomToken+mitigations を POST し 'ok'", async () => {
    let body: any = null;
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(200, (opts) => { body = JSON.parse(opts.body as string); return { ok: true, version: 2 }; });
    expect(await postMitigations(BASE, "sec", "room-d", [m("x")])).toBe("ok");
    expect(body).toEqual({ roomToken: "room-d", mitigations: [m("x")] });
  });

  it("skipped(墓標応答) → 'skipped'", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(200, { skipped: "deleted" });
    expect(await postMitigations(BASE, "sec", "room-e", [])).toBe("skipped");
  });

  it("5xx → 'error'", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(503, "down");
    expect(await postMitigations(BASE, "sec", "room-f", [])).toBe("error");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run(workers/collab ディレクトリで): `cd workers/collab && npm test -- --run`
Expected: FAIL — load の path が `?planId=` のままで intercept(`?roomToken=`)と不一致 / post body が `{planId}` で `{roomToken}` 期待と不一致。

- [ ] **Step 3: collabPersistence.ts を roomToken 送信に変更**

[workers/collab/src/collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts) の `fetchMitigations` と `postMitigations` を以下に変更(引数名 planId → roomToken、load クエリ `roomToken=`、post body `{roomToken, mitigations}`)。他の部分は不変:

```typescript
// 共同編集③/⑤ 永続化の HTTP 層(受付係 Vercel API への入出力)。
// DO に依存しない純粋関数として切り出し、fetchMock で決定的にテストする。
// Room(server.ts)はこれを this.collabEnv / this.name(=roomToken) と #saveEnabled ガードで包む。
// ⑤-2a: 受付係は roomToken → planId を解決する(load/save は ⑤-1 で対応済)。
import type { MitigationRecord } from "./yjsMitigations";

export type { MitigationRecord };

const SECRET_HEADER = "x-collab-secret";

/**
 * 受付係 load を叩き seed 用 mitigations を取得する。
 * live → 配列、墓標(deleted)/不正/障害(非2xx・例外) → null(破壊保存ガードのため seed しない)。
 */
export async function fetchMitigations(
  base: string,
  secret: string,
  roomToken: string,
): Promise<MitigationRecord[] | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: MitigationRecord[] };
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return body.mitigations;
  } catch {
    return null;
  }
}

/**
 * 受付係 save に mitigations を POST する。
 * 'ok' = 保存された / 'skipped' = 墓標等で書かれなかった(削除が勝つ) / 'error' = 非2xx・例外。
 */
export async function postMitigations(
  base: string,
  secret: string,
  roomToken: string,
  mitigations: MitigationRecord[],
): Promise<"ok" | "skipped" | "error"> {
  try {
    const res = await fetch(`${base}/api/collab/save`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ roomToken, mitigations }),
    });
    if (!res.ok) return "error";
    const body = (await res.json()) as { skipped?: string };
    return body.skipped ? "skipped" : "ok";
  } catch {
    return "error";
  }
}
```

- [ ] **Step 4: server.ts のコメントを roomToken 前提に更新(ロジック不変)**

[workers/collab/src/server.ts:38](../../../workers/collab/src/server.ts#L38) の onLoad ドキコメントと :44 付近を、`this.name` が roomToken である旨に更新する。コードの呼び出し(`fetchMitigations(APP_API_BASE, COLLAB_SHARED_SECRET, this.name)`)は不変。該当コメント行を以下に差し替え:

```typescript
  /** 受付係から seed 用の軽減配置を読む(this.name = roomToken)。live なら Y.Doc を組んで返し保存を解禁、それ以外は seed しない。 */
  override async onLoad(): Promise<Y.Doc | void> {
```

- [ ] **Step 5: ワーカーテストが通ることを確認**

Run(workers/collab ディレクトリで): `cd workers/collab && npm test -- --run`
Expected: PASS(`collabPersistence.test.ts` の 7 ケース + 既存 `server.test.ts`・`yjsMitigations.test.ts` が緑)

- [ ] **Step 6: コミット**

```bash
git add workers/collab/src/collabPersistence.ts workers/collab/src/collabPersistence.test.ts workers/collab/src/server.ts
git commit -m "feat(collab): 段取り⑤-2a ワーカーが受付係を roomToken で叩くよう結線(load/save は⑤-1対応済)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 全体回帰 + 本番デプロイ + 本番結線テスト + TODO 反映

⑤-2a が ③・1人モード・他テストを壊していないことを確定し、本番にデプロイ(休眠・無害)してから roomToken 経由の結線を Claude が確認する。

**Files:** なし(検証・デプロイ・ドキュメント)

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 2: フルテスト(root)**

Run: `npx vitest run`
Expected: PASS。既知の事前 failure(`housing/TopBar.test.tsx` 4件・`HousingWorkspace.test.tsx` 1件)は ⑤-2a と無関係で従来どおり。collab 系(`collabLogic`/`collabRoomLogic`/`collabRoomManageLogic`)が全緑。
※ vitest がハングする場合は出力をパイプせず単体実行で切り分ける(memory `reference_vitest_vmthreads_hang`)。

- [ ] **Step 3: ワーカーテスト**

Run: `cd workers/collab && npm test -- --run`
Expected: PASS(全緑)。

- [ ] **Step 4: 本番デプロイ(2系統)**

- Vercel: main へ push すると自動デプロイ(memory `reference_vercel_git_autodeploy`)。`/api/collab/room` が本番に出る(UI から呼ぶ口は ⑤-3 まで無いので休眠・無害)。
- Cloudflare Worker: `cd workers/collab && npx wrangler deploy`(collabPersistence の roomToken 化を本番反映。現状クライアントは roomToken 接続しないので無害)。

```bash
# root で
git push
# worker
cd workers/collab && npx wrangler deploy
```

- [ ] **Step 5: 本番結線テスト(Claude・node スクリプト)**

オーナー認証(ID Token)が要る `/api/collab/room` は Claude 単独では叩けない(本番ログイン不可)。そこで **roomToken の用意は2通りのいずれか**で行い、roomToken 経由の同期と保存を確認する:

- (推奨) ユーザーに本番ブラウザで1度だけ「リンク発行」相当を踏んでもらうのは ⑤-3(UI 完成後)。⑤-2a 時点では **`/api/collab/room` のレスポンス形だけを本番で確認**する(認証エラー経路): `curl -s -X POST https://lopoly.app/api/collab/room -H 'content-type: application/json' -d '{"action":"create","planId":"x"}'` → **App Check 無し/未認証で 401 系が返る**ことを確認(エンドポイントが生きている証跡)。
- roomToken 経由の Yjs 同期そのものの本番 E2E(発行→2クライアント接続→保存→再接続残存)は、collabRooms ドキュメントが要るため **⑤-3 の実データ往復検証(ユーザー+Claude の2ブラウザ)に統合**する。⑤-2a 単独ではここまでは到達しない(土台の敷設まで)。

- [ ] **Step 6: TODO.md 反映 + コミット**

[docs/TODO.md](../../TODO.md) の⑤行に「⑤-2a(ルーム管理API+ワーカー結線)実装・main マージ済。残=⑤-2b 満員拒否 / ⑤-3 クライアントUI+実データ往復」を反映(行数 100 以内維持)。

```bash
git add docs/TODO.md
git commit -m "docs(todo): 段取り⑤-2a(ルーム管理API+ワーカー結線)実装済を反映

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

---

## 完了の定義 (⑤-2a)

- `parseRoomManageRequest` の純ロジックが root vitest で全緑(invalid_body/action/planId/maxParticipants・create 冪等省略可・set-max 必須)。
- `/api/collab/room` が ID Token 認証 + `plans.ownerId === uid` 照合のうえ、collabRooms を発行(冪等)/失効/再発行/上限設定し、緊急停止中は 503 を返す。`npm run build` で型担保。
- `collabPersistence.ts` が受付係を **roomToken** で叩き、ワーカーテストが全緑。load/save ハンドラ(⑤-1)と貫通する。
- root フルテスト・ワーカーテストが従来どおり(既知の housing 事前 failure を除き)緑。本番(Vercel + Worker)にデプロイ済で休眠・無害。
- **未達(後続)**: 満員拒否(⑤-2b)。クライアント `startCollabSession` の roomToken 接続 UI・オーナーパネル・ジョイナー一時ビュー・実データ往復 E2E(⑤-3)。⑤-2a 単独では「実際に2人が繋がる」UI には未到達(API とワーカー結線という土台まで)。

---

## Self-Review (spec 対照)

- **§4 リンクのライフサイクル**: 発行(create・冪等)/失効(revoke)/再発行(reissue・旧失効+新発行)/上限(set-max)を Task 3 が網羅。発行できるのはオーナーのみ(ownerId 照合)。寿命=無期限(自動失効を持たない)→ ✅。
- **§5 緊急停止**: room API も `isCollabDisabled` で 503 → ✅。最大人数の *enforcement*(満員拒否)は ⑤-2b に明示送り → ✅(スコープ外を明記)。
- **§6 データモデル**: `collabRooms/{roomToken}` の roomToken/planId/ownerId/maxParticipants/revoked/createdAt を Task 3 が set。`COLLECTIONS.COLLAB_ROOMS`(Task 2)。`plans.activeCollabRoomToken`(任意)を採用し逆引きに使用(Task 2/3)→ ✅。
- **§9 受付係の変更**: 新規 `/api/collab/room`(オーナー認証)を追加 → ✅。load/save の roomToken 化は ⑤-1 で完了済み(本計画は再掲のみ)。
- **§11 未確定の解決**: オーナー認証経路=ID Token(調査確定)/トークン長=nanoid(24)/緊急停止=env `COLLAB_DISABLED`(⑤-1)/複合インデックス=token 主導 get で不要(plan 逆引きで回避)/失効時のライブ在室者=旧 DO は保存不能で自然消滅(§4 通り・能動切断は ⑤-2b/⑤-3 で検討)→ いずれも本計画内で確定。
- **Placeholder スキャン**: TBD/TODO/「適切な〜」なし。全 code ステップに実コードあり。
- **型整合**: `RoomAction`/`RoomManageRequest`/`ParseResult`(Task 1)と room.ts(Task 3)の参照名一致。`clampMaxParticipants`/`isCollabDisabled`/`DEFAULT_MAX_PARTICIPANTS`/`CollabRoomDoc` は ⑤-1 `_roomLogic.ts` の既存 export 名と一致(確認済み)。`fetchMitigations`/`postMitigations` のシグネチャ変更(planId→roomToken)はテストと実装で一致(Task 4)。
