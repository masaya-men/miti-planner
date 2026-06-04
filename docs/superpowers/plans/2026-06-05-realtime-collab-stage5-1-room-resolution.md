# リアルタイム共同編集 段取り⑤-1 (ルーム解決層) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `collabRooms/{roomToken}` を planId に解決する純ロジックを追加し、`/api/collab/load`・`/api/collab/save` が roomToken 経由でオーナーのプランを読み書きできるようにする(緊急停止ゲート付き)。既存の planId 直接経路は ②-a/③ 互換で残し、非破壊。

**Architecture:** 受付係(Vercel)の load/save に「roomToken を受け取ったら `collabRooms/{roomToken}` を読み、`resolveRoom` で planId・最大人数・失効を判定 → 解決後は③と同じ本体ロジック(墓標ガード・version+1)を実行」する分岐を足す。解決判定は firebase-admin 非依存の純関数 `_roomLogic.ts` に切り出し、③の `_logic.ts` と同じ流儀で root vitest で決定的にテストする。ワーカー・クライアント・ルーム発行 UI は触らない(⑤-2/⑤-3)。

**Tech Stack:** Vercel Node Functions + firebase-admin / vitest(root, vmThreads) / TypeScript(erasableSyntaxOnly・nodenext)

**設計書:** [../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md](../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md) (§2 トークン分離 / §5 人数・緊急停止 / §6 データモデル / §9 受付係の変更)

---

## ⑤ 全体の分解 (この計画は ⑤-1)

| 段 | 内容 | 状態 |
|---|---|---|
| **⑤-1** | **ルーム解決層(本計画)**: collabRooms 解決 + load/save の roomToken 対応 + 緊急停止ゲート。バックエンド純ロジックのみ・非破壊。 | この計画 |
| ⑤-2 | ルーム管理API(発行/失効/再発行・**オーナー認証経路を先に調査**) + ワーカーが roomToken 送信 + 接続時の満員拒否。 | 後続(別計画) |
| ⑤-3 | クライアントUI(オーナーパネル / ジョイナー一時ビュー / 注意モーダル+赤バナー / ログインゲート) + 実データ往復検証。 | 後続(別計画) |

---

## 確定済みの一次情報 (実装前提・調査済)

