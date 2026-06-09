# 共同編集 段取り②-b-2: partyMembers ライブ同期 + ジョブ変更カスケード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `partyMembers`（パーティ編成）をライブ同期し、ジョブ変更カスケード（mitigations 波及）と ②-a 未委譲の bulk mitigation 操作 3 種を委譲化して、「全員が同じ 1 枚を全要素ライブ編集」エンジンを完成させる。

**Architecture:** ②-b-1 の「store がソロ版ロジックで結果を計算 → 差分だけをハンドラ経由で Y に反映」を踏襲。partyMembers は新 Y.Array キーで id 単位マージ。ジョブ変更カスケード（partyMembers + mitigations を 1 transaction で原子的に）のため新ハンドラ `batch(ops)` を追加。`PlanArrayKey` に `partyMembers` と `timelineMitigations` を足し、汎用 upsert/remove/replace を mitigations Y.Array にも使えるようにする（②-a の add/remove/updateTime は無改変で共存）。②-a / ③ / ②-b-1 を壊さず additive、UI 入口なしのまま main dormant、push/worker deploy はユーザー承認まで保留。

**Tech Stack:** TypeScript, Zustand (`useMitigationStore`), Yjs (CRDT), y-partyserver / Cloudflare Durable Objects (worker), Vitest（root は `pool: 'vmThreads'`）, Vercel Node Functions（`api/collab/*`、相対 import は `.js` 拡張子必須）。

**設計書（正典）:** [docs/superpowers/specs/2026-06-09-realtime-collab-stage2b2-partymembers-sync-design.md](../specs/2026-06-09-realtime-collab-stage2b2-partymembers-sync-design.md)

---

## 前提となる既存実装（読んで把握すること）

- クライアント CRDT ヘルパ: [src/lib/collab/yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts)
  - `PlanArrayKey`（現状 `timelineEvents | phases | labels | memos`）、`recordToYMap` / `readArray` / `indexOfById` / `applyUpsert` / `applyRemove`。
- クライアント遅延チャンク: [src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts)
  - `arrByKey` literal、`yarr`（mitigations Y.Array、キー = `YJS_MITIGATIONS_KEY = 'timelineMitigations'`）、各 observeDeep、onSynced 初期反映、disconnect。
  - ②-a handlers（`add` / `remove` / `updateTime`・cascade 込み・**無改変**）、②-b-1 handlers（`upsertItems` / `removeItems` / `setMeta` / `importBulk`）。
- ハンドラ型: [src/lib/collab/collabTypes.ts](../../../src/lib/collab/collabTypes.ts)（`CollabHandlers` interface）。
- store: [src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)
  - collab 分岐の型 `_collabActive` / `_collabHandlers`、`enterCollabMode` / `exitCollabMode`、`_applyMitigationsFromCollab` / `_applyEventsFromCollab` / `_applyPhasesFromCollab` / `_applyLabelsFromCollab` / `_applyMemosFromCollab` / `_applyMetaFromCollab`。
  - 委譲対象 mutation: `updateMemberStats` / `applyDefaultStats` / `setMemberJob` / `changeMemberJobWithMitigations` / `updatePartyBulk` / `clearMitigationsByMember` / `clearAllMitigations` / `applyAutoPlan` / `restoreFromSnapshot`。
  - 既存委譲の手本: `addEvent` / `importTimelineEvents`（store が計算 → handler に delta 委譲、store 直変更しない）。
  - 派生計算 `calculateMemberValues(member, level)`、cascade ヘルパ `hasAnyAetherflow` / `buildScholarAutoInserts` / `hasAnyAstrologianDraw` / `buildAstrologianAutoInserts`、module getter `getJobsFromStore` / `getMitigationsFromStore` / `getPatchStatsFromStore` / `getDefaultStatsByLevelFromStore` / `getLevelModifiersFromStore`、定数 `DEFAULT_TANK_STATS` / `DEFAULT_HEALER_STATS`。
- worker ミラー: [workers/collab/src/yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts)（`PlanDataSeed` / `buildSeedDocFull` / `readPlanDataFull`）、[workers/collab/src/collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts)（`SeedResultFull` は `PlanDataSeed` を継承、`postPlanData` は `...payload` 送信 → partyMembers を足せば自動授受）、[workers/collab/src/server.ts](../../../workers/collab/src/server.ts)（`onLoad`→`buildSeedDocFull` / `flushSave`→`readPlanDataFull`・**無改変**）。
- Vercel 永続化: [api/collab/_logic.ts](../../../api/collab/_logic.ts)（`PlanDocSnapshotFull` / `LoadResultFull` / `decideLoadFull`）、[api/collab/_loadHandler.ts](../../../api/collab/_loadHandler.ts)（`decideLoadFull` の結果を spread で返す・**無改変**）、[api/collab/_saveHandler.ts](../../../api/collab/_saveHandler.ts)（body 分解 + `data.*` 部分更新）。
- 型: [src/types/index.ts](../../../src/types/index.ts)（`PartyMember` = `{ id, jobId: string|null, role, stats: PlayerStats, computedValues: Record<string,number>, mode? }`、`PlanData.partyMembers`）。

## File Structure（このプランで触るファイル）

**クライアント:**
- `src/lib/collab/yjsPlanData.ts` — `PARTY_MEMBERS_KEY` / `MITIGATIONS_KEY` 定数、`PlanArrayKey` 拡張、`applyReplace`、`BatchOp` 型、`applyBatch`、`buildArrByKey` を追加。
- `src/lib/collab/__tests__/yjsPlanData.test.ts` — 上記の純ロジックテスト追加。
- `src/lib/collab/collabTypes.ts` — `CollabHandlers` に `batch(ops: BatchOp[])` を追加。
- `src/lib/collab/collabProvider.ts` — `partyMembers` Y.Array の observer / 初期反映 / disconnect、`buildArrByKey` 採用、`batch` ハンドラ実装。
- `src/store/useMitigationStore.ts` — `_applyPartyMembersFromCollab` 追加、partyMembers 系 9 mutation の collab 委譲、純ヘルパ抽出（DRY）、`restoreFromSnapshot` ガード。
- `src/store/__tests__/useMitigationStore.collab.test.ts` — 委譲テスト追加。

**worker:**
- `workers/collab/src/yjsPlanData.ts` — `PlanDataSeed.partyMembers` + seed/read 授受。
- `workers/collab/src/yjsPlanData.test.ts` — 往復テストに partyMembers 追加。

**Vercel:**
- `api/collab/_logic.ts` — `partyMembers` を `PlanDocSnapshotFull` / `LoadResultFull` / `decideLoadFull` に追加。
- `api/collab/_saveHandler.ts` — body に `partyMembers` 追加 + `data.partyMembers` 部分更新。
- `src/lib/__tests__/collabLogic.test.ts` — `decideLoadFull` の partyMembers アサート追加。

## 検証コマンド（各タスクで使う）

- クライアント単体: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
- store 委譲: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
- Vercel ロジック: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
- worker: `cd workers/collab; npx vitest run; npx tsc -b`（worker は別パッケージ）
- 全 root 単体（最後）: `npx vitest run`（既知 5 失敗: TopBar 4 + HousingWorkspace 1。これ以外が緑なら OK）
- build（tsc 厳密）: `npm run build`

