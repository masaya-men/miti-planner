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

---

## Task 5 — コントロールバー（`.subtoolbar` 意匠・zone: `controlbar`）

### Step 1 — `#timeline-controls-inner` 直下の実 DOM（軍事 PC 1489px・Playwright 実測）

`#timeline-controls-inner`（`flex items-center gap-0 shrink-0 h-full w-full md:w-max md:min-w-max
will-change-transform`・実測 h27・**position:static**・`will-change:transform` で常時 containing block・
横スクロール同期対象）。外枠 `controlBarRef` = `flex-shrink-0 z-[51] h-7 relative border-b
select-none overflow-hidden bg-app-surface2 border-app-border hidden md:block`（幅 1155・**scroll しない**）。
fixture では inner 幅 1432 > outer 1155 = 内容が横あふれ（scroll 同期が効く）。

直下の並び（実測）:
| # | 要素 | 中身 |
|---|---|---|
| 0 | Area A `div.w-[calc(var(--col-header-chunk-w)-1px)]`（w169） | 折りたたむ button（`h-6 w-full`） |
| 1 | `div.w-[1px].h-3`（divider） | — |
| 2 | Area B `div.md:w-[calc(var(--col-mechanic-w)-1px)]`（w199） | AA wrapper `div` + `div.w-[1px].h-3` + メモ wrapper `div` |
| 3 | `div.w-[1px].h-3` | — |
| 4 | Area C `div.md:w-[calc(var(--col-counter-w)-1px)]`（w99） | 罫線 / PiP / リキャスト button |
| 5 | `div.w-[1px].h-3` | — |
| 6 | Area D `div.md:w-[calc(var(--col-counter-w)-1px)]`（w99） | Undo / Redo / クリア button |
| 7 | `div.w-[1px].h-3` | — |
| 8.. | `JobPickerRow` = `[data-member-id]` div ×8（Task 6 の `.cj`） | — |

**button の実クラス / ON 状態フック**（`aria-pressed` / `data-state` は**全て無い**）:
| ボタン | セレクタ手掛かり | OFF | ON（軍事ランプ点灯条件） |
|---|---|---|---|
| 折りたたむ | `button:has(> svg.lucide-text-align-justify)`（`h-6 w-full rounded-md`） | `text-app-text` | **button 自身に `bg-app-toggle text-app-toggle-text`**（`!hideEmptyRows`） |
| AA 追加 | `button:has(> svg.lucide-sword)`（`flex-1 h-full`） | 親 div `text-app-text` | **button の親 div に `bg-app-toggle`** + button `text-app-bg`（`isAaModeEnabled`）※単クリックはポップオーバーを開くだけで ON にならない |
| メモ | `button:has(> svg.lucide-pencil)`（`flex flex-1 h-full`・親は Tooltip ラッパ） | — | **button の祖父 div に `bg-app-toggle`** + button `text-app-bg`（`isMemoMode`） |
| 罫線 | `button.p-1.rounded:has(> svg.lucide-rows-3)` | `text-app-text-muted` | **button に `text-app-text`**（`showRowBorders`）※`bg-app-toggle` 無し |
| リキャスト | `button.p-1.rounded:has(> svg.lucide-clock)` | `text-app-text-muted` | **button に `text-app-text`**（`recastRowVisible`・既定 ON） |
| Undo/Redo | `button.p-1.rounded:has(> svg.lucide-undo-2 / -redo-2)` | `text-app-text-muted cursor-default` + `disabled` | `text-app-text`（実行可能時） |
| クリア | `button.p-1.rounded:has(> svg.lucide-trash-2)`（`flex gap-0.5`・中に ChevronDown も） | 常時 `text-app-text` + `hover:text-red-400` | — |
| PiP | `button.p-1.rounded:has(> svg.lucide-picture-in-picture-2)`（`pipSupported` 時のみ） | `text-app-text-muted` | `text-app-blue`（本タスクの ON セレクタ対象外） |

- キートップ 6 個の共通フック = **`button.p-1.rounded`**（トグルは `rounded-md` なので当たらない）。
- 罫線 / リキャスト の ON フックは `.text-app-text`（OFF = `.text-app-text-muted`）だが **Undo/クリアも
  `.text-app-text` を持つ** → ON 意匠のセレクタは必ず `:has(> svg.lucide-rows-3 / -clock)` で絞る。
- divider は `div[class~="w-[1px]"][class~="h-3"]`（`bg-app-text` / `dark:bg-app-text/25` を持つ 1px 片・
  計 5 本。うち 1 本は Area B 内の AA\|メモ 間）。

### プレート背景のアプローチ — `#timeline-controls-inner` を直接 + 外枠も `:has()`

- **`#timeline-controls-inner` に本体グラデ**（`--ms-raised-hi → --ms-raised 60% → --ms-raised-lo`）+
  inset 影。`md:w-max` で内容幅ぴったり・scroll で translateX されるが、fixture では inner 幅 > outer 幅で
  常に可視域を覆う。
- **外枠 `controlBarRef` にも同グラデ** = `div:has(> #timeline-controls-inner)`（`#timeline-controls-inner`
  は id 一意 → このセレクタも一意。Task 4 の `div:has(> #timeline-header-inner)` と同じ堅牢性）。
  内容が狭い時に inner の右に出る素の `bg-app-surface2` を潰す保険 + 下端 `border-b` を鋼色へ recolor
  （mockup `.subtoolbar::after` の渋い鋼ライン相当）。
- **`Timeline.tsx` は無改変**。`data-milspec-controlbar` は不要と判断（外枠の `border-b` は recolor で
  済み、`div:has(> #timeline-controls-inner)` が既存パターンで十分安定）。ブリーフが禁じた
  `[data-timeline-root] > div:has(...)` の子結合子つき脆弱版は使っていない。

### box model を変えずに各ボタン群を restyle

- **Area div の幅・button の box は一切不変**。追加した幾何は 3 トグル button の `position: relative`
  （ランプ `::before` の基準・AA/メモ button は素で static・offset なし = レイアウト影響ゼロ・Task 4 の
  RAW/TAKEN と同じ作法）と `border-radius: 1px`（面取り角・box に不影響）のみ。
- **面取り / 枠は `box-shadow: inset 0 0 0 1px …` の擬似リング**で表現（border 追加は auto 幅ボタンを
  太らせるため不可）。
- **ロッカートグル（折りたたむ/AA/メモ）** = 沈んだスロット: 2 レイヤー背景（スペキュラ帯 +
  `--ms-recess-hi → -lo`）+ `inset` 面取りリング + `inset 0 2px 3px` の凹み影。左端に SP1 `.milspec-lamp`
  複製の `::before`（既定は暗いレンズ）。ON（`.bg-app-toggle` 有）= シアン地 + `inset 0 -2px 0
  var(--ms-cyan)` の下線 + `inset` シアングロー + ランプ点灯 + `color: var(--ms-cyan)`（span / lucide
  currentColor も追従）。
  ※基底ルールが `:has(> svg…)` で詳細度 (0,1,3,2) を持つので **ON セレクタにも `:has(> svg…)` を付けて
  (0,1,4,2) で上回らせる**（当初これを怠って ON が基底に負けた — 反復 1 で修正）。
