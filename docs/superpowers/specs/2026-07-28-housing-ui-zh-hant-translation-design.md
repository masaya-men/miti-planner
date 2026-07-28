# ハウジング画面文言 繁体字対応 設計書 (2026-07-28)

## 背景と目的

`docs/superpowers/specs/2026-07-27-housing-taiwan-region-and-traditional-chinese-design.md` で定義した5フェーズのうち、①(ハウジング台湾リージョン統合)・②(軽減表の画面文言)は実装・レビュー・コミット済み(worktree `.claude/worktrees/housing-taiwan-region-support`、未push)。

本ドキュメントは③(ハウジングの画面文言)の詳細設計。ユーザー方針(2026-07-24〜28継続確認): 「LoPo全体の繁体字対応」が目的であり、①②だけを先に公開することはしない。③④⑤まで全部終わらせてから、まとめて公開する。

## 確定済みの決定 (ユーザー承認済み・2026-07-28)

| 論点 | 決定 |
|---|---|
| 品質担保の方針 | 「もれなく」を最優先。764件の機械変換済み文言は全件を実際にレビューし、不自然な箇所は個別修正する(パターンマッチによる抽出だけに頼らない) |
| ログイン/アカウントモーダルの23件 | 現役機能(HousingLoginModal/HousingAccountModal、実際に使われている)と判明。単に繁体字だけ埋めるのではなく、**英語・韓国語・簡体字・繁体字の4言語すべてを新規に翻訳して埋める**(既存のen/ko/zhも空文字列でjaにフォールバックしていた既存の抜け漏れをこの機会に解消) |
| 既存機能への影響 | 既存の日本語・英語・韓国語・簡体字ユーザーの表示・動作を一切変えないことを最優先(回帰テストで担保) |

## スコープ

### 対象

1. **言語切り替えボタンのバグ修正**(最終レビューで発見・持ち越し分)
   - `StatusBar.tsx`(PC版フッター)と`HousingSettingsSheet.tsx`(スマホ版設定シート)の言語切り替えボタン
   - 現状2つの問題がある: (a) 判定ロジックが`zh-Hant`を`zh`(簡体字)の一部として誤検知する (b) **繁体字ボタン自体がそもそも存在しない**(`LANGS`配列に`zh-Hant`が入っていない)。他の言語スイッチャー(`LanguageSwitcher.tsx`・`MobileFAB.tsx`)は既にzh-Hant対応済みで、この2箇所だけ取り残されていた
   - 修正方針: `LANGS`配列に`zh-Hant`を`zh`の直後に追加(既存3言語の並び順は変えない)。判定ロジックはフェーズ①の`pickRegionLocale`(`regionMap.ts`)と同じ考え方(`zh-Hant`を完全一致/ハイフン付き前方一致で先に判定してから`zh`を判定)に揃える

2. **housing.*文言764件の繁体字レビュー**(フェーズ②の一括機械変換の中身チェック)
   - 対象: `src/locales/zh-Hant.json`の`housing`名前空間配下、全764個の文字列
   - 進め方: 全件をzh(簡体字)と突き合わせて読み、不自然な言い回し・大陸/台湾で語彙が異なる箇所(例: サーバー関連の言い回し等)を個別修正する。パターン抽出による絞り込みは行わず全件目視
   - ハウジング固有名詞(ワールド名・DC名等)は既に用語辞書(`housingTerms.generated.json`)側で完結しており、UI文言側に直接ハードコードされていないため本作業の対象外

3. **ログイン/アカウントモーダル23件の多言語新規翻訳**
   - 対象キー: `housing.login_prompt.register.lead`(1件) / `housing.login.*`(7件) / `housing.account.*`(13件) / `housing.topbar.login` / `housing.topbar.account`(計23件)
   - 現状: 日本語のみ存在、英語・韓国語・簡体字・繁体字は全て空文字列(i18nextの`returnEmptyString: false`設定により実際にはUI上は日本語にフォールバックしている)
   - 対応: 日本語原文をソースに、英語・韓国語・簡体字・繁体字の4言語へ新規翻訳して`en.json`/`ko.json`/`zh.json`/`zh-Hant.json`に反映
   - 用語統一: 「Discord ID」「ハッシュ値」等の既存の説明済み用語は、同ファイル内の近隣キー(プライバシーポリシー等の既存訳)と表現を揃える

