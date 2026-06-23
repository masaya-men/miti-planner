# 取込フロー v2（前半）設計書 — ①満杯時削除取込 + ③コンテンツ選択前段化

- 日付: 2026-06-23
- ステータス: 設計確定（ユーザー承認済・実装計画 writing-plans へ）
- スコープ: スプレッドシート取込の体験改善のうち **①** と **③** を本spec対象とする。**②（途中取込）は本spec対象外**（§7 に繰り越しメモ）。

---

## 1. 目的とスコープ

「取込体験」3課題のうち、地続きでまとめて設計できる2つを本specで扱う。

- **① 5/5満杯時に選択削除しながら取込**: 選んだコンテンツが上限(5枚)のとき、既存1枚を選んで削除してから取り込む導線を作る。破壊操作なので安全な確認UXを伴う。
- **③ 取込押下時にコンテンツ選択を前段化**: 現状「今開いている表のコンテンツ」を無条件流用して別コンテンツへ誤紐付けする実バグを、取込前のコンテンツ選択で根治する。

①と③は **同じ「対象コンテンツの既存表一覧」と「取込確定パイプライン」を共有**するため、1つのモーダル体験として統合設計する。

### 非対象（本specでやらない）
- **②途中取込**（時刻オフセット/フェーズ連結/パーティ統合）。技術的難度が①③と桁違い（§7）。
- in-place 上書き（`replace_current`）経路の新設。ユーザー判断で「上書きは外す」と確定済（§3-B）。
- 取込プランの手動命名UI（自動命名を維持・§3-C）。
- 新規作成画面(NewPlanModal)の render(JSX) 改修（共通化はロジックのみ・§3-D）。

---

## 2. 現状（実装の事実・file:line）

取込はすべて「新しい軽減表を1枚作る」処理に集約され、共有ハンドラ `commitNewPlan` に収束する。

確定パイプライン:
`SpreadsheetImportModal.handleConfirm` → `buildPlanFromSheets(entries)` → `onImport(result,'new')` → `Timeline.handleSheetImport`（上限チェック・contentId決定）→ `commitImportedPlan(result,{contentId,title})` → `commitNewPlan(newPlan)` → `usePlanStore.addPlan` → localStorage + Firestore。

