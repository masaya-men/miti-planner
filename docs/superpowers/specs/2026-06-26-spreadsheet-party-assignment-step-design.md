# 有名スプシ取込: パーティ割当を独立ステップに切り出す — 設計書

作成: 2026-06-26 / 状態: 設計確定（ユーザー承認済み）

## 背景・目的

有名スプシ（行列形式 = TRUE/FALSE マトリクス）の取込で、複数フェーズ（P1〜P5 等）を順に貼って
最後に作成しようとすると **パーティ割当が不可能になって詰む** という致命的 UX バグがある。

ユーザー報告（再現フロー）:
> P1 を貼る→次へ→P2…→P5 を貼る→次へを押した。→この内容で作成したいが、すでにプレビューエリアに表は
> ないので「パーティを割り当てろ」と言われても割り当てられない。結果、最初から作り直すしかなかった。

これを解消し、有名スプシ取込を「貼って次々進めば必ず作成できる」確実な体験にする。

## 現状の事実（コードで確認済み）

### 詰みの仕組み

- パーティ枠（MT/ST/H1/H2/D1〜D4）のセレクタは **「今表示中の貼り付け表の列ヘッダー」の中にしか無い**
  （[SpreadsheetGridImportModal.tsx:909-941](../../../src/components/SpreadsheetGridImportModal.tsx#L909-L941) の `c.field === 'member'` 分岐）。
- 「このフェーズを追加」（[handleAddPhase, :341-349](../../../src/components/SpreadsheetGridImportModal.tsx#L341-L349)）は追加後に
  `setTable(emptyHeaderTable(t))` で **表示中の表をクリア**する。クリア後の表は見出しだけで member 列が無い。
- よって、道中で割当せず P1〜P5 を貼り続けると、最後の追加で表示エリアが空になり **枠セレクタが画面上に存在しなくなる**。
- 一方、作成は「パーティ未完成」でブロックされる（[partyComplete, :436-450](../../../src/components/SpreadsheetGridImportModal.tsx#L436-L450)、
  [importBlockReason → party_incomplete_warning, :512](../../../src/components/SpreadsheetGridImportModal.tsx#L512)）。
- 結果 = **割当を求められるが割当 UI が無い** → デッドエンド。

### 既存の自動割当ロジック（再利用できる資産）

- [`resolveImportParty(usedJobIds, jobs)`](../../../src/lib/sheetImport/resolveImportParty.ts) が検出ジョブを枠へ割り当てる純関数として既に存在し、
  **[`buildPlanFromSheets.ts:87`](../../../src/lib/sheetImport/buildPlanFromSheets.ts#L87) の `partyOverride ?? resolveImportParty(...)` で既定割当として使われている**。
- DPS のサブロール順（近接 → 遠隔物理 → キャスター = D1〜D4）は実装済み
  （[dpsOrder.ts](../../../src/data/dpsOrder.ts) の `DPS_MELEE` / `DPS_PHYS_RANGED` / `DPS_MAGIC_RANGED`）。
- **タンク・ヒラは「検出順」のまま**で、MT/ST・PH/BH のサブロール規則は入っていない（[resolveImportParty.ts:12-13, :37-46](../../../src/lib/sheetImport/resolveImportParty.ts#L37-L46)）。
- ジョブデータ（[types/index.ts:28](../../../src/types/index.ts#L28)）の `role` は `'tank' | 'healer' | 'dps'` のみ。ヒラの pure/barrier 区別フラグは**存在しない**。
- canonical なジョブ並び順（[mockData.ts:143-167](../../../src/data/mockData.ts#L143-L167)）:
  - タンク: `pld, war, drk, gnb`
  - ヒラ: `whm, sch, ast, sge`（pure/barrier が交互で、配列順では PH/BH を再現できない）

### モーダルの割当 state（現状の初期化）

- `assignment`（`PartyAssignment` = slot→jobId）は検出ジョブ変化時に
  `autoFillSingles(pruneAssignment(prev, ...), ...)` でしか埋まらない（[:371-373](../../../src/components/SpreadsheetGridImportModal.tsx#L371-L373)）。
- `autoFillSingles` は「ロール内に未割当が1人 かつ 空き枠が1つ」のときだけ自動割当（[partyAssignment.ts:57-69](../../../src/lib/sheetImport/partyAssignment.ts#L57-L69)）。
  → フル8人（タンク2・ヒラ2・DPS4）は1つも自動で埋まらず、手動必須になる。

## 設計

### A. 画面構成: 2ステップ → 3ステップ ウィザード（有名スプシ経路）

| ステップ | 内容 | 主ボタン |
|---|---|---|
| 1. コンテンツ選択 | 現状のまま | 次へ → |
| 2. 表を貼る | P1 貼る→「フェーズを追加」→P2…。プレビュー表示は現状のまま。**列ヘッダーの枠セレクタは撤去**（ステップ3へ移動） | 次へ（割当へ）→ |
| 3. パーティ割当 | 検出した全ジョブを枠へ割当。**入室時に自動で仮割当済み**。入れ替えたい枠だけ触る | 作成 |

- `WizardStep` 型を `1 | 2` → `1 | 2 | 3` へ拡張。ステップ表示（タイトル行の `step/N`）も追従。
- ステップ2 → 3 へ進む際、**未追加の貼り付けドラフトがあれば自動でフェーズ追加してから遷移**（既存 `handleConfirm` の
  「未追加ドラフト自動取込」=[:463-468](../../../src/components/SpreadsheetGridImportModal.tsx#L463-L468) と同じ思想）。これで検出ジョブが確定した状態で割当に入る。
- これにより「最後に割当 UI が消える」構造的デッドエンドが解消（割当は貼り付け状態と無関係に常に開ける）。

### B. ステップ3の見た目（ロール別に枠を並べる）

```
タンク   MT [ナイト ▾]   ST [戦士 ▾]
ヒラ     H1 [白魔 ▾]     H2 [学者 ▾]
DPS      D1 [モンク ▾]  D2 [竜騎士 ▾]  D3 [吟遊詩人 ▾]  D4 [黒魔 ▾]
```

- 8枠を `MT/ST` `H1/H2` `D1〜D4` のロール別に配置。各枠は1つのドロップダウン。
- 選択肢は **そのロールで検出されたジョブ**（+「未割当」）。ドロップダウンで入れ替え可能。
- 入室時点で自動仮割当済み（C 参照）。検出されていない枠は空欄表示。
- 検出ジョブが0のとき（member 列なし）は「パーティ検出なし」の note を出し、作成はブロックしない。
- 既存デザイントークン・glass・白黒のみ規約に従う（新規アクセント色なし。警告=黄/危険=赤/進む=青のみ）。

### C. 自動仮割当のロジック（既存再利用 + PH/BH 追加）

#### C-1. 仮割当の供給元

- モーダルの `assignment` state を **`resolveImportParty` の結果でシードする**（`autoFillSingles` のみだった初期化を置き換え）。
  変換 = `resolveImportParty(detectedJobIds, jobs)` が返す `{slot, jobId}[]` → `PartyAssignment`（slot→jobId）。
- **手動編集の保持**: 既に手動で割り当てた枠は上書きしない。
  挙動 = 「`prune`（消えたジョブの枠を外す）→ 手動済み枠は維持 → 空き枠のみ `resolveImportParty` の既定で埋める」。
  フェーズ追加・貼り直しで検出ジョブが増えても、既存の手動割当を壊さず新規分だけ自動補完。

#### C-2. `resolveImportParty` のサブロール順を拡張

現状 DPS のみ実装されているサブロール順を、タンク・ヒラにも広げる（[dpsOrder.ts](../../../src/data/dpsOrder.ts) と同じ「順序配列」方式で DRY）。

- **タンク（MT/ST）**: canonical 順 `pld → war → drk → gnb` で検出タンクを並べ、先頭を MT・次を ST。
  （FF14 にジョブ由来の MT/ST 規則は無いため、これは決定的な既定。ユーザーがステップ3で入れ替え可能。）
- **ヒラ（H1/H2）**: pure（PH）= `whm, ast` を H1 優先、barrier（BH）= `sch, sge` を H2 優先。
  pure 1人 + barrier 1人なら pure→H1 / barrier→H2。pure 2人・barrier 2人など同サブロール複数時は canonical 順で安定化。
- **DPS（D1〜D4）**: 実装済みをそのまま（`dpsRank` 昇順）。
- 新規の順序データは `dpsOrder.ts` 同様の共有定数として定義（例: `TANK_ORDER`、`HEALER_PURE` / `HEALER_BARRIER`）。
  置き場所は `dpsOrder.ts` への併記 or `partyRoleOrder.ts` 新設のいずれか（実装計画で確定）。

#### C-3. 共有関数への影響（要 runtime 点検）

`resolveImportParty` は [`buildPlanFromSheets.ts:87`](../../../src/lib/sheetImport/buildPlanFromSheets.ts#L87) の **partyOverride 未指定時の既定割当**でも使われる共有関数。
タンク/ヒラのサブロール順を強化すると、override を渡さない経路（他の取込・テスト）の既定割当も MT/ST・PH/BH 準拠に改善される。
これは整合的かつ望ましい変化だが、**既存テストの期待値（検出順前提のもの）が変わる**可能性があるため、
`resolveImportParty.test.ts` を新仕様に合わせて更新する（[[feedback_structural_refactor_runtime_audit]] に従い、依存箇所を洗い出してから一括で直す）。

### D. メモ③対応（戻る / クリア）

- **戻る**: ステップ間を戻ってもデータは保持（5フェーズ貼り直しを防ぐ）。現状の `setStep` のみ挙動を踏襲。
- **クリア（やり直し）ボタンを新設**（ステップ2）: 貼った内容（`table` / `source` / `matrixParsed` / `entries` / `phaseName` /
  `assignment` / `targetOverrides`）を初期化し、モーダルを閉じ直さず最初から貼り直せるようにする。
  リセット内容は「モーダルを開いた瞬間のリセット」（[:226-240](../../../src/components/SpreadsheetGridImportModal.tsx#L226-L240)）と同一の純粋初期化を関数化して共用。
  - 配置・文言は破壊操作なので控えめに（確認は不要レベルだが、誤爆しにくい位置・サイズ）。

### E. スコープ / 非対象

- **対象**: 有名スプシ（行列形式 = `source === 'matrix'`）の取込フロー。
- **非対象（今回）**: 自作スプシ（`source === 'grid'`）。
  - grid は単一ブロックで member 列が常に表示されており、`handleAddPhase` のような表示クリアが無いため **本デッドエンドは発生しない**。
  - よって grid 経路は現状維持（ステップ2 で列ヘッダー内の枠割当 + 作成ボタン）。3ステップ化は matrix 経路のみ。
  - フッターの主ボタンは source で分岐: matrix（or entries あり）= 「次へ（割当へ）」、grid = 「作成」（現状どおり）。
  - **既知の非対称**: grid と matrix でステップ数が異なる。自作対応に着手する際にステップ3へ統合する（別タスク）。

### F. i18n

新規キーを4言語（ja/en/ko/zh）に追加（[i18n ルール](../../../.claude/rules/i18n.md)・パリティ維持）:

- `gridImport.step_party`（ステップ3ラベル「パーティ割当」相当）
- ステップ3のロール見出し / 枠ラベルが必要なら（MT/ST 等は英字記号のままで可）
- `gridImport.no_party_detected`（パーティ検出なしの note）
- `gridImport.clear`（クリア / やり直しボタン）

## テスト / 検証

### ユニットテスト

- `resolveImportParty.test.ts` を新仕様で更新・追加:
  - フル8人（pld/war/whm/sch/mnk/drg/brd/blm 等）で MT/ST・PH/BH・D1〜D4 が期待通り。
  - ヒラ pure+barrier の H1/H2 振り分け（ast+sch → H1=ast, H2=sch）。
  - タンク canonical 順（war 先検出でも pld があれば pld=MT）。
- 仮割当シード + 手動編集保持のロジック（純関数に切り出してテスト）:
  - フル8人で全枠自動充填 → `isAssignmentComplete` が true。
  - 手動で1枠変更 → 別フェーズ追加で検出ジョブ増 → 手動枠は不変・新規枠のみ自動。

### ビルド / 既存テスト

- `npm run build`（tsc -b + api + vite）が通ること（[[feedback_vercel_tsc_strict]]）。
- `npm run test`（vitest）緑。`partyAssignment.test.ts` / `buildPlanFromSheets.test.ts` / `gridRowsFromResult.test.ts` の
  既定割当依存箇所を確認・必要なら更新。
- i18n パリティテスト（`sheet-import-wizard-i18n-parity.test.ts`）緑。

### 実機（PC）E2E — エンドユーザー視点で1回通す（[[feedback_endpoint_user_verification]]）

1. 有名スプシ P1 を貼る → 「フェーズを追加」→ P2…P5 を追加 → 「次へ（割当へ）」。
2. ステップ3で **8枠が自動で埋まっている**ことを確認（MT/ST・H1/H2・D1〜D4 が妥当）。
3. そのまま「作成」→ タイムラインに正しく取り込まれる（割当を1つも手動でしなくても作成できる）。
4. 枠を1つ入れ替え → 反映される。
5. ステップ2 に戻ってもデータが残っている。クリアボタンで全消去 → 貼り直せる。

## 確定した設計判断（要約）

- 3ステップウィザード（matrix のみ）。割当を独立ステップへ。
- 自動仮割当は `resolveImportParty` 再利用 + タンク canonical 順 + ヒラ PH/BH を追加。手動編集は保持。
- タンク MT/ST はジョブ並び順の既定（FF14 にジョブ規則なし・入れ替え可）。
- クリアボタン新設・戻るはデータ保持。
- 自作スプシ（grid）は今回非対象（デッドエンド無し・現状維持）。
