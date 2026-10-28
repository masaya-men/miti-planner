# MIL-SPEC の CSS(military.css)を「部品の隣」へ移す 設計書

- 日付: 2026-10-28
- 対象ブランチ: `milspec-polish`(worktree `.claude/worktrees/milspec-polish`)
- 決定者: masaya が方針を一任(10-28・ハウジングと同じ方針)、 本書の判断は Claude。 「Claude 判断」と書いた所は masaya が読んで違えば直す。
- 前例: `docs/superpowers/specs/2026-10-28-housing-css-colocation-design.md`(以下「ハウジング設計書」)。 方針・確認の考え方はそれと同じ。 本書は **military 固有の違い** と決めたことを書く。

## 1. 何をするか・なぜ

`src/styles/military.css`(1996 行・1 本)の規則のうち、 MIL-SPEC の部品(`src/components/military/**`)の見た目を、 その部品の隣へ移し、 部品が自分で `import './X.css'` する形にする。 テーマ全体の土台(色の決まり・標準の画面への掛け戻し・背景・複数部品の共通部品)だけを `src/styles/military/` に意味の名前で残す。

なぜ: 部品を開けば見た目もそこにあり、 部品を消せば一緒に消える(ハウジング設計書 §1 と同じ)。 加えて military 固有の利点として、 部品の CSS は部品と一緒に「MIL-SPEC を開いた時だけ」読まれるようになり、 標準テーマの人が MIL-SPEC の見た目(約 1,200 行分)を起動時に読まなくなる。

成功 = 見た目が 1 画素も変わらず、 MIL-SPEC の各部品の見た目がその部品の隣にあり、 新しい見た目を書く人が迷わない。

## 2. 目標 / 目標でないもの / 失敗とみなすもの

目標:
- MIL-SPEC の部品専用の規則は、 それを描く部品の隣に `<部品名>.css` で置き、 その部品が読み込む。
- 共有に残すのは「テーマの土台」だけ(§4.2)。
- 部品ファイル同士の「後に書いた方が勝つ」頼みを 0 にし、 読み込み順が変わっても見た目が変わらない状態にする。 それを機械で見張る。

目標でないもの:
- class 名の変更・CSS Modules 化(接頭辞 `milspec-` で衝突しない)。
- 見た目の改善・規則の掃除・トークン化(見つけたら台帳に一覧で残すだけ)。
- index.css・MitigationSheet.css(次の別計画)。
- MIL-SPEC の重さ(スクロールの重い山)の調査(別の宿題)。

失敗とみなすもの:
- visual-regress の MIL-SPEC・標準の軽減表で 1 件でも差が出たまま進む。
- 規則が 1 つでも消える・二重になる。
- 標準テーマの見た目が変わる(土台を部品へ移し間違えると起きる)。
- MIL-SPEC に切り替えた瞬間に見た目が一瞬崩れる(部品より先に要る規則を遅れて読むと起きる)。

## 3. 今の事実(調査済み・再調査不要)

- `military.css` は `src/main.tsx` 8 行目で **起動時に全員分** 読まれる(index.css → App → housing.css → military.css の順なので、 起動時に読む CSS の中では最後)。
- MIL-SPEC の部品は **ほぼ遅延読み込み**(例外=静的 import 3 か所・§4.2 boot-parts): `Layout.tsx:35`(MilspecLayout)・`JobPickerRow.tsx:11`(MilspecJackRow)・`TimelineControlBar.tsx:17-18`(MilspecControlDeck / MilspecJackBoard)・`Timeline.tsx:53-54`(MilspecReticle / MilspecRowPrinter)。 遅延の入口が 6 つあるので、 部品の CSS はビルドで複数の後読み CSS に分かれ、 **後読み CSS 同士の並びは開いた順で変わる**。
- 既に部品の隣にある CSS が 10 本(計 710 行): `footer/milspecFooter.css` `rail/milspecRail.css` `header/milspecVent.css` `header/milspecCrt.css` `header/milspecH4.css`(4 部品が読む) `table/milspecTable.css`(MilspecWorkspace が読むが中身は表全体) `table/milspecDeck.css` `table/milspecJack.css`(2 部品が読む) `power/milspecPower.css` `milspecNotifBeacon.css`。 名前は小文字始まり。
- military.css の中身(行は目安):
  - 1–327: `--ms-*` パレット(`.theme-military.theme-{dark,light}`)
  - 328–587: 本番の意味トークン(`--color-*` 等)を MIL-SPEC へ付け替え
  - 588–760: 案 B=ボードの中に描く窓を標準の見た目へ掛け戻す
  - 762–1137: 共通プリミティブ(`.milspec-hp` 装甲板・フォント・押下フィードバック)。 このうち約 70 規則は今の JSX/TS に class が見つからない(v11 移植で使われなくなった可能性)
  - 1140–1214: 背景・走査線・フォント適用(`[data-app-shell]` は標準の `Layout.tsx` が描く要素)
  - 1215–1317: SP1 レイアウトの殻(MilspecLayout・背景動画)
  - 1318–1610: SP2 表の残り(照準・リキャスト等)
  - 1611–1821: v11 飾り(ランプ・刻印・ネジ)・サイドバーの旧規則の残り・基板
  - 1822–1919: サイドバーのツリー・S1〜S3
  - 1920–1996: ヘッダー上段(ロゴ・銘板・計器)と組み立て
