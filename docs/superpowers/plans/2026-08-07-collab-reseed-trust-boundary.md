# 共同編集: reseed信頼境界の修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集の空上書き防御(`reseedEmptyDocFields`)が手元データの持ち主を検証せず、無関係なプランのデータを他人のルームへ書き込んでしまう既存バグを、3層の対策(札の永続化・起動時の食い違い検出・接続直前の信頼確認ガード)で塞ぐ。

**Architecture:** `useMitigationStore._loadedPlanId`(データの持ち主を示す札)を永続化対象に加え、起動時のブートストラップ処理(`bootstrapMitigation.ts`)に「札と `currentPlanId` の食い違い検出」を追加し、共同編集の接続直前(`collabProvider.ts`)に「札が指すプランの部屋と接続先が一致するか」を確認する新規ガード(`collabReseed.ts` の `canTrustLocalDataForRoom`)を追加する。副作用として見つかった `useCollabSessionStore.reissue()` の順序バグ(このガードが無いと自分自身の正当な再発行を誤ってブロックしてしまう)も同時に直す。

**Tech Stack:** TypeScript / React / Zustand(persist middleware) / Yjs / Vitest

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md`(承認・コミット済み `d052b7e8`)。判断に迷ったらこの設計書を正とする。
- **実装対象は worktree**: `C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\collab-owner-link-and-live-capacity`(ブランチ `worktree-collab-owner-link-and-live-capacity`)。**サブエージェントは worktree の切替を引き継がない**ため、各タスクの最初に必ず `cd /d "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\collab-owner-link-and-live-capacity"`(PowerShellなら `Set-Location`)してから `git rev-parse --show-toplevel` と `git branch --show-current` で worktree に居ることを確認すること。メインリポジトリ(`C:\Users\masay\Desktop\FF14Sim`)側のファイルは一切変更しない。
- 各タスクは TDD(先に失敗するテストを書く→実装→テストが通ることを確認→コミット)。
- 既存テストを壊さない。特に `src/lib/collab/__tests__/collabProvider.readonly.test.ts` の既存7ケースは、型変更(`roomToken` 必須化)に追従させる必要がある(Task 3 に明記)。
- コメント・コミットメッセージは日本語。既存コードの `[LoPo]` ログprefix規約に従う。
- このブランチは、この一連の修正が完了し検証が取れるまで本番pushしない(ユーザーとの既存合意)。各タスクのコミットはローカルのみで良い(pushしない)。
- 型チェックは厳密(`tsc -b`)。未使用importや暗黙anyを残さない。

---

### Task 1: `_loadedPlanId` を永続化対象に追加する

**Files:**
- Modify: `src/store/useMitigationStore.ts:1818-1834`(`partialize`)
- Test: `src/store/__tests__/useMitigationStore.loadedPlanId.test.ts`(既存ファイルに追記)

**Interfaces:**
- Consumes: なし(既存の `_loadedPlanId: string | null` フィールド、`useMitigationStore.ts:106-107`)
- Produces: `_loadedPlanId` が zustand persist の永続化対象に含まれる(以降のタスクはこれを前提にできる)

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useMitigationStore.loadedPlanId.test.ts` の末尾(48行目の `});` の直前)に追記:

```ts
  it('_loadedPlanId は partialize(永続化対象)に含まれる(再読込をまたいで持ち歩くため)', () => {
    useMitigationStore.setState({ _loadedPlanId: 'plan-X' });
    const partialize = useMitigationStore.persist.getOptions().partialize;
    const persisted = partialize ? partialize(useMitigationStore.getState()) : {};
    expect((persisted as { _loadedPlanId?: string | null })._loadedPlanId).toBe('plan-X');
  });
```

- [ ] **Step 2: テストが失敗することを確認**

```
cd /d "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\collab-owner-link-and-live-capacity"
npx vitest run src/store/__tests__/useMitigationStore.loadedPlanId.test.ts
```
Expected: 新しいテストが `undefined` !== `'plan-X'` で FAIL。他の既存4ケースは PASS のまま。

- [ ] **Step 3: 最小実装**

`src/store/useMitigationStore.ts:1818-1834` の `partialize` に1行追加する(既存の `progress: state.progress,` の直後):