> ⚠ root の vitest は `pool: 'vmThreads'` 必須（[[reference_vitest_pool_firebase]]）。出力をパイプしない（[[reference_vitest_appcheck_teardown]]）。`useMitigationStore` テストは複数同時実行で vmThreads 汚染し得る（②-a 前から既知・無関係）。単独実行でも検証する。

---

### Task 1: yjsPlanData にバッチ基盤を追加（クライアント純ロジック）

**Files:**
- Modify: `src/lib/collab/yjsPlanData.ts`
- Test: `src/lib/collab/__tests__/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/collab/__tests__/yjsPlanData.test.ts` の import を差し替え、末尾に describe を追加する。

import 行（既存の import ブロックを以下に置換）:

```typescript
import {
  recordToYMap, yMapToRecord, indexOfById, readArray, applyUpsert, applyRemove,
  applyReplace, applyBatch, buildArrByKey,
  readPlanMeta, setMetaField,
  TIMELINE_EVENTS_KEY, PHASES_KEY, PLAN_META_KEY, META_LEVEL, META_AA, META_SCH,
  PARTY_MEMBERS_KEY, MITIGATIONS_KEY,
} from "../yjsPlanData";
```

ファイル末尾に追加:

```typescript
const member = (over: Record<string, unknown> = {}) => ({
  id: "MT", jobId: "pld", role: "tank",
  stats: { hp: 100, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 },
  computedValues: { Rampart: 20 }, ...over,
});

describe("yjsPlanData applyReplace（全置換）", () => {
  it("既存を全消ししてから新配列を push する", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PHASES_KEY), [ph({ id: "old" })]);
    applyReplace(a.getArray(PHASES_KEY), [ph({ id: "n1" }), ph({ id: "n2" })]);
    expect(readArray<Phase>(b, PHASES_KEY).map((p) => p.id)).toEqual(["n1", "n2"]);
  });
});

describe("yjsPlanData applyBatch（複数キーを1 transaction）", () => {
  it("partyMembers upsert と timelineMitigations replace を1更新で適用", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    let updates = 0;
    b.on("update", () => { updates++; });
    applyBatch(a, buildArrByKey(a), [
      { kind: "upsert", key: PARTY_MEMBERS_KEY, items: [member()] },
      { kind: "replace", key: MITIGATIONS_KEY, items: [{ id: "m1", mitigationId: "x", time: 1, duration: 2, ownerId: "MT" }] },
    ]);
    expect(readArray(b, PARTY_MEMBERS_KEY)).toEqual([member()]);
    expect(readArray<{ id: string }>(b, MITIGATIONS_KEY).map((m) => m.id)).toEqual(["m1"]);
    expect(updates).toBe(1); // 1 transaction → 受信側 update は 1 回
  });
  it("remove op は id を削除する", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PARTY_MEMBERS_KEY), [member({ id: "MT" }), member({ id: "ST" })]);
    applyBatch(a, buildArrByKey(a), [{ kind: "remove", key: PARTY_MEMBERS_KEY, ids: ["MT"] }]);
    expect(readArray<{ id: string }>(b, PARTY_MEMBERS_KEY).map((m) => m.id)).toEqual(["ST"]);
  });
});

describe("buildArrByKey", () => {
  it("同一キーは Yjs 共有インスタンスを返す（doc.getArray と一致）", () => {
    const doc = new Y.Doc();
    expect(buildArrByKey(doc)[PARTY_MEMBERS_KEY]).toBe(doc.getArray(PARTY_MEMBERS_KEY));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: FAIL（`applyReplace` / `applyBatch` / `buildArrByKey` / `PARTY_MEMBERS_KEY` / `MITIGATIONS_KEY` が export されていない）

- [ ] **Step 3: 実装する**

`src/lib/collab/yjsPlanData.ts` を編集。

(3-1) キー定数と `PlanArrayKey` 拡張。既存の `MEMOS_KEY` 行の直後に追加:

```typescript
/** ②-b-2: パーティ編成の Y.Array キー（events 等と並ぶトップレベル）。 */
export const PARTY_MEMBERS_KEY = "partyMembers";
/** ②-b-2: mitigations Y.Array キー（②-a の YJS_MITIGATIONS_KEY と同値。汎用 batch 経路で使う）。 */
export const MITIGATIONS_KEY = "timelineMitigations";
```

既存の `PlanArrayKey` 型定義を以下に置換:

```typescript
/** 配列同期キーの型（events/phases/labels/memos + ②-b-2 で partyMembers/timelineMitigations）。 */
export type PlanArrayKey =
  | typeof TIMELINE_EVENTS_KEY | typeof PHASES_KEY | typeof LABELS_KEY | typeof MEMOS_KEY
  | typeof PARTY_MEMBERS_KEY | typeof MITIGATIONS_KEY;
```

(3-2) `applyRemove` 関数の直後に `applyReplace` を追加:

```typescript
/** 全置換: 既存要素を全消去してから items を push（bulk 操作・原子性は呼び出し側の transact が担保）。 */
export function applyReplace(arr: Y.Array<Y.Map<unknown>>, items: Array<{ id: string }>): void {
  if (arr.length > 0) arr.delete(0, arr.length);
  for (const item of items) arr.push([recordToYMap(item)]);
}
```

(3-3) `applyReplace` の直後に `BatchOp` / `applyBatch` / `buildArrByKey` を追加:

```typescript
/** batch ハンドラの 1 操作。upsert/remove/replace を任意キーへ。 */
export interface BatchOp {
  kind: "upsert" | "remove" | "replace";
  key: PlanArrayKey;
  items?: Array<{ id: string }>;
  ids?: string[];
}

/** Y.Doc の全 PlanArrayKey → Y.Array の対応表（collabProvider と test で共有）。 */
export function buildArrByKey(doc: Y.Doc): Record<PlanArrayKey, Y.Array<Y.Map<unknown>>> {
  return {
    [TIMELINE_EVENTS_KEY]: doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY),
    [PHASES_KEY]: doc.getArray<Y.Map<unknown>>(PHASES_KEY),
    [LABELS_KEY]: doc.getArray<Y.Map<unknown>>(LABELS_KEY),
    [MEMOS_KEY]: doc.getArray<Y.Map<unknown>>(MEMOS_KEY),
    [PARTY_MEMBERS_KEY]: doc.getArray<Y.Map<unknown>>(PARTY_MEMBERS_KEY),
    [MITIGATIONS_KEY]: doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY),
  };
}