- **キートップ（罫線/PiP/リキャスト/Undo/Redo/クリア）** = `button.p-1.rounded` に `--ms-btn-sheen` +
  `linear-gradient(177deg, --ms-raised-hi, --ms-raised 45%, --ms-raised-lo)` + `inset` フレームリング +
  `inset 0 1.5px 0 var(--ms-edge-hi)`（上辺の明ルーフ）+ `inset` 下墨 + 外側 `0 1px 0` 接地影 +
  `filter: var(--ms-btn-cast)`。`:hover` = `brightness(1.12)` + シアン、`:active` = `filter:none` +
  沈み影、`:disabled` = `opacity:0.4` + フラット。
  ON（罫線/リキャスト・`.text-app-text` + アイコン絞り）= `inset 2px 0 0 var(--ms-cyan)` の左バー +
  シアンアイコン。クリア `:hover` = `--ms-red` の左バー + 赤アイコン。
- **divider** = `div[class~="w-[1px]"][class~="h-3"]` を `background: rgba(0,0,0,0.5)` +
  `box-shadow: 1px 0 0 rgba(255,255,255,0.07)`（溝の受光側の右壁・box-shadow はレイアウト不変）。
  1px 幅では mockup の `linear-gradient(90deg, …0 1px, …1px 2px)` は明側 1px しか描画されないため、
  暗線 + 隣接ハイライトの構成に読み替え。
- **ステンシルデカール** = `div:has(> #timeline-controls-inner)` の `::before`（`.hash` 斜線束・
  `repeating-linear-gradient(-58deg…)`・右上・opacity 0.4）と `::after`（`.sc` 固定英字
  "ENGAGEMENT TIMELINE CONTROL · SEC-2"・7px Share Tech Mono・右下・opacity 0.32）。外枠に置くので
  scroll しても貼り付く。

### Task 4 レビュー Minor の fold-in（コントローラー承認済）

- **#1**: `.theme-military .milspec-app #timeline-header-inner` ルールに **`isolation: isolate;` を追加**。
  Task 4 のタイル面 `::before { z-index:-1 }` が `will-change-transform`（Tailwind）由来の stacking
  context に暗黙依存していたのを CSS 側で自己完結化。
- **#3**: Task 4 の `#timeline-header-inner > *:nth-child(odd/even)` 切り欠きルールのコメントに
  **契約行を追記**（「先頭6セル固定・phase が child 1・ここに列挿入で面取り/ハッチがズレる・recast は
  末尾で `:not(.recast-cell)` 除外」）。

### ハーネス / compare.mjs の改善（本タスクで実施）

- `compare.mjs captureMock`: `#stage.trace` クラスを除去してから撮るように（`.stage.trace .app` が
  `opacity: 0.72` で参照写真 `allagan-dark.png` を透かし、旧アプリ UI の文字がゴーストで写り込んでいた
  = Task 2〜4 の mock スクショも汚染されていた既知外バグ）。
- `compare.mjs captureApp`: zone が `controlbar` / `jobchips` のとき **折りたたむ ON + 罫線 ON** に
  しておく（mockup が `.cb-tgl.on` / `.cb-ico.on` を描いているため・store 注入・製品コード不変）。
- `ZONES.controlbar` は既に `{ mock:'.subtoolbar', app:'#timeline-controls-inner', outer:true }`
  = placeholder ではないので変更不要。

### 視覚突き合わせ（`compare.mjs controlbar` + 自前 iterate スクリプト・dark/light + scrolled）

反復（compare PNG + 4〜7x nearest 接写を Read）:
1. スターター CSS → ON トグル（折りたたむ）が基底ルールの `:has()` 詳細度に負けてシアン化せず。
   → ON セレクタに `:has(> svg…)` を付与して修正。
2. キートップが recessed トグルと同トーンで「浮いた」感が弱い（mock は上辺が明るく強く浮く）。
   → `inset 0 1.5px 0 var(--ms-edge-hi)` の明ルーフ + raised グラデ 3 stop + 下墨強化。再撮影 → キートップが浮く。
3. divider が明側 1px しか出ず不可視気味 → 暗線 + `box-shadow` の隣接ハイライトに変更。
4. ステンシルがジョブセル（Task 6・現状は broken-image）に被る → opacity 0.5→0.32 / 0.4 に落として「etch」に。
5. light: 折りたたむ ON ランプが light 基底 `::before`（灰）にソース順で負けて点灯しない
   → light 用 ON `::before` 上書きを追加。

5 チェック最終:
| # | チェック | 判定 |
|---|---|---|
| 1 | バー全体 = raised プレート + 下端に渋い鋼ライン | ✓ inner + 外枠に raised グラデ・`border-b` を鋼色 recolor |
| 2 | 折りたたむ/AA/メモ = ロッカートグル、ON のものだけシアン下線 + 左ランプ点灯 | ✓ 沈んだスロット + 面取りリング・折りたたむ ON でシアン下線 + `.milspec-lamp` 相当点灯・AA/メモ OFF は暗レンズ |
| 3 | 罫線/リキャスト/Undo/Redo/クリア = 押せるキートップ（枠なしでない）、ON はシアン inset | ✓ `--ms-btn-sheen` + フレームリング + 明ルーフ + 接地影・罫線/リキャスト ON で `inset 2px 0 0` シアンバー |
| 4 | divider = V 断面スジ彫り | △ 1px 幅制約（mockup も同じ）で「暗線 + 右隣ハイライト」に読み替え。深い V ではないが溝として読める |
| 5 | 右側の空きにステンシルデカール | △ 実アプリは表が幅いっぱいで mockup のような右空きが無い → 外枠右端に opacity 0.32 で etch（ジョブセルに薄く重なる） |

### 残差（→ Task 10 masaya / SP2 後 / Task 6）

- **ステンシル / hash がジョブセルに重なる**: mockup は固定キャンバスで `.cb-e` の右に空きがあり
  そこに `.sc` / `.hash` が載る。実アプリは `#timeline-controls-inner` が `w-max` で
  JobPickerRow の右に空きが出ない（8 人時は横あふれ）。Task 2/3 の「表が幅いっぱい」構造差と同種。
  外枠固定 + opacity 0.32 で「金属に薄くエッチ」として最小化。masaya が「空きが出る狭幅時だけ表示」等を
  望むなら Task 10。
- **バー高 27px vs mockup 46px**: `controlBarRef` の `h-7` は不変（レイアウト契約）。キートップ・
  トグルの立体感が mockup より圧縮される。CSS だけでは不可。
- **ジョブチップ `.cj`（JobPickerRow）は未着手** = Task 6。現状は素の role グラデ + broken-image
  アイコン（dev は `VITE_MEDIA_PROXY_BASE_URL` 無しでアイコン 404）。
- **divider が深い V にならない**: 1px 幅の制約（mockup `.cb-div` も width:1px で同じ）。
- **AA/メモの ON 実機確認**: AA は単クリックがポップオーバーを開くだけで `isAaModeEnabled` に
  ならないため、視覚突き合わせでは 折りたたむ ON でトグル ON 意匠を代表確認。CSS セレクタ
  （`.bg-app-toggle button:has(> svg.lucide-sword/pencil)`）は 折りたたむ と同じ機構で配線済み。
- **light**: recess トグルとプレートのコントラストが低い（mockup light `--recess-*` も同傾向）。
  「破綻しない」レベル確認済・最終調整は SP2 後。dark 固定 hex（ランプ 3 色・ON グラデの重い黒）は
  `.theme-military.theme-light` で上書き済。

---

## Task 6 — 軽減バー（工業パイプ） + アイコンチップ + ジョブチップ `.cj`（zone: `mitbar` / `jobchips`）

