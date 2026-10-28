# index.css を「部品の隣」へ移す 設計書

- 日付: 2026-10-28
- 対象ブランチ: `milspec-polish`(worktree `.claude/worktrees/milspec-polish`)
- 決定者: masaya が方針を一任(10-28・ハウジング/MIL-SPEC と同じ方針)。 本書の判断は Claude。 「Claude 判断」と書いた所は masaya が読んで違えば直す。
- 前例: `docs/superpowers/specs/2026-10-28-housing-css-colocation-design.md`(以下「ハウジング設計書」)・`docs/superpowers/specs/2026-10-28-military-css-colocation-design.md`(以下「MIL-SPEC 設計書」)。 方針・確認の考え方はそれと同じ。 本書は **index.css 固有の違い** と決めたことを書く。

## 1. 何をするか・なぜ

`src/index.css`(1478 行・1 本)のうち、 特定の部品にしか効かない規則を、 その部品の隣へ移し、 部品が自分で `import './X.css'` する形にする。 アプリ全体の土台(Tailwind の設定・色や文字の大きさのトークン・全体に効く規則・多くの部品が使う共通部品)は `src/styles/base/` に意味の名前で分け、 入口 `index.css` は Tailwind の読み込みと `@import` だけにする。

なぜ: 部品を開けば見た目もそこにあり、 部品を消せば一緒に消える(ハウジング設計書 §1 と同じ)。 1478 行の 1 本は 500 行の見張りの凍結一覧に入っており、 これを外す。

成功 = **どの画面も見た目が 1 画素も変わらず**(masaya 10-28 確認)、 部品専用の見た目がその部品の隣にあり、 index.css 系のファイルがすべて 500 行以下。

## 2. 目標 / 目標でないもの / 失敗とみなすもの

目標:
- 部品専用の規則は、 それを描く部品の隣に `<部品名>.css` で置き、 その部品が読み込む。
- 共有に残すのは §4.2 の種類だけ。 共有ファイルも 1 ファイル 1 仕事・500 行以下。
- 部品ファイル同士の「後に書いた方が勝つ」頼みを 0 にし、 機械で見張る。
- 入口 `index.css` を 500 行の見張りの凍結一覧から外す。

目標でないもの:
- class 名の変更・CSS Modules 化。
- 見た目の改善・規則の掃除・トークン化(見つけたら台帳に一覧で残すだけ)。
- `src/components/MitigationSheet.css`(1011 行・次の別計画)・`stgy.css`。
- 使われていない規則の削除(unused/ に移すだけ・削除は別宿題)。

失敗とみなすもの:
- visual-regress の全体(323 件)で 1 件でも差が出たまま進む。 index.css は標準・MIL-SPEC・スマホ・ハウジング・サイト全部に効くので、 一部の catalog だけでは足りない。
- 規則が 1 つでも消える・二重になる。
- Tailwind の「効く強さの段」(§3・§4.3)が変わる。 段の外にあった規則が段の中へ、 またはその逆へ移ると、 Tailwind の class との勝ち負けが変わる。
- Tailwind の設定(`@theme` のトークン・`dark:` の書き方・`animate-ripple` 等)が効かなくなる。

## 3. 今の事実(調査済み・再調査不要)

- 読み込み: `src/main.tsx:4` で **起動時に全員分**、 CSS の中で最初に読まれる(index.css → App の部品の CSS → housing.css → military.css)。 index.css を直接読む所は他に無い。
- 中身(行は目安):
  - 1–4: `@import "tailwindcss"`・`@source not "../docs/**"`・`@custom-variant dark (...)`
  - 5–79: `@theme`(Tailwind のトークン。 `--animate-ripple`・`--animate-gear-spin-once` が同じファイルの keyframes `ripple`・`gearSpin` を名前で使う)
  - 80–174: 全体で使う keyframes・`prefers-reduced-motion`・進捗の詳細(`.progress-detail*` → `progress/ProgressDetailPanel.tsx`)・競合の脈動(`.animate-conflict-pulse` は 3 部品・`.animate-conflict-arrow-pulse`・`.conflict-chevron` は `timeline/ConflictOffscreenArrows.tsx`)
  - 175–558: **`@layer base`**。 管理画面のフォント・`:root, .theme-dark` / `.theme-light` のトークン(約 380 行)・`body`(`@apply` を使う)
  - 559–777: 段の外(unlayered)。 LoPo ボタンのスキャン(`.lopo-scan-*`・`.lopo-capsule-path` → `LoPoButton.tsx`)・glass 系・`.water-drop`・`.sidebar-item`・`.animate-toast-in`
  - 778–790: **`@layer components`**(`.btn-tactile`)
  - 791–1478: 段の外。 ボタンの文字選択防止(要素セレクタ)・空パネル(`.empty-*` → `Timeline.tsx`・`layout/EmptyPlanState.tsx`)・行のホバー線(`[data-time-row]`)・`.timeline-scroll-container[data-*]` 系・スマホのエフェクト棒(`.mobile-*` → `MobileEffectBarLayer.tsx` 他)・プレビューのハイライト(`useTimelinePreviewHighlight.ts` が組み立て)・列幅トークンの PC 上書き(`@media (min-width:768px) { :root, .theme-dark, .theme-light {...} }`)・リキャスト行(`.recast-*` → `RecastRow.tsx`・`RecastIcon.tsx`)・通知の流れる文字(`.system-notif-marquee` は 2 部品)・予定名の流れる文字(`.lopo-name-*` → `EventNameSpan.tsx`)・`.collab-joiner-shell`(`CollabJoinerPage.tsx`・**遅延読み込み** `App.tsx:10`)