壊してはいけない順序（既知バグ修正済の要所）:
- `commitNewPlan` の順序 = `addPlan → setLoadedPlanId → setCurrentPlanId`（[`src/lib/commitNewPlan.ts:5-17`](../../../src/lib/commitNewPlan.ts#L5-L17)）。`_loadedPlanId` を新プランへ先に向けないと直前プランを空データで破壊する。
- `commitImportedPlan` の collab対処 = `disconnect → exitCollabMode → 直前プラン保存 → loadSnapshot`（[`src/lib/sheetImport/commitImportedPlan.ts:40-57`](../../../src/lib/sheetImport/commitImportedPlan.ts#L40-L57)）。崩すと Bug#1（loadSnapshot no-op）が再発する。

①関連:
- 上限定数 `MAX_TOTAL_PLANS=50` / `MAX_PLANS_PER_CONTENT=5`（[`src/types/firebase.ts:162-166`](../../../src/types/firebase.ts#L162-L166)）。ロール別の上限差はコード上に根拠なし（定数固定）。
- 現状の満杯検査は**取込確定後**の `Timeline.handleSheetImport` 内（[`src/components/Timeline.tsx:1277-1298`](../../../src/components/Timeline.tsx#L1277-L1298)）。満杯なら `showToast('sheetImport.limit_reached')` → `return` で**無反応中断**（選択UIは存在しない）。
- 上限判定ユーティリティ `checkPlanLimit`（`reason: 'max_total' | 'max_per_content'`）が既存（[`src/utils/planLimitChecker.ts:13-25`](../../../src/utils/planLimitChecker.ts#L13-L25)）。
- 削除の下回りは揃っている: ソフト削除（墓標化）[`src/lib/planService.ts:328-356`](../../../src/lib/planService.ts#L328-L356) / ローカル即除去+墓標追跡 [`src/store/usePlanStore.ts:184-206`](../../../src/store/usePlanStore.ts#L184-L206) / 複数削除フロー [`src/lib/executePlanDeletions.ts:20-26`](../../../src/lib/executePlanDeletions.ts#L20-L26)。
- i18n雛形あり: `feedback_max_total` / `feedback_max_per_content` / `plan_limit_max_total_row` / `plan_limit_max_per_content_row`（[`src/locales/ja.json:244-249`](../../../src/locales/ja.json#L244-L249)）、`sheetImport.limit_reached`（`ja.json:2628`）。

③関連:
- contentId は取込時に「今開いているプラン」から自動流用: `currentContentId = resolveContentId(currentPlan?.contentId, joinerContentId)`（[`src/components/Timeline.tsx:1271-1274`](../../../src/components/Timeline.tsx#L1271-L1274)）→ `handleSheetImport` で `contentId = currentContentId ?? null`。**コンテンツ先行選択の経路なし**。
- 入口 `ImportMenu` は `CustomEvent('timeline:spreadsheet-import')` を投げるだけで contentId を渡さない（[`src/components/ImportMenu.tsx:86-90`](../../../src/components/ImportMenu.tsx#L86-L90)）。
- `commitImportedPlan` は `meta.contentId` を検証なしで新プランへ付与（[`src/lib/sheetImport/commitImportedPlan.ts:22-25,60-65`](../../../src/lib/sheetImport/commitImportedPlan.ts#L22-L25)）。
- 誤った contentId でも `generateUniqueTitle` は誤コンテンツ内で重複検査が走る（[`src/utils/planTitle.ts:8-14`](../../../src/utils/planTitle.ts#L8-L14)）。**データ損失はしないが「期待したコンテンツに入らない」体験バグ**。
- 正典のコンテンツ選択UI = NewPlanModal: Level→Category→（Registry系のみ）Boss→Title、`contentId = boss?.id || (hasContentRegistry(category) ? null : title.trim())`（[`src/components/NewPlanModal.tsx:50-124,165-167,308-343`](../../../src/components/NewPlanModal.tsx#L50-L124)）。

---

## 3. 設計

### 3-A. 新しい取込フロー（ユーザー体験・全体像）

取込ボタン → 1つのモーダルを上から順に進む:

1. **コンテンツ選択（新規・先頭ステップ）**: 「どのコンテンツの表として取り込むか」を Level→カテゴリ→ボス で選ぶ（NewPlanModal と同じ選び方）。**初期値 = 今開いている表と同じコンテンツ**（普段は触らず次へ）。
2. **（満杯なら）枠の確保**: 選んだコンテンツが既に5/5なら「満杯です」警告＋その5枚一覧を表示。消す1枚を**マーク**する（この時点では削除しない）。
3. **貼り付け**: フェーズ名＋表データ（現状どおり）。
4. **パーティ割当**: 現状どおり。
5. **作成**: 通常は「取り込む」。枠確保で1枚マークした場合のみボタンが赤＋**「『○○』を削除して取り込む」**に変化。押下で「削除→新規作成」を一気に実行。**途中でやめれば何も消えない**。

設計原則: **削除は最終確定ボタン押下時のみ実行**。マーク段階・キャンセル・気変わりでは表は消えない。

### 3-B. 満杯時の削除UX（①詳細）

- トリガー: 選んだコンテンツが `MAX_PLANS_PER_CONTENT = 5` に到達（コンテンツ選択直後にライブ判定し、その場で警告＋一覧を出す）。
- 一覧: そのコンテンツの5枚（表名＋最終更新日程度）。1枚選ぶと赤ハイライト。
- 確認強度（ユーザー確定=A案・モーダル重ねない）: 最終ボタンに**消える表の名前**を出す＋下に「この表は元に戻せません」。別ダイアログは出さない。
- 実体: 既存ソフト削除を再利用（`planService.deletePlan` / `usePlanStore.deletePlan` / `executePlanDeletions`）。**新しい削除経路は作らない**。
- 「上書き(replace_current)」は提供しない（ユーザー確定）。理由: 既存表の中身を黙って差し替え＝最も気づきにくい消え方／新規コードパスで確定順序の再設計リスクに触れる／「1枚消して新規」で要求は満たせる。
- **全体50枚(`max_total`)の特殊ケース**: 選んだコンテンツに削除候補が1枚もない（=まっさらな新コンテンツなのに全体50枚）稀な状況のみ、コンテンツ内削除では救えない。この場合は削除一覧を出さず「他のコンテンツの不要な表を削除してください」と案内文に留める。判定は `checkPlanLimit` の `reason` を流用。
  - 補足: 選んだコンテンツに1枚でも表があれば、それを削除すると per-content と total の両カウントが下がるため、通常の削除一覧で50枚到達も解消できる。案内文に留めるのは「対象コンテンツ0枚 かつ total=50」のみ。

### 3-C. コンテンツ選択と誤紐付け根治（③詳細）

- ユーザーがステップ1で選んだコンテンツを `commitImportedPlan` の `meta.contentId` まで配線する。現状の `currentContentId` 自動流用は**初期値の決定**にのみ使い、確定値はユーザー選択値とする。
- 入口 `ImportMenu` → モーダル → `onImport` → `handleSheetImport` の経路で contentId を運ぶ。受け渡し方式は実装計画で決定（Props拡張 or `CustomEvent.detail` or モーダル内state）。`handleSheetImport` は `currentContentId` 自動流用をやめ、モーダルから渡る選択値を使う。
- contentId の算出ルールは NewPlanModal と同一に揃える: 零式/絶=ボスID、それ以外（dungeon/raid/custom）=タイトル文字列（`boss?.id || (hasContentRegistry(category) ? null : title.trim())`）。
- **表の名前**: 取込は自動命名を維持（コンテンツ内で重複しない名前を `generateUniqueTitle` で自動採番）。手動命名欄は付けない（取込のたびの入力は重い）。後でリネーム可。
- collab参加者(joiner)の取込: 初期値は現文脈（参加先コンテンツ）を提示し、ユーザーが変更可能。

### 3-D. 内部構造（壊さないための方針）

新規作成画面と取込画面で「Level→カテゴリ→ボス選択」が2箇所になる。重複は避けたいが、NewPlanModal は稼働中の要の画面であり、render改修は「テストが通っても実機が壊れる」共有構造リスクに該当する。

- **採用方針**: 選択の**ロジック（ボス絞り込み `filteredBosses` 相当・contentId算出）だけ**を共通の hook/util に切り出す。**JSXは NewPlanModal に手を入れず**、取込モーダル側に同等の見た目を新規実装する。重複の本質（ロジック）を1本化しつつ稼働中画面は非接触。完全なJSX統合は将来の別タスク。
- 確定パイプラインの順序（`commitNewPlan` の addPlan→setLoadedPlanId→setCurrentPlanId、collab切断→保存→loadSnapshot）は**一切変更しない**。本specで足すのは「確定の前に削除を1件挟む」分岐のみ。
- 削除→作成の実行順: マークされた planId を削除（`executePlanDeletions` 系）→ その後 `commitImportedPlan`。collab/Firestore の整合は既存削除フローの保証に乗る。実装計画で「削除完了を待ってから作成」する逐次性を担保する。

### 3-E. テスト・検証方針

- 単体: 枠確保判定（5/5でチューザー表示/非表示・total=50特殊ケース）／選択 contentId が確定まで届く／削除→作成の順序。
- 実機（最重要・過去教訓 [[feedback_structural_refactor_runtime_audit]] [[feedback_endpoint_user_verification]]）:
  1. 別コンテンツを選んで取込 → 正しい棚に入る（誤紐付け根治の確認）
  2. 5/5で1枚消して取込 → 消えて入る／やめたら消えない
  3. collab中の表から取込 → 壊れない（Bug#1非再発）
  4. 新規作成画面が従来どおり動く（共通化の巻き添えチェック）

---

## 4. 影響範囲（着手時に開くファイル）

- [`src/components/Timeline.tsx:1271-1298`](../../../src/components/Timeline.tsx#L1271-L1298) — contentId決定・上限チェック・onImport ハブ（自動流用→選択値へ）
- [`src/components/SpreadsheetImportModal.tsx`](../../../src/components/SpreadsheetImportModal.tsx) — コンテンツ選択ステップ＋満杯チューザー追加・`onImport` シグネチャ拡張
- [`src/components/ImportMenu.tsx:86-90`](../../../src/components/ImportMenu.tsx#L86-L90) — 入口の contentId 受け渡し
- [`src/lib/sheetImport/commitImportedPlan.ts`](../../../src/lib/sheetImport/commitImportedPlan.ts) — meta.contentId をユーザー選択値で受ける（順序は不変）
- [`src/lib/executePlanDeletions.ts`](../../../src/lib/executePlanDeletions.ts) / [`src/store/usePlanStore.ts:184-206`](../../../src/store/usePlanStore.ts#L184-L206) / [`src/lib/planService.ts:328-356`](../../../src/lib/planService.ts#L328-L356) — 削除の再利用
- [`src/components/NewPlanModal.tsx:50-167,308-343`](../../../src/components/NewPlanModal.tsx#L50-L167) — コンテンツ選択ロジックの共通化元（JSXは非接触）
- [`src/utils/planLimitChecker.ts`](../../../src/utils/planLimitChecker.ts) / [`src/utils/planTitle.ts`](../../../src/utils/planTitle.ts) — 上限判定・自動命名
- [`src/locales/*.json`](../../../src/locales/) — 満杯チューザー文言（`plan_limit_*` 雛形流用・4言語）

---

## 5. データフロー（変更後）

write path:
取込ボタン → モーダル[コンテンツ選択(初期値=現文脈)→(満杯なら削除マーク)→貼付→パーティ] → 確定 → (削除マークあれば executePlanDeletions で1件削除を待つ) → `onImport(result, { contentId: 選択値, deletePlanId? })` → `handleSheetImport` → `commitImportedPlan(result, { contentId: 選択値, title: 自動 })` → `commitNewPlan` → `usePlanStore.addPlan` → localStorage + Firestore。

read path: 既存どおり（プラン一覧は contentId で棚分け）。誤紐付けが消えるため、取り込んだ表は選んだコンテンツに正しく現れる。

---

## 6. 前提・未解決（実装計画で決める）

- contentId の受け渡し方式（Props拡張 / `CustomEvent.detail` / モーダル内state）は実装計画で最小変更を選ぶ。
- 共通化する hook/util の境界（`filteredBosses` 算出・`getSeriesByLevel`/`hasContentRegistry` 依存・contentId算出）の正確な切り出し範囲は実装時に確定。
- 削除→作成の逐次性（Firestore 削除の完了待ち）の具体的な待ち合わせ方法。
- 満杯チューザーに出す「最終更新日」等メタ情報の取得元（SavedPlan のどのフィールドか）。

---

## 7. 繰り越し: ②途中取込（本spec対象外）

「選んだ表の時刻以降から途中取込」は別specで再ブレストする。なぜ重いか（着手時の前提）:

- **パーティ統合（最大の難所）**: 既存パーティと取込パーティの突合（同ジョブ=同人物か？）が本質的に曖昧。軽減の ownerId は取込側スロットに紐づくため、突合がズレると軽減が宙に浮く。FFLogs append は同一プラン内追記で owner 問題が起きないが、スプシは別構成を持ち込む。
- **再アンカー（軽減の技追従）不可**: AppliedMitigation に技参照フィールドが無く、単純時刻オフセットを超える「技に合わせて軽減もずらす」には構造拡張 or 推測マッチが必要。FFLogs でも Phase 1.5 として後回し（`docs/superpowers/specs/2026-06-20-fflogs-import-modes-design.md:103-106`）。
- **流用元**: FFLogs の `replace_all/replace_keep/append`（`src/utils/importModes.ts:16-32` / `src/utils/templateImportPhases.ts:9-26`）はイベント/フェーズ単位で純粋関数化済。時刻オフセット加算は新規。
- 割り切り案（着手時の出発点）: 「単純時刻オフセットのみ・微調整は手動」に絞ると設計が大幅に簡単になる。
