# MIL-SPEC SP2 視覚突き合わせ 残差ノート

視覚忠実度プロトコル（プラン §テスト戦略）で詰めきれなかった差分の記録。
Task 10 の masaya 最終レビュー + SP2 後の統一調整に回す。

---

## Task 2 — ワークスペース端末キャップ + ROSTER ノート（zone: `wscap`）

`compare.mjs wscap` = mock `.workspace` / app `.milspec-ws`（cap/note は右端の小片なので
装甲板ごと撮って「表に対する位置・帯幅・文字サイズ・不透明度」を評価）。

### 反復
1. プラン Step 4 のスターター CSS をそのまま適用（cap: transparent→金属→#05070a、opacity 0.5 /
   note: opacity 0.42・text-align right）。probe で cap x=1475/w=14/opacity0.5、note "ROSTER 8 / 8" /
   "FULL PARTY" が DOM 上で描画されるのを確認。
2. mock の実測値（`mock-probe`）に合わせて是正:
   - cap グラデーションを mock 準拠の向きへ（ハード暗線を**左＝表の内容側**に、金属の照りを経て右へフェード）。
     `linear-gradient(90deg, #05070a 0 2px, --ms-raised-lo 3px, --ms-raised 45% 55%, --ms-raised-lo, transparent)`。
   - cap opacity 0.5 → **0.55**（mock 実測 0.55）。
   - note opacity 0.42 → **0.38**（mock 実測 0.38）、`text-align: right` を撤去（mock は `start`＝左寄せ・
     ragged right）、`right: 22px` → `20px`。letter-spacing は 0.14em（mock 実測 0.98px @7px＝0.14em）で一致。
   - light: スクリーンが常時ダークなので raised 白変数だと帯が浮く → 芯を鈍い金属グレー
     `rgba(120,140,158..)` に落とし、外縁ベゼル `#05070a` は残す override を追加。

### 残差（Task 10 / SP2 統一調整へ）
- **構造差（設計上の既知）**: mock は表が固定キャンバス幅で右側に空きマージンがあり、その空きに
  cap（列の終端）と note（空き領域の左上）がプロミネントに載る。実アプリは表（メンバー列）が
  `.milspec-ws-screen` 幅いっぱいに広がるため、`.milspec-ws-cap` は `right:0` = スクリーン右端の
  「端末ベゼル帯」として機能し、`.milspec-ws-note` は右上コーナー（＝ジョブチップ・ヘッダー行の上）に
  重なる。ブリーフ指定どおりの動的幅アダプテーション（固定 left 撤回・right:0 アンカー）。
- **note の可読性**: 上記により note が mock（空きダーク領域の上）より賑やかな領域（ヘッダー/チップ）に
  重なり、7px・opacity 0.38 では実効コントラストが mock 単体クロップより低い。mock 自体も極小テレメトリ
  デカール（`aria-hidden`）として意図的に淡いので「見えすぎない」方向は正しいが、最終位置（ヘッダーを
  避けて下げる / 右端の空きが出る狭幅時だけ出す等）は masaya ゲートで判断。
- **cap 位置**: mock は「列の終端」に立つ帯、実アプリは「表ビューポート右端」に立つ帯。列がビューポートより
  狭いとき（少人数・狭コンテンツ）は右側にダークな空きが出てその右端に cap が立つ ＝ mock の意図
  （空きゾーンを機能的に締める）とは一致するが、帯の絶対位置は列終端に追従しない（CSS のみで
  列終端追従は不可 ＝ Timeline のスクロール内部構造に触れないため）。

---

## Task 3 — 表本体（沈みスクリーン / 金属スラット行 / セル仕切り）

### Step 1 — `.timeline-scroll-container` 内部構造の実測（軍事モード `/miti` fixture・Playwright）

`.timeline-scroll-container`（= `scrollContainerRef`・mockup `.tbody` に対応）の直下:
1. `div.sticky.top-0.z-30.h-0.overflow-visible.pointer-events-none` — `ConflictOffscreenArrows` の
   sticky 土台（高さ 0）
