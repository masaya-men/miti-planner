# ハウジング 中国・韓国リージョン対応 設計書 (2026-07-18)

## 背景と目的

中韓の FF14 プレイヤーにもハウジングツアーを使ってもらう。中韓はグローバルと物理的に分離されたサーバー群(キャラ作成も不可)のため、**データが混ざらないこと**が絶対条件。ユーザーが翻訳+DC/ワールドデータのスプレッドシートを作成済み(検収・修正済みの正典 = `docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv`・271行)。

## 確定済みの決定 (ユーザー承認済み)

| 論点 | 決定 |
|---|---|
| 実装方式 | **案1: 静的データ拡張**(Firestore スキーマ変更なし・CSV が正典・変換スクリプトで生成) |
| 言語とリージョン | **B: 独立**。言語は地域フィルターの初期値を決めるだけ(日本リージョンでプレイする中韓プレイヤーが多いため) |
| リージョン切替 UI | **新設しない**。既存フィルターパネルの「地域」に韓国・中国を追加するだけ |
| 初期表示 | ko→地域=韓国 / zh→地域=中国 / ja・en→全グローバル4地域(現状の見え方を維持) |
| 中国4DC間の移動 | **DCトラベル可能とみなす(未検証の前提)**。誤りでも「案内文が出る」だけで、地域の区切り変更のみで修正可能 |
| 行き方翻訳 | **今回やる**(方針変更)。ユーザー自作の文のため機械品質で十分と確認済み |
| データ不備修正 | 4件修正済(트윈타니아/ハイペリオン/东×2)。スプシ側は後日ユーザーが同期 |

## 1. マスターデータ設計

### dcServerMap 拡張 ([src/data/housing/dcServerMap.ts](../../../src/data/housing/dcServerMap.ts))

- `Region` 型: `'JP' | 'NA' | 'EU' | 'OCE'` に **`'KR' | 'CN'`** を追加。
- **韓国**: DC 内部キー `Korea`(region: KR)。ワールド5: `Carbuncle / Chocobo / Moogle / Tonberry / Fenrir`。グローバルに同名ワールドが実在するが、**listing は常に dc+server の組で保存**されるため衝突しない(dc が違う)。
- **中国**: DC 内部キー `ChocoboCN / MoogleCN / FatCatCN / MameshibaCN`(region: CN)。ワールド内部キーはスプシ en 列の CamelCase(例 `RubySea`, `Yanxia`, `Haimaochaya`)。8+8+7+5=28 ワールド。
- **グローバル最新化を同時実施**: `Shadow` DC(EU・Innocence/Pixie/Titania/Tycoon)追加、`Dynamis` を 8 ワールド化(+Cuchulainn/Golem/Kraken/Rafflesia)。
- 内部キーは**一度 Firestore に保存されたら変更不可**(listing の dc/server 値になるため)。

### 用語辞書 (新規生成物)

- 変換スクリプト(新規 `scripts/parse-housing-terms.mjs`)が正典 CSV → `src/data/housing/housingTerms.generated.json` を生成。
- 内容: DC名 / ワールド名 / エリア名 / アパルトメント名 / エーテライト名 / サイズ / タグ の ja・en・ko・zh 対訳。キーは内部キー(DC/ワールド)または ja 名(エーテライト等、既存データの主キーが ja のもの)。
- `REGION_LABELS` に KR(한국/韩国…)・CN を追加。
- 表示は全箇所「内部キー→現在言語の表示名」のヘルパー経由。**エーテライト名の ja は地図データの検索キーを兼ねるため内部キーとして維持**し、表示層でのみ辞書変換する。

## 2. フィルター・初期表示

