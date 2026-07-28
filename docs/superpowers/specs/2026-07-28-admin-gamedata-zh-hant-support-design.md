# 管理画面ゲームデータ翻訳 繁体字対応 設計書 (2026-07-28)

## 背景と目的

`docs/superpowers/specs/2026-07-27-housing-taiwan-region-and-traditional-chinese-design.md` で定義した5フェーズのうち、①②③(ハウジング台湾リージョン統合・軽減表画面文言・ハウジング画面文言)は実装・レビュー・コミット済み(worktree `.claude/worktrees/housing-taiwan-region-support`、未push)。

本ドキュメントは④(管理画面のゲームデータ翻訳対応)の詳細設計。ユーザー方針: LoPo全体の繁体字への完全対応がゴールであり、部分的な対応では不十分(表面上の入力欄だけ増やして裏側でデータが消える状態は不可)。

## 調査で判明した事実

当初のフェーズ④の想定(フェーズ①設計書)は「管理画面(`AdminTranslations`)をzh-Hant列に対応させるだけ」だったが、実装対象コードを調査した結果、それだけでは不十分と判明した。

- ゲームデータの型(`LocalizedString`、`src/types/index.ts`)には既に`'zh-Hant'?: string`が定義済み(フェーズ②で追加済み)。表示側の汎用的な`name[lang]`形式の参照(例: `Sidebar.tsx`のコンテンツ名表示)は既にzh-Hant対応済み
- しかし、技名・コンテンツ名・攻撃名・フェーズ名などを**1言語ずつ個別に組み立て直す**処理が約16ファイルに存在し、いずれも`ja`/`en`/`zh`/`ko`の4つだけを明示的にコピーしており、`zh-Hant`が抜け落ちる(`{ ja: x.ja, en: x.en, ...(x.zh ? {zh:x.zh}:{}), ...(x.ko ? {ko:x.ko}:{}) }`という同一パターンが繰り返されている)。管理画面で繁体字を入力できるようにしても、テンプレート読み込み・プラン保存・スプレッドシート取込等の過程でこの値が消える
- 管理画面側も、一括編集テーブル(`AdminTranslations`)以外に、個別編集用のモーダル(`SkillFormModal`等)が複数あり、いずれも独自にja/en/zh/koの入力欄を持っている
- Firestore保存を行うAPI層(`api/admin/index.ts`)は名前オブジェクトをフィールド単位で検証・再構築しておらず、リクエストボディをそのまま保存する方式のため、フロントエンドがzh-Hantを含めて送信しさえすれば保存側の変更は不要と確認済み

## 確定したスコープ

### 対象ファイル(3グループ)

**グループA: 管理画面 一括翻訳編集**
- `src/components/admin/AdminTranslations.tsx`
- `src/components/admin/TranslationTable.tsx`
- `src/components/admin/TranslationCsvTools.tsx`
- `src/lib/translationDataLoaders.ts`

zh-Hant列を追加(表示・編集・CSVエクスポート/インポート・保存の全経路)。既存のzh/ko列の実装パターンをそのまま複製する。

**グループB: 管理画面 個別編集モーダル**
- `src/components/admin/SkillFormModal.tsx`(スキル個別編集)
- `src/components/admin/AdminContents.tsx`(コンテンツ個別編集)
- `src/components/admin/TemplateEditor.tsx`(テンプレート個別編集)

zh-Hant入力欄を追加。既存のzh/ko入力欄と同じUIパターンを複製する。

**グループC: データ引き継ぎ処理(約16ファイル・同一パターンの機械的修正)**

以下、いずれも「名前オブジェクトを1言語ずつ再構築する際にzh-Hantが抜け落ちる」同一パターンの修正:

- `src/utils/templateConversions.ts`
- `src/utils/phaseMigration.ts`
- `src/utils/labelMigration.ts`
- `src/store/usePlanStore.ts`
- `src/lib/sheetImport/resolveJob.ts`
- `src/lib/sheetImport/resolveSheetSkill.ts`
- `src/hooks/useTemplateEditor.ts`
- `src/data/templateLoader.ts`
- `src/data/contentRegistry.ts`
- `src/components/Sidebar.tsx`(`loadSnapshot`内のフェーズ名再構築箇所)
- `src/components/PartyStatusPopover.tsx`
- `src/components/HeaderMechanicSearch.tsx`
- `src/components/BoundaryEditModal.tsx`
- `src/components/EventForm.tsx`(mechanicGroup名の再構築箇所)
- `src/components/LimitResolutionSheet.tsx`(フェーズ②で言語判定は修正済み・別途フィールド再構築箇所がないか確認)
- `src/components/MobileContextMenu.tsx`(同上)