2. `div.relative.isolate.bg-transparent.md:w-max.md:min-w-full` — **sheetContainer**（`position:relative`・
   行と絶対配置要素の座標原点）

sheetContainer の子（この fixture で 41 個・**全て `<div>`**）:
- **先頭 31 個 = `[data-time-row]`（`TimelineRow`）が連続**。`anyRowAfterNonRow=false`（実測）＝
  行は「先頭の連続ラン」で、非行要素が行の前・行の間に挟まることはない（PC の場合。
  `MobileEffectBarLayer` はモバイル時のみ行より前に入るが本 fixture は PC）。
- その後: `[data-phase-overlay]`×2 → 選択オーバーレイ `div[style="display:none"]`×1 →
  `MitigationItem` の絶対配置 `div`（`left/top/width` インライン）×N。
- 兄弟に混ざる要素の型: **すべて `<div>`**（`nth-of-type` と `nth-child` が等価）。
- `[data-label-overlay]` はこの fixture では 0（ラベル未投入）。`[data-phase-overlay]` は 2。

行内の直下セル並び（`[data-time-row] > *`・**常に固定**。phase 折りたたみ / label 非表示でも
素の `<div>` で埋まるので個数・順序は不変）:
| idx | セル | フック |
|---|---|---|
| 0 | フェーズ列 | `[data-phase-col]`（折りたたみ時は素の `div.w-[16px]`） |
| 1 | ラベル列 | `[data-label-col]`（非表示時は素の `div.w-[16px]`） |
| 2 | 時刻 | クラスのみ（`border-r` + `font-mono`） |
| 3 | 機工/攻撃名 | `flex-1 md:w-[var(--col-mechanic-w)]` |
| 4 | 元ダメージ（U.Dmg） | `w-[var(--col-counter-w)]`・**素の数値**（`.dmg-slot` 無し） |
| 5 | 軽減後（Dmg） | `w-[var(--col-counter-w)]`・中に `AnimatedDamage` → `.dmg-slot[.lethal]` |
| 6+ | メンバー列 | `visiblePartyMembers` ぶん・`div.hidden.md:flex` |

致命判定: `partyHp` 実測 = MT/ST 296,194 / H1〜D4 186,846。fixture 被ダメ 120,000（無軽減）は
H1 HP 未満 → `.dmg-slot.lethal` は **0 個**。→ 視覚突き合わせ用に `compare.mjs` の
`tbody`/`mitbar`/`scrollbar` zone で 1 イベントだけ被ダメ 900,000 に引き上げて致命行を 1 本作る
（store 注入・製品コード不変）。

### Step 2 — nth の当て方

**採用: `[data-time-row]:nth-child(even)`（ゼブラ）+ `[data-time-row]:nth-child(4n)`（4 行溝）。**

理由: Step 1 実測で sheetContainer 直下は「先頭に `[data-time-row]` が連続・兄弟は全 `<div>`・
行の前後に非行要素が挟まらない」。よって `:nth-child(N)` は N 番目の可視行にちょうど当たる。
Playwright で確認: `[data-time-row]:nth-child(4)` = time 69（4 行目）/ `:nth-child(8)` = time 141
（8 行目）/ `:nth-child(12)` = time 213（12 行目）。ブリーフが要求する「4 番目・8 番目に溝が付くか
実測」を満たす。`hideEmptyRows` でも行は連続の先頭ランのままなので nth-child は可視行順を維持。

（もし将来 `MobileEffectBarLayer` 等が PC でも行より前に入るようになったら nth-child がずれる。
その場合は行内完結の意匠（スラット上下シャドウ）だけ残しゼブラ/溝を落とす。現状は安全。）

### 視覚突き合わせ（`compare.mjs tbody`・mockup `.tbody` 1122-1162 / DOM 2170-2208）