- [FilterPanel.tsx:125](../../../src/components/housing/workspace/FilterPanel.tsx#L125) の地域選択肢が `ALL_REGIONS` 由来のため、型拡張で自動的に韓国・中国が並ぶ。ラベルは `REGION_LABELS`。
- **言語→初期値**: ストア初期化時に `regions` を ja/en=`['JP','NA','EU','OCE']` / ko=`['KR']` / zh=`['CN']` にセット(現状の `[]`=無フィルタだと中韓混在表示になるため、明示選択に変更)。ユーザーはいつでも変更可・クリアで全表示(混在は明示操作の結果のみ)。
- スマホのフィルターシートも同一ストアのため自動追従(実機確認項目)。
- DC 絞り込み(`regions.includes(DC_SERVER_MAP[d].region)`)は型拡張だけで自動対応。

## 3. 登録ページ

- DC 選択肢に韓国・中国 DC を追加し、地域ラベルでグルーピング表示(現行 UI の並びを踏襲)。
- **サーバー側検証の強化**: 現在 dc は空チェックのみ([housingValidation.ts:99](../../../src/utils/housingValidation.ts#L99))。`validateRegistrationDraft` に「dc が実在するか」「server がその DC 配下か」の照合を追加(api は src を import 済みのため同一関数を共用)。
- `addressKey` が dc を含み KR Carbuncle と JP Carbuncle が別キーになることを実装時に検証(重複チェックの誤爆防止)。

## 4. ツアー地域ガード (変更なしで自動適用)

- [tourCrossing.ts](../../../src/lib/housing/tourCrossing.ts) の `canAddToTour` は非OCE地域同士の混在を既にブロック。KR/CN は非OCEなので**コード変更なしで「韓国は韓国のみ・中国は中国のみ」になる**。OCE 例外には触らない。
- 中国内の DC 跨ぎは同一 region のため既存の DC トラベル案内(`kind:'dc'`)がそのまま出る。
- 追加テストで固定: KR×JP 追加不可 / CN×JP 追加不可 / CN 内 DC 跨ぎ可 / KR 内ワールド跨ぎ可。

## 5. 検索 (横断検索・キーワード)

- 現在は英名+日本語カタカナ読み(`JP_KATAKANA_READINGS`)。用語辞書接続で **ko/zh の DC・ワールド・エリア名でもヒット**させる(listingSearch / useKeywordFilteredListings の照合プールに辞書の 4 言語名を追加)。
- 韓国ワールドのカタカナ読みは登録しない(日本語話者が韓国鯖を探すケースは地域フィルタで足りる。誤爆防止優先・[[feedback_no_speculative_alias_data]])。

## 6. 行き方翻訳 (300区画 × en/ko/zh)

- 正典 [directions-src/*.csv](../../../src/data/housing/directions-src/) の ja 本文は**無変更**。新規に `directions-src/translations/{en,ko,zh}/{area}.csv`(列: 表裏,番地,行き方補足)を追加し、パーサが `wardDirections.generated.json` を `directions: {ja,en,ko,zh}` 構造に拡張。`getPlotDirections` は locale 引数を受けて該当言語(無ければ ja フォールバック)を返す。
- 翻訳は Claude がバッチ生成(機械品質で十分とユーザー確認済)。**固有名詞(エーテライト名・S/M/L 等)は用語辞書の公式訳を機械的に使用**し自由訳しない。
- 制約継承: 本文に ASCII カンマ禁止(パーサが素朴 split)。中文の読点は全角「，」「、」を使う。
- 既存テスト(300区画網羅・S/M/L 整合)は ja に対して維持、翻訳側は「300×3言語の非空」完全性テストを追加。

## 7. マップ・エーテライト

- ハウジングマップはゲーム仕様上全リージョン共通のため**地図データ・経路・座標は一切変更なし**。
- 詳細/ツアー画面のエーテライト名表示のみ辞書変換(§1)。

## 8. テストと検証

- 単体: 地域ガード4ケース(§4) / 辞書完全性(全DC・全ワールド・全エーテライトに4言語名) / 行き方翻訳完全性(§6) / dc/server 実在検証の正常・異常系。
- ゲート: `npm run build` + `vitest run`(push 前フル)。
- 実機チェックリスト(ユーザー): ①言語 ko に切替→探すの初期地域=韓国 ②zh→中国 ③ja/en→従来どおり ④地域フィルタで韓国/中国を選ぶと専用ワールドが DC 絞り込みに出る ⑤テストで韓国の家を登録→日本語ブラウズの既定では出ない(地域=韓国にすると出る) ⑥ツアートレイに JP の家がある状態で KR の家が追加できない ⑦行き方が en/ko/zh で表示される。
- **注意**: 中韓リージョンにはキャラを作れないため実在ハウジングの現地確認は不可能。登録テストデータで UI 検証のみ([[feedback_housing_data_disposable]] によりテストデータは削除自由)。

## 9. 今回やらないこと

- モデレーション判断(brainstorming 保留中・別途再開)
- UI 翻訳の「ja と同値 ~130キー」の点検(別タスク)
- ツアー PiP 機能(別 brainstorming・TODO 記録済)
- 韓国ワールドのカタカナ読み検索(§5 のとおり意図的に非対応)
- 行き方文スプシの復活(CSV 正典は変えない)

## 10. 前提(未検証)とリスク

- **中国4DC間の DC トラベル可否は未検証**。誤りの場合も region 区切りの変更(CN を DC 単位地域に分割)だけで修正でき、データ再登録は不要。
- Shadow/Dynamis のワールド構成はスプシ準拠(ユーザー提供データを信頼)。
- 韓国 DC の正式表示名は「한국 DC」等スプシ準拠。内部キー `Korea` は表示に出ない。
