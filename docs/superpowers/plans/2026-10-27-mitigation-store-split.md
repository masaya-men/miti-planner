# useMitigationStore 分割 Implementation Plan(整頓④の 4 つ目)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/store/useMitigationStore.ts`(1900 行・90 日で 8 変更/5 fix)を「初期値+履歴の積み方+保存設定+部品の組み立て」だけにし、型・計算・操作のまとまりを `src/store/mitigation/` へ分ける。動きは 1 つも変えない。

**Architecture:** 中身の移動だけ(書き換えない・コメントもそのまま持っていく)。操作のまとまりは「`(ctx: SliceContext) => Pick<MitigationState, ...>` を返す関数」にし、本体で `{ ...初期値, ...createXxxSlice(ctx), ... }` と並べる。`ctx = { set, get, pushHistory }`。部品ファイルは本体(useMitigationStore.ts)を import しない(循環を作らない・noCircularImports テストが見張る)。外へ出ている名前(`useMitigationStore` / `AASettings` / `TutorialSnapshot` / `DEFAULT_TANK_STATS` / `DEFAULT_HEALER_STATS` / `getDefaultTankStats` / `getDefaultHealerStats`)は本体から再 export して、呼び出し側は 1 行も変えない。

**Tech Stack:** zustand(persist)/ TypeScript / vitest

**Spec:** `docs/.private/2026-10-27-lopo-refactor-ideal.md` の表 4 行目(各 1000 行以下・1 仕事・前後比較)

## 測った結果(分割前・行番号は 5cafca9c 時点)

| 行 | 中身 | 行き先 |
|---|---|---|
| 1-25 | import | 各ファイルへ必要分 |
| 27-223 | AASettings・MAX_HISTORY・HistorySnapshot・TutorialSnapshot・MitigationState | `mitigation/types.ts`(+ `SliceContext`) |
| 224-286 | 既定ステータス(getSubBase〜computeDefaultStatsMembers・INITIAL_PARTY) | `mitigation/partyDefaults.ts` |
| 287-473 | ジョブ変更・一括・オートプランの純計算(PartyComputeSlice〜computeApplyAutoPlan) | `mitigation/partyCompute.ts` |
| 474-522 | resolveShieldLinks | `mitigation/shieldLinks.ts` |
| 528-583 | pushHistory・初期値 | 本体に残す |
| 584-653 | 共同編集(入退室・Undo 可否・読取専用・_apply*FromCollab) | `collabSlice.ts` |
| 654-804 | getSnapshot / loadSnapshot / undo / redo | `historySlice.ts` |
| 805-847, 896-943, 1371-1522 | 軽減の追加/削除/移動・一括削除・オートプラン・学者/占星の連鎖 | `mitigationSlice.ts` |
| 848-851, 883-895 | 見た目の設定(自分の席・ハイライト・空行・罫線・並び順・非表示・クリップボード) | `viewSlice.ts` |
| 852-882, 1523-1599, 1736-1780 | レベル・既定ステータス・ジョブ・パーティ・AA・エーテルフロー型・initializeParty | `partySlice.ts` |
| 944-1036 | イベント(追加/取込/更新/削除) | `eventSlice.ts` |
| 1037-1370 | フェーズ・ラベル | `phaseLabelSlice.ts` |
| 1600-1735 | メモ・進捗 | `memoProgressSlice.ts` |
| 1781-1841 | チュートリアル(退避/復元) | `tutorialSlice.ts` |
| 1842-1900 | persist 設定 | 本体に残す |

## Global Constraints

- 動きを変えない: 操作の中身・コメント・`set` の呼び方・`pushHistory` の呼ぶ位置を変えない(字下げだけ変わる)。
- 部品ファイルから `../useMitigationStore` を import しない。
- 呼び出し側(src/ 配下 100 超のファイル・テストの vi.mock)は変更しない。
- 違いとして許すのは「state の key の並び順」だけ(操作が交互に並んでいるため)。key の並びに依存するコードが無いことは確認済み(`Object.keys(getState())` の使用 0・partialize/getSnapshot は key を明示)。
- 1 タスク 1 コミット。push しない(milspec-polish は未 push)。

## Review Focus

1. 共同編集中(`_collabActive`)に各操作がローカル set でなく handlers に同じ引数で委譲される(Task 1 の記録で固定)。
2. undo/redo が分割後も同じ履歴を戻す(pushHistory が本体 1 つの closure を共有していること)。
3. persist の保存内容・復元(merge)が同じ(Task 1 で localStorage の中身も記録)。
4. チュートリアル中/読取専用中は localStorage に書かない(本体に残るので変わらないはず・Task 1 で記録)。
5. 型: 各スライスの `Pick<...>` の key が漏れなく重複なく MitigationState の操作を覆う(tsc -b で検出)。

---

### Task 1: 前後比較の一時検査を作る(分割前に記録)

**Files:**
- Create: `src/store/__tests__/useMitigationStore.splitGuard.test.ts`(Task 3 で削除)

- [ ] **Step 1:** 検査を書く。1 本の筋書きで全操作(MitigationState の関数 key 全部)を solo で順に呼び、各操作の後に「関数と `_collabHandlers` を除いた state」を記録。続けて `enterCollabMode(記録用 handlers)` → 委譲する操作を一通り呼び、handlers への呼び出し(名前+引数)と state を記録。最後に localStorage `mitigation-storage` の中身、`tutorialBridge` を有効にした状態での書き込み有無も記録。`expect(records).toMatchSnapshot()`。加えて関数 key の一覧(sort 済み)も snapshot。Date/乱数 id は `vi.useFakeTimers` + `vi.spyOn(Math,'random')` / `crypto.randomUUID` 固定。
- [ ] **Step 2:** `npx vitest run src/store/__tests__/useMitigationStore.splitGuard.test.ts` → 初回で snapshot 作成・2 回目も PASS(安定していること)。
- [ ] **Step 3:** commit `test: useMitigationStore 分割用の一時検査を追加(分割前の記録)`

### Task 2: 分割する

**Files:** 上の表の新ファイル 13 本を `src/store/mitigation/` に作成 / Modify: `src/store/useMitigationStore.ts`

**Interfaces:**
- `types.ts`: `export type SliceContext = { set: StoreApi<MitigationState>['setState']; get: () => MitigationState; pushHistory: () => void }` と既存型を export。
- 各スライス: `export const createXxxSlice = ({ set, get, pushHistory }: SliceContext): Pick<MitigationState, '...'> => ({ ...移した操作 })`(使わない ctx は分割代入しない)。

- [ ] **Step 1:** 行範囲で機械的に切り出すスクリプト(scratchpad)で移動。字下げは 12 減らす。import は各ファイルで使うものだけ。
- [ ] **Step 2:** `npx tsc -b` exit 0、`npx vitest run src/store src/lib/collab` PASS(splitGuard 含む・snapshot 更新なし= `-u` を付けない)。
- [ ] **Step 3:** 本体 ≤ 300 行・各部品 ≤ 400 行を `wc -l` で確認。noCircularImports テスト PASS。
- [ ] **Step 4:** commit `refactor(store): useMitigationStore を型・計算・操作のまとまりに分ける(整頓④)`

### Task 3: 一時検査を削除・全体確認

- [ ] **Step 1:** splitGuard テストと snapshot を削除して commit `test: useMitigationStore 分割用の一時検査を削除(分割後も全記録一致を確認済み)`
- [ ] **Step 2:** `npm run build` exit 0・`npm run test:gate` 全 PASS。
- [ ] **Step 3:** 新しい目で敵対レビュー(振る舞いの差だけ指摘)。
