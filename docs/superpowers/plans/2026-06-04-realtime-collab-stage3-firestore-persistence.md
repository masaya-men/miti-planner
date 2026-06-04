# リアルタイム共同編集 段取り③ (Firestore恒久保存) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集の `timelineMitigations` を Firestore に恒久保存し、全員退室後・リロード後・オーナー不在でも内容が残る保存層を作る。

**Architecture:** DO(`Room extends YServer`)に `onLoad`(seed) / `onSave`(書き戻し) / `onClose`(最終flush) を実装。DO は Firebase 資格情報を持たず、Vercel の受付係 API(`/api/collab/load`・`/api/collab/save`)に共有シークレットで委譲し、既存の保存ロジック(version楽観ロック・墓標)を再利用する(案B)。削除されたプランは復活させない(墓標ガード)。seed 失敗時は書き戻さない(破壊保存ガード)。

**Tech Stack:** Cloudflare Durable Objects + y-partyserver(YServer) + Yjs / Vercel Node Functions + firebase-admin / vitest(@cloudflare/vitest-pool-workers と root vitest の2系統)

**設計書:** [../specs/2026-06-04-realtime-collab-stage3-firestore-persistence-design.md](../specs/2026-06-04-realtime-collab-stage3-firestore-persistence-design.md)

---

## 確定済みの一次情報 (実装前提・調査済)