```ts
            partialize: (state: MitigationState) => ({
                currentLevel: state.currentLevel,
                timelineEvents: state.timelineEvents,
                timelineMitigations: state.timelineMitigations,
                phases: state.phases,
                labels: state.labels,
                partyMembers: state.partyMembers,
                schAetherflowPatterns: state.schAetherflowPatterns,
                aaSettings: state.aaSettings,
                myMemberId: state.myMemberId,
                myJobHighlight: state.myJobHighlight,
                hideEmptyRows: state.hideEmptyRows,
                showRowBorders: state.showRowBorders,
                timelineSortOrder: state.timelineSortOrder,
                memos: state.memos,
                progress: state.progress,
                // データ安全(2026-08-07): 持ち主の札も再読込をまたいで持ち歩く。
                // これが無いと起動のたびに null に戻り、誤った札の貼り直しを招く。
                _loadedPlanId: state._loadedPlanId,
            }),
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/store/__tests__/useMitigationStore.loadedPlanId.test.ts
```
Expected: 全5ケース PASS。

- [ ] **Step 5: コミット**

```
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.loadedPlanId.test.ts
git commit -m "fix(collab): _loadedPlanIdを永続化対象に追加(データ安全監査①)"
```

---

### Task 2: `canTrustLocalDataForRoom` 純粋関数を追加する

**Files:**
- Modify: `src/lib/collab/collabReseed.ts`
- Test: `src/lib/collab/__tests__/collabReseed.test.ts`(既存ファイルに追記)

**Interfaces:**
- Consumes: なし(型 `SavedPlan` は `../../types` からimport)
- Produces: `canTrustLocalDataForRoom(args: { loadedPlanId: string | null; roomToken: string; plans: SavedPlan[] }): boolean` — Task 3 がこれを呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/collab/__tests__/collabReseed.test.ts` の末尾(42行目の直後)に追記:

```ts
import { canTrustLocalDataForRoom } from '../collabReseed';

describe('canTrustLocalDataForRoom (reseed 実行前の持ち主確認・2026-08-07データ安全監査)', () => {
  const plans = [{ id: 'plan1', activeCollabRoomToken: 'room1' }] as any;

  it('loadedPlanId が指すプランの部屋トークンと接続先が一致 → 信頼する', () => {
    expect(canTrustLocalDataForRoom({ loadedPlanId: 'plan1', roomToken: 'room1', plans })).toBe(true);
  });

  it('loadedPlanId が null(まだ確定していない) → 信頼しない', () => {
    expect(canTrustLocalDataForRoom({ loadedPlanId: null, roomToken: 'room1', plans })).toBe(false);
  });

  it('loadedPlanId が指すプランがローカルに無い(削除済み等) → 信頼しない', () => {
    expect(canTrustLocalDataForRoom({ loadedPlanId: 'missing', roomToken: 'room1', plans })).toBe(false);
  });

  it('プランの activeCollabRoomToken が接続先と異なる → 信頼しない', () => {
    expect(canTrustLocalDataForRoom({ loadedPlanId: 'plan1', roomToken: 'other-room', plans })).toBe(false);
  });

  it('プランに activeCollabRoomToken が無い(collab-OFF) → 信頼しない', () => {
    const offPlans = [{ id: 'plan1' }] as any;
    expect(canTrustLocalDataForRoom({ loadedPlanId: 'plan1', roomToken: 'room1', plans: offPlans })).toBe(false);
  });
});
```

`import` 文はファイル先頭の既存 import(`import { describe, it, expect } from 'vitest';` と `import { fieldsNeedingReseed, RESEED_FIELDS, type FieldCounts } from '../collabReseed';`)の直後に置く(1行目・2行目の下)。

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/lib/collab/__tests__/collabReseed.test.ts
```
Expected: `canTrustLocalDataForRoom is not a function` で FAIL。既存の `fieldsNeedingReseed` テスト5件は PASS のまま。

- [ ] **Step 3: 実装**

`src/lib/collab/collabReseed.ts` の末尾に追記(ファイル先頭に `import type { SavedPlan } from '../../types';` も追加):

```ts
// ファイル先頭、既存コメントの直後に追加
import type { SavedPlan } from '../../types';
```

```ts
// ファイル末尾に追加

/**
 * データ安全(2026-08-07監査): 手元データ(loadedPlanId が指すプラン)が、今から接続する
 * 部屋(roomToken)のものだと信頼してよいかを判定する。false のときは reseedEmptyDocFields を
 * 呼ばない(部屋への書き込みだけを止める。sync 自体は継続され、部屋の真のデータで手元は
 * 上書きされるので、共同編集自体は問題なく始まる)。
 * 詳細: docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md
 */
export function canTrustLocalDataForRoom(args: {
  loadedPlanId: string | null;
  roomToken: string;
  plans: SavedPlan[];
}): boolean {
  const { loadedPlanId, roomToken, plans } = args;
  if (!loadedPlanId) return false;
  const plan = plans.find((p) => p.id === loadedPlanId);
  if (!plan) return false;
  return plan.activeCollabRoomToken === roomToken;
}
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/lib/collab/__tests__/collabReseed.test.ts
```
Expected: 全10ケース(既存5+新規5) PASS。

