# 共同編集中の進捗同期 (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集中、全員の進捗打点を匿名 union で同期・永続化し、表データを一切壊さない。

**Architecture:** 進捗打点を memos と同じ汎用コレクション同期レーン(`progressPoints` Y.Array)に載せる。打点に固定 id を付与し、collab 中は store のローカル set ではなく `upsertItems`/`removeItems` ハンドラへ委譲。スカラー(cleared/activeDays/activeHours)は planMeta(LWW)へ。client / worker / Vercel API の3階層に同じ field を1つずつ追加する(events/memos の既存パターンの複製)。

**Tech Stack:** TypeScript, Zustand, Yjs (y-partyserver), Cloudflare Durable Objects (worker), Vercel Node Functions (api), Firestore, Vitest.

## Global Constraints

- **言語**: コメント・ドキュメントは日本語。
- **データロスト絶対NG**: 進捗操作は表(timelineMitigations/timelineEvents/phases/partyMembers)に一切書き込まない。進捗は表と同じ "保存先ロック済み(`_loadedPlanId` 固定)" 経路に相乗りさせ、進捗専用の保存ルートを作らない。
- **空上書きガード**: `progressPoints` は memos 同型で **ガード対象外**(`GUARDED_ARRAY_FIELDS` / `RESEED_FIELDS` に含めない)。表のガードは変更しない。
- **client / worker のキー名・構造は必ず一致**させる(`src/lib/collab/yjsPlanData.ts` ↔ `workers/collab/src/yjsPlanData.ts`)。往復が崩れると seed/save が壊れる。
- **匿名 union**: 打点に記録者 id は持たせない(A案確定)。
- **push 前**: `npm run build`(tsc -b 厳密) + `npx vitest run` 必須(memory `feedback_vercel_tsc_strict`)。`erasableSyntaxOnly` 有効(テストモックで enum/パラメータプロパティ禁止)。
- **vitest 実行**: `npx vitest run <path>` で単発実行。出力をパイプしない(memory `reference_vitest_appcheck_teardown`)。
- **スマホ記録UIは本計画の対象外**(別タスク)。

---

### Task 1: ProgressPoint に固定 id を付与 + 純粋ロジックの id 化

打点を index でなく id で識別できるようにする。旧データ(id なし)は読み込み時に補完する。

**Files:**
- Modify: `src/types/index.ts:241-248`(`ProgressPoint` に `id` 追加)
- Modify: `src/lib/progressLogic.ts`(`makeProgressPointId` 追加 / `appendProgressPoint` で id 付与 / `normalizeProgress` で id 補完 / `removeProgressPointById` / `setNoteById` 追加)
- Test: `src/lib/__tests__/progressLogic.test.ts`(既存に追加)

**Interfaces:**
- Produces:
  - `interface ProgressPoint { id: string; ts: number; reachedPos: number; note?: string }`
  - `makeProgressPointId(): string` → `pt_<uuid>`
  - `appendProgressPoint(list, point)` は従来どおり(point は id 込みで渡される)
  - `removeProgressPointById(list: ProgressPoint[] | undefined, id: string): ProgressPoint[]`
  - `setProgressPointNoteById(list: ProgressPoint[] | undefined, id: string, note: string): ProgressPoint[]`
  - `normalizeProgress(p): PlanProgress` は全 points に id を保証する

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/progressLogic.test.ts` の末尾に追加:

```typescript
import {
    makeProgressPointId, removeProgressPointById, setProgressPointNoteById, normalizeProgress,
} from '../progressLogic';