### 製品コード変更（inert フックのみ・spec §3.3(c)）

`MitigationItem`（`Timeline.tsx`）に **値なし** `data-*` を 2 個:
- 効果棒 div（`mitigation.duration > 1` の `<div className="absolute top-3 w-1.5 ... border-x pointer-events-auto cursor-pointer" + colors.bg/border/shadow>`・~620）→ `data-mit-bar=""`
- 24px アイコン枠の **内側** div（`<div className="w-full h-full bg-black/50 overflow-hidden rounded border border-app-border ...">`・~569。虚アイテム時は `bg-transparent border-none shadow-none` が付く）→ `data-mit-icon=""`

`MitigationItem` は **非 export**（`const MitigationItem = React.memo(...)`）→ vitest は `<Timeline>` を happy-dom で実 render し、fixture（プラン選択済 + war ジョブ MT + `duration>1` の軽減 1 個）で `[data-mit-bar]` / `[data-mit-icon]` を `querySelector`（`src/components/__tests__/MitigationItem.milspec.test.tsx`）。firebase/auth・firestore・app-check は最小スタブ（Proxy）でモック、i18n はスタブ。実 `MitigationItem` の出力を検証（コンポーネント自体はモックしない）。

### 標準不変（`standard-invariance.mjs`）

`data-mit-bar` / `data-mit-icon` は骨格正規化が data 属性名を拾うため **ベースライン差分あり**。
差分の内訳（`--save` 前に確認・quote は task-6-report.md）:
- 骨格 **2620 行 → 2620 行**（不変）・`rows 31` / `vScrollbar 0` 不変・rect 差分 0・class/順序 変化なし。
- 変わった行 = fixture の軽減 7 個ぶんの `div` → `div [data-mit-icon=]`（icon 枠）と `div` → `div [data-mit-bar=]`（効果棒）**のみ**（dark/light 各 14 行）。
→ spec §3.3(c)「inert な `data-*`（標準 CSS が拾わない）」に該当 → `--save` で再ベースライン。

### ロール色マップ（`getMitigationColorClasses` Timeline.tsx:140-203 の実戻り値）

| ロール / 状況 | `colors.bg` クラス | `--ms-mb-col` |
|---|---|---|
| tank（pld/war/drk/gnb） | `bg-blue-500/80` | `--ms-cyan` |
| healer（whm/sch/ast/sge） | `bg-green-500/80` | `--ms-green` |
| melee dps（mnk/drg/nin/sam/rpr/vpr） | `bg-red-500/80` | `--ms-orange` |
| ranged dps（brd/mch/dnc/blm/smn/rdm/pct） | `bg-orange-500/80` | `--ms-orange` |
| light_party MT グループ（MT/H1/D1/D3） | `bg-cyan-500/80` | `--ms-cyan` |
| light_party OT グループ | `bg-amber-500/80` | `--ms-orange` |
| ジョブ無し / 不明 | `bg-slate-400/80` | `--ms-text-muted`（glow なし） |

属性 2 個セレクタ `[data-mit-bar][class~="bg-blue-500/80"]`（`[class~=]` = escape 不要・Task 5 `.cb-div` と同方式）で `--ms-mb-col` / `--ms-mb-glow` を分岐。棒の `colors.bg` 実色は base ルール `.theme-military .milspec-app [data-mit-bar]`（specificity (0,3,0) > utility (0,1,0)）が `background` 上書きで隠す。**`!important` 不使用**（Task 5 と同じ）。

### `.cj` を実測対象に触れずに適用

`JobPickerRow.tsx:47-58` の外側 `[data-member-id]` は `useMeasuredMemberLayout`（`Timeline.layoutHooks.ts:38`）が `offsetLeft + computed(paddingLeft)` と `offsetWidth` を読んで**全軽減バーの列 x**を決める → 幅・padding・border 幅は不変。
- 内側の `<div className="flex items-center justify-center w-full h-full rounded cursor-pointer ...">`（`:74`）を `[class~="cursor-pointer"]` で拾い、`border: 1px` の 4 色面取り + 金属グラデ + `0 0 0 1px --ms-cham-silhouette`。`box-sizing:border-box` + `w-full h-full` なので **外側の box は不変**（内側の content が 2px 縮むだけ・24px 固定アイコンには影響なし）。
- 外側 `[data-member-id]` は既存 `border-r` の**色のみ** `--ms-cham-silhouette` へ（幅不変）。
- `military-smoke` step 8（横スクロール同期）/ step 2（ドラッグ）で列 x 不変を確認（PASS）。

### 視覚突き合わせ（`compare.mjs mitbar` / `compare.mjs jobchips` + 4x DPR 接写）

`compare.mjs` ZONES 更新: `mitbar` app = `[data-mit-bar]`（`captureApp` が hideEmptyRows OFF にして背の高い棒 1 本の container を clip 接写）/ `jobchips` app = `#timeline-controls-inner [data-member-id]`（8 セルを束ねた矩形を clip）。

反復:
1. スターター CSS（プラン Step 5/6/7 の値）→ 効果棒の金属管シェーディングが 6px 幅 + dark-on-dark で埋没、ID 帯の glow だけが見える。
2. 是正: 棒グラデを明るく強コントラストへ（`#10151a → #505c68 → #10151a`）+ `inset 1px 0 0 rgba(255,255,255,0.12)`（左受光）/ `inset -1px 0 0 rgba(0,0,0,0.6)`（右陰）で管の丸みを出す。border-x の色を `#05080b` に。フランジを 12×5px・上辺ハイライト付きに。light も同構造で淡色化。
3. 4x DPR 接写で確認: icon チップ枠（面取り + 影 + 角丸 1px）✓ / 効果棒 = 左受光 + 右陰 + シアン発光コア ✓ / 下端フランジ（小さい金属キャップ・上辺明）✓ / ジョブチップ = 4 色面取り + 金属グラデ + 実ジョブアイコン ✓（computed style で `--ms-cr-t/l/r/b` の 4 色を確認）。

最終所見（4 チェック）:
| # | チェック | 判定 |
|---|---|---|
| 1 | 効果棒 = 工業パイプ（金属管シェーディング + 中心ロール色 ID 帯 + 下端フランジ） | ✓ 3 要素とも描画。管シェーディングは 8px 幅ゆえ控えめ（mockup の 6px も同傾向） |
| 2 | アイコン = 金属チップ枠（面取り + 影） | ✓ `--ms-cr-*` の上下左右ベベル + `--ms-cham-silhouette` + `0 1px 2px` 落ち影・角丸 1px |
| 3 | 競合中の軽減は琥珀リング（機能色・不変） | ✓ リング（`ring-2 ring-amber-400`）は **外側** div にあり CSS は内側 `[data-mit-icon]` のみ触るので不変（fixture に競合無し・構造で確認） |
| 4 | ジョブチップ = 面取り 4 色ボーダー + 実ジョブアイコン | ✓ 内側 `.cursor-pointer` div に 4 色面取り + 金属グラデ・実 FFXIV アイコン維持 |

### 残差（→ Task 10 masaya / SP2 後の統一調整）

- **`.mit-lbl` のジョブコードテキストは不採用**（spec §13・SP2 後判断）。実 DOM は 24px スキルアイコン +
  ターゲットジョブバッジ。mockup の「小さい dark ラベルチップ + テキスト」は入れず、既存アイコンを
  金属チップ枠化するに留めた。
