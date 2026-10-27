# usePlanStore 分割 Implementation Plan(整頓⑤の 2 本目)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/store/usePlanStore.ts`(1021 行)を「初期値+persist 設定+部品の組み立て」だけにし、型と操作のまとまりを `src/store/plan/` へ分ける。動きは 1 つも変えない。

**Architecture:** useMitigationStore 分割(`2026-10-27-mitigation-store-split.md`)と同じ型。中身の移動だけ(書き換えない・コメントもそのまま)。操作のまとまりは `(ctx: PlanSliceContext) => Pick<PlanState, ...>` を返す関数にし、本体で `{ ...初期値, ...createXxxSlice(ctx), ... }` と並べる。`ctx = { set, get }`(pushHistory に当たるものは無い)。部品ファイルは本体(`../usePlanStore`)を import しない。外へ出ている名前は `usePlanStore` だけ(`PlanState` は非 export のまま=`plan/types.ts` では export するが本体からは再 export しない)。呼び出し側 100 ファイル・テストの `vi.mock('.../usePlanStore')` は 1 行も変えない。

**Tech Stack:** zustand(persist)/ TypeScript / vitest

## 測った結果(分割前・行番号は 17ea977a 時点・両端含む)

| 行 | 中身 | 行き先 |
|---|---|---|
| 1-19 | import | 各ファイルへ必要分 |
| 21-90 | `interface PlanState` | `plan/types.ts`(`export interface PlanState` + `PlanSliceContext`) |
| 92-115 | `tagCreationIntent`(JSDoc 込み) | `plan/tagCreationIntent.ts`(`export function`) |
| 117-132 | create/persist の開始・初期値・`setSaveStatus` | 本体に残す |
| 134-271 | addPlan / updatePlan / deletePlan / setCurrentPlanId / getPlan / createPlanFromTemplate | `plan/planCrudSlice.ts` |
| 339-348 | markDirty / hasDirtyPlans / setPlans | `plan/planCrudSlice.ts`(上の後ろに続けて) |
| 273-337 | `// Firestore同期メソッド` コメント + pullFromFirestore | `plan/syncSlice.ts` |
| 456-630 | syncToFirestore / forceSyncAll | `plan/syncSlice.ts` |
| 803-905 | manualSync | `plan/syncSlice.ts` |
| 350-454 | duplicatePlan | `plan/duplicateSlice.ts` |
| 632-801 | migrateOnLogin / getLocalPlanIds / executeLocalImport / deleteFromFirestore | `plan/loginImportSlice.ts` |
| 907-990 | archivePlan / archivePlans / decompressArchivedPlan / recompressStaleArchives / silentCompressStale | `plan/archiveSlice.ts` |
| 991-1021 | persist 設定(name / version / partialize / merge / migrate) | 本体に残す |

行範囲の間の空行(272, 338, 349, 455, 631, 802, 906)は捨ててよい。各スライス内の操作の並び順は元ファイルの出現順のまま。

## Global Constraints

- 動きを変えない: 操作の中身・コメント・`set`/`get` の呼び方・`await import(...)` の位置を変えない(字下けだけ変わる)。
- `await import('../components/Toast')` 等の動的 import の相対パスは、ファイルが 1 段深くなるので `'../../components/Toast'` に直す(**これだけは書き換えが必要**)。静的 import も同様に `../` → `../../`。`./useMitigationStore` → `../useMitigationStore`、`./planPersist` は本体に残る。
- 部品ファイルから `../usePlanStore` を import しない(noCircularImports テストが見張る)。`../useMitigationStore` の import は元からあるので可(循環しないことは noCircularImports で確認)。
- 呼び出し側・既存テストは変更しない。違いとして許すのは「state の key の並び順」だけ(`Object.keys(usePlanStore.getState())` の使用 0・`partializePlanState` は key を明示=確認済み)。
- 見張りテスト(`ModalShell.guard` の LEGACY / `rawStyleAllowlist.json` / `noNativeTitleAttr` の ALLOWED)は store を対象にしないので触らない。
- 1 タスク 1 コミット。push しない。

## Review Focus

1. 各操作の中で `get().addPlan` 等の自分の store 経由の呼び出しが、分割後も同じ `get` を通る(スライス間呼び出し: crud←sync/duplicate/loginImport、archivePlan←archivePlans/recompress、decompressArchivedPlan←duplicate/executeLocalImport)。
2. 動的 import のパス直し漏れ(実行時にしか落ちない)→ Task 1 の記録で toast を出す経路(syncToFirestore の deletedRemotely / conflicted、manualSync の conflicted)を必ず通す。
3. persist の保存内容・migrate が同じ(本体に残るので変わらないはず)。
4. 型: 各スライスの `Pick<...>` が漏れなく重複なく PlanState の操作を覆う(tsc -b)。