describe('ProgressPoint id 化', () => {
    it('makeProgressPointId は pt_ 接頭辞の一意 id を返す', () => {
        const a = makeProgressPointId();
        const b = makeProgressPointId();
        expect(a).toMatch(/^pt_/);
        expect(a).not.toBe(b);
    });

    it('normalizeProgress は id 欠落の旧 points に id を補完する', () => {
        const out = normalizeProgress({ points: [{ ts: 1, reachedPos: 10 }, { ts: 2, reachedPos: 20 }] });
        expect(out.points).toHaveLength(2);
        expect(out.points[0].id).toMatch(/^pt_/);
        expect(out.points[1].id).toMatch(/^pt_/);
        expect(out.points[0].id).not.toBe(out.points[1].id);
        expect(out.points[0].reachedPos).toBe(10);
    });

    it('normalizeProgress は既存 id を保持する', () => {
        const out = normalizeProgress({ points: [{ id: 'pt_keep', ts: 1, reachedPos: 10 }] });
        expect(out.points[0].id).toBe('pt_keep');
    });

    it('removeProgressPointById は id 一致を1件だけ消す', () => {
        const list = [{ id: 'pt_a', ts: 1, reachedPos: 1 }, { id: 'pt_b', ts: 2, reachedPos: 2 }];
        expect(removeProgressPointById(list, 'pt_a')).toEqual([{ id: 'pt_b', ts: 2, reachedPos: 2 }]);
        expect(removeProgressPointById(list, 'pt_missing')).toEqual(list);
        expect(removeProgressPointById(undefined, 'pt_a')).toEqual([]);
    });

    it('setProgressPointNoteById は id 一致の note を設定/空文字で削除する', () => {
        const list = [{ id: 'pt_a', ts: 1, reachedPos: 1 }];
        expect(setProgressPointNoteById(list, 'pt_a', ' hi ')[0].note).toBe('hi');
        expect('note' in setProgressPointNoteById(list, 'pt_a', '  ')[0]).toBe(false);
        expect(setProgressPointNoteById(list, 'pt_x', 'z')).toEqual(list);
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/__tests__/progressLogic.test.ts`
Expected: FAIL(`makeProgressPointId` 等が未定義)

- [ ] **Step 3: 型に id を追加**

`src/types/index.ts` の `ProgressPoint`(241行付近)を変更:

```typescript
export interface ProgressPoint {
    /** 打点の固定 id（pt_<uuid>）。共同編集の union/個別操作で点を一意識別する。 */
    id: string;
    /** 記録時刻 (epoch ms)。並び順 = クリック順 / 日付ラベルの算出に使う */
    ts: number;
    /** その時クリックした到達点。タイムライン上の秒位置 */
    reachedPos: number;
    /** 任意のひとことメモ。未設定は undefined（共有時は progress ごと除去され他人に渡らない） */
    note?: string;
}
```

- [ ] **Step 4: progressLogic に id ヘルパを実装**

`src/lib/progressLogic.ts` を変更。先頭付近に追加:

```typescript
/** 打点 id を採番（pt_<uuid>）。crypto.randomUUID は全対象ブラウザで利用可。 */
export function makeProgressPointId(): string {
    return `pt_${crypto.randomUUID()}`;
}
```

`removeProgressPoint`(index版)はそのまま残し、id 版を追加:

```typescript
/** id 一致の点を削除（共同編集の個別削除に使う・非破壊）。 */
export function removeProgressPointById(list: ProgressPoint[] | undefined, id: string): ProgressPoint[] {
    return (list ?? []).filter((p) => p.id !== id);
}

/** id 一致の点の note を設定（空白のみなら note を削除）。非破壊。 */
export function setProgressPointNoteById(
    list: ProgressPoint[] | undefined, id: string, note: string
): ProgressPoint[] {
    const trimmed = note.trim();
    return (list ?? []).map((p) => {
        if (p.id !== id) return p;
        if (!trimmed) { const { note: _omit, ...rest } = p; return rest; }
        return { ...p, note: trimmed };
    });
}
```

`normalizeProgress` を変更し全 points に id を保証する(45-49行付近):

```typescript
export function normalizeProgress(p: unknown): PlanProgress {
    const obj = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
    const cleared = !!obj.cleared;
    const activeDays = typeof obj.activeDays === 'number' ? obj.activeDays : undefined;
    const activeHours = typeof obj.activeHours === 'number' ? obj.activeHours : undefined;
    const withId = (pt: Record<string, unknown>): ProgressPoint => ({
        id: typeof pt.id === 'string' && pt.id ? pt.id : makeProgressPointId(),
        ts: Number(pt.ts) || 0,
        reachedPos: Number(pt.reachedPos) || 0,
        ...(typeof pt.note === 'string' && pt.note ? { note: pt.note } : {}),
    });
    if (Array.isArray(obj.points)) {
        return { points: (obj.points as Record<string, unknown>[]).map(withId), cleared, activeDays, activeHours };
    }
    const legacy = Array.isArray(obj.dailyBest) ? obj.dailyBest as Array<{ reachedPos?: number }> : [];
    const points: ProgressPoint[] = legacy.map((d, i) => ({ id: makeProgressPointId(), ts: i + 1, reachedPos: Number(d?.reachedPos) || 0 }));
    return { points, cleared, activeDays, activeHours };
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run src/lib/__tests__/progressLogic.test.ts`
Expected: PASS(既存テスト含め全緑)

- [ ] **Step 6: コミット**

```bash
git add src/types/index.ts src/lib/progressLogic.ts src/lib/__tests__/progressLogic.test.ts
git commit -m "feat(progress): 打点に固定 id を付与 + 純粋ロジックを id ベース化"
```

---

### Task 2: store とUIの記録・削除を id ベースに(非collab挙動を維持)

collab 委譲はまだ入れない。まず id を使うようにして既存の単独動作を壊さないことを確定する。

**Files:**
- Modify: `src/store/useMitigationStore.ts`(`recordReachedPoint` で id 採番 / `removeProgressPoint` を id 受けへ / `setProgressPointNote` を id 受けへ)
- Modify: 呼び出し側UI(下記 grep で特定したファイル)
- Test: `src/store/__tests__/useMitigationStore.progress.test.ts`

**Interfaces:**
- Consumes: Task 1 の `makeProgressPointId` / `removeProgressPointById` / `setProgressPointNoteById`
- Produces:
  - `recordReachedPoint(reachedPos: number)` … 内部で id 採番した点を append
  - `removeProgressPoint(id: string)` … 引数が **id** に変わる(旧 index から変更)
  - `setProgressPointNote(id: string, note: string)` … 引数が **id** に変わる

- [ ] **Step 1: 呼び出し側を特定する**

Run: `git grep -n "removeProgressPoint\|setProgressPointNote\|insertProgressPointAt" src/components src/store`
Expected: ProgressDetailPanel 等の呼び出し箇所一覧(index を渡している場所)。これらを id 渡しに直す対象として記録する。

- [ ] **Step 2: 失敗するテストを書く**

`src/store/__tests__/useMitigationStore.progress.test.ts` に追加:

```typescript
it('recordReachedPoint は id 付きの点を追加する', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(30);
    const pts = useMitigationStore.getState().progress.points;
    expect(pts).toHaveLength(1);
    expect(pts[0].id).toMatch(/^pt_/);
    expect(pts[0].reachedPos).toBe(30);
});

it('removeProgressPoint(id) は id 一致だけ消す', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(10);
    store.recordReachedPoint(20);
    const first = useMitigationStore.getState().progress.points[0];
    store.removeProgressPoint(first.id);
    const pts = useMitigationStore.getState().progress.points;
    expect(pts).toHaveLength(1);
    expect(pts[0].reachedPos).toBe(20);
});

it('setProgressPointNote(id, note) は id 一致の note を設定する', () => {
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.recordReachedPoint(10);
    const id = useMitigationStore.getState().progress.points[0].id;
    store.setProgressPointNote(id, 'memo');
    expect(useMitigationStore.getState().progress.points[0].note).toBe('memo');
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.progress.test.ts`
Expected: FAIL(removeProgressPoint がまだ index 受け)

- [ ] **Step 4: store の型宣言と実装を id 化**

`src/store/useMitigationStore.ts` の型宣言(アクション群)で署名を変更:

```typescript
    recordReachedPoint: (reachedPos: number) => void;
    removeProgressPoint: (id: string) => void;
    setProgressPointNote: (id: string, note: string) => void;
```

実装(1592-1628行付近)を変更。import に `makeProgressPointId, removeProgressPointById, setProgressPointNoteById` を追加した上で:

```typescript
                recordReachedPoint: (reachedPos) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({
                        progress: { ...state.progress, points: appendProgressPoint(state.progress.points, { id: makeProgressPointId(), ts: Date.now(), reachedPos }) },
                    }));
                },
                removeProgressPoint: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({
                        progress: { ...state.progress, points: removeProgressPointById(state.progress.points, id) },
                    }));
                },
```

`setProgressPointNote`(1616-1628行)を id 化(範囲外 return の `as any` も解消):

```typescript
                setProgressPointNote: (id, note) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({
                        progress: { ...state.progress, points: setProgressPointNoteById(state.progress.points, id, note) },
                    }));
                },
