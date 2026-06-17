# 共同編集中の Undo/Redo (CRDT 化・②-c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集中もオーナー・参加者が自分の操作だけを Undo/Redo できるようにする（per-user undo を `Y.UndoManager` で実装）。

**Architecture:** `collabProvider` 内で `Y.UndoManager`（scope=5 トップレベル Y 型・`trackedOrigins:['local']`）を生成し、`CollabHandlers.undo/redo` 経由で store から委譲する。ボタン活性は UndoManager の `canUndo/canRedo` を新フラグ `_collabCanUndo`/`_collabCanRedo` で React へ伝える。反映は既存 observeDeep → store 経路のまま。

**Tech Stack:** TypeScript / Zustand / Yjs 13.6.31 (`Y.UndoManager`) / y-partyserver / Vitest / Vite。

設計書: [docs/superpowers/specs/2026-06-17-collab-undo-redo-design.md](../specs/2026-06-17-collab-undo-redo-design.md)

## Global Constraints

- **データ安全最優先**: 既存の防御・保存・スナップショット経路（`reseedEmptyDocFields` / `loadSnapshot` / `_history`/`_future` のソロ経路 / サーバ `emptyOverwriteSkips`）には**一切触れない**。本機能は純粋な追加のみ。
- `trackedOrigins` は必ず `new Set(['local'])`。これ以外を track してはならない（他人の編集を巻き戻す事故防止）。
- UndoManager scope は solo 履歴と同じ **5 型のみ**: `YJS_MITIGATIONS_KEY` / `TIMELINE_EVENTS_KEY` / `PHASES_KEY` / `LABELS_KEY` / `PARTY_MEMBERS_KEY`（memos・planMeta は含めない）。
- `undo`/`redo` 冒頭の `_collabReadonly` 閲覧者ガードは**残す**（多層防御）。
- UndoManager 未生成時は従来どおり no-op（`_collabHandlers?.undo()` の optional 呼び出し）。クラッシュさせない。
- store は yjs を静的 import しない（遅延ロード境界）。yjs 依存は `collabProvider.ts` / `planUndoManager.ts` 等の遅延チャンクのみ。
- push 前に `npm run build`（tsc 厳密）+ `npm run test`（既知 housing failure 5 件のみ許容）必須。
- 日本語でコメント。専用ブランチで作業（main を汚さない）。

---

### Task 1: `planUndoManager` ヘルパ（CRDT undo の核心・安全テスト）

**Files:**
- Create: `src/lib/collab/planUndoManager.ts`
- Test: `src/lib/collab/__tests__/planUndoManager.test.ts`