/** 複数キーの操作を 1 つの doc.transact（origin='local'）で原子的に適用する。 */
export function applyBatch(
  doc: Y.Doc,
  arrByKey: Record<PlanArrayKey, Y.Array<Y.Map<unknown>>>,
  ops: BatchOp[],
): void {
  doc.transact(() => {
    for (const op of ops) {
      const arr = arrByKey[op.key];
      if (op.kind === "upsert") applyUpsert(arr, op.items ?? []);
      else if (op.kind === "remove") applyRemove(arr, op.ids ?? []);
      else applyReplace(arr, op.items ?? []);
    }
  }, "local");
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: PASS（既存 + 新規すべて緑）

- [ ] **Step 5: コミット**

```bash
git add src/lib/collab/yjsPlanData.ts src/lib/collab/__tests__/yjsPlanData.test.ts
git commit -m "feat(collab): stage2b2 yjsPlanData に applyReplace/applyBatch/buildArrByKey + partyMembers キー"
```

---

### Task 2: CollabHandlers に batch を追加（型のみ）

**Files:**
- Modify: `src/lib/collab/collabTypes.ts`

- [ ] **Step 1: 実装する**

`src/lib/collab/collabTypes.ts` の import 行を更新（`BatchOp` を追加）:

```typescript
import type { PlanArrayKey, AASettings, BatchOp } from "./yjsPlanData";
```

`CollabHandlers` interface の `importBulk` 行の直後（`}` の直前）に追加:

```typescript
  // ②-b-2: 複数キー（partyMembers + timelineMitigations 等）を 1 transaction で原子的に反映。
  // ジョブ変更カスケード（メンバー更新 + その mitigations 入替）が途中状態で相手画面を壊さないため。
  batch: (ops: BatchOp[]) => void;
```

- [ ] **Step 2: 型チェック（build はまだ落ちる＝実装未提供のため、tsc は collabProvider で要求を出す）**

Run: `npx tsc -b --noEmit` か、Task 3 まで進めてから build する。ここでは型定義の追加のみなので、単独 vitest は不要。

> 注: この時点で `collabProvider.ts` が `batch` 未実装のため build は通らない。Task 3 とセットで緑化する。コミットは Task 3 と一緒に行う（中間状態を commit しない）。

---

### Task 3: collabProvider に partyMembers 同期と batch ハンドラを結線

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

- [ ] **Step 1: import を更新**

`./yjsPlanData` からの import ブロックを以下に置換:

```typescript
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY, PLAN_META_KEY,
  META_LEVEL, META_AA, META_SCH, PARTY_MEMBERS_KEY,
  applyUpsert, applyRemove, setMetaField, readArray, readPlanMeta,
  recordToYMap, buildArrByKey, applyBatch, type PlanArrayKey,
} from './yjsPlanData';
```

`../../types` からの import に `PartyMember` を追加:

```typescript
import type { AppliedMitigation, TimelineEvent, Phase, Label, PlanMemo, PartyMember } from '../../types';
```

- [ ] **Step 2: arrByKey を buildArrByKey 化し、yPartyMembers を追加**

既存の Y.Array 取得ブロック（`const yEvents = ...` から `arrByKey` literal まで）を以下に置換:

```typescript
  // ②-b-1/②-b-2: 残りの PlanData 要素の Y 型（②-a の timelineMitigations と並ぶトップレベルキー）。
  const arrByKey = buildArrByKey(doc);
  const yEvents = arrByKey[TIMELINE_EVENTS_KEY];
  const yPhases = arrByKey[PHASES_KEY];
  const yLabels = arrByKey[LABELS_KEY];
  const yMemos = arrByKey[MEMOS_KEY];
  const yPartyMembers = arrByKey[PARTY_MEMBERS_KEY];
```

（注: `yarr`（mitigations）は既存どおり `doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY)` のまま。`arrByKey[MITIGATIONS_KEY]` と同一インスタンス。②-a handlers は無改変で `yarr` を使い続ける。）

- [ ] **Step 3: partyMembers の observer と初期反映を追加**

`const applyMeta = ...` 行の直後（`yEvents.observeDeep(applyEvents);` の前）に追加:

```typescript
  const applyPartyMembers = () => store()._applyPartyMembersFromCollab(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY));
```

`yMeta.observeDeep(applyMeta);` の直後に追加:

```typescript
  yPartyMembers.observeDeep(applyPartyMembers);
```

- [ ] **Step 4: batch ハンドラを追加**

`handlers` オブジェクトの `importBulk` プロパティの直後（オブジェクト末尾 `}` の前）に追加:

```typescript
    // ②-b-2: 複数キーを 1 transaction で原子的に反映（ジョブ変更カスケード等）。
    batch: (ops) => applyBatch(doc, arrByKey, ops),
```

- [ ] **Step 5: onSynced の初期反映に partyMembers を追加**

onSynced 内の `applyEvents(); applyPhases(); applyLabels(); applyMemos(); applyMeta();` の行を以下に置換（partyMembers を meta より前に・meta が currentLevel から computedValues を再計算する際に同期済み partyMembers を読むため）:

```typescript
    applyEvents(); applyPhases(); applyLabels(); applyMemos(); applyPartyMembers(); applyMeta();
```

- [ ] **Step 6: disconnect の unobserve に partyMembers を追加**

`yMemos.unobserveDeep(applyMemos);` の直後に追加:

```typescript
    yPartyMembers.unobserveDeep(applyPartyMembers);
```

- [ ] **Step 7: build で型を確認（store の `_applyPartyMembersFromCollab` は Task 4 で実装するため、ここでは tsc が当該メソッド未定義を出す。Task 4 とまとめて緑化）**

> 注: `store()._applyPartyMembersFromCollab` が未定義なので、Task 4 完了まで build は通らない。Task 4 と同時にコミットする。

---

### Task 4: store に _applyPartyMembersFromCollab を追加（Y→store 反映）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useMitigationStore.collab.test.ts` の `describe('②-b-1 apply...` ブロックの後（行 79 付近）に追加:

```typescript
describe('②-b-2 partyMembers apply（Y→store 反映）', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({ partyMembers: [], currentLevel: 100, _collabActive: false, _collabHandlers: null }));

  it('_applyPartyMembersFromCollab は partyMembers を反映し computedValues をローカル再計算する', () => {
    useMitigationStore.getState()._applyPartyMembersFromCollab([member({ computedValues: { stale: 1 } })]);
    const m0 = useMitigationStore.getState().partyMembers[0];
    expect(m0.id).toBe('MT');
    expect(m0.jobId).toBe('pld');
    // 受信した stale な computedValues は破棄され、currentLevel から再計算された値で上書きされる
    expect(m0.computedValues).not.toEqual({ stale: 1 });
    expect(typeof m0.computedValues).toBe('object');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`_applyPartyMembersFromCollab is not a function`）

- [ ] **Step 3: 実装する**

(3-1) `src/store/useMitigationStore.ts` のアクション型宣言。`_applyMemosFromCollab: (memos: PlanMemo[]) => void;` 行の直後に追加:

```typescript
    /** ②-b-2: Yjs 側の最新 partyMembers を store に反映（computedValues は currentLevel からローカル再計算）。 */
    _applyPartyMembersFromCollab: (members: PartyMember[]) => void;
```

（`PartyMember` が store の import に無ければ既存の `import type { ... } from ...types` に追加する。store 冒頭の types import を確認し、無い場合のみ `PartyMember` を足す。）

(3-2) 実装本体。`_applyMemosFromCollab: (memos) => set({ memos }),` 行の直後に追加:

```typescript
                _applyPartyMembersFromCollab: (members) =>
                    set((state) => ({
                        partyMembers: members.map((m) => ({
                            ...m,
                            computedValues: calculateMemberValues(m, state.currentLevel),
                        })),
                    })),
```

(3-3) `_applyMetaFromCollab` 内の古いコメントを更新（partyMembers は b-2 で同期されるようになったため）。以下のコメント行:

```typescript
                            // computedValues は派生 → ローカル再計算(partyMembers 自体は b-1 で同期しない)。
```

を次に置換:

```typescript
                            // computedValues は派生 → ローカル再計算（partyMembers は ②-b-2 で Y 同期済み、ここでは state を読む）。
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: build を確認（Task 2/3 の batch・partyMembers 結線がここで揃い緑化）**

Run: `npm run build`
Expected: PASS（tsc -b 厳密で型エラーなし）

- [ ] **Step 6: コミット（Task 2/3/4 をまとめて）**

```bash
git add src/lib/collab/collabTypes.ts src/lib/collab/collabProvider.ts src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 partyMembers Y同期 + batch ハンドラ結線 + _applyPartyMembersFromCollab"
```

---

### Task 5: updateMemberStats / applyDefaultStats を委譲（mitigations 波及なし）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 partyMembers 単純変更の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('updateMemberStats は当該メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateMemberStats('MT', { hp: 999999 });
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('MT');
    expect(items[0].stats.hp).toBe(999999);
    // store 直変更なし（反映は observeDeep→_applyPartyMembersFromCollab 経由のみ）
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.stats.hp).toBe(100000);
  });

  it('applyDefaultStats は全メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().applyDefaultStats(90);
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items.map((m: any) => m.id).sort()).toEqual(['H1', 'MT']);
    expect(useMitigationStore.getState().partyMembers.every((m) => m.computedValues && Object.keys(m.computedValues).length === 0)).toBe(true); // 直変更なし
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（collab 中も従来どおり set され、`h.upsertItems` が呼ばれない）