```

注: `insertProgressPointAt(index, point)`(削除Undo復元用)は index 維持で可。Undo は同一セッション内で復元するため点は id を保持しており衝突しない。`point` には id が含まれる(Task 1 で型に必須化したため呼び出し側が渡す)。

- [ ] **Step 5: 呼び出し側UIを id 渡しへ修正**

Step 1 で特定した各箇所を修正する。典型は ProgressDetailPanel が `点の配列を map し index で削除/メモ更新` している箇所。`点.id` を渡すよう変更する。例(実ファイルの該当行に合わせて適用):

```tsx
// 変更前: onClick={() => removeProgressPoint(index)}
// 変更後:
onClick={() => removeProgressPoint(point.id)}

// 変更前: setProgressPointNote(index, value)
// 変更後:
setProgressPointNote(point.id, value)
```

`insertProgressPointAt(index, point)` を使うUndo復元呼び出しは、`point` に既存 id が入っていることを確認(別途採番しない)。

- [ ] **Step 6: テストを実行して成功を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.progress.test.ts src/components/progress/__tests__/useProgressRecording.test.ts`
Expected: PASS

- [ ] **Step 7: 型ビルドで呼び出し側漏れを検出**

Run: `npm run build`
Expected: EXIT 0(index→id 渡し漏れがあれば tsc がここで落とす。落ちたら該当箇所を id 渡しに修正)

- [ ] **Step 8: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.progress.test.ts src/components
git commit -m "feat(progress): store/UI の打点削除・メモを id ベースへ(非collab挙動は不変)"
```

---

### Task 3: Yjs 同期キーの配管(client 側 yjsPlanData + collabTypes)

`progressPoints` を汎用コレクション同期の対象キーにし、planMeta に進捗スカラー3種を載せる土台を作る。

**Files:**
- Modify: `src/lib/collab/yjsPlanData.ts`(`PROGRESS_POINTS_KEY` / `PlanArrayKey` / `buildArrByKey` / META キー3種 / `PlanMetaSlice` / `readPlanMeta` / `setMetaField` 経路)
- Modify: `src/lib/collab/collabTypes.ts`(`setMeta` の field union 拡張)
- Test: `src/lib/collab/__tests__/yjsPlanData.test.ts`

**Interfaces:**
- Produces:
  - `PROGRESS_POINTS_KEY = "progressPoints"`、`PlanArrayKey` に追加、`buildArrByKey` に含む
  - `META_PROGRESS_CLEARED = "progressCleared"` / `META_PROGRESS_DAYS = "progressActiveDays"` / `META_PROGRESS_HOURS = "progressActiveHours"`
  - `PlanMetaSlice` に `progressCleared?: boolean; progressActiveDays?: number; progressActiveHours?: number`
  - `readPlanMeta(doc)` がそれらを読む
  - `CollabHandlers.setMeta` の field union に `"progressCleared" | "progressActiveDays" | "progressActiveHours"` を追加(value 型に `boolean` を許容)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/collab/__tests__/yjsPlanData.test.ts` に追加(既存の往復テストに倣う):

```typescript
import * as Y from 'yjs';
import {
    PROGRESS_POINTS_KEY, buildArrByKey, applyUpsert, readArray,
    setMetaField, readPlanMeta, META_PROGRESS_CLEARED, META_PROGRESS_DAYS,
} from '../yjsPlanData';

describe('progressPoints / progress meta 配管', () => {
    it('buildArrByKey に progressPoints が含まれ upsert/read が往復する', () => {
        const doc = new Y.Doc();
        const arr = buildArrByKey(doc)[PROGRESS_POINTS_KEY];
        applyUpsert(arr, [{ id: 'pt_a', ts: 1, reachedPos: 10 }]);
        expect(readArray(doc, PROGRESS_POINTS_KEY)).toEqual([{ id: 'pt_a', ts: 1, reachedPos: 10 }]);
    });

    it('readPlanMeta が progress スカラーを読む', () => {
        const doc = new Y.Doc();
        setMetaField(doc, META_PROGRESS_CLEARED, true);
        setMetaField(doc, META_PROGRESS_DAYS, 3);
        const meta = readPlanMeta(doc);
        expect(meta.progressCleared).toBe(true);
        expect(meta.progressActiveDays).toBe(3);
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: FAIL(`PROGRESS_POINTS_KEY` 等が未定義)

- [ ] **Step 3: client yjsPlanData を拡張**

`src/lib/collab/yjsPlanData.ts` を変更:

キー定数を追加(MEMOS_KEY の隣):

```typescript
export const PROGRESS_POINTS_KEY = "progressPoints";
```

META キーを追加(META_SCH の隣):

```typescript
export const META_PROGRESS_CLEARED = "progressCleared";
export const META_PROGRESS_DAYS = "progressActiveDays";
export const META_PROGRESS_HOURS = "progressActiveHours";
```

`PlanArrayKey` 型に追加:

```typescript
export type PlanArrayKey =
  | typeof TIMELINE_EVENTS_KEY | typeof PHASES_KEY | typeof LABELS_KEY | typeof MEMOS_KEY
  | typeof PARTY_MEMBERS_KEY | typeof MITIGATIONS_KEY | typeof PROGRESS_POINTS_KEY;
