# コスト・ハードニング + OGP実用化 Implementation Plan (コード変更分)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 敵対的コスト監査で発見した穴のうちコードで直せる4件(共同編集レート制限/共有ツアー参加人数ソフト上限/ハウジンガーOGPカード安全化/ツアー招待OGPカード新規作成)を実装する。

**Architecture:** 共同編集は既存の `applyRateLimit` ユーティリティを窓口の最前段に追加するだけ(ロジック無変更)。共有ツアーは新設 presence サブコレクション+集計クエリで「ソフト」参加人数上限を実現。OGP2件は既存の `/og/:hash.png`(Storage+Cloudflare長期キャッシュ)パターンを再利用し、Vercelを直撃しない安全な生成経路に乗せる。

**Tech Stack:** Vercel Node/Edge Functions, Firebase Admin SDK (Firestore), Firestore Web SDK (client), @vercel/og (satori), vitest, React+TS

**Spec:** `docs/superpowers/specs/2026-07-18-cost-hardening-and-ogp-design.md`(§2・§3・§4・§6 が対象。§1・§5はCloudflare運用手順書=別ドキュメント)

## Global Constraints

- api/ 配下から `src/` を import する箇所は **`.js` 拡張子必須**(Vercel Node ESM)。本プランの新規importは全てこの規約に従う。
- `og_image_meta` 生成物を **api/ の Node Function から JSON import しない**(Vercel Node は JSON import 不可の既知制約)。今回は JSON import 不要(base64はTSファイルのexport定数)。
- 新規 Vercel Function(top-levelファイル)は増やさない(Hobby 12関数上限)。既存の `api/housing/index.ts` / `api/share/index.ts` / `api/og/index.ts` の action/type 分岐に畳む。ヘルパーは全て `_` プレフィックス。
- 共同編集(`api/collab/**`)の既存ロジック(マージ・同期エンジン)には一切触れない。追加するのはレート制限チェックのみ。
- テスト実行は対象ファイル指定で `rtk vitest run <path>`。フルスイートは各タスク末尾でのみ。
- コミットは各タスク末尾に1回、`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を末尾に付ける。

---

### Task 1: 共同編集 load/save/verify レート制限

**Files:**
- Modify: `api/collab/_loadHandler.ts`
- Modify: `api/collab/_saveHandler.ts`
- Modify: `api/collab/_verifyHandler.ts`
- Test: `api/collab/__tests__/_loadHandler.test.ts`(新規)
- Test: `api/collab/__tests__/_saveHandler.test.ts`(新規)
- Test: `api/collab/__tests__/_verifyHandler.test.ts`(新規)

**Interfaces:**
- Consumes: `applyRateLimit(req, res, maxRequests, windowMs, opts): Promise<boolean>` from `src/lib/rateLimit.js`(既存・[src/lib/rateLimit.ts:128](../../../src/lib/rateLimit.ts#L128))。`opts.scope`/`opts.globalMax` 対応済み。
- Produces: 3ハンドラとも閾値超過時に `res.status(429).json({ error: 'Too many requests. Please try again later.' })` を返し即 return(既存 `applyRateLimit` の挙動そのまま)。

- [ ] **Step 1: 失敗するテストを書く(3ファイル)**

`api/collab/__tests__/_loadHandler.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApplyRateLimit = vi.fn(async () => true);
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: mockApplyRateLimit }));

const mockAuthorizeCollab = vi.fn(() => true);
const mockGetDb = vi.fn();
vi.mock('../_handlerShared.js', () => ({
  authorizeCollab: (...args: unknown[]) => mockAuthorizeCollab(...args),
  getDb: () => mockGetDb(),
}));

import handler from '../_loadHandler.js';

function makeReqRes(overrides: Partial<{ method: string; headers: Record<string, string>; query: Record<string, string> }> = {}) {
  const req: any = { method: 'GET', headers: {}, query: {}, ...overrides };
  const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return { req, res };
}

