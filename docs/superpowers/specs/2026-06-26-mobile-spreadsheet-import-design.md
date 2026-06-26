# スマホのインポートにスプレッドシート取込を追加 — 設計書

作成: 2026-06-26 / 状態: 設計確定（ユーザー承認済み）

## 背景・目的
PC のインポートメニュー（[ImportMenu.tsx](../../../src/components/ImportMenu.tsx)）は「FF Logs」＋「スプレッドシートから取り込み」の2つ。
スマホのインポートシート（[Timeline.tsx:4016-4051](../../../src/components/Timeline.tsx#L4016-L4051)）は「FF Logs」＋「みんなの軽減表」だけで、**スプレッドシート（列グリッド）取込が無い**。
スマホでもスプシを全選択コピー→貼り付けで取り込めるよう、PC に合わせてスプシ取込を出す。

## 現状の事実（確認済み）
- グリッド取込モーダル（[SpreadsheetGridImportModal.tsx:512](../../../src/components/SpreadsheetGridImportModal.tsx#L512)）は `w-[96vw] max-w-[1280px] h-[88vh]`。スマホでもほぼ全画面で開き、グリッドは横スクロールで操作可能（＝機能として使える）。
- モーダルは Timeline の `showGridImport` state で開閉（[Timeline.tsx:1486](../../../src/components/Timeline.tsx#L1486)）。PC は `timeline:grid-import` イベント → `setShowGridImport(true)`（[Timeline.tsx:959](../../../src/components/Timeline.tsx#L959)）。
- `FileSpreadsheet` アイコンは Timeline では未 import（追加が必要）。

## 設計
スマホのインポートシートに「スプレッドシートから取り込み」ボタンを1つ追加する。

- 配置: PC の並びに合わせ **FF Logs の直下**（「みんなの軽減表」はその下のまま）。
- 動作: タップ → `setMobileToolsSheetOpen(false)` でシートを閉じ、`setShowGridImport(true)` でグリッド取込モーダルを開く（PC と同じ着地点）。
- 見た目: 既存の FF Logs カードと同じスタイル。アイコンは `FileSpreadsheet`。
- 文言: タイトル = 既存 `importMenu.spreadsheet`（「スプレッドシートから取り込み」）、補足 = 新規 i18n キー `mobile.import_spreadsheet_desc`（「表をコピーして貼り付け」）を4言語追加。

## スコープ / 非対象
- スマホ向けのモーダル最適化は**後回し**（ユーザー合意）。今回は機能として使えれば良い＝ボタン追加のみ。
- 変更: [Timeline.tsx](../../../src/components/Timeline.tsx)（lucide import に `FileSpreadsheet` 追加・モバイルインポートシートにボタン1個）、i18n 4言語に補足キー1つ。
- 非対象: PC の ImportMenu、グリッド取込モーダル本体、FFLogs/みんなの軽減表。

## テスト / 検証
- ユニットテストは設けない（既存 UI への描画追加のみで、取込ロジック・モーダルは不変）。
- ビルド（`npm run build`）が通ること。
- 実機（スマホ）: インポートタブ → 「スプレッドシートから取り込み」→ モーダルが開く → スプシ貼り付けで取り込めること。