実装時に上記全ファイルへ`grep`をかけて`.zh`/`.ko`参照箇所を洗い出し、1件も見落とさないことを確認する。

### 対象外

- 実際のゲームデータ(技名・攻撃名等)への繁体字翻訳の流し込み → フェーズ⑤
- 本番公開(Firestoreシード・push・デプロイ) → 全フェーズ完了後

## 詳細設計

### 1. グループA: 一括翻訳編集

- `TranslationRow`型(`translationDataLoaders.ts`)に`zhHant: string`フィールドを追加(オブジェクトキーとしてハイフンを含む`'zh-Hant'`は既存の`ja`/`en`/`zh`/`ko`という単純なキー命名と混在すると扱いにくいため、行の内部表現は`zhHant`とし、`LocalizedString`との変換点(`localizedToFields`/各save関数)でのみ`'zh-Hant'`キーとの対応付けを行う)
- `localizedToFields`・`getChangedRows`・`handleCellChange`・`handleImport`・`hasChanges`・`filteredIndices`(未翻訳フィルタ)・進捗表示(`zhPercent`/`koPercent`と並べて`zhHantPercent`)に`zhHant`を追加
- 6つのsave関数(`saveSkillTranslations`等)全てで、Firestoreへ送信する`LocalizedString`オブジェクトに`'zh-Hant': emptyToUndefined(changedRow.zhHant)`を追加
- `TranslationTable.tsx`: 列ヘッダーに「繁體中文」を追加、フィールドループに`zhHant`を追加(Tab移動順にも反映)
- `TranslationCsvTools.tsx`: CSVヘッダーに`zh-Hant`列を追加、エクスポート/インポート/プレビュー集計の全箇所に反映

### 2. グループB: 個別編集モーダル

各モーダルの既存のzh/ko入力欄と全く同じパターンで、zh-Hant用の`<input>`をもう1つ追加する(ラベルは「繁体字名(任意)」等、既存の「中国語名(任意)」「韓国語名(任意)」に倣う)。

### 3. グループC: データ引き継ぎ処理

各ファイルの該当箇所で、既存の
```ts
...(x.zh ? { zh: x.zh } : {}),
...(x.ko ? { ko: x.ko } : {}),
```
という行の直後に
```ts
...(x['zh-Hant'] ? { 'zh-Hant': x['zh-Hant'] } : {}),
```
を追加する(既存2行と全く同じ形。追加位置はzh/koの並びに合わせzhの直後とする)。ファイルによってはフィルタ条件(例: `phase.name.ja || phase.name.en || phase.name.zh || phase.name.ko`)にも`|| phase.name['zh-Hant']`の追加が必要な箇所がある(該当箇所は実装時にファイルごとに確認)。

## テストと検証

- 完全性テスト: グループAの各カテゴリ(skills/contents/attacks/phases/others)でzh-Hant列の値が正しく読み込み・編集・保存されることを検証する新規テスト、または既存テストへのzh-Hantケース追加
- 回帰テスト最優先: 既存のja/en/zh/ko翻訳データの読み込み・保存・表示が一切変わらないことを既存テストスイート全体で確認する
- グループCは機械的なパターン追加のため、各ファイルの既存テスト(該当するものがあれば)を実行して既存の変換ロジックが壊れていないことを確認する
- フルゲート(`rtk npm run build` + `rtk vitest run`)をタスク末尾で実行

## 実装体制

- 引き続きworktree `.claude/worktrees/housing-taiwan-region-support`(ブランチ`worktree-housing-taiwan-region-support`)で作業する
- 本フェーズの成果もコミットのみ行い、pushはしない

## リスク

- グループCは16ファイルという規模のため、1件でも見落とすと「管理画面では繁体字が入力できるのに、特定の操作(スプレッドシート取込・テンプレート読み込み等)を経由すると繁体字だけ消える」という発見しづらい不具合になりうる。実装時は`grep`による全件洗い出しを徹底し、洗い出しリストと修正済みリストを突き合わせて漏れがないことを確認する
- グループAの`TranslationRow`内部表現を`zhHant`(キャメルケース)にする一方、Firestore上のデータキーは`'zh-Hant'`のままとする変換が必要なため、変換漏れ(内部表現とFirestoreキーの対応ミス)がないよう実装時にテストで担保する