- [ ] **Step 3: 実装する**

(3-1) `applyDefaultStats` のソロ計算を純ヘルパに抽出（DRY: collab とソロで共有）。store ファイルの module スコープ（store 定義の外、他のヘルパ群の近く）に追加する。

> 既存 `applyDefaultStats` の `set((state) => { ... })` 内で参照する `getPatchStatsFromStore` / `getDefaultStatsByLevelFromStore` / `getLevelModifiersFromStore` / `calculateMemberValues` / `PlayerStats` / `PartyMember` は module スコープから参照可能。

module スコープに追加:

```typescript
/** ②-b-2: applyDefaultStats のソロ計算を抽出（collab/ソロ両経路で共有）。level/patch から全メンバーの stats を更新。 */
function computeDefaultStatsMembers(
  members: PartyMember[],
  level: number,
  patch?: string,
): PartyMember[] {
  const patchData = patch ? getPatchStatsFromStore()[patch] : null;
  const template = patchData || getDefaultStatsByLevelFromStore()[level] || getDefaultStatsByLevelFromStore()[100];
  const subBase = getLevelModifiersFromStore()[level]?.sub || 420;
  const fillStats = (partial: any): PlayerStats => ({ ...partial, crt: subBase, ten: subBase, ss: subBase });
  const newDefaults = { tank: fillStats(template.tank), other: fillStats(template.other) };
  return members.map((m) => {
    const stats = m.role === 'tank' ? newDefaults.tank : newDefaults.other;
    return { ...m, stats: { ...stats }, computedValues: calculateMemberValues({ ...m, stats }, level) };
  });
}
```

(3-2) `applyDefaultStats` アクション本体を、collab 分岐 + 抽出ヘルパ使用に置換:

```typescript
                applyDefaultStats: (level, patch) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('partyMembers', computeDefaultStatsMembers(get().partyMembers, level, patch));
                        return;
                    }
                    pushHistory();
                    set((state) => ({ partyMembers: computeDefaultStatsMembers(state.partyMembers, level, patch) }));
                },
```

(3-3) `updateMemberStats` アクション本体を、collab 分岐追加に置換:

```typescript
                updateMemberStats: (memberId, stats) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const m = get().partyMembers.find((x) => x.id === memberId);
                        if (!m) return;
                        const newStats = { ...m.stats, ...stats };
                        const updated = { ...m, stats: newStats, computedValues: calculateMemberValues({ ...m, stats: newStats }, get().currentLevel) };
                        get()._collabHandlers!.upsertItems('partyMembers', [updated]);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        partyMembers: state.partyMembers.map(m => {
                            if (m.id === memberId) {
                                const newStats = { ...m.stats, ...stats };
                                const computedValues = calculateMemberValues({ ...m, stats: newStats }, state.currentLevel);
                                return { ...m, stats: newStats, computedValues };
                            }
                            return m;
                        })
                    }));
                },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: ソロ回帰を確認（抽出が挙動を変えていないこと）**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts && npx vitest run src/store`
Expected: PASS（store 配下の既存テストが緑のまま。既知の vmThreads 汚染で単独再実行が要る場合は個別ファイルで確認）

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 updateMemberStats/applyDefaultStats を partyMembers upsert へ委譲"
```

---

### Task 6: setMemberJob を委譲（ジョブ変更カスケード・batch）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

> 方針: 既存 `setMemberJob` の `set((state) => {...})` の本体を純ヘルパ `computeSetMemberJob(state, memberId, jobId)` に**逐語的に**抽出し、ソロは `set((state) => computeSetMemberJob(state, memberId, jobId))`、collab はヘルパで結果を計算して `batch` 委譲する。collab テストは「委譲（handler 呼び出し + store 直変更なし）」を検証し、カスケードの数理はソロ既存テスト＋全 suite が担保する。

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 setMemberJob 委譲（カスケード batch）', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('setMemberJob は batch に委譲し、partyMembers upsert に新 jobId を含め、store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setMemberJob('MT', 'war');
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pmUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pmUpsert).toBeTruthy();
    expect(pmUpsert.items.find((m: any) => m.id === 'MT').jobId).toBe('war');
    // mitigations 入替 op（remove + upsert）が timelineMitigations キーで存在する
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'remove')).toBe(true);
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'upsert')).toBe(true);
    // store 直変更なし
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`h.batch` が呼ばれない / setMemberJob が store を直変更する）

- [ ] **Step 3: 実装する**

(3-1) module スコープに `computeSetMemberJob` を追加（既存 `setMemberJob` の `set` 本体を逐語コピーし、`state` を引数化）:

```typescript
/** ②-b-2: setMemberJob のソロ計算を抽出（collab/ソロ共有）。ジョブ変更 + 当該メンバーの mitigations フィルタ/移行/自動挿入。 */
function computeSetMemberJob(
  state: Pick<MitigationState, 'partyMembers' | 'timelineMitigations' | 'timelineEvents' | 'currentLevel'>,
  memberId: string,
  jobId: string | null,
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
  const newMembers = state.partyMembers.map(m => {
    if (m.id === memberId) {
      const job = getJobsFromStore().find(j => j.id === jobId);
      const newRole = job ? job.role : m.role;
      let newStats = { ...m.stats };
      if (job && job.role !== m.role) {
        if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
        else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
        else newStats = { ...DEFAULT_HEALER_STATS };
      }
      const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
      const computedValues = calculateMemberValues(updatedMember, state.currentLevel);
      return { ...updatedMember, computedValues };
    }
    return m;
  });

  const filteredMitigations = state.timelineMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
    if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
    const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
    if (def?.jobId === jobId) { acc.push(mit); return acc; }
    if (def && def.jobId !== jobId) {
      const baseId = def.id.replace(`_${def.jobId}`, '');
      const newId = `${baseId}_${jobId}`;
      const newDef = getMitigationsFromStore().find(m => m.id === newId);
      if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
    }
    return acc;
  }, []);

  if (jobId === 'sch' && !hasAnyAetherflow(memberId, filteredMitigations)) {
    filteredMitigations.push(...buildScholarAutoInserts(memberId, filteredMitigations, state.timelineEvents));
  }
  if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, filteredMitigations)) {
    filteredMitigations.push(...buildAstrologianAutoInserts(memberId, filteredMitigations, state.timelineEvents));
  }
  return { partyMembers: newMembers, timelineMitigations: filteredMitigations };
}