- class ごとの使う部品の数(.tsx/.ts を文字で検索・テスト除く。 目安):
  - 0 部品: `font-scale-exclude`・`glass-tier1`・`recast-row`・`water-drop`
  - 1 部品: 上の「→」のもの大半・`glass-tier2`・`btn-tactile`・`no-scrollbar`・`animate-toast-in`
  - 2 部品: `glass-border-b-0`・`mobile-miti-icons`・`mobile-row-dim-text`・`no-plan`・`recast-num`・`system-notif-marquee`・`touch-none`
  - 3 部品以上: `glass-tier3`(37)・`glass-frame`/`glass-shadow-none`/`glass-border-t-0`(5)・`glass-border-r-0`/`glass-panel`(4)・`glass-border-l-0`・`sidebar-item`・`animate-conflict-pulse`(3)・`timeline-scroll-container`(6)
- **ハウジング/MIL-SPEC と違う点**:
  1. class に共通の接頭辞が無い(`milspec-` のような目印で対象を決められない)。
  2. Tailwind の段(`@layer base` / `@layer components` / 段の外)が混ざっている。 段の外の規則は Tailwind の class より常に強く、 段の中の規則は弱い。
  3. 持ち主の部品の大半は **起動時から読まれる**(Timeline・Layout・RecastRow 等)。 移した CSS は起動時の CSS の中で「index.css より後・housing.css/military.css より前」に並ぶ。 よって military.css・housing.css との勝ち負けは今と同じ。 変わりうるのは **他の部品の隣の CSS(例: MitigationSheet.css)との前後**。
  4. 要素セレクタ・属性セレクタ(`button`・`[data-time-row]`・`[data-admin-page]`)の規則がある。
- index.css を文字で読むもの: `src/styles/__tests__/themeTokenParity.test.ts`・`scripts/css-colocation/__tests__/reachable.test.ts`・`scripts/milspec-sp2/military-smoke/steps-c.mjs`。 コメントで index.css を指す所: `memberX.ts`・`calculator.ts`・`RecastRow.tsx`・`MobileEffectBarLayer.tsx`・`ConflictOffscreenArrows.tsx`・`TimelineMitigationLayer.tsx`・`LegalPage.tsx`。
- 道具: `scripts/css-colocation/`(`colocate.mjs --scope=<名前>`・設定は `scopes/<名前>.mjs`・`compare-build.mjs` は起動時+後読みのビルド CSS 全部を比較し、 起動時↔後読みの移動も一覧にする)。 `cssRules.mjs` は規則の条件に囲んでいる @ 規則(@media だけでなく @layer も)を含める。
- 見た目の確認: `scripts/visual-regress/`(基準 `scripts/visual-regress/.out/baselines/dpr2`・全体 323 件・約 11 分)。 使い方は `.claude/rules/visual-regress.md`。
- 既知の別件: `military-smoke` は step1 で失敗(切替ボタンの場所が古い)。 今回の確認には使わない。

## 4. 決めたこと

### 4.1 置き場所と名前(Claude 判断)
- 持ち主の決め方はハウジング設計書 §4.1・MIL-SPEC 設計書 §4.1 と同じ(その class/属性を書いている部品。 2 部品なら外側の枠を描く方。 .ts が組み立てるならその .ts を使って描く部品)。
- **属性セレクタの規則**(`[data-time-row]`・`.timeline-scroll-container[data-*]`)の持ち主は、 その属性を付けている部品。 `timeline-scroll-container` は 6 部品に名前が出るが、 要素を描くのは 1 か所のはず。 描く部品を持ち主とする(作る人が確かめる)。
- 名前は部品と同じ名前(`RecastRow.tsx` の隣に `RecastRow.css`)。 既に同じ名前の CSS がある部品は、 その末尾に足す。
- 接頭辞が無いので、 道具の設定(`scopes/index.mjs` 等・名前は作る人に任せる)は **移す class の一覧を明示** する形にする(§3 の数え上げが元)。 一覧に無い class の規則は動かさない(=共有に残る)。

