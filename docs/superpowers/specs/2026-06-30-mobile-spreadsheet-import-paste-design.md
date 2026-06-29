# スマホのスプレッドシート取込（貼り付け方式・編集なし）— 設計書

作成: 2026-06-30 / 状態: 設計確定（ユーザー承認済み 2026-06-30）

## 背景・目的
スマホのインポートにスプシ取込ボタンは追加済み（[2026-06-26-mobile-spreadsheet-import-design.md](./2026-06-26-mobile-spreadsheet-import-design.md)）だが、実機で取り込めず、現在は「近日公開」モーダルで蓋をしている（[Timeline.tsx:4027-4078](../../../src/components/Timeline.tsx#L4027-L4078)）。

このセッションで **iPhone 実機採取により真因が確定**したため、本格対応する。

### 実機で確定した事実（2026-06-29・端末=iPhone/Safari・診断ページ `/clip`）
1. **コピー形式はPCと同じ TSV**: Googleスプレッドシート アプリのコピーは `text/plain` にタブ区切り（3480タブ/87行）を持つ。`text/html` も完全な `<table>`（`<tr>`87・`<td>`3427）を含む。→ **当初仮説「コピー形式が違うから取れない」は誤り。データはスマホでも取得できる。**
2. **真因 = クリップボードAPIのブロック**: 既存スマホ取込が頼る `navigator.clipboard.readText()`（[SpreadsheetGridImportModal.tsx:302](../../../src/components/SpreadsheetGridImportModal.tsx#L302)）は iPhone/Safari で `NotAllowedError` になり、テキストを取得できない。
3. **動く経路 = textarea への手動ペースト**: 本物の `<textarea>` に長押し→ペーストすると、`onPaste` でフルの TSV が取得できる（`/clip` で実証済み）。既存コードが contentEditable な `<div>` の `onPaste` を避けて `readText()` にした経緯（[同296行コメント](../../../src/components/SpreadsheetGridImportModal.tsx#L296)）は、本物の `<textarea>` を使えば回避できる。

### ユーザー合意の方針
- スマホでは **表（グリッド）のセル編集はしない**（96vw モーダルで現実的でないため割り切る）。編集はPC用と位置づける。
- スマホの流れ = **コンテンツ選択 → 貼り付け（＋フェーズ名は任意）→ パーティ割当 → 取り込む**。
- コピー手順の案内は **短い文章のみ**。図解（スクショ入り）は作らない。

## 現状の構造（確認済み）
- 取込モーダル [SpreadsheetGridImportModal.tsx](../../../src/components/SpreadsheetGridImportModal.tsx) は3ステップウィザード:
  - **Step1**: コンテンツ選択（[ImportContentSelector](../../../src/components/ImportContentSelector.tsx)・どのボス/レイドか）[L551-561](../../../src/components/SpreadsheetGridImportModal.tsx#L551-L561)
  - **Step2**: 貼り付けグリッド（`<div tabIndex onPaste>` が貼付サーフェス・[GridView](../../../src/components/SpreadsheetGridImportModal.tsx#L643)）＋ フェーズ名入力。空状態では「貼り付け」ボタン（`readText()`）が出る [L635-674](../../../src/components/SpreadsheetGridImportModal.tsx#L635-L674)
  - **Step3**: パーティ割当（[PartyAssignmentStep](../../../src/components/SpreadsheetGridImportModal.tsx#L679-L687)）
- 貼り付け本体ロジック `ingestText(text)` はテキストを受け取り、matrix形式か grid形式かを判定して table state を作る（[L260-286](../../../src/components/SpreadsheetGridImportModal.tsx#L260-L286)）。パーサ [parseGridPaste.ts](../../../src/lib/sheetImport/parseGridPaste.ts) は `split('\t')` の TSV 前提で **そのまま流用可**。
- モーダルは Timeline の `showGridImport` state 1つで開閉し、PC（`timeline:grid-import` イベント）とスマホ（ボタン）で同一インスタンスを共有する。→ プロップでの出し分けではなく **実行時のモバイル判定**が必要。
- モバイル判定の共通フックは未存在（各所 Tailwind `md:` で対応）。

## 設計（案1: 既存モーダルにモバイル分岐を1つ足す）
PCの体験は一切変えず、**スマホのときだけ Step2 の中身を差し替える**。Step1 / Step3 / パーサ / 取込ロジックは共有する。

### ① 入口の蓋を外す（Timeline.tsx）
- スプシ取込ボタンの `onClick` を `setGridSoonOpen(true)` → `setShowGridImport(true)` に変更（[Timeline.tsx:4028-4040](../../../src/components/Timeline.tsx#L4028-L4040)）。PCと同じ着地点。
- `gridSoonOpen` state（[L1478](../../../src/components/Timeline.tsx#L1478)）と「近日公開」中央モーダル（[L4056-4078](../../../src/components/Timeline.tsx#L4056-L4078)）を撤去。
- 不要になる i18n キー: `mobile.import_spreadsheet_soon_title` / `mobile.import_spreadsheet_soon_toast`（4言語）。`mobile.import_spreadsheet_desc` は残す。

### ② モバイル判定フック（新規）
- `src/hooks/useIsMobile.ts` を新設。`window.matchMedia('(max-width: 767px)')`（Tailwind の `md` ブレークポイント境界 = 768px に揃える）を購読し boolean を返す。
- SSR / `matchMedia` 非対応環境では `false`。`change` イベントで購読・解除する。
- 純ロジックを単体テスト可能にするため、判定式は薄いユーティリティに切り出してよい（実装計画で判断）。

### ③ Step2 のスマホ版（編集グリッドなし）
`SpreadsheetGridImportModal` 内で `useIsMobile()` を呼び、Step2 を分岐する。

- **PC（既存）**: 現行どおり `GridView` ＋ `<div onPaste>` ＋ 空状態の `readText()` ボタン。**変更しない。**
- **スマホ（新規）**: `GridView` を**マウントしない**（重いため）。代わりに以下を縦に並べる:
  1. **コピー案内（折りたたみ・短文のみ）**: 「Googleスプレッドシートで範囲を選んでコピー → 下のボックスを長押しして『ペースト』」程度。図解なし。
  2. **貼り付け `<textarea>`**: 大きめ・読みやすいフォント。`onPaste` で `e.clipboardData.getData('text/plain')` を取り、既存 `ingestText(text)` を呼ぶ（規定の貼り付けはそのまま textarea に入れてよい＝プレビュー兼）。`readText()` 経路はスマホでは使わない。
  3. **確認サマリー**: 貼り付け後に「✓ 読み取りました — スキル **N個** / フェーズ **M個**」を表示。
     - 件数算出は matrix / grid 両対応。grid は `table.rows.length`（≒スキル行数）、フェーズ数は検出フェーズ。matrix は既存の `entries` / `matrixParsed` から件数を出す（実装計画で既存の件数算出ロジック [perPhaseMits 周辺](../../../src/components/SpreadsheetGridImportModal.tsx#L596-L597) を再利用）。
     - 表示は read-only。誤りがあってもスマホでは編集しない（割り切り）。
  4. **フェーズ名入力（任意）**: 既存 `phaseName` state をそのまま使う。matrix 形式で必要。
- **未貼付ガード**: フッターの「次へ」（[L721-728](../../../src/components/SpreadsheetGridImportModal.tsx#L721-L728)）は、スマホで検出件数が 0 のとき **disabled**。空のまま誤って次へ進む/作成するのを防ぐ。

### ④ Step1 / Step3 / 取込（変更なし）
- Step1 コンテンツ選択、Step3 パーティ割当、`onImport` 配線はそのまま。スマホでも動作する。
- レイアウトが窮屈な箇所のみ最小限の調整（必要時）。大きな再設計はしない（スコープ外）。

### ⑤ i18n（4言語: ja/en/ko/zh）
- 追加: コピー案内文、確認サマリー文（`{count}` 補間でスキル数・フェーズ数）、ガード関連文言。
- 撤去: 「近日公開」系キー（上記①）。
- ロケールJSONは[該当ブロックのみ textual 編集](../../../src/locales/ja.json)（全体 parse→stringify しない・4言語 parity 維持）。

## スコープ / 非対象
- **対象**: 上記①〜⑤。
- **非対象**:
  - PC のグリッド編集体験（不変）。
  - スマホでのセル編集・列の手動再割当（提供しない）。
  - コピー手順の図解（作らない）。
  - スマホ向けモーダルの抜本リデザイン（窮屈さの最小調整のみ）。
- **後始末**: 本機能が実機で動作確認できたら、診断ページ `/clip`（`src/components/ClipboardInspectorPage.tsx` ＋ App.tsx のルート ＋ lazy import）を撤去する。

## テスト / 検証
- **単体**: `useIsMobile`（または切り出した判定ユーティリティ）の matchMedia 分岐テスト（mobile / desktop / matchMedia 非対応）。
- **コンポーネント**: モーダルのスマホ分岐 — textarea への貼り付けで `ingestText` が走り確認サマリーが出ること、検出0で「次へ」が disabled になること。`useIsMobile` をモックして mobile 経路を再現。
- **回帰**: 既存テスト（`SpreadsheetGridImportModal.test.tsx` 等）を壊さない。`npm run build`（tsc 厳密）通過。`npx vitest run` で新規 failure ゼロ（既知5件=TopBar4 + HousingWorkspace1 は除く）。
- **実機**: iPhone/Safari で「インポート → スプレッドシートから取り込み → コンテンツ選択 → 貼り付け → 確認サマリー → パーティ割当 → 取り込む」を1回通す（[feedback_one_fix_one_verify] に従い段階的に）。

## 追補 (2026-06-30 実機検証後・スマホのみ追加対応)
iPhone 実機検証で判明: ユーザーの有名スプシは **grid(列)形式**だった。grid はパーティ割当ステップ(Step3)を通らず即「作成」になり、パーティ枠は member 列の `slot` で決まる(PC はグリッド列ヘッダの `<select>`=`setColSlot` で割当)。スマホは編集グリッド非表示のため枠割当 UI が無く、役割あたり複数列があると未割当で**作成できず詰む**。`mobile_grid_needs_pc`(PC案内)では「スマホで完結したい」要望を満たせない。[[project_spreadsheet_mobile_grid]]

**制約 (厳守): PC は一切変更しない。すべて `isMobile` 分岐の中だけ。** PC の grid 体験(GridView 列ヘッダ枠割当・フッター文言)は正常動作中につき不変。

### 追加 A — スマホ grid のパーティ枠割当リスト (スマホ分岐内のみ)
スマホ Step2 本体(貼付 textarea の下・スクロール領域内)に、source==='grid' のとき、検出した各 member 列(`c.field==='member' && c.jobId`)を縦リストで表示:
- 各行 = ジョブ名(`jobs` から `jobId` で引き・`gridLang` ローカライズ) + 枠 `<select>`(`SLOTS_BY_ROLE[roleOf(jobId)]` の選択肢 + 「未割当」)。
- 変更時、その列の `slot` を更新(PC の `setColSlot` と同じ: `setTable(prev => ({...prev, columns: prev.columns.map((c,i)=> i===ci ? {...c, slot} : c)}))`。GridView の `setColSlot` は触らずモーダル側に同等ハンドラを追加)。
- これにより `partyComplete` が満たされ「作成」が押せる。`mobile_grid_needs_pc` バナーはこのリストに**置き換え**(キーは撤去 or 流用)。

### 追加 B — 小画面スクロール/溢れ解消 (スマホ分岐内のみ)
原因: フッター(`shrink-0`)の grid 作成ブロック(サマリー/警告/skipped/作成ボタン)が小画面で折返し縦に伸び、モーダル `overflow-hidden` で下端が切れる。
対応(スマホのみ): フッターの**冗長なステータス文(サマリー/blockMsg/skipped/権利表記/未解決注記)をスクロール本体側へ移し**、フッターは「戻る/やり直す + 作成ボタン」の最小1行に保つ。PC はフッターに従来どおり全文表示(不変)。どんな小型 iPhone でも全要素にスクロールで到達できることを実機で確認。

## 想定リスク・留意点
- **列検出ミスの非修正**: スマホでは列の再割当ができないため、パーサがジョブ列等を誤検出すると直せない。ただし有名スプシは PC の §9.7 取込で扱えている実績があり、許容範囲（ユーザー合意）。パーティ割当（Step3）で主要な job→slot 補正は可能。
- **textarea の巨大貼り付け**: `text/html` は 1.6MB に達するが、取込が使うのは `text/plain`（数KB〜）。textarea には plain が入るので重さは問題にならない見込み（実装時に確認）。
- **iOS の貼り付けメニュー**: 本物の `<textarea>` なら長押しで「ペースト」が出ることを `/clip` で実証済み。contentEditable `<div>` の不具合は回避される。