```

`PlanMetaSlice` を拡張:

```typescript
export interface PlanMetaSlice {
  currentLevel?: number;
  aaSettings?: AASettings;
  schAetherflowPatterns?: Record<string, 1 | 2>;
  progressCleared?: boolean;
  progressActiveDays?: number;
  progressActiveHours?: number;
}
```

`buildArrByKey` に1行追加:

```typescript
    [PROGRESS_POINTS_KEY]: doc.getArray<Y.Map<unknown>>(PROGRESS_POINTS_KEY),
```

`readPlanMeta` を拡張:

```typescript
export function readPlanMeta(doc: Y.Doc): PlanMetaSlice {
  const meta = doc.getMap(PLAN_META_KEY);
  return {
    currentLevel: meta.get(META_LEVEL) as number | undefined,
    aaSettings: meta.get(META_AA) as AASettings | undefined,
    schAetherflowPatterns: meta.get(META_SCH) as Record<string, 1 | 2> | undefined,
    progressCleared: meta.get(META_PROGRESS_CLEARED) as boolean | undefined,
    progressActiveDays: meta.get(META_PROGRESS_DAYS) as number | undefined,
    progressActiveHours: meta.get(META_PROGRESS_HOURS) as number | undefined,
  };
}
```

- [ ] **Step 4: collabTypes の setMeta union を拡張**

`src/lib/collab/collabTypes.ts` の `setMeta` を変更:

```typescript
  setMeta: (
    field: "currentLevel" | "aaSettings" | "schAetherflowPatterns"
         | "progressCleared" | "progressActiveDays" | "progressActiveHours",
    value: number | boolean | AASettings | Record<string, 1 | 2>,
  ) => void;
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/collab/yjsPlanData.ts src/lib/collab/collabTypes.ts src/lib/collab/__tests__/yjsPlanData.test.ts
git commit -m "feat(progress): client yjsPlanData に progressPoints/進捗meta の同期配管を追加"
```

---

### Task 4: store の collab 委譲 + Yjs→store 反映アクション

collab active 時、進捗の記録・削除・全消去・メモを handlers へ委譲し、スカラーは setMeta へ。Yjs から store へ戻す `_applyProgressPointsFromCollab` と、`_applyMetaFromCollab` のスカラー拡張を追加。

**Files:**
- Modify: `src/store/useMitigationStore.ts`(進捗アクションの collab 分岐 / `_applyProgressPointsFromCollab` 追加 / `_applyMetaFromCollab` 拡張)
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

**Interfaces:**
- Consumes: Task 3 の `setMeta` 拡張、`PROGRESS_POINTS_KEY`
- Produces:
  - `_applyProgressPointsFromCollab(points: ProgressPoint[]): void` … `set({ progress: { ...progress, points } })`
  - `_applyMetaFromCollab` が `progressCleared / progressActiveDays / progressActiveHours` を反映
  - 進捗アクションは collab active 時に `upsertItems('progressPoints', …)` / `removeItems('progressPoints', …)` / `setMeta(…)` へ委譲

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useMitigationStore.collab.test.ts` に追加(既存の memos 委譲テストの形を踏襲。`_collabHandlers` をスパイで注入する既存パターンを使う):

```typescript
it('collab中の recordReachedPoint は upsertItems(progressPoints) へ委譲しローカル set しない', () => {
    const upsertItems = vi.fn();
    const store = useMitigationStore.getState();
    store.clearAllProgressPoints();
    store.enterCollabMode({ ...noopHandlers, upsertItems });
    store.recordReachedPoint(40);
    expect(upsertItems).toHaveBeenCalledWith('progressPoints', [expect.objectContaining({ reachedPos: 40, id: expect.stringMatching(/^pt_/) })]);
    expect(useMitigationStore.getState().progress.points).toHaveLength(0); // ローカルには積まない
    store.exitCollabMode();
});

it('collab中の removeProgressPoint は removeItems(progressPoints) へ委譲する', () => {
    const removeItems = vi.fn();
    const store = useMitigationStore.getState();
    store.enterCollabMode({ ...noopHandlers, removeItems });
    store.removeProgressPoint('pt_x');
    expect(removeItems).toHaveBeenCalledWith('progressPoints', ['pt_x']);
    store.exitCollabMode();
});

it('collab中の setCleared は setMeta(progressCleared) へ委譲する', () => {
    const setMeta = vi.fn();
    const store = useMitigationStore.getState();
    store.enterCollabMode({ ...noopHandlers, setMeta });
    store.setCleared(true);
    expect(setMeta).toHaveBeenCalledWith('progressCleared', true);
    store.exitCollabMode();
});

it('_applyProgressPointsFromCollab は points を置き換える', () => {
    const store = useMitigationStore.getState();
    store._applyProgressPointsFromCollab([{ id: 'pt_z', ts: 1, reachedPos: 5 }]);
    expect(useMitigationStore.getState().progress.points).toEqual([{ id: 'pt_z', ts: 1, reachedPos: 5 }]);
});

it('_applyMetaFromCollab は進捗スカラーを反映する', () => {
    const store = useMitigationStore.getState();
    store._applyMetaFromCollab({ progressCleared: true, progressActiveDays: 4 });
    const p = useMitigationStore.getState().progress;
    expect(p.cleared).toBe(true);
    expect(p.activeDays).toBe(4);
});
```

注: `noopHandlers` は既存テストに無ければ全 `CollabHandlers` メソッドを `vi.fn()` で埋めたヘルパを各テスト先頭で定義する(下記)。

