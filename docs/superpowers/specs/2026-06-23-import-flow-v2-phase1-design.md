# 取込フロー v2（前半）設計書 — ①満杯時削除取込 + ③コンテンツ選択前段化

- 日付: 2026-06-23
- ステータス: 設計確定（ユーザー承認済・①は既存 `LimitResolutionSheet` 流用に改訂）
- スコープ: スプレッドシート取込の体験改善のうち **①** と **③** を本spec対象とする。**②（途中取込）は本spec対象外**（§7 に繰り越しメモ）。

---

## 1. 目的とスコープ

「取込体験」3課題のうち、地続きでまとめて設計できる2つを本specで扱う。

- **① 5/5満杯時に選択削除しながら取込**: 選んだコンテンツが上限のとき、既存表を選んで削除してから取り込む導線を作る。**既に本番稼働している共有取込用の `LimitResolutionSheet` を流用する**（新規UIは作らない）。
- **③ 取込押下時にコンテンツ選択を前段化**: 現状「今開いている表のコンテンツ」を無条件流用して別コンテンツへ誤紐付けする実バグを、取込前のコンテンツ選択で根治する。

①と③は同じ取込確定パイプラインを共有するため、1つのモーダル体験として統合設計する。

### 非対象（本specでやらない）
- **②途中取込**（時刻オフセット/フェーズ連結/パーティ統合）。技術的難度が①③と桁違い（§7）。
- in-place 上書き（`replace_current`）経路の新設。ユーザー判断で「上書きは外す」と確定済。
- 満杯削除UIの新規実装。**既存 `LimitResolutionSheet` を流用する**（§3-B）。
- 取込プランの手動命名UI（自動命名を維持・§3-C）。
- 新規作成画面(NewPlanModal)の render(JSX) 改修（共通化はロジックのみ・§3-D）。
- 共有取込フロー（`executeShareImport` / `ShareImportSheet`）の挙動変更。マウント箇所の一元化（§3-B）以外は触らない。

---

## 2. 現状（実装の事実・file:line）

取込はすべて「新しい軽減表を1枚作る」処理に集約され、共有ハンドラ `commitNewPlan` に収束する。

確定パイプライン:
`SpreadsheetImportModal.handleConfirm` → `buildPlanFromSheets(entries)` → `onImport(result,'new')` → `Timeline.handleSheetImport`（上限チェック・contentId決定）→ `commitImportedPlan(result,{contentId,title})` → `commitNewPlan(newPlan)` → `usePlanStore.addPlan` → localStorage + Firestore。

