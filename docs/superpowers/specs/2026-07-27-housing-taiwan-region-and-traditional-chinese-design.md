# ハウジング 台湾リージョン対応 + 繁体字対応 全体設計書 (2026-07-27)

## 背景と目的

繁体字(zh-Hant)対応の相談中、「台湾ユーザーはどのサーバーでプレイしているか」というユーザー指摘を受けて調査した結果、2025年12月10日にUserJoy Technology(宇峻奧汀)が台湾・香港・マカオ・シンガポール・マレーシア向けに独立した繁体字版FF14サーバーの運営を開始済みと判明した(グローバル版・中国版・韓国版のいずれとも別の、物理的に完全分離したサーバー)。

ハウジング機能は言語切替がリージョン(DC)フィルタを兼ねる設計([[project_housing_region_isolation]])のため、繁体字対応は「翻訳を1つ追加する」だけでは済まず、2026-07-18に実施した韓国・中国リージョン対応(`docs/superpowers/specs/2026-07-18-housing-kr-cn-region-support-design.md`)と同型の「新リージョン統合」が必要になる。本ドキュメントはその全体スコープと、最初に着手するサブプロジェクト(①台湾リージョン統合)を設計する。

出典: [Nada Holdings公式発表](https://nadaholdings.com/final-fantasy-xiv-traditional-chinese-version-officially-unveiled/) / [Gamania台服懶人包](https://blog.shopping.gamania.com/game/FF14-traditional-chinese-version) / [公式ワールドステータス](https://www.ffxiv.com.tw/web/worldstatus/index.aspx)

## 確定済みの決定 (ユーザー承認済み・2026-07-27)

| 論点 | 決定 |
|---|---|
| 対象範囲 | 軽減表+ハウジング全部。UI文言(JSON)+ゲームデータ(Firestore管理の技名等)両方とも完全網羅で翻訳する(段階分け・一部見送り案は不採用) |
| 言語コード | `zh-Hant`。既存の「言語コードの頭2文字が"zh"なら簡体字として扱う」式の判定(11箇所以上)は、この機会に完全一致判定へ正しく修正する(コードを変えて衝突を回避するだけの弥縫策は不採用) |
| 新リージョンコード | `TW` |
| 翻訳方式(一般UI) | 既存の簡体字(zh.json)をベースに機械的に簡体字→繁体字の字体変換をかけ、明らかに語感が違う固有名詞のみ個別修正 |
| 翻訳方式(ジョブ・スキル名等の公式ゲーム用語) | 公式繁体字ジョブガイド(`https://www.ffxiv.com.tw/web/intro/guide/battle/{job}/`)等の一次ソースを個別調査して訳す([[reference_ff14_jobguide_urls]]) |
| 翻訳方式(ハウジング固有名詞: エリア名・エーテライト名等) | 台湾プレイヤーWikiで確認できればそれを一次ソースにする。見つからなければ機械翻訳で仮置きし、実機確認待ちのフラグを立てる(TW版はキャラ作成不可のため実機確認自体ができない制約は§10参照) |
| 実装順序 | 5フェーズに分割。①台湾リージョン統合(本ドキュメントの詳細設計対象)→②軽減表の画面文言→③ハウジングの画面文言→④ゲームデータ翻訳の管理画面対応→⑤ゲームデータ翻訳の流し込み。各フェーズは別途spec→plan→実装のサイクルを回す |

## 全体ロードマップ(5フェーズ・概要のみ)

1. **ハウジング: 台湾リージョン統合**(本ドキュメントの詳細設計対象。§1〜§10)
2. 軽減表の画面文言(JSON、約2,700キー)を繁体字化
3. ハウジングの画面文言(JSON+housingTerms辞書の残り)を繁体字化
4. ゲームデータ翻訳(スキル/攻撃/フェーズ/コンテンツ名等)の管理画面(`/admin`のAdminTranslations)をzh-Hant列に対応させる
5. ゲームデータ翻訳(数千件規模)を実際に訳して流し込む

②〜⑤は本ドキュメントでは詳細設計しない。①が完了し次第、②以降を個別にbrainstormingし直す。

---

## ①ハウジング 台湾リージョン統合 詳細設計

### 0. 前提: 正典データが未整備(KR/CN対応との違い)

KR/CN対応時は、ユーザーが事前に用意した正典CSV(`docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv`)が既にあった。TW版はまだ正典データが存在しないため、**本フェーズの最初のタスクとして正典データ収集(CSV作成)を行う**。データが揃うまで後続タスク(用語辞書生成スクリプト等)は着手できない。

### 1. マスターデータ設計

- `Region`型(`src/data/housing/dcServerMap.ts`)に`'TW'`を追加: `'JP'|'NA'|'EU'|'OCE'|'KR'|'CN'|'TW'`
- ワールド一覧(2026-07-27時点・公式サイト確認済み): 伊弗利特(Ifrit)・迦樓羅(Garuda)・利維坦(Leviathan)・鳳凰(Phoenix)・奧汀(Odin)・巴哈姆特(Bahamut)・泰坦(Titan)の7ワールド。EA開始時(2025-11-27)は4ワールドだったため今後も増減しうる → **実装着手直前に公式サイトで再確認する**
- DC構成: 確認できたのは「伊弗利特・迦樓羅・利維坦・鳳凰の4つが同一DC」という情報のみ。後から追加された奧汀・巴哈姆特・泰坦が同じDCに属するか、CNのように複数DCに分かれているかは**未確認**。実装着手時に公式サイト等で確認する(中国版は人口増加に伴い4DCに分割された前例があるため、単一DC決め打ちにしない)
- DC内部キー: 未確認(公式サイトでも名称が見当たらなかった)。実装着手時に確認して決定する。内部キーは一度Firestoreに保存されたら変更不可のため、確定後の変更はしない
- `TermLocale`(`src/lib/housing/housingTerms.ts`)・`RegionLocale`(`src/data/housing/regionMap.ts`)に`zh-Hant`を追加

### 2. 用語辞書

- 既存`housingTerms.generated.json`の全既存エントリ(dc/world/area/apartment/aetheryte/district/size/tag)に`zh-Hant`値をバックフィルする(型を5言語に拡張する以上、既存KR/CN分もzh-Hant値が必須になる)
- TWの新規エントリ(DC名・7ワールド名)をja/en/ko/zh/zh-Hantの5言語で追加
- データソースは前掲の「確定済みの決定」表のとおり(ジョブ・スキル名は公式ガイド、ハウジング固有名詞はWiki→機械翻訳フォールバック)
- 正典CSV(`src/data/housing/terms-src/housing-terms.csv`)に追記する形でKR/CN分と同じファイルに統合

### 3. 既存"zh"衝突判定の是正(TWならではの追加作業・ハウジング関連のみ)

調査の結果、`lang.slice(0,2)`/`startsWith('zh')`/`=== 'zh'`等でzh-Hantを誤って簡体字判定してしまう箇所は11箇所以上あるが、**ハウジングと無関係な軽減表・通知まわりのファイル(`src/types/index.ts`・`src/components/MobileContextMenu.tsx`・`src/components/LimitResolutionSheet.tsx`・`src/components/MitigationSheetPreview.tsx`・`src/components/SystemNotificationModal.tsx`・`src/components/SystemNotificationBar.tsx`)は①のスコープ外**とする。理由: ①の時点ではzh-Hantはどこからも選択できない(§今回やらないこと)ため、これらのファイルは実害が発生しない。繁体字が実際に選べるようになるPhase②(軽減表の画面文言)で、あわせて直す。

①で直すのはハウジング自体の動作に関わる箇所のみ:

- `src/data/housing/regionMap.ts`(`pickRegionLocale`)
- `src/store/useHousingFilterStore.ts`(`applyLocaleDefaultRegions`)
- `src/lib/housing/areaName.ts`(`toMasterLang`。`lang.split('-')[0]`方式だが同じ穴)
- `src/data/masterData.ts`(`MASTER_LANGS`定数・`housingAreaMasterData`の型)
- `src/lib/housing/housingTerms.ts`(`TermLocale`型)
- 各i18nParity系テスト(`src/components/housing/browse/tagpicker/__tests__/i18nParity.test.ts` 等、housing配下のみ)

いずれも「完全一致 or 明示的な許可リスト」判定に直し、zh-Hantとzh(簡体字)を正しく区別する。**既存の簡体字ユーザーの挙動は一切変えない**ことを回帰テストで担保する(最大の技術リスクのため§10参照)。

### 4. フィルター・初期表示

- `applyLocaleDefaultRegions`に`zh-Hant → ['TW']`を追加。既存の`zh → ['CN']`は変更しない

### 5. 登録ページ

- DC選択肢にTWを追加。DC/ワールド実在検証(`housingValidation.ts`)にTWの組み合わせを追加

### 6. ツアー地域ガード

- `canAddToTour`がTWを非OCEの独立リージョンとして扱うよう`travelGroupOf`を拡張(KR/CN実装時に導入済みの仕組みにTWを追加するだけで自動適用される見込み)

### 7. 検索

- TWのDC/ワールド名(zh-Hant表記)でも横断検索がヒットするよう辞書接続(KR/CN同様、TW側にカタカナ読みは追加しない)

### 8. UI表示名の辞書接続

- `displayDcName`/`displayWorldName`の`isCnKr`判定をTWも含む形に拡張。TWも辞書表示名にする(KR/CN方式を踏襲、グローバルは内部キーのまま変更なし)

### 9. 行き方翻訳(300区画)への zh-Hant 追加

- 既存の`directions-src/translations/{en,ko,zh}/`と同じ形で`zh-Hant/`を追加
- 固有名詞(エーテライト名・S/M/L等)は用語辞書(§2)の訳を機械的に使用し自由訳しない。地の文は簡体字ベースの機械品質翻訳で可(KR/CN対応時にユーザー確認済みの方針を踏襲)

### 10. テストと検証

- 単体テスト: 地域ガード(TW×JP/TW×KR/TW×CN等の組み合わせ)/ 辞書完全性(全DC・全ワールドに5言語名がある)/ 行き方翻訳完全性(300区画×zh-Hant)/ dc-server実在検証の正常異常系
- **回帰テスト最優先**: §3の判定是正が既存の日本語・英語・韓国語・簡体字ユーザーの挙動を一切変えないことを既存テストスイート全体で確認する
- 実機チェックリスト: TW版はキャラクター作成ができないため、KR/CN同様に実在ハウジングの現地確認は不可能。登録テストデータでのUI検証のみ([[feedback_housing_data_disposable]]によりテストデータ削除は自由)

## 今回やらないこと(①のスコープ外)

- 言語切替UI(`LanguageSwitcher`)への「繁體中文」追加、および`i18n.ts`/`useThemeStore.ts`の`ContentLanguage`型拡張・`src/locales/zh-Hant.json`の作成 — これらはPhase②(軽減表の画面文言)が形になってから着手する。①の時点ではユーザーが実際に繁体字表示へ切り替える手段は用意しない(housingTerms辞書・Region型等のテストは文字列リテラル`'zh-Hant'`を直接渡して検証する)
- 軽減表・ハウジングの画面文言(約2,700キー)の繁体字翻訳(Phase②③)
- 軽減表・通知まわりの"zh"衝突判定是正(`types/index.ts`・`MobileContextMenu.tsx`・`LimitResolutionSheet.tsx`・`MitigationSheetPreview.tsx`・`SystemNotificationModal.tsx`・`SystemNotificationBar.tsx`の6ファイル。§3参照、Phase②で対応)
- ゲームデータ(スキル名等・数千件)の翻訳(Phase④⑤)
- DC正式名称・最終的なワールド数の確定(実装着手直前に再調査する暫定事項)

## 前提(未検証)とリスク

- ワールド数は増加傾向にある(EA開始時4→2026-07-27時点7)。実装着手時に公式サイトで再確認が必要
- DC構成(単一DCか複数DCか)・正式名称ともに未確認。実装着手時に確認する。中国版は人口増加に伴い後から4DCに分割された前例があるため、TWも将来的に複数DC化する可能性を設計上排除しない
- ハウジングエリア名・エーテライト名等のTW正式訳がWikiで見つからない場合、機械翻訳の仮置きになる。TW版はキャラ作成不可のため実機で正誤を確認する手段がなく、精度担保は限定的(将来、台湾プレイヤーからのフィードバックで修正する前提)
- §3の"zh"衝突判定是正は影響範囲が広い(11箇所以上)。1箇所でも見落とすと繁体字ユーザーの初期地域判定や表示が誤動作しうるため、洗い出しの完全性がリスクの中心