describe('_loadHandler レート制限', () => {
  beforeEach(() => { mockApplyRateLimit.mockClear(); mockApplyRateLimit.mockResolvedValue(true); });

  it('applyRateLimit が false を返したら 429 で即終了し、authorizeCollab を呼ばない', async () => {
    mockApplyRateLimit.mockResolvedValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(mockAuthorizeCollab).not.toHaveBeenCalled();
  });

  it('applyRateLimit が true なら従来どおり authorizeCollab のチェックへ進む(secret無しで401)', async () => {
    mockAuthorizeCollab.mockReturnValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(mockApplyRateLimit).toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
```

`api/collab/__tests__/_saveHandler.test.ts`(同型・POSTメソッドに合わせる):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApplyRateLimit = vi.fn(async () => true);
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: mockApplyRateLimit }));

const mockAuthorizeCollab = vi.fn(() => true);
vi.mock('../_handlerShared.js', () => ({
  authorizeCollab: (...args: unknown[]) => mockAuthorizeCollab(...args),
  getDb: () => ({}),
}));

import handler from '../_saveHandler.js';

function makeReqRes() {
  const req: any = { method: 'POST', headers: {}, body: {} };
  const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return { req, res };
}

describe('_saveHandler レート制限', () => {
  beforeEach(() => { mockApplyRateLimit.mockClear(); mockApplyRateLimit.mockResolvedValue(true); });

  it('applyRateLimit が false を返したら 429 で即終了し、authorizeCollab を呼ばない', async () => {
    mockApplyRateLimit.mockResolvedValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(mockAuthorizeCollab).not.toHaveBeenCalled();
  });

  it('applyRateLimit が true なら従来どおり authorizeCollab のチェックへ進む(secret無しで401)', async () => {
    mockAuthorizeCollab.mockReturnValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
```

`api/collab/__tests__/_verifyHandler.test.ts`(同型):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApplyRateLimit = vi.fn(async () => true);
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: mockApplyRateLimit }));

const mockAuthorizeCollab = vi.fn(() => true);
vi.mock('../_handlerShared.js', () => ({
  authorizeCollab: (...args: unknown[]) => mockAuthorizeCollab(...args),
}));

import handler from '../_verifyHandler.js';

function makeReqRes() {
  const req: any = { method: 'POST', headers: {}, body: {} };
  const res: any = { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return { req, res };
}

describe('_verifyHandler レート制限', () => {
  beforeEach(() => { mockApplyRateLimit.mockClear(); mockApplyRateLimit.mockResolvedValue(true); });

  it('applyRateLimit が false を返したら 429 で即終了し、authorizeCollab を呼ばない', async () => {
    mockApplyRateLimit.mockResolvedValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(mockAuthorizeCollab).not.toHaveBeenCalled();
  });

  it('applyRateLimit が true なら従来どおり authorizeCollab のチェックへ進む(secret無しで401)', async () => {
    mockAuthorizeCollab.mockReturnValueOnce(false);
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `rtk vitest run api/collab/__tests__/_loadHandler.test.ts api/collab/__tests__/_saveHandler.test.ts api/collab/__tests__/_verifyHandler.test.ts`
Expected: FAIL(まだ429を返さない=`applyRateLimit`未呼び出しでモックの`toHaveBeenCalled`アサーションが通らない、または既存コードがそのまま401/405を返し429にならない)

- [ ] **Step 3: 実装**

`api/collab/_loadHandler.ts` の先頭 import 群に追加し、ハンドラ冒頭に挿入(既存の `authorizeCollab` チェックより前):
```ts
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideLoadFull, type PlanDocSnapshotFull } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  // 正規トラフィックは Cloudflare Worker(共有シークレット)のみのはずだが、secret検証前に
  // Vercel Edge Request/Function Invocation を消費されるため、検証より前に連打だけ弾く。
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'collab-load', globalMax: 3000 }))) return;
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // ... 以下既存のまま無変更 ...
```

`api/collab/_saveHandler.ts` 同様(POST・windowは同じ値で揃える):
```ts
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideSave, emptyOverwriteSkips, type MitigationRecord, type PlanDocSnapshotFull } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'collab-save', globalMax: 3000 }))) return;
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // ... 以下既存のまま無変更 ...
```

`api/collab/_verifyHandler.ts` 同様:
```ts
import { initAdmin } from '../../src/lib/adminAuth.js';
import { authorizeCollab } from './_handlerShared.js';
import { getAuth } from 'firebase-admin/auth';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!(await applyRateLimit(req, res, 30, 60_000, { scope: 'collab-verify', globalMax: 1500 }))) return;
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // ... 以下既存のまま無変更 ...
```

数値の根拠: load/saveは共同編集中に頻繁に叩かれる正規経路(DOのonLoad/onSave)なので緩め(60/分/IP・globalMax 3000/分=50部屋が同時にフル稼働しても余裕を持たせる)。verifyは接続確立時のみ叩かれる低頻度経路なので厳しめ(30/分/IP・globalMax 1500/分)。scopeを分けたのは、3エンドポイントが同じバケットを共有して正規トラフィック同士で食い合わないようにするため。

- [ ] **Step 4: パス確認**

Run: `rtk vitest run api/collab/__tests__/_loadHandler.test.ts api/collab/__tests__/_saveHandler.test.ts api/collab/__tests__/_verifyHandler.test.ts`
Expected: PASS (6テスト)

- [ ] **Step 5: 既存回帰確認**

Run: `rtk vitest run api/collab`
Expected: 既存の collab 関連テスト(`collabGcLogic.test.ts` 等)も含めて全PASS(ロジック自体は無変更のため回帰無し)

- [ ] **Step 6: 手動2タブ確認(必須ゲート・省略不可)**

`npm run dev` でローカル起動し、共同編集を実際に2タブで動かす:
1. プラン作成 → 共同編集ルーム発行 → 別ブラウザ(未ログイン)でルームに接続
2. 片方で軽減配置を編集 → もう片方に反映されることを確認
3. 開発者ツールのNetworkタブで `/api/collab?action=load|save|verify` が正常に200/実処理を返していることを確認(429が出ていないこと)

問題なければ次のStepへ。異常があれば数値(60/分・globalMax等)を見直す。

- [ ] **Step 7: Commit**

```bash
git add api/collab/_loadHandler.ts api/collab/_saveHandler.ts api/collab/_verifyHandler.ts api/collab/__tests__/_loadHandler.test.ts api/collab/__tests__/_saveHandler.test.ts api/collab/__tests__/_verifyHandler.test.ts
git commit -m "fix(collab): load/save/verifyにレート制限を追加(既存ロジック無変更・窓口の入口チェックのみ)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 共有ツアー参加人数ソフト上限 — サーバー側(join API + presence)

**Files:**
- Modify: `src/types/sharedTour.ts`(定数追加)
- Create: `api/housing/_joinSharedTourLogic.ts`
- Create: `api/housing/_joinSharedTourHandler.ts`
- Modify: `api/housing/index.ts`(action追加)
- Modify: `firestore.rules`(presence サブコレクション追加)
- Test: `api/housing/__tests__/_joinSharedTourLogic.test.ts`(新規)

**Interfaces:**
- Consumes: なし(このタスクは独立)
- Produces: `SHARED_TOUR_MAX_PARTICIPANTS = 300`(`src/types/sharedTour.ts`)。`isPresenceStale(lastSeenAt: number | undefined, nowMs: number): boolean` / `shouldEnforceCap(existingLastSeenAt: number | undefined, nowMs: number): boolean`(`api/housing/_joinSharedTourLogic.ts`)。POST `/api/housing?action=join-shared-tour` body `{tourToken: string, sessionId: string}` → `{ok: true} | {ok: false, reason: 'full'} | 404 | 400`。Task 3 のクライアント側がこの契約を消費する。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/_joinSharedTourLogic.test.ts`:
```ts
import { isPresenceStale, shouldEnforceCap, SHARED_TOUR_PRESENCE_STALE_MS } from '../_joinSharedTourLogic';

describe('isPresenceStale', () => {
  it('lastSeenAt が未指定なら stale', () => {
    expect(isPresenceStale(undefined, 1_000_000)).toBe(true);
  });
  it('猶予内なら stale でない', () => {
    const now = 1_000_000;
    expect(isPresenceStale(now - SHARED_TOUR_PRESENCE_STALE_MS + 1, now)).toBe(false);
  });
  it('猶予ちょうど超過で stale', () => {
    const now = 1_000_000;
    expect(isPresenceStale(now - SHARED_TOUR_PRESENCE_STALE_MS, now)).toBe(true);
  });
});

describe('shouldEnforceCap', () => {
  it('isPresenceStale と同じ結果を返す(新規/失効セッションのみ上限チェック対象)', () => {
    const now = 1_000_000;
    expect(shouldEnforceCap(undefined, now)).toBe(true);
    expect(shouldEnforceCap(now - 1000, now)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `rtk vitest run api/housing/__tests__/_joinSharedTourLogic.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

`src/types/sharedTour.ts` に追記(`SharedTourMeta` インターフェースと `SHARED_TOUR_MAX_STOPS` の間、または末尾):
```ts
/** 招待発行時に幹事が書ける短い文章(任意)。OGPカードにも使う。 */
export const SHARED_TOUR_NAME_MAX_LENGTH = 60;

/** 同時参加人数のソフト上限。join API 経由の参加者のみカウント(§9 参照)。 */
export const SHARED_TOUR_MAX_PARTICIPANTS = 300;
```
`SharedTourMeta` interface に1行追加(既存フィールドの後):
```ts
export interface SharedTourMeta {
  tourToken: string;
  hostUid: string;
  snapshot: TourSnapshot[];
  containsHiddenAddress: boolean;
  createdAt: number;
  /** 幹事が招待発行時に書いた短い文章(任意・空文字許容)。ツアー招待OGPカードにも使う。 */
  tourName?: string;
}
```

`api/housing/_joinSharedTourLogic.ts`(新規):
```ts
/** 参加者の presence(heartbeat) を「有効」とみなす猶予(90秒)。60秒間隔heartbeatの1回欠落を許容。 */
export const SHARED_TOUR_PRESENCE_STALE_MS = 90_000;

/** 直近の heartbeat から猶予を超えて経過している(=失効/未参加)か。 */
export function isPresenceStale(lastSeenAt: number | undefined, nowMs: number): boolean {
  return lastSeenAt === undefined || nowMs - lastSeenAt >= SHARED_TOUR_PRESENCE_STALE_MS;
}

/**
 * 参加上限チェックが必要か。既存セッションが有効(heartbeat継続中)ならチェック不要
 * (自分自身は既に集計に含まれているため、上限ちょうどでも弾かれてはいけない)。
 * 新規/失効セッションのみ上限チェック対象。
 */
export function shouldEnforceCap(existingLastSeenAt: number | undefined, nowMs: number): boolean {
  return isPresenceStale(existingLastSeenAt, nowMs);
}
```

`api/housing/_joinSharedTourHandler.ts`(新規):
```ts
/**
 * POST /api/housing?action=join-shared-tour
 * Body: { tourToken: string, sessionId: string }
 * 認証不要(参加者は未ログイン・匿名)。参加人数のソフト上限(SHARED_TOUR_MAX_PARTICIPANTS)を
 * presence サブコレクションの集計クエリで実現する。300人分の入場ゲート+60秒毎の heartbeat。
 *
 * 「ソフト」上限である旨(spec §3): このAPIを経由せず直接 shared_tours/{token}/live/current を
 * onSnapshot 購読すること自体は技術的に防げない。tourToken(nanoid・推測不能)が実質的な鍵であり、
 * 正規参加者が迂回する動機がないことを前提にした防御レベル。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { SHARED_TOUR_MAX_PARTICIPANTS } from '../../src/types/sharedTour.js';
import { shouldEnforceCap, SHARED_TOUR_PRESENCE_STALE_MS } from './_joinSharedTourLogic.js';

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
  // 幹事1人あたりの heartbeat は約60秒に1回。300人×少し余裕を見た値。
  if (!(await applyRateLimit(req, res, 20, 60_000, { scope: 'join-shared-tour', globalMax: 1500 }))) return;

  const { tourToken, sessionId } = (req.body ?? {}) as { tourToken?: unknown; sessionId?: unknown };
  if (typeof tourToken !== 'string' || !tourToken) {
    return res.status(400).json({ error: 'tourToken required' });
  }
  if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 100) {
    return res.status(400).json({ error: 'invalid_session' });
  }

  try {
    initAdmin();
    const db = getAdminFirestore();
    const tourRef = db.collection('shared_tours').doc(tourToken);
    const tourSnap = await tourRef.get();
    if (!tourSnap.exists) return res.status(404).json({ error: 'not_found' });

    const now = Date.now();
    const presenceCol = tourRef.collection('presence');
    const sessionRef = presenceCol.doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const existingLastSeenAt = sessionSnap.exists ? (sessionSnap.data()?.lastSeenAt as number | undefined) : undefined;

    if (shouldEnforceCap(existingLastSeenAt, now)) {
      const staleThreshold = now - SHARED_TOUR_PRESENCE_STALE_MS;
      const countSnap = await presenceCol.where('lastSeenAt', '>=', staleThreshold).count().get();
      if (countSnap.data().count >= SHARED_TOUR_MAX_PARTICIPANTS) {
        return res.status(200).json({ ok: false, reason: 'full' });
      }
    }

    await sessionRef.set({ lastSeenAt: now });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[housing/join-shared-tour] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

`api/housing/index.ts` に action 追加。import 群(既存 `createSharedTourHandler` の直後)に追加:
```ts
import createSharedTourHandler from './_createSharedTourHandler.js';
import joinSharedTourHandler from './_joinSharedTourHandler.js';
import gcSharedToursHandler from './_gcSharedToursHandler.js';
```
switch文(既存 `case 'create-shared-tour':` の直後)に追加:
```ts
    case 'create-shared-tour':
      return createSharedTourHandler(req, res);
    case 'join-shared-tour':
      return joinSharedTourHandler(req, res);
    case 'gc-shared-tours':
      return gcSharedToursHandler(req, res);
```
先頭コメントブロックの一覧にも1行追加(既存 `create-shared-tour` の説明の直後):
```
 * ?action=create-shared-tour        → POST 招待ツアー発行 (幹事ログイン必須・shared_tours 作成)
 * ?action=join-shared-tour          → POST 参加者の入場ゲート+heartbeat (認証不要・匿名・presence 集計で300人ソフト上限)
```
default のエラーメッセージ末尾にも `|create-shared-tour|join-shared-tour` を追記。

`firestore.rules` の `shared_tours` ブロック(`match /shared_tours/{tourToken} {` 内、`match /live/{docId} {` ブロックの後)に追加:
```
      match /presence/{sessionId} {
        // presence の読み書きは join-shared-tour API(Admin SDK)経由のみ。
        // クライアント直書きを許すと集計(count)ベースの上限チェックを迂回されるため。
        allow get, list: if false;
        allow write: if false;
      }
```

- [ ] **Step 4: パス確認**

Run: `rtk vitest run api/housing/__tests__/_joinSharedTourLogic.test.ts`
Expected: PASS(3テスト)

- [ ] **Step 5: 既存回帰確認**

Run: `rtk vitest run api/housing`
Expected: 既存の `_sharedTourCreateLogic.test.ts` 等含め全PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/sharedTour.ts api/housing/_joinSharedTourLogic.ts api/housing/_joinSharedTourHandler.ts api/housing/index.ts api/housing/__tests__/_joinSharedTourLogic.test.ts firestore.rules
git commit -m "feat(housing): 共有ツアー参加人数のソフト上限(300人)をjoin API+presence集計で実装

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 共有ツアー参加人数ソフト上限 — クライアント側

**Files:**
- Create: `src/lib/sharedTour/presence.ts`
- Modify: `src/lib/housingApiClient.ts`(join API クライアント関数追加)
- Modify: `src/lib/sharedTour/useJoinTour.ts`
- Modify: `src/components/housing/pages/JoinTourPage.tsx`(`full` 状態のUI分岐)
- Modify: `src/locales/{ja,en,ko,zh}.json`(`housing.tour.join.full` キー追加)
- Test: `src/lib/sharedTour/__tests__/presence.test.ts`(新規)

**Interfaces:**
- Consumes: Task 2 の `POST /api/housing?action=join-shared-tour`(body `{tourToken, sessionId}` → `{ok:boolean, reason?:'full'}`)
- Produces: `JoinTourKind` に `'full'` を追加(`useJoinTour.ts`)。`getOrCreateSessionId(): string`(`presence.ts`)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sharedTour/__tests__/presence.test.ts`:
```ts
import { getOrCreateSessionId } from '../presence';

describe('getOrCreateSessionId', () => {
  beforeEach(() => sessionStorage.clear());

  it('初回は新規IDを生成しsessionStorageに保存する', () => {
    const id = getOrCreateSessionId();
    expect(id).toBeTruthy();
    expect(sessionStorage.getItem('lopo_shared_tour_session')).toBe(id);
  });

  it('2回目以降は同じIDを返す', () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `rtk vitest run src/lib/sharedTour/__tests__/presence.test.ts`
Expected: FAIL(モジュール未作成)

- [ ] **Step 3: 実装**

`src/lib/sharedTour/presence.ts`(新規):
```ts
const SESSION_KEY = 'lopo_shared_tour_session';

/** タブ単位のセッションID。sessionStorage に保持し、同タブの再読み込みでも同一IDを維持する。 */
export function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
```

`src/lib/housingApiClient.ts` に追加(`createSharedTour` 関数の後):
```ts
export interface JoinSharedTourResponse {
  ok: boolean;
  reason?: 'full';
}

/** 参加者(匿名)の入場ゲート+heartbeat。認証不要(buildHeaders(false)=App Checkのみ)。 */
export async function joinSharedTour(tourToken: string, sessionId: string): Promise<JoinSharedTourResponse> {
  const headers = await buildHeaders(false);
  const res = await fetch(`${API_BASE}?action=join-shared-tour`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tourToken, sessionId }),
  });
  if (res.status === 404) return { ok: false };
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `join-shared-tour failed: ${res.status}`);
  }
  return (await res.json()) as JoinSharedTourResponse;
}
```

`src/lib/sharedTour/useJoinTour.ts` を書き換え(`JoinTourKind` に `'full'` 追加、join APIを`onSnapshot`購読の前に挟む、60秒heartbeat追加):
```ts
import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isTourExpired } from './lifecycle';
import { getOrCreateSessionId } from './presence';
import { joinSharedTour } from '../housingApiClient';
import type { SharedTourMeta, SharedTourLiveState } from '../../types/sharedTour';

/** useJoinTour の状態種別。connecting=接続中、notfound=存在しない/読めない、full=満員、ended=終了済み、viewing=閲覧中 */
export type JoinTourKind = 'connecting' | 'notfound' | 'full' | 'ended' | 'viewing';

export interface JoinTourState {
  kind: JoinTourKind;
  meta: SharedTourMeta | null;
  live: SharedTourLiveState | null;
}

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * 参加者(未ログイン・匿名)が招待リンクを開いたときに使うフック。
 * shared_tours/{tourToken} を1回 getDoc → join-shared-tour API で入場ゲート(300人ソフト上限)を
 * 通過 → 通過できたときだけ .../live/current を onSnapshot 購読して幹事の現在位置に追従する。
 * 満員時は onSnapshot を一切張らない(コストを発生させない)。
 * Phase 0 で確定した方式(a)=匿名 onSnapshot 直読み(Firestore App Check = Unenforced)。
 */
export function useJoinTour(tourToken: string): JoinTourState {
  const [kind, setKind] = useState<JoinTourKind>('connecting');
  const [meta, setMeta] = useState<SharedTourMeta | null>(null);
  const [live, setLive] = useState<SharedTourLiveState | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let reachedServer = false;

    (async () => {
      setKind('connecting');
      setMeta(null);
      setLive(null);

      let snap;
      try {
        snap = await getDoc(doc(db, 'shared_tours', tourToken));
      } catch (err) {
        console.error('[useJoinTour] shared_tours の取得に失敗', err);
        if (!cancelled) setKind('notfound');
        return;
      }
      if (cancelled) return;

      if (!snap.exists()) {
        setKind('notfound');
        return;
      }

      const sessionId = getOrCreateSessionId();
      try {
        const joinResult = await joinSharedTour(tourToken, sessionId);
        if (cancelled) return;
        if (!joinResult.ok) {
          setKind(joinResult.reason === 'full' ? 'full' : 'notfound');
          return;
        }
      } catch (err) {
        console.error('[useJoinTour] join-shared-tour に失敗', err);
        if (!cancelled) setKind('notfound');
        return;
      }

      setMeta(snap.data() as SharedTourMeta);

      // 60秒毎に heartbeat(presence の lastSeenAt を更新し続ける)。失敗は無視(既に入場済みなので
      // 一時的な heartbeat 失敗で閲覧を中断させない)。
      heartbeat = setInterval(() => {
        void joinSharedTour(tourToken, sessionId).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);

      unsub = onSnapshot(
        doc(db, 'shared_tours', tourToken, 'live', 'current'),
        { includeMetadataChanges: true },
        (liveSnap) => {
          if (cancelled) return;

          if (liveSnap.metadata.fromCache && !reachedServer) {
            return;
          }
          reachedServer = true;

          if (!liveSnap.exists()) {
            setKind('ended');
            setLive(null);
            return;
          }

          const data = liveSnap.data() as SharedTourLiveState;
          setLive(data);
          setKind(isTourExpired(data, Date.now()) ? 'ended' : 'viewing');
        },
        (err) => {
          console.error('[useJoinTour] live/current の購読に失敗', err);
          if (!cancelled) setKind('notfound');
        },
      );
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [tourToken]);

  return { kind, meta, live };
}
```

`src/components/housing/pages/JoinTourPage.tsx` の分岐に `full` を追加(既存の `connecting`/`notfound` と同じ中央1枚メッセージパターン):
```tsx
  // connecting / notfound / full は中央1枚のメッセージ。
  if (kind === 'connecting' || kind === 'notfound' || kind === 'full') {
    const message =
      kind === 'connecting' ? t('housing.tour.join.connecting')
      : kind === 'full' ? t('housing.tour.join.full')
      : t('housing.tour.join.notfound');
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <div className="housing-tour-empty">
            <p className="housing-tour-empty-title">{message}</p>
          </div>
        </section>
      </div>
    );
  }
```

ロケール追加(`housing.tour.join` ブロック、既存 `notfound` キーの近く。4ファイルとも追加・parity維持):

`src/locales/ja.json`:
```
"full": "このツアーは満員です。しばらくしてからもう一度お試しください。",
```
`src/locales/en.json`:
```
"full": "This tour is full. Please try again later.",
```
`src/locales/ko.json`:
```
"full": "이 투어는 정원이 가득 찼습니다. 잠시 후 다시 시도해 주세요.",
```
`src/locales/zh.json`:
```
"full": "本次导览人数已满，请稍后再试。",
```

- [ ] **Step 4: パス確認**

Run: `rtk vitest run src/lib/sharedTour/__tests__/presence.test.ts`
Expected: PASS(2テスト)

- [ ] **Step 5: 既存回帰確認**

Run: `rtk vitest run src/lib/sharedTour src/components/housing/pages/__tests__/JoinTourPage.test.tsx`
Expected: 既存テストが `useJoinTour` の新しい `join-shared-tour` 呼び出しを考慮していない場合、モック不足で失敗しうる。`JoinTourPage.test.tsx` 側で `joinSharedTour` を `vi.mock('../../../lib/housingApiClient', ...)` 等でモックし `{ok:true}` を返すよう追従修正すること(既存テストの前提が変わった箇所のみ最小限修正)。

- [ ] **Step 6: 手動確認**

`npm run dev` で実際にツアーを作成→招待リンクを別ブラウザ(未ログイン)で開き、通常どおり同期表示されることを確認。SHARED_TOUR_MAX_PARTICIPANTS を一時的に `1` に書き換えて2つ目のタブが「満員」表示になることを確認 → 確認後に `300` へ戻す。

- [ ] **Step 7: Commit**

```bash
git add src/lib/sharedTour/presence.ts src/lib/sharedTour/useJoinTour.ts src/lib/housingApiClient.ts src/components/housing/pages/JoinTourPage.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/lib/sharedTour/__tests__/presence.test.ts
git commit -m "feat(housing): 共有ツアー参加ゲートをクライアント側に配線(満員UI+60秒heartbeat)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: ハウジンガーOGPカード 安全化(見た目は変更しない)

**Files:**
- Modify: `src/lib/ogpImageHash.ts`(汎用ハッシュ関数追加)
- Create: `api/og-cache/_ogCacheLogic.ts`
- Modify: `api/og-cache/index.ts`
- Modify: `api/share/_housingerPageHandler.ts`
- Test: `src/lib/__tests__/ogpImageHash.test.ts`(追記)
- Test: `api/og-cache/__tests__/_ogCacheLogic.test.ts`(新規)

**Interfaces:**
- Consumes: 既存 `buildHousingerOgCardParams(input): URLSearchParams` / `buildHousingerOgCardUrl(origin, input, secret): Promise<string>`(`src/lib/ogpHousingerCard.ts`、無変更)
- Produces: `computeOgCardImageHash(params: URLSearchParams): string`(`src/lib/ogpImageHash.ts`)。`isValidOgImageMeta(meta): boolean` / `buildInternalOgUrl(origin, meta, cronSecret): Promise<string>`(`api/og-cache/_ogCacheLogic.ts`、Task 5 でも使用)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/ogpImageHash.test.ts` に追記(ファイル末尾):
```ts
import { computeOgCardImageHash } from '../ogpImageHash';

describe('computeOgCardImageHash', () => {
  it('戻り値は16桁の小文字16進文字列', () => {
    const params = new URLSearchParams({ type: 'housinger', ver: '2', name: 'テスト' });
    expect(computeOgCardImageHash(params)).toMatch(/^[a-f0-9]{16}$/);
  });

  it('同じパラメータなら決定的に同じhashを返す', () => {
    const a = new URLSearchParams({ type: 'housinger', name: 'A' });
    const b = new URLSearchParams({ type: 'housinger', name: 'A' });
    expect(computeOgCardImageHash(a)).toBe(computeOgCardImageHash(b));
  });

  it('パラメータが変わればhashも変わる', () => {
    const a = new URLSearchParams({ type: 'housinger', name: 'A' });
    const b = new URLSearchParams({ type: 'housinger', name: 'B' });
    expect(computeOgCardImageHash(a)).not.toBe(computeOgCardImageHash(b));
  });
});
```

`api/og-cache/__tests__/_ogCacheLogic.test.ts`(新規):
```ts
import { isValidOgImageMeta, buildInternalOgUrl } from '../_ogCacheLogic';

describe('isValidOgImageMeta', () => {
  it('type無し(page型)はshareIdが必須', () => {
    expect(isValidOgImageMeta({ shareId: 'abc' })).toBe(true);
    expect(isValidOgImageMeta({})).toBe(false);
  });
  it('type=housingerはshareId不要', () => {
    expect(isValidOgImageMeta({ type: 'housinger', name: 'A' })).toBe(true);
  });
  it('null/undefinedは無効', () => {
    expect(isValidOgImageMeta(null)).toBe(false);
    expect(isValidOgImageMeta(undefined)).toBe(false);
  });
});

describe('buildInternalOgUrl', () => {
  it('type無し(page型)は従来どおり /api/og?id=... を組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { shareId: 'abc123', showLogo: false, lang: 'ja' }, undefined);
    expect(url).toBe('https://lopoly.app/api/og?id=abc123&lang=ja');
  });
  it('type=housingerはsecret必須で署名付きURLを組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { type: 'housinger', name: 'テスト', avatarUrl: null, imageUrls: [] }, 'test-secret');
    expect(url).toMatch(/^https:\/\/lopoly\.app\/api\/og\?type=housinger&ver=2&name=%E3%83%86%E3%82%B9%E3%83%88&sig=[a-f0-9]{24}$/);
  });
  it('type=housingerでsecret未設定なら例外', async () => {
    await expect(buildInternalOgUrl('https://lopoly.app', { type: 'housinger', name: 'A' }, undefined)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `rtk vitest run src/lib/__tests__/ogpImageHash.test.ts api/og-cache/__tests__/_ogCacheLogic.test.ts`
Expected: FAIL(`computeOgCardImageHash`/`_ogCacheLogic` 未実装)

- [ ] **Step 3: 実装**

`src/lib/ogpImageHash.ts` に追記(ファイル末尾):
```ts
/**
 * OGPカードURL(housinger/tour等)の生成パラメータ(URLSearchParams、sig抜き)から
 * 内容ハッシュを計算する。同じ内容は同じhash=Storageで重複排除、内容が変わればhashも変わる。
 */
export function computeOgCardImageHash(params: URLSearchParams): string {
  return createHash('sha256').update(params.toString()).digest('hex').slice(0, 16);
}
```

`api/og-cache/_ogCacheLogic.ts`(新規):
```ts
// og-cache の MISS 時、保存された og_image_meta から内部 /api/og URL を組み立てる純ロジック。
// Firestore I/O は呼び出し側(index.ts)が担う。type別に分岐: 'housinger' は新設カード、
// 無指定/'page' は既存の共有プランカード(後方互換)。'tour' 分岐は Task 5 で追加する
// (src/lib/ogpTourInviteCard.ts がまだ存在しないため、このタスク単体では import しない)。
import { buildHousingerOgCardUrl } from '../../src/lib/ogpHousingerCard.js';

export interface OgImageMeta {
  type?: string;
  shareId?: string; showLogo?: boolean; logoHash?: string | null; lang?: string;
  name?: string; avatarUrl?: string | null; imageUrls?: string[];
}

/** page型(type無し/'page')はshareIdが必須。housinger/tour等その他は不要。 */
export function isValidOgImageMeta(meta: OgImageMeta | null | undefined): meta is OgImageMeta {
  if (!meta) return false;
  if (!meta.type || meta.type === 'page') return typeof meta.shareId === 'string';
  return true;
}

export async function buildInternalOgUrl(
  origin: string,
  meta: OgImageMeta,
  cronSecret: string | undefined,
): Promise<string> {
  if (meta.type === 'housinger') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildHousingerOgCardUrl(origin, {
      name: meta.name ?? '',
      avatarUrl: meta.avatarUrl ?? null,
      imageUrls: meta.imageUrls ?? [],
    }, cronSecret);
  }
  let url = `${origin}/api/og?id=${encodeURIComponent(meta.shareId ?? '')}`;
  if (meta.showLogo) {
    url += '&showLogo=true';
    if (meta.logoHash) url += `&lh=${encodeURIComponent(meta.logoHash)}`;
  }
  url += `&lang=${meta.lang === 'en' ? 'en' : 'ja'}`;
  return url;
}
```

`api/og-cache/index.ts` の修正。冒頭 import に追加:
```ts
import { isValidOgImageMeta, buildInternalOgUrl } from './_ogCacheLogic.js';
```
既存のローカル `buildInternalOgUrl` 関数定義(60-73行目付近)を削除し、呼び出し箇所(MISS分岐)を書き換え:
```ts
        const meta = metaSnap.data() as any;
        if (!isValidOgImageMeta(meta)) {
            return res.status(500).json({ error: 'invalid meta' });
        }

        const origin = resolveOgOrigin(req);
        const ogUrl = await buildInternalOgUrl(origin, meta, process.env.CRON_SECRET);
```
(`Firestore` を含む既存の他インポート・`resolveOgOrigin`・HIT分岐等は無変更)

`api/share/_housingerPageHandler.ts` の修正。import を書き換え:
```ts
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { normalizeHousingerUid, stripHashedPrefix, HOUSINGER_BIO_MAX_LENGTH } from '../../src/lib/housing/housingerProfile.js';
import { buildHousingerOgCardParams } from '../../src/lib/ogpHousingerCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
```
`buildHousingerOgCardUrl` を使っていたブロック(既存133-145行目付近)を置き換え:
```ts
          // OGP画像: アバター+名前+公開ハウジング画像(最大3枚)の「ページ風カード」を
          // 安全なキャッシュ経路(/og/{hash}.png・Storage+Cloudflare長期キャッシュ)で配信する。
          // 内容ハッシュを og_image_meta に保存し、og-cache が MISS 時だけ /api/og?type=housinger を叩く
          // (直接 /api/og を毎回叩いていた旧実装は Cloudflare の Bypass 対象で件数が無防備だった)。
          let cardUrl: string | null = null;
          try {
            const params = buildHousingerOgCardParams({
              name: displayName,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
            });
            const hash = computeOgCardImageHash(params);
            await db.collection('og_image_meta').doc(hash).set({
              type: 'housinger',
              name: displayName,
              avatarUrl: avatarUrl ? toAbsoluteUrl(avatarUrl, origin) : null,
              imageUrls: resolvedImages.map((img) => toAbsoluteUrl(img, origin)),
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
            cardUrl = `${origin}/og/${hash}.png`;
          } catch (err) {
            console.error('Housinger OG card hash/meta error:', err);
          }
```
(直後の `if (cardUrl) { ogImageUrl = cardUrl; } else { ... }` フォールバックブロックは無変更のまま残す)

- [ ] **Step 4: パス確認**

Run: `rtk vitest run src/lib/__tests__/ogpImageHash.test.ts api/og-cache/__tests__/_ogCacheLogic.test.ts`
Expected: PASS(6テスト)

- [ ] **Step 5: 既存回帰確認**

Run: `rtk vitest run src/lib/__tests__/ogpHousingerCard.test.ts src/lib/housing/__tests__`
Expected: 全PASS(`buildHousingerOgCardParams`/`buildHousingerOgCardUrl` 自体は無変更)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ogpImageHash.ts api/og-cache/_ogCacheLogic.ts api/og-cache/index.ts api/share/_housingerPageHandler.ts src/lib/__tests__/ogpImageHash.test.ts api/og-cache/__tests__/_ogCacheLogic.test.ts
git commit -m "fix(housing): ハウジンガーOGPカードを/og/:hash.png安全経路に繋ぎ直す(見た目は無変更)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ツアー招待OGPカード — レンダラー+安全キャッシュ配線

**Files:**
- Create: `src/assets/og/tour-invite-bg.jpg`(処理済み背景画像・下記Step 0参照)
- Create: `scripts/generate-tour-invite-bg.mjs`
- Create: `api/og/_tourInviteBg.generated.ts`(生成物)
- Create: `src/lib/ogpTourInviteCard.ts`
- Create: `api/og/_tourInviteCard.ts`
- Modify: `api/og/index.ts`(type=tour 分岐追加)
- Modify: `api/og-cache/_ogCacheLogic.ts`(Task 4 で作成済み。Step 7 で `type='tour'` 分岐を追加)
- Test: `src/lib/__tests__/ogpTourInviteCard.test.ts`(新規)

**Interfaces:**
- Consumes: Task 4 の `api/og-cache/_ogCacheLogic.ts`(`isValidOgImageMeta`/`buildInternalOgUrl`。`type==='tour'` 分岐は本タスクの Step 7 で追加する)。`SHARED_TOUR_NAME_MAX_LENGTH`(`src/types/sharedTour.ts`、Task 2 で追加済み)。
- Produces: `buildTourInviteOgCardParams(input): URLSearchParams` / `buildTourInviteOgCardUrl(origin, input, secret): Promise<string>` / `verifyTourInviteOgCardSig(searchParams, secret): Promise<boolean>`(`src/lib/ogpTourInviteCard.ts`、Task 6 で消費)。`handleTourInviteCardRequest(searchParams): Promise<Response>`(`api/og/_tourInviteCard.ts`)。

**Step 0(実装前の準備・コード不要): 背景画像の配置**

ユーザー提供の `C:\Users\masay\Downloads\MAP.png`(1366×768、既にぼかし加工済み)を、1200×630 JPEG品質75に変換したものを既に用意済み:
`C:\Users\masay\AppData\Local\Temp\claude\c--Users-masay-Desktop-FF14Sim\5e7ec739-6974-4bd7-aded-f5c6cb939c4c\scratchpad\tour-invite-bg-q75.jpg`(36KB)

このファイルを `src/assets/og/tour-invite-bg.jpg` にコピーする:
```bash
mkdir -p src/assets/og
cp "C:/Users/masay/AppData/Local/Temp/claude/c--Users-masay-Desktop-FF14Sim/5e7ec739-6974-4bd7-aded-f5c6cb939c4c/scratchpad/tour-invite-bg-q75.jpg" src/assets/og/tour-invite-bg.jpg
```

- [ ] **Step 1: 生成スクリプトを書く**

`scripts/generate-tour-invite-bg.mjs`(新規):
```js
// 使い方: node scripts/generate-tour-invite-bg.mjs
// src/assets/og/tour-invite-bg.jpg → api/og/_tourInviteBg.generated.ts (base64 data URI 埋め込み)
// **正典は src/assets/og/tour-invite-bg.jpg**。画像を差し替えたら本スクリプトを再実行する。
import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('src/assets/og/tour-invite-bg.jpg');
const base64 = buf.toString('base64');
const dataUri = `data:image/jpeg;base64,${base64}`;

writeFileSync(
  'api/og/_tourInviteBg.generated.ts',
  `// 生成物。編集しないこと。scripts/generate-tour-invite-bg.mjs で再生成する。\nexport const TOUR_INVITE_BG_DATA_URI = '${dataUri}';\n`,
);
console.log(`_tourInviteBg.generated.ts 生成完了: base64 ${(base64.length / 1024).toFixed(0)}KB`);
```

- [ ] **Step 2: 生成物を作る**

Run: `node scripts/generate-tour-invite-bg.mjs`
Expected: `_tourInviteBg.generated.ts 生成完了: base64 XXKB` (48KB前後) と表示され、`api/og/_tourInviteBg.generated.ts` が作成される。

- [ ] **Step 3: 失敗するテストを書く**

`src/lib/__tests__/ogpTourInviteCard.test.ts`(新規):
```ts
import { buildTourInviteOgCardParams, buildTourInviteOgCardUrl, verifyTourInviteOgCardSig } from '../ogpTourInviteCard';

describe('buildTourInviteOgCardParams', () => {
  it('type/ver/nameを含む', () => {
    const params = buildTourInviteOgCardParams({ name: '休日ハウジング巡り' });
    expect(params.get('type')).toBe('tour');
    expect(params.get('name')).toBe('休日ハウジング巡り');
  });
  it('nameが未指定/空文字なら空文字になる', () => {
    const params = buildTourInviteOgCardParams({ name: '' });
    expect(params.get('name')).toBe('');
  });
});

describe('buildTourInviteOgCardUrl / verifyTourInviteOgCardSig', () => {
  const secret = 'test-secret-value';

  it('組み立てたURLの署名が検証を通る', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/og');
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, secret)).toBe(true);
  });

  it('パラメータ改ざんで署名検証が失敗する', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    parsed.searchParams.set('name', '改ざん');
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, secret)).toBe(false);
  });

  it('secretが違えば検証は失敗する', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, 'different-secret')).toBe(false);
  });

  it('sigが無ければ検証は失敗する', async () => {
    const params = buildTourInviteOgCardParams({ name: 'A' });
    expect(await verifyTourInviteOgCardSig(params, secret)).toBe(false);
  });
});
```

- [ ] **Step 4: 失敗確認**

Run: `rtk vitest run src/lib/__tests__/ogpTourInviteCard.test.ts`
Expected: FAIL(`ogpTourInviteCard.ts` 未作成)

- [ ] **Step 5: 実装**

`src/lib/ogpTourInviteCard.ts`(新規・`ogpHousingerCard.ts` と同型の署名方式):
```ts
/**
 * ツアー招待ページ (/housing/tour/:tourToken) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 * 設計・署名方式は src/lib/ogpHousingerCard.ts と同型(HMAC-SHA256・パラメータ順固定)。
 * 背景画像はビルド時埋め込み(api/og/_tourInviteBg.generated.ts)のためパラメータは name のみ。
 */

