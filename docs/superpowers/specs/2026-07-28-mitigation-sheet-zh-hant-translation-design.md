# 軽減表(LoPo本体)画面文言 繁体字対応 設計書 (2026-07-28)

## 背景と目的

`docs/superpowers/specs/2026-07-27-housing-taiwan-region-and-traditional-chinese-design.md` で定義した5フェーズのうち、①(ハウジング台湾リージョン統合)は実装・レビュー・コミット済み(worktree `.claude/worktrees/housing-taiwan-region-support`、未push)。

ユーザー方針(2026-07-28確定): 「LoPo全体の繁体字対応」が目的であり、①だけを先に公開することはしない。②〜⑤まで全部終わらせてから、まとめて公開する。本ドキュメントは②(軽減表の画面文言)の詳細設計。

## 確定済みの決定 (ユーザー承認済み・2026-07-28)

| 論点 | 決定 |
|---|---|
| 翻訳方式(LoPo一般UI文言) | 既存の簡体字(`src/locales/zh.json`)をベースに機械的に簡体字→繁体字の字体変換をかける。フェーズ①(ハウジング)と同じ方針を踏襲し、人手レビューは行わない |
| 翻訳方式(ジョブ名・ロール名・スキル効果ラベル等の実ゲーム用語) | 機械変換対象から除外し、公式繁体字ジョブガイド(`https://www.ffxiv.com.tw/web/intro/guide/battle/{job}/`、[[reference_ff14_jobguide_urls]])等の一次ソースで個別に訳す |
| ゲーム用語の見落とし対策 | 2,700件全体に対して「ゲーム固有名詞を含んでいそうな項目」を機械的に洗い出す一度きりの総点検を行う(1件ずつのAIレビューはコスト過大のため不採用) |
| 公開タイミング | 本フェーズ完了後も公開しない。③④⑤まで完了後にまとめて公開 |

## スコープ

### 対象

- `src/locales/zh.json`(2,700キー・53トップレベル名前空間)をベースにした`src/locales/zh-Hant.json`の新規作成
- `src/store/useThemeStore.ts`の`ContentLanguage`型に`'zh-Hant'`を追加
- `src/i18n.ts`の`SUPPORTED_LANGS`・`resources`に`zh-Hant`を追加
- `src/components/LanguageSwitcher.tsx`の`LANGUAGES`配列に「繁體中文」を追加
- 簡体字/繁体字の判定を誤る既存コード6箇所の是正(下記「詳細設計 §3」)

### 対象外 (このフェーズではやらない)

- `housing.*`名前空間(34件)およびhousingTerms辞書の繁体字精査 → フェーズ③でハウジング側とまとめて対応(機械変換自体は本フェーズの一括変換に含めてよいが、品質担保はフェーズ③の責務とする)
- ゲームデータ(技名・攻撃名等、Firestore管理・数千件規模)の翻訳 → フェーズ④⑤
- `/admin`管理画面のzh-Hant列対応 → フェーズ④
- 本番公開(Firestoreシード・push・デプロイ) → 全フェーズ完了後

## 詳細設計

### 1. 機械変換パイプライン

- フェーズ①で作成した`scripts/convert-zh-to-hant.mjs`(CSVの1列を変換するツール)とは別に、ネストしたJSON全体を変換する新スクリプト `scripts/convert-locale-json-to-hant.mjs` を作成する
- 中身: `src/locales/zh.json`を読み込み、全ての文字列値に対して`opencc-js`(`from:'cn', to:'twp'`、フェーズ①と同じコンバータ設定)を再帰的に適用し、キー構造を保ったまま`src/locales/zh-Hant.json`として書き出す
- `{{変数名}}`のようなi18next補間プレースホルダー(例: `aa_settings.floating_label = "AA: {{damage}} ({{target}}/{{type}})"`)はopencc-jsが中国語のみ変換し英数字・記号はそのまま通すため、追加のガードは不要(フェーズ①のCSV変換でも同様の想定で問題なかった)

### 2. ゲーム用語の総点検

- `src/locales/zh.json`の全2,700件について、値の文字列に下記いずれかを含む項目を機械的にリストアップする:
  - 既存の`src/data/dpsOrder.ts`(`TANK_ORDER`等のジョブ略称配列)に定義済みのジョブ略称と対応するキー(`jobs.pld`等)
  - 手動で洗い出し済みの既知パターン(ジョブ名22件・ロール3件・`mechanic_modal.deployment_variants.*`のスキル効果ラベル)
  - 「秘策」「展開」「回生」等、既存の技名データに含まれる単語との部分一致(実装時に技名データ一覧と突き合わせる)