- **効果棒の実効幅 8px（`w-1.5` 6px + `border-x` 1px×2）vs mockup 6px**: `border-x` を消すと棒自身の
  中央寄せ計算（`transform: translateX(-50%)` + `left: calc(50% + overlapOffset)`）がずれるため撤去不可
  （Global Constraint）。金属管シェーディングは幅ぶん控えめ。
- **ジョブチップが列幅いっぱい（53〜151px）vs mockup 27×17 の小チップ**: 外側 `[data-member-id]` は
  実測対象で幅を変えられない。内側 `.cursor-pointer`（`w-full h-full`）に面取り + グラデを載せた結果、
  隣接チップの境界が密着し「連続した縞バー」寄りに見える（Task 4 のヘッダータイルと同じ密度感）。
  `--ms-cham-silhouette` の外側 1px 影で個々のタイルは分離して読める。masaya が「チップ間ギャップ」を
  望むなら Task 10（内側に margin を付けると `w-full` で右にオーバーフローするので別手法が要る）。
- **ジョブチップ上端の細い青線**: 外側セルの既存 `shadow-[inset_0_1px_0_rgba(37,99,235,0.5)]`
  （tank=青 / healer=緑 / dps=赤・ロールインジケータ）。mockup の `.role-tag` と同種の機能色なので残置。
- **light**: 金属グラデ / 重い黒 rgba を淡い金属グレー（`#7c8794`〜`#d4dce3` 等）へ上書き済。
  「破綻しない」レベル・最終調整は SP2 後。`--ms-cr-*` / `--ms-cham-silhouette` は dark/light 両定義済で
  面取りは自動追従。

---

## Task 7: リキャスト行の独立（軍事モード限定の構造変更）

### 実装の要点

PC 軍事モード（`isMilspecTable = themeStyle === 'military' && !isMobileTimeline`）のときだけ
`<RecastRow>` を `#timeline-header-inner` の外へ出し、列見出しと表本体の間の独立した帯
`[data-milspec-recast-band] > #timeline-recast-inner`（+ 左ラベル `.milspec-rc-label`）にマウントする。
`RecastRow.tsx` / `RecastIcon.tsx` / `syncRecastRow` / 座標計算は**一切変更なし**。

- 左ラベルは `width: var(--col-member-start)`（= PHASE+LABEL+TIME+MECHANIC+RAW+TAKEN）で 6 列ぶんを
  占有するので、続く `.recast-cell` が自動的にメンバー列と同じ x に並ぶ。
  実測（`military-smoke` step 11）で **8 メンバー全て dx 0.0px**。
- `padding-left` は mockup の固定 151px ではなく `calc(var(--col-header-chunk-w) + 8px)`。
  mockup の 151px は「機工列の始まり（142px）+ 9px」なので、実アプリでも機工列ヘッダー（`pl-2` = 8px）の
  文字左端に揃う式にした（可変列幅に追従する）。

### スターター仕様からの是正（ブリーフのバグ）

ブリーフの雛形は `recastBandInnerRef` を **内側の `#timeline-recast-inner` 自身**に付けていたが、
`handleScrollSync` は `ref.current.querySelector('#' + id)` で内側を探す契約（`headerRef` / `controlBarRef` は
どちらも**外枠**）。内側要素に ref を付けると自分自身を見つけられず `firstElementChild`
（= `.milspec-rc-label`）にフォールバックし、**ラベルだけが translateX される**（帯の中身は追従しない）。
→ `recastBandRef` を**外枠**に付け替えて解消。`syncPadding` も外枠に当てる形で header/controls と統一。
`military-smoke` step 11 の transform 一致 assert がこの回帰を捕捉した（初回 FAIL → 修正後 PASS）。

### 視覚突き合わせ（`compare.mjs recast`）

`compare.mjs` に `recast` ゾーン用フックを追加: リキャスト帯は**スクロール位置 = 現在時刻**なので
`scrollTop 0`（戦闘開始前）では全アイコンが `--cd-display:none` で消え、モック（7 セルにアイコン）と
突き合わせられない。可視アイコン数が最大になる scrollTop を 50px 刻みで走査してから撮る（store 不変）。

反復:
1. 初回 → アイコン 0 個（上記のスクロール問題）。フック追加で 4/7 個可視の位置（scrollTop 450）で再撮影。
2. 是正 A: デカール `content: "RECAST / "` の**末尾スペースが生成コンテンツで詰まる** → `"RECAST /"` +
   `padding-right: 0.5em` に変更（mockup の「スラッシュの左右に空き」を再現）。
3. 是正 B: `.recast-cell` の `border-right`（`index.css` 由来）で**縦の仕切り線が出ていた**が、
   mockup の `.recast-row` は仕切りを一切描かない「1 枚の綺麗な沈みプレート」→ 幅は保ったまま
   `border-right-color: transparent`（レイアウト不変）。
4. 是正 C: ラベルの体感輝度がモックより暗い → `opacity: 0.55 → 0.62`。

最終所見（3 チェック）:
| # | チェック | 判定 |
|---|---|---|
| 1 | 列見出しの下・表本体の上の独立した帯（沈んだ recess プレート） | ✓ 実測 band top 241.8（header inner bottom 240.8 / body top 279.8）。縦グラデを 1px 刻みで採取し mock と一致（上 rgb(38,46,55) → 下 rgb(19,26,33)・中央がやや明るい金属の照り） |
| 2 | 左「RECAST / リキャスト」ラベルが 6 列ぶんを占有・メンバーセルが表の列に揃う | ✓ label 実測 w=570px = `--col-member-start`。8 メンバー全て `[data-member-id]` と dx 0.0px |
| 3 | 各アイコンが円形 + クールダウン円グラフ（clockswipe）+ 残秒 | ✓ 円形金属ソケット（radial-gradient + inset ベゼル）/ `--cd-angle` の conic 暗幕を円形化 + mockup 色 rgba(4,6,9,0.84) / 残秒をアイコン外・下へ（シアン + glow） |

### 残差（→ Task 10 masaya / SP2 後の統一調整）

- **`.recast-cell` の `padding-left` / `justify-content: flex-start` は mockup 非追従（意図的）**。
  mockup `.rc-cell` は `justify-content: center` だが、実アプリの
  `padding-left: calc(var(--col-member-pad-x) + 2px)`（`index.css:1656`）は
  「リキャストアイコンの x = `MitigationItem` の絶対配置 left」を成立させている実測値。中央寄せにすると
  本文の軽減バーと縦のラインが揃わなくなるため**列整合を優先**した。結果、アイコンはセル左寄せ。
- **帯の高さ 38px vs mockup 34px**: 実アイコンが 24px（mockup は 19px）で、残秒をアイコン外・下に
  出す（mockup `.rc-num { bottom: -7px }`）ぶんの余白が要るため。比率はほぼ同じ（34/19 vs 38/24）。
- **撮影上の 1px 明線**: `recast-app.png` の row 0 が rgb(70,88,100) と明るいが、これは帯自身ではなく
  **ヘッダー外枠の `border-bottom: 1px rgba(150,190,205,0.28)`**。帯の top が 241.797 と端数のため
  スクリーンショットの clip が y=241 に丸められて 1px 混ざる撮影アーティファクト
  （帯の `border-top-width` は computed で `0px`・背景は rgb(38,46,55) から始まることを実機で確認済）。