**Interfaces:**
- Consumes: `yjs`（`Y.UndoManager` / `Y.AbstractType`）。
- Produces:
  - `createPlanUndoManager(scope: Y.AbstractType<unknown>[], onChange: (canUndo: boolean, canRedo: boolean) => void): PlanUndoManager`
  - `interface PlanUndoManager { undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean; destroy(): void; }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/collab/__tests__/planUndoManager.test.ts
import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { appliedToYMap, readMitigations, YJS_MITIGATIONS_KEY } from "../yjsMitigations";
import { createPlanUndoManager } from "../planUndoManager";
import type { AppliedMitigation } from "../../../types";

// 2 ドキュメント同期。リモート適用は origin=ソース doc(オブジェクト)になる
// ＝本番の「リモート=provider オブジェクト」を再現する(yjsMitigations.test と同型)。
function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const sample = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: "m1", mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT", ...over,
});
const scopeOf = (doc: Y.Doc) => [doc.getArray(YJS_MITIGATIONS_KEY)];

describe("planUndoManager", () => {
  it("自分(origin='local')の add を undo で取り消し、redo で復元する", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "a1" }))]), "local");
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["a1"]);
    um.undo();
    expect(readMitigations(doc)).toEqual([]);
    um.redo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["a1"]);
    um.destroy();
  });

  it("他人(リモート origin)の編集は undo で絶対に巻き戻さない【核心の安全保証】", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arrA = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const arrB = b.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(a), () => {}); // A 視点の UndoManager

    a.transact(() => arrA.push([appliedToYMap(sample({ id: "mine" }))]), "local"); // 自分
    b.transact(() => arrB.push([appliedToYMap(sample({ id: "theirs", ownerId: "H1" }))]), "local"); // 他人(A には origin=b で届く)

    expect(readMitigations(a).map((m) => m.id).sort()).toEqual(["mine", "theirs"]);
    um.undo(); // 自分の "mine" だけ取り消される
    expect(readMitigations(a).map((m) => m.id)).toEqual(["theirs"]);
    um.destroy();
  });

  it("transact なし(origin=null)の変更は track しない", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    arr.push([appliedToYMap(sample({ id: "untracked" }))]); // origin=null
    expect(um.canUndo()).toBe(false);
    um.undo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["untracked"]); // 変化なし
    um.destroy();
  });

  it("1 transaction 内の複数変更(カスケード)は 1 回の undo でまとまって戻る", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "keep" }))]), "local");
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    doc.transact(() => {
      const i = readMitigations(doc).findIndex((m) => m.id === "keep");
      arr.delete(i, 1);
      arr.push([appliedToYMap(sample({ id: "new" }))]);
    }, "local");
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["new"]);
    um.undo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["keep"]); // 削除+追加が 1 回で戻る
    um.destroy();
  });

  it("onChange が undo 可否の変化で呼ばれる", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const onChange = vi.fn();
    const um = createPlanUndoManager(scopeOf(doc), onChange);
    doc.transact(() => arr.push([appliedToYMap(sample())]), "local");
    expect(onChange).toHaveBeenCalledWith(true, false); // canUndo=true, canRedo=false
    onChange.mockClear();
    um.undo();
    expect(onChange).toHaveBeenCalledWith(false, true); // canUndo=false, canRedo=true
    um.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/planUndoManager.test.ts`
Expected: FAIL（`createPlanUndoManager` is not exported / module not found）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/collab/planUndoManager.ts
import * as Y from "yjs";

/**
 * 共同編集の CRDT 対応 Undo/Redo(②-c)。
 * Y.UndoManager を trackedOrigins=['local'] で生成し、**自分の操作だけ**を Undo スタックに積む。
 * リモート(origin=provider オブジェクト)の変更は捕捉しない＝他人の編集を巻き戻さない。
 * scope は solo 履歴と同じ 5 トップレベル Y 型を呼び出し側が渡す(memos/meta は対象外)。
 * captureTimeout=0 で 1 transaction=1 Undo 単位(solo の 1 操作=1 履歴と同等・連打でまとめ過ぎない)。
 */
export interface PlanUndoManager {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  destroy(): void;
}