const SIG_PARAM = 'sig';
const CARD_VERSION = '1';
const SIG_HEX_LENGTH = 24;

export interface TourInviteOgCardInput {
  /** 幹事が招待発行時に書いた短い文章。空文字/未指定可。 */
  name: string;
}

export function buildTourInviteOgCardParams(input: TourInviteOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'tour');
  params.set('ver', CARD_VERSION);
  params.set('name', input.name || '');
  return params;
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sigBuf);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signTourInviteOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
  const fullHex = await hmacSha256Hex(secret, params.toString());
  return fullHex.slice(0, SIG_HEX_LENGTH);
}

export async function buildTourInviteOgCardUrl(
  origin: string,
  input: TourInviteOgCardInput,
  secret: string,
): Promise<string> {
  const params = buildTourInviteOgCardParams(input);
  const sig = await signTourInviteOgCardParams(params, secret);
  params.set(SIG_PARAM, sig);
  return `${origin}/api/og?${params.toString()}`;
}

export async function verifyTourInviteOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean> {
  const sig = searchParams.get(SIG_PARAM);
  if (!sig) return false;
  const withoutSig = new URLSearchParams(searchParams);
  withoutSig.delete(SIG_PARAM);
  const expected = await signTourInviteOgCardParams(withoutSig, secret);
  return timingSafeEqualHex(expected, sig);
}
```

`api/og/_tourInviteCard.ts`(新規・`_housingerCard.ts` と同トンマナ・honeyグラデーション):
```ts
/**
 * `type=tour` カード用の要素ツリー + リクエストハンドラ。
 * api/og/index.ts の `type=tour` 分岐から呼ばれる(新規 Edge Function は作らない)。
 * 背景はユーザー提供のツアーナビ画面スクショ(既にぼかし加工済み・ビルド時base64埋め込み・
 * 外部fetch無し=ハウジンガーカードのアバター取得のような失敗点が無い)。
 */