- [ ] **Step 5: コミット**

```
git add src/lib/collab/collabReseed.ts src/lib/collab/__tests__/collabReseed.test.ts
git commit -m "feat(collab): reseed前の持ち主確認 canTrustLocalDataForRoom を追加(データ安全監査②)"
```

---

### Task 3: `applyRoomToStore` に接続直前ガードを組み込む

**Files:**
- Modify: `src/lib/collab/collabProvider.ts:1-26`(import)、`:163-189`(`applyRoomToStore`)、`:449`(呼び出し元)
- Test: `src/lib/collab/__tests__/collabProvider.readonly.test.ts`(既存7ケースを型に追従させ、新規2ケースを追加)

**Interfaces:**
- Consumes: `canTrustLocalDataForRoom`(Task 2, `./collabReseed`)、`usePlanStore.getState().plans: SavedPlan[]`(`../../store/usePlanStore`)
- Produces: `applyRoomToStore(doc, opts)` の `opts` に `roomToken: string` が必須で追加される(この関数を呼ぶ全箇所が対象。呼び出し元はこのファイル内の1箇所のみ)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/collab/__tests__/collabProvider.readonly.test.ts` を丸ごと次の内容に置き換える(既存7ケースは `roomToken` を追加、`beforeEach` に `usePlanStore` リセットを追加、末尾に新規2ケースを追加):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { usePlanStore } from "../../../store/usePlanStore";
import { applyRoomToStore } from "../collabProvider";
import { setMetaField, META_CONTENT_ID, META_OWNER_LABEL, MITIGATIONS_KEY, PARTY_MEMBERS_KEY } from "../yjsPlanData";
import type { AppliedMitigation, PartyMember } from "../../../types";

const mit = (id: string): AppliedMitigation => ({ id, mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT" } as AppliedMitigation);
const member = (id: string): PartyMember => ({ id, jobId: "war", role: "tank", stats: {}, computedValues: {}, mode: "tank" } as unknown as PartyMember);

describe("applyRoomToStore(読み取り専用 sync 反映)", () => {
  beforeEach(() => {
    useMitigationStore.setState({
      _collabActive: false, _collabHandlers: null, _loadedPlanId: null,
      timelineMitigations: [], timelineEvents: [], phases: [], labels: [], memos: [], partyMembers: [],
    });
    usePlanStore.setState({ plans: [] } as any);
  });

  it("readOnly=true は enterCollabMode を呼ばない(編集を Y に流さない)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any });
    expect(spy).not.toHaveBeenCalled();
    expect(useMitigationStore.getState()._collabActive).toBe(false);
    spy.mockRestore();
  });

  it("readOnly=false は enterCollabMode を呼ぶ(従来オーナー経路)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("contentId を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_CONTENT_ID, "m4s");
    const onContentId = vi.fn();
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any, onContentId });
    expect(onContentId).toHaveBeenCalledWith("m4s");
  });

  it("ownerLabel を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_OWNER_LABEL, "土曜固定P");
    const onOwnerLabel = vi.fn();
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any, onOwnerLabel });
    expect(onOwnerLabel).toHaveBeenCalledWith("土曜固定P");
  });

  // #7 データ安全(絶対に破壊しない): 空の部屋で手元の中身が消えてはいけない。
  it("オーナー・空の部屋・手元に中身あり・持ち主が一致 → 手元を消さず、部屋を手元から再シードする", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1"), mit("a2")],
      partyMembers: [member("MT")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "room1" }] as any });
    const doc = new Y.Doc(); // 完全に空(seed 失敗/保存前再接続を模擬)
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
    // 手元データは保持される(空で上書きされない)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["a1", "a2"]);
    // 部屋は手元から再シードされる(id 単位・増殖なし=2件)。
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(2);
    expect(doc.getArray(PARTY_MEMBERS_KEY).length).toBe(1);
  });

  it("オーナー・部屋に中身あり → 通常どおり部屋スナップショットを適用(手元を上書き)", () => {
    useMitigationStore.setState({ timelineMitigations: [mit("local-only")] });
    const doc = new Y.Doc();
    doc.getArray(MITIGATIONS_KEY).push([(() => { const y = new Y.Map(); y.set("id", "room1"); y.set("mitigationId", "rampart_pld"); y.set("time", 10); y.set("duration", 20); y.set("ownerId", "MT"); return y; })()]);
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    // 部屋が真実 → 手元は部屋の内容で置き換わる(空でないので再シードしない)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["room1"]);
  });

  it("オーナー・空の部屋・手元も空 → 再シードせず空のまま(誤った復活をしない)", () => {
    const doc = new Y.Doc();
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(0);
  });

  // データ安全(2026-08-07監査): 手元データの持ち主が接続先の部屋と一致しないときの新規ガード。
  it("オーナー・空の部屋・手元に中身あり・持ち主が不一致 → 再シードをスキップ(他人の部屋を汚さない)", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1"), mit("a2")],
      partyMembers: [member("MT")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "other-room" }] as any });
    const doc = new Y.Doc();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
    // 部屋へは書き込まれない(誤った持ち主のデータを他人の部屋へ流さない)。
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(0);
    // 手元データ自体は消えない(ローカルにはそのまま残る)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["a1", "a2"]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("持ち主が不一致でも enterCollabMode は呼ばれる(共同編集自体は始まる。部屋の真のデータで手元は直後に上書きされる)", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "other-room" }] as any });
    const doc = new Y.Doc();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/lib/collab/__tests__/collabProvider.readonly.test.ts
```
Expected: 型エラー(`roomToken` が `applyRoomToStore` の型に無い)、または実行時に新規2ケースが FAIL(`canTrustLocalDataForRoom` 未使用のため不一致判定が起きず、常に再シードされてしまう)。