export function createPlanUndoManager(
  scope: Y.AbstractType<unknown>[],
  onChange: (canUndo: boolean, canRedo: boolean) => void,
): PlanUndoManager {
  const um = new Y.UndoManager(scope, {
    trackedOrigins: new Set(["local"]),
    captureTimeout: 0,
  });
  const notify = () => onChange(um.canUndo(), um.canRedo());
  um.on("stack-item-added", notify);
  um.on("stack-item-popped", notify);
  um.on("stack-cleared", notify);
  return {
    undo: () => { um.undo(); },
    redo: () => { um.redo(); },
    canUndo: () => um.canUndo(),
    canRedo: () => um.canRedo(),
    destroy: () => {
      um.off("stack-item-added", notify);
      um.off("stack-item-popped", notify);
      um.off("stack-cleared", notify);
      um.destroy();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/planUndoManager.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/planUndoManager.ts src/lib/collab/__tests__/planUndoManager.test.ts
git commit -m "feat(collab): CRDT undo の核心 planUndoManager(per-user・trackedOrigins=local)"
```

---

### Task 2: store の undo/redo 委譲 + 可否フラグ

**Files:**
- Modify: `src/lib/collab/collabTypes.ts:8-27`（`CollabHandlers` に undo/redo 追加）
- Modify: `src/store/useMitigationStore.ts`（state 型 92-93 付近 / 初期値 543-545 付近 / exitCollabMode 552 / undo 676-698 / redo 701-723）
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`（既存 no-op テスト 2 件を差し替え + 新規）

**Interfaces:**
- Consumes: 既存 `CollabHandlers`、`enterCollabMode`/`exitCollabMode`。
- Produces:
  - `CollabHandlers.undo: () => void` / `CollabHandlers.redo: () => void`
  - store state: `_collabCanUndo: boolean` / `_collabCanRedo: boolean`
  - store action: `_setCollabUndoRedo: (canUndo: boolean, canRedo: boolean) => void`

- [ ] **Step 1: 既存の no-op テストを新挙動へ差し替え + 新規テストを書く**

`src/store/__tests__/useMitigationStore.collab.test.ts` の `describe('②-b-1 collab 中のバルク/履歴経路ガード', ...)` ブロック（249-262 行）を、以下に**置き換える**。あわせて `mockHandlers()`（10-13 行）に `undo`/`redo` を追加する。

`mockHandlers` を以下へ更新（`importBulk` の後にカンマ続けて追加）:
```typescript
const mockHandlers = (): CollabHandlers => ({
  add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
  upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(), batch: vi.fn(),
  undo: vi.fn(), redo: vi.fn(),
});
```

置き換える describe ブロック:
```typescript
describe('②-c collab 中の undo/redo は handlers に委譲する', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineEvents: [{ id: 'e1', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    _collabCanUndo: false, _collabCanRedo: false,
  }));

  it('collab 中の undo は handlers.undo に委譲し、ローカル状態を直接変えない', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().undo();
    expect(h.undo).toHaveBeenCalledTimes(1);
    expect(useMitigationStore.getState().timelineEvents).toBe(before); // 反映は observeDeep 経由のみ
  });

  it('collab 中の redo は handlers.redo に委譲する', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().redo();
    expect(h.redo).toHaveBeenCalledTimes(1);
  });

  it('閲覧者(_collabReadonly)は collab 中でも undo/redo を委譲しない(多層防御)', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.setState({ _collabReadonly: true });
    useMitigationStore.getState().undo();
    useMitigationStore.getState().redo();
    expect(h.undo).not.toHaveBeenCalled();
    expect(h.redo).not.toHaveBeenCalled();
  });

  it('_setCollabUndoRedo がフラグを更新する', () => {
    useMitigationStore.getState()._setCollabUndoRedo(true, false);
    expect(useMitigationStore.getState()._collabCanUndo).toBe(true);
    expect(useMitigationStore.getState()._collabCanRedo).toBe(false);
  });

  it('exitCollabMode で undo/redo 可否フラグが false に戻る', () => {
    useMitigationStore.getState()._setCollabUndoRedo(true, true);
    useMitigationStore.getState().exitCollabMode();
    expect(useMitigationStore.getState()._collabCanUndo).toBe(false);
    expect(useMitigationStore.getState()._collabCanRedo).toBe(false);
  });
});

describe('solo の undo/redo は従来どおりローカル履歴で動く(回帰)', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineEvents: [{ id: 'e1', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _history: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
    _future: [],
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
  }));
  it('collab でない undo はローカル履歴を復元する', () => {
    useMitigationStore.getState().undo();
    expect(useMitigationStore.getState().timelineEvents).toEqual([]); // 履歴(空)へ戻る
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`_setCollabUndoRedo` 未定義 / `CollabHandlers` に undo/redo が無く型エラー / undo が委譲しない）

- [ ] **Step 3: 実装する**

(3-1) `src/lib/collab/collabTypes.ts` の `CollabHandlers`（26 行 `batch` の後）に追加:
```typescript
  // ②-c: CRDT undo/redo(per-user・collabProvider の Y.UndoManager に委譲)
  undo: () => void;
  redo: () => void;
```

(3-2) `src/store/useMitigationStore.ts` の state 型（93 行 `_collabHandlers: CollabHandlers | null;` の直後）に追加:
```typescript
    /** ②-c: 共同編集中の Undo/Redo 可否(Y.UndoManager の canUndo/canRedo を反映・ボタン活性用)。 */
    _collabCanUndo: boolean;
    _collabCanRedo: boolean;
    _setCollabUndoRedo: (canUndo: boolean, canRedo: boolean) => void;
```

(3-3) 初期値（実装 545 行 `_collabReadonly: false,` の直後）に追加:
```typescript
                _collabCanUndo: false,
                _collabCanRedo: false,
                _setCollabUndoRedo: (canUndo, canRedo) => set({ _collabCanUndo: canUndo, _collabCanRedo: canRedo }),
```

(3-4) `exitCollabMode`（実装 552 行）を以下へ変更（可否フラグも戻す）:
```typescript
                exitCollabMode: () => set({ _collabActive: false, _collabHandlers: null, _collabCanUndo: false, _collabCanRedo: false }),
```

(3-5) `undo`（実装 676-698 行）の `_collabActive` no-op 行を委譲へ変更。`if (state._collabActive) return state;` を以下へ置換:
```typescript
                    if (state._collabActive) { state._collabHandlers?.undo(); return state; } // ②-c: CRDT undo へ委譲(反映は observeDeep 経由)
```

(3-6) `redo`（実装 701-723 行）の同様の行 `if (state._collabActive) return state;` を以下へ置換:
```typescript
                    if (state._collabActive) { state._collabHandlers?.redo(); return state; } // ②-c: CRDT redo へ委譲
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS（既存 + 新規すべて緑）

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/collabTypes.ts src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): store の undo/redo を handlers へ委譲 + 可否フラグ(_collabCanUndo/Redo)"
```

---

### Task 3: collabProvider で UndoManager を配線

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`（型取得 228-238 付近 / handlers 262-334 / disconnect 421-445）

**Interfaces:**
- Consumes: `createPlanUndoManager`（Task 1）/ `CollabHandlers.undo/redo`（Task 2）/ `useMitigationStore.getState()._setCollabUndoRedo`（Task 2）。
- Produces: なし（内部配線）。

> このタスクは WebSocket を張る `startCollabSession` 全体の単体テストが困難なため（既存テストも純関数を対象）、自動テストは Task 1/2 でカバー済み。本タスクは型整合（build）と Task 6 の実機 2 タブ検証で担保する。

- [ ] **Step 1: import を追加**

`src/lib/collab/collabProvider.ts` の import 群（19 行付近）に追加:
```typescript
import { createPlanUndoManager, type PlanUndoManager } from './planUndoManager';
```

- [ ] **Step 2: UndoManager を生成（5 型 scope）**

`const arrByKey = buildArrByKey(doc);`（238 行）の直後に追加:
```typescript
  // ②-c: CRDT undo/redo。scope は solo 履歴と同じ 5 トップレベル型(memos/meta は対象外)。
  // trackedOrigins=['local'] で自分の編集だけを積む(planUndoManager 内で設定)。
  // readOnly(閲覧者)でも生成して可(ローカル編集をしないのでスタックは常に空)。
  const planUndo: PlanUndoManager = createPlanUndoManager(
    [yarr, yEvents, yPhases, yLabels, yPartyMembers],
    (canUndo, canRedo) => useMitigationStore.getState()._setCollabUndoRedo(canUndo, canRedo),
  );
```

- [ ] **Step 3: handlers に undo/redo を追加**

`handlers` オブジェクト（262 行〜）の `batch: (ops) => applyBatch(doc, arrByKey, ops),`（333 行）の直後に追加:
```typescript
    // ②-c: CRDT undo/redo。Y.UndoManager が origin='local' の変更だけを逆操作する。
    undo: () => planUndo.undo(),
    redo: () => planUndo.redo(),
```

- [ ] **Step 4: disconnect で後始末**

`disconnect` 内（実装 442 行 `useCollabPresenceStore.getState().clear();` の直後・`provider.destroy();` の前）に追加:
```typescript
    planUndo.destroy(); // ②-c: UndoManager のリスナー解除 + doc afterTransaction ハンドラ除去
    useMitigationStore.getState()._setCollabUndoRedo(false, false); // ボタン活性リセット
```

- [ ] **Step 5: build で型整合を確認**

Run: `npm run build`
Expected: EXIT 0（型エラーなし）

- [ ] **Step 6: Commit**

```bash
git add src/lib/collab/collabProvider.ts
git commit -m "feat(collab): collabProvider で Y.UndoManager を配線(5型scope・disconnectでdestroy)"
```

---

### Task 4: Timeline のボタン活性を collab 対応にする

**Files:**
- Modify: `src/components/Timeline.tsx:602-603`（canUndo/canRedo セレクタ）

**Interfaces:**
- Consumes: store `_collabActive` / `_collabCanUndo` / `_collabCanRedo`（Task 2）。
- Produces: なし。

> 既存の `disabled={!canUndo || readOnly}`（2509/2523/3815/3830 行）はそのまま活きる。`readOnly`（閲覧者）は引き続き無効。本タスクは `canUndo`/`canRedo` の算出元を collab 中だけ切り替えるのみ。

- [ ] **Step 1: セレクタを collab 対応へ変更**

`src/components/Timeline.tsx:602-603` を以下へ置換:
```typescript
    // Undo/Redo可否（リアクティブに監視して disabled 状態を正しく反映する）
    // 共同編集中は Y.UndoManager の可否(_collabCanUndo/Redo)、それ以外はローカル履歴を見る(②-c)。
    const canUndo = useMitigationStore(s => s._collabActive ? s._collabCanUndo : s._history.length > 0);
    const canRedo = useMitigationStore(s => s._collabActive ? s._collabCanRedo : s._future.length > 0);
```

- [ ] **Step 2: build で確認**

Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 3: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(collab): Undo/Redo ボタン活性を共同編集中は UndoManager の可否に連動"
```

---

### Task 5: 全体ビルド/テスト + 実機 2 タブ検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npm run test`
Expected: 既知 housing failure 5 件（`TopBar.test.tsx` 4 + `HousingWorkspace.test.tsx` 1）以外すべて緑。新規 planUndoManager 5 + collab undo/redo 委譲テストが緑。

- [ ] **Step 2: 本番相当ビルド**

Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 3: 実機 2 タブ検証（捨てプランで・本物のユーザーデータに触れない）**

`npm run dev` で起動し、**テスト用の新規プラン**を作成して共有リンクを発行。2 つのブラウザタブ（または通常窓 + シークレット窓）で同じ部屋に編集者として入室し、以下を確認:

- [ ] (a) 自分が軽減を1つ配置 → Ctrl+Z で自分の配置だけ消える / Ctrl+Y（または Ctrl+Shift+Z）で戻る
- [ ] (b) **タブ A で配置した直後、タブ B で Ctrl+Z しても A の配置は消えない**（per-user の核心・他人の編集を巻き戻さない）
- [ ] (c) タブ A の Undo がタブ B の画面にもライブ反映される（observeDeep 経路）
- [ ] (d) Undo/Redo ボタンが、操作可能なときだけ活性（履歴が無いときグレーアウト）
- [ ] (e) 閲覧専用ジョイナー（編集権なしリンク）では Undo/Redo が無効のまま
- [ ] (f) フェーズ/ラベル/メンバージョブ変更/イベントの配置も Undo で戻せる（5 型 scope の確認）
- [ ] (g) 検証後、テスト用プランを削除

- [ ] **Step 4: docs/TODO.md の「現在の状態」に完了を追記**（push せずローカル保持＝次の機能 push に同梱）

- [ ] **Step 5: ブランチ完了処理**（superpowers:finishing-a-development-branch に従いマージ/PR を選択 → デプロイはユーザー確認後）

---

## Self-Review

- **Spec coverage**: §3 方針（per-user / 5型 scope / trackedOrigins=local / captureTimeout=0 / 委譲 / 可否フラグ）→ Task1（UndoManager 生成・scope・origin）/ Task2（委譲・フラグ）/ Task3（配線）/ Task4（活性）で全てカバー。§5 安全策（追加のみ / no-op フォールバック / readonly ガード / destroy / 捨てプラン検証）→ Global Constraints + Task2 Step3(3-5/3-6 の optional `?.`) + Task3 Step4 + Task5 Step3 でカバー。
- **Placeholder scan**: TBD/TODO/「適切な〜」なし。全コードブロック実体あり。
- **Type consistency**: `createPlanUndoManager(scope, onChange)` / `PlanUndoManager.{undo,redo,canUndo,canRedo,destroy}` / `CollabHandlers.{undo,redo}` / store `_collabCanUndo`/`_collabCanRedo`/`_setCollabUndoRedo` が Task1→2→3→4 で一貫。テストの `mockHandlers` も undo/redo を含むよう更新済（Task2 Step1）。