### 対象外

- ハウジングの専門用語辞書(`housingTerms.generated.json`、266エントリ)は フェーズ①で全件zh-Hant対応済みのため対象外
- ゲームデータ(スキル名等、Firestore管理・数千件規模)の翻訳 → フェーズ④⑤
- `/admin`管理画面のzh-Hant列対応 → フェーズ④
- 本番公開(Firestoreシード・push・デプロイ) → 全フェーズ完了後

## 詳細設計

### 1. 言語切り替えボタンの修正

`StatusBar.tsx`・`HousingSettingsSheet.tsx`共通:

```
const LANGS = ['ja', 'en', 'ko', 'zh', 'zh-Hant'] as const;

// isActive判定: zh-Hant を zh より先に判定する (regionMap.ts の pickRegionLocale と同じ考え方)
const currentLang = (() => {
  const l = i18n.language.toLowerCase();
  if (l === 'zh-hant' || l.startsWith('zh-hant-')) return 'zh-Hant';
  const head = l.slice(0, 2);
  if (head === 'en' || head === 'ko' || head === 'zh') return head;
  return 'ja';
})();
// ボタンごとに isActive = (currentLang === lang)
```

既存の`i18n.language === lang || i18n.language.startsWith(\`${lang}-\`)`という行ごとの判定から、上記の一箇所で正規化した値を比較する方式に変える(重複ロジックの解消と誤検知防止を両立)。

### 2. 764件のレビュー

- 手順: `zh-Hant.json`の`housing`名前空間を`zh.json`と1件ずつ突き合わせ、不自然または誤りがある値を修正する
- 修正観点:
  - 文字体系の変換漏れ(簡体字が残っている)
  - 大陸中国語特有の言い回し(台湾では通常使われない語彙・言い回し)
  - `{{変数名}}`のようなi18next補間プレースホルダーが壊れていないか
- 修正はレビュー作業そのものであり、大きなコード変更は発生しない(JSON値の書き換えのみ)

### 3. 23件の新規翻訳

- 日本語原文(`ja.json`)を出典に、英語・韓国語・簡体字・繁体字へ翻訳
- 翻訳後、`src/locales/__tests__/zh-hant-completeness.test.ts`の`KNOWN_EMPTY_PATHS`配列から該当23件を削除(空文字列ではなくなるため)
- en/ko/zhについても同様に非空になったことを確認する新規テストケースを追加(現状en/koの完全性を保証するテストが存在しないため、この機会に`housing.login`/`housing.account`スコープの軽量な非空チェックを追加する)

### 4. テストの更新

- `StatusBar.test.tsx`: `zh-Hant`ボタンの存在確認・クリックでの言語切替確認・`zh`と`zh-Hant`が同時にアクティブ表示されないことの確認を追加
- `HousingSettingsSheet.tsx`用の同等テスト(現状専用テストファイルが無ければ新規作成を検討。既存のモバイル設定シート関連テストの有無は実装時に確認)
- `zh-hant-completeness.test.ts`: `KNOWN_EMPTY_PATHS`から23件を削除
- 既存の`i18nParity`テスト(favorites/register/tour)は影響なし(zh-Hant追加は既存のja/en/ko/zh比較ロジックに影響しない見込み。実装時に念のため実行して確認)

## テストと検証

- 回帰テスト最優先: 既存の日本語・英語・韓国語・簡体字ユーザーの言語判定・表示・切替動作が一切変わらないことを既存テストスイート全体で確認
- フルゲート(`rtk npm run build` + `rtk vitest run`)をタスク末尾で実行
- 764件レビューの成果(修正した項目の一覧)を実装レポートに記録し、最終レビューで確認できるようにする

## 実装体制

- 引き続きworktree `.claude/worktrees/housing-taiwan-region-support`(ブランチ`worktree-housing-taiwan-region-support`)で作業する
- 本フェーズの成果もコミットのみ行い、pushはしない

## リスク

- 764件の全件目視レビューはボリュームがあるため、実装時はsubagentに全件レビューを委譲し、修正差分を最終レビューで確認する運用とする
- en/ko/zh/zh-Hantの新規23件翻訳は、既存訳文のトーンと完全に一致しない可能性がある(機械翻訳ベースのため、既存の近隣キーとの表現統一を意識するが完全な人手レビュー水準は保証しない)