- `onLoad(): Promise<Y.Doc|void>` は `onStart()` で1回呼ばれ、返り値の state が `this.document` に適用される ([y-partyserver dist/server/index.js:144-148](../../../workers/collab/node_modules/y-partyserver/dist/server/index.js#L144))。
- `onSave(): Promise<void>` は `this.document` の `update` イベントの **debounce(既定 2s/maxWait 10s) でのみ** 発火。**`onClose` では保存しない** ([同 index.js:183-202, 325](../../../workers/collab/node_modules/y-partyserver/dist/server/index.js#L183))。→ 最終保存は `onClose` 自前 flush で補う。
- `static callbackOptions = { debounceWait?, debounceMaxWait?, timeout? }` で保存頻度を制御。
- DO 内で部屋名(=plan ID)は `this.name` ([partyserver dist/index.d.ts:260](../../../workers/collab/node_modules/partyserver/dist/index.d.ts#L260))。`Server extends DurableObject<Env>` なので `this.env` 利用可。
- 本番アプリオリジン = `https://lopoly.app` ([vite.config.ts:14](../../../vite.config.ts#L14))。
- Firestore プラン = `plans` コレクション(`COLLECTIONS.PLANS='plans'` [src/types/firebase.ts:189](../../../src/types/firebase.ts#L189))。削除=墓標(`deleted:true`+`version` increment, [src/lib/planService.ts:333](../../../src/lib/planService.ts#L333))。
- `AppliedMitigation` フィールド: `id/mitigationId/time/duration/ownerId/targetId?/linkedMitigationId?/autoHidden?` ([src/types/index.ts:82-91](../../../src/types/index.ts#L82-L91))。client 変換は [src/lib/collab/yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts)。
- Vercel の firebase-admin 初期化パターン(env 変数 `FIREBASE_PROJECT_ID`/`FIREBASE_PRIVATE_KEY`/`FIREBASE_CLIENT_EMAIL`)は [api/cron/cleanup-og-images/index.ts](../../../api/cron/cleanup-og-images/index.ts) を踏襲(共有 admin ヘルパーは未整備、各 handler が `initAdmin()` を持つ)。
- Worker テストは `@cloudflare/vitest-pool-workers`(`cloudflare:test` の `SELF` / `fetchMock`)、root のコード(api/ 等)は root vitest(`vmThreads`)。

## ファイル構成 (作成/変更)

**Worker (`workers/collab/`):**
- 作成: `src/yjsMitigations.ts` — AppliedMitigation ⇄ Y.Doc 変換(client 版のミラー)。
- 変更: `src/server.ts` — `Room` に `onLoad`/`onSave`/`onClose`/`callbackOptions` 追加。
- 変更: `src/index.ts` — `Env` に `APP_API_BASE`/`COLLAB_SHARED_SECRET` を追加。
- 変更: `wrangler.jsonc` — `vars.APP_API_BASE` 追加(secret は別途 `wrangler secret`)。
- 作成: `src/yjsMitigations.test.ts` / 変更: `src/server.test.ts`。

**Vercel (`api/collab/`):**
- 作成: `api/collab/_logic.ts` — 純粋ロジック(シークレット検証 / load 判定 / save 判定)。
- 作成: `api/collab/load.ts` — GET。`plans/{id}` を読み墓標判定して mitigations を返す。
- 作成: `api/collab/save.ts` — POST。墓標ガード + `data.timelineMitigations` 部分更新 + `version`+1。
- 作成: `src/lib/__tests__/collabLogic.test.ts`(root vitest で `_logic.ts` を検証。※ api/ 配下に test を置くと Vercel function 化される懸念があるため test は src 配下)。

**Client (`src/lib/collab/`):**
- 変更: `src/lib/collab/collabProvider.ts` — クライアント seed ロジック撤去(seed はサーバー onLoad が担う)。

---

## Task 1: Vercel 受付係の純粋ロジック (`api/collab/_logic.ts`)

DB も admin も使わない純粋関数だけ先に TDD で固める(後続の handler が薄く wrap する)。

**Files:**
- Create: `api/collab/_logic.ts`
- Test: `src/lib/__tests__/collabLogic.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/lib/__tests__/collabLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  isCollabAuthorized,
  decideLoad,
  decideSave,
  COLLAB_SECRET_HEADER,
  type MitigationRecord,
} from '../../../api/collab/_logic';

const m = (id: string): MitigationRecord => ({
  id, mitigationId: 'rampart', time: 10, duration: 20, ownerId: 'MT',
});

describe('isCollabAuthorized', () => {
  it('ヘッダがシークレットと一致すれば true', () => {
    const req = new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 's3cr3t' } });
    expect(isCollabAuthorized(req, 's3cr3t')).toBe(true);
  });
  it('不一致・欠落・空シークレットは false', () => {
    expect(isCollabAuthorized(new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 'bad' } }), 's3cr3t')).toBe(false);
    expect(isCollabAuthorized(new Request('https://x'), 's3cr3t')).toBe(false);
    expect(isCollabAuthorized(new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 'x' } }), '')).toBe(false);
  });
});

describe('decideLoad', () => {
  it('存在しない → deleted 扱い', () => {
    expect(decideLoad(null)).toEqual({ deleted: true });
  });
  it('墓標 → deleted', () => {
    expect(decideLoad({ deleted: true, data: { timelineMitigations: [m('a')] } })).toEqual({ deleted: true });
  });
  it('live → mitigations を返す(欠落は空配列)', () => {
    expect(decideLoad({ data: { timelineMitigations: [m('a')] } })).toEqual({ mitigations: [m('a')] });
    expect(decideLoad({ data: {} })).toEqual({ mitigations: [] });
  });
});

describe('decideSave', () => {
  it('存在しない → not-found でスキップ', () => {
    expect(decideSave(null)).toEqual({ skip: 'not-found' });
  });
  it('墓標 → deleted でスキップ(削除が勝つ)', () => {
    expect(decideSave({ deleted: true, version: 3 })).toEqual({ skip: 'deleted' });
  });
  it('live → ok + 次 version', () => {
    expect(decideSave({ version: 3 })).toEqual({ ok: true, nextVersion: 4 });
    expect(decideSave({})).toEqual({ ok: true, nextVersion: 1 }); // version 欠落は 0 扱い
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: FAIL（`_logic.ts` が無く import エラー）

- [ ] **Step 3: 最小実装**

```typescript
// api/collab/_logic.ts
// 共同編集③: DO(受付係 client)↔Vercel(受付係 server)間の純粋ロジック。
// firebase-admin に依存しない(handler が wrap する)。テスト容易性のため分離。

export const COLLAB_SECRET_HEADER = 'x-collab-secret';

/** 1個の軽減配置(Firestore data.timelineMitigations の要素 = AppliedMitigation 相当)。 */
export interface MitigationRecord {
  id: string;
  mitigationId: string;
  time: number;
  duration: number;
  ownerId: string;
  targetId?: string;
  linkedMitigationId?: string;
  autoHidden?: boolean;
}

/** DO からの共有シークレットを検証。空シークレットは常に拒否(誤設定の素通り防止)。 */
export function isCollabAuthorized(req: Request, secret: string): boolean {
  if (!secret) return false;
  return req.headers.get(COLLAB_SECRET_HEADER) === secret;
}

export type LoadResult = { deleted: true } | { mitigations: MitigationRecord[] };

/** Firestore プラン doc(または null=不存在)から seed 用 LoadResult を決める。 */
export function decideLoad(plan: { deleted?: boolean; data?: { timelineMitigations?: MitigationRecord[] } } | null): LoadResult {
  if (!plan || plan.deleted === true) return { deleted: true };
  return { mitigations: plan.data?.timelineMitigations ?? [] };
}

export type SaveDecision = { skip: 'deleted' | 'not-found' } | { ok: true; nextVersion: number };

/** 現在の Firestore プラン doc から保存可否を決める。墓標/不存在はスキップ(削除が勝つ)。 */
export function decideSave(plan: { deleted?: boolean; version?: number } | null): SaveDecision {
  if (!plan) return { skip: 'not-found' };
  if (plan.deleted === true) return { skip: 'deleted' };
  return { ok: true, nextVersion: (plan.version ?? 0) + 1 };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add api/collab/_logic.ts src/lib/__tests__/collabLogic.test.ts
rtk git commit -m "feat(collab): 段取り③ 受付係の純粋ロジック(シークレット検証/load・save判定)"
```

---

## Task 2: Vercel `GET /api/collab/load`

`_logic` を使い、firebase-admin で `plans/{id}` を読んで返す薄い handler。

**Files:**
- Create: `api/collab/load.ts`

- [ ] **Step 1: 実装(handler は薄く・ロジックは Task1 で検証済)**

```typescript
// api/collab/load.ts
// 共同編集③ seed: DO の onLoad がここを叩き、現在の軽減配置を取得する。
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isCollabAuthorized, decideLoad } from './_logic';

function initAdmin() {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // VercelRequest は Web Request ではないため、_logic 用に最小の Request 形へ橋渡し。
  const headerReq = new Request('https://collab.internal', {
    headers: { 'x-collab-secret': (req.headers['x-collab-secret'] as string) ?? '' },
  });
  if (!isCollabAuthorized(headerReq, process.env.COLLAB_SHARED_SECRET ?? '')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const planId = (req.query.planId as string) ?? '';
  if (!planId) return res.status(400).json({ error: 'planId required' });

  initAdmin();
  const snap = await getFirestore().collection('plans').doc(planId).get();
  const plan = snap.exists ? (snap.data() as any) : null;
  return res.status(200).json(decideLoad(plan));
}
```

- [ ] **Step 2: ビルド型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`（root。api/ が含まれる構成か確認。含まれない場合は対象 tsconfig を使う）
Expected: PASS（型エラーなし）

- [ ] **Step 3: コミット**

```bash
rtk git add api/collab/load.ts
rtk git commit -m "feat(collab): 段取り③ GET /api/collab/load (seed用・墓標判定込み)"
```

---

## Task 3: Vercel `POST /api/collab/save`

墓標ガード + `data.timelineMitigations` の部分更新 + `version`+1。

**Files:**
- Create: `api/collab/save.ts`

- [ ] **Step 1: 実装**

```typescript
// api/collab/save.ts
// 共同編集③ 書き戻し: DO の onSave がここを叩き、軽減配置を Firestore に保存する。
// 墓標ガード: deleted なら書かない(削除が勝つ)。data.timelineMitigations だけ部分更新。
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { isCollabAuthorized, decideSave, type MitigationRecord } from './_logic';

function initAdmin() {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headerReq = new Request('https://collab.internal', {
    headers: { 'x-collab-secret': (req.headers['x-collab-secret'] as string) ?? '' },
  });
  if (!isCollabAuthorized(headerReq, process.env.COLLAB_SHARED_SECRET ?? '')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { planId, mitigations } = (req.body ?? {}) as { planId?: string; mitigations?: MitigationRecord[] };
  if (!planId || !Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'planId and mitigations[] required' });
  }

  initAdmin();
  const db = getFirestore();
  const ref = db.collection('plans').doc(planId);

  // 読んでから書く(墓標ガード + version インクリメント)。トランザクションで競合を吸収。
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const decision = decideSave(snap.exists ? (snap.data() as any) : null);
    if ('skip' in decision) return decision;
    tx.update(ref, {
      'data.timelineMitigations': mitigations,
      version: decision.nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return decision;
  });

  if ('skip' in result) return res.status(200).json({ skipped: result.skip });
  return res.status(200).json({ ok: true, version: result.nextVersion });
}
```

- [ ] **Step 2: ビルド型チェック**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
rtk git add api/collab/save.ts
rtk git commit -m "feat(collab): 段取り③ POST /api/collab/save (墓標ガード+timelineMitigations部分更新+version+1)"
```

---

## Task 4: Worker の Y.Doc 変換ミラー (`workers/collab/src/yjsMitigations.ts`)

client 版([src/lib/collab/yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts))のミラー。フィールドが一致していないと seed と編集で構造がズレるため、フィールド一覧を検証するテストを付ける。

**Files:**
- Create: `workers/collab/src/yjsMitigations.ts`
- Test: `workers/collab/src/yjsMitigations.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// workers/collab/src/yjsMitigations.test.ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { buildSeedDoc, readMitigations, type MitigationRecord, MITIGATIONS_KEY } from "./yjsMitigations";

const m = (id: string, time = 10): MitigationRecord => ({
  id, mitigationId: "rampart", time, duration: 20, ownerId: "MT",
});

describe("yjsMitigations (worker mirror)", () => {
  it("buildSeedDoc → readMitigations で往復一致", () => {
    const doc = buildSeedDoc([m("a", 5), m("b", 30)]);
    expect(readMitigations(doc)).toEqual([m("a", 5), m("b", 30)]);
  });

  it("任意フィールドは値があるときだけ載る", () => {
    const full: MitigationRecord = { ...m("c"), targetId: "ST", linkedMitigationId: "x", autoHidden: true };
    const doc = buildSeedDoc([full]);
    expect(readMitigations(doc)[0]).toEqual(full);
  });

  it("client 版と同じトップレベルキー名を使う", () => {
    expect(MITIGATIONS_KEY).toBe("timelineMitigations");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd workers/collab && npx vitest run src/yjsMitigations.test.ts`（PowerShell では `Set-Location workers/collab; npx vitest run src/yjsMitigations.test.ts`）
Expected: FAIL（`yjsMitigations.ts` 未作成）

- [ ] **Step 3: 最小実装**

```typescript
// workers/collab/src/yjsMitigations.ts
// client 版 src/lib/collab/yjsMitigations.ts のミラー(別パッケージのため複製)。
// ⚠ AppliedMitigation のフィールドを変更したら両方を必ず揃える(yjsMitigations.test.ts が往復検証)。
import * as Y from "yjs";

export const MITIGATIONS_KEY = "timelineMitigations";

export interface MitigationRecord {
  id: string;
  mitigationId: string;
  time: number;
  duration: number;
  ownerId: string;
  targetId?: string;
  linkedMitigationId?: string;
  autoHidden?: boolean;
}

function appliedToYMap(m: MitigationRecord): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("id", m.id);
  y.set("mitigationId", m.mitigationId);
  y.set("time", m.time);
  y.set("duration", m.duration);
  y.set("ownerId", m.ownerId);
  if (m.targetId !== undefined) y.set("targetId", m.targetId);
  if (m.linkedMitigationId !== undefined) y.set("linkedMitigationId", m.linkedMitigationId);
  if (m.autoHidden !== undefined) y.set("autoHidden", m.autoHidden);
  return y;
}

function yMapToApplied(y: Y.Map<unknown>): MitigationRecord {
  const m: MitigationRecord = {
    id: y.get("id") as string,
    mitigationId: y.get("mitigationId") as string,
    time: y.get("time") as number,
    duration: y.get("duration") as number,
    ownerId: y.get("ownerId") as string,
  };
  if (y.has("targetId")) m.targetId = y.get("targetId") as string;
  if (y.has("linkedMitigationId")) m.linkedMitigationId = y.get("linkedMitigationId") as string;
  if (y.has("autoHidden")) m.autoHidden = y.get("autoHidden") as boolean;
  return m;
}

/** seed 用: mitigations[] を載せた新しい Y.Doc を作る(onLoad の返り値)。 */
export function buildSeedDoc(mitigations: MitigationRecord[]): Y.Doc {
  const doc = new Y.Doc();
  const arr = doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY);
  doc.transact(() => {
    mitigations.forEach((m) => arr.push([appliedToYMap(m)]));
  });
  return doc;
}

/** 書き戻し用: Y.Doc から mitigations[] を読む(onSave で使用)。 */
export function readMitigations(doc: Y.Doc): MitigationRecord[] {
  return doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY).toArray().map(yMapToApplied);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd workers/collab && npx vitest run src/yjsMitigations.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add workers/collab/src/yjsMitigations.ts workers/collab/src/yjsMitigations.test.ts
rtk git commit -m "feat(collab): 段取り③ Worker側 Y.Doc変換ミラー(buildSeedDoc/readMitigations)"
```

---

## Task 5: Worker `Env` と wrangler 設定

DO が受付係 API を叩くための接続先と共有シークレットを env に追加。

**Files:**
- Modify: `workers/collab/src/index.ts`（Env 拡張）
- Modify: `workers/collab/wrangler.jsonc`（vars 追加）

- [ ] **Step 1: `Env` を拡張**

`workers/collab/src/index.ts` の `Env` を以下に変更:

```typescript
export interface Env {
  Room: DurableObjectNamespace;
  /** 受付係(Vercel)アプリのオリジン。例: https://lopoly.app */
  APP_API_BASE: string;
  /** DO↔Vercel のサーバー間共有シークレット(wrangler secret で投入)。 */
  COLLAB_SHARED_SECRET: string;
}
```

- [ ] **Step 2: `wrangler.jsonc` に vars 追加**

`workers/collab/wrangler.jsonc` の `migrations` の後ろに追記（末尾 `}` の前）:

```jsonc
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["Room"] }
  ],
  "vars": { "APP_API_BASE": "https://lopoly.app" }
```

> `COLLAB_SHARED_SECRET` は **コミットしない**。デプロイ時に `npx wrangler secret put COLLAB_SHARED_SECRET` で投入(Task 9)。テストは fetchMock で受付係を差し替えるためシークレット未設定で可。

- [ ] **Step 3: 型チェック**

Run: `cd workers/collab && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
rtk git add workers/collab/src/index.ts workers/collab/wrangler.jsonc
rtk git commit -m "feat(collab): 段取り③ Worker Env に APP_API_BASE/COLLAB_SHARED_SECRET 追加"
```

---

## Task 6: Worker `onLoad` (seed) + 破壊保存ガード状態

DO 起動時に受付係 `load` を叩き、Y.Doc を seed。墓標/不存在/障害時は seed せず保存も封じる。

**Files:**
- Modify: `workers/collab/src/server.ts`
- Test: `workers/collab/src/server.test.ts`（追記）

- [ ] **Step 1: 失敗するテストを書く（fetchMock で受付係をモック）**

```typescript
// workers/collab/src/server.test.ts に追記
import { SELF, fetchMock } from "cloudflare:test";
import { beforeAll, afterEach } from "vitest";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

// 受付係 load が live mitigations を返す部屋では、後入室クライアントが seed を受け取る。
it("onLoad: 受付係の mitigations で Y.Doc を seed する", async () => {
  fetchMock
    .get("https://lopoly.app")
    .intercept({ path: /\/api\/collab\/load\?planId=seed-room/, method: "GET" })
    .reply(200, { mitigations: [{ id: "a", mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" }] });

  const doc = new Y.Doc();
  const provider = new YProvider("lopo-collab.test", "seed-room", doc, {
    party: "room",
    connect: true,
    // テスト内では SELF への WebSocket を使う(host は pool が解決)。実装時に接続方法を確認。
  });
  await new Promise<void>((resolve) => provider.on("sync", (s: boolean) => s && resolve()));
  const arr = doc.getArray("timelineMitigations").toArray();
  expect(arr.length).toBe(1);
  provider.destroy();
});
```

> ⚠ **接続方法の注意**: cloudflare:test 内で `YProvider` を本物の WebSocket で繋ぐのが難しい場合、`onLoad` の seed ロジックは**サーバー内部メソッドの単体テスト**(後述の `seedDocFromApi` を export して直接呼ぶ)に切り替える。実装者は「Y.Doc が正しく seed されるか」を検証できればテスト形式は問わない。下の Step3 は内部メソッドを export 可能にしておく。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: FAIL（onLoad 未実装で seed されない / 既存テストは緑のまま）

- [ ] **Step 3: `onLoad` を実装**

`workers/collab/src/server.ts` を以下に変更（既存の `onRequest`/`count` は維持）:

```typescript
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { buildSeedDoc, type MitigationRecord } from "./yjsMitigations";

interface CollabEnv {
  APP_API_BASE: string;
  COLLAB_SHARED_SECRET: string;
}

export class Room extends YServer {
  static options = { hibernate: true };
  // 保存頻度(③ 設計): 編集が 5s 落ち着いたら保存 / 連続編集でも最大 15s ごと。
  static callbackOptions = { debounceWait: 5000, debounceMaxWait: 15000 };

  // 破壊保存ガード: seed が正常に完了した部屋だけ保存可。墓標/不存在/障害では false。
  #saveEnabled = false;

  private get collabEnv(): CollabEnv {
    return this.env as unknown as CollabEnv;
  }

  /** 受付係 load を叩いて seed 用 Y.Doc を作る。失敗/墓標/不存在なら null。 */
  async seedDocFromApi(): Promise<Y.Doc | null> {
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    try {
      const res = await fetch(
        `${APP_API_BASE}/api/collab/load?planId=${encodeURIComponent(this.name)}`,
        { headers: { "x-collab-secret": COLLAB_SHARED_SECRET } },
      );
      if (!res.ok) return null; // 障害 → seed せず・保存も封じたまま
      const body = (await res.json()) as { deleted?: boolean; mitigations?: MitigationRecord[] };
      if (body.deleted || !Array.isArray(body.mitigations)) return null; // 墓標/不正 → 保存封じ
      this.#saveEnabled = true; // 正常 seed できた部屋だけ保存解禁
      return buildSeedDoc(body.mitigations);
    } catch {
      return null;
    }
  }

  override async onLoad(): Promise<Y.Doc | void> {
    const doc = await this.seedDocFromApi();
    if (doc) return doc;
    // null のとき: seed しない(空 Y.Doc のまま)。#saveEnabled は false のままで破壊保存を防ぐ。
  }

  override onRequest(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      return Response.json({ count });
    }
    return new Response("Not Found", { status: 404 });
  }
}
```

- [ ] **Step 4: テストが通ることを確認 + 既存テスト緑**

Run: `cd workers/collab && npx vitest run`
Expected: PASS（新 seed テスト + 既存 3 テスト）。WebSocket 接続が難しければ Step1 の注記どおり `seedDocFromApi` 直接呼びテストへ切替。

- [ ] **Step 5: コミット**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/server.test.ts
rtk git commit -m "feat(collab): 段取り③ DO onLoad(受付係loadでseed)+破壊保存ガード"
```

---

## Task 7: Worker `onSave`（書き戻し）+ 墓標応答で保存封じ

debounce で受付係 `save` を叩く。`skipped:'deleted'` を受けたら以後保存しない。

**Files:**
- Modify: `workers/collab/src/server.ts`
- Test: `workers/collab/src/server.test.ts`（追記）

- [ ] **Step 1: 失敗するテストを書く（`saveDocToApi` を直接検証）**

```typescript
// workers/collab/src/server.test.ts に追記
import { runInDurableObject, runDurableObjectAlarm } from "cloudflare:test"; // 直接DO検証が要るとき
// ↑ 利用可否は実装時に確認。難しければ saveDocToApi のロジックを純粋関数に切り出し root vitest で検証。

it("onSave: live なら受付係 save に mitigations を POST する", async () => {
  let captured: any = null;
  fetchMock
    .get("https://lopoly.app")
    .intercept({ path: "/api/collab/save", method: "POST" })
    .reply(200, (opts) => { captured = JSON.parse(opts.body as string); return { ok: true, version: 2 }; });

  // Room インスタンスに seed 済み doc を与え saveDocToApi() を呼ぶ(実装で公開する内部メソッド)。
  // 具体の DO 取得方法は実装時に runInDurableObject 等で確定。
  // 期待: captured.planId と captured.mitigations[].id === "a"
  expect(captured?.mitigations?.[0]?.id).toBe("a");
});
```

> ⚠ DO の内部メソッドを cloudflare pool で直接呼ぶのが難しい場合、**保存ボディ生成を純粋関数化**して root/worker どちらかで検証する: `buildSavePayload(doc, planId) => { planId, mitigations }`(`readMitigations` を使うだけ)。最低限「Y.Doc → 正しい save ボディ」「`skipped:'deleted'` で `#saveEnabled=false`」を検証できればよい。

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: FAIL（onSave 未実装）

- [ ] **Step 3: `onSave` を実装**（`server.ts` の `Room` に追記）

```typescript
  import { readMitigations } from "./yjsMitigations";
  // ↑ ファイル冒頭の import に readMitigations を追加する

  /** 現在の Y.Doc を受付係 save に POST。墓標応答なら以後保存を封じる。 */
  async saveDocToApi(): Promise<void> {
    if (!this.#saveEnabled) return; // 破壊保存ガード: seed 成功部屋のみ
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    const mitigations = readMitigations(this.document);
    try {
      const res = await fetch(`${APP_API_BASE}/api/collab/save`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-collab-secret": COLLAB_SHARED_SECRET },
        body: JSON.stringify({ planId: this.name, mitigations }),
      });
      if (res.ok) {
        const body = (await res.json()) as { skipped?: string };
        if (body.skipped === "deleted") this.#saveEnabled = false; // 削除が勝つ → 以後保存しない
      }
      // 5xx 等は次の debounce / onClose flush で再試行(ベストエフォート)。
    } catch {
      // ネットワーク障害も同様にベストエフォート。
    }
  }

  override async onSave(): Promise<void> {
    await this.saveDocToApi();
  }
```

> `this.document` は YServer が保持する Y.Doc。型は `WSSharedDoc extends Y.Doc` なので `readMitigations(this.document)` がそのまま使える。

- [ ] **Step 4: テストが通ることを確認 + 既存テスト緑**

Run: `cd workers/collab && npx vitest run`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/server.test.ts
rtk git commit -m "feat(collab): 段取り③ DO onSave(受付係saveへPOST)+墓標応答で保存封じ"
```

---

## Task 8: Worker `onClose` 最終 flush（最後の1人退室時に確実保存）

`onSave` は debounce のみ・退室では発火しないため、最後の接続が閉じたら明示保存する。

**Files:**
- Modify: `workers/collab/src/server.ts`
- Test: `workers/collab/src/server.test.ts`（追記）

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// workers/collab/src/server.test.ts に追記
it("onClose: 最後の1人が抜けたら save を1回叩く", async () => {
  let saveCalls = 0;
  fetchMock.get("https://lopoly.app")
    .intercept({ path: /\/api\/collab\/load\?planId=flush-room/, method: "GET" })
    .reply(200, { mitigations: [{ id: "a", mitigationId: "rampart", time: 1, duration: 2, ownerId: "MT" }] });
  fetchMock.get("https://lopoly.app")
    .intercept({ path: "/api/collab/save", method: "POST" })
    .reply(200, () => { saveCalls++; return { ok: true, version: 2 }; })
    .times(1);

  const ws = (await SELF.fetch("https://collab.test/parties/room/flush-room", { headers: { Upgrade: "websocket" } })).webSocket!;
  ws.accept();
  // seed 完了を待ってから閉じる(実装時に適切な待機にする)
  await new Promise((r) => setTimeout(r, 200));
  ws.close();
  await new Promise((r) => setTimeout(r, 200));
  expect(saveCalls).toBe(1);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: FAIL（onClose flush 未実装で saveCalls=0、または debounce 分の呼びとズレる）

- [ ] **Step 3: `onClose` を実装**（`Room` に追記）

```typescript
  override async onClose(
    connection: Parameters<YServer["onClose"]>[0],
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    // まず YServer 既定の awareness クリーンアップを実行。
    await super.onClose(connection, code, reason, wasClean);
    // 退室するこの接続を除いた残り在室が 0 = 最後の1人 → 明示 flush(最終保存)。
    const remaining = [...this.getConnections()].filter((c) => c !== connection).length;
    if (remaining === 0) {
      await this.saveDocToApi();
    }
  }
```

> ⚠ 実装時の要確認: `onClose` 時点で `getConnections()` に当該接続が残るか(残るなら filter で除外する本実装で正しい)。残らない場合は `remaining === 0` 判定をそのまま使う。実機/テストで挙動を確認し、コメントを更新すること。

- [ ] **Step 4: テストが通ることを確認 + 既存テスト緑**

Run: `cd workers/collab && npx vitest run`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/server.test.ts
rtk git commit -m "feat(collab): 段取り③ DO onClose 最終flush(最後の退室で確実保存)"
```

---

## Task 9: Client の seed ロジック撤去（seed はサーバーへ）

②-a のクライアント seed を外し、「部屋の状態 = Firestore 保存内容」を唯一の真実にする。

**Files:**
- Modify: `src/lib/collab/collabProvider.ts:127-141`
- Test: `src/lib/collab/__tests__/yjsMitigations.test.ts`（影響確認のみ。collabProvider 自体は本番結線検証で担保）

- [ ] **Step 1: `onSynced` から seed 分岐を撤去**

[src/lib/collab/collabProvider.ts:127-141](../../../src/lib/collab/collabProvider.ts#L127-L141) の `onSynced` を以下に変更（`yarr.length===0` のときローカル軽減を push する分岐を削除）:

```typescript
  // 初期同期完了後に入室処理。seed はサーバー(DO onLoad)が Firestore から行うため、
  // クライアントは「部屋の状態を store に反映」するだけ(自分のローカル軽減で seed しない)。
  let entered = false;
  const onSynced = (isSynced: boolean) => {
    if (!isSynced || entered) return;
    entered = true;
    useMitigationStore.getState().enterCollabMode(handlers);
    useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  };
  provider.on('sync', onSynced);
```

- [ ] **Step 2: 既存テストへの影響を確認**

Run: `npx vitest run src/lib/collab/`
Expected: PASS（`yjsMitigations.test.ts` は変換ロジックのみで影響なし。落ちる場合は seed 前提のアサーションを修正）

- [ ] **Step 3: 全体ビルド + ユニット（push 前必須 / memory feedback_vercel_tsc_strict）**

Run: `npm run build`（tsc -b 厳密）
Run: `npx vitest run`
Expected: PASS（既存 1人モードテスト全緑）。`usePlanStore` 系の vmThreads 汚染既知問題は単独実行で確認（②-a 前から既知・無関係）。

- [ ] **Step 4: コミット**

```bash
rtk git add src/lib/collab/collabProvider.ts
rtk git commit -m "refactor(collab): 段取り③ クライアントseed撤去(seedはサーバーonLoadが担う)"
```

---

## Task 10: デプロイ + シークレット投入 + 本番結線検証

**Files:** （コード変更なし。設定とデプロイ。）

- [ ] **Step 1: Vercel に共有シークレット環境変数を設定（ユーザー作業 or CLI）**

`COLLAB_SHARED_SECRET` を Vercel に **sensitive** で設定（memory `feedback_vercel_env_sensitive`）。同時に `FIREBASE_PROJECT_ID/PRIVATE_KEY/CLIENT_EMAIL` が既にあることを確認（既存 admin handler が使用済みなので通常 OK）。
値はランダム生成（例: `openssl rand -hex 32`）。**実値はコミット/ドキュメントに書かない**。

- [ ] **Step 2: Cloudflare Worker に同じシークレットを投入**

Run: `cd workers/collab && npx wrangler secret put COLLAB_SHARED_SECRET`（プロンプトに Step1 と同一値を貼る）

- [ ] **Step 3: Vercel デプロイ（main push で自動 / memory reference_vercel_git_autodeploy）+ Worker デプロイ**

Run: `cd workers/collab && npx wrangler deploy`
（Vercel 側は main への push で自動デプロイ。api/collab/* が本番に乗る）

- [ ] **Step 4: 本番結線検証（Claude が node 2クライアントで実施）**

`workers/collab/scripts/verify-yjs-sync.mjs` を参考に検証スクリプトを用意し、本番 `lopo-collab` 部屋へ実在の plan ID で接続:
1. クライアント1が軽減を add → クライアント2に反映 → **両者切断**。
2. しばらく後にクライアント3が同じ plan ID で接続 → **add した軽減が残っている**（onLoad seed が効いている）。
3. その plan を別途 Firestore で `deleted:true` にして再接続 → **seed されない/保存もされない**（墓標ガード）。
Expected: 1-3 すべて期待どおり。失敗時は `wrangler tail` でログ確認。

- [ ] **Step 5: ユーザーが2ブラウザで実機確認**

同じ plan ID(②-a と同様、UI 入口はまだ無いので Claude が手順提供)で2ブラウザ接続 → 編集 → 全閉じ → 再接続で残存を確認。**完成まで UI は出さない**（⑤ で入口実装）。

---

## Self-Review (この計画 vs 設計書)

- **§1 ゴール(恒久保存/退室後残存/オーナー不在seed/既存非破壊/削除が勝つ)** → Task2-3(save/load・墓標ガード)、Task6(onLoad seed)、Task7-8(onSave/flush)、Task9(serverseed化)。✅
- **§2 案B(Vercel委譲)・this.name・既存保存抑制維持** → Task2-3(Vercel API)、Task6-7(this.name で fetch)。既存抑制は [Layout.tsx:228](../../../src/components/Layout.tsx#L228) を変更しない(本計画で触れない=維持)。✅
- **§3 範囲=mitigations のみ・部分更新** → Task3 が `data.timelineMitigations` のみ update。✅
- **§4.3 破壊保存ガード** → Task6 `#saveEnabled`、Task7 で参照。✅
- **§4.4 client seed 撤去** → Task9。✅
- **§5 受付係2本+シークレット** → Task1-3、Task5(env)、Task10(secret)。✅
- **§4.2/§10 最終flush(onClose)** → Task8。✅
- **型整合**: `MitigationRecord`(Task1/Task4 同名同形)、`#saveEnabled`(Task6定義→Task7参照)、`saveDocToApi`/`seedDocFromApi`(命名一貫)。✅
- **プレースホルダ**: 各 step に具体コード/コマンドあり。テスト接続方式の難所は「純粋関数化フォールバック」を明示(TBD でなく代替手順)。✅

## 既知の要検証(実装中に確定する小リスク)

- cloudflare:test 内での `YProvider` 実 WebSocket 接続が難しい場合のテスト形式(各 Task の注記=純粋関数フォールバック)。
- hibernation 起床で `onStart`→`onLoad` 再実行時、生存接続の状態と Firestore seed が CRDT union される際、直前に remove した軽減が一時的に復活しうる(②-a 範囲の小エッジ。debounce+flush で Firestore を新鮮に保ち影響最小。②-c/Undo と後続で緩和)。
- `onClose` 時点の `getConnections()` に当該接続が含まれるか(Task8 Step3 の注記で実機確認)。
- `runInDurableObject`/DO 内部メソッド直接呼びの可否(workers pool バージョン依存)。