import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyTourInviteOgCardSig } from '../../src/lib/ogpTourInviteCard.js';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../src/types/sharedTour.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';

const ACCENT_HONEY = '#ffc987';
const ACCENT_HONEY_GLOW = '#ffb35a';
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

function buildTourInviteCard(name: string) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
        backgroundImage: `url(${TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: '100% 100%',
        fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        // 可読性のための暗幕(背景がぼかし済みでも文字が沈まないよう軽く重ねる)。
        {
          type: 'div',
          props: { style: { position: 'absolute', inset: 0, backgroundColor: 'rgba(10,14,24,0.42)', display: 'flex' } },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'relative', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, padding: '0 80px', textAlign: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 64, fontWeight: 900, letterSpacing: -1, lineHeight: 1.2,
                    backgroundImage: `linear-gradient(135deg, ${ACCENT_HONEY}, ${ACCENT_HONEY_GLOW})`,
                    backgroundClip: 'text', color: 'transparent', display: 'flex',
                  },
                  children: 'LoPo Housing Tour',
                },
              },
              ...(name ? [{
                type: 'div',
                props: {
                  style: { fontSize: 32, fontWeight: 700, color: '#ffffff', display: 'flex' },
                  children: name.slice(0, SHARED_TOUR_NAME_MAX_LENGTH),
                },
              }] : []),
            ],
          },
        },
      ],
    },
  };
}

/** 画像取得/satoriレンダリング失敗時の最小限フォールバック(ブランド文字のみ)。 */
function buildTourInviteFallbackCard() {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#111725', fontFamily: '"M PLUS 1", sans-serif',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 64, fontWeight: 900, letterSpacing: -1,
            backgroundImage: `linear-gradient(135deg, ${ACCENT_HONEY}, ${ACCENT_HONEY_GLOW})`,
            backgroundClip: 'text', color: 'transparent', display: 'flex',
          },
          children: 'LoPo Housing Tour',
        },
      },
    },
  };
}

export async function handleTourInviteCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response('OGP card unavailable', { status: 400 });
  }
  const validSig = await verifyTourInviteOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const name = (searchParams.get('name') || '').slice(0, SHARED_TOUR_NAME_MAX_LENGTH);

  try {
    const uniqueChars = [...new Set('LoPo Housing Tour' + name)].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);
    const element = buildTourInviteCard(name);
    return new ImageResponse(element as any, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS });
  } catch (err) {
    console.error('Tour invite OG card error:', err);
    try {
      const fonts = await loadMPlus1Fonts('LoPo Housing Tour').catch(() => []);
      const element = buildTourInviteFallbackCard();
      return new ImageResponse(element as any, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS });
    } catch (fallbackErr) {
      console.error('Tour invite OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
```