- リストアップされた項目は機械変換の結果を使わず、公式ジョブガイド等で個別に訳し直してから`zh-Hant.json`に反映する
- この点検はテキストの棚卸しであり、コード変更は発生しない(実装計画側で1タスクとして独立させる)

### 3. 既存の"zh"判定誤り是正(ハウジング以外の6ファイル)

フェーズ①の調査で判明済み、ハウジング以外で影響する6箇所:

| ファイル | 現状の判定 | 問題 |
|---|---|---|
| `src/types/index.ts:13` | `lang === 'zh'` | 完全一致なので実害なし(念のためzh-Hant分岐を明示追加) |
| `src/components/MobileContextMenu.tsx:24` | `lang === 'zh'` | 同上 |
| `src/components/LimitResolutionSheet.tsx:148-149` | `langSrc.startsWith('zh')` | zh-Hantを簡体字と誤判定する |
| `src/components/MitigationSheetPreview.tsx:27` | `i18n.language.startsWith('zh')` | 同上 |
| `src/components/SystemNotificationModal.tsx:17,22` | `lang.startsWith('zh')` | 同上 |
| `src/components/SystemNotificationBar.tsx:13,17` | `lang.startsWith('zh')` | 同上 |

`startsWith('zh')`系は「`zh-hant`かどうかを先に判定してから、残りを`zh`(簡体字)として扱う」という完全一致ベースの判定に統一する(フェーズ①の`pickRegionLocale`と同じ考え方)。

### 4. ContentLanguage型・i18n・LanguageSwitcherの拡張

- `useThemeStore.ts`: `ContentLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'zh-Hant'`
- `i18n.ts`: `SUPPORTED_LANGS`に`'zh-Hant'`追加、`resources`に`zh-Hant: { translation: zhHant }`追加
- `LanguageSwitcher.tsx`: `LANGUAGES`配列に`{ code: 'zh-Hant', label: '繁體中文' }`追加(表示順は簡体字の直後を想定)
- 型を拡張した結果、TypeScriptのビルドで他に見落としている分岐(exhaustiveness check等)が検出される可能性がある → 実装時に`rtk npm run build`で確認し、出てきた分だけ追加対応する

## テストと検証

- 完全性テスト: `zh.json`の全キーが`zh-Hant.json`にも存在し非空であることを確認するテスト(既存の`src/locales/__tests__/*-i18n-parity.test.ts`と同様のパターンを新規追加)
- 回帰テスト: 既存の日本語・英語・韓国語・簡体字ユーザーの言語判定・表示が一切変わらないことを既存テストスイートで確認(フェーズ①のTask3と同じ考え方)
- 総点検で洗い出したゲーム用語項目については、洗い出しリストと反映後の値を実装レポートに記録し、最終レビューで確認できるようにする
- フルゲート(`rtk npm run build` + `rtk vitest run`)をタスク末尾で実行

## 実装体制

- `opencc-js`依存および変換の考え方はフェーズ①のブランチ(`worktree-housing-taiwan-region-support`、最新コミット`1d135e31`)で導入済み。本フェーズはこのブランチを起点にworktreeを作成して作業する(mainから新規に切ると`opencc-js`が入っておらず二重管理になる)
- 最終的にフェーズ①〜⑤を1本にまとめてpushする想定のため、ブランチ名は`worktree-housing-taiwan-region-support`を継続利用するか、途中でリネームするかは実装着手時に決める

## 公開・運用

- 本フェーズの成果はフェーズ①と同様、専用のgit worktree/ブランチで作業し、コミットはするがpushはしない
- `LanguageSwitcher`に「繁體中文」を追加すると選択自体は可能になるが、③(ハウジング文言)が未完了の間はhousing.*が日本語フォールバックになる。**本番公開前提ではないため、この状態のまま次フェーズに進んでよい**(pushしなければ実ユーザーへの影響はゼロ)

## リスク

- ゲーム用語の総点検は機械的なパターンマッチのため、パターンに一致しない言い回しの見落としは残り得る(ゼロにはできない)。フェーズ①でも同種のリスクを許容した実績があるため、同水準のリスクとして許容する
- 型拡張(`ContentLanguage`)により、想定していない箇所でTypeScriptエラーが出る可能性がある(ビルドで機械的に検出可能なため実害は小さい)
