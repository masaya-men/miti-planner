# スキル・コンテンツ・翻訳を足すときの手順

抜けても画面上は黙って壊れるもの(本番だけ出ない・海外の利用者に日本語が出る・計算が合わない)を、作業の順番どおりに並べたもの。
2026-10-26 設計監査で、これまで個人メモにしかなかった手順をここへ移した。

## 前提: マスターデータの正本は Firestore
- スキル・ジョブ・コンテンツは、dev も本番も**同じ本番 Firestore**(`master/*`)を読む。
- `src/data/mockData.ts` / `src/data/contents.json` は「新規の種」と、Firestore に繋がらないときの予備でしかない。**ここを直すだけでは dev でも本番でも画面は変わらない。**
- 反映は `master/config.dataVersion` の +1 で全利用者へ即時。部分公開はできない。

## 新しいスキル(軽減・ロールアクション)
1. `src/data/mockData.ts` に定義を足す。名前(`LocalizedString`)は **ja / en / zh / zh-Hant / ko の 5 言語を最初から全部**埋める(型では zh / zh-Hant / ko が省略可なので、抜けてもエラーにならない)。繁体字は台湾公式のジョブガイドで確認し、簡体字から類推しない。
2. **計算への配線を確かめる**。リソースを使う・増やすスキル(`resourceCost` / `resourceGain`)は `src/utils/resourceTracker.ts` で実際に数えられているか。バリア・CD・効果時間も同じ。名前と説明文だけ足して終わりにしない。
3. アイコンを `public/icons/` に置く(本番の `/icons/*` は Firebase Storage へ転送されるので、置くだけでは本番 404)。
4. ビルド+テスト → commit → **コードを先に本番へ deploy**。
5. deploy 完了後に `npx tsx scripts/seed-icons.ts`(新しいファイルだけ Storage へ上げる)。
6. 最後に `npx tsx scripts/seed-skills-stats.ts --dry-run` で差分を見て、問題なければ `--dry-run` を外して実行(dataVersion は自動で +1)。
   - 既定は「新しい id だけ足す」。**既存スキルの中身を直す場合は反映されない** → `--force-overwrite`(全上書き・危険)か、id を絞った外科的な更新スクリプト(例 `scripts/migrate-skill-version-skew.ts`)を使い、書いたあと読み出して確認する。
   - 順番を逆にすると、まだ対応していない本番コードに「効果ゼロの新スキル」が見えてしまう。
- 並び順だけを変える場合は `MITIGATION_DISPLAY_ORDER`(mockData)を直して deploy するだけでよい(再 seed 不要)。
- 管理画面からの追加・編集も正規の経路(Firestore に直接入るので seed 不要)。

## 新しいコンテンツ(零式・絶など)
1. `src/data/contents.json` に追加(名前は 5 言語)。
2. `npx tsx scripts/seed-contents.ts` で Firestore へ同期(管理画面で入れた翻訳は保持・dataVersion は自動で +1)。**これをしないと新規作成の一覧にもサイドバーにも出ない。**

## Firestore を直接書き換える単発スクリプトを書くとき
- 書き込みのあとに `master/config.dataVersion` を +1 する(しないと利用者のブラウザの古いキャッシュが使われ続ける)。既存の seed 系スクリプトは自動でやっているが、単発スクリプトは自分で書く必要がある。

## 画面の文言(`src/locales/*.json`)
- キーは ja / en / zh / zh-Hant / ko の 5 ファイルに同時に足す。欠けると日本語が表示される(fallbackLng = ja)。
- `src/locales/__tests__/all-locales-parity.test.ts` が欠けを止める。既知の欠け(管理画面の一部)は許容リストで管理していて、翻訳したらリストからも消す。

## テーマ
- スタイルを増やすときは `THEME_STYLE_CLASS`(`src/store/useThemeStore.ts`)と `index.html` の起動時スクリプトの両方を直す(`themeStyleClasses.test.ts` が突き合わせる)。
- トークンはダーク/ライトの両方に定義する(`src/styles/__tests__/themeTokenParity.test.ts` が片側だけのトークンを止める)。明るさに関係ない値(寸法・形)は共通ブロックに置く。
