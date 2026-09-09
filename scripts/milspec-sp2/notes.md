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