- class 名が `.tsx` でなく `.ts`(`armor/*.ts`・`fx/engine.ts`・`relayout/*.ts`・`header/flapText.ts` 等)の中で組み立てられている規則がある。 それを描くのは、 その .ts を使う部品。
- 標準の部品(`RecastIcon.tsx`・`RecastRow.tsx`・`.wx-*`/`.wash`・`[data-app-shell]` 等)を `.theme-military` 付きで描き変える規則がある(10〜40 規則程度)。
- 道具: `scripts/housing-css/`(compare-build・colocate・cssRules=順番頼りの組の検出・reachable・classGroups・listHousingCss)。 ハウジング用に作ったので、 入口のパスやフォルダ(`src/components/housing`)が中に書いてある。
- 見た目の確認: `scripts/visual-regress/catalog/miti-milspec.mjs`(MIL-SPEC の PC・窓)・`miti.mjs`(標準)。 使い方は `.claude/rules/visual-regress.md`。
- 既知の別件: `military-smoke` は分割前から step1 で失敗(切替ボタンの場所が v11 で変わった)。 今回の確認には使わない。

## 4. 決めたこと

### 4.1 置き場所と名前(Claude 判断)
- 持ち主の決め方はハウジング設計書 §4.1 と同じ(その class を書いている部品。 2 部品が書くなら外側の枠を描く方)。
- **class を .ts が組み立てている場合**、 持ち主は「その .ts を import して描いている部品」(例: `armor/*.ts` → `MilspecArmor.tsx`)。 1 つの .ts を複数部品が使うなら、 その中で一番外側の部品。
- 名前は **部品と同じ名前**(`MilspecContentTree.tsx` の隣に `MilspecContentTree.css`)。 ハウジングと揃える。
- **既にある 10 本も同じ形に揃える**: 1 部品だけが読むもの(Footer・Rail・Vent・Crt・Deck・Power・NotifBeacon)は部品名へ改名。 複数部品が読む `milspecH4.css`・`milspecJack.css`、 読み手と中身がずれている `milspecTable.css` は、 持ち主ごとに分け直す。 (理由: 途中で止めると「小文字の古い形」と「部品名の新しい形」が混ざり、 次に書く人が迷う。)
- 1 部品の CSS が 500 行を超えたら、 その部品の中の意味のまとまりで分け、 同じフォルダに置く。

### 4.2 共有に残すもの(Claude 判断・military 固有の要点)
`src/styles/military/` に意味の名前で置き、 入口 `military.css` は `@import` だけにする(起動時に全員分読む=今と同じ)。 残すのは:
- `palette.css`(`--ms-*`)/ `semantic-tokens.css`(意味トークンの付け替え)/ `standard-revert.css`(案 B の掛け戻し)
- `backdrop.css`(背景・走査線・フォント適用)
- `standard-parts.css`: **標準の部品を `.theme-military` で描き変える規則**。 標準の部品は MIL-SPEC の後読みより前に画面に出るので、 部品の隣(後読み)に置くと切替時に一瞬崩れうる。 また標準の部品の隣に MIL-SPEC の規則を置くと、 標準の部品を直す人が MIL-SPEC まで気にする形になる。 よって「テーマが標準の部品に掛ける上書き」として共有に置く。
- `primitives.css`: 3 つ以上の MIL-SPEC 部品が使う共通部品(`.milspec-hp` 等)。 持ち主が決められないもの。 起動時に読む側に置くので、 部品ファイル(後読み)より必ず先に並び、 部品側の上書きが今と同じく勝つ。
- `boot-parts.css`: **起動時から読まれる MIL-SPEC 部品**の規則。 遅延でなく静的に import されている MIL-SPEC のコードがある(`ConsolidatedHeader.tsx`→`MilspecStyleToggle`・`layout/useLayoutShortcuts.ts`・`timeline/MitigationItem.tsx`)。 その部品の隣に置くと起動時の CSS の中で共有より前に並び、 勝ち負けが逆転しうる。 よって「`src/main.tsx` から静的 import だけで届く部品」が持ち主の規則は共有に残す(届くかどうかは道具が import をたどって判定)。
- `unused/`: 今の JSX/TS に class が見つからない規則。 判定は .tsx だけでなく .ts も対象にし、 テンプレート文字列での組み立て(`milspec-${x}` のような接頭辞)も「使われている」側に数える(拾いすぎより、 使う規則を unused に入れる方が害が大きい)。 unused/ は今と同じく起動時に読むので、 並びは今と変わらない。 元の位置の名前で置き、 入口から読む(ビルド結果を変えない・削除は別宿題)。 ハウジングと同じ扱い。

