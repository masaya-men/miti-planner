# テンプレート保護 + エディタ一括編集 設計書

## 概要

2つの独立した機能を実装する。

1. **テンプレート保護**: 管理画面から保存したテンプレートをFFLogs自動登録で上書きされないようにする
2. **テンプレートエディタ一括編集**: チェックボックス選択 + フィルタ + 一括変更ポップアップ

---

## 機能1: テンプレート保護

### 仕組み

管理画面からテンプレート保存時に `lockedAt: serverTimestamp()` を自動付与する。
FFLogs自動登録ハンドラ（`_autoRegisterHandler.ts`）は既に `lockedAt` の存在チェックでスキップする実装があるため、保存側の1箇所変更のみで完了。

### 変更箇所

- `api/admin/_templatesHandler.ts` — POST/PUT時に `lockedAt: FieldValue.serverTimestamp()` を保存データに追加

### 動作

| 操作 | 結果 |
|---|---|
| 管理画面で保存 | `lockedAt` が設定される |
| FFLogs自動登録が来る | `lockedAt` があるのでスキップ |
| 管理者が再編集・保存 | `lockedAt` が更新される（引き続き保護） |

---

## 機能2: テンプレートエディタ一括編集

### ユースケース

- AA全件のtargetを一括でMT→STに変更
- 同名攻撃の技名を一括変更（例：「散開」→「散開 OR 頭割り」）
- AA全件のdamageAmountを一括変更

### UI構成

#### チェックボックス列（テーブル左端）

- 各行にチェックボックスを追加
- ヘッダーに全選択/全解除チェックボックス
- 選択状態は `Set<string>` (イベントIDのセット) でTemplateEditor内のローカルstateとして管理

#### フィルタ（ツールバー）

既存の「未翻訳のみ」フィルタに加えて「AAのみ」フィルタボタンを追加。

- AAの判定条件: `event.name.ja === 'AA' && event.name.en === 'AA'`
- フィルタはAND条件で組み合わせ可能

#### 一括変更ボタン + ポップアップ

選択行が1件以上ある時、ツールバーに「N件選択中 [一括変更]」を表示。

ポップアップの入力フィールド:
- **技名 (ja)** — テキスト入力（空欄 = 変更しない）
- **技名 (en)** — テキスト入力（空欄 = 変更しない）
- **target** — ドロップダウン: (変更しない) / MT / ST / AoE
- **damageAmount** — 数値入力（空欄 = 変更しない）
- **damageType** — ドロップダウン: (変更しない) / physical / magical / unavoidable

「適用」ボタンで選択行のみを更新。既存のUndo/Redo機能で元に戻せる。

### ツールバーレイアウト

```
[未翻訳のみ] [AAのみ]  ──  「3件選択中」 [一括変更] ── [Undo] [Redo] ...
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/components/admin/TemplateEditor.tsx` | チェックボックス列追加、選択state管理 |
| `src/components/admin/TemplateEditorToolbar.tsx` | AAフィルタ、選択数表示、一括変更ボタン |
| `src/components/admin/BulkEditPopover.tsx` | **新規** 一括変更ポップアップコンポーネント |
| `src/hooks/useTemplateEditor.ts` | `bulkUpdate(ids, fields)` メソッド追加 |
| `api/admin/_templatesHandler.ts` | `lockedAt` 自動付与 |

### useTemplateEditorへの追加

```typescript
bulkUpdate(eventIds: Set<string>, changes: Partial<Pick<TimelineEvent, 'target' | 'damageAmount' | 'damageType'>> & { nameJa?: string; nameEn?: string }): void
```

- 指定されたイベントIDの行に対して、指定フィールドのみ一括更新
- Undo履歴に1回の操作として記録（1回のUndoで全件戻る）