- [ ] **Step 3: 実装**

`src/lib/collab/collabProvider.ts:13行目`(既存 import)を変更:

```ts
import { fieldsNeedingReseed, RESEED_FIELDS, canTrustLocalDataForRoom } from './collabReseed';
```

`src/lib/collab/collabProvider.ts:3行目の直後`に import を追加:

```ts
import { usePlanStore } from '../../store/usePlanStore';
```

`src/lib/collab/collabProvider.ts:163-177行目` を次のように置き換え:

```ts
export function applyRoomToStore(
  doc: Y.Doc,
  opts: { readOnly: boolean; roomToken: string; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void; onOwnerLabel?: (label: string | undefined) => void },
): void {
  if (!opts.readOnly) {
    const store = useMitigationStore.getState();
    store.enterCollabMode(opts.handlers);
    // データ安全(絶対に破壊しない): 部屋が空(seed 失敗 / 保存間引き中の再接続 / ハイバネ復帰で
    // 揃わない 等)なのに手元に中身がある「構造フィールド」は、空スナップショットで潰さず手元を
    // 正として再シードする。**部分的な空(例: 軽減だけ空・イベントは残る)も対象**(これが今回の
    // データ破壊の真因で、旧実装は「丸ごと空」しか守れていなかった)。applyUpsert = id 一致は部分
    // 更新・新規のみ push = 列増殖しない。再シード後は doc が手元と一致するので、下の apply-all を
    // 空が潰すことはない(早期 return 不要)。サーバ側 emptyOverwriteSkips と対の多重防御。
    // 2026-08-07データ安全監査: 上記は「手元データ=このプランのもの」という前提を無条件に
    // 信頼していたため、無関係なプランのデータが他人の部屋へ混入する経路があった。接続直前に
    // 持ち主を確認し、一致するときだけ再シードする(不一致でも enterCollabMode 自体は続行し、
    // 直後の apply-all で部屋の真のデータが手元に反映されるので共同編集は問題なく始まる)。
    const trusted = canTrustLocalDataForRoom({
      loadedPlanId: store._loadedPlanId,
      roomToken: opts.roomToken,
      plans: usePlanStore.getState().plans,
    });
    if (trusted) {
      reseedEmptyDocFields(doc, store);
    } else {
      console.warn('[LoPo][collab] 手元データの持ち主が接続先の部屋と一致しないため、空上書き防御をスキップしました', {
        loadedPlanId: store._loadedPlanId, roomToken: opts.roomToken,
      });
    }
  }
```

`src/lib/collab/collabProvider.ts:449行目`(`onSynced` 内の呼び出し)を変更:

```ts
    applyRoomToStore(doc, { readOnly, roomToken, handlers, onContentId: opts.onContentId, onOwnerLabel: opts.onOwnerLabel });
```

(`roomToken` は `startCollabSession(roomToken: string, opts)` 自身の第1引数として既にスコープ内にあるので、そのまま渡すだけでよい。)

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/lib/collab/__tests__/collabProvider.readonly.test.ts
```
Expected: 全9ケース(既存7+新規2) PASS。

- [ ] **Step 5: 型チェック**

```
npx tsc -b --noEmit
```
Expected: エラー0件(このタスクで触った箇所に起因するエラーが無いこと)。

- [ ] **Step 6: コミット**

```
git add src/lib/collab/collabProvider.ts src/lib/collab/__tests__/collabProvider.readonly.test.ts
git commit -m "fix(collab): reseed実行前に手元データの持ち主を確認するガードを追加(データ安全監査③)"
```

---

### Task 4: `useCollabSessionStore.reissue()` の順序修正

**Files:**
- Modify: `src/store/useCollabSessionStore.ts:98-109`
- Test: `src/store/__tests__/useCollabSessionStore.test.ts`(既存ファイルに追記)

**Interfaces:**
- Consumes: なし(既存の `reissue` アクション本体の順序変更のみ)
- Produces: `reissue()` 実行時、`startCollabSession(...)` が呼ばれる**前**に `usePlanStore` 側の `activeCollabRoomToken` が新トークンへ更新済みになる(Task 3 のガードが自分自身の再発行を誤ってブロックしないために必要)。

**背景**: Task 3 のガードをそのまま適用すると、`reissue()` は接続の瞬間まだ `plan.activeCollabRoomToken` が古いトークンのままなので、オーナー自身の正当な「リンク再発行」操作が誤って「不一致」と判定され、再発行した部屋にデータが再シードされず空のままになる回帰を生む。`start()`(`useCollabSessionStore.ts:51-65`)は既に「先に `updatePlan`、後で `startCollabSession`」の順序になっており、`reissue()` だけ逆順になっている。`reissue()` を `start()` と同じ順序に揃える。

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useCollabSessionStore.test.ts` の172行目(`reissue` の既存テストの直後、173行目の `});` の直前)に追記:

```ts
  it('reissue: startCollabSession が呼ばれる時点で、既に新トークンが plan 側に反映されている(順序の回帰防止・データ安全監査④)', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'old', maxParticipants: 8, session: fakeSession() });
    mk(reissueRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    usePlanStore.setState({
      currentPlanId: 'plan1',
      plans: [{
        id: 'plan1', ownerId: 'uid1', ownerDisplayName: 'Owner', title: 'p',
        contentId: null, isPublic: false, copyCount: 0, useCount: 0,
        data: { timelineEvents: [], timelineMitigations: [], phases: [], partyMembers: [], labels: [], memos: [] },
        createdAt: 0, updatedAt: 0, activeCollabRoomToken: 'old',
      }],
    } as any);
    let tokenAtConnectTime: string | undefined;
    mk(startCollabSession).mockImplementation(() => {
      tokenAtConnectTime = usePlanStore.getState().plans.find((p) => p.id === 'plan1')?.activeCollabRoomToken;
      return fakeSession();
    });

    await useCollabSessionStore.getState().reissue('plan1');

    expect(tokenAtConnectTime).toBe('new'); // 接続の瞬間には、既に新トークンへ更新済み
  });
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/store/__tests__/useCollabSessionStore.test.ts
```
Expected: 新規テストが `tokenAtConnectTime` が `'old'` のままで FAIL(`toBe('new')` に一致しない)。既存12ケースは PASS のまま。

- [ ] **Step 3: 実装**

`src/store/useCollabSessionStore.ts:98-109` を次のように置き換え:

```ts
  reissue: async (planId, label) => {
    get().session?.disconnect();
    const info = await reissueRoom(planId, label);
    const { startCollabSession } = await loadProvider();
    // 非同期の間に別プランへ移っていたら張り直さない(現在表示プラン束縛)。
    const { usePlanStore } = await import('./usePlanStore');
    if (usePlanStore.getState().currentPlanId !== planId) return;
    // #6 + データ安全(2026-08-07監査④): 新トークン + 引き継いだ上限をローカル plan へ
    // *先に* 反映してから接続する(start() と同じ順序)。reseed の信頼確認
    // (collabProvider.canTrustLocalDataForRoom)は接続時点の activeCollabRoomToken を見るため、
    // 先に更新しないと自分自身の再発行を誤って「不一致」と判定してしまう。
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: info.roomToken, collabMaxParticipants: info.maxParticipants });
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
  },
```