`compare.mjs` の `tbody` zone は既に `.timeline-scroll-container` を指しており placeholder ではない
（Task 1 で設定済）。致命行が fixture に無いため、`tbody`/`mitbar`/`scrollbar` zone で 1 イベントの
被ダメを 900,000 に引き上げる store 注入を `captureApp` に追加（`.dmg-slot.lethal` ×1 を確認）。

反復:
1. スターター CSS 適用（mockup `.tbody`/`.trow`/`.td-*` の値をそのまま `--ms-*` 読み替えで移植）。
   `.compare/tbody-{mock,app}.png` + 640×330 の接写クロップ（dark / dark-hover / light）を Read。
   所見: 致命セル（赤発光の凹み）は mockup と強一致。沈みスクリーンの上端内影・セル縦仕切りは出て
   いるが、行が「積層した金属スラット」に見える分離感が mockup より弱い（行高 50px > mockup 48px の
   密度差 + レンダリングのマイクロコントラスト差）。
2. 是正（tuning・mockup 語彙の範囲内）:
   - `.trow` box-shadow に `inset 0 -7px 11px -7px rgba(0,0,0,0.32)`（各スラット下端の
     アンビエントオクルージョン）を追加 → 行が独立したバーに見える。
   - `:nth-child(4n)` に `inset 0 -9px 12px -8px rgba(0,0,0,0.4)` を足して 4 行溝を深く。
   - セル縦仕切り: `border-color` 0.42→0.5、左内側ハイライト 0.045→0.06。
   - ホバー左バー 3px→4px。
   - メンバー列セルに照準ドット `::after`（mockup `.td-mem::after`）を追加（`:nth-child(n+7)`）。
   再撮影 → 6 チェックすべて視認可能。

最終所見（6 チェック）:
| # | チェック | 判定 |
|---|---|---|
| 1 | 深く沈んだスクリーン（上端内影） | ✓ 上端の暗帯 + `#141b22→#0e141a` グラデで凹みが出る |
| 2 | 各行 = 浮いた金属スラット | ✓ 上ハイライト + 下墨 + 下端 AO で積層バーに見える |
| 3 | 彫り込みの縦仕切り | ✓ 既存 border-r を暗色化 + 左内側白 1px で V 断面 |
| 4 | ホバー行のシアン左バー | ✓ シアンバー + `--ms-cyan-dim` の行ティント。※下記残差 |
| 5 | 4n 溝 | ✓ 4/8/12 行目に深い溝（`--ms-pl-dark` + AO） |
| 6 | 致命行「軽減後」セルの赤発光の凹み | ✓ mockup と強一致（赤枠 + 赤グロー + 内影 + 数字も赤発光） |

残差（→ Task 10 masaya / SP2 後の統一調整）:
- **ホバー左バーの起点**: mockup は `.trow` 左端（＝フェーズ列も透過セル）に 3px バー。実アプリは
  `[data-phase-overlay]` が sticky な不透明バンドでフェーズ列（≈54px）を覆うため、シアンバー/ティントは
  その右から始まる。Task 2 の cap 位置差と同種の構造差（実アプリにあって mockup 相当粒度に無い
  凍結フェーズ列）。機能影響なし。
- **行高**: 実 50px（`pixelsPerSecond`・JS 座標計算駆動）vs mockup 48px。変更不可（Global Constraint 2/7・
  Task 1 smoke fixture の drag/clamp 前提）。密度が mockup よりわずかに低い。
- **縦グリッド / フェーズ線**（mockup `.pl.v` 2172-2173）: Task 3 スコープ外（グリッド/プレイヘッド =
  Task 5）。`.mit-bar`/`.mit-lbl` の意匠は Task 6。
- **ゼブラ**: `:nth-child(even)` の差は極小（mockup も 0.013 alpha 差）。意図どおり「見えすぎない」。
- **light**: dark 固定 hex 3 箇所（`.timeline-scroll-container` bg / 致命セル rgba / `.dmg-slot.lethal`
  text-shadow）に `.theme-military.theme-light` 上書きを付与。値は「破綻しない」レベル、最終調整は SP2 後。

