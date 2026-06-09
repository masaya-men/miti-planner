# 共同編集 段取り⑤-3b: ジョイナー読み取り専用ライブビュー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 招待リンク `/collab/:roomToken` を開くと、その共同編集部屋の軽減表が SavedPlan に紐づかない一時ワークスペースで **リアルタイム・読み取り専用** に表示され、ページ離脱で完全クリアされる(ジョイナー自身の Firestore/localStorage を一切汚さない)。

**Architecture:** `/share` の一時ビューを「ライブ購読版」にする。`startCollabSession(roomToken, { readOnly })` は `enterCollabMode` を呼ばず observe だけ張る購読者モード。`contentId` は不変属性なので Yjs の planMeta に seed として 1 回だけ載せて運ぶ(save には載せない)。データ漏洩防止は二層: ①ジョイナー専用ページが Layout の自動保存シェルを通らない ②`useMitigationStore` の persist を `_collabReadonly` フラグで skip し、退室時に `rehydrate()` で元のソロ状態を復元する。

**Tech Stack:** React 18 + React Router v6, Zustand (`persist` middleware), Yjs / y-partyserver (worker), Vitest(root は `pool:'vmThreads'`), Vercel Node Functions(`api/collab/*`・相対 import は `.js` 必須), Cloudflare DO worker。

**設計書(正典):** [docs/superpowers/specs/2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md](../specs/2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md)

---

## 前提・既存実装(読んで把握)

