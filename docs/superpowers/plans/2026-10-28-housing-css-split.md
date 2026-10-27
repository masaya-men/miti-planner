# housing.css 分割計画(2026-10-28・整頓⑨の 1 本目)

> 見張り: `src/architecture/__tests__/file-size.test.ts` が housing.css を frozen 11,218 行で止めている。分割後は frozen から外れる(テストが下げる数字を教える)。

## ゴール
`src/styles/housing.css`(11,218 行・見出し 87)を **見た目を 1 画素も変えず**、1 ファイル 500 行以下・1 ファイル 1 画面(部品)に分ける。

## 方式(確定)
1. **入口は残す**: `src/styles/housing.css` は `@import "./housing/NN-名前.css";` の並びだけにする。読み込み側 7 か所(HousingShell・HousingDetailPage・HousingEditPage・HousingerPage ほか)は変更不要。
2. **順番を一切変えない**: CSS は後に書いたものが勝つ。上から順に切り出し、ファイル名の番号 = 元の順番。中身は一字一句そのまま(行の移動のみ)。
3. **切れ目は既存の見出し**(`/* ===== … ===== */`)。1 区画が 500 行を超える所(StatusBar 563–1455・ハウジンガーページ 3972–4626・登録ページ 4972–5717・日時ピッカー 5717–7377・ナビ並び替え 8035–9531・DEV ツアー 9943–10962 など)は、その中の小見出し/セレクタのまとまりで更に分ける。ルールの途中・@media の途中では切らない。
4. **置き場所**: `src/styles/housing/`。名前は中身の画面名(例: `10-shell-topbar.css`・`40-register-form.css`・`70-tour-nav-replan-1.css`)。先頭の `--housing-*` トークン定義と末尾の倍率ブロック(`--housing-scale-pc/center`・`BEGIN housing-center-tokens` マーカー区間)はそれぞれ独立ファイルに。
5. **作業場所**: 整頓は milspec-polish で進めている。分割の前に、housing.css を最新(fix/housing-scenery-ios-play-button の 2 行を含む main)にそろえてから切る(古い版を切ると後で全ファイルに衝突が出る)。

## 一緒に直す依存(漏らすと壊れる)
- **倍率の道具** `scripts/housing-scale/center-tokens.mjs`・`convert.mjs`: housing.css 1 本を読み書きする前提。→ トークンのファイルと倍率ブロックのファイルを直接指す/分割ファイル全部を対象にする。直した後に道具を流して **差分 0**(冪等)を確認。
- **CSS を文字で読むテスト**: `housingScaleCss.test.ts`・`wardMapNodeHiding.test.ts` ほか(`git grep "housing\.css" -- src`)。→ 入口の @import をたどって連結した文字列を返す共通ヘルパー(`src/styles/__tests__/readCssBundle.ts` 等)に置き換え。
- **ルールの対象パス**: `.claude/rules/housing-design.md`・`ui-design.md`・`DESIGN.md` の paths/exclude、CLAUDE.md の記述 → `src/styles/housing/**` を追加(ハウジング独自トンマナの適用範囲が外れないように)。
- 色の直書きの見張り `rawStyleRatchet`(milspec-polish 側)は housing を対象外にしている → 変更不要か確認。

## 合格条件(機械で判定)
1. **ビルド後の CSS が完全一致**: 分割前後で `npm run build` → `dist/assets/*.css`(housing を含むもの)をファイル内容で比較し差分 0。
2. **行の突き合わせ**: `node ~/.claude/skills/project-hygiene/scripts/verify-moved.mjs <分割前の控え> src/styles/housing/*.css` で欠けた行 0。
3. `src/styles/housing/*.css` すべて 500 行以下・入口は @import だけ。file-size テストで housing.css を frozen から外す。
4. visual-regress `--only=housing/` 全一致(110 件)。倍率の道具の再実行で差分 0。test:gate 失敗 0・build 0。

## 進め方
Sonnet 1 体に一括(同じファイルなので並行しない)。親は 1〜4 を自分で流して検収。commit は親。

## 追記(10-28)分け直しの方針
1 回目は「500 行以内で最も後ろの見出しで切る」詰め方だったため、400〜497 行のファイルに無関係な画面が同居した(例 03-favorites-manner-skeleton)。**見出しのまとまり(画面・部品)ごとに 1 ファイル**へ分け直す。順番は変えない(連続した範囲のまま切る)。小さすぎる見出し(数行)は直前/直後の同じ画面のまとまりへ寄せてよいが、別の画面とは混ぜない。ファイル名=画面/部品名。500 行を超える 1 画面は、その画面の中の部品の区切りで分ける。検証は同じ(verify-moved 欠け 0・ビルド CSS 一致・visual-regress housing 110 一致)。center-tokens/倍率/トークンの独立ファイルは維持。

**10-28 実施済**: 71 本(00-tokens〜70-center-tokens・名前=画面/部品名)。切れ目は全て { } の外であることを機械で確認。スマホ調整の @media 2 塊(62-mobile-layout・63-mobile-tour-bars-sheets)は途中で切るとビルド CSS が変わるため塊のまま。