---

## Task 4 — 表ヘッダー（ブラケットタイル列見出し・zone: `header`）

### Step 1 — `#timeline-header-inner` 直下の実構成（軍事 PC 1489px・Playwright 実測）

`#timeline-header-inner`（flex・items-center・h39・`will-change:transform` で**常時** containing block／
offsetParent・横スクロール同期対象）直下は **14 子**:

| # | 正体 | 実測 | border-r 保持者 |
|---|---|---|---|
| 1 | phase 見出し = `Tooltip` ラッパ `div.relative.flex.items-center.justify-center.w-fit.h-fit` | w60・**h≈18**（`h-fit`＋内側 `h-full` が潰れて text 高） | 内側 div |
| 2 | label 見出し = 同上 | w50・h≈18（折りたたみ時は内側 div が `w-[--col-label-collapsed-w]`=16px） | 内側 div |
| 3 | **time 見出し** = 同上（実 DOM に `.time` クラス無し → `:nth-child(3)` で特定） | w60・h≈16 | 内側 div |
| 4 | mechanic（敵の攻撃）= `Tooltip` ラッパ（`wrapperClassName` に `h-full` → **h39**） | w200・position:relative | 内側 div |
| 5 | **RAW（元ダメージ）** = 素の `div` | w100・h39・**position:static** | host 自身（1px hairline） |
| 6 | **TAKEN（軽減後）** = 素の `div` | w100・h39・**position:static** | host 自身 |
| 7..14 | `.recast-cell` ×8 = メンバー列見出し（`RecastRow` Fragment） | position:static・1px hairline | host 自身 |

- `.recast-cell` 数 = **8**（可視パーティ 8 人）。折りたたみでも 14 子・recast 8 のまま。
- 折りたたみ時（Shift+P / Shift+L）: phase/label ラッパ幅が 16px に、内側 div の class に `collapsed-w` が入る。
- **列エッジは header ⇔ body row 0 で 0.0px 一致**（14 列全部・実測）。box を一切変えていない証拠。

### Step 2-4 — box を変えずにタイル分離を作る方法

`#timeline-header-inner > *` に **margin / 幅を足す border / padding は一切足していない**（列がずれるため）。
代わりに:
- **タイル面 = `::before`（絶対配置・`left/right:2.5px`・`top:50%;height:34px;margin-top:-17px`）**。
  host の box に依存しない固定高なので [1..3]（h≈17）と [4..6]（h39）で**同じ見た目のタイル**になる。
  `z-index:-1` で host の text より奥（`#timeline-header-inner` に stacking context があるので負 z が効く）。
  面: `linear-gradient(177deg, --ms-raised-hi, --ms-raised 46%, --ms-raised-lo)` ＋ 1px `--ms-frame` 枠
  （上辺 `--ms-edge-hi` / 下辺 `rgba(0,0,0,.6)`）＋ inset ハイライト/下墨 + 外側 1px 落ち影。
- **タイル間ギャップ** = `::before` の左右 2.5px inset で host の素地（＝暗い凹チャンネル bg）が覗く。
  加えて `#timeline-header-inner` の bg を `linear-gradient(--ms-panel-lo → --ms-recess-lo)` の**暗い凹**に
  して（mockup の raised thead は 40px 帯では読めないため意図的アダプト）タイルを浮かせた。
- **既存 border-r（1px hairline）は色だけ `rgba(0,0,0,.5)` へ**（width 不変）。[1..4] は内側 div、
  [5][6] は host が保持者なので両方セレクタに入れた。
- **交互切り欠き** = `--ms-th-notch`（`:nth-child(odd)` 右上 7px カット / `(even)` 左上）を `::before` に
  `clip-path`。**polygon はインライン定義**（`--ms-shb-tr/tl` は `.theme-dark` 限定で light で消えるため。
  値は同一 = `--ms-nb` 7px）。odd|even の継ぎ目が V 字通気溝（＝ mockup と同じく 1 つおきの継ぎ目だけ）。