- **列折りたたみ時（Shift+P / Shift+L）**: ラベル幅 `--col-member-start` は非折りたたみ前提の式なので、
  フェーズ/ラベル列を折りたたむとヘッダーのメンバー列だけが左へ寄り、帯とはズレる。ただし
  コントロールバー（`--col-header-chunk-w` 固定）と本文（`[data-member-id]` 実測）も同じ前提なので、
  **帯はコントロールバー/本文と一致する側**に揃っている（＝ズレるのはヘッダーのみ・既存挙動）。
- **`text-transform: uppercase` は要素に掛けていない**: mockup `.rc-label` は uppercase だが、
  en ロケールでは i18n ラベルが `Recast` なので掛けると「RECAST / RECAST」と重複表示になる。
  デカール側の `content` を大英字リテラルにして ja では mockup と同一表示（RECAST / リキャスト）にした。
- **light**: 帯の地色は `--ms-recess-*`（dark/light 両定義済）で自動追従。dark 固定 hex を使う
  アイコンのソケット/暗幕だけ淡色へ上書き済。最終調整は SP2 後。

---

## Task 8: 計器スクロールバー（表 + サイドバー共有）

### Step 1 の実測（重要）

- **`grep -rn "scrollbar-width" src/`**: ヒットは `src/index.css:537`（`.no-scrollbar`・スコープ外）と
  `src/styles/housing.css` 7 箇所（全てスコープ外）のみ。
  **`.timeline-scroll-container` にも `.milspec-tree-scroll`（MIL-SPEC サイドバーのスクロール枠・
  `MilspecContentTree.tsx:79`）にも `scrollbar-width` / `.no-scrollbar` は付いていない**
  → Chrome の `::-webkit-scrollbar` スタイリングは両方で有効。除去作業は不要。
- **「33px スクロールバー」ミステリー（Task 1 の申し送り）は再現せず**。
  fixture ハーネス（headless）+ headed 実 Chrome の両方で計測した現状:
  - 標準モード: `.timeline-scroll-container` の `offsetWidth - clientWidth`（縦バー幅）= **0**
    （`src/index.css:1629` の `::-webkit-scrollbar:vertical { width:0; display:none }` が効いている）
  - 軍事モード（Task 8 前）: **同じく 0**。military.css には `::-webkit-scrollbar` ルールが 1 個も無かった
    （`grep webkit-scrollbar src/styles/military.css` はコメント 1 行のみ）。
  - `.custom-scrollbar`（`Timeline.tsx:3135` のクラス）は **CSS 定義が存在しない**（`.custom-scrollbar-thin` だけ実在）。
  結論: `index.css:1629` を上書きしているものは無く、Task 1 の「33px」は環境アーティファクトか別要素の誤計測。
  END 状態の設計（軍事 PC = 14px / 標準 = 0 / モバイル = 不変）はそのまま成立。
- **headless Chromium は overlay 型スクロールバーで `::-webkit-scrollbar` を幅0で返す**（既知）。
  headed 実 Chrome（`channel: 'chrome'`）は描画する（横バー実測 `hDiff` = 8px → Task 8 後 14px）。

### 実装（CSS のみ・`src/styles/military.css` SP2 節末尾に追記）

- `src/index.css:1629` は**変更せず**、`.theme-military .milspec-app .timeline-scroll-container::-webkit-scrollbar:vertical`
  （詳細度 0-4-1 vs 0-2-1）で `width:14px; display:block` に上書き。横バーも 14px。
- track/thumb は mockup `.tbody` / `.ws-screen::-webkit-scrollbar`（1220-1257）準拠。
  縦=目盛り 180deg、横=目盛り 90deg。thumb は `border:3px solid transparent` + `background-clip:padding-box`
  でブラシメタルの中央帯を作る。hover でシアン発光。
- **目盛りピッチ一致**: `--ms-gauge-ticks`（`repeating-linear-gradient` 6px minor / 24px major・180deg）を
  `.theme-military .milspec-app` に 1 箇所定義し、**縦 track + ヘッダー cap + 帯 cap の 3 箇所で共有** →
  ピッチが構造的に drift しない。
- **静的目盛りキャップ**（mockup `.gauge-cap` 1208-1215）:
  `div:has(> #timeline-header-inner)::after` と `[data-milspec-recast-band]::after`。
  どちらの `::after` も Task 4（`div:has(> #timeline-header-inner)` は `border-bottom-color` のみ）/
  Task 7（`[data-milspec-recast-band]` は直接指定のみ）とも**未使用**だったのでそのまま使えた。
  新規 `<span>` 追加は不要。両外枠に `position: relative` を CSS で付与（Timeline.tsx は触らない）。
  これらの外枠は `overflow:hidden` かつ `syncPadding` が `paddingRight = バー幅` を当てる非スクロール域
  なので、`right:0; width:14px` の cap はちょうどスクロールバー溝の真上に載る。
- サイドバー共有: `.theme-military .milspec-app .milspec-tree-scroll::-webkit-scrollbar`（mockup `.phases` 1260-1275・
  やや細身 10px・thumb border 2px）。`.milspec-tree-scroll` は `.milspec-app` 配下
  （`MilspecLayout.tsx:51` の `<div class="milspec-app">` → sidebar zone）なので同じスコープで届く。
- light: `--ms-gauge-tick-minor/major` / `--ms-gauge-track-fill` / `--ms-gauge-thumb-fill` を
  `.theme-military.theme-light .milspec-app` で淡い金属グレーへ再定義（縦 track・corner・cap は自動追従）。
  横 track・thumb:horizontal・hover・サイドバー track だけ個別上書き。corner は `var(--ms-recess-lo)`（両定義済）。
  最終トーン調整は SP2 後（Task 3-7 と同じ「破綻しない」レベル）。

### Step 4（`themeStyle` 変化時の `syncPadding` 再実行）— Timeline.tsx 変更は**不要**

headed 実 Chrome で標準 → `useThemeStore.setThemeStyle('military')` トグルを実測:
`#timeline-header-inner` 外枠 / `#timeline-controls-inner` 外枠 / `[data-milspec-recast-band]` の
`paddingRight` が **3 つとも 14px** に更新された（トグル前は縦バー 0px なので 0px）。
理由 = `Layout.tsx:579` が `themeStyle==='military' && !isMobile` で標準 JSX ↔ `MilspecLayout` を
丸ごと差し替える → Timeline が**再マウント**し `syncPadding` の `useEffect`（`Timeline.tsx:1526-1541`・
Task 7 で deps を `[isMilspecTable]` 化済）が新規マウントで発火して測り直す。
→ **新しい `useEffect` は追加しない**（ブリーフの「Task 7 が既にカバーしているなら追加するな」に該当）。

### ハーネス

- `standard-invariance.mjs`: exit 0。**標準の `vScrollbarWidth` = 0 を維持**（`.theme-military .milspec-app`
  スコープが標準に漏れていない）。skeleton / rects もベースライン一致。
- `military-smoke.mjs`: step 13 を追加。
  - 機械確認（headless 可）: ヘッダー/帯の外枠が `position:relative`・目盛りキャップ `::after` が
    幅 14px 近傍 + `repeating-linear-gradient`（目盛り）を持つ。→ **PASS**
  - 縦バー幅 + `syncPadding` の `paddingRight` 一致: headless は overlay で幅0のため **WARN スキップ**
    （「実機 Chrome / headed で確認」とログ）。非0の環境では 14px 近傍 + header/controls/recast の
    paddingRight が ±1.5px で一致することを hard assert。
- `npm run build`: exit 0。

### 視覚突き合わせ（Step 8・headed 実 Chrome）