---

### Task 1: 前後比較の一時検査を作る(分割前に記録)

**Files:** Create `src/store/__tests__/usePlanStore.splitGuard.test.ts`(Task 3 で削除)

既存の `usePlanStore.syncToFirestore.test.ts` / `usePlanStore.executeLocalImport.test.ts` のモックの組み方(planService / firebase / app-check / Toast / i18next)を参考にする。

- [ ] **Step 1:** 検査を書く。`planService` の全関数を「呼ばれた名前+引数を記録して決まった値を返す」モックに、`useMitigationStore.getState().resetForTutorial / loadSnapshot` を記録用 spy に、`showToast` を記録用に、`auth.currentUser` を固定、`Date.now`/`Math.random`/`crypto.randomUUID` を固定。1 本の筋書きで PlanState の全関数 key を順に呼ぶ(addPlan → updatePlan〔空上書きガードが効く場合と効かない場合〕→ createPlanFromTemplate → duplicatePlan〔通常/件数上限で null〕→ markDirty → hasDirtyPlans → syncToFirestore〔deletedRemotely と conflicted を返すモックで toast 経路を通す〕→ forceSyncAll → pullFromFirestore〔changed=true で現在プランが更新される場合〕→ manualSync〔conflicted あり〕→ migrateOnLogin → getLocalPlanIds → executeLocalImport〔成功 1・失敗 1〕→ deleteFromFirestore → archivePlan → archivePlans → decompressArchivedPlan → recompressStaleArchives → silentCompressStale → setPlans → deletePlan → setCurrentPlanId → getPlan → setSaveStatus)。各操作の後に「関数を除いた state(Set は配列化)」「その操作中のモック呼び出し記録」を積む。最後に localStorage `plan-storage` の中身。`expect(records).toMatchSnapshot()`。加えて state の関数 key 一覧(sort 済み)も snapshot。
- [ ] **Step 2:** `npx vitest run src/store/__tests__/usePlanStore.splitGuard.test.ts` → 初回で snapshot 作成・2 回目も PASS(安定)。snapshot に toast 呼び出しが記録されていることを目で確認。
- [ ] **Step 3:** commit `test: usePlanStore 分割用の一時検査を追加(分割前の記録)`

### Task 2: 分割する

**Files:** Create `src/store/plan/{types,tagCreationIntent,planCrudSlice,syncSlice,duplicateSlice,loginImportSlice,archiveSlice}.ts` / Modify `src/store/usePlanStore.ts`

**Interfaces:**
- `types.ts`: `export interface PlanState { ...元のまま }` と `export type PlanSliceContext = { set: StoreApi<PlanState>['setState']; get: () => PlanState }`。
- 各スライス: `export const createXxxSlice = ({ set, get }: PlanSliceContext): Pick<PlanState, '...'> => ({ ...移した操作 })`(使わない方は分割代入しない)。
- 本体: `(set, get) => { const ctx = { set, get }; return { 初期値..., setSaveStatus, ...createPlanCrudSlice(ctx), ...createSyncSlice(ctx), ...createDuplicateSlice(ctx), ...createLoginImportSlice(ctx), ...createArchiveSlice(ctx) }; }`。

- [ ] **Step 1:** 行範囲で機械的に切り出すスクリプト(scratchpad)で移動。字下げは 8 減らす(元 12 → スライス内 4)。import は各ファイルで使うものだけ・相対パスを 1 段深く。
- [ ] **Step 2:** 行の突き合わせ: 元の 134-990 の非空行(trim 後・import パス行を除く)の多重集合と、5 スライスの操作部分の非空行(trim 後)の多重集合が一致することをスクリプトで確認(差分 0 を出力)。
- [ ] **Step 3:** `npx tsc -b` exit 0、`npx vitest run src/store src/lib` PASS(splitGuard 含む・`-u` を付けない)。
- [ ] **Step 4:** 本体 ≤ 150 行・各部品 ≤ 400 行を `wc -l` で確認。`npx vitest run src/__tests__/noCircularImports.test.ts` PASS。
- [ ] **Step 5:** commit `refactor(store): usePlanStore を型と操作のまとまりに分ける(整頓⑤)`

### Task 3: 一時検査を削除・全体確認

- [ ] **Step 1:** splitGuard テストと snapshot を削除して commit `test: usePlanStore 分割用の一時検査を削除(分割後も全記録一致を確認済み)`
- [ ] **Step 2:** `npm run build` exit 0・`npm run test:gate` 全 PASS。
- [ ] **Step 3:** 新しい目で敵対レビュー(振る舞いの差だけ指摘)。
