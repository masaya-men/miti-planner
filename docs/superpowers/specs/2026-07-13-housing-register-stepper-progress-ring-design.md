# 登録ページ ステッパー円周進捗リング 設計 (2026-07-13)

## 目的

登録ページ左パネルのライブステッパー (`RegisterStepperNav`) の進捗表現を、
現状の「丸の中心を貫く縦線を上から塗る」方式から、
**「各丸の円周を下端起点で左回りに描き、丸と丸を接続線でつなぐ連続進捗リング」** に置き換える。

## 現状と問題

- 進捗は `.housing-register-stepper-track`(縦線・`left:21px`)を `--stepper-progress`(0..1)で
  `scaleY` 塗りする方式 ([housing.css:4355-4372](../../src/styles/housing.css))。
- 丸バッジ `.housing-register-stepper-num` の背景が**半透明の青**(`--housing-aether-medium`・
  [housing.css:4436](../../src/styles/housing.css))で、丸の中心 x=21px を通る縦線が
  **丸の中に透けて「貫いて」見える** → ユーザーが「不格好」と指摘 (2026-07-13 本番実機)。

## 設計

### 見た目

- 丸の中身は現状維持: 数字 → 入力完了(done)で **✓**、閲覧中(active)は**青枠ハイライト**。
  この2状態はスクロール進捗とは別軸なので残す(案A・ユーザー承認済み)。
- 丸の**縁(円周)に沿って青い線が「下端(6時位置)から左回り(反時計回り)にぐるっと」**描かれる。
- 円周が一周して下端に戻ったら、その下の**接続線が上から下へ塗られ**、次の丸へ。
- 次の丸もまた下端から左回りに一周 …… を ①→②→③④⑤ と連続させる(1本のペンが進む感覚)。
- **現状の「丸を貫く縦線」は廃止**。線は円周と接続線に置き換わり、丸の中を通らない = 貫き解消。

### 挙動

- **スクロール進捗(0→1)に連動**。既存の `stepperProgress`(RegisterPage の中央スクロール
  ハンドラが rAF スロットルで算出・[RegisterPage.tsx:634-666](../../src/components/housing/pages/RegisterPage.tsx))
  をそのまま `progress` prop で受ける。上に戻れば塗りも戻る(双方向)。
- 塗り速度は一定 = **円周と接続線を実長に比例して塗り進める**(区間ごとに均等でなく総長で線形)。
- 色 = **青(aether・進行色)**。housing の「青=進行」規約に沿う。未塗り部分は現状の
  `--housing-divider` 相当のトラック色。
- **reduced-motion**: なめらかな塗りトランジションを切り、progress に即反映(既存の
  `@media (prefers-reduced-motion: reduce)` パターン踏襲)。

### 進捗配分(純関数・TDD 対象)

セグメント列を `[円1, 線1, 円2, 線2, …, 円N]` とし、各セグメントの実長(px)を並べた配列
`segments: number[]`(円周長は全ステップ共通、接続線長は測定値)を入力に、
スクロール進捗 `p`(0..1)から**各セグメントの塗り割合(0..1)**を返す純関数を切り出す。

```
computeSegmentFills(p: number, segments: number[]): number[]
```

- 総長 `T = Σ segments`。塗る長さ `filled = T * clamp(p, 0, 1)`。
- 各セグメントを先頭から走査し、そのセグメントに入る塗り量を長さで按分して 0..1 に正規化。
- 完全に塗り終わったセグメント=1、未達=0、途中=部分値。
- `segments` が空/総長0のときは全て0(ゼロ除算回避)。

この関数だけを `src/lib/housing/stepperProgress.ts`(新規)に置き、vitest でエッジケース
(p=0 / p=1 / 境界ちょうど / 空配列 / 総長0)を固める。SVG 描画側はこの返り値を
stroke-dashoffset に流すだけにする(描画とロジックの分離)。

### SVG 描画方針

- 各丸を `<circle>`(または円弧 `<path>`)にし、円周を `stroke` で描く。
  `stroke-dasharray = 円周長`、`stroke-dashoffset = 円周長 * (1 - fill)` で塗り量を制御。
- **下端起点・反時計回り**: `<circle>` の既定描画開始は 3時位置・時計回りなので、
  下端(6時)起点かつ反時計回りにするため circle を回転(開始点を下端へ)+ dash 方向反転
  (`transform` の rotate + scale、または開始点・掃引方向を指定した `<path>` の円弧)で実現する。
  厳密な回転/反転値は実装時に実画面(DPR 2.58)で目視調整する。
- 接続線は `<line>`/`<rect>` を `stroke-dashoffset`(または `scaleY`)で上→下に塗る。
- 丸の中心座標・接続線長は既存の ResizeObserver 測定(`--connector-top/--connector-bottom` を
  出している [RegisterStepperNav.tsx:50-72](../../src/components/housing/register/RegisterStepperNav.tsx))
  を拡張して SVG 座標に反映。active 説明文の開閉で間隔が変わっても追従する。
- SVG は装飾なので `aria-hidden`。ステップの意味は既存の数字/✓/`aria-current` が担う。

### 既存との統合

- **廃止**: `.housing-register-stepper-track` / `.housing-register-stepper-track-fill`(直線塗り)。
- **維持**: 数字 → ✓(done)、青枠(active)、クリックでジャンプ、説明文の開閉。
- 丸バッジの半透明背景は残してよい(貫く線が無くなるので透けても問題ない)。

## スコープ

- `src/lib/housing/stepperProgress.ts`(新規・純関数)+ そのテスト。
- `src/components/housing/register/RegisterStepperNav.tsx`(描画を SVG 化)。
- `src/styles/housing.css`(円周/接続線 stroke の色・幅トークン。既存 track ルールの置換)。
- RegisterPage 側の `progress` 供給・scroll ハンドラは**変更なし**(既存の `stepperProgress` を流用)。

## 非スコープ

- 進捗の意味を「入力完了」に変える等の仕様変更(スクロール連動のまま)。
- ステッパー以外(ツアーパネルの `TourRouteSteps` 等)への波及。
- 色をハニーに変える等のブランド変更(青=進行を維持)。

## テスト観点

- `computeSegmentFills`: p=0 で全0 / p=1 で全1 / セグメント境界ちょうど / 空配列・総長0 で全0 /
  途中値が実長按分になっている。
- `RegisterStepperNav`: progress=0/0.5/1 で SVG の dashoffset(または data 属性)が期待通り変化する
  (円周・接続線の塗り量)。既存の done/active/ジャンプ/説明文開閉の回帰が無い。
- reduced-motion でトランジションが無効。