- ルーター: [src/App.tsx](../../../src/App.tsx)(React Router v6・`/miti`=`MitiPlannerPage`・`/share/:shareId`=`SharePage`)。
- 一時ビュー前例: [src/components/SharePage.tsx](../../../src/components/SharePage.tsx)(スナップショットを SavedPlan 化せず表示)。
- 表描画: [src/components/Timeline.tsx](../../../src/components/Timeline.tsx)(`useMitigationStore` から描画。`currentContentId` は [L1166](../../../src/components/Timeline.tsx#L1166) で `usePlanStore` の選択中プランから取得)。
- 読み取り専用描画の参考: [src/components/MitigationSheetPreview.tsx](../../../src/components/MitigationSheetPreview.tsx)(編集アフォーダンス無しの静的表)。
- 自動保存(Firestore + localStorage): [src/components/Layout.tsx](../../../src/components/Layout.tsx)(store subscribe [L266-293](../../../src/components/Layout.tsx#L266) / plan subscribe [L329-337](../../../src/components/Layout.tsx#L329) / beforeunload [L297-306](../../../src/components/Layout.tsx#L297) / visibility [L312-322](../../../src/components/Layout.tsx#L312) / 定期 [L340-345](../../../src/components/Layout.tsx#L340)。`_collabActive` ガード [L228](../../../src/components/Layout.tsx#L228))。
- **⚠ store の localStorage persist**: [src/store/useMitigationStore.ts:1590-1638](../../../src/store/useMitigationStore.ts#L1590)。storage wrapper の setItem は **tutorial 中だけ skip するガード**を既に持つ([L1600 付近](../../../src/store/useMitigationStore.ts#L1600))。partialize は全 PlanData を含む。→ **store を変更すると自動で localStorage に書く**(ジョイナーの最大リスク)。
- collab エンジン: [src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts) `startCollabSession`(onSynced で `enterCollabMode` + 初期 `_apply*`)、[yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts) `readPlanMeta`、worker [yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts) `buildSeedDocFull`/`readPlanDataFull`、worker [collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts) `fetchSeedFull`/`SeedResultFull`、Vercel [_loadHandler.ts](../../../api/collab/_loadHandler.ts)/[_logic.ts](../../../api/collab/_logic.ts) `decideLoadFull`。
- contentId は Firestore プラン doc の **top-level**([planService.ts:84-95](../../../src/lib/planService.ts#L84) `fromFirestore` が `data.contentId`(=doc top-level)を読む。`data.data` が PlanData)。

## File Structure(触るファイル)

**ブランチ統合(Task 0):** ⑤-3a + ②-b-2 を合流(`collabProvider.ts` 衝突解消)。

**エンジン拡張(contentId seed・additive):**
- `api/collab/_logic.ts` — `decideLoadFull` が `contentId` を返す。
- `api/collab/_loadHandler.ts` — プラン doc top-level `contentId` を読み seed に含める(spread 済なので _logic だけで足りるか確認)。
- `workers/collab/src/yjsPlanData.ts` — `PlanDataSeed.contentId` + `META_CONTENT_ID` を planMeta に seed(read は save 用なので contentId を返さない)。
- `workers/collab/src/collabPersistence.ts` — `SeedResultFull` に contentId(継承で自動)。
- `src/lib/collab/yjsPlanData.ts` — planMeta から contentId を読む `readContentId`。

**読み取り専用セッション:**
- `src/lib/collab/collabProvider.ts` — `startCollabSession(roomToken, opts?: { readOnly?: boolean })`。

**store 漏洩防止:**
- `src/store/useMitigationStore.ts` — `_collabReadonly` フラグ + persist setItem ガード拡張 + `setCollabReadonly`。

**ジョイナー一時状態:**
- `src/store/useCollabJoinerSession.ts`(新規) — `{ roomToken, contentId }` set/clear。

**UI:**
- `src/components/Timeline.tsx` — `currentContentId` のジョイナーフォールバック + 読み取り専用ゲート。
- `src/components/CollabJoinerPage.tsx`(新規) — ルートページ + ライフサイクル + 状態表示。
- `src/components/CollabJoinerShell.tsx`(新規・必要なら) — Layout の自動保存を通さない薄いシェル。
- `src/App.tsx` — `/collab/:roomToken` ルート。

## 検証コマンド
- client 単体: `npx vitest run <path>`
- store: `npx vitest run src/store`
- Vercel ロジック: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
- worker: `cd workers/collab; npx vitest run; npx tsc -b`
- 全 root(最後): `npx vitest run`(既知5失敗=TopBar4+HousingWorkspace1 のみ)
- build: `npm run build`

> ⚠ root vitest は `pool:'vmThreads'`。出力をパイプしない。`useMitigationStore` 系は同時実行で vmThreads 汚染し得る(単独でも確認)。

---

### Task 0: ブランチ統合(⑤-3a + ②-b-2 合流・collabProvider 衝突解消)

**Files:** リポジトリ全体(git 操作 + 衝突解消)。TDD ではなく統合手順。

- [ ] **Step 1: ②-b-2 を main に dormant 取り込み(エンジン・UI非露出)**

```bash
git checkout main
git merge --no-ff feat/collab-stage2b2-partymembers-sync -m "merge(collab): stage2b2 partyMembers同期エンジンを main へ dormant 取り込み"
```
Expected: 競合なし(②-b-2 は main の ②-b-1 上に作ったため)。push しない(保留)。

- [ ] **Step 2: ⑤-3b 作業ブランチを ⑤-3a の上に作成**

```bash
git checkout feat/collab-stage5-3a-owner-entry
git checkout -b feat/collab-stage5-3b-joiner-view
```

- [ ] **Step 3: main(エンジン込み)を統合**

```bash
git merge --no-ff main -m "merge(collab): stage5-3b に ②-b エンジンを統合"
```
Expected: [src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts) で **衝突**(⑤-3a=`startCollabSession(planId→roomToken)` 署名 / ②-b-2=`partyMembers`/`batch`/`buildArrByKey`/`applyBatch` 追加)。他に `collabTypes.ts`/`useMitigationStore.ts`/`yjsPlanData.ts` も衝突しうる。

- [ ] **Step 4: 衝突解消(両方の変更を残す)**

方針:
- `collabProvider.ts`: 関数署名は **⑤-3a の `startCollabSession(roomToken)`** を採用しつつ、本体は **②-b-2 の partyMembers/batch/buildArrByKey/applyBatch を全て含める**。`YProvider` の room 名は roomToken。observe/handlers/disconnect は両者の和集合(partyMembers observer + batch handler + roomToken 接続)。
- `collabTypes.ts`/`yjsPlanData.ts`/`useMitigationStore.ts`: ②-b-2 の追加(batch/partyMembers/compute*)と ⑤-3a の追加(roomToken 関連)を **両方残す**(機能が直交するため論理衝突は基本なし。テキスト衝突のみ解消)。
- 解消後:

```bash
npm run build
npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts src/lib/collab/__tests__/yjsPlanData.test.ts
```
Expected: build 緑 / collab 単体緑。

- [ ] **Step 5: 統合点の回帰確認 + コミット**

```bash
npx vitest run
git add -A && git commit -m "merge(collab): stage5-3a + ②-b エンジン統合(collabProvider 衝突解消)"
```
Expected: 既知5失敗のみ。push しない(保留)。

> 以降の Task は全て `feat/collab-stage5-3b-joiner-view` 上で行う。push/deploy は ⑤-3 完成 + 承認まで保留。

---

### Task 1: 受付係 load が contentId を返す

**Files:**
- Modify: `api/collab/_logic.ts`
- Test: `src/lib/__tests__/collabLogic.test.ts`

- [ ] **Step 1: 失敗するテスト**

`collabLogic.test.ts` の `decideLoadFull` describe 内、`data` fixture に `contentId` を追加(`partyMembers` の直後):

```typescript
    contentId: 'm4s',
```

live ケースの期待値(1つ目 `toEqual`)に追加:

```typescript
      contentId: 'm4s',
```

欠落ケース(`decideLoadFull({ data: {} })`)の期待値に追加:

```typescript
      contentId: undefined,
```

ただし `decideLoadFull` の引数は `PlanDocSnapshotFull`(`data.*` 構造)。**contentId は doc top-level**なので、テストは `decideLoadFull({ contentId: 'm4s', data } as any)` の形にする。1つ目の live ケースを以下に変更:

```typescript
  it('live → 全要素 + contentId(top-level)を返す', () => {
    expect(decideLoadFull({ contentId: 'm4s', data } as any)).toMatchObject({
      mitigations: data.timelineMitigations,
      partyMembers: data.partyMembers,
      contentId: 'm4s',
    });
    expect(decideLoadFull({ data: {} } as any).contentId).toBeUndefined();
  });
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: FAIL(`contentId` が戻りに無い)

- [ ] **Step 3: 実装**

`api/collab/_logic.ts`:

`PlanDocSnapshotFull` に top-level contentId を追加(`deleted?`/`version?` と同列):

```typescript
export interface PlanDocSnapshotFull {
  deleted?: boolean;
  version?: number;
  contentId?: string;
  data?: {
```

`LoadResultFull` の live バリアントに追加(`partyMembers: unknown[];` の直後):

```typescript
      contentId?: string;
```

`decideLoadFull` の return に追加(`partyMembers: d.partyMembers ?? [],` の直後):

```typescript
    contentId: plan.contentId,
```

- [ ] **Step 4: 通過確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: PASS

- [ ] **Step 5: _loadHandler が contentId を渡すことを確認**

[api/collab/_loadHandler.ts](../../../api/collab/_loadHandler.ts) は `decideLoadFull(plan)` の結果を `{ ...result, maxParticipants }` で返す。`plan` は `snap.data() as PlanDocSnapshotFull` なので **top-level contentId が自動で result に乗る**(`decideLoadFull` が `plan.contentId` を読む)。コード変更不要。`PlanDocSnapshotFull` 型に contentId を足したことで tsc が通る。

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add api/collab/_logic.ts src/lib/__tests__/collabLogic.test.ts
git commit -m "feat(collab): stage5-3b 受付係 load が contentId(top-level)を返す"
```

---

### Task 2: worker が contentId を planMeta に seed(save には載せない)

**Files:**
- Modify: `workers/collab/src/yjsPlanData.ts`, `workers/collab/src/collabPersistence.ts`
- Test: `workers/collab/src/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテスト**

`workers/collab/src/yjsPlanData.test.ts` の `seed` fixture に追加(`partyMembers` の直後):

```typescript
  contentId: "m4s",
```

往復テストを調整(contentId は seed されるが readPlanDataFull は返さない):

```typescript
  it("buildSeedDocFull で組んだ Y.Doc を readPlanDataFull で読むと元に一致(contentId は save 非対象で除外)", () => {
    const doc = buildSeedDocFull(seed);
    const { contentId, ...rest } = seed;
    expect(readPlanDataFull(doc)).toEqual(rest);
  });
  it("contentId は planMeta に seed され readContentId で読める", () => {
    const doc = buildSeedDocFull(seed);
    expect(readContentId(doc)).toBe("m4s");
  });
```

import に `readContentId` を追加:

```typescript
import { buildSeedDocFull, readPlanDataFull, readContentId, type PlanDataSeed } from "./yjsPlanData";
```

- [ ] **Step 2: 失敗確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts`
Expected: FAIL(`readContentId` 未 export)

- [ ] **Step 3: 実装**

`workers/collab/src/yjsPlanData.ts`:

META キー定数を追加(`META_SCH` の直後):

```typescript
export const META_CONTENT_ID = "contentId";
```

`PlanDataSeed` に追加(`partyMembers?` の直後):

```typescript
  contentId?: string;
```

`buildSeedDocFull` の planMeta 設定に追加(`schAetherflowPatterns` set の直後):

```typescript
    if (seed.contentId !== undefined) meta.set(META_CONTENT_ID, seed.contentId);
```

`readPlanDataFull` は **変更しない**(contentId を返さない = save に載らない)。

末尾に reader を追加:

```typescript
/** seed された contentId(不変属性)を読む。save 経路では使わない。 */
export function readContentId(doc: Y.Doc): string | undefined {
  return doc.getMap(PLAN_META_KEY).get(META_CONTENT_ID) as string | undefined;
}
```

- [ ] **Step 4: 通過確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts`
Expected: PASS

- [ ] **Step 5: collabPersistence が contentId を授受することを確認**

[workers/collab/src/collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts) `SeedResultFull extends PlanDataSeed` なので `contentId` が自動で型に乗り、`fetchSeedFull` の `return body` で透過。`server.ts` `onLoad` → `buildSeedDocFull(seed)` が contentId を planMeta に入れる。コード変更不要。

Run: `cd workers/collab; npx vitest run; npx tsc -b`
Expected: PASS(全緑 / 型緑)

- [ ] **Step 6: コミット**

```bash
git add workers/collab/src/yjsPlanData.ts workers/collab/src/yjsPlanData.test.ts
git commit -m "feat(collab): stage5-3b worker が contentId を planMeta に seed(save 非対象)"
```

---

### Task 3: クライアントが planMeta から contentId を読む

**Files:**
- Modify: `src/lib/collab/yjsPlanData.ts`
- Test: `src/lib/collab/__tests__/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテスト**

`src/lib/collab/__tests__/yjsPlanData.test.ts` の planMeta describe に追加。まず import に `readContentId`, `setMetaField`(既存)を確認。`META_CONTENT_ID` を import に追加:

```typescript
  TIMELINE_EVENTS_KEY, PHASES_KEY, PLAN_META_KEY, META_LEVEL, META_AA, META_SCH, META_CONTENT_ID,
  PARTY_MEMBERS_KEY, MITIGATIONS_KEY, readContentId,
```

planMeta describe 内に追加:

```typescript
  it("readContentId は planMeta の contentId を読む(未設定は undefined)", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    setMetaField(a, META_CONTENT_ID, "m4s");
    expect(readContentId(b)).toBe("m4s");
    expect(readContentId(new Y.Doc())).toBeUndefined();
  });
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: FAIL(`META_CONTENT_ID`/`readContentId` 未 export)

- [ ] **Step 3: 実装**

`src/lib/collab/yjsPlanData.ts`:

`META_SCH` の直後に:

```typescript
export const META_CONTENT_ID = "contentId";
```

末尾(`readPlanMeta` の直後)に:

```typescript
/** seed された contentId(不変・ジョイナーが描画に使う)。save には載らない。 */
export function readContentId(doc: Y.Doc): string | undefined {
  return doc.getMap(PLAN_META_KEY).get(META_CONTENT_ID) as string | undefined;
}
```

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/lib/collab/yjsPlanData.ts src/lib/collab/__tests__/yjsPlanData.test.ts
git commit -m "feat(collab): stage5-3b クライアントが planMeta の contentId を読む"
```

---

### Task 4: 読み取り専用セッション(`startCollabSession` の readOnly オプション)

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`
- Test: `src/lib/collab/__tests__/collabProvider.readonly.test.ts`(新規)

> readOnly のとき `enterCollabMode` を呼ばない(編集を Y に流さない)。observe と初期 `_apply*` は実行(ライブ流入)。sync 後に contentId をコールバックで渡す。

- [ ] **Step 1: 失敗するテスト**

`startCollabSession` は実 WebSocket(YProvider)に繋ぐため、単体テストでは provider 接続部をモックせず、**onSynced 経路のロジックを純粋関数として切り出して**テストする。実装(Step 3)で `applyRoomToStore(doc, { readOnly, onContentId })` を export し、それを単体テストする方針。

新規 `src/lib/collab/__tests__/collabProvider.readonly.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { applyRoomToStore } from "../collabProvider";
import { setMetaField, META_CONTENT_ID } from "../yjsPlanData";

describe("applyRoomToStore(読み取り専用 sync 反映)", () => {
  beforeEach(() => useMitigationStore.setState({ _collabActive: false, _collabHandlers: null, timelineMitigations: [] }));

  it("readOnly=true は enterCollabMode を呼ばない(編集を Y に流さない)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any });
    expect(spy).not.toHaveBeenCalled();
    expect(useMitigationStore.getState()._collabActive).toBe(false);
    spy.mockRestore();
  });

  it("contentId を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_CONTENT_ID, "m4s");
    const onContentId = vi.fn();
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any, onContentId });
    expect(onContentId).toHaveBeenCalledWith("m4s");
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/collab/__tests__/collabProvider.readonly.test.ts`
Expected: FAIL(`applyRoomToStore` 未 export)

- [ ] **Step 3: 実装**

`src/lib/collab/collabProvider.ts`:

import に `readContentId` を追加(yjsPlanData から)。

onSynced のロジックを純粋関数に切り出して export(既存 onSynced 内の処理を移植):

```typescript
/** sync 完了時に部屋状態を store に反映する。readOnly のときは編集委譲(enterCollabMode)をしない。 */
export function applyRoomToStore(
  doc: Y.Doc,
  opts: { readOnly: boolean; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void },
): void {
  const store = useMitigationStore.getState();
  if (!opts.readOnly) {
    store.enterCollabMode(opts.handlers);
  }
  store._applyMitigationsFromCollab(readMitigations(doc));
  const s = useMitigationStore.getState();
  s._applyEventsFromCollab(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY));
  s._applyPhasesFromCollab(readArray<Phase>(doc, PHASES_KEY));
  s._applyLabelsFromCollab(readArray<Label>(doc, LABELS_KEY));
  s._applyMemosFromCollab(readArray<PlanMemo>(doc, MEMOS_KEY));
  s._applyPartyMembersFromCollab(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY));
  s._applyMetaFromCollab(readPlanMeta(doc));
  opts.onContentId?.(readContentId(doc));
}
```

`startCollabSession` に readOnly オプションを追加:

```typescript
export function startCollabSession(
  roomToken: string,
  opts: { readOnly?: boolean; onContentId?: (id: string | undefined) => void } = {},
): CollabSession {
```

(注: Task 0 統合後の署名は `startCollabSession(roomToken)`。第2引数を追加する。)

onSynced 内の初期反映ブロック(`enterCollabMode` + 各 `apply*`)を `applyRoomToStore(doc, { readOnly: opts.readOnly ?? false, handlers, onContentId: opts.onContentId })` の 1 呼び出しに置換。observe 登録/handlers 構築/disconnect は不変(readOnly でも observe は張る = ライブ流入)。

> readOnly のとき handlers は使われない(enterCollabMode しない)が、構築コストは無視できる。observe による `_apply*` は readOnly でも走る(購読)。

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/lib/collab/__tests__/collabProvider.readonly.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: 既存 collab 回帰**

Run: `npx vitest run src/lib/collab src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS(readOnly 既定 false で従来オーナー経路不変)

- [ ] **Step 6: コミット**

```bash
git add src/lib/collab/collabProvider.ts src/lib/collab/__tests__/collabProvider.readonly.test.ts
git commit -m "feat(collab): stage5-3b startCollabSession に readOnly 購読モード + applyRoomToStore"
```

---

### Task 5: store の localStorage persist を `_collabReadonly` で skip + 復元

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

> ジョイナーが部屋データを store に流し込んでも、ジョイナーの localStorage(`mitigation-storage`)を上書きしない。退室時に `rehydrate()` でソロ状態を復元する。

- [ ] **Step 1: 失敗するテスト**

`useMitigationStore.collab.test.ts` 末尾に追加:

```typescript
describe('②/⑤ collab readonly persist ガード', () => {
  beforeEach(() => useMitigationStore.setState({ _collabReadonly: false }));
  it('setCollabReadonly が _collabReadonly を切り替える', () => {
    useMitigationStore.getState().setCollabReadonly(true);
    expect(useMitigationStore.getState()._collabReadonly).toBe(true);
    useMitigationStore.getState().setCollabReadonly(false);
    expect(useMitigationStore.getState()._collabReadonly).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL(`setCollabReadonly` 未定義)

- [ ] **Step 3: 実装**

`src/store/useMitigationStore.ts`:

state 型に追加(`_collabActive: boolean;` の直後):

```typescript
    /** ⑤-3b: ジョイナー読み取り専用中は localStorage persist を skip し、自分の保存データを汚さない。 */
    _collabReadonly: boolean;
    setCollabReadonly: (v: boolean) => void;
```

初期値(`_collabActive: false,` の直後):

```typescript
                _collabReadonly: false,
                setCollabReadonly: (v) => set({ _collabReadonly: v }),
```

persist の storage wrapper(setItem ガード [L1600 付近](../../../src/store/useMitigationStore.ts#L1600))を拡張。既存の tutorial スキップ条件に OR 条件を追加:

```typescript
        // tutorial 中 or ジョイナー読み取り専用中は localStorage に書かない(自分のデータ保護)。
        if (useTutorialStore.getState().isActive || useMitigationStore.getState()._collabReadonly) return;
```

(実際の既存コードの条件式に合わせて `_collabReadonly` を OR で追加。`useMitigationStore` の自己参照は persist storage が store 定義の外側なので型解決可能。読めない場合は module スコープの可変フラグ `let collabReadonlyFlag = false` + `setCollabReadonly` がそれを更新する方式に切替。)

- [ ] **Step 4: 通過確認 + build + 回帰**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts && npm run build && npx vitest run src/store`
Expected: PASS / build 緑 / store 回帰緑

- [ ] **Step 5: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): stage5-3b _collabReadonly で localStorage persist を skip"
```

---

### Task 6: ジョイナー一時セッション store

**Files:**
- Create: `src/store/useCollabJoinerSession.ts`
- Test: `src/store/__tests__/useCollabJoinerSession.test.ts`

- [ ] **Step 1: 失敗するテスト**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useCollabJoinerSession } from "../useCollabJoinerSession";

describe("useCollabJoinerSession", () => {
  beforeEach(() => useCollabJoinerSession.getState().clear());
  it("enter で roomToken をセット・contentId は後から", () => {
    useCollabJoinerSession.getState().enter("tok123");
    expect(useCollabJoinerSession.getState().roomToken).toBe("tok123");
    expect(useCollabJoinerSession.getState().contentId).toBeNull();
    useCollabJoinerSession.getState().setContentId("m4s");
    expect(useCollabJoinerSession.getState().contentId).toBe("m4s");
  });
  it("clear で全リセット", () => {
    useCollabJoinerSession.getState().enter("tok");
    useCollabJoinerSession.getState().setContentId("x");
    useCollabJoinerSession.getState().clear();
    expect(useCollabJoinerSession.getState().roomToken).toBeNull();
    expect(useCollabJoinerSession.getState().contentId).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/store/__tests__/useCollabJoinerSession.test.ts`
Expected: FAIL(モジュール無し)

- [ ] **Step 3: 実装**

`src/store/useCollabJoinerSession.ts`:

```typescript
import { create } from "zustand";

/** ⑤-3b: ジョイナー読み取り専用ビューの一時状態(SavedPlan に紐づかない)。localStorage 非永続。 */
interface CollabJoinerSession {
  roomToken: string | null;
  contentId: string | null;
  enter: (roomToken: string) => void;
  setContentId: (contentId: string | undefined) => void;
  clear: () => void;
}

export const useCollabJoinerSession = create<CollabJoinerSession>((set) => ({
  roomToken: null,
  contentId: null,
  enter: (roomToken) => set({ roomToken, contentId: null }),
  setContentId: (contentId) => set({ contentId: contentId ?? null }),
  clear: () => set({ roomToken: null, contentId: null }),
}));
```

- [ ] **Step 4: 通過確認**

Run: `npx vitest run src/store/__tests__/useCollabJoinerSession.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store/useCollabJoinerSession.ts src/store/__tests__/useCollabJoinerSession.test.ts
git commit -m "feat(collab): stage5-3b ジョイナー一時セッション store"
```

---

### Task 7: Timeline の contentId をジョイナーセッションにフォールバック

**Files:**
- Modify: `src/components/Timeline.tsx`(L1166 付近)
- Test: `src/components/__tests__/Timeline.contentId.test.tsx`(新規・最小)

> SavedPlan が無いジョイナーでも、一時セッションの contentId でボス行動表/ヘッダーが出る。

- [ ] **Step 1: 失敗するテスト(最小・フォールバックの純粋性を検証)**

Timeline は巨大なため、フォールバックロジックを **純粋ヘルパ `resolveContentId(planContentId, joinerContentId)`** に切り出してテストする。新規テスト:

```typescript
import { describe, it, expect } from "vitest";
import { resolveContentId } from "../Timeline";

describe("resolveContentId(ジョイナーフォールバック)", () => {
  it("SavedPlan の contentId を優先", () => {
    expect(resolveContentId("m4s", "other")).toBe("m4s");
  });
  it("SavedPlan が無ければジョイナーセッションの contentId", () => {
    expect(resolveContentId(null, "m4s")).toBe("m4s");
  });
  it("どちらも無ければ null", () => {
    expect(resolveContentId(null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/Timeline.contentId.test.tsx`
Expected: FAIL(`resolveContentId` 未 export)

- [ ] **Step 3: 実装**

`src/components/Timeline.tsx`:

ファイル冒頭付近(コンポーネント外)に純粋ヘルパを追加・export:

```typescript
/** ⑤-3b: contentId 解決。SavedPlan 優先、無ければジョイナー一時セッションの値。 */
export function resolveContentId(planContentId: string | null, joinerContentId: string | null): string | null {
  return planContentId ?? joinerContentId ?? null;
}
```

import に `useCollabJoinerSession` を追加。[L1166](../../../src/components/Timeline.tsx#L1166) を変更:

```typescript
  const joinerContentId = useCollabJoinerSession((s) => s.contentId);
  const currentContentId = resolveContentId(currentPlan?.contentId ?? null, joinerContentId);
```

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/components/__tests__/Timeline.contentId.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/components/__tests__/Timeline.contentId.test.tsx
git commit -m "feat(collab): stage5-3b Timeline contentId をジョイナーセッションにフォールバック"
```

---

### Task 8: Timeline の編集アフォーダンスを readOnly でゲート

**Files:**
- Modify: `src/components/Timeline.tsx`
- Test: `src/components/__tests__/Timeline.readonly.test.tsx`(新規)

> ジョイナー(`useCollabJoinerSession.roomToken !== null`)のとき編集を無効化。読み取り専用判定を 1 つの派生値 `readOnly` にまとめ、各編集ハンドラ冒頭で早期 return + 編集 UI を非表示。

- [ ] **Step 1: 失敗するテスト**

readOnly 判定の純粋ヘルパをテスト:

```typescript
import { describe, it, expect } from "vitest";
import { isJoinerReadonly } from "../Timeline";

describe("isJoinerReadonly", () => {
  it("ジョイナーセッション中(roomToken あり)は true", () => {
    expect(isJoinerReadonly("tok")).toBe(true);
  });
  it("通常(roomToken null)は false", () => {
    expect(isJoinerReadonly(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/Timeline.readonly.test.tsx`
Expected: FAIL(`isJoinerReadonly` 未 export)

- [ ] **Step 3: 実装**

`src/components/Timeline.tsx`:

純粋ヘルパを追加・export:

```typescript
/** ⑤-3b: ジョイナー読み取り専用か(部屋に参加中=編集不可)。 */
export function isJoinerReadonly(roomToken: string | null): boolean {
  return roomToken !== null;
}
```

コンポーネント内で派生値を作る:

```typescript
  const joinerRoomToken = useCollabJoinerSession((s) => s.roomToken);
  const readOnly = isJoinerReadonly(joinerRoomToken);
```

各編集ハンドラの冒頭に `if (readOnly) return;` を追加(投資対象を最小に・調査で特定済):
- セル選択/軽減配置: `MitigationSelector` 起動(クリックハンドラ [L1521/1531 付近](../../../src/components/Timeline.tsx#L1521))。
- イベント追加/編集/削除: `handleAddClick`([L1297](../../../src/components/Timeline.tsx#L1297))・`handleSave`([L1473](../../../src/components/Timeline.tsx#L1473))・`handleDelete`([L1506](../../../src/components/Timeline.tsx#L1506))。
- ジョブ/パーティ編集: `handleJobIconClick`([L1289](../../../src/components/Timeline.tsx#L1289))。
- メモ: `handleMemoSave`([L3102 付近](../../../src/components/Timeline.tsx#L3102))。

編集 UI ボタンを `readOnly` で非表示(条件付きレンダー):
- undo/redo ボタン([L2310-2333](../../../src/components/Timeline.tsx#L2310))。
- イベント追加(+)・phase/label ドロップダウンの編集操作・AA 配置トグル・メモトグル。

> ⚠ Timeline は 3500 行超。実装者は調査の file:line を起点に、各編集起点に `readOnly` ガードを当てる。**1 つでも漏れると読み取り専用が破れる**ため、編集系ハンドラ(`add*`/`update*`/`remove*`/`handle*Save`/`handle*Delete`/`undo`/`redo`)の呼び出し元を grep で全列挙し、各起点でゲートする。store mutation を直接呼ぶ箇所([L584-588 等](../../../src/components/Timeline.tsx#L584))も対象。

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/components/__tests__/Timeline.readonly.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/components/__tests__/Timeline.readonly.test.tsx
git commit -m "feat(collab): stage5-3b Timeline 編集アフォーダンスを readOnly でゲート"
```

---

### Task 9: CollabJoinerPage + ルート + ライフサイクル + 状態表示

**Files:**
- Create: `src/components/CollabJoinerPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/__tests__/CollabJoinerPage.test.tsx`(新規)

> ページの責務: roomToken 抽出 → `setCollabReadonly(true)` + `useCollabJoinerSession.enter` → `startCollabSession(roomToken, { readOnly:true, onContentId })` → 表描画(Layout の自動保存を通さない) → 退室で disconnect + `clear()` + `setCollabReadonly(false)` + `useMitigationStore.persist.rehydrate()`(ソロ状態復元)。状態(接続中/無効/満員)を表示。

- [ ] **Step 1: 失敗するテスト(状態機械の純粋部分)**

接続状態の判定を純粋関数に切り出す。新規テスト `CollabJoinerPage.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { joinerView } from "../CollabJoinerPage";

describe("joinerView(状態 → 表示種別)", () => {
  it("未同期は connecting", () => {
    expect(joinerView({ synced: false, invalid: false, full: false })).toBe("connecting");
  });
  it("invalid(失効/不存在)は invalid", () => {
    expect(joinerView({ synced: true, invalid: true, full: false })).toBe("invalid");
  });
  it("満員は full", () => {
    expect(joinerView({ synced: false, invalid: false, full: true })).toBe("full");
  });
  it("同期済みは sheet", () => {
    expect(joinerView({ synced: true, invalid: false, full: false })).toBe("sheet");
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx`
Expected: FAIL(モジュール無し)

- [ ] **Step 3: 実装**

`src/components/CollabJoinerPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { startCollabSession, type CollabSession } from "../lib/collab/collabProvider";
import { useCollabJoinerSession } from "../store/useCollabJoinerSession";
import { useMitigationStore } from "../store/useMitigationStore";
import Timeline from "./Timeline";

export type JoinerViewKind = "connecting" | "invalid" | "full" | "sheet";

/** ⑤-3b: 接続状態 → 表示種別(純粋・テスト可能)。 */
export function joinerView(s: { synced: boolean; invalid: boolean; full: boolean }): JoinerViewKind {
  if (s.full) return "full";
  if (s.invalid) return "invalid";
  if (!s.synced) return "connecting";
  return "sheet";
}

export default function CollabJoinerPage() {
  const { roomToken } = useParams<{ roomToken: string }>();
  const [synced, setSynced] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!roomToken) { setInvalid(true); return; }
    useMitigationStore.getState().setCollabReadonly(true);
    useCollabJoinerSession.getState().enter(roomToken);
    let session: CollabSession | null = null;
    try {
      session = startCollabSession(roomToken, {
        readOnly: true,
        onContentId: (id) => useCollabJoinerSession.getState().setContentId(id),
      });
      // sync 完了で表示。失効/不存在は seed が空 → 一定時間で invalid 判定(下記)。
      session.provider.on("sync", (isSynced: boolean) => { if (isSynced) setSynced(true); });
      // 満員(⑤-2b)は worker が接続拒否 → provider が接続できない。接続失敗イベントで full 判定。
      // (具体 event 名は y-partyserver provider 実装に合わせ writing-plans/実装で確定。)
    } catch {
      setInvalid(true);
    }
    return () => {
      session?.disconnect();
      useCollabJoinerSession.getState().clear();
      useMitigationStore.getState().setCollabReadonly(false);
      // ジョイナーの localStorage は skip-persist で無傷 → rehydrate で自分のソロ状態を復元。
      void useMitigationStore.persist.rehydrate();
    };
  }, [roomToken]);

  const kind = joinerView({ synced, invalid, full });
  if (kind === "connecting") return <JoinerNotice text="接続中…" />;
  if (kind === "invalid") return <JoinerNotice text="この共同編集リンクは無効です。" />;
  if (kind === "full") return <JoinerNotice text="この部屋は満員です。" />;
  // sheet: Layout を通さず Timeline サブツリーのみ(自動保存・サイドバー・プラン管理なし)。
  return (
    <div className="collab-joiner-shell">
      <Timeline />
    </div>
  );
}

function JoinerNotice({ text }: { text: string }) {
  return <div className="collab-joiner-notice">{text}</div>;
}
```

> ⚠ 実装の確定事項(writing-plans→実装で詰める):
> - **invalid 検知**: seed が deleted のとき worker は空 Y.Doc を返す。クライアントは「sync はしたが空」を invalid と区別する必要がある。受付係 load の deleted を provider 経由で知る術が無い場合、`/collab` 用に **roomToken の有効性を一度 HTTP で確認する軽量 fetch**(例: 既存 `/api/collab/load` を叩く or 新規軽量エンドポイント)を足すか検討。最小実装では「一定時間 sync しなければ invalid/接続失敗」のタイムアウトで代替し、厳密化は後続。
> - **full 検知**: ⑤-2b の `onBeforeConnect` 403 を provider がどう surface するか(接続エラーイベント)に合わせる。
> - **Timeline を Layout 無しで描画**: Timeline が必要とする provider(theme/i18n/skills データ hook)は App ルート上位で供給済みか確認。不足あれば `collab-joiner-shell` 内で最小供給。MobileTriggersContext 等 Layout 専用 context を Timeline が必須参照する場合は、最小のダミー provider を用意(調査: Timeline は `MobileTriggersContext` を参照)。

`src/App.tsx` にルート追加(`/share/:shareId` の直後):

```tsx
            <Route path="/collab/:roomToken" element={<CollabJoinerPage />} />
```

import 追加:

```tsx
import CollabJoinerPage from "./components/CollabJoinerPage";
```

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/components/CollabJoinerPage.tsx src/App.tsx src/components/__tests__/CollabJoinerPage.test.tsx
git commit -m "feat(collab): stage5-3b CollabJoinerPage + /collab/:roomToken ルート + ライフサイクル"
```

---

### Task 10: 全体回帰 + 無漏洩検証 + 非露出確認

**Files:** 検証のみ。

- [ ] **Step 1: root 全単体**

Run: `npx vitest run`
Expected: 既知5失敗(TopBar4 + HousingWorkspace1)のみ。collab/joiner 系・store・Timeline ヘルパ緑。

- [ ] **Step 2: worker + build**

Run: `cd workers/collab; npx vitest run; npx tsc -b`(緑) → `cd ../..; npm run build`(緑)

- [ ] **Step 3: 無漏洩の手動確認(コードレビュー)**

`_collabReadonly` が true の間、persist storage.setItem が早期 return することを [useMitigationStore.ts](../../../src/store/useMitigationStore.ts) で確認。`CollabJoinerPage` の cleanup が `setCollabReadonly(false)` + `persist.rehydrate()` を必ず通ることを確認(early return パスでも)。

- [ ] **Step 4: 非露出確認**

`/collab/:roomToken` への内部ナビ導線(Link/navigate)がアプリ内に無いこと(grep `"/collab/"`)。`startCollabSession` の readOnly 呼び出しは `CollabJoinerPage` のみ。push/main マージ(UI)/worker deploy は ⑤-3 完成 + サーバ認証 + 承認まで保留。

- [ ] **Step 5: TODO.md / memory 更新 + コミット**

[docs/TODO.md](../../TODO.md) collab セクションに ⑤-3b 完了を追記。memory `project_realtime_collab_status` を更新(次=⑤-3c)。

```bash
git add docs/TODO.md
git commit -m "docs(collab): 段取り⑤-3b(ジョイナー読み取り専用ビュー)実装完了を反映"
```

---

## Self-Review(プラン作成後の自己点検)

**1. Spec coverage:**
- §2/§8 ルート `/collab/:roomToken` + 一時ワークスペース → Task 9 ✅
- §4 readOnly 購読セッション(enterCollabMode 呼ばない) → Task 4 ✅
- §5 contentId を seed で配送(load/worker/client) → Task 1/2/3 ✅
- §6 データ漏洩防止(専用ページ + store persist skip + rehydrate) → Task 5/9 ✅(調査で判明した persist leak を Task 5 で手当て)
- §7 contentId フォールバック + readOnly ゲート → Task 7/8 ✅
- §9 状態表示(接続中/無効/満員) → Task 9 ✅
- §10 テスト各層 → 各 Task の TDD + Task 10 ✅
- §11 ブランチ統合(衝突解消) → Task 0 ✅
- §11 push/deploy 保留 → Task 10 Step 4 ✅

**2. Placeholder scan:** エンジン系(Task 1-7)は具体コード。UI 系(Task 8/9)は Timeline 巨大 + provider 依存 + invalid/full 検知の provider イベント名が実装時確定要素のため、**file:line アンカー + 確定方針**を明示し「writing-plans/実装で詰める」項を最小化。これらは実装者が在エディタで確定すべき正当な探索点(プレースホルダではなく、調査済みの起点付き作業)。

**3. Type consistency:** `readContentId`(client/worker 同名・別パッケージ)・`META_CONTENT_ID`・`applyRoomToStore`・`_collabReadonly`/`setCollabReadonly`・`useCollabJoinerSession`(enter/setContentId/clear)・`resolveContentId`/`isJoinerReadonly`/`joinerView` の命名が定義タスクと使用箇所で一致。`startCollabSession(roomToken, opts)` の第2引数は Task 4 で追加、Task 9 で使用。

**未確定で実装時に確定する点(正直な明記):**
- Task 9 の **invalid(失効/不存在)検知**と **full(満員)検知**を y-partyserver provider のどのイベントで拾うか(provider 実装依存)。最小実装はタイムアウト代替 → 後続で厳密化。
- Task 9 の **Timeline を Layout 無しで描画**する際の不足 provider(MobileTriggersContext 等)の最小供給。
- Task 5 の persist ガードを store 自己参照で書くか module フラグで書くか(storage wrapper の評価タイミング次第)。