```typescript
const noopHandlers = {
    add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
    upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(),
    importBulk: vi.fn(), batch: vi.fn(), undo: vi.fn(), redo: vi.fn(),
};
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: 進捗アクションに collab 委譲を実装**

`src/store/useMitigationStore.ts` の進捗アクション(1592-1635行付近)を変更。`recordReachedPoint`:

```typescript
                recordReachedPoint: (reachedPos) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    const point = { id: makeProgressPointId(), ts: Date.now(), reachedPos };
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('progressPoints', [point]);
                        return;
                    }
                    set((state) => ({
                        progress: { ...state.progress, points: appendProgressPoint(state.progress.points, point) },
                    }));
                },
                removeProgressPoint: (id) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('progressPoints', [id]);
                        return;
                    }
                    set((state) => ({
                        progress: { ...state.progress, points: removeProgressPointById(state.progress.points, id) },
                    }));
                },
                setCleared: (cleared) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('progressCleared', cleared);
                        return;
                    }
                    set((state) => ({ progress: { ...state.progress, cleared } }));
                },
                setActiveDays: (n) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('progressActiveDays', n);
                        return;
                    }
                    set((state) => ({ progress: { ...state.progress, activeDays: n } }));
                },
                setActiveHours: (n) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('progressActiveHours', n);
                        return;
                    }
                    set((state) => ({ progress: { ...state.progress, activeHours: n } }));
                },
                setProgressPointNote: (id, note) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        // メモは点の部分更新 = upsert で note フィールドだけ送る(applyUpsert が部分更新)。
                        get()._collabHandlers!.upsertItems('progressPoints', [{ id, note: note.trim() }]);
                        return;
                    }
                    set((state) => ({
                        progress: { ...state.progress, points: setProgressPointNoteById(state.progress.points, id, note) },
                    }));
                },
                clearAllProgressPoints: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('progressPoints', get().progress.points.map((p) => p.id));
                        return;
                    }
                    set((state) => ({ progress: { ...state.progress, points: [] } }));
                },
```

注(メモの collab 委譲の限界): `applyUpsert` は「与えたフィールドだけ set」なので空 note を送っても既存 note を消せない(空文字を set するだけ)。共同編集中の note 削除は「空文字 note」として残るが、表示側で空 note は非表示扱いのため実害なし。これは許容(進捗は飾り)。`insertProgressPointAt` は Undo 復元専用でローカルのみ・collab 中は使わない(進捗の Undo は本計画の対象外)。

- [ ] **Step 4: Yjs→store 反映アクションを追加**

型宣言(`_applyMetaFromCollab` の隣 188行付近)に追加:

```typescript
    /** 遅延チャンクの observeDeep から呼ぶ: Yjs 側の最新進捗打点を store に反映(union 結果)。 */
    _applyProgressPointsFromCollab: (points: ProgressPoint[]) => void;
```

`_applyMetaFromCollab` の型を拡張:

```typescript
    _applyMetaFromCollab: (meta: { currentLevel?: number; aaSettings?: AASettings; schAetherflowPatterns?: Record<string, 1 | 2>; progressCleared?: boolean; progressActiveDays?: number; progressActiveHours?: number }) => void;
```

実装(`_applyMemosFromCollab` の隣 592行付近)に追加:

```typescript
                _applyProgressPointsFromCollab: (points) =>
                    set((state) => ({ progress: { ...state.progress, points } })),
```

`_applyMetaFromCollab`(600-行)の patch 構築に進捗スカラーを追加(progress を不変コピーで更新):

```typescript
                _applyMetaFromCollab: (meta) =>
                    set((state) => {
                        const patch: Partial<MitigationState> = {};
                        if (meta.aaSettings !== undefined) patch.aaSettings = meta.aaSettings;
                        if (meta.schAetherflowPatterns !== undefined) patch.schAetherflowPatterns = meta.schAetherflowPatterns;
                        // 進捗スカラー(cleared/activeDays/activeHours)を progress に反映。
                        if (meta.progressCleared !== undefined || meta.progressActiveDays !== undefined || meta.progressActiveHours !== undefined) {
                            patch.progress = {
                                ...state.progress,
                                ...(meta.progressCleared !== undefined ? { cleared: meta.progressCleared } : {}),
                                ...(meta.progressActiveDays !== undefined ? { activeDays: meta.progressActiveDays } : {}),
                                ...(meta.progressActiveHours !== undefined ? { activeHours: meta.progressActiveHours } : {}),
                            };
                        }
                        if (meta.currentLevel !== undefined) {
                            // 既存の currentLevel 反映ロジック(派生 computedValues 再計算)はそのまま残す。
                            patch.currentLevel = meta.currentLevel;
                            patch.partyMembers = state.partyMembers.map((mem) => ({
                                ...mem,
                                computedValues: calculateMemberValues(mem, meta.currentLevel!),
                            }));
                        }
                        return patch;
                    }),
```

注: 既存の `_applyMetaFromCollab` 本体(605-行)の currentLevel ブロックの正確な中身は現行コードを保持すること。ここでは進捗スカラーの分岐を足すのが主眼。

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts src/store/__tests__/useMitigationStore.readonly.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(progress): collab中の進捗操作をhandlers委譲 + Yjs→store反映を追加"
```

---

### Task 5: collabProvider に progressPoints の購読/配線を追加

Y.Doc の `progressPoints` 配列を observeDeep → store へ反映。disconnect で unobserve。`applyRoomToStore` の初期反映にも含める。

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`(import / yProgressPoints / applyProgressPoints / observeDeep / unobserveDeep / applyRoomToStore)
- Test: 既存の `src/lib/collab/__tests__/` 統合テスト(observe 配線は実 Y.Doc で検証)

**Interfaces:**
- Consumes: Task 3 `PROGRESS_POINTS_KEY`、Task 4 `_applyProgressPointsFromCollab`
- Produces: 部屋の `progressPoints` 変化が store.progress.points に反映される

- [ ] **Step 1: import を追加**

`src/lib/collab/collabProvider.ts` の yjsPlanData import に `PROGRESS_POINTS_KEY` を追加(6-11行):

```typescript
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY, PLAN_META_KEY,
  META_LEVEL, META_AA, META_SCH, PARTY_MEMBERS_KEY, PROGRESS_POINTS_KEY,
  applyUpsert, applyRemove, setMetaField, readArray, readPlanMeta, readContentId, readOwnerLabel,
  recordToYMap, buildArrByKey, applyBatch,
} from './yjsPlanData';
```

`import type` に `ProgressPoint` を追加(14行):

```typescript
import type { AppliedMitigation, TimelineEvent, Phase, Label, PlanMemo, PartyMember, ProgressPoint } from '../../types';
```

- [ ] **Step 2: applyRoomToStore に初期反映を追加**

`applyRoomToStore`(176-186行)に1行追加(memos の隣):

```typescript
  s._applyMemosFromCollab(dedupeById(readArray<PlanMemo>(doc, MEMOS_KEY)));
  s._applyProgressPointsFromCollab(dedupeById(readArray<ProgressPoint>(doc, PROGRESS_POINTS_KEY)));
  s._applyPartyMembersFromCollab(dedupeById(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY)));