`compare.mjs scrollbar` を **headed 実 Chrome**（`_fixture.mjs launch({ headed:true })` →
`chromium.launch({ headless:false, channel:'chrome' })`）で撮影。
**この環境では headed Chrome が `::-webkit-scrollbar` を描画した**（実測縦バー幅 14px）。
= 「実機確認待ち・Task 10 で必ず確認」ではなく、headed で意匠を確認できた。

- ゾーン矩形: ヘッダー外枠 top 〜 scroll container bottom の右端 60px を縦ストリップ clip
  （mock は `.table` の右端 60px）。
- app 側スクショ（`scrollbar-app.png`）で確認:
  1. **縦バー = 目盛り（minor 6px シアン細線 + major 24px 明線）+ ブラシメタルの thumb**。
     thumb は上部に金属の照りの帯として描画。hover でシアン（スクショは非hover）。→ mock `.tbody` と一致。
  2. **横バー = 同意匠を 90°**。strip 下端にシアンの縦目盛り + 金属 thumb。→ mock `.ws-screen` と一致。
  3. **ヘッダー / リキャスト帯の右端キャップとバー目盛りが縦に連続**。シアンの目盛りが
     ヘッダー帯（上 40px）→ リキャスト帯（次 38px）→ 稼働バーへ切れ目なく続く。
     ピッチは `--ms-gauge-ticks` 共有で一致。位相の微差は Task 10（下記残差）。
  4. **サイドバー**（`_probe-sidebar` で `.milspec-tree-scroll` を 160px に絞り headed 撮影）:
     10px 幅・同じブラシメタル thumb + 目盛り。→ mock `.phases` と一致。
- mock 側の目盛りは app よりやや淡く見えるが、rgba 値（0.22 / 0.42）は同一。
  app の track 背面（`.timeline-scroll-container` の濃い金属地）で目盛りが映えているだけ。破綻なし。

### 残差（→ Task 10 masaya / SP2 後）

- **目盛りの位相連続**: ヘッダー高 40px・リキャスト帯 38px はどちらも 6px の倍数でないため、
  ヘッダー cap → 帯 cap → track の境界で minor/major 目盛りの位相が飛ぶ。ピッチ（間隔）は
  `--ms-gauge-ticks` 共有で厳密一致しているが、位相合わせ（`background-position` の実 px 調整）は
  高さが確定している実機で詰める。mockup も位相までは合わせていない。
- **`::-webkit-scrollbar` の実描画確認は実機 Chrome 必須**（headless 非対応）。→ 下記。

---

## Task 9: ワークスペース外装デカール + フェーズ/ラベルオーバーレイ + 全ゾーン最終突き合わせ

### Step 2 — `.milspec-pl.h`（上端スジ彫り）追加

`MilspecWorkspace.tsx`・`.milspec-ws` の子として **1 行だけ**追加（`.milspec-hash` の直後・`.milspec-ws-screen` の直前 = mockup DOM 2127→2128→2129 と同順）:

```tsx
<span className="milspec-pl h" style={{ left: 16, right: 16, top: 6, opacity: 0.5 }} aria-hidden />
```

mockup 2128（`<span class="pl h" style="left:16px; right:16px; top:6px; opacity:.5">`）と一字一致。
`.milspec-pl.h` は SP1 実装済プリミティブ（`military.css:571-574`・V 溝: 上壁影 1px + 溝底 `--ms-pl-dark` + 下壁受光）→ **`military.css` は無改変**（ブリーフ指定どおり `.h` variant は既存）。

実測（軍事 `/miti` fixture・Playwright、computed style）:
- `position:absolute; left:16px; right:16px; top:6px; height:3px; opacity:0.5; z-index:2`
- `rect` = `.milspec-ws` 基準で x16 / y6 / w1151 / h3・`visibility:visible`・`aria-hidden="true"`
- DOM 子順 index 7（bolt×4 → sc.tl → sc.br → hash → **pl.h** → ws-screen → ws-cap → ws-note）
- 3x DPR 接写（`.compare/ext-TLzoom3x-app.png`）: WKS-07 デカールの下に細いスジ彫り溝が横断、コントロールバー天面との境界に「彫った線」として読める。mockup と同一プリミティブ・同一 inline 値なので構造的に一致。

### Step 3 — フェーズ/ラベルオーバーレイ意匠 → **Task 3 で十分・追加ポリッシュなし**

`compare.mjs` + Playwright（`.compare/ext-phaseoverlay-app.png` / dark・light）で `[data-phase-overlay]`（"Phase 1 / フェーズ1" の -90° 回転帯）を撮り mockup と突き合わせ。

**判定: Task 3（`military.css:1162-1172`）の militarize で十分。ブリーフの「本当のギャップがある時だけポリッシュ」に該当せず。**
- 帯そのものは Task 3 で `linear-gradient(--ms-recess-hi → --ms-recess-lo)` の**沈み金属面** + 枠 recolor + inset 影 = 「削り出した金属バンド」として読める。ブリーフが例示した「標準の青いフェーズタグのまま」には**なっていない**。
- 回転テキスト "Phase 1 / フェーズ1" はアプリ既定フォント。これは軍事表の**他のコンテンツテキスト全部**（攻撃名「キラーボイス」「ハードコア」、数値）と同じ扱い。ここだけ Share Tech Mono にすると兄弟のコンテンツテキストと不整合になる（デカール `WKS-07` / `RECAST /` / `RAID OPERATIONS PLOT` だけが Share Tech Mono = 意匠として正しい分離）。
- mockup の表本体にはこの「フェーズオーバーレイ帯」の対応要素が**無い**（mockup は `.td-phase` の数字セル "1"/"2"）。プラン Step 3 が言う `phase-tag` 語彙は mockup の**サイドバー**（`.phase-tag` 1368-1371）のパターンで、表本体に写すべき正典がない。
- → `military.css` 追記なし。Share Tech Mono + `--ms-stencil` 化は content-text の意匠変更なので **Task 10 masaya ゲート**に回す（下記残差 c）。

### Step 6 — 視覚突き合わせ

#### (a) `compare.mjs workspace`（mock `.workspace` / app `.milspec-ws`）

`.compare/workspace-{mock,app}.png` + 4 隅 + 上端ストリップの 1x/3x 接写（`.compare/ext-*`）+ DOM/occlusion 実測（`selfOrDescTop` / `elementFromPoint`）。

| 外装要素（mockup DOM 2124-2128） | app | 実測 | 判定 |
|---|---|---|---|
| `.bolt` tl/tr/bl/br | `.milspec-bolt` ×4 | 4 隅 5px・7×7・z4・`selfOrDescTop:true`（非遮蔽） | ✓ |
| `.sc.tl` "WKS-07"（left:16） | `.milspec-sc.tl.milspec-ws-code-l` | x16/y3・Share Tech Mono・opacity 0.5・`#7a8c9c` | ✓ |
| `.sc.br` "RAID OPERATIONS PLOT · MITIGATION ARRAY"（right:16） | `.milspec-sc.br.milspec-ws-code-r` | 右下 x1003/y648/w164・opacity 0.5 | ✓ |
| `.hash`（bottom:8 left:16） | `.milspec-hash` | 左下 x16/y643/w22・"////" 斜線束・opacity 0.5 | ✓ |
| `.pl.h`（上端スジ彫り） | `.milspec-pl.h` | **本タスクで追加**・x16/y6/w1151/h3 | ✓ |
| `.ws-cap`（右端端末キャップ） | `.milspec-ws-cap` | x1169/w14/フル高・opacity 0.55 | ✓（Task 2） |
| `.ws-note` "ROSTER 08 / 08 / FULL PARTY" | `.milspec-ws-note` | x1105/y10・Share Tech Mono・opacity 0.38・**表示は "ROSTER 8 / 8"**（ゼロ埋めなし） | △ 下記 c |