(変更点: `updatePlan(...)` の呼び出しを `startCollabSession(...)` より前に移動しただけ。他の行・順序は変更しない。)

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/store/__tests__/useCollabSessionStore.test.ts
```
Expected: 全13ケース(既存12+新規1) PASS。

- [ ] **Step 5: コミット**

```
git add src/store/useCollabSessionStore.ts src/store/__tests__/useCollabSessionStore.test.ts
git commit -m "fix(collab): reissueのplan更新をstartCollabSessionより前に(データ安全監査④)"
```

---

### Task 5: `shouldRestoreMitigationFromPlan` に食い違い検出を追加する

**Files:**
- Modify: `src/lib/bootstrapMitigation.ts`
- Test: `src/lib/__tests__/bootstrapMitigation.test.ts`(既存ファイルを更新)

**Interfaces:**
- Consumes: なし
- Produces: `shouldRestoreMitigationFromPlan(args: { currentPlanId: string | null; plan: SavedPlan | undefined; mitigationSnapshot: PlanData; loadedPlanId: string | null }): boolean` — 引数に `loadedPlanId` が新規追加(必須)。Task 6 がこの新シグネチャで呼ぶ。

**背景**: 起動時、`_loadedPlanId`(札)が具体的な値を持ち、かつ `currentPlanId` と食い違っているときは、`shouldRestoreMitigationFromPlan` が「復元すべき」を返すようにする。札が未設定(`null`)のとき(=この修正配信直後の全既存ユーザーの初回起動)は今まで通り「復元不要」のまま(データ・挙動とも無変化)。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/bootstrapMitigation.test.ts` を丸ごと次の内容に置き換える(既存5ケースに `loadedPlanId: null` を追加、末尾に新規2ケースを追加):

```ts
import { describe, it, expect } from 'vitest';
import { shouldRestoreMitigationFromPlan } from '../bootstrapMitigation';
import type { PlanData, SavedPlan } from '../../types';

function emptyData(): PlanData {
    return {
        currentLevel: 100,
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        partyMembers: [],
        aaSettings: { damage: 0, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
    } as PlanData;
}

function nonEmptyData(): PlanData {
    return { ...emptyData(), partyMembers: [{ id: 'm1' } as any] } as PlanData;
}

function makePlan(data: PlanData): SavedPlan {
    return {
        id: 'fixed', ownerId: 'local', ownerDisplayName: 'Guest', contentId: 'fru',
        title: 'T', isPublic: false, copyCount: 0, useCount: 0, data,
        createdAt: 0, updatedAt: 0,
    } as SavedPlan;
}

/**
 * 起動時 desync 復旧 (hydration gate / bootstrapping):
 * currentPlanId は非空プランを指すのに作業ストアが空 = desync → プランデータを復元すべき。
 * 2026-08-07データ安全監査: 札(loadedPlanId)が currentPlanId と食い違うときも復元すべき。
 */
describe('shouldRestoreMitigationFromPlan (起動時 desync 復旧判定)', () => {
    it('非空プランを指すのに作業ストアが空なら復元すべき (desync 検出)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(true);
    });

    it('作業ストアが非空なら復元しない (= 通常リロード時の最新編集を捨てない)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('プランも空なら復元しない (復元しても無意味)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(emptyData()),
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('currentPlanId が null なら復元しない', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: null,
            plan: undefined,
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('プランが見つからない (undefined) なら復元しない', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: undefined,
            mitigationSnapshot: emptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('札が未設定(null)・作業ストア非空 → 復元しない(この修正配信直後の全既存ユーザーの初回起動と同じ状態。データを一切触らない)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: null,
        })).toBe(false);
    });

    it('札が currentPlanId と食い違う・作業ストア非空 → 復元すべき(データ安全監査⑤: マルチタブ desync 検出)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: 'other-plan',
        })).toBe(true);
    });

    it('札が currentPlanId と一致・作業ストア非空 → 復元しない(正常な状態)', () => {
        expect(shouldRestoreMitigationFromPlan({
            currentPlanId: 'fixed',
            plan: makePlan(nonEmptyData()),
            mitigationSnapshot: nonEmptyData(),
            loadedPlanId: 'fixed',
        })).toBe(false);
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```
npx vitest run src/lib/__tests__/bootstrapMitigation.test.ts
```
Expected: 型エラー(`loadedPlanId` が引数の型に無い)、または新規2ケースが FAIL。

- [ ] **Step 3: 実装**

`src/lib/bootstrapMitigation.ts` の全体を次の内容に置き換え:

```ts
import type { PlanData, SavedPlan } from '../types';
import { isEmptyPlanData } from './isEmptyPlanData';