/** ②-b-2: 1 メンバーのジョブ変更結果（next）から batch ops を作る（partyMembers upsert + そのメンバー mitigations 入替）。 */
function memberJobBatchOps(
  prevMitigations: AppliedMitigation[],
  memberId: string,
  next: { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] },
): import('../lib/collab/yjsPlanData').BatchOp[] {
  const changedMember = next.partyMembers.find(m => m.id === memberId);
  const oldIds = prevMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
  const newMits = next.timelineMitigations.filter(m => m.ownerId === memberId);
  return [
    { kind: 'upsert', key: 'partyMembers', items: changedMember ? [changedMember] : [] },
    { kind: 'remove', key: 'timelineMitigations', ids: oldIds },
    { kind: 'upsert', key: 'timelineMitigations', items: newMits },
  ];
}
```

> `import('../lib/collab/yjsPlanData').BatchOp` のインライン型参照が tsc で許容されない場合は、store 冒頭の collab import に `import type { BatchOp } from '../lib/collab/yjsPlanData';` を追加し、`BatchOp[]` を直接使う。

(3-2) `setMemberJob` アクション本体を置換:

```typescript
                setMemberJob: (memberId, jobId) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeSetMemberJob(get(), memberId, jobId);
                        get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
                        return;
                    }
                    pushHistory();
                    set((state) => computeSetMemberJob(state, memberId, jobId));
                },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: ソロ回帰 + build を確認**

Run: `npx vitest run src/store; npm run build`
Expected: PASS（ソロ setMemberJob 既存テスト緑 / tsc 緑）

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 setMemberJob を batch（partyMembers + mitigations 入替）へ委譲"
```

---

### Task 7: changeMemberJobWithMitigations を委譲（batch）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 changeMemberJobWithMitigations 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し partyMembers upsert に新 jobId・mitigations upsert に渡した配列を含む', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const mitis = [applied({ id: 'cm1', mitigationId: 'rampart_war', ownerId: 'MT' })];
    useMitigationStore.getState().changeMemberJobWithMitigations('MT', 'war', mitis);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers').items[0].jobId).toBe('war');
    const mitUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineMitigations');
    expect(mitUpsert.items.some((m: any) => m.id === 'cm1')).toBe(true);
    expect(useMitigationStore.getState().partyMembers[0].jobId).toBe('pld'); // 直変更なし
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`h.batch` 未呼び出し）

- [ ] **Step 3: 実装する**

(3-1) module スコープに `computeChangeMemberJobWithMitigations` を追加（既存 `changeMemberJobWithMitigations` の `set` 本体を逐語コピーし `state` 引数化）:

```typescript
/** ②-b-2: changeMemberJobWithMitigations のソロ計算を抽出（collab/ソロ共有）。ジョブ変更 + 引数 mitigations で上書き + 学者/占星補完。 */
function computeChangeMemberJobWithMitigations(
  state: Pick<MitigationState, 'partyMembers' | 'timelineMitigations' | 'timelineEvents' | 'currentLevel'>,
  memberId: string,
  jobId: string,
  mitis: AppliedMitigation[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
  const newMembers = state.partyMembers.map(m => {
    if (m.id === memberId) {
      const job = getJobsFromStore().find(j => j.id === jobId);
      const newRole = job ? job.role : m.role;
      let newStats = { ...m.stats };
      if (job && job.role !== m.role) {
        if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
        else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
        else newStats = { ...DEFAULT_HEALER_STATS };
      }
      const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
      return { ...updatedMember, computedValues: calculateMemberValues(updatedMember, state.currentLevel) };
    }
    return m;
  });

  const otherMitigations = state.timelineMitigations.filter(m => m.ownerId !== memberId);
  const finalMitis = [...mitis];
  if (jobId === 'sch') {
    const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
    if (!hasAnyAetherflow(memberId, ownedMitis)) {
      finalMitis.push(...buildScholarAutoInserts(memberId, ownedMitis, state.timelineEvents));
    }
  }
  if (jobId === 'ast') {
    const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
    if (!hasAnyAstrologianDraw(memberId, ownedMitis)) {
      finalMitis.push(...buildAstrologianAutoInserts(memberId, ownedMitis, state.timelineEvents));
    }
  }
  return { partyMembers: newMembers, timelineMitigations: [...otherMitigations, ...finalMitis] };
}
```

(3-2) `changeMemberJobWithMitigations` アクション本体を置換:

```typescript
                changeMemberJobWithMitigations: (memberId, jobId, mitis) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeChangeMemberJobWithMitigations(get(), memberId, jobId, mitis);
                        get()._collabHandlers!.batch(memberJobBatchOps(get().timelineMitigations, memberId, next));
                        return;
                    }
                    pushHistory();
                    set((state) => computeChangeMemberJobWithMitigations(state, memberId, jobId, mitis));
                },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: ソロ回帰 + build**

Run: `npx vitest run src/store; npm run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 changeMemberJobWithMitigations を batch へ委譲"
```

---

### Task 8: updatePartyBulk を委譲（batch・partyMembers upsert + mitigations 全置換）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

> updatePartyBulk は複数メンバーを横断して mitigations 配列を再構築する。差分の正確な追跡が煩雑なため、collab では「更新対象メンバーを upsert + timelineMitigations を最終配列で replace（全置換）」を 1 batch で行う（applyAutoPlan と同型・原子的）。

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 updatePartyBulk 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'ST', jobId: 'war' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し、更新メンバーを partyMembers upsert・mitigations を replace する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updatePartyBulk([{ memberId: 'MT', jobId: 'drk' }]);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pm = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pm.items.map((m: any) => m.id)).toEqual(['MT']);
    expect(pm.items[0].jobId).toBe('drk');
    expect(ops.some((o) => o.kind === 'replace' && o.key === 'timelineMitigations')).toBe(true);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld'); // 直変更なし
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

(3-1) module スコープに `computeUpdatePartyBulk` を追加（既存 `updatePartyBulk` の `set` 本体を逐語コピーし `state` 引数化。`updates` の型は既存アクションと同一）:

```typescript
/** ②-b-2: updatePartyBulk のソロ計算を抽出（collab/ソロ共有）。複数メンバーのジョブ/mitigations を一括反映。 */
function computeUpdatePartyBulk(
  state: Pick<MitigationState, 'partyMembers' | 'timelineMitigations' | 'timelineEvents' | 'currentLevel'>,
  updates: { memberId: string; jobId: string | null; mitigations?: AppliedMitigation[] }[],
): { partyMembers: PartyMember[]; timelineMitigations: AppliedMitigation[] } {
  let currentMembers = [...state.partyMembers];
  let currentMitigations = [...state.timelineMitigations];

  updates.forEach(({ memberId, jobId, mitigations }) => {
    currentMembers = currentMembers.map(m => {
      if (m.id === memberId) {
        const job = getJobsFromStore().find(j => j.id === jobId);
        const newRole = job ? job.role : m.role;
        let newStats = { ...m.stats };
        if (job && job.role !== m.role) {
          if (job.role === 'tank') newStats = { ...DEFAULT_TANK_STATS };
          else if (job.role === 'healer') newStats = { ...DEFAULT_HEALER_STATS };
          else newStats = { ...DEFAULT_HEALER_STATS };
        }
        const updatedMember = { ...m, jobId, role: newRole, stats: newStats };
        return { ...updatedMember, computedValues: calculateMemberValues(updatedMember, state.currentLevel) };
      }
      return m;
    });

    if (mitigations) {
      currentMitigations = currentMitigations.filter(mit => mit.ownerId !== memberId);
      currentMitigations = [...currentMitigations, ...mitigations];
    } else {
      const originalMember = state.partyMembers.find(m => m.id === memberId);
      if (originalMember && originalMember.jobId !== jobId) {
        currentMitigations = currentMitigations.reduce<AppliedMitigation[]>((acc, mit) => {
          if (mit.ownerId !== memberId) { acc.push(mit); return acc; }
          const def = getMitigationsFromStore().find(m => m.id === mit.mitigationId);
          if (def?.jobId === jobId) { acc.push(mit); return acc; }
          if (def && def.jobId !== jobId) {
            const baseId = def.id.replace(`_${def.jobId}`, '');
            const newId = `${baseId}_${jobId}`;
            const newDef = getMitigationsFromStore().find(m => m.id === newId);
            if (newDef && newDef.jobId === jobId) { acc.push({ ...mit, mitigationId: newId }); return acc; }
          }
          return acc;
        }, []);
      }
    }

    if (jobId === 'sch' && !hasAnyAetherflow(memberId, currentMitigations)) {
      currentMitigations.push(...buildScholarAutoInserts(memberId, currentMitigations, state.timelineEvents));
    }
    if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, currentMitigations)) {
      currentMitigations.push(...buildAstrologianAutoInserts(memberId, currentMitigations, state.timelineEvents));
    }
  });

  return { partyMembers: currentMembers, timelineMitigations: currentMitigations };
}
```

(3-2) `updatePartyBulk` アクション本体を置換:

```typescript
                updatePartyBulk: (updates) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeUpdatePartyBulk(get(), updates);
                        const updatedIds = new Set(updates.map(u => u.memberId));
                        const changedMembers = next.partyMembers.filter(m => updatedIds.has(m.id));
                        get()._collabHandlers!.batch([
                            { kind: 'upsert', key: 'partyMembers', items: changedMembers },
                            { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
                        ]);
                        return;
                    }
                    pushHistory();
                    set((state) => computeUpdatePartyBulk(state, updates));
                },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: ソロ回帰 + build**

Run: `npx vitest run src/store; npm run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 updatePartyBulk を batch（members upsert + mitigations replace）へ委譲"
```

---

### Task 9: bulk mitigation 操作 3 種を委譲（②-a 未委譲分）

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

> `clearMitigationsByMember` → `removeItems('timelineMitigations', memberMitIds)` / `clearAllMitigations` → `batch([replace timelineMitigations []])` / `applyAutoPlan` → store が最終 mitigations と warning 更新後 events を計算 → `batch([replace timelineMitigations finalMits, upsert timelineEvents events(warning)])`。

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 bulk mitigation 操作の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    timelineMitigations: [applied({ id: 'a1', ownerId: 'MT' }), applied({ id: 'a2', ownerId: 'H1' })],
    timelineEvents: [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any,
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('clearMitigationsByMember は当該メンバーの mit id を removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearMitigationsByMember('MT');
    expect(h.removeItems).toHaveBeenCalledWith('timelineMitigations', ['a1']);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2); // 直変更なし
  });

  it('clearAllMitigations は timelineMitigations を replace [] する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearAllMitigations();
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops).toEqual([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2); // 直変更なし
  });

  it('applyAutoPlan は mitigations replace + events の warning を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const newMits = [applied({ id: 'auto1', ownerId: 'MT' })];
    useMitigationStore.getState().applyAutoPlan({ mitigations: newMits, warnings: ['e1'] });
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const rep = ops.find((o) => o.kind === 'replace' && o.key === 'timelineMitigations');
    expect(rep.items.some((m: any) => m.id === 'auto1')).toBe(true);
    const evUp = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineEvents');
    expect(evUp.items.find((e: any) => e.id === 'e1').warning).toBe(true);
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id)).toEqual(['a1', 'a2']); // 直変更なし
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

(3-1) module スコープに `computeApplyAutoPlan` を追加（既存 `applyAutoPlan` の `set` 本体を逐語コピーし `state` 引数化）:

```typescript
/** ②-b-2: applyAutoPlan のソロ計算を抽出（collab/ソロ共有）。最終 mitigations（学者/占星補完込み）と warning 更新後 events。 */
function computeApplyAutoPlan(
  state: Pick<MitigationState, 'partyMembers' | 'timelineEvents'>,
  mitigations: AppliedMitigation[],
  warnings: string[],
): { timelineMitigations: AppliedMitigation[]; timelineEvents: TimelineEvent[] } {
  let finalMitigations = [...mitigations];
  for (const member of state.partyMembers) {
    if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, finalMitigations)) {
      finalMitigations.push(...buildScholarAutoInserts(member.id, finalMitigations, state.timelineEvents));
    }
    if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, finalMitigations)) {
      finalMitigations.push(...buildAstrologianAutoInserts(member.id, finalMitigations, state.timelineEvents));
    }
  }
  return {
    timelineMitigations: finalMitigations,
    timelineEvents: state.timelineEvents.map(e => ({ ...e, warning: warnings.includes(e.id) })),
  };
}
```

(3-2) `clearMitigationsByMember` アクション本体を置換:

```typescript
                clearMitigationsByMember: (memberId) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const ids = get().timelineMitigations.filter(m => m.ownerId === memberId).map(m => m.id);
                        get()._collabHandlers!.removeItems('timelineMitigations', ids);
                        return;
                    }
                    pushHistory();
                    set((state) => ({
                        timelineMitigations: state.timelineMitigations.filter(m => m.ownerId !== memberId)
                    }));
                },