- **RAW/TAKEN に `position:relative` を付与**（static のため疑似要素の基準に必要）。
  幾何影響ゼロ（offset なしの relative・`will-change:transform` で offsetParent は元から inner）。

### 隅ブラケット + hd-hash の疑似要素解決（`::before`/`::after` 各 1 個の制約）

必要: 隅ブラケット 2 個 + hd-hash = 3。`::before` は面で使用済 → **`::after` 1 個に集約**:
- `::after` の `background` を **4 レイヤーの linear-gradient** で「左上 L（7×1 + 1×7）＋ 右下 L」に。
  `clip-path` を持たない（`::before` だけが notch）ので常に矩形フレーム。
- **hd-hash** は `:nth-child(n+4):not(.recast-cell)`（= mechanic[4] / RAW[5] / TAKEN[6]・[7..] は
  `:not(.recast-cell)` が除外）の `::after` に **5 レイヤー目**（`repeating-linear-gradient(-56deg …)` を
  右上に 16×6）として足す。PH/LB/Time（`.th-mini` 相当）には付けない = mockup 同様。
- **Time 見出しの下線（mockup `.th.time .en` 1106）は不採用**（hd-hash を採用 = check 5 は充足）。
  中央寄せの「時間 ⌄」の下に線を引くと語の下線ではなく宙に浮いた線に見えるため。→ 残差。

### `:not(.recast-cell)` の扱い（Task 7 との契約）

タイル意匠ルールは全て `:not(.recast-cell)` 付き。**Task 7 でリキャストがヘッダーから別要素へ移動しても
この除外は恒久で残す**（標準モードは recast をヘッダー内に残すため）。Task 7 完了後、軍事モードでは
ヘッダーに `.recast-cell` が居なくなるので `:not(.recast-cell)` は軍事側で **no-op** 化する（害なし）。

### 折りたたみ列

`--col-*-collapsed-w`=16px の細い列は `::before` の notch 7px / ブラケットが潰れる →
`:has(> [class*="collapsed-w"])` で `::before { clip-path:none; left/right:1px }` ＋ `::after { display:none }`。
Playwright で確認: 折りたたみ時の phase/label は「チェブロンだけの素のミニタイル」になり破綻しない。

### Task 3 の `.milspec-app` リトロフィット（Task 3 レビュー Minor #1）

`military.css` SP2 節の Task 3 ルール（bare `.theme-military …`）に `.milspec-app` を前置:
`.timeline-scroll-container`（dark/light）・`[data-time-row]`（bare / `:nth-child(even)` / `:nth-child(4n)` /
`:hover` / `> *`（dark/light）/ `> *:first-child` / `> *:nth-child(n+7)::after`（＋:hover）/
`> *:has(.dmg-slot.lethal)`（dark/light））・`.dmg-slot.lethal`（dark/light）・
`[data-phase-overlay],[data-label-overlay]`（dark/light）。
`.milspec-app` は PC 軍事レイアウト時のみ mount（`MilspecLayout.tsx:51`）→ bare だとモバイル軍事
（`<html>` に `theme-military`・レイアウトは SP3 領域）へ漏れて崩れるのを塞ぐ。
`standard-invariance` exit 0 維持（元から `.theme-military` スコープで標準は不変）／
`military-smoke` exit 0 維持（PC 軍事では `.milspec-app` あり = 行意匠は従来どおり）。

### 視覚突き合わせ（`compare.mjs header` = mock `.thead` / app `#timeline-header-inner` [outer]）

反復 2 ラウンド（compare PNG + 3x DPR 接写クロップ A/B を Read）:
1. スターター CSS（mockup .th 値を `--ms-*` 読み替え・`::before` 面 h32）→ タイルが `#timeline-header-inner`
   の bg（= `--ms-raised-grad`）と**同色で埋没**、ベベル弱い。