壊してはいけない順序（既知バグ修正済の要所）:
- `commitNewPlan` の順序 = `addPlan → setLoadedPlanId → setCurrentPlanId`（[`src/lib/commitNewPlan.ts:9-17`](../../../src/lib/commitNewPlan.ts#L9-L17)）。`_loadedPlanId` を新プランへ先に向けないと直前プランを空データで破壊する。
- `commitImportedPlan` の collab対処 = `disconnect → exitCollabMode → 直前プラン保存 → loadSnapshot`（[`src/lib/sheetImport/commitImportedPlan.ts:42-57`](../../../src/lib/sheetImport/commitImportedPlan.ts#L42-L57)）。崩すと Bug#1（loadSnapshot no-op）が再発する。

### ① 関連（満杯時の削除＝既存資産がある）
- 上限定数 `MAX_TOTAL_PLANS=50` / `MAX_PLANS_PER_CONTENT=5`（[`src/types/firebase.ts:162-166`](../../../src/types/firebase.ts#L162-L166)）。
- 上限判定ユーティリティ `checkPlanLimit(plans, contentId): { exceeded, reason?: 'max_total'|'max_per_content', current, max }`（[`src/utils/planLimitChecker.ts:13-40`](../../../src/utils/planLimitChecker.ts#L13-L40)）。
- 現状のスプシ取込の満杯検査は**取込確定後**の `Timeline.handleSheetImport` 内で `showToast('sheetImport.limit_reached')` → `return` の**無反応中断**（[`src/components/Timeline.tsx:1282-1291`](../../../src/components/Timeline.tsx#L1282-L1291)）。選択UIは無い。
- **既存の満杯解消UI = `LimitResolutionSheet`（本番稼働・テスト済）**（[`src/components/LimitResolutionSheet.tsx`](../../../src/components/LimitResolutionSheet.tsx)）:
  - `max_per_content`（対象コンテンツのみ）/ `max_total`（全コンテンツ横断）両対応。並びは `updatedAt` 昇順（古い順）。
  - 削除候補リスト + プレビュー + 複数チェック選択 + 削除進捗 sweep アニメ + 「削除して再開(N件)」赤ボタン + キャンセル。
  - 駆動は `useShareImportFlow` ストアの `limitContext`（[`src/store/useShareImportFlow.ts:59,164-165`](../../../src/store/useShareImportFlow.ts#L59-L165)）。削除実体は `executePlanDeletions`（[`src/lib/executePlanDeletions.ts:10-49`](../../../src/lib/executePlanDeletions.ts#L10-L49)）。
  - i18n は `limit_resolution.*` キー群が既存。
- **発火パターン（共有取込の前例）**: 実行側が `await onLimitHit({reason, contentId, neededCount, planId})` を呼び、コンポーネントが `new Promise(resolve => setLimitContext({...params, resolve}))` で待つ。`LimitResolutionSheet` が削除完了後 `resolve('resolved')`、キャンセルで `resolve('cancelled')`（[`src/components/ShareImportSheet.tsx:193-202`](../../../src/components/ShareImportSheet.tsx#L193-L202)、[`src/components/LimitResolutionSheet.tsx:185-220`](../../../src/components/LimitResolutionSheet.tsx#L185-L220)）。
- `LimitContext` 型 = `{ reason: 'max_per_content'|'max_total'; contentId: string|null; neededCount: number; planId: string|null; resolve: (d:'resolved'|'cancelled')=>void }`（[`src/lib/shareImportTypes.ts:72-81`](../../../src/lib/shareImportTypes.ts#L72-L81)）。
- **現状のマウントは `ShareImportSheet` 内に限定**（[`src/components/ShareImportSheet.tsx:457`](../../../src/components/ShareImportSheet.tsx#L457)）。`ShareImportSheet` 自体は `Layout` でマウント（[`src/components/Layout.tsx:887`](../../../src/components/Layout.tsx#L887)）。

### ③ 関連（コンテンツ選択と誤紐付け）
- contentId は取込時に「今開いているプラン」から自動流用: `currentContentId = resolveContentId(currentPlan?.contentId, joinerContentId)`（[`src/components/Timeline.tsx:1271-1274`](../../../src/components/Timeline.tsx#L1271-L1274)）→ `handleSheetImport` で `contentId = currentContentId ?? null`。**コンテンツ先行選択の経路なし**。
- 入口 `ImportMenu` は `CustomEvent('timeline:spreadsheet-import')` を投げるだけ（[`src/components/ImportMenu.tsx:89`](../../../src/components/ImportMenu.tsx#L89)）。Timeline が listen して `setShowSheetImport(true)`（[`src/components/Timeline.tsx:958-961`](../../../src/components/Timeline.tsx#L958-L961)）。
- `onImport` シグネチャ = `(result, mode: 'new'|'replace_current') => void`。`mode` は未使用（[`src/components/SpreadsheetImportModal.tsx:24,149`](../../../src/components/SpreadsheetImportModal.tsx#L24)）。
- `commitImportedPlan` は `meta.contentId` を検証なしで新プランへ付与（[`src/lib/sheetImport/commitImportedPlan.ts:60-65`](../../../src/lib/sheetImport/commitImportedPlan.ts#L60-L65)）。
- 誤った contentId でも `generateUniqueTitle` は誤コンテンツ内で重複検査（[`src/utils/planTitle.ts:8-33`](../../../src/utils/planTitle.ts#L8-L33)）。データ損失はしないが「期待したコンテンツに入らない」体験バグ。
- 正典のコンテンツ選択ロジック = NewPlanModal: `hasContentRegistry(cat)`（savage/ultimate 判定）、`filteredBosses`（`getSeriesByLevel`+`getContentBySeries`）、`contentId = boss?.id || (hasContentRegistry(category) ? null : title.trim())`（[`src/components/NewPlanModal.tsx:32-33,77-87,167`](../../../src/components/NewPlanModal.tsx#L32-L33)）。

---

## 3. 設計

### 3-A. 新しい取込フロー（ユーザー体験・全体像）

取込ボタン → 1つのモーダルを上から順に進む:

1. **コンテンツ選択（新規・先頭ステップ）**: 「どのコンテンツの表として取り込むか」を Level→カテゴリ→ボス で選ぶ（NewPlanModal と同じ選び方・見た目）。**初期値 = 今開いている表と同じコンテンツ**（普段は触らず次へ）。
2. **モード/貼り付け/パーティ割当**: 現状どおり。
3. **作成（作成ボタン押下）**: 取込結果を組み立て、**選んだコンテンツの上限を判定**。
   - 上限内 → そのまま新規プランを確定。
   - 上限到達（`max_per_content` or `max_total`）→ 既存の `LimitResolutionSheet` を上に重ねて開く。ユーザーが削除候補を選び「削除して再開」→ 削除完了後に取込を確定。「やめる」→ 取込を中断し、**取込モーダルは開いたまま**（貼り付けたデータは保持）。

設計原則: **削除は `LimitResolutionSheet` の「削除して再開」を押すまで実行しない**。キャンセルでは何も消えず、取込作業も失われない。

### 3-B. 満杯時の削除UX（①詳細・既存 `LimitResolutionSheet` 流用）

- **新規UIは作らない**。共有取込で使われている `LimitResolutionSheet` をそのまま流用する。`max_total`（全体50枚・横断削除）も既存対応のため、特殊ケースの自前処理は不要。
- **発火**: 取込確定の直前に `checkPlanLimit(plans, selectedContentId)` を実行。`exceeded` のとき、共有取込と同じパターンで待つ:
  ```ts
  const decision = await new Promise<'resolved' | 'cancelled'>((resolve) => {
    useShareImportFlow.getState().setLimitContext({
      reason: limit.reason!,                 // 'max_per_content' | 'max_total'
      contentId: limit.reason === 'max_total' ? null : selectedContentId,
      neededCount: 1,
      planId: null,
      resolve,
    });
  });
  if (decision === 'cancelled') return false; // 取込中断（モーダルは開いたまま）
  // 'resolved' = 削除完了済み → 枠が空いた → 確定へ進む
  ```
- **削除実体**: `LimitResolutionSheet` 内部が `executePlanDeletions` を呼ぶ（流用側は何もしない）。`resolve('resolved')` は削除完了後にのみ呼ばれる契約なので、その後 `commitImportedPlan` を実行して安全。
- **マウントの一元化（唯一の共有フロー接触）**: `LimitResolutionSheet` は現状 `ShareImportSheet` 内でのみマウントされる。取込フローでも使えるよう、**`Layout` に単一マウントを移し、`ShareImportSheet` 内の `<LimitResolutionSheet />` は撤去**する（二重マウント＝シート二重表示を防ぐ）。`LimitResolutionSheet` は `limitContext===null` の間 `return null` のグローバルオーバーレイなので、単一マウントで共有/取込どちらの発火にも応える。
- **共有ストアの間借りについて**: `useShareImportFlow.limitContext` を取込からも使う（`setLimitContext` は share `status` を `'limit_hit'` にするが ShareImportSheet 非表示時は無害）。命名の一般化（share 専用ストアからの切り出し）は将来のクリーンアップとし、本specでは挙動を変えない最小流用に留める。

### 3-C. コンテンツ選択と誤紐付け根治（③詳細）

- **共通ロジックの切り出し**: コンテンツ選択の純粋ロジックを新ユーティリティ `src/lib/contentSelection.ts` に集約する:
  - `hasContentRegistry(cat: ContentCategory | null): cat is 'savage' | 'ultimate'`
  - `getFilteredBosses(level: ContentLevel | null, category: ContentCategory | null): ContentDefinition[]`（NewPlanModal の `filteredBosses` ロジックと同一: `getSeriesByLevel`+`getContentBySeries`+patch降順）
  - `deriveContentId(boss: ContentDefinition | null, category: ContentCategory | null, title: string): string | null`（`boss?.id || (hasContentRegistry(category) ? null : title.trim())`）
  - NewPlanModal はこのユーティリティを import して既存のインライン実装を置き換える（**JSXは不変・ロジックのみ差し替え**）。取込側の新コンテンツ選択UIも同ユーティリティを使う。
- **コンテンツ選択UI**: `SpreadsheetImportModal` の先頭に Level→カテゴリ→ボス（Registry系のみ）/自由入力タイトル の選択を新規実装する（見た目は NewPlanModal を踏襲、トークン経由・i18n経由）。NewPlanModal の JSX は流用せず取込モーダル側に実装。
- **初期値（今開いている表のコンテンツ）**: Timeline が現在プランの選択文脈をProps `defaultSelection: { contentId: string | null; level: ContentLevel | null; category: ContentCategory | null; title: string }` で渡す（`currentPlan` の `contentId`/`level`/`category`/`title` 由来。collab joiner で SavedPlan 無しの場合は `currentContentId` を contentId に、level/category は null）。取込モーダルは Registry系なら `getContentById(contentId)` でボスを復元して初期選択、非Registry系なら category/level/title を初期表示。ユーザーは自由に変更可能。
- **contentId の配線**: `onImport` のシグネチャを `(result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>` に変更（未使用の `mode` を廃止し選択 contentId を渡す。戻り値 = 確定したか）。`Timeline.handleSheetImport` は `currentContentId` 自動流用をやめ `opts.contentId` を使う。
- **モーダルの確定/クローズ**: `handleConfirm` は `const committed = await onImport(result, { contentId: selectedContentId }); if (committed) handleClose();`。キャンセル（満杯シートで「やめる」）時は `committed=false` でモーダルを閉じない（データ保持）。
- **表の名前**: 自動命名を維持（`generateUniqueTitle` で選択コンテンツ内の重複回避）。手動命名欄は付けない。

### 3-D. 内部構造（壊さないための方針）

- **共通化はロジックのみ**: §3-C の `contentSelection.ts` 切り出しに限定。NewPlanModal は同ユーティリティ呼び出しに差し替えるが **JSX・挙動は不変**。取込モーダルの選択UIは新規JSX。
- **確定パイプライン不変**: `commitNewPlan` の順序、`commitImportedPlan` の collab切断→保存→loadSnapshot は**一切変更しない**。本specで足すのは「確定の前に上限判定＋（満杯なら）削除シートを待つ」分岐のみ。
- **共有フロー非接触**: ①の流用は `useShareImportFlow.setLimitContext` を呼ぶだけ。例外は `LimitResolutionSheet` のマウント一元化（`Layout` へ移動・`ShareImportSheet` から撤去）の1点のみ。`executeShareImport` / `ShareImportSheet` の削除・取込ロジックは触らない。
- `handleSheetImport` は async 化する（上限シートの `await` のため）。

### 3-E. テスト・検証方針

- 単体:
  - `contentSelection.ts`: `hasContentRegistry` / `getFilteredBosses` / `deriveContentId` の各分岐（Registry系=boss.id、非Registry系=title、null）。
  - `handleSheetImport`（or 切り出した確定関数）: 上限内→`commitImportedPlan` を選択 contentId で呼ぶ／`max_per_content` 到達→`setLimitContext` を `{reason:'max_per_content', contentId:選択値}` で呼ぶ／`max_total` 到達→`{reason:'max_total', contentId:null}`／`resolve('cancelled')` で `commitImportedPlan` を呼ばない・`resolve('resolved')` で呼ぶ。
- 実機（最重要・過去教訓 [[feedback_structural_refactor_runtime_audit]] [[feedback_endpoint_user_verification]]）:
  1. 別コンテンツを選んで取込 → 正しい棚に入る（誤紐付け根治）
  2. `max_per_content` 5/5 で1枚削除して取込 → 消えて入る／「やめる」で何も消えず取込モーダルにデータが残る
  3. `max_total` 50枚で別コンテンツの表を削除して取込 → 横断削除が効く
  4. collab中の表から取込 → 壊れない（Bug#1非再発）
  5. **共有コピー取込の満杯解消が従来どおり動く**（`LimitResolutionSheet` マウント移動の巻き添えチェック）
  6. 新規作成画面が従来どおり動く（`contentSelection.ts` 差し替えの巻き添えチェック）

---

## 4. 影響範囲（着手時に開くファイル）

- **新規**: `src/lib/contentSelection.ts` — コンテンツ選択の共通純ロジック（+ 単体テスト）。
- [`src/components/SpreadsheetImportModal.tsx`](../../../src/components/SpreadsheetImportModal.tsx) — 先頭にコンテンツ選択ステップ追加・`onImport` を `(result,{contentId})=>Promise<boolean>` に変更・`defaultSelection` Props 追加・`handleConfirm` を async 化。
- [`src/components/Timeline.tsx`](../../../src/components/Timeline.tsx) — `handleSheetImport` を async 化し `opts.contentId` 使用＋上限判定＋`setLimitContext` 待ち（[1277-1298](../../../src/components/Timeline.tsx#L1277-L1298)）、`defaultSelection` を `currentPlan` から組み立てて Modal へ渡す（[3947-3951](../../../src/components/Timeline.tsx#L3947-L3951)）。
- [`src/components/Layout.tsx`](../../../src/components/Layout.tsx#L887) — `<LimitResolutionSheet />` を単一マウント追加。
- [`src/components/ShareImportSheet.tsx`](../../../src/components/ShareImportSheet.tsx#L457) — 内部の `<LimitResolutionSheet />` 撤去（マウント一元化）。
- [`src/components/NewPlanModal.tsx`](../../../src/components/NewPlanModal.tsx#L32-L87) — `hasContentRegistry`/`filteredBosses`/contentId 算出を `contentSelection.ts` 呼び出しへ差し替え（JSX不変）。
- 参照のみ（変更しない）: [`src/components/LimitResolutionSheet.tsx`](../../../src/components/LimitResolutionSheet.tsx) / [`src/store/useShareImportFlow.ts`](../../../src/store/useShareImportFlow.ts) / [`src/lib/shareImportTypes.ts`](../../../src/lib/shareImportTypes.ts) / [`src/lib/executePlanDeletions.ts`](../../../src/lib/executePlanDeletions.ts) / [`src/utils/planLimitChecker.ts`](../../../src/utils/planLimitChecker.ts) / [`src/lib/sheetImport/commitImportedPlan.ts`](../../../src/lib/sheetImport/commitImportedPlan.ts) / [`src/data/contentRegistry.ts`](../../../src/data/contentRegistry.ts)。
- i18n: コンテンツ選択ステップ用の `sheetImport.*` キー追加（4言語）。満杯解消は既存 `limit_resolution.*` を流用。

---

## 5. データフロー（変更後）

write path:
取込ボタン → モーダル[**コンテンツ選択(初期値=現文脈)**→モード→貼付→パーティ] → 作成 → `await onImport(result, { contentId: 選択値 })` →
`handleSheetImport`:
　`checkPlanLimit(plans, 選択contentId)` →
　- exceeded: `setLimitContext({reason, contentId, neededCount:1, planId:null, resolve})` で待つ → `LimitResolutionSheet` が `executePlanDeletions` → `resolve('resolved')`（or 'cancelled'）
　- resolved/上限内: `commitImportedPlan(result, { contentId: 選択値, title: 自動 })` → `commitNewPlan` → `usePlanStore.addPlan` → localStorage + Firestore → return true
→ モーダル: `committed===true` なら閉じる（データリセット）、false なら開いたまま。

read path: 既存どおり（プラン一覧は contentId で棚分け）。誤紐付けが消え、取り込んだ表は選んだコンテンツに正しく現れる。

---

## 6. 前提・未解決（実装計画で決める）

- `defaultSelection` 復元の細部: 非Registry系コンテンツ（dungeon/raid/custom）の初期 category/level の確定方法（`currentPlan.category`/`level` を信頼）。SavedPlan が `category`/`level` を常に持つかの確認（NewPlanModal は commit 時に付与）。
- `handleSheetImport` のテスト容易性: 確定ロジックを純関数 or 薄いユーティリティに切り出すか、`handleSheetImport` 内に置くか（モック容易性で判断）。
- `setLimitContext` 後の share `status` 残留（`'limit_hit'`→`'importing'`）の影響確認（共有フロー再開時は `start()` が `'loading'` リセット＝無害の見込み）。
- マウント移動後の z-index 整合（`LimitResolutionSheet` は z=99992/99993・取込モーダルは z=200。シートが上に出る＝意図通り）。

---

## 7. 繰り越し: ②途中取込（本spec対象外）

「選んだ表の時刻以降から途中取込」は別specで再ブレストする。なぜ重いか（着手時の前提）:

- **パーティ統合（最大の難所）**: 既存パーティと取込パーティの突合（同ジョブ=同人物か？）が本質的に曖昧。軽減の ownerId は取込側スロットに紐づくため、突合がズレると軽減が宙に浮く。FFLogs append は同一プラン内追記で owner 問題が起きないが、スプシは別構成を持ち込む。
- **再アンカー（軽減の技追従）不可**: AppliedMitigation に技参照フィールドが無く、単純時刻オフセットを超える「技に合わせて軽減もずらす」には構造拡張 or 推測マッチが必要。FFLogs でも Phase 1.5 として後回し（`docs/superpowers/specs/2026-06-20-fflogs-import-modes-design.md:103-106`）。
- **流用元**: FFLogs の `replace_all/replace_keep/append`（`src/utils/importModes.ts:16-32` / `src/utils/templateImportPhases.ts:9-26`）はイベント/フェーズ単位で純粋関数化済。時刻オフセット加算は新規。
- 割り切り案（着手時の出発点）: 「単純時刻オフセットのみ・微調整は手動」に絞ると設計が大幅に簡単になる。