```

(3-3) `clearAllMitigations` アクション本体を置換:

```typescript
                clearAllMitigations: () => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.batch([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
                        return;
                    }
                    pushHistory();
                    set({ timelineMitigations: [] });
                },
```

(3-4) `applyAutoPlan` アクション本体を置換:

```typescript
                applyAutoPlan: ({ mitigations, warnings }) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const next = computeApplyAutoPlan(get(), mitigations, warnings);
                        get()._collabHandlers!.batch([
                            { kind: 'replace', key: 'timelineMitigations', items: next.timelineMitigations },
                            { kind: 'upsert', key: 'timelineEvents', items: next.timelineEvents.map(e => ({ id: e.id, warning: e.warning })) },
                        ]);
                        return;
                    }
                    pushHistory();
                    set((state) => computeApplyAutoPlan(state, mitigations, warnings));
                },
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: ソロ回帰 + build**

Run: `npx vitest run src/store; npm run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 clearMitigationsByMember/clearAllMitigations/applyAutoPlan を委譲"
```

---

### Task 10: restoreFromSnapshot を collab 中 no-op ガード

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

> 設計書 §8: 部屋の seed が正なので、collab 中の全置換経路（`restoreFromSnapshot`）を塞ぐ。`resetForTutorial`（既存 L1499 でガード済）/ `initializeParty`（本体が空＝no-op）は確認のみ。

