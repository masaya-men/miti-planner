# CSS のテーマ指定を部品から抜く(ideal-finish ⑥・Task 16)

作成 2026-10-29。親=`docs/superpowers/specs/2026-10-28-ideal-finish-design.md` ⑥・計画 `docs/superpowers/plans/2026-10-28-ideal-finish.md` Task 16。

## 目的と理由
部品の CSS の中に「ライトの時はこの色」「MIL-SPEC の時はこう」というテーマの分かれ道が散らばっていると、テーマを足す・直すたびに部品を探して回ることになる。理想の形は次のとおり。

- **テーマのファイルが決まりの名前(CSS 変数)に値を入れる。部品は var() を読むだけ。**
- テーマが部品の形まで描き変える場合(MIL-SPEC)は、その描き変えを**テーマのフォルダに集める**。部品のファイルには書かない。
- 強さの順番(@layer)は 1 か所で宣言する。
- 定義の無い var() と、部品のファイルに戻ってくるテーマ指定を見張りで止める。

**画面の見た目は 1 px も変えない**(masaya 10-29 了承)。

## 測った結果(2026-10-29・HEAD b3bf966d)
CSS 211 本のうち、テーマ指定(`.theme-*` / `[data-theme…]` / `.milspec-app`)は約 1,080 か所。

- **MIL-SPEC のフォルダ**(`src/styles/military/**`・`src/components/military/**`): 約 1,000 か所。MIL-SPEC の時しか読まれない部品と、標準の部品を MIL-SPEC で描き変える `standard-*.css`(表・スクロールバー・効果・リキャスト・ジョブの札・窓の掛け戻し)。描き変えは色だけでなく形・疑似要素の content・表示の有無に及ぶ。
- **部品のファイル**(直す対象・下の表)
- **テーマの値を置くファイル**: `src/styles/base/tokens-{dark,light,admin,columns}.css`・`global.css` の `:root, .theme-dark, .theme-light`・`src/styles/housing/tokens.css`
- **テーマ切替の演出そのもの**: `src/styles/housing/theme-reveal.css`(`html[data-theme-anim]`)

@layer は `tokens-admin/dark/light.css`・`global.css`(`@layer base`)と `PartySettingsModal.css`(`@layer components`)だけで、順番の宣言はどこにも無い(Tailwind v4 が内部で `theme, base, components, utilities` を宣言)。それ以外の CSS は層の外にあり、Tailwind のユーティリティより強い。`!important` は全体で 52。

## 直す対象(部品のファイルのテーマ指定)

| ファイル | 数 | 中身 | 直し方 |
|---|---|---|---|
| `src/components/Timeline.css` | 13 | 空の表のすりガラス・角の光・上辺の光(ライトだけ別の値) | 値を変数にして tokens-dark/light に置く |
| `src/components/MitigationSheetPreview.css` | 4 | 表の枠・見出し・セル・待ちの輪(ライトだけ別) | 同上 |
| `src/components/Memo/memo.css` | 1 | メモ(ライトだけ別) | 同上 |
| `src/components/timeline/ConflictOffscreenArrows.css` | 1 | 矢印の影(ライトだけ) | 同上(ダークの値は「無し」) |
| `src/styles/base/glass.css` | 2 | `.glass-frame` のライト/ダーク | 同上 |
| `src/components/timeline/sheet/sheet.css` | 14 | MIL-SPEC での表の列の描き変え | **一字一句** `src/styles/military/` の新しいファイル(例 `standard-sheet.css`)へ移す。中身は書き換えない |
| `src/components/housing/workspace/SceneryVideo.css` | 5 | 背景のライト/ダーク | 値を変数にして `src/styles/housing/tokens.css` の `.housing-workspace[data-theme=…]` に置く(ハウジングの決まり `.claude/rules/housing-design.md` に従う) |
| `src/styles/housing/ward-map.css` | 2 | 地図の床・画像のライト/ダーク | 同上 |
| `src/components/GridOverlay.tsx:165` | 1 | 光パルスの色を決めるため `<html>` のクラスを毎フレーム読む | テーマの状態の正本(`useThemeStore` の `theme`=light/dark。必要なのは明るさだけなので store の拡張は不要)から読む形に。描画の毎フレームで重くならないこと |

上の表が、MIL-SPEC のフォルダとテーマの値を置くファイルの外にあるテーマ指定の全部(2026-10-29 に全 CSS と TS/TSX を数えて確認)。

変数の名前は意味で付ける(例 `--empty-scrim-bg`)。既存の名前の付け方は `tokens-dark.css`・`tokens-light.css` に合わせる。値はライト/ダークとも**今の計算後の値と同じ**にする(ダークで今「指定なし」の所は、今の見た目と同じになる値=多くは `none` か元の値)。

## ヘッダー等の枠の素材(`.glass-tier3`)
10-28 の浮かぶものの統一で、窓・メニュー類は `.float-surface` に移った。残った `.glass-tier3` の使い手は 10 部品:

- 画面の枠: `ConsolidatedHeader`・`Sidebar`・`AppFooter`・`HeaderCollapseHandle`・`SidebarHandle`・`FocusModeRail`・`CollabJoinerPage`(参加者側の縦の枠)
- 画面としての案内: `WelcomeSetup`
- 管理画面の窓 2 つ: `CsvImportModal`・`FflogsTranslationModal`(管理画面は別プロジェクトで作り直すので見た目は触らない)

