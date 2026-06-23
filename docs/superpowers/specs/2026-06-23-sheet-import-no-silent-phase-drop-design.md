# スプシ取込モーダル: 末尾フェーズの黙殺を防ぐ (Bug②) 設計書

- 日付: 2026-06-23
- 関連: `docs/.private/2026-06-23-spreadsheet-import-issues.md`（Bug②）／ Bug① は別途修正・本番済（commit `994b9111`）
- 対象: `src/components/SpreadsheetImportModal.tsx` ＋ `src/locales/{ja,en,ko,zh}.json`

## 問題

モーダルは「フェーズ名＋貼り付け → 『次のフェーズを追加』(`handleAddPhase`) で `entries` に積む」方式。確定 (`handleConfirm`) は `entries` のみから `buildPlanFromSheets` する。textarea の `draft` が `entries` に入る経路は `handleAddPhase` の1本だけ（`SpreadsheetImportModal.tsx:65`）。

このため、**最後のフェーズを貼ったまま「追加」を押さずに「作成」すると、その末尾フェーズが黙って捨てられる**。これがユーザー報告の「後半が欠ける」「末尾に空フェーズを足さないと取り込めない（＝追加を押させて draft を吐き出す回避策）」「たまに失敗」の正体（多エージェント検証で確定・repro 済）。単一フェーズの取込も、追加を押さないと作成ボタンが活性化しない friction がある。

## 設計（A案: 一覧が正・貼りっぱなしでは作成させない）

「今入力中のフェーズ（貼り付け欄）」と「確定済みフェーズ一覧（`entries`）」を明確に分離し、**一覧に入っているものだけが取り込まれる**ことを保証する。

### 核心ルール
**`draft` に未追加の内容が残っている間は〔取り込んで作成〕を押せない。**

| 状態 | 〔取り込んで作成〕 | 表示 |
|---|---|---|
| `draft.trim()` が非空（未追加あり） | 非活性（灰色） | ⚠「貼り付け欄に未追加の内容があります →『このフェーズを追加』を押してください」 |
| `draft.trim()` が空（全部追加済み） | 既存条件で活性 | 通常 |

→ 末尾フェーズの取りこぼしが**原理的に**起きない。単一フェーズでも「追加→作成」で確実に入る。

### あわせて文言を明確化（i18n・4言語）
- `sheetImport.add_phase`「次のフェーズを追加」→「このフェーズを追加」（“次の”だと最後のフェーズは追加不要に誤認させるため）
- 一覧見出しを「追加済みフェーズ」に（新キー `sheetImport.added_phases_label`）
- 新キー `sheetImport.pending_draft_warning`（上記⚠の文言）

### 実装単位（テスト可能に切り出す）
確定可否の純粋ロジックを小関数に切り出す:

```ts
// src/lib/sheetImport/canConfirmImport.ts
export function canConfirmImport(args: {
  hasPreviewEvents: boolean;   // preview !== null && timelineEvents.length > 0
  partyComplete: boolean;
  hasPendingDraft: boolean;    // draft.trim() !== ''
}): boolean {
  return args.hasPreviewEvents && args.partyComplete && !args.hasPendingDraft;
}
```

モーダルの `canConfirm` はこれを呼ぶだけにする。`pending draft` の警告表示も `hasPendingDraft` で出し分け。

## データフロー（変更なし）
`entries` → `buildPlanFromSheets` → `onImport(result,'new')` → `handleSheetImport` → `commitImportedPlan`（Bug① で修正済）。本タスクはモーダル内の「作成可否」と文言のみで、取込ロジック本体・パーティ割当・プレビューは不変。

## テスト
- `canConfirmImport` の純粋ユニット（TDD・RED→GREEN）:
  - 全条件OKかつ draft 空 → true
  - draft が非空 → false（他がOKでも）
  - preview イベント無 → false / party 未完 → false
- 実機: 貼りっぱなしで作成不可・警告表示／追加すると作成可、を1回確認（[[feedback_endpoint_user_verification]]）。

## スコープ外（別タスク）
- 取込フロー再設計（押下時にコンテンツ選択を前段＝誤紐付け解消）
- 既存表に「続きを追記」する取込モード
- `buildPlanFromSheets` / パーティ割当 / プレビュー本体の変更