2. 是正: header bg を暗い凹チャンネル（`--ms-panel-lo → --ms-recess-lo`）へ / `::before` 面 h32→h34・
   上ハイライト 0.08→0.14・下端 inset AO 追加・下辺墨 0.5→0.6 / `::after` も h34 に追従 /
   raised グラデを 3 stop 化。再撮影 → タイルが浮き、ベベル・ブラケット・hd-hash・V 溝すべて視認。
   （3 ラウンド目に「せり出し thead bg」も試作したが埋没が戻るため凹チャンネルを採用。）
3. commit 後の微調整（視覚突き合わせコミット）: タイル面がやや暗いため
   上ハイライト 0.14→0.18・raised グラデ mid 46%→55%（明るさを長く保持）・下端 AO 0.6→0.58。
   再撮影（dark/light/折りたたみの 3x DPR 接写）→ タイルの金属感が mockup 相当に。

7 チェック最終:
| # | チェック | 判定 |
|---|---|---|
| 1 | 各列見出し = 独立金属タイル（raised グラデ + 硬ベベル） | ✓ 暗チャンネルに浮く・上辺ハイライト/下墨 |
| 2 | 隣の切り欠きが継ぎ目で V 溝に | ✓ odd\|even の継ぎ目（phase\|label, time\|mechanic, RAW\|TAKEN）に V。mockup も 1 つおき |
| 3 | 各タイルに隅 L ブラケット | ✓ `::after` 4 レイヤーで左上 + 右下 L（シアン） |
| 4 | ヘッダー下端 = 渋い鋼ライン（シアン発光でない） | ✓ headerRef の border-b を `rgba(150,190,205,0.28)` へ recolor・glow なし |
| 5 | Time 下線 / hd-hash（採用したもの） | ✓ hd-hash を mechanic/RAW/TAKEN の `::after` 右上に。Time 下線は不採用（下記残差） |
| 6 | メンバー列見出しのジョブアイコン + ロールタグ | ✗ **構造差**（下記残差） |
| 7 | ヘッダー列が本文と縦一致（横ドリフト無し） | ✓ 14 列の x/right が body row 0 と **0.0px 一致**（実測）・smoke step 8 同期 ±0 |

### 残差（→ Task 10 masaya / SP2 後）

- **メンバー列見出し（check 6）**: mockup `.th-mem` はジョブアイコン + EN + `.role-tag` カラーバー。
  実アプリの該当要素は `.recast-cell`（`RecastRow`）でリキャストアイコン専用（過去配置がある時だけ表示）。
  `:not(.recast-cell)` で除外中 = 右 ≈40% はタイル無しの素の凹面。**Task 7** がリキャストをヘッダーから
  分離する際に、この列見出し帯の意匠（アイコン + ロールタグ）を設計する想定。Task 4 スコープ外。
- **Time 見出し下線**: 不採用（中央寄せ「時間 ⌄」に下線を引くと宙に浮く）。hd-hash 採用で check 5 充足。
- **thead bg のアダプト**: mockup はせり出した明るい金属リップ。実アプリは `#timeline-header-inner` が
  40px 帯そのもので上下余白が無くリップとして読めない → 暗い凹チャンネル + 浮くタイルに翻案。
  check 1（独立タイル感）を優先した判断。
- **light**: タイル面（白）と凹チャンネル（淡グレー）のコントラストが低い。「破綻しない」レベルは確認済、
  最終調整は SP2 後（plan 準拠）。dark 固定の重い黒 rgba は `.theme-military.theme-light` で青み淡色へ上書き済。
- **`::before` clip-path が外側落ち影を切る**: notch のある角では `::after` 落ち影の一部が欠ける
  （mockup `.th` も同じ挙動）。タイル分離は暗チャンネル + ギャップ inset で担保しているので実害なし。