`api/og/index.ts` の `type=housinger` 分岐(既存42-44行目付近)の直後に追加:
```ts
        // ハウジンガーページ専用カード(署名付きURLのみ受理・別トンマナ)。
        if (searchParams.get('type') === 'housinger') {
            return handleHousingerCardRequest(searchParams);
        }
        // ツアー招待ページ専用カード(署名付きURLのみ受理)。
        if (searchParams.get('type') === 'tour') {
            return handleTourInviteCardRequest(searchParams);
        }
```
冒頭の import に追加:
```ts
import { handleHousingerCardRequest } from './_housingerCard.js';
import { handleTourInviteCardRequest } from './_tourInviteCard.js';
```

- [ ] **Step 6: パス確認**

Run: `rtk vitest run src/lib/__tests__/ogpTourInviteCard.test.ts`
Expected: PASS(6テスト)

- [ ] **Step 7: `_ogCacheLogic.ts` に tour 分岐を追加**

Task 4 で作成した `api/og-cache/_ogCacheLogic.ts` は、当時まだ `src/lib/ogpTourInviteCard.ts` が存在しなかったため `type==='tour'` 分岐を持たない。ここで追加する。

まず失敗するテストを `api/og-cache/__tests__/_ogCacheLogic.test.ts` の `describe('buildInternalOgUrl', ...)` 内、既存の `type=housinger` テストの後に追記:
```ts
  it('type=tourはsecret必須で署名付きURLを組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { type: 'tour', name: 'テスト' }, 'test-secret');
    expect(url).toMatch(/^https:\/\/lopoly\.app\/api\/og\?type=tour&ver=1&name=%E3%83%86%E3%82%B9%E3%83%88&sig=[a-f0-9]{24}$/);
  });
```
Run: `rtk vitest run api/og-cache/__tests__/_ogCacheLogic.test.ts` → FAIL(tour分岐未実装)