#### (b) `compare.mjs full` — 全ゾーン最終突き合わせ（mockup DOM 2088-2213 を要素単位で照合）

`compare.mjs` の ZONES に `full`（mock `.workspace` / app `.milspec-ws`・lethal 行注入）を追加。`.compare/full-{mock,app}.png`（+ `full-app-light.png`）を Read し、以下を頭から全数照合。

**注: 構造差の大前提** — mockup は `.subtoolbar` が `.workspace` の**兄弟**（別要素）。アプリは `MilspecWorkspace` が Timeline 全体（コントロールバー・ヘッダー・帯・本文）を `.milspec-ws-screen` に内包する。よって app の `.milspec-ws` 撮影にはコントロールバーも写る（mockup `.workspace` には写らない）。これは Task 2-7 で既知・機能影響なし。

| # | mockup 要素（行） | app の対応処理 | タスク | 状態 | 処分 |
|---|---|---|---|---|---|
| 1 | `.subtoolbar`（2089） | `#timeline-controls-inner` + `div:has(> #timeline-controls-inner)` raised プレート | T5 | ✓ | — |
| 2 | `.subtoolbar > .hash`（2092） | 外枠 `::before` 斜線束デカール | T5 | ✓（△ ジョブセルに薄重なり・既知） | c |
| 3 | `.subtoolbar > .sc` "ENGAGEMENT TIMELINE CONTROL · SEC-2"（2093） | 外枠 `::after` デカール | T5 | ✓ | — |
| 4 | `.cb-a > .cb-tgl.on` "折りたたむ" + `.lamp.lit.cyan`（2096） | ロッカートグル + `.milspec-lamp` 点灯 + シアン下線 | T5 | ✓ | — |
| 5 | `.cb-div` ×4（2098/2104/2109…） | `div[class~="w-[1px]"][class~="h-3"]` 暗線 + 隣接ハイライト | T5 | △（1px 幅で深い V 不可・mockup も同幅） | c |
| 6 | `.cb-b > .cb-tgl` "AA追加" / "メモ" + `.lamp`（2100-2102） | ロッカートグル（OFF 時暗レンズ） | T5 | ✓ | — |
| 7 | `.cb-c > .cb-ico.on` "行の罫線" / `.cb-ico` "リキャスト行"（2106-2107） | キートップ + ON シアン左バー | T5 | ✓ | — |
| 8 | `.cb-d > .cb-ico` 元に戻す/やり直し/`.cb-ico.danger` クリア（2111-2113） | キートップ + danger 赤 hover | T5 | ✓ | — |
| 9 | `.cb-e > .cj` ×8（2117） | `[data-member-id]` 内側 `.cursor-pointer` 4 色面取り + 実ジョブアイコン | T6 | ✓（△ 列幅いっぱい vs 小チップ・既知） | b |
| 10 | `.workspace.chan`（2123） | `.milspec-ws.milspec-chan` raised 装甲板 | T3 | ✓ | — |
| 11 | `.workspace > .bolt` ×4（2124） | `.milspec-bolt` ×4 | SP1/T3 | ✓ | — |
| 12 | `.workspace > .sc.tl` "WKS-07"（2125） | `.milspec-sc.tl.milspec-ws-code-l` | T3 | ✓ | — |
| 13 | `.workspace > .sc.br` "RAID OPERATIONS PLOT…"（2126） | `.milspec-sc.br.milspec-ws-code-r` | T3 | ✓ | — |
| 14 | `.workspace > .hash`（2127） | `.milspec-hash`（inline bottom/left） | T3 | ✓ | — |
| 15 | `.workspace > .pl.h`（2128） | `.milspec-pl.h` | **T9** | ✓ **本タスク追加** | — |
| 16 | `.ws-screen`（2129） | `.milspec-ws-screen`（沈み黒スクリーン `#0d1319→#080c11`） | T3/SP1 | ✓ | — |
| 17 | `.table`（2130・width 1192・`bg #212a33→#1d252d`・`inset 0 0 0 1px`） | **対応する中間金属フレーム無し**。app は ws-screen（沈み黒）の上に `.timeline-scroll-container`（`#141b22→#0e141a`）が直接乗る。header+帯+本文を束ねる 1px フレームも無い | — | ✗ | b |
| 18 | `.thead`（2131） | `#timeline-header-inner` + `div:has(>…)` = 暗チャンネル + 浮くタイル | T4 | ✓（mockup のせり出しリップは 40px 帯では読めず翻案・既知） | c |
| 19 | `.thead > .bolt` ×4（2132） | **パネル隅ビス無し**。Task 4 は**タイル単位の L ブラケット**（`::after` 4 レイヤー）で「組立ハードウェア」を表現。40px 帯の隅にビス 4 個は極小になるため翻案 | T4 | △（意図的翻案） | c |
| 20 | `.thead > .gauge-cap`（2133） | `div:has(> #timeline-header-inner)::after` 目盛りキャップ | T8 | ✓ | — |
| 21 | `.thead > .pl.bead.v`（2134・left:530px・TAKEN\|メンバー境界の縦ビード） | **無し** | — | ✗ | b |
| 22 | `.th.th-mini` "PH" / "LB"（2135-2136） | ヘッダータイル（折りたたみ簡略あり） | T4 | ✓ | — |
| 23 | `.th.time` "Time"（2137） | ヘッダータイル（Time 下線は不採用・hd-hash 採用） | T4 | ✓（下線は残差 c） | c |
| 24 | `.th` "Enemy Action"/"Orig. Dmg"/"Mit. Dmg" + `.hd-hash`（2138-2140） | ヘッダータイル + `:nth-child(n+4)::after` の hd-hash 斜線束 | T4 | ✓ | — |
| 25 | `.th.th-mem.role-*` ×8（jico img + EN + `.role-tag`）（2141-2148） | **メンバー列見出しの意匠無し**。軍事は recast がヘッダーから分離（T7）→ `.recast-cell` 不在・`:not(.recast-cell)` で除外 → 右 ≈40% は素の凹面。ジョブアイコン + ロールタグ帯は未設計 | T4/T7 | ✗ | b |
| 26 | `.recast-row`（2154） | `[data-milspec-recast-band] > #timeline-recast-inner` 独立沈みプレート | T7 | ✓ | — |
| 27 | `.rc-label` "Recast / リキャスト"（2155） | `.milspec-rc-label`（6 列占有・Share Tech Mono） | T7 | ✓ | — |
| 28 | `.rc-cell > .rc-icon`（--rc-angle clockswipe + img + `.rc-num`）×8（2156-2166） | `RecastIcon` 円形金属ソケット + conic 暗幕 + アイコン外下の残秒 | T7 | ✓（帯高 38 vs 34・アイコン左寄せ = 列整合優先・既知） | c |
| 29 | `.recast-row > .gauge-cap`（2167） | `[data-milspec-recast-band]::after` 目盛りキャップ | T8 | ✓ | — |
| 30 | `.tbody`（2171） | `.timeline-scroll-container` 深い沈みスクリーン | T3 | ✓ | — |
| 31 | `.tbody > .pl.v`（2172・left:142px・機工列開始の縦溝） | **無し** | — | ✗ | b |
| 32 | `.tbody > .pl.bead.v`（2173・left:530px・縦ビード） | **無し** | — | ✗ | b |
| 33 | `.mit-bar.role-*` ×12（2177-2188） | `[data-mit-bar]` 工業パイプ（金属管 + ロール色コア + 下端フランジ） | T6 | ✓（実効幅 8px vs 6px・既知） | c |
| 34 | `.mit-lbl` ×12（img + ジョブコードテキスト）（2177-2188） | `[data-mit-icon]` 24px 金属チップ枠 + ターゲットジョブバッジ。**mockup の「dark ラベルチップ + テキスト」は不採用**（spec §13） | T6 | △（意図的） | c |
| 35 | `.trow` ×N（2190-2207） | `[data-time-row]` 金属スラット行（ゼブラ + 4n 溝 + 下端 AO） | T3 | ✓ | — |
| 36 | `.trow.lethal .td-mit.red`（2192） | `> *:has(.dmg-slot.lethal)` 赤発光の凹み + 数字も赤 | T3 | ✓（強一致） | — |
| 37 | `.td.td-phase`（数字 "1"/"2"）（2190/2198） | `[data-phase-col]` + 別途 `[data-phase-overlay]` 回転帯（Task 3 で沈み金属化） | T3 | ✓（構造差: mockup は数字セル / app は凍結オーバーレイ帯・既知） | c |
| 38 | `.td.td-lbl`（2190…） | `[data-label-col]` / `[data-label-overlay]`（fixture では 0） | T3 | ✓（規則配線済） | — |
| 39 | `.td.td-time`（2190…） | 時刻セル（border-r + font-mono・Task 3 で仕切り暗色化） | T3 | ✓ | — |
| 40 | `.td.td-act`（svg atk + 名前 + svg bf）（2191…） | 機工セル。app は独自の攻撃タイプ表示（紫アイコン等）。mockup の atk/bf シールド svg は mockup 固有の装飾 | T3 | △（app 既存の攻撃表示を維持） | c |
| 41 | `.td.td-orig` / `.td.td-mit` + `.pct` span（2191…） | 元ダメ / 軽減後セル + `▼%` 表示（AnimatedDamage） | T3 | ✓ | — |
| 42 | `.td.td-mem` ×8（2190…） | メンバー列セル + `:nth-child(n+7)::after` 照準ドット | T3 | ✓ | — |
| 43 | `.ws-cap`（2210） | `.milspec-ws-cap` | T2 | ✓ | — |
| 44 | `.ws-note` "ROSTER 08 / 08 / FULL PARTY"（2211） | `.milspec-ws-note`（"ROSTER {n} / 8" + FULL/SLOTS 行） | T2 | △ 文字列 "8 / 8"（mockup は "08 / 08" ゼロ埋め）。ブリーフ制約で本タスクの tsx 変更は pl.h の 1 行のみ | b |
| 45 | `.tbody::-webkit-scrollbar` / `.ws-screen::-webkit-scrollbar`（1220-1257） | `.timeline-scroll-container::-webkit-scrollbar`（縦横・目盛り + ブラシメタル thumb） | T8 | ✓（実描画は headed Chrome で確認済） | — |