```

- [ ] **Step 3: Y 配列の取得と observeDeep を追加**

`yMemos` の隣(235行付近)に追加:

```typescript
  const yProgressPoints = doc.getArray<Y.Map<unknown>>(PROGRESS_POINTS_KEY);
```

apply 関数と observe(260-268行付近)に追加:

```typescript
  const applyMemos = () => store()._applyMemosFromCollab(dedupeById(readArray<PlanMemo>(doc, MEMOS_KEY)));
  const applyProgressPoints = () => store()._applyProgressPointsFromCollab(dedupeById(readArray<ProgressPoint>(doc, PROGRESS_POINTS_KEY)));
  // ...
  yMemos.observeDeep(applyMemos);
  yProgressPoints.observeDeep(applyProgressPoints);
```

- [ ] **Step 4: disconnect で unobserve を追加**

`disconnect`(443行付近)に追加:

```typescript
    yMemos.unobserveDeep(applyMemos);
    yProgressPoints.unobserveDeep(applyProgressPoints);
```

注: `progressPoints` は undo 対象外(planUndo の scope 配列 `[yarr, yEvents, yPhases, yLabels, yPartyMembers]` に **含めない**。memos と同じ扱い=進捗は undo しない)。

- [ ] **Step 5: ビルドと既存 collab テストを実行**

Run: `npm run build`
Expected: EXIT 0

Run: `npx vitest run src/lib/collab/`
Expected: PASS(既存 collab テスト緑・配線の型不整合なし)

- [ ] **Step 6: コミット**

```bash
git add src/lib/collab/collabProvider.ts
git commit -m "feat(progress): collabProvider に progressPoints の購読/配線を追加"
```

---

### Task 6: worker 側 yjsPlanData に progressPoints + 進捗 meta を追加(seed/save 往復)

client とキー名・構造を一致させる。これで部屋を出ても打点が Firestore へ書き戻り、再 seed で戻る。

**Files:**
- Modify: `workers/collab/src/yjsPlanData.ts`(キー定数 / `PlanDataSeed` / `buildSeedDocFull` / `readPlanDataFull`)
- Test: `workers/collab/src/yjsPlanData.test.ts`

**Interfaces:**
- Produces: `PlanDataSeed.progressPoints?: PlanRecord[]` + `progressCleared?: boolean` / `progressActiveDays?: number` / `progressActiveHours?: number`。`readPlanDataFull` がこれらを返し、`buildSeedDocFull` がこれらを Y.Doc へ載せる。

- [ ] **Step 1: 失敗するテストを書く**

`workers/collab/src/yjsPlanData.test.ts` の seed に progressPoints を足し、往復を検証(既存 `seed` オブジェクトに追記 + 新 it):

```typescript
it("progressPoints と進捗 meta が seed→read で往復する", () => {
    const doc = buildSeedDocFull({
        mitigations: [],
        progressPoints: [{ id: "pt_a", ts: 1, reachedPos: 10 }],
        progressCleared: true,
        progressActiveDays: 5,
    });
    const out = readPlanDataFull(doc);
    expect(out.progressPoints).toEqual([{ id: "pt_a", ts: 1, reachedPos: 10 }]);
    expect(out.progressCleared).toBe(true);
    expect(out.progressActiveDays).toBe(5);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts; cd ../..`
Expected: FAIL

- [ ] **Step 3: worker yjsPlanData を拡張**

`workers/collab/src/yjsPlanData.ts` を変更。キー定数追加(MEMOS_KEY 隣):

```typescript
export const PROGRESS_POINTS_KEY = "progressPoints";
export const META_PROGRESS_CLEARED = "progressCleared";
export const META_PROGRESS_DAYS = "progressActiveDays";
export const META_PROGRESS_HOURS = "progressActiveHours";
```

`PlanDataSeed` に追加:

```typescript
  progressPoints?: PlanRecord[];
  progressCleared?: boolean;
  progressActiveDays?: number;
  progressActiveHours?: number;
```

`buildSeedDocFull` の transact 内に追加:

```typescript
    pushAll(doc, PROGRESS_POINTS_KEY, seed.progressPoints ? dedupeById(seed.progressPoints) : undefined);
    // ...meta セット群の後ろに:
    if (seed.progressCleared !== undefined) meta.set(META_PROGRESS_CLEARED, seed.progressCleared);
    if (seed.progressActiveDays !== undefined) meta.set(META_PROGRESS_DAYS, seed.progressActiveDays);
    if (seed.progressActiveHours !== undefined) meta.set(META_PROGRESS_HOURS, seed.progressActiveHours);
```

`readPlanDataFull` に追加:

```typescript
    progressPoints: dedupeById(readAll<PlanRecord>(doc, PROGRESS_POINTS_KEY)),
    progressCleared: meta.get(META_PROGRESS_CLEARED) as boolean | undefined,
    progressActiveDays: meta.get(META_PROGRESS_DAYS) as number | undefined,
    progressActiveHours: meta.get(META_PROGRESS_HOURS) as number | undefined,
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts; cd ../..`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add workers/collab/src/yjsPlanData.ts workers/collab/src/yjsPlanData.test.ts
git commit -m "feat(progress): worker yjsPlanData に progressPoints/進捗meta を追加(client とキー一致)"
```

---

### Task 7: Vercel API の load/save に progressPoints + 進捗 meta を通す

`decideLoadFull` が progressPoints/スカラーを seed へ載せ、`_saveHandler` がそれらを Firestore `data.*` へ書く。**空上書きガードには含めない**(memos 同型)。

**Files:**
- Modify: `api/collab/_logic.ts`(`PlanDocSnapshotFull` / `LoadResultFull` / `decideLoadFull`)
- Modify: `api/collab/_saveHandler.ts`(body 受け取り + `update['data.*']`)
- Test: `api/collab/__tests__/`(decideLoadFull の単体テストがあれば追加。無ければ _logic のテストファイルを新規作成)

**Interfaces:**
- Consumes: worker が POST する body に `progressPoints` / `progressCleared` / `progressActiveDays` / `progressActiveHours` が含まれる(Task 6)
- Produces: Firestore `plans/{id}.data.progressPoints` 等が collab save で更新され、load で seed に載る

- [ ] **Step 1: 失敗するテストを書く**

`api/collab/__tests__/loadProgress.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { decideLoadFull } from '../_logic';

describe('decideLoadFull progress', () => {
    it('ネスト data.progress から progressPoints と進捗スカラーを seed に載せる', () => {
        const r = decideLoadFull({
            version: 1,
            data: {
                timelineMitigations: [],
                progress: { points: [{ id: 'pt_a', ts: 1, reachedPos: 10 }], cleared: true, activeDays: 2 },
            } as any,
        });
        expect('deleted' in r).toBe(false);
        if (!('deleted' in r)) {
            expect(r.progressPoints).toEqual([{ id: 'pt_a', ts: 1, reachedPos: 10 }]);
            expect(r.progressCleared).toBe(true);
            expect(r.progressActiveDays).toBe(2);
        }
    });

    it('progress 欠落時は points=[] / スカラー=undefined', () => {
        const r = decideLoadFull({ version: 1, data: { timelineMitigations: [] } });
        if (!('deleted' in r)) {
            expect(r.progressPoints).toEqual([]);
            expect(r.progressCleared).toBeUndefined();
        }
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run api/collab/__tests__/loadProgress.test.ts`
Expected: FAIL(`decideLoadFull` がまだ progressPoints を返さない)

**Firestore 形の方針(重要)**: PlanData の正本は `data.progress: PlanProgress`(`{ points, cleared, activeDays, activeHours }`・[types/index.ts:279](../../../src/types/index.ts#L279))。非 collab 保存はこの**ネスト形**で書く。collab save も**同じネスト形**に部分更新することで、非 collab/collab の保存先が一致しデータが食い違わない。よって以下は全て `data.progress.*` を読み書きする。

- [ ] **Step 3: _logic.ts を拡張(ネスト data.progress から読む)**

`api/collab/_logic.ts`。`PlanDocSnapshotFull.data` に**ネスト形**で追加(108-118行・partyMembers の隣):

```typescript
    partyMembers?: unknown[];
    progress?: { points?: unknown[]; cleared?: boolean; activeDays?: number; activeHours?: number };
```

`LoadResultFull` の成功バリアントに追加(123-134行):

```typescript
      partyMembers: unknown[];
      progressPoints: unknown[];
      progressCleared?: boolean;
      progressActiveDays?: number;
      progressActiveHours?: number;
      contentId?: string;
```

`decideLoadFull` の return に追加(140-151行・`d.progress` から取り出す):

```typescript
    partyMembers: d.partyMembers ?? [],
    progressPoints: d.progress?.points ?? [],
    progressCleared: d.progress?.cleared,
    progressActiveDays: d.progress?.activeDays,
    progressActiveHours: d.progress?.activeHours,
    contentId: plan.contentId,
```

注: `emptyOverwriteSkips` / `GUARDED_ARRAY_FIELDS` は **変更しない**(progressPoints は非ガード=memos 同型・確定事項)。

- [ ] **Step 4: _saveHandler.ts を拡張(ネスト data.progress.* へ書く)**

`api/collab/_saveHandler.ts`。body 分割代入(18-24行)に追加:

```typescript
  const { planId: bodyPlanId, roomToken, mitigations,
    timelineEvents, phases, labels, memos, currentLevel, aaSettings, schAetherflowPatterns, partyMembers,
    progressPoints, progressCleared, progressActiveDays, progressActiveHours } =
    (req.body ?? {}) as {
      planId?: string; roomToken?: string; mitigations?: MitigationRecord[];
      timelineEvents?: unknown[]; phases?: unknown[]; labels?: unknown[]; memos?: unknown[];
      currentLevel?: number; aaSettings?: unknown; schAetherflowPatterns?: unknown; partyMembers?: unknown[];
      progressPoints?: unknown[]; progressCleared?: boolean; progressActiveDays?: number; progressActiveHours?: number;
    };
```

update 構築(61-69行)に追加(memos の隣・**ガード対象外なので skip 判定なし**・**ネスト field path**):

```typescript
    if (Array.isArray(memos)) update['data.memos'] = memos;
    if (Array.isArray(progressPoints)) update['data.progress.points'] = progressPoints;
    if (typeof progressCleared === 'boolean') update['data.progress.cleared'] = progressCleared;
    if (typeof progressActiveDays === 'number') update['data.progress.activeDays'] = progressActiveDays;
    if (typeof progressActiveHours === 'number') update['data.progress.activeHours'] = progressActiveHours;
```

注(データ安全): Firestore の `update['data.progress.points'] = …` は `data.progress` オブジェクトの points **だけ**を更新し、他のネストフィールド(cleared 等)を消さない(field-path 部分更新の性質)。非 collab 保存が `data.progress` を丸ごと書く場合でも、どちらも「store → 保存」の一方向なので、後勝ちで最新 store 値に収束し整合する。**表 field(`data.timelineMitigations` 等)には一切触れない**(§5-A)。

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run api/collab/__tests__/loadProgress.test.ts`
Expected: PASS

- [ ] **Step 6: ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT 0

Run: `npx vitest run`
Expected: PASS(既知の housing 5件以外は緑)

- [ ] **Step 7: コミット**

```bash
git add api/collab/_logic.ts api/collab/_saveHandler.ts api/collab/__tests__/loadProgress.test.ts
git commit -m "feat(progress): Vercel load/save に進捗(ネストdata.progress)を通す・非ガード"
```

---

### Task 8: データロスト経路の敵対監査 + 実機検証

実装が揃った状態で、進捗追加が表データ破壊や plan 切替バグを再導入していないことを多エージェント監査と 2 タブ実機で確定する(memory `feedback_dataloss_exhaustive_audit` / `feedback_structural_refactor_runtime_audit`)。

**Files:**
- Read-only 監査(コード変更は監査で問題が出た場合のみ別タスク化)

- [ ] **Step 1: 多エージェント敵対監査を回す**

進捗同期の差分(client/worker/api 全コミット)について、以下の経路を各々別エージェントで洗い出す:
- 進捗の全消去/個別削除が `data.timelineMitigations` 等の表 field に到達する経路が存在しないこと(field path の独立性)
- 「全消去 → 新規表作成 → すぐ collab の表へ戻る」で表の進捗/軽減が消えないこと(保存先 `_loadedPlanId` ロックに相乗りしているか)
- collab save の `data.progress.*` 部分更新が他の `data.*` を破壊しないこと
- reseed(空上書き防御)で progressPoints を非ガードにしたことが表のガードに影響しないこと
- 旧データ(id なし progress / progress 自体が undefined)を seed/load した時にクラッシュしないこと(`normalizeProgress` の id 補完が読み出し全経路で効くか)

監査で「データ消失/破壊あり」と判定された経路があれば、修正をまとめて1コミットで行い再監査する。

- [ ] **Step 2: 統合テスト(プラン切替で表非破壊)**

Run: `git grep -l "persistWorkingStore\|_loadedPlanId" src/store`
で保存先ロックのテストファイルを特定し、「進捗を持つ collab プラン ↔ 空進捗の新規プラン」を素早く切替えても collab プランの `progress.points` と `timelineMitigations` が保持されることを検証するテストを追加。

Run: `npx vitest run src/store`
Expected: PASS

- [ ] **Step 3: ローカル2タブ実機(dev)**

Run(背景): `npm run dev`
- タブA(オーナー・編集)とタブB(参加・編集)で同じ部屋を開く
- **両タブとも最新版にリロード**してから検証(memory `reference_collab_two_client_version_skew`)
- タブBで道をクリックして打点 → タブAに点が増えるか
- タブAで全消去 → タブBでも消えるか / **表(軽減配置)が無傷か**
- 退室 → 再入室で打点が残るか(Firestore 往復)

- [ ] **Step 4: build + 全テスト最終確認 → push**

Run: `npm run build && npx vitest run`
Expected: build EXIT 0 / test PASS(既知 housing 5 件以外緑)

```bash
git push -u origin feat/collab-progress-sync
```

その後、本番 2 タブで Step 3 を再確認(デプロイ後)。問題なければ main へマージ。

- [ ] **Step 5: TODO/メモリ更新**

- `docs/TODO.md` の「現在の状態」を進捗同期 完了に更新
- memory `project_realtime_collab_status` に「進捗も同期対象(匿名union・非ガード)」を追記
- 完了タスクを `docs/TODO_COMPLETED.md` へ移動

---

## Self-Review

**1. Spec coverage(設計書 §3-9 との対応):**
- §3 memos 同レーン → Task 3/5/6/7。✅
- §4.1 id 付与 + normalizeProgress 補完 → Task 1。✅
- §4.2 store/UI を id ベース + collab 委譲 → Task 2/4。✅
- §4.3 スカラー planMeta LWW → Task 3/4/6/7。✅
- §4.4 client/worker/api 配管 → Task 3/5/6/7。✅
- §5-A 表は構造的に非破壊(field path 独立) → Task 7 注 + Task 8 Step 1。✅
- §5-B 保存先ロック相乗り → Task 8 Step 1/2。✅
- §5-C 空上書きガード非対象 → Task 7 Step 3/4 注。✅
- §5-D 実装前敵対監査 → Task 8 Step 1(実装後の最終監査として配置。SDD のタスク間レビューが各段で先行チェックを兼ねる)。✅
- §6 union 意味論 / 閲覧者ブロック → Task 4(_collabReadonly ガード維持)。✅
- §7 テスト方針 → 各 Task の TDD ステップ。✅

**2. Placeholder スキャン:** TBD/TODO 無し。各コード step に実コードあり。✅

**3. 型整合:** `ProgressPoint.id`(Task1)→ store/provider/worker/api 全 Task で一貫。`PROGRESS_POINTS_KEY="progressPoints"` は client(Task3)/worker(Task6)で同値。setMeta field 名 `progressCleared/progressActiveDays/progressActiveHours` は collabTypes(Task3)/store(Task4)/worker(Task6)/api(Task7)で一貫。

**Firestore 形(重要・一貫):** 同期の Y.Doc レーンは `progressPoints`(配列・トップレベルキー)+ planMeta スカラー3種。一方 Firestore 永続化は**ネスト `data.progress.{points,cleared,activeDays,activeHours}`**(PlanData 正本形)に統一。worker `readPlanDataFull` が Y.Doc から平坦に読み(`progressPoints`/`progressCleared`…)、save handler がそれを `data.progress.*` のネスト field path に書き、load handler(`decideLoadFull`)が `data.progress.*` から読んで再び平坦な seed に戻す。この「Y は平坦キー / Firestore はネスト」の対応は events/memos と同じ流儀で、Task6(worker)とTask7(api)の両方で一貫している。✅