### 4.2 共有に残すもの(Claude 判断・index.css 固有の要点)
`src/styles/base/` に意味の名前で置き、 入口 `index.css` から `@import` する(起動時に全員分読む=今と同じ)。 種類:
- **Tailwind の設定**: `@import "tailwindcss"`・`@source`・`@custom-variant` は入口に残す。 `@theme` と、 それが名前で使う keyframes(`ripple`・`gearSpin`)は `base/theme.css`。 (Tailwind が `@import` 先の `@theme` を読めない場合は `@theme` を入口に残し、 台帳に理由を書く。)
- **トークン**: `:root`・`.theme-dark`・`.theme-light` の変数と、 列幅トークンの PC 上書き。 1 ファイル 500 行以下になるよう意味で分ける(例: 文字の大きさ・間隔/色(暗)/色(明)/列幅。 線引きは作る人)。
- **全体に効く規則**: `body`・管理画面のフォント・ボタンの文字選択防止・`prefers-reduced-motion` の全体分・全体で使う keyframes。
- **共通部品**: 3 部品以上が使う class(`glass-*` の大半・`sidebar-item`・`animate-conflict-pulse`)。 `base/glass.css` のように意味の名前で。
- **`unused/`**: 今の JSX/TS に class が見つからない規則(MIL-SPEC 設計書 §4.2 と同じ判定=.ts も対象・テンプレート文字列の組み立ても「使われている」側)。 起動時に読むまま、 元の段のまま置く。

### 4.3 Tailwind の段を保つ(本設計の要)
- **移した規則は、 元と同じ段に置く。** 段の外の規則は移し先でも段の外。 `@layer base` / `@layer components` の中の規則は、 移し先でも同じ名前の `@layer` で包む。 (段の並び順は入口の `@import "tailwindcss"` が最初に決めるので、 後から読む部品の CSS の `@layer components` も同じ段に入る。)
- `@apply` を使う規則を部品の隣へ移す場合は、 移し先の先頭に `@reference` で入口を指す(今のところ該当は `body`〔共有に残る〕と `.water-drop`〔unused〕だけの見込み)。
- 比較の道具は規則の条件に `@layer` を含めているので、 段が変わると「欠け+増え」として出る。 これを確認 1(§4.4)で 0 にする。
- 順番頼りの検出(部品 ↔ 部品 = 0)はハウジング設計書 §4.3・MIL-SPEC 設計書 §4.3 と同じ。 加えて index.css 固有で、 **今 index.css にあって、 他の部品の隣の CSS に同じ詳細度で上書きされている規則** は、 移すと前後が入れ替わりうる。 compare-build の「順番の入れ替わり」一覧で 0 を確かめ、 出たら上書きされる側を前に並ぶ場所(共有)に残す。 詳細度を上げる書き換えはしない。
- **Tailwind の後処理(Task 1 で判明・Claude 判断)**: `@tailwindcss/postcss` は `@import`・`@apply`・`@theme`・`@reference` 等を含むファイルだけを処理し、 その時だけ Lightning CSS で整える(`0.3s`→`.3s` など。 対象ブラウザ次第で書き換えや削除もする=`.claude/rules/css-rules.md` の backdrop-filter)。 部品の隣の普通の CSS は素通り(autoprefixer は全ファイルに掛かる)。 よって移した規則は「書き方」が変わる。 対処: compare-build に **値の書き方の正規化**(lightningcss の minify を対象ブラウザ指定なしで両側に掛ける=書き方だけそろい、 対象ブラウザ由来の書き換え・削除は差として残る)を足す。 正規化しても残る差がある規則は部品へ移さず共有に残す(`@reference` で部品 CSS を Tailwind に通す案は、 ファイルごとに Tailwind の全体処理が走るので採らない)。 `@import` 先(`src/styles/base/*`)は入口と一緒に処理されるので今と同じ。
- **`@theme` は入口に残す(Task 1 実証)**: `@import` 先へ移すと Tailwind の部品 349 規則が消えた。 `@theme` と、 それが名前で使う keyframes `ripple`・`gearSpin` は入口に置き、 見張りの許可に含める。
- 異なる段どうしの組(段の中 ↔ 段の外)は並びに関係なく勝ち負けが決まるので、 順番頼りの組から外してよい(道具がまだ外していなければ外す)。

