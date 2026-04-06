# フェーズ・ラベル編集UI + フェーズ名多言語化 設計書

## 概要

テンプレートエディタにフェーズ名・ラベル名のインライン編集UIを追加し、
フェーズ名のハードコーディング（contents.json）を解消して多言語対応する。

## 目的

1. 管理画面からフェーズ名・ラベル名を直接編集できるようにする
2. フェーズ名を英語単一文字列から4言語（ja/en/zh/ko）対応に変更する
3. contents.json のハードコーディングを解消する

## 現状の問題

- フェーズ名が `contents.json` に英語でハードコーディングされている
- テンプレートエディタのフェーズ列・ラベル列が読み取り専用で編集できない
- フェーズ名に日本語・中国語・韓国語がない

## 変更方針

### 安全性の確保

- フェーズ名の型を `string | LocalizedString` のユニオン型にして後方互換性を維持
- 既存の `normalizeLocalizedString()` で旧形式データを自動変換
- 表示側の `getPhaseName()` は既に `string | LocalizedString` 対応済みのため、表示崩れなし
- ラベル（mechanicGroup）は既にLocalizedString型で実装済み。UI追加のみ

### パフォーマンスへの影響

- データ構造の変更はオブジェクトのプロパティが増えるだけ（無視できるレベル）
- 新しいレンダリングはフェーズ列・ラベル列のクリック時のみ（通常表示に影響なし）
- 既存のEditableCell/DropdownCellパターンを再利用するため追加バンドルサイズも最小

---

## 変更箇所一覧

### レイヤー1: データ定義（上流）

| ファイル | 変更内容 | リスク |
|---------|---------|-------|
| `src/data/contents.json` | phaseNames を `string` → `{ja, en}` に変更（10箇所） | 低: スクリプトも同時修正 |
| `src/data/templateLoader.ts` | `name?: string` → `name?: string \| LocalizedString` | 低: ユニオン型で既存データも受け付ける |

### レイヤー2: スクリプト（テンプレート生成）

| ファイル | 変更内容 | リスク |
|---------|---------|-------|
| `scripts/generate-templates.mjs` | phaseNames を LocalizedString として読み取り | 低: 生成スクリプトは手動実行 |
| `scripts/import-spreadsheet.mjs` | 同上 | 低: 同上 |

### レイヤー3: データ変換・ストア

| ファイル | 変更内容 | リスク |
|---------|---------|-------|
| `src/utils/templateConversions.ts` | CSV→Template変換でphase.nameをLocalizedString化 | 低: 新規生成のみ影響 |
| `src/store/usePlanStore.ts` | Template→Plan変換でLocalizedString構築 | 低: getPhaseName()経由で安全 |
| `src/lib/translationDataLoaders.ts` | 型キャスト回避コード削除 | 低: 型が正しくなるため |

### レイヤー4: 管理画面UI（新規追加）

| ファイル | 変更内容 | リスク |
|---------|---------|-------|
| `src/hooks/useTemplateEditor.ts` | updateLabelEn → updateLabel（4言語対応）、updatePhaseForGroupも4言語対応 | 低: 既存ロジック拡張 |
| `src/components/admin/TemplateEditor.tsx` | フェーズ列・ラベル列にインライン編集UI追加 | 低: 新規UI追加のみ |

### 変更不要（既に対応済み）

- `src/types/index.ts` — getPhaseName() は string | LocalizedString 対応済み
- `src/components/Timeline.tsx` — getPhaseName() 経由で自動対応
- `src/components/HeaderPhaseDropdown.tsx` — 同上
- `src/components/HeaderMechanicSearch.tsx` — 同上
- `src/components/HeaderGimmickDropdown.tsx` — mechanicGroup は既にLocalizedString
- `src/store/useMitigationStore.ts` — normalizeLocalizedString() で旧形式も自動変換

---

## UI設計

### フェーズ列のインライン編集

- グループ先頭行のフェーズ名をクリックすると編集ポップオーバーが表示
- ポップオーバー内容:
  - フェーズ番号（自動、変更不可）
  - フェーズ名 JA（テキスト入力）
  - フェーズ名 EN（テキスト入力）
  - フェーズ名 ZH（テキスト入力、空欄時はENにフォールバック）
  - フェーズ名 KO（テキスト入力、空欄時はENにフォールバック）
- 確定ボタンで保存、Escでキャンセル

### ラベル列のインライン編集

- グループ先頭行のラベル名をクリックすると編集ポップオーバーが表示
- ポップオーバー内容:
  - ラベル名 JA（テキスト入力）
  - ラベル名 EN（テキスト入力）
  - ラベル名 ZH（テキスト入力、空欄時はENにフォールバック）
  - ラベル名 KO（テキスト入力、空欄時はENにフォールバック）
- 確定すると同じグループの全イベントに反映

### フォールバック順序

- 表示言語がzh/ko → 該当言語が空なら en → en も空なら `P${id}`（フェーズ）/ 空表示（ラベル）
- 表示言語がja → ja が空なら en → en も空なら `P${id}` / 空表示
- 表示言語がen → en が空なら `P${id}` / 空表示

---

## テンプレートJSON の互換性

既存テンプレートJSON（`"name": "Living Liquid"` 等）はそのまま動作する。
理由: 型が `string | LocalizedString` のユニオンで、読み込み時に `normalizeLocalizedString()` で正規化するため。
テンプレートを管理画面で保存し直すと自動的にLocalizedString形式に更新される。

## Firestoreデータの互換性

Firestoreに保存済みの旧データ（phase.name が string）も `normalizeLocalizedString()` で自動変換される。
既存の仕組みがそのまま使えるため、マイグレーション作業は不要。