直し方:
1. 名前を仕事の名前に改める: `.glass-tier3` → 「画面の枠の素材」を表す名前(例 `.frame-surface`)、`--glass-tier3-*` も同じく。`.glass-frame` 等の付属クラスも整合させる。管理画面の 2 つも名前の付け替えだけ行う。
2. MIL-SPEC の掛け戻し(`standard-revert.css` の `.glass-tier3` を含む規則・`--std-glass-tier3-*`)が、浮かぶものの統一後もまだ働いているかを実測する。MIL-SPEC のボードの中に `.glass-tier3` が 0 個なら、その部分は使われていないので消す(消したら `military-overlay-island.test` 等が通ること)。まだ使われていれば名前の付け替えに合わせる。
3. `semantic-tokens.css` の `--glass-tier3-*` の差し替えも名前に合わせる。

改名は**名前だけの置き換え**として、MIL-SPEC のフォルダ(`standard-revert.css`・`semantic-tokens.css`)・テスト(`floatSurface.*`・`military-overlay-island.test.ts`・`militaryCssColocation.guard.test.ts`)・`scripts/milspec-sp2/military-smoke/` にも行ってよい。「standard-*.css の中身は書き換えない」の例外(Claude の判断)。改名は 1 つの組が 1 commit でまとめて行い、他の組と並行しない(多くのファイルに波及するため)。

## 強さの順番(@layer)
- 層の順番の宣言は `tailwindcss` の中の 1 か所(`theme, base, components, utilities`)に任せ、`src/index.css` の先頭には説明のコメントだけを置く(実装時に変更: `@import "tailwindcss"` の前に `@layer` を書くと Tailwind が先頭でなくなり @import 先の中身を捨てる=`baseCssColocation.guard.test.ts` が守る決まり)。
- `PartySettingsModal.css` の `@layer components` は、そうした理由がコメントで説明できればそのまま、説明できなければ層の外に戻す(どちらも見た目が変わらないことを visual-regress で確かめる)。
- **やらないこと**: 層の外にある約 200 本の CSS を層に入れること。入れると Tailwind のユーティリティとの強さが入れ替わり、全画面の見た目が変わる危険が大きい。「層の外=部品の CSS はユーティリティより強い」が今の決まりだと宣言の横のコメントに書く(Claude の判断)。

## 見張り(テスト)
`src/architecture/__tests__/` の既存の見張りと同じ作法で 2 本足す。

1. **部品のファイルにテーマ指定を書かない**: `src/**/*.css` で `.theme-light` / `.theme-dark` / `.theme-military` / `[data-theme` / `.milspec-app` を含む規則を数え、許すのは「テーマのファイル」の一覧(上の「測った結果」の 3 種+MIL-SPEC のフォルダ)だけ。一覧以外で見つかったら落ちる。TS/TSX で `<html>` のテーマのクラスを直接読む箇所も同じく 0(`useThemeStore` 自身と `MilspecTunePanel` の開発用の文字列は除く)。
2. **定義の無い var() を使わない**: `src/**/*.css` の `var(--x)` で、代わりの値が無く、どの CSS にも `--x:` の定義が無く、TS からも書かれていないものは落ちる。動きの中で JS が書く変数(例 `--cd-display`)・Tailwind が作る変数は理由つきの許可一覧に載せる。**既にある違反は直さず一覧に載せる**(Claude の判断)。定義の無い変数を今定義すると、今は効いていない指定が効き始めて見た目が変わるため。打ち間違いに見える物は、一覧に「要確認」と付けて最後に masaya へ報告する(直すかは別に決める)。件数は計画の最初に数える。

## 確かめ方
- **最初に撮影の範囲を足す**(Claude の判断): 今の visual-regress の撮影一覧(`scripts/visual-regress/catalog/`)には、空の表(`.no-plan` のすりガラス)・メモ・軽減表のプレビュー・画面外の競合の矢印・ハウジングの背景(ライト/ダーク)が入っているか確かめる。入っていない物は撮影の条件を足し、**足してから**基準を撮る。動画などで撮るたび揺れて撮影で比べられない物は、Playwright で該当要素の計算後のスタイル(`getComputedStyle` の該当プロパティ)を前後で比べる。
- 値の一致の意味: 変数にした後の**計算後の値**が、ライト/ダーク/MIL-SPEC それぞれで前と同じであること。
- 1 部品(1 ファイル)ごとに commit。各 commit の前に `node scripts/visual-regress/run.mjs --compare=<この作業の前に撮った基準>` で一致(ライト/ダーク/MIL-SPEC)。意図した差は無いので、差が出たら揺れかどうかを前後同時撮りで確かめる(既知の揺れ: milspec/page-lanes の並べ替えの滑り込み)。
- `npm run test:gate` 失敗 0・`npm run build` 0・`npm run lint` 0。
- sheet.css の移動は `node scripts/css-colocation/compare-build.mjs` で欠け 0。読み込み順が変わって強さが変わる場合は、**中身は変えずに読み込む位置を調整**して元の順番を保つ(中身を書き換えないことを優先)。

## やらないこと
- MIL-SPEC 専用の部品の `.theme-military` の前置き(名札)を外すこと。
- `standard-*.css` の中身を変数の形に書き換えること(形の描き変えまで変数にすると、MIL-SPEC だけのつまみを標準の部品に埋め込むことになる=避けたい形)。
- テーマ切替の演出 `theme-reveal.css`。
- 管理画面の見た目。
- 見た目の変更全部。

## 作り手に任せること
- 変数・新しいファイル・新しいクラスの具体的な名前(上の例は例)。
- 並行の組み方(ファイルが重ならない組は同時でよい。`tokens-dark/light.css` を複数の組が触るなら、組はそれぞれ追記し親が取り込み時にまとめる、または直列)。
- GridOverlay の読み方の細部。