/**
 * 起動時 desync 復旧の判定 (hydration gate / bootstrapping)。
 *
 * 背景: プランのデータは 2 つの localStorage (plan.data と mitigation-storage) に
 * 二重保存されており、片方だけ消える/退避すると desync する。currentPlanId は
 * 非空プランを指すのに作業ストア (MitigationStore) が空 = desync。この状態を放置すると
 * 画面が空のまま見え、さらに空上書きの引き金になる。
 *
 * 真実は plan.data 側 (Firestore 同期される保存データ) なので、作業ストアが空のときだけ
 * plan.data を作業ストアへ復元する。作業ストアが非空のとき (= 通常リロードで最新編集が
 * 残っている) は復元しない (= 最新編集を捨てない)。
 *
 * 2026-08-07データ安全監査: 作業ストアが非空でも、「今表示中のデータの持ち主」を示す札
 * (loadedPlanId)が currentPlanId と食い違っているときは復元すべき。マルチタブ+リロードで
 * 別プランのデータに currentPlanId のラベルだけが誤って貼られる desync を検出するため
 * (詳細: docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md)。
 * loadedPlanId が null(=まだ一度も確定していない。この修正配信直後の全既存ユーザーの
 * 初回起動が該当)のときは、食い違い扱いにせず今まで通り復元しない(データ・挙動とも無変化)。
 */
export function shouldRestoreMitigationFromPlan(args: {
    currentPlanId: string | null;
    plan: SavedPlan | undefined;
    mitigationSnapshot: PlanData;
    loadedPlanId: string | null;
}): boolean {
    const { currentPlanId, plan, mitigationSnapshot, loadedPlanId } = args;
    if (!currentPlanId || !plan) return false;
    // プランが非空なのに作業ストアが空 = desync → 復元
    if (!isEmptyPlanData(plan.data) && isEmptyPlanData(mitigationSnapshot)) return true;
    // 札が具体的な値を持ち、かつ currentPlanId と食い違う = 誤った持ち主の疑い → 復元
    if (loadedPlanId !== null && loadedPlanId !== currentPlanId) return true;
    return false;
}
```

- [ ] **Step 4: テストが通ることを確認**

```
npx vitest run src/lib/__tests__/bootstrapMitigation.test.ts
```
Expected: 全8ケース(既存5+新規3、うち1件は「札一致」の明示テストとして追加済み) PASS。

- [ ] **Step 5: コミット**

```
git add src/lib/bootstrapMitigation.ts src/lib/__tests__/bootstrapMitigation.test.ts
git commit -m "fix(collab): 起動時ブートストラップに札の食い違い検出を追加(データ安全監査⑤)"
```

---

### Task 6: `Layout.tsx` の起動時 effect に `loadedPlanId` を渡す

**Files:**
- Modify: `src/components/Layout.tsx:234-250`

**Interfaces:**
- Consumes: `shouldRestoreMitigationFromPlan`(Task 5 の新シグネチャ、`../lib/bootstrapMitigation`)
- Produces: なし(このタスクが末端。Layout.tsx 自体のユニットテストはこのプロジェクトに存在しないため、Task 5 のテストで検証済みのロジックを実際の起動経路に配線するだけの変更)

**背景**: Task 5 で `shouldRestoreMitigationFromPlan` に `loadedPlanId` 引数が必須になったため、この関数を呼んでいる唯一の箇所(`Layout.tsx` の起動時 `useEffect`)を追従させる。ロジック自体は Task 5 で完結しているため、ここでの変更は「呼び出し時に `loadedPlanId` を渡す」の1行追加のみ。

- [ ] **Step 1: 現状のコードを確認**

`src/components/Layout.tsx:234-250` の現状:

```ts
    React.useEffect(() => {
        const { currentPlanId, plans } = usePlanStore.getState();
        const plan = plans.find(p => p.id === currentPlanId);
        if (shouldRestoreMitigationFromPlan({
            currentPlanId,
            plan,
            mitigationSnapshot: useMitigationStore.getState().getSnapshot(),
        }) && plan?.data) {
            isRemoteLoadingRef.current = true;
            useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId!);
            isRemoteLoadingRef.current = false;
        } else if (currentPlanId) {
            // 通常起動: 作業ストア(persist 復元済)は currentPlanId を表している → 持ち主を記録。
            // これが無いと初回保存で _loadedPlanId=null となり保存がスキップされる。
            useMitigationStore.getState().setLoadedPlanId(currentPlanId);
        }
    }, []);
