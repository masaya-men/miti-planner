# テンプレ「スプシ表記」の同じ技 自動伝播 — 設計書

作成: 2026-06-26 / 状態: 設計確定（ユーザー承認済み）

## 背景・目的
管理画面のテンプレ編集（[TemplateEditor](../../../src/components/admin/TemplateEditor.tsx)）で、各攻撃イベントに「スプシ表記」（`sheetAliases` = スプレッドシートでその技がどう書かれるかの別名集合）を登録できる。
ボスの同じ攻撃は戦闘中に複数回出る＝同じ技名（`name.ja`）の行が複数ある。現状は1行ずつ手入力で、同じ技でも全行に同じ表記を打ち直す必要があり手間。

目的: **「スプシ表記」を1か所入力したら、同じ技名の他の行にも自動で同じ表記が入る**ようにする。

## 現状の事実（実コードで確認済み）
- テンプレは1行＝1 TimelineEvent のフラット表。「スプシ表記」セルは `sheetAliases` を編集（[TemplateEditor.tsx:699-705](../../../src/components/admin/TemplateEditor.tsx#L699-L705)）。
- `updateCell(eventId, field, value)` が1イベントを更新（[useTemplateEditor.ts:125-239](../../../src/hooks/useTemplateEditor.ts#L125-L239)）。
- **既存の前例**: 技名翻訳（name.en/zh/ko）は `autoPropagate`（既定 true・ツールバーにトグル）ONのとき、**同じ name.ja の他行へ自動伝播**する（[useTemplateEditor.ts:197-228](../../../src/hooks/useTemplateEditor.ts#L197-L228)）。伝播条件は「対象行が空 or 編集前と同じ値」。伝播した行は `autoFilled` に積まれ、ハイライトで見分けられる。
- ただし sheetAliases セルは現状 `highlight="none"` 固定で、自動入力ハイライトが出ない（[TemplateEditor.tsx:703](../../../src/components/admin/TemplateEditor.tsx#L703)）。

## 設計
技名翻訳と同じ `autoPropagate` 機構に sheetAliases を**追加**する。

### 伝播ルール（`updateCell` の `field === 'sheetAliases'` 時）
`autoPropagate === true` かつ 編集後の値が**非空**かつ 編集行の `name.ja` が**非空**のとき:
- 同じ `name.ja`（完全一致）を持つ他のイベントのうち、`sheetAliases` が **空 または 編集前の値と同じ** だった行に、編集後の値を入れる。
- 伝播した各行を `autoFilled` に `${id}:sheetAliases` で積む（翻訳と同じ）。
- 「編集前の値」= 編集行の更新前 `sheetAliases`（`oldJa` と同様に switch 前にキャプチャ）。配列比較は正規化（join）で行う。

### 安全側の判断（クリア時）
- 編集後の値が**空**（セルを空にした）ときは**その行だけ**クリアし、**同名行へは伝播しない**（一括クリア事故を防ぐ）。翻訳は空も伝播するが、sheetAliases はあえて単独クリアにする（ユーザー承認済み）。

### ハイライト配線
- sheetAliases セルの `highlight="none"` を `getCellHighlight(evId, 'sheetAliases', editState)` に変更し、自動入力された行が翻訳と同様に色で分かるようにする。

### スイッチ
- 既存の `autoPropagate` トグルでこの挙動もまとめて ON/OFF される（翻訳と同じスイッチを共用）。

## 影響範囲 / 非対象
- 変更: `src/hooks/useTemplateEditor.ts`（`updateCell` に sheetAliases 伝播を追加・switch 前で旧値キャプチャ）、`src/components/admin/TemplateEditor.tsx`（sheetAliases セルのハイライト配線）。
- テスト: `src/hooks/__tests__/useTemplateEditor.test.ts` に伝播ケースを追加。
- **非対象**: 「同じ技」の判定は name.ja のみ（対象/種別は見ない）。スプシ取り込み本体（突き合わせ・carryOverTargets）は変更しない。undo は既存の1ステップ機構をそのまま使う（伝播も1回の setState なので1回で戻る）。

## テスト方針（TDD・hook テスト）
1. 同名で空の他行に伝播する（1入力→同名2行に同じ値）。
2. 別の技名（name.ja 不一致）の行には伝播しない。
3. 既に別表記をカスタム入力済みの同名行は**上書きしない**（空でも旧値一致でもない＝保持）。
4. 旧値と同じだった同名行は新値に更新される（同期）。
5. クリア（空入力）は編集行のみ・同名行はそのまま。
6. `name.ja` が空の行で入力しても、同じく空名の他行へは伝播しない。
7. `autoPropagate === false` のときは伝播しない（編集行のみ）。
8. 伝播は1回の更新（undo で一括して戻る）。

ビュー（ハイライト表示）は実機/簡易確認。
