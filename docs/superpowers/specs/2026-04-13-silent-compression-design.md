# サイレント圧縮 + アーカイブ改善 設計書

## 概要

7日間開かれていない軽減表を、カテゴリを問わずバックグラウンドで自動圧縮する。タブ移動なし、ダイアログなし。ユーザーが開けば即座に解凍して通常通り使える。

あわせて、過去拡張の零式アーカイブを「確認ダイアログ」から「自動移動+通知」に変更し、UIの「プラン」表記を「軽減表」に統一する。

## 背景

- 現在の自動アーカイブは過去拡張の零式のみ、かつユーザーに確認を求める形式
- 絶・その他コンテンツの軽減表は未使用でも圧縮されない
- `ARCHIVE_AFTER_DAYS: 90` 定数は定義済みだが未使用
- 実測: FRU（8人軽減オート全入れ）= 97.3 KB → gzip圧縮で約15-20KB（80-90%削減）

## 機能一覧

### 1. サイレント圧縮（新規）

**対象**: 全カテゴリ（零式・絶・その他・カスタム）
**条件**: 7日間開かれていない軽減表（`archived` でないもの）
**動作**: バックグラウンドで圧縮。タブ移動なし、通知なし
**解凍**: ユーザーがクリックしたら即解凍して通常表示

### 2. 過去零式アーカイブの自動化（変更）

**現在**: 確認ダイアログ →「アーカイブする」/「今はしない」の2択
**変更後**: 自動でアーカイブタブに移動+圧縮 → 通知ダイアログ（OKボタンのみ）

### 3. 右クリック「アーカイブ」追加（新規）

コンテキストメニューに「アーカイブ」を追加し、手動でアーカイブタブへ移動できるようにする。

### 4. UI表記統一（修正）

サイドバーのi18nキーで「プラン」と表記している箇所を「軽減表」に統一（4言語）。

## データ設計

### lastOpenedAt の保存

```
保存先: localStorage
キー: "plan-last-opened"
値: { [planId: string]: number }  // Unix ms
```

- 更新タイミング: サイドバーでユーザーが軽減表をクリックした時のみ
- アプリ起動時の自動表示では更新しない
- Firestoreには同期しない（書き込みコスト回避）

### 既存型への影響

`SavedPlan` の型変更は不要。既存の `compressedData` / `data` フィールドをそのまま利用：
- 圧縮状態: `data = undefined`, `compressedData = "..."`, `archived = false`
- アーカイブ状態: `data = undefined`, `compressedData = "..."`, `archived = true`
- 通常状態: `data = {...}`, `compressedData = undefined`

## 圧縮ロジック

### タイミング

アプリ起動時（既存の `recompressStaleArchives()` と同じ場所、App.tsx）

### 対象判定

以下を全て満たす軽減表:
1. `archived !== true`（アーカイブ済みは対象外）
2. `data` が存在する（既に圧縮済みでない）
3. `lastOpenedAt` が7日以上前、または `lastOpenedAt` が未記録

### 処理フロー

1. localStorage から `plan-last-opened` を読み取り
2. 対象軽減表を特定
3. 各対象の `data` を `compressPlanData()` で圧縮
4. `compressedData` に保存、`data` を `undefined` に
5. `archived` は `false` のまま（タブ移動しない）
6. dirty フラグを立てて Firestore 同期

## 解凍ロジック

### タイミング

サイドバーで軽減表をクリックした時

### 処理フロー

1. `data` が `undefined` かつ `compressedData` が存在 → 解凍が必要
2. `decompressPlanData()` で解凍
3. `data` に復元
4. localStorage の `lastOpenedAt` を現在時刻に更新
5. 通常通りエディタに表示

## 過去零式アーカイブ

### 処理フロー（変更後）

1. アプリ起動時に過去拡張の零式軽減表を検出
2. 確認なしで自動的に `archived = true` + 圧縮
3. 通知ダイアログを表示（OKボタンのみ）

### 通知ダイアログの文言

**日本語:**
- タイトル: 「過去拡張の軽減表をアーカイブしました」
- 本文: 「過去拡張の零式の軽減表（{{count}}件）をアーカイブに移動しました。アーカイブタブからいつでも開けます。初回の読み込みが少し遅くなることがあります。」
- ボタン: 「OK」

**英語:**
- タイトル: "Old Expansion Lists Archived"
- 本文: "{{count}} savage mitigation list(s) from previous expansions have been moved to the Archive tab. You can access them anytime. The first time you open them may take a moment to load."
- ボタン: "OK"

**中国語・韓国語:** 同様の趣旨で翻訳

## 右クリック「アーカイブ」

コンテキストメニュー（零式・絶・その他タブ）に「アーカイブ」項目を追加。
- クリックで即座に `archived = true` + 圧縮 → アーカイブタブへ移動
- 複数選択時は選択中の全軽減表が対象

## UI表記統一（プラン→軽減表）

### 日本語の差し替え対象

| キー | 現在 | 変更後 |
|------|------|--------|
| `archive_empty` | アーカイブにプランはありません | アーカイブに軽減表はありません |
| `archive_plan_count` | {{count}}件のプランが対象です | {{count}}件の軽減表 |
| `duplicate_limit_reached` | プラン数の上限に達しています | 軽減表の上限に達しています |
| `manage_plans` | プラン管理 | 軽減表管理 |

### 他言語

英語: "plan" → "mitigation list" (既存の表現に合わせて調整)
中国語・韓国語: 同様に統一

## 定数

```typescript
// firebase.ts PLAN_LIMITS に追加
SILENT_COMPRESS_AFTER_DAYS: 7    // 新規: サイレント圧縮までの日数

// 既存（変更なし）
ARCHIVE_AFTER_DAYS: 90           // 将来用に残す
```

## テスト方針

### 圧縮・解凍の往復テスト
- PlanData を圧縮→解凍し、元データと完全一致することを検証
- 空データ、大規模データ（FRU相当）の両方でテスト

### サイレント圧縮の判定テスト
- 7日超過: 圧縮対象になること
- 7日以内: 圧縮されないこと
- `lastOpenedAt` 未記録: 圧縮対象になること
- `archived === true`: 対象外になること
- 既に `compressedData` がある（`data` が `undefined`）: 二重圧縮されないこと

### 解凍フローのテスト
- 圧縮済み軽減表をクリック → 解凍されて表示されること
- 解凍後に `lastOpenedAt` が更新されること
- 通常の軽減表（未圧縮）のクリックは今まで通り動作すること

### 過去零式アーカイブのテスト
- 旧拡張の零式が自動でアーカイブされること
- 通知ダイアログが表示されること
- 現拡張の零式は対象外であること

## セキュリティ

- `lastOpenedAt` は planId（ランダム文字列）とタイムスタンプのみ。個人情報を含まない
- console.log/error に planId やユーザー情報を出力しない（本セッションで修正済み）
- localStorage のデータはユーザーのブラウザ内のみ。外部送信なし