- [ ] **Step 1: 失敗するテストを書く**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②-b-2 restoreFromSnapshot ガード', () => {
  it('collab 中は restoreFromSnapshot が状態を変えない（no-op）', () => {
    useMitigationStore.setState({
      partyMembers: [{ id: 'MT', jobId: 'pld', role: 'tank', stats: { hp: 1, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: {} }] as any,
      timelineEvents: [{ id: 'keep', time: 1, name: { ja: 'k' }, damageType: 'magical' }] as any,
      _collabActive: false, _collabHandlers: null,
    });
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().restoreFromSnapshot({
      currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
      partyMembers: [], myMemberId: null, myJobHighlight: false, hideEmptyRows: true,
    } as any);
    expect(useMitigationStore.getState().timelineEvents).toBe(before); // 変化なし
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（restoreFromSnapshot が timelineEvents を [] に置換する）

- [ ] **Step 3: 実装する**

`restoreFromSnapshot` の本体先頭（`const currentLevel = get().currentLevel;` の直前）にガードを追加:

```typescript
                restoreFromSnapshot: (snapshot: TutorialSnapshot) => {
                    // ②-b-2: 共同編集中は部屋の seed が唯一の正。チュートリアル復元で無言 desync させない。
                    if (get()._collabActive) return;
                    const currentLevel = get().currentLevel;
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage2b2 restoreFromSnapshot を collab 中 no-op ガード"
```

---

### Task 11: worker 永続化に partyMembers を追加

**Files:**
- Modify: `workers/collab/src/yjsPlanData.ts`
- Test: `workers/collab/src/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`workers/collab/src/yjsPlanData.test.ts` の `seed` fixture に `partyMembers` を追加し、欠落フォールバックの assert も追加する。

`seed` 定義の `schAetherflowPatterns: { H2: 2 },` の直後に追加:

```typescript
  partyMembers: [{ id: "MT", jobId: "pld", role: "tank", stats: { hp: 100, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: { Rampart: 20 } }],
```

「欠落フィールドは空配列/undefined にフォールバック」テストの `expect(out.memos).toEqual([]);` の直後に追加:

```typescript
    expect(out.partyMembers).toEqual([]);
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts`
Expected: FAIL（`readPlanDataFull` の戻りに `partyMembers` が無く `toEqual(seed)` が不一致）

- [ ] **Step 3: 実装する**

`workers/collab/src/yjsPlanData.ts` を編集。

(3-1) キー定数。`export const MEMOS_KEY = "memos";` の直後に追加:

```typescript
export const PARTY_MEMBERS_KEY = "partyMembers";
```

(3-2) `PlanDataSeed` interface の `memos?: PlanRecord[];` の直後に追加:

```typescript
  partyMembers?: PlanRecord[];
```

(3-3) `buildSeedDocFull` 内、`pushAll(doc, MEMOS_KEY, seed.memos);` の直後に追加:

```typescript
    pushAll(doc, PARTY_MEMBERS_KEY, seed.partyMembers);
```

(3-4) `readPlanDataFull` 内、`memos: readAll<PlanRecord>(doc, MEMOS_KEY),` の直後に追加:

```typescript
    partyMembers: readAll<PlanRecord>(doc, PARTY_MEMBERS_KEY),
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts`
Expected: PASS

- [ ] **Step 5: worker 全体の緑 + 型を確認**

Run: `cd workers/collab; npx vitest run; npx tsc -b`
Expected: PASS（33+ テスト緑 / 型エラーなし。`collabPersistence.ts` の `SeedResultFull`/`postPlanData` は `PlanDataSeed` 継承・`...payload` 送信のため partyMembers を自動授受。`server.ts` は無改変）

- [ ] **Step 6: コミット**

```bash
git add workers/collab/src/yjsPlanData.ts workers/collab/src/yjsPlanData.test.ts
git commit -m "feat(collab): stage2b2 worker 永続化に partyMembers seed/save を追加"
```

---

### Task 12: Vercel _logic に partyMembers を追加

**Files:**
- Modify: `api/collab/_logic.ts`
- Test: `src/lib/__tests__/collabLogic.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/collabLogic.test.ts` の `describe('decideLoadFull...')` 内を更新する。

`data` fixture の `schAetherflowPatterns: { H2: 2 },` の直後に追加:

```typescript
    partyMembers: [{ id: 'MT', jobId: 'pld', role: 'tank', stats: { hp: 1, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: {} }],
```

`'live → 全要素を返す...'` テストの 1 つ目の `expect(decideLoadFull({ data })).toEqual({...})` の中、`schAetherflowPatterns: data.schAetherflowPatterns,` の直後に追加:

```typescript
      partyMembers: data.partyMembers,
```

2 つ目の `expect(decideLoadFull({ data: {} })).toEqual({...})` の中、`currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined,` の行を以下に置換:

```typescript
      currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined, partyMembers: [],
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: FAIL（戻りに `partyMembers` が無い）

- [ ] **Step 3: 実装する**

`api/collab/_logic.ts` を編集。

(3-1) `PlanDocSnapshotFull` の `data` 内、`schAetherflowPatterns?: unknown;` の直後に追加:

```typescript
    partyMembers?: unknown[];
```

(3-2) `LoadResultFull` の live バリアント、`schAetherflowPatterns?: unknown;` の直後に追加:

```typescript
      partyMembers: unknown[];
```

(3-3) `decideLoadFull` の return オブジェクト、`schAetherflowPatterns: d.schAetherflowPatterns,` の直後に追加:

```typescript
    partyMembers: d.partyMembers ?? [],
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add api/collab/_logic.ts src/lib/__tests__/collabLogic.test.ts
git commit -m "feat(collab): stage2b2 decideLoadFull に partyMembers を追加"
```

---

### Task 13: Vercel _saveHandler に partyMembers を追加

**Files:**
- Modify: `api/collab/_saveHandler.ts`

> `_saveHandler` は firebase-admin 依存のハンドラで単体テストが無い（純ロジックは `_logic` 側）。`Array.isArray` ガードで「未送信フィールドは触らない」を踏襲し、`data.partyMembers` 部分更新を追加する。検証は build（tsc）緑で行う。

- [ ] **Step 1: body 分解に partyMembers を追加**

`const { planId: bodyPlanId, roomToken, mitigations,` で始まる分割代入の `timelineEvents, phases, labels, memos, currentLevel, aaSettings, schAetherflowPatterns } =` を以下に置換:

```typescript
    timelineEvents, phases, labels, memos, currentLevel, aaSettings, schAetherflowPatterns, partyMembers } =
```

直後の型注釈ブロック内、`currentLevel?: number; aaSettings?: unknown; schAetherflowPatterns?: unknown;` を以下に置換:

```typescript
      currentLevel?: number; aaSettings?: unknown; schAetherflowPatterns?: unknown; partyMembers?: unknown[];
```

- [ ] **Step 2: data 部分更新に partyMembers を追加**

`if (schAetherflowPatterns !== undefined) update['data.schAetherflowPatterns'] = schAetherflowPatterns;` の直後に追加:

```typescript
    if (Array.isArray(partyMembers)) update['data.partyMembers'] = partyMembers;
```

- [ ] **Step 3: build で型を確認**

Run: `npm run build`
Expected: PASS（tsc -b 厳密。`.js` 拡張子 import 等は無改変なので問題なし）

- [ ] **Step 4: コミット**

```bash
git add api/collab/_saveHandler.ts
git commit -m "feat(collab): stage2b2 _saveHandler に data.partyMembers 部分更新を追加"
```

---

### Task 14: 全体回帰検証（root + worker + build）

**Files:**
- 変更なし（検証のみ）

- [ ] **Step 1: root 単体テスト全実行**

Run: `npx vitest run`
Expected: 既知 5 失敗（`src/__tests__/housing/TopBar.test.tsx` 4 件 + `HousingWorkspace.test.tsx` 1 件）**のみ**。collab 系（yjsPlanData / useMitigationStore.collab / collabLogic）はすべて緑。②-a/③/②-b-1 の既存 collab テストも緑。

> ⚠ `useMitigationStore` 系が vmThreads 汚染で落ちたら、`npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts` を単独実行して緑を確認する（[[reference_vitest_vmthreads_hang]]）。

- [ ] **Step 2: worker 全テスト + 型**

Run: `cd workers/collab; npx vitest run; npx tsc -b`
Expected: PASS（全緑 / 型エラーなし）

- [ ] **Step 3: build（tsc 厳密）**

Run: `npm run build`
Expected: PASS（未使用変数・型不足なし。[[feedback_vercel_tsc_strict]]）

- [ ] **Step 4: dormant 確認（UI 入口が増えていないこと）**

Run: `npx vitest run` の結果と `git diff --stat main` を確認。`collabProvider` を import する UI コンポーネントが新規に増えていない（②-b-1 と同じく `startCollabSession` の呼び出し元は未結線）。push / `wrangler deploy` はユーザー承認まで**保留**。

- [ ] **Step 5: TODO.md を更新**

[docs/TODO.md](../../TODO.md) の「リアルタイム共同編集」セクションの ②-b-1 行の後に ②-b-2 完了を追記し、「現在の状態」の collab 進捗を更新する（②-b-2 完了で PlanData 全要素ライブ同期エンジン完成、次は ⑤-3b ジョイナー閲覧）。100 行以内を維持。

- [ ] **Step 6: 最終コミット**

```bash
git add docs/TODO.md
git commit -m "docs(collab): 段取り②-b-2（partyMembers ライブ同期）実装完了を TODO へ反映"
```

---

## Self-Review（プラン作成後の自己点検結果）

**1. Spec coverage（設計書 §ごと）:**
- §3 partyMembers の Y 表現（新キー・id 単位マージ・computedValues 保存キャッシュ）→ Task 1（PARTY_MEMBERS_KEY/PlanArrayKey）+ Task 3（Y.Array 結線）+ Task 4（受信時ローカル再計算）✅
- §4.1 単純変更（updateMemberStats/applyDefaultStats → upsertItems）→ Task 5 ✅
- §4.2 ジョブ変更カスケード（batch・setMemberJob/changeMemberJobWithMitigations/updatePartyBulk）→ Task 6/7/8 ✅
- §4.3 bulk mitigation（clearMitigationsByMember/clearAllMitigations/applyAutoPlan）→ Task 9 ✅
- §4 末尾 PlanArrayKey に timelineMitigations 追加 → Task 1 ✅
- §5 反映（_applyPartyMembersFromCollab・_applyMetaFromCollab 整合）→ Task 4 ✅
- §6 永続化 additive（worker/Vercel load/save に partyMembers）→ Task 11/12/13 ✅
- §7 同期しないもの（myMemberId 等）→ 変更しない（委譲対象外・現状維持）✅
- §8 監査ガード（restoreFromSnapshot no-op、initializeParty/resetForTutorial 確認）→ Task 10 ✅
- §9 テスト方針（純ロジック/store 委譲/worker・Vercel 永続化/非破壊回帰）→ 各タスクの TDD + Task 14 ✅
- §10 dormant/デプロイ保留 → Task 14 Step 4 ✅

**2. Placeholder scan:** 各コード step に実コードを記載。「TBD」「適切に」等のプレースホルダ無し。✅

**3. Type consistency:**
- `BatchOp = { kind, key, items?, ids? }` を Task 1 で定義 → Task 2（CollabHandlers.batch）/ Task 6-9（store の batch 呼び出し）で同一形状を使用。✅
- `PlanArrayKey` リテラル（'partyMembers' / 'timelineMitigations'）を Task 1 で追加 → 全 batch op の `key` で一致使用。✅
- `applyReplace` / `applyBatch` / `buildArrByKey` を Task 1 で定義 → Task 3 で使用、命名一致。✅
- `computeSetMemberJob` / `computeChangeMemberJobWithMitigations` / `computeUpdatePartyBulk` / `computeDefaultStatsMembers` / `computeApplyAutoPlan` / `memberJobBatchOps` の命名が定義タスクと使用箇所で一致。✅
- `_applyPartyMembersFromCollab` の命名が型宣言（Task 4）/ collabProvider（Task 3）/ テストで一致。✅
- worker `partyMembers?: PlanRecord[]`（PlanDataSeed）と Vercel `partyMembers?: unknown[]`（PlanDocSnapshotFull）は別パッケージで意図的に別表現（worker は id+任意、Vercel は unknown[]）。授受 JSON は同一。✅

> 注（実装者向け）: `MitigationState` 型名・`getXxxFromStore` getter 名・`DEFAULT_TANK_STATS`/`DEFAULT_HEALER_STATS` 定数名は実ファイルの綴りに合わせる（このプランは現行 [src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts) の綴りを引用済み）。抽出ヘルパを置く module スコープ位置は、既存ヘルパ（`hasAnyAetherflow` 等）と同じブロックに揃える。