`api/og-cache/_ogCacheLogic.ts` を修正。import に追加:
```ts
import { buildHousingerOgCardUrl } from '../../src/lib/ogpHousingerCard.js';
import { buildTourInviteOgCardUrl } from '../../src/lib/ogpTourInviteCard.js';
```
`buildInternalOgUrl` 内、`housinger` 分岐の直後に追加:
```ts
  if (meta.type === 'housinger') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildHousingerOgCardUrl(origin, {
      name: meta.name ?? '',
      avatarUrl: meta.avatarUrl ?? null,
      imageUrls: meta.imageUrls ?? [],
    }, cronSecret);
  }
  if (meta.type === 'tour') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildTourInviteOgCardUrl(origin, { name: meta.name ?? '' }, cronSecret);
  }
```

Run: `rtk vitest run api/og-cache/__tests__/_ogCacheLogic.test.ts` → PASS(既存分含め全件)

- [ ] **Step 8: 実機確認**

`npm run dev` で `http://localhost:5173/api/og?type=tour&ver=1&name=テスト&sig=...`(有効な署名付きURLは `buildTourInviteOgCardUrl` をローカルで一度呼んで生成するか、実際の招待発行フローが完成する Task 6 の後にまとめて確認してよい)。honeyグラデーション文字+背景画像+ホスト名前が正しく表示されることを目視確認。

- [ ] **Step 9: Commit**