### 全ゾーン最終突き合わせ (Task 9) — 残差リスト

**(a) Task 9 スコープ内で直せるもの: 0 件**
（`.pl.h` は追加済。外装デカール 7 要素は全数 present。フェーズ/ラベルオーバーレイは Task 3 で十分。）

**(b) Task 10 masaya へ繰り越し（設計判断・複数タスク領域にまたがる）:**
- **#17 `.table` 中間金属フレーム欠落**: mockup は ws-screen(沈み黒) と本文の間に中トーン鋼 `#212a33` の `.table` 層 + 全体 1px inset フレーム。app は `.timeline-scroll-container`(`#141b22`) が沈み黒に直接乗る（より暗い）+ ヘッダー/帯/本文を束ねる枠が無い。Task 3 残差「スラットの分離感が mockup より弱い」と同根。トーン調整 or 中間層の追加は masaya 判断。
- **#21/#31/#32 縦パネルライン（`.pl.v` / `.pl.bead.v`）欠落**: mockup は機工列開始(x142) と メンバー列開始(x530) に縦のスジ彫り／ビード溝を入れ、表を「時刻・機工｜ダメージ数値｜メンバーグリッド」の 3 ゾーンに構造分割している。app の軍事表には縦の意匠グリッドが 1 本も無い。**SP2 のどのタスクにも縦グリッド/プレイヘッドの担当が無い**（Task 3 は「Task 5 で」と書いたが Task 5 は実際にはコントロールバーだった）。実装には列 x の実測（Task 6/7 と同種）が要り Task 9 の小改修ではない。
- **#25 メンバー列見出しの意匠欠落**: mockup `.th-mem` はジョブアイコン + EN + `.role-tag` カラーバー。軍事は recast 分離で `.recast-cell` 不在 → ヘッダー右 ≈40% が素の凹面。Task 4/7 いずれも「別タスクで設計」としたまま未担当。
- **#9 ジョブチップ `.cj` の幅**: 列幅いっぱい（53-151px）vs mockup 27×17 小チップ。内側要素に margin を付けると `w-full` でオーバーフロー。別手法要（Task 6 残差）。
- **#44 `.ws-note` ゼロ埋め**: "ROSTER 8 / 8" → mockup は "ROSTER 08 / 08"。`MilspecWorkspace.tsx` の文字列 1 箇所だが、本タスクの tsx 変更は pl.h の 1 行に限定というブリーフ制約のため未対応。極小。
- **Step 3 フェーズ回転テキストの Share Tech Mono 化**: プラン Step 3 が要求。ただし他のコンテンツテキストとの整合を崩すため見送り。masaya が「フェーズ名だけステンシル体」を望むなら Task 10。

**(c) SP2 後の統一トーン調整へ（各タスクの既知残差と同じ扱い・破綻はしていない）:**
- #2/#5/#18/#19/#23/#28/#33/#34/#37/#40 — 各タスクの notes 既載の翻案・トーン差。
- light: 装甲板の白タイルと沈み黒スクリーンのコントラスト（Task 3-8 共通残差）。

### ハーネス（Step 4）

| コマンド | 結果 |
|---|---|
| `node scripts/milspec-sp2/standard-invariance.mjs` | **exit 0**（skeleton 2620 行 / rows 31 / vScrollbar 0・dark/light ベースライン一致。`.milspec-pl.h` は軍事のみ mount = 標準不変） |
| `node scripts/milspec-sp2/military-smoke.mjs` | **exit 0**（13 ステップ完走・非 whitelist console エラー 0・WARN 1 = headless の `::-webkit-scrollbar` 非描画のみ） |
| `npm run build` | **exit 0**（tsc -b + tsc api + vite build + PWA 231 entries） |

### 変更ファイル

- `src/components/military/MilspecWorkspace.tsx` — `.milspec-pl.h` の `<span>` を 1 行追加（+ 説明コメント 1 行）
- `scripts/milspec-sp2/compare.mjs` — ZONES に `full` 追加 + `LETHAL_ZONES` に `'full'`
- `scripts/milspec-sp2/notes.md` — 本節
- `src/styles/military.css` — **無改変**（`.milspec-pl.h` プリミティブは SP1 実装済・フェーズオーバーレイは Task 3 で十分）