### 4.4 確認方法(機械で判定できるもの)
各まとまりを移すたびに次を全部通す。 1 つでも落ちたら次へ進まない。
1. **規則の欠け・重複なし**: compare-build で欠け 0 / 重複 0 / 順番の入れ替わり 0。 起動時↔後読みの移動は `CollabJoinerPage` 等の遅延部品の分だけで、 一覧と一致すること。
2. **順番頼り**: 部品 ↔ 部品 = 0(恒久テスト)。
3. **見た目**: visual-regress **全体** を基準と比較して 323 件一致。 **移す前に 1 回 `--compare` して差 0 を確かめてから始める**。 途中のまとまりでは関係する catalog(標準=`miti`・スマホ=`miti-mobile`・MIL-SPEC=`miti-milspec`・`site`)だけでよく、 全体は最後と、 トークン・全体の規則を分けた後に回す。 撮れていない状態(LoPo ボタンのホバー・流れる文字の動き等)は 1・2 で担保する。
4. ビルド 0・関係テスト通過・500 行の見張り通過(index.css を凍結一覧から外す)・`npm run test:gate` 失敗 0(最後に 1 回)。

### 4.5 道具・テスト・決まり
- 道具は `scripts/css-colocation/` に設定を 1 本足す。 接頭辞の代わりに class の一覧で対象を決められるよう、 必要なら道具を直す。 直した後、 housing・military の compare-build と見張りの結果が変わらないことを確かめる。
- index.css を文字で読むテスト・道具(§3)は、 分けた後のファイル群を読む形に直す(MIL-SPEC の `src/styles/__tests__/militaryCssText.ts` と同じ考え方の入口を作る)。 コメントで index.css を指す所は移し先を指すよう直す。
- 見張りを足す(`militaryCssColocation.guard.test.ts` と同じ考え方): `src/styles/base/` に許可一覧以外のファイルを置いたら落ちる(1 行ごとに「なぜ共有か」)/ 入口 `index.css` は Tailwind の 3 行と `@import` だけ/ 部品同士の順番頼り 0。
- 書き方の決まり: `.claude/rules/` に「標準の部品の CSS は部品の隣に部品と同じ名前で置き部品が import する。 共有(`src/styles/base/`)は §4.2 の種類だけ。 段の中の規則は同じ `@layer` で包む」を書く(新しいファイルか既存に足すかは作る人に任せる)。

### 4.6 進め方
- **最初に実証する(Claude 判断・確認担当の指摘から)**: ①の前に、 次の 2 つを捨てる前提の試しで確かめ、 結果を台帳に書く。 (a) `@theme` を `@import` 先へ移してもビルド CSS が一致するか。 一致しなければ `@theme`(と使う keyframes)は入口に残し、 §4.5 の見張りの許可に `@theme` を含める。 (b) `.btn-tactile` を部品の隣へ `@layer components` で包んで移し、 ビルド CSS の中で Tailwind の components の段に入っている(段の並びが変わらない)こと。 外れたら止めて報告する。
- **遅延部品の CSS**(`.collab-joiner-shell` 等): 移すと後読みになり housing.css・military.css より後に並ぶ。 compare-build の「順番の入れ替わり」と順番頼りの検出で、 共有・housing・military と同じ詳細度でぶつかる組が無いことを確かめる。 あれば、 その規則は共有に残す(Claude 判断)。
- **index.css を文字で読むテスト**(`themeTokenParity.test.ts` 等)は ①と同じコミットで、 分けた後のファイル群を読む入口へ直す。 500 行の凍結一覧から index.css を外すのも ①(入口が 500 行以下になった時点)。
- まとまりごとに 1 コミット。 推奨順: ①土台を `src/styles/base/` へ分ける(入口を Tailwind+`@import` だけに・部品へはまだ移さない)→ ②1 部品だけのもの(空パネル・LoPo ボタン・リキャスト・エフェクト棒・流れる文字・進捗の詳細・合流画面)→ ③2 部品のもの(外側へ寄せる)→ ④unused。 細かい順番は計画で決める。
- 計画には「index.css の規則のまとまり → 移し先」と、 2 部品にまたがる class の寄せ先を全件載せる。

## 5. 作る人に任せること
- トークンの分け方の線引き・共有ファイルの名前。
- 道具の設定の名前と、 class 一覧で対象を決める直し方。
- `timeline-scroll-container` 等、 名前が多くの部品に出る class の「描く部品」の確定。
- 既存の同名 CSS へ足すか、 新しく作るか(同名が無ければ新しく作る)。

## 6. 宿題・既知のこと
- 見つけた「使われていない規則」「生の値」は台帳に一覧で残す(消さない・直さない)。
- 次: 同じ方針で MitigationSheet.css。