- ③ の受付係は `api/collab/load.ts`(GET・`?planId=`)/ `api/collab/save.ts`(POST・body `{planId, mitigations}`)。共有シークレット認証は `authorizeCollab(req.headers['x-collab-secret'])`([api/collab/_handlerShared.ts:39](../../../api/collab/_handlerShared.ts#L39))。
- 純判定ロジックは `api/collab/_logic.ts` に分離され、`decideLoad`/`decideSave`/`isCollabAuthorized` を export([api/collab/_logic.ts](../../../api/collab/_logic.ts))。テストは [src/lib/__tests__/collabLogic.test.ts](../../../src/lib/__tests__/collabLogic.test.ts) が `'../../../api/collab/_logic'` を import(テスト側 import は拡張子なし=bundler 解決)。
- 本体ハンドラ(load.ts/save.ts)は admin を叩くため**ユニットテストは持たず**、純ロジック側で網羅 + build で型担保(③ 同方針)。
- `api/` の相対 import は **`.js` 拡張子必須**(Vercel Node ESM・[memory `reference_vercel_api_esm_js_extension`])。`_logic.js`/`_handlerShared.js` がその例。
- DO の `fetchMitigations` は `body.mitigations` だけ読み他フィールドは無視([workers/collab/src/collabPersistence.ts:25](../../../workers/collab/src/collabPersistence.ts#L25)) → load レスポンスに `maxParticipants` を足しても③ワーカー非破壊。`postMitigations` は `body.skipped` が truthy なら `'skipped'` を返す([同:50](../../../workers/collab/src/collabPersistence.ts#L50))。
- TypeScript は `erasableSyntaxOnly` 有効 → enum / パラメータプロパティ禁止(interface・union・const は OK・[memory `reference_erasable_syntax_test_mocks`])。push 前は `npm run build` + `vitest run` 必須([memory `feedback_vercel_tsc_strict`])。

## ファイル構成 (作成/変更)

- 作成: `api/collab/_roomLogic.ts` — ルーム解決の純ロジック(`resolveRoom`/`clampMaxParticipants`/`isCollabDisabled`)。admin 非依存。
- 作成: `src/lib/__tests__/collabRoomLogic.test.ts` — 上記の root vitest テスト。
- 変更: `api/collab/load.ts` — roomToken 解決 + 緊急停止 + `maxParticipants` 返却(planId 経路は残す)。
- 変更: `api/collab/save.ts` — roomToken 解決 + 緊急停止(planId 経路は残す)。

> ⑤-1 では `collabRooms` ドキュメントを**読むだけ**(発行は ⑤-2)。`COLLECTIONS` 定数追加・Firestore rules・複合インデックスは collabRooms を**書き込む** ⑤-2 で扱う(admin read は rules をバイパスし、未作成コレクションの get は単に `exists:false` を返すため ⑤-1 単独で安全)。

---

## Task 1: ルーム解決の純ロジック (`api/collab/_roomLogic.ts`)

DB も admin も使わない純関数を先に TDD で固める。後続の load/save がこれを wrap する。

**Files:**
- Create: `api/collab/_roomLogic.ts`
- Test: `src/lib/__tests__/collabRoomLogic.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/lib/__tests__/collabRoomLogic.test.ts
import { describe, it, expect } from 'vitest';
import {
  resolveRoom,
  clampMaxParticipants,
  isCollabDisabled,
  DEFAULT_MAX_PARTICIPANTS,
  SYSTEM_MAX_PARTICIPANTS,
} from '../../../api/collab/_roomLogic';

describe('resolveRoom', () => {
  it('不存在(null) → not-found', () => {
    expect(resolveRoom(null)).toEqual({ ok: false, reason: 'not-found' });
  });
  it('planId 欠落 → not-found', () => {
    expect(resolveRoom({ ownerId: 'u1' })).toEqual({ ok: false, reason: 'not-found' });
  });
  it('失効 → revoked', () => {
    expect(resolveRoom({ planId: 'p1', revoked: true })).toEqual({ ok: false, reason: 'revoked' });
  });
  it('有効 → ok + planId + 丸めた maxParticipants', () => {
    expect(resolveRoom({ planId: 'p1', maxParticipants: 8 }))
      .toEqual({ ok: true, planId: 'p1', maxParticipants: 8 });
  });
  it('maxParticipants 未指定は既定 8', () => {
    expect(resolveRoom({ planId: 'p1' }))
      .toEqual({ ok: true, planId: 'p1', maxParticipants: DEFAULT_MAX_PARTICIPANTS });
  });
});

describe('clampMaxParticipants', () => {
  it('未指定・非数 → 既定 8', () => {
    expect(clampMaxParticipants(undefined)).toBe(DEFAULT_MAX_PARTICIPANTS);
    expect(clampMaxParticipants(NaN)).toBe(DEFAULT_MAX_PARTICIPANTS);
  });
  it('下限 1 未満は 1 に丸め', () => {
    expect(clampMaxParticipants(0)).toBe(1);
    expect(clampMaxParticipants(-5)).toBe(1);
  });
  it('システム上限超過は上限に丸め', () => {
    expect(clampMaxParticipants(999)).toBe(SYSTEM_MAX_PARTICIPANTS);
  });
  it('小数は切り捨て', () => {
    expect(clampMaxParticipants(8.9)).toBe(8);
  });
});

describe('isCollabDisabled', () => {
  it("COLLAB_DISABLED==='1' で true", () => {
    expect(isCollabDisabled({ COLLAB_DISABLED: '1' })).toBe(true);
  });
  it('未設定・他値は false', () => {
    expect(isCollabDisabled({})).toBe(false);
    expect(isCollabDisabled({ COLLAB_DISABLED: '0' })).toBe(false);
    expect(isCollabDisabled({ COLLAB_DISABLED: 'true' })).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/collabRoomLogic.test.ts`
Expected: FAIL — `Failed to resolve import "../../../api/collab/_roomLogic"`(モジュール未作成)

- [ ] **Step 3: 最小実装を書く**

```typescript
// api/collab/_roomLogic.ts
// 共同編集⑤: ルームトークン → プラン解決の純ロジック。
// collabRooms/{roomToken} doc を planId/最大人数/失効に解釈する。firebase-admin 非依存
// (handler が wrap する)。③ の _logic.ts と同じ「純関数を分離して決定的にテスト」方針。

/** 既定の最大人数 = 零式/絶のフルパーティ1組。オーナー未設定時に適用。 */
export const DEFAULT_MAX_PARTICIPANTS = 8;
/** システム上限。設計書 §3 の「編集8席 + 閲覧20席」= 28 を v1 は総参加数の単一上限として扱う。 */
export const SYSTEM_MAX_PARTICIPANTS = 28;

/** collabRooms/{roomToken} ドキュメントの必要フィールドだけを表す型。 */
export interface CollabRoomDoc {
  planId?: string;
  ownerId?: string;
  maxParticipants?: number;
  revoked?: boolean;
}

export type RoomResolution =
  | { ok: true; planId: string; maxParticipants: number }
  | { ok: false; reason: 'not-found' | 'revoked' };

/** オーナー設定の最大人数を [1, SYSTEM_MAX] に丸める。未指定/非数は既定 8。小数は切り捨て。 */
export function clampMaxParticipants(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_MAX_PARTICIPANTS;
  return Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, Math.floor(n)));
}

/** collabRooms doc(または null=不存在)から解決結果を決める。失効/planId 欠落は入室不可。 */
export function resolveRoom(room: CollabRoomDoc | null): RoomResolution {
  if (!room || !room.planId) return { ok: false, reason: 'not-found' };
  if (room.revoked === true) return { ok: false, reason: 'revoked' };
  return { ok: true, planId: room.planId, maxParticipants: clampMaxParticipants(room.maxParticipants) };
}

/** 緊急停止スイッチ: 環境変数 COLLAB_DISABLED==='1' で共同編集を全停止する。 */
export function isCollabDisabled(env: { COLLAB_DISABLED?: string }): boolean {
  return env.COLLAB_DISABLED === '1';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/collabRoomLogic.test.ts`
Expected: PASS(11 件すべて緑)

- [ ] **Step 5: コミット**

```bash
git add api/collab/_roomLogic.ts src/lib/__tests__/collabRoomLogic.test.ts
git commit -m "feat(collab): 段取り⑤-1 ルーム解決の純ロジック(resolveRoom/clamp/緊急停止)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `load.ts` を roomToken 解決 + 緊急停止に対応

`collabRooms/{roomToken}` を読み planId を解決。失効/不存在/緊急停止は seed させない(`{deleted:true}`)。planId 直接指定は ②-a/③ レガシー経路として残す。live は `maxParticipants` を添えて返す。

**Files:**
- Modify: `api/collab/load.ts`(全面置換)

- [ ] **Step 1: load.ts を以下の内容に置き換える**

```typescript
// 共同編集 seed: DO の onLoad がここを叩き、現在の軽減配置を取得する。
// ⑤: roomToken を受け取り collabRooms/{roomToken} → planId を解決(失効/不存在は seed させない)。
//     planId 直接指定は ②-a/③ レガシー経路として残す(非破壊)。緊急停止中は seed させない。
// 墓標/不存在は decideLoad が {deleted:true} を返し、DO は seed しない(破壊保存ガード)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideLoad, type PlanDocSnapshot } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // 緊急停止: 止血中は seed させない(部屋は空のまま=破壊保存ガードで保存もされない)。
  if (isCollabDisabled(process.env)) return res.status(200).json({ deleted: true });

  const db = getDb();
  const roomToken = (req.query?.roomToken as string) ?? '';
  let planId: string;
  let maxParticipants: number | undefined;

  if (roomToken) {
    const roomSnap = await db.collection('collabRooms').doc(roomToken).get();
    const room = resolveRoom(roomSnap.exists ? (roomSnap.data() as CollabRoomDoc) : null);
    if (!room.ok) return res.status(200).json({ deleted: true }); // 失効/不存在 → seed しない
    planId = room.planId;
    maxParticipants = room.maxParticipants;
  } else {
    planId = (req.query?.planId as string) ?? ''; // ②-a/③ レガシー経路
    if (!planId) return res.status(400).json({ error: 'roomToken or planId required' });
  }

  const snap = await db.collection('plans').doc(planId).get();
  const plan = snap.exists ? (snap.data() as PlanDocSnapshot) : null;
  const result = decideLoad(plan);
  if ('deleted' in result) return res.status(200).json(result);
  // maxParticipants は roomToken 経路のみ付与(レガシーは undefined → JSON で省略・DO は無視可)。
  return res.status(200).json({ mitigations: result.mitigations, maxParticipants });
}
```

- [ ] **Step 2: 型・ビルドが通ることを確認**

Run: `npm run build`
Expected: 成功(tsc -b エラーなし)。未使用 import・型不足が無いこと。

- [ ] **Step 3: 既存テストの非破壊を確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts src/lib/__tests__/collabRoomLogic.test.ts`
Expected: PASS(③ の `collabLogic` 既存 + ⑤-1 新規がともに緑。`load.ts` は純ロジックを再利用しているだけなので回帰なし)

- [ ] **Step 4: コミット**

```bash
git add api/collab/load.ts
git commit -m "feat(collab): 段取り⑤-1 load を roomToken 解決+緊急停止に対応(planId 経路は維持)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `save.ts` を roomToken 解決 + 緊急停止に対応

`collabRooms/{roomToken}` を読み planId を解決。失効/不存在/緊急停止は書かない(`skipped`)。planId 直接指定は ②-a/③ レガシー経路として残す。解決後の墓標ガード + version+1 トランザクションは③のまま。

**Files:**
- Modify: `api/collab/save.ts`(全面置換)

- [ ] **Step 1: save.ts を以下の内容に置き換える**

```typescript
// 共同編集 書き戻し: DO の onSave がここを叩き、軽減配置を Firestore に保存する。
// ⑤: roomToken → planId 解決(失効/不存在は skipped)。planId 直接は ②-a/③ レガシー経路。
//     緊急停止中は書かない。墓標ガード: deleted なら書かない(削除が勝つ)。
//     data.timelineMitigations だけ部分更新し version をインクリメント(既存の楽観ロックと整合)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideSave, type MitigationRecord, type PlanDocSnapshot } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // 緊急停止: 止血中は書かない(skipped で DO の #saveEnabled を落とす)。
  if (isCollabDisabled(process.env)) return res.status(200).json({ skipped: 'disabled' });

  const { planId: bodyPlanId, roomToken, mitigations } =
    (req.body ?? {}) as { planId?: string; roomToken?: string; mitigations?: MitigationRecord[] };
  if (!Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'mitigations[] required' });
  }

  const db = getDb();
  let planId: string;
  if (roomToken) {
    const roomSnap = await db.collection('collabRooms').doc(roomToken).get();
    const room = resolveRoom(roomSnap.exists ? (roomSnap.data() as CollabRoomDoc) : null);
    if (!room.ok) return res.status(200).json({ skipped: room.reason }); // 失効/不存在 → 書かない
    planId = room.planId;
  } else {
    planId = bodyPlanId ?? ''; // ②-a/③ レガシー経路
    if (!planId) return res.status(400).json({ error: 'roomToken or planId required' });
  }

  const ref = db.collection('plans').doc(planId);
  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const decision = decideSave(snap.exists ? (snap.data() as PlanDocSnapshot) : null);
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

- [ ] **Step 2: 型・ビルドが通ることを確認**

Run: `npm run build`
Expected: 成功(tsc -b エラーなし)。`MitigationRecord`/`PlanDocSnapshot`/`Transaction` 等の import がすべて使用されていること。

- [ ] **Step 3: コミット**

```bash
git add api/collab/save.ts
git commit -m "feat(collab): 段取り⑤-1 save を roomToken 解決+緊急停止に対応(planId 経路は維持)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 全体回帰の最終ゲート

⑤-1 が ③・1人モード・他テストを壊していないことを確定する(push 前ゲート)。

**Files:** なし(検証のみ)

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 2: フルテスト**

Run: `npx vitest run`
Expected: PASS(既知の事前 failure = `housing/TopBar.test.tsx` 4件・`HousingWorkspace.test.tsx` 1件 は ⑤-1 と無関係で従来どおり。それ以外が緑。`collabLogic`/`collabRoomLogic` を含む collab 系が全緑)。
※ vitest がハングする場合は出力をパイプせず単体実行で切り分ける([memory `reference_vitest_vmthreads_hang`])。

- [ ] **Step 2 補足: ワーカー側テストの非破壊(任意・別パッケージ)**

⑤-1 はワーカーを変更しないが、念のため `workers/collab` で `npm test` が従来どおり緑であることを確認してもよい(変更が無いため通常スキップ可)。

- [ ] **Step 3: TODO 反映 + コミット(必要なら)**

[docs/TODO.md](../../TODO.md) の⑤行に「⑤-1(ルーム解決層)実装・mainマージ済」を反映(行数 100 以内維持)。

```bash
git add docs/TODO.md
git commit -m "docs(todo): 段取り⑤-1(ルーム解決層)実装済を反映・残=⑤-2 管理API+ワーカー結線

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了の定義 (⑤-1)
- `_roomLogic.ts` の純ロジックが root vitest で全緑(resolveRoom / clamp / 緊急停止)。
- `load.ts`/`save.ts` が roomToken を解決し、失効/不存在/緊急停止を正しく拒否しつつ、**planId 直接経路(③)を非破壊で維持**。
- `npm run build` 成功・既存テスト群が従来どおり(既知の housing 事前 failure を除き)緑。
- **未達(後続)**: collabRooms の発行(⑤-2)・ワーカーが roomToken 送信(⑤-2)・満員拒否(⑤-2)・クライアント入口と実データ往復(⑤-3)。⑤-1 単独ではまだ実際に新トークンで繋がるところまでは到達しない(解決層の土台のみ)。