```bash
git add src/assets/og/tour-invite-bg.jpg scripts/generate-tour-invite-bg.mjs api/og/_tourInviteBg.generated.ts src/lib/ogpTourInviteCard.ts api/og/_tourInviteCard.ts api/og/index.ts api/og-cache/_ogCacheLogic.ts api/og-cache/__tests__/_ogCacheLogic.test.ts src/lib/__tests__/ogpTourInviteCard.test.ts
git commit -m "feat(housing): ツアー招待OGPカード新規作成(honeyグラデーション+背景画像・最初から安全キャッシュ経路)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: ツアー招待OGPカード — ホスト名前入力UI+HTMLページハンドラ+ルーティング

**Files:**
- Modify: `src/components/housing/tour/TourInvitePanel.tsx`
- Modify: `src/components/housing/pages/TourNavPage.tsx`
- Modify: `src/lib/housingApiClient.ts`(`createSharedTour` にtourName追加)
- Modify: `api/housing/_sharedTourCreateLogic.ts`
- Modify: `api/housing/_createSharedTourHandler.ts`
- Create: `api/share/_tourInvitePageHandler.ts`
- Modify: `api/share/index.ts`(type=tour 振り分け)
- Modify: `vercel.json`(rewrite追加)
- Modify: `src/locales/{ja,en,ko,zh}.json`(招待名入力欄のラベル/placeholder)
- Test: `api/housing/__tests__/_sharedTourCreateLogic.test.ts`(追記)

**Interfaces:**
- Consumes: Task 2 の `SHARED_TOUR_NAME_MAX_LENGTH`。Task 5 の `og_image_meta` type='tour' 経路(Task 4 実装済み)。
- Produces: `createSharedTour(snapshot, tourName?): Promise<CreateSharedTourResponse>`(`housingApiClient.ts`)。`shared_tours/{token}.tourName`(Firestore、Task 2 で型追加済み)。

- [ ] **Step 1: 失敗するテストを書く**

`api/housing/__tests__/_sharedTourCreateLogic.test.ts` に追記(既存 `parseCreateSharedTourRequest` のdescribeブロック内、末尾):
```ts
  it('tourNameが文字列ならtrimしてそのまま返す', () => {
    const result = parseCreateSharedTourRequest({ snapshot: [{ id: 'a' }], tourName: '  休日ハウジング巡り  ' });
    expect('ok' in result && result.ok).toBe(true);
    if ('tourName' in result) expect(result.tourName).toBe('休日ハウジング巡り');
  });

  it('tourNameが上限文字数を超えたら切り詰める', () => {
    const long = 'あ'.repeat(SHARED_TOUR_NAME_MAX_LENGTH + 20);
    const result = parseCreateSharedTourRequest({ snapshot: [{ id: 'a' }], tourName: long });
    expect('ok' in result && result.ok).toBe(true);
    if ('tourName' in result) expect(result.tourName?.length).toBe(SHARED_TOUR_NAME_MAX_LENGTH);
  });

  it('tourName未指定なら空文字になる', () => {
    const result = parseCreateSharedTourRequest({ snapshot: [{ id: 'a' }] });
    expect('ok' in result && result.ok).toBe(true);
    if ('tourName' in result) expect(result.tourName).toBe('');
  });
```
ファイル先頭の import に `SHARED_TOUR_NAME_MAX_LENGTH` を追加:
```ts
import { parseCreateSharedTourRequest, resolveHostQuota, SHARED_TOUR_MAX_LIVE_PER_HOST } from '../_sharedTourCreateLogic';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../../src/types/sharedTour';
```

- [ ] **Step 2: 失敗確認**

Run: `rtk vitest run api/housing/__tests__/_sharedTourCreateLogic.test.ts`
Expected: FAIL(`tourName` 未実装のため `result.tourName` が undefined)

- [ ] **Step 3: 実装**

`api/housing/_sharedTourCreateLogic.ts` の `ParseCreateSharedTourResult` 型と関数を修正:
```ts
import { SHARED_TOUR_MAX_STOPS, SHARED_TOUR_NAME_MAX_LENGTH, type TourSnapshot } from '../../src/types/sharedTour.js';
import { snapshotContainsHiddenAddress } from '../../src/lib/sharedTour/snapshot.js';

// ... (SHARED_TOUR_MAX_BYTES 等の既存定数は無変更) ...

/** 招待発行リクエストの検証結果。 */
export type ParseCreateSharedTourResult =
  | { ok: true; snapshot: TourSnapshot[]; containsHiddenAddress: boolean; tourName: string }
  | { ok: false; reason: 'empty' | 'too_many' | 'bad_shape' | 'too_large' };