```

この時点でこのコードは Task 5 の型変更により `tsc -b` でエラーになっているはず(`loadedPlanId` が無い)。次のステップで確認する。

- [ ] **Step 2: 型エラーが出ることを確認**

```
npx tsc -b --noEmit
```
Expected: `src/components/Layout.tsx` の `shouldRestoreMitigationFromPlan(...)` 呼び出しで、`loadedPlanId` が無いという型エラーが出る。

- [ ] **Step 3: 実装**

`src/components/Layout.tsx:234-250` を次のように置き換え(`mitigationSnapshot` の行の直後に1行追加するだけ):

```ts
    React.useEffect(() => {
        const { currentPlanId, plans } = usePlanStore.getState();
        const plan = plans.find(p => p.id === currentPlanId);
        if (shouldRestoreMitigationFromPlan({
            currentPlanId,
            plan,
            mitigationSnapshot: useMitigationStore.getState().getSnapshot(),
            // データ安全(2026-08-07監査): 札(_loadedPlanId)と currentPlanId の食い違いも
            // ここで検出させる(マルチタブ desync 対策。詳細は bootstrapMitigation.ts 参照)。
            loadedPlanId: useMitigationStore.getState()._loadedPlanId,
        }) && plan?.data) {
            isRemoteLoadingRef.current = true;
            useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId!);
            isRemoteLoadingRef.current = false;
        } else if (currentPlanId) {
            // 通常起動: 作業ストア(persist 復元済)は currentPlanId を表している → 持ち主を記録。
            // これが無いと初回保存で _loadedPlanId=null となり保存がスキップされる。
            useMitigationStore.getState().setLoadedPlanId(currentPlanId);
        }
    }, []);
```

- [ ] **Step 4: 型チェックとテストスイート全体を確認**

```
npx tsc -b --noEmit
npm run test
```
Expected: 型エラー0件。全テストスイート PASS(Task 1〜5 のテスト含む)。

- [ ] **Step 5: コミット**

```
git add src/components/Layout.tsx
git commit -m "fix(collab): 起動時effectに札の食い違い検出を配線(データ安全監査⑥)"
```

---

### Task 7: 最終ゲート(build + フルテスト)、TODO.md 更新

**Files:**
- Modify: `docs/TODO.md`(worktree 側。0-1番の項目を更新)

**Interfaces:**
- Consumes: Task 1〜6 の全変更
- Produces: なし(最終検証とドキュメント更新)

- [ ] **Step 1: フルビルド**

```
cd /d "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\collab-owner-link-and-live-capacity"
npm run build
```
Expected: exit code 0。`tsc -b` / `tsc -p tsconfig.api.json` / `vite build` いずれもエラー0件。

- [ ] **Step 2: フルテスト**

```
npm run test
```
Expected: 全テストスイート PASS(既知のlegacy失敗5件=TopBar4+HousingWorkspace1、および環境依存のEphemeralAddPanel.test 7件失敗は対象外・従来から既知。それ以外は全てPASSであること)。

- [ ] **Step 3: `docs/TODO.md` の該当項目を更新**

`docs/TODO.md` の項目「0-1」(オーナー自動判別+人数変更確定ボタン)の直後、または新規行として、reseed信頼境界の修正が完了したことを追記する。具体的な文面はこの時点の TODO.md の実際の内容を読んでから、既存の記法(`✅`/日付/詳細ファイルへのリンク)に合わせて追記すること(TODO.md は頻繁に更新されるため、本計画作成時点の内容をそのまま転記しない)。

- [ ] **Step 4: コミット**

```
git add docs/TODO.md
git commit -m "docs: reseed信頼境界バグの修正完了をTODO.mdに反映"
```

- [ ] **Step 5: ユーザーへ報告**

この時点で、①本ブランチの6タスク完了済み機能(オーナー自動判別+人数変更確定ボタン)と②今回のreseed信頼境界修正(Task 1〜6)の両方が揃った状態になる。ユーザーとの既存合意により、ここまで完了して初めて本番pushの判断をユーザーに仰ぐ(このタスク自体はpushしない。ユーザーへの報告と承認待ちで終了)。