### 4.3 順番に頼らない形にする(本設計の要)
ハウジング設計書 §4.3 と同じ。 military 固有の点:
- 共有(起動時に読む)は、 ビルドの仕組み上 **常に** 後読みの部品 CSS より前に並ぶ。 よって「共有 ↔ 部品」の順番頼りは今と同じ勝ち負けのまま保たれる。 道具はこれを「共有の規則がすべて起動時の CSS にあること」で確かめる。
- 「部品 ↔ 部品」の順番頼りは移行の終わりに **0**。 後読み CSS 同士の並びは開いた順で変わるため、 1 つでも残すと開き方次第で見た目が変わる。 上書きしている規則は上書きされる側のファイルの後ろへ移す。
- **上書きが両方向で、 上書きされる側の後ろに置けない時**(A が B を、 B が A を上書き): 詳細度を上げる書き換えはしない(他の勝ち負けまで変わりうる)。 その組の規則を「2 部品を包む外側の部品」のファイルへ寄せ、 台帳に理由つきで残す。 それでも寄せ先が無ければ止めて報告する。
- **カンマ区切りで持ち主が分かれる規則**は、 セレクタごとに分けてそれぞれの持ち主へ置いてよい。 比較の道具は規則を「1 セレクタ+@media+宣言」の単位に正規化して比べる(ハウジングの道具と同じ考え方)。
- 今 military.css(起動時)にある規則と、 既にある部品の隣の 10 本(後読み)の間の順番頼りは、 今は「military.css が先」で決まっている。 移した後も同じ勝ち負けになるよう、 同じファイルの中で前後を保つ。

### 4.4 確認方法(機械で判定できるもの)
各まとまりを移すたびに次を全部通す。 1 つでも落ちたら次へ進まない。
1. **規則の欠け・重複なし**: ビルドの CSS **全部**(起動時+後読み)を規則の集まりとして前後比較し、 並び以外が一致。 加えて「共有に残すと決めた規則は起動時の CSS にある・部品へ移した規則は後読みの CSS にある」を確かめる。
2. **順番頼りの検出**: ハウジング設計書 §4.4-2 と同じ定義。 部品 ↔ 部品 = 0。 恒久テストにする。
3. **見た目**: visual-regress の `miti-milspec`(MIL-SPEC)と `miti`(標準・変わらないことの確認)が基準と一致。 基準は `scripts/visual-regress/.out/baselines/dpr2`(10-27 に 323 件一致を確認済)。 **移す前に 1 回 `--compare` して差 0 を確かめてから始める**(差が出たらその時点で撮り直し、 原因が今回でないことを確認)。 撮れていない状態(開いた引き出し・電源投入の途中など)は 2 で担保する。 catalog に足すのは「簡単に撮れて、 またがり class を持つ部品」だけに絞る。 計画で「部品ごとに撮れている状態」を一覧にし、 撮れるものは catalog に足してから移す。
4. ビルド 0・関係テスト通過・500 行の見張り通過・`npm run test:gate` 失敗 0(最後に 1 回)。

### 4.5 道具・テスト・決まり
- **道具はハウジング用を複製せず、 対象(housing / military)を切り替えられるようにする**。 入口のパス・部品フォルダ・共有フォルダを設定として渡す形。 直した後、 ハウジングの compare-build と見張りの結果が変わらないことを確かめる。 置き場所(`scripts/housing-css/` の改名)は作る人に任せる。
- 見張りを足す(ハウジングの `housingCssColocation.guard.test.ts` と同じ内容を MIL-SPEC 用に): `src/components/military/` の .css は同じフォルダの .tsx のどれかが読む/ `src/styles/military/` に許可一覧以外のファイルを置いたら落ちる(1 行ごとに「なぜ共有か」のコメント)/ 部品同士の順番頼り 0。
- 書き方の決まり: `.claude/rules/` に MIL-SPEC の CSS の置き場所を書く(新しいファイルにするか既存に足すかは作る人に任せる。 対象パス=`src/components/military/**/*.css` と `src/styles/military/**`)。 内容は「部品の隣に部品と同じ名前で置き部品が import する。 共有は §4.2 の種類だけ。 標準の部品を描き変える規則は standard-parts.css。 他部品の見た目を同じ詳細度で上書きしない」。
- military.css の中のコメント(「military.css 32-216 の」等、 行番号を指すもの)は、 移した先で意味が通るよう直す。

### 4.6 進め方
- 画面のまとまりごとに 1 コミット。 推奨順: ①土台を共有へ分ける(入口を @import だけに)→ ②ヘッダー → ③サイドバー → ④表 → ⑤飾り・その他 → ⑥既にある 10 本の改名・分け直し → ⑦unused。 またがりの少ないまとまりから。 細かい順番は計画で決める。
- 計画には「military.css の規則のまとまり → 移し先」と、 複数部品にまたがる class の寄せ先を全件載せる。

## 5. 作る人に任せること
- 規則を部品ごとに分ける細かい線引き(§4.1 の持ち主の定義に沿う限り)。
- 道具の作り直しの形と置き場所。
- 500 行を超えた部品 CSS の分け方。
- 1 つの .ts を複数部品が使う時の「一番外側」の判断。

## 6. 宿題・既知のこと
- 見つけた「使われていない規則」「生の値」は台帳に一覧で残す(消さない・直さない)。
- 次: 同じ方針で index.css → MitigationSheet.css。