export function parseCreateSharedTourRequest(body: unknown): ParseCreateSharedTourResult {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { snapshot?: unknown }).snapshot)) {
    return { ok: false, reason: 'bad_shape' };
  }

  const snapshot = (body as { snapshot: unknown[] }).snapshot;
  const rawTourName = (body as { tourName?: unknown }).tourName;
  const tourName = typeof rawTourName === 'string'
    ? rawTourName.trim().slice(0, SHARED_TOUR_NAME_MAX_LENGTH)
    : '';

  if (snapshot.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (snapshot.length > SHARED_TOUR_MAX_STOPS) {
    return { ok: false, reason: 'too_many' };
  }

  const isValidElement = snapshot.every(
    (item) => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string',
  );
  if (!isValidElement) {
    return { ok: false, reason: 'bad_shape' };
  }

  if (JSON.stringify(snapshot).length > SHARED_TOUR_MAX_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const typedSnapshot = snapshot as TourSnapshot[];
  return {
    ok: true,
    snapshot: typedSnapshot,
    containsHiddenAddress: snapshotContainsHiddenAddress(typedSnapshot),
    tourName,
  };
}
```

`api/housing/_createSharedTourHandler.ts` の書き込みブロックに `tourName` を追加(既存 `batch.set(tourRef, {...})` の中):
```ts
    batch.set(tourRef, {
      tourToken,
      hostUid,
      snapshot: parsed.snapshot,
      containsHiddenAddress: parsed.containsHiddenAddress,
      tourName: parsed.tourName,
      createdAt: now,
    });
```

`src/lib/housingApiClient.ts` の `createSharedTour` を修正:
```ts
export async function createSharedTour(snapshot: TourSnapshot[], tourName?: string): Promise<CreateSharedTourResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=create-shared-tour`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ snapshot, tourName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `create-shared-tour failed: ${res.status}`);
  }
  return (await res.json()) as CreateSharedTourResponse;
}
```

`src/components/housing/tour/TourInvitePanel.tsx` に入力欄を追加(未発行状態のブロックのみ変更):
```tsx
import { useTranslation } from 'react-i18next';
import { UserPlus, Copy } from 'lucide-react';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../../types/sharedTour';

export interface TourInvitePanelProps {
  tourToken: string | null;
  creating?: boolean;
  /** 招待発行前にホストが書ける短い文章(OGPカードにも使う)。 */
  tourName: string;
  onTourNameChange: (value: string) => void;
  onInvite: () => void;
  onCopy: () => void;
}

export const TourInvitePanel: React.FC<TourInvitePanelProps> = ({
  tourToken,
  creating = false,
  tourName,
  onTourNameChange,
  onInvite,
  onCopy,
}) => {
  const { t } = useTranslation();

  if (tourToken === null) {
    return (
      <div className="housing-tour-invite">
        <input
          type="text"
          className="housing-input"
          value={tourName}
          onChange={(e) => onTourNameChange(e.target.value)}
          placeholder={t('housing.tour.nav.invite.name_placeholder')}
          maxLength={SHARED_TOUR_NAME_MAX_LENGTH}
          aria-label={t('housing.tour.nav.invite.name_label')}
        />
        <button
          type="button"
          className="housing-tour-invite-btn"
          onClick={onInvite}
          disabled={creating}
          aria-busy={creating}
        >
          <UserPlus size={14} aria-hidden="true" />
          {t(creating ? 'housing.tour.nav.invite.creating' : 'housing.tour.nav.invite.button')}
        </button>
        <p className="housing-tour-invite-hint">{t('housing.tour.nav.invite.hint')}</p>
      </div>
    );
  }

  const inviteUrl = `${location.origin}/housing/tour/${tourToken}`;

  return (
    <div className="housing-tour-invite">
      <span className="housing-tour-invite-label">{t('housing.tour.nav.invite.link_label')}</span>
      <span className="housing-tour-invite-link" title={inviteUrl}>
        {inviteUrl}
      </span>
      <div className="housing-tour-invite-actions">
        <button type="button" className="housing-tour-invite-copy" onClick={onCopy}>
          <Copy size={14} aria-hidden="true" />
          {t('housing.tour.nav.invite.copy')}
        </button>
      </div>
    </div>
  );
};
```
スタイルは既存の `.housing-input` クラス([src/styles/housing.css:1706-1724](../../../src/styles/housing.css#L1706-L1724)、padding/border-radius/background/border/focus honeyボーダーまで定義済み)をそのまま再利用するため新規トークンは不要。`.housing-tour-invite` は既に `display:flex; flex-direction:column; gap:8px`([src/styles/housing.css:7484-7496](../../../src/styles/housing.css#L7484-L7496))で縦積みの余白を統一管理しているため、入力欄側で個別マージンを足す必要も無い([[feedback_housing_whitespace_rhythm]] 準拠)。housing.cssへの新規CSS追加は無し。

`src/components/housing/pages/TourNavPage.tsx` の修正: `tourToken` state の近くに追加、`doCreate` にtourNameを渡す、JSXの `TourInvitePanel` にpropsを渡す:
```tsx
  const [tourToken, setTourToken] = useState<string | null>(null);
  const [tourName, setTourName] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
```
```tsx
  const doCreate = useCallback(
    async (snaps: TourSnapshot[]) => {
      setCreatingInvite(true);
      try {
        const { tourToken: token } = await createSharedTour(snaps, tourName);
        setTourToken(token);
        localStorage.setItem('lopo_shared_tour_token', token);
      } catch {
        showToast(t('housing.tour.nav.invite.error'), 'error');
      } finally {
        setCreatingInvite(false);
      }
    },
    [t, tourName],
  );
```
```tsx
        <TourInvitePanel
          tourToken={tourToken}
          creating={creatingInvite}
          tourName={tourName}
          onTourNameChange={setTourName}
          onInvite={onInvite}
          onCopy={onCopyInvite}
        />
```

`api/share/_tourInvitePageHandler.ts`(新規・`_housingerPageHandler.ts` と同型):
```ts
/**
 * ツアー招待ページ (/housing/tour/:tourToken) 動的OGPハンドラー
 * _housingerPageHandler.ts と同じ仕組み(クローラーにはOGPメタ入りHTML、通常ユーザーには
 * 同じHTML内の <div id="root"> 経由で React Router が SPA を描画する)。vercel.json の
 * rewrite で /housing/tour/:tourToken → /api/share?type=tour&token=:tourToken に内部委譲される。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { buildTourInviteOgCardParams } from '../../src/lib/ogpTourInviteCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../src/types/sharedTour.js';

const DEFAULT_OG_TITLE = 'LoPo Housing Tour';
const DEFAULT_OG_DESCRIPTION = 'FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。';
const DEFAULT_OG_IMAGE = '/api/og?type=tour';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req: any, res: any) {
  const rawToken = (req.query?.token as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  const ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;

  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  try {
    if (rawToken) {
      initAdmin();
      const db = getAdminFirestore();
      const snap = await db.collection('shared_tours').doc(rawToken).get();
      if (snap.exists) {
        const data = snap.data()!;
        const tourName: string = typeof data.tourName === 'string' ? data.tourName.slice(0, SHARED_TOUR_NAME_MAX_LENGTH) : '';

        ogTitle = tourName ? `${tourName} | LoPo Housing Tour` : DEFAULT_OG_TITLE;

        try {
          const params = buildTourInviteOgCardParams({ name: tourName });
          const hash = computeOgCardImageHash(params);
          await db.collection('og_image_meta').doc(hash).set({
            type: 'tour',
            name: tourName,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
          });
          ogImageUrl = `${origin}/og/${hash}.png`;
        } catch (err) {
          console.error('Tour invite OG card hash/meta error:', err);
        }
      }
    }
  } catch (err) {
    console.error('Tour invite page data fetch error:', err);
  }

  const canonicalUrl = rawToken ? `${origin}/housing/tour/${encodeURIComponent(rawToken)}` : origin;
  if (!/^https?:\/\//.test(ogImageUrl)) ogImageUrl = `${origin}${ogImageUrl}`;

  try {
    const indexRes = await fetch(`${origin}/index.html`);
    if (indexRes.ok) {
      let html = await indexRes.text();
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
      return res.send(html);
    }
  } catch (err) {
    console.error('Tour invite page index.html fetch error:', err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImageUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root"></div>
<p style="text-align:center;margin-top:40vh;color:#888">読み込み中...</p>
</body>
</html>`);
}
```

`api/share/index.ts` に振り分け追加(既存 `type === 'housinger'` 分岐の直後):
```ts
    if (req.query?.type === 'housinger') {
        return housingerPageHandler(req, res);
    }
    if (req.query?.type === 'tour') {
        return tourInvitePageHandler(req, res);
    }
```
冒頭 import に追加:
```ts
import tourInvitePageHandler from './_tourInvitePageHandler.js';
```

`vercel.json` の rewrites に追加(既存 `/housing/housinger/:uid` の直後、catch-allより前):
```json
    { "source": "/housing/housinger/:uid", "destination": "/api/share?type=housinger&uid=:uid" },
    { "source": "/housing/tour/:tourToken", "destination": "/api/share?type=tour&token=:tourToken" },
```

ロケール追加(`housing.tour.nav.invite` ブロック、既存 `button` キーの近く。4ファイルとも追加):

`src/locales/ja.json`:
```
"name_label": "ツアー名(任意)",
"name_placeholder": "例: 休日ハウジング巡り",
```
`src/locales/en.json`:
```
"name_label": "Tour name (optional)",
"name_placeholder": "e.g. Weekend housing tour",
```
`src/locales/ko.json`:
```
"name_label": "투어 이름(선택)",
"name_placeholder": "예: 주말 하우징 투어",
```
`src/locales/zh.json`:
```
"name_label": "导览名称（可选）",
"name_placeholder": "例如：周末住宅导览",
```

- [ ] **Step 4: パス確認**

Run: `rtk vitest run api/housing/__tests__/_sharedTourCreateLogic.test.ts`
Expected: PASS(既存+新規3テスト)

- [ ] **Step 5: 既存回帰確認**

Run: `rtk vitest run api/housing src/components/housing/tour src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: `TourInvitePanel` の props 追加(`tourName`/`onTourNameChange` 必須化)で既存テストが型エラー/レンダー崩れを起こす場合、呼び出し箇所に最小限のprops追加で追従修正する。

- [ ] **Step 6: フルビルド+実機確認**

Run: `rtk npm run build`(型エラー0件を確認・特に `api/share/index.ts` の `.js` import漏れが無いか)
`npm run dev` でツアーを作成 → 招待名を入力して「みんなを招待」 → 発行されたURLを新しいタブ(未ログイン)で開き、通常どおり同期表示されることを確認。`curl -sI http://localhost:5173/housing/tour/<token>` で `og:image` に `/og/<hash>.png` 形式のURLが入っていることを確認(直接 `/api/og?type=tour...` になっていないこと)。

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/tour/TourInvitePanel.tsx src/components/housing/pages/TourNavPage.tsx src/lib/housingApiClient.ts api/housing/_sharedTourCreateLogic.ts api/housing/_createSharedTourHandler.ts api/share/_tourInvitePageHandler.ts api/share/index.ts vercel.json src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json api/housing/__tests__/_sharedTourCreateLogic.test.ts
git commit -m "feat(housing): ツアー招待にホスト名前入力+専用OGPページハンドラ+ルーティングを追加

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 全タスク完了後: フルゲート

- [ ] Run: `rtk npm run build`(exit 0)
- [ ] Run: `rtk vitest run`(既知の EphemeralAddPanel 7件以外は全PASS)
- [ ] ユーザーの実機最終確認(共同編集2タブ / 共有ツアー参加+満員UI / ハウジンガーカードのog:image確認 / ツアー招待カードのog:image確認)
- [ ] push はユーザー承認後(デプロイはバッチ方針)

## Self-Review 済みメモ

- spec §2(共同編集)→Task1、§3(共有ツアー上限)→Task2+3、§4(ハウジンガー安全化)→Task4、§6(ツアー招待カード)→Task5+6 に対応。spec §1・§5(Cloudflare運用)は別ドキュメント(`2026-07-18-cost-hardening-ops-runbook.md`)。
- 型整合: `computeOgCardImageHash`(Task4定義)を Task6 の `_tourInvitePageHandler.ts` でも同一シグネチャで消費。`buildInternalOgUrl`(Task4で page/housinger の2分岐を定義)に Task5 Step7 で `type='tour'` 分岐を追加する(依存順: Task5 が `src/lib/ogpTourInviteCard.ts` を新規作成するため、そのモジュールへの import は Task4ではなく Task5 側に置く)。`SHARED_TOUR_NAME_MAX_LENGTH`(Task2定義)をTask5(カードのname切り詰め)とTask6(入力欄maxLength・トリム)で共通利用。
- 既知リスク: Task3で `useJoinTour.ts` を大きく書き換えるため、既存の `JoinTourPage.test.tsx` 等のモックが `joinSharedTour` 呼び出しを考慮していない場合はテスト追従が必要(Step 5に明記済み)。
