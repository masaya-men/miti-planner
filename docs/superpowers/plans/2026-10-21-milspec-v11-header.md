# MIL-SPEC v11 移植 — 区画② ヘッダー + 通気口 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軍事テーマのヘッダー(H1〜H5)と通気口を、見本 v11 と同じ見た目・同じ動き(銘板のパタパタ・タービン 2 基・計器ランプ・ドラム時計・ブラウン管・縦ロッカー・T 字レバー・光の玉・取っ手による開閉の動き・光の経路)にし、今のヘッダーとツールバーの機能をすべてキーへ移す。

**Architecture:** 見本の座標は `headerGeometry.ts` に「上段の幅 MW を引数にした純関数」として集める。MW ≥ 1189 では見本の規則どおり(x > 700 の点は MW−1189 だけ右へ・通気口は MW/2 基準)で描き、MW < 1189(1280 幅でサイドバー開)では 1189 で描いた中身を `scale(MW/1189)` で丸ごと縮める(行の高さも同じ比率)。装甲は `MilspecArmor`、キーは `MilspecKey`、標準部品(自前の `<button>` を持つメニュー類)は `children` に `MilspecKeyCap` を入れて同じ見た目にする。光は区画①の `fx/engine.ts` に経路を足し、通気口の光の玉 `scanBall` を追加する。

**Tech Stack:** React 19 + Vite 7 + TypeScript / zustand / vitest(happy-dom・`--pool=forks`)/ Playwright

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`(§7・§8・§11・末尾 2026-10-21 masaya 追記)。正典 = `C:\Users\masay\Desktop\FF14Sim\docs\.private\theme-refs\milspec-v11.js` / `milspec-v11.css`(以下 `js:` `css:`)。区画① = `docs/superpowers/plans/2026-10-21-milspec-v11-sidebar.md`(部品の使い方の前例)。

## 決定事項(2026-10-21・Claude 判断・masaya が後で変更可)

- **見本と同じ完成度・同じアニメーション最優先**(masaya)。常時動くもの(タービン・時計・光の玉の 7 秒ごと・CRT の走査帯・REC の点滅・コロンの点滅)も見本どおり入れる。タブ非表示と「動きを減らす」では止める
- **幅**: MW = ヘッダー区画の実幅。アプリは最大 1489 幅なので MW は 1189(サイドバー開)/ 1465(閉)が基本。MW < 1189 は縮小表示(上の Architecture)
- **H4 COM**: 見本の 2 丸キー(言語・ログイン)に「共有」「同期」を足して 4 丸キー。並び = 共有 / 同期 / 言語 / ログイン。stadium(0,0,86,28) はそのまま、丸キーは r=9.6・中心 x = 12, 32.7, 53.3, 74(y=14)
- **銘板**: 上段 = 今のコンテンツ名(言語に合わせた名前)、下段 = 今のプラン名。変わったときにパタパタ(見本 `flapText`)。はみ出しは銘板の窪み内で切る(省略記号なし)
- **H3 計器**: タービン 2 基(TRB で起動・回転中は h3 の継ぎ目に琥珀の光が拍動 = 見本 js:1194-1197)/ ランプ SYS = 常時点灯・SYNC = クラウド保存の状態(保存済み = 緑・保存中/未保存 = 琥珀・エラー = 赤・未ログイン = 消灯)・NET = 光が走るたびに 60ms 点灯(`setFxSignalListener`)・REC = 見本どおり琥珀の点滅 / ドラム時計 = 画面を開いてからの経過時間(MSN CLOCK)
- **H5 CRT** = 標準の「攻略の軌跡」(ProgressTrackingHUD と同じ値・同じクリック動作)。軍事では常に表示。文字 = `PFD-2 · 攻略の軌跡` / `{活動日数}D {活動時間}H` / クリア済みなら `▲CLR`、それ以外は `{進捗}%`。軌跡 = 記録点
- **H4 DSP 縦ロッカー** = 昼夜切替。見本の走査線ワイプ(js:1083-1089)で切り替える(標準の runTransition は使わない)
- **H4 MODE T 字レバー** = 標準⇄MIL-SPEC。軍事表示中は「下」。上げると標準へ。ドラッグ・跳ね返り(js:1141-1157)まで入れる。電源投入/断の演出は区画⑥
- **ヘッダーの開閉** = 通気口の取っ手(見本 `#hdPull`)。閉じるとヘッダー区画が上へ抜け(残像)、他の区画が滑って詰まる(見本 `relayout` js:763-781)。今のヘッダー内の折りたたみボタンは撤去
- **キーを押したときの光**: 見本どおりヘッダーのキーには光の配線なし(data-bus なし)

## Global Constraints

- 区画①の Global Constraints をすべて引き継ぐ(標準テーマ 1px 不変・`military-smoke` / `no-video-in-standard` exit 0・`.theme-military` 前置・`milspec-` 接頭辞・`--ma-*` 読み替え・削除系は 2 段確認・i18n 5 言語同時で該当ブロックだけ編集・見本ファイルはコミットしない・テストは `__tests__/`・コミットは heredoc で書いた一時ファイル + `git commit -F`・末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`・コメント日本語)
- 動きは見本の値(時間・イージング・キーフレーム・遅延・乱数の幅)をそのまま移す
- フッターが使っている旧タービン CSS(`.milspec-tb-cluster2` `-switch` `-frame` `-vanes` `-hub` `-spark` `-steam`)は消さない(区画④まで)
- vitest は `node node_modules/vitest/vitest.mjs run --pool=forks <ファイル>`。型は `rtk npx tsc -b`
- 実装役はサブエージェントを起動しない

## Review Focus

1. **1280 幅(サイドバー開 MW=980)**: 縮小が効かずにキーが重なる・隠れる → Task 3 の縮小テスト + Task 10 の zone-fit(ヘッダー・通気口の違反 0)
2. **ヘッダーを閉じた状態**: 開閉の取っ手が通気口にあり、閉じても押せる・表が上に詰まる → Task 3 / Task 9 のテスト + smoke
3. **標準部品(チュートリアル・言語・取り込み・その他・表示メンバー)のメニューが開く・キーボードで押せる・名前が読める** → Task 4 のテスト + Task 6/8 のテスト
4. **進捗記録(CRT)の切り出しで標準の「攻略の軌跡」が変わる** → Task 7 で standard-invariance + 既存テスト
5. **常時動くものが溜まる・止まらない**(タービン rAF・時計・光の玉・パタパタの setTimeout)→ 各タスクで「アンマウントで止まる」「タブ非表示で止まる」テスト

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Modify `src/components/military/milspecIcons.tsx` | `party stat more gear tut globe login sync` を追加(sync は見本に無い → 同じ線の太さで作る) |
| Modify `src/components/military/MilspecDecor.tsx` | `MilspecLed` に `blink`、`MilspecDecal`(見本 `.dc`)、`MilspecHazard`(`.hz`)、`barcodeRects` に係数引数 |
| Modify `src/components/military/armor/pcb.ts` | 部品関数(cu/via/silk/smd)を export・`ventChannelSVG` を追加 |
| Create `src/components/military/headerGeometry.ts` | ヘッダーと通気口の見本座標(MW の関数)・縮小率 |
| Modify `src/components/military/MilspecKey.tsx` | 押下の動きをフック `useKeyPressMotion` に切り出し、`MilspecKeyCap` を「標準部品のボタンの中」で使えるようにする |
| Modify `src/components/military/MilspecLayout.tsx` + `src/styles/military.css` | 通気口の区画・行の高さ・閉じたときの行・縮小・開閉の動き |
| Create `src/components/military/header/`(`MilspecHeaderV11.tsx` `Nameplate.tsx` `MeterPanel.tsx` `AuxPanel.tsx` `PartyOps.tsx` `MilspecCrt.tsx` `ThemeRocker.tsx` `ModeLever.tsx`) | ヘッダーの各部品(ファイルを分ける) |
| Create `src/components/military/MilspecVent.tsx` | 通気口 |
| Create `src/components/progress/useProgressJourney.ts` | ProgressTrackingHUD の値の計算を切り出し(標準と軍事で共用) |
| Modify `src/components/progress/ProgressTrackingHUD.tsx` | 切り出したフックを使う(DOM 不変) |
| Modify `src/components/military/useTurbineCluster.ts` | 拍動コールバック・タブ非表示で停止 |
| Modify `src/components/military/fx/engine.ts` | `scanBall` / `nudgeBall` |
| Delete(内容を移した後) `src/components/military/MilspecToolbar.tsx`・旧 `MilspecHeader.tsx` の中身 | H5 / 新ヘッダーへ統合 |
| Modify `scripts/milspec-polish/zone-shot.mjs` / `scripts/milspec-sp2/military-smoke.mjs` | ヘッダー・通気口の突き合わせと操作 |

---

### Task 1: 小部品の追加(アイコン・ランプの点滅・デカール・ハザード・バーコード係数・基板の部品関数)

**Files:** `milspecIcons.tsx` / `MilspecDecor.tsx` / `armor/pcb.ts` / `military.css` + 各テスト

**Interfaces:**
- `MsIcon` に `party stat more gear tut globe login`(js:255-262 と同じ path)と `sync`(円弧 2 本 + 矢印。viewBox 16・stroke の太さは他と同じ)
- `MilspecLed` に `blink?: boolean`(class `is-blink`。見本 css:136, 138 の `blink` キーフレーム・1.3s steps(2,jump-none) infinite)
- `MilspecDecal(props: { text: string; style? })` = 見本 `.dc`(css:100・Michroma 4.4px)/ `MilspecHazard(props: { w: number; h: number; style? })` = 見本 `.hz`(css:103-104・ライトは斜線)
- `barcodeRects(h, bars?, k = 0.7)`: 係数 k を足す(既定は今と同じ)。ヘッダーの SN バーコードは `k = 0.8`・bars = `[2,1,1,3,1,2,1,1,2,3,1,1,2,1,3,1,2,1,1,2]`・高さ 8・fill `#4b5157`(js:876-877)
- `pcb.ts`: `cu` `via` `silk` `smd` を export(文字列を返す純関数のまま)。`ventChannelSVG(o: { w: number; side: 'L' | 'R'; id: string }): string` = 見本 `buildVentChannels`(js:416-430)の 1 本分(w < 30 なら空文字)。経路名 `vent{L|R}:{0..4}` を `data-trace` に。左は x を反転(光が玉から外へ走る)

- [ ] Step 1: 失敗するテスト — blink の class / デカール / `barcodeRects(8, bars20, 0.8).w` が `toBeCloseTo(43.2, 1)`(0.8×(合計 34)+0.8×20 − 見本の式で計算した値に合わせる。式は js:876 の reduce と同じ)/ `ventChannelSVG({w:207,side:'L',id:'v'})` に `data-trace="ventL:0"`〜`"ventL:4"`・`w:20` で空文字
- [ ] Step 2: FAIL 確認 → Step 3: 実装 → Step 4: PASS / tsc
- [ ] Step 5: Commit `feat(milspec): ヘッダー用の小部品(アイコン・点滅ランプ・デカール・ハザード・通気口の溝)`

---

### Task 2: ヘッダーと通気口の座標表

**Files:** Create `src/components/military/headerGeometry.ts` + `__tests__/headerGeometry.test.ts`

**Interfaces(すべて純関数・座標はヘッダー区画/通気口区画の左上基準):**
- `export const HDR_BASE_MW = 1189` / `export function headerScale(MW: number): number` = `MW < 1189 ? MW / 1189 : 1`
- `export function layoutMW(MW: number): number` = `Math.max(MW, 1189)`(縮小時は 1189 で描く)
- `export function headerLayout(MW: number): { frame: StretchFrame; panels: PlacedPanel[]; keyRows: HdrKeyRow[]; decor: HdrDecor; traces: { name: string; d: string; pc: 'seam' | 'leak' }[]; meter: { ix: number; iw: number; showClock: boolean } }`
  - 引数 MW は `layoutMW` 済みの値。`frame = { w0: 1189, h0: 102, sx: 700, sy: 9999 }`
  - パネル 6 枚(js:865 筐体 / 866 H1 / 870-871 H2 / 879-880 H3 / 890-891 H4 / 904-906 H5)。**H3 の幅 iw = MW−879、H4 の x = MW−357、H5 の右肩 MW−300 / MW−294 は「MW=1189 の値で作ったパネルを `stretchPlaced(…, frame, MW, 102)` で伸ばす」のと同じ結果になること**(テストで確認)。H5 の y は 52(パネル内 −4 の突起あり)
  - キー列(受け皿は親パネルの pockets へ。見本 cluster js:291 と同じ式): H4 AUX `tOut` (MW−343, 15) `bank(tOut,[1])` / H4 COM (MW−103, 15) stadium(0,0,86,28) pb1.6・丸キー 4 個(決定事項の座標)/ H5 PARTY OPS `pOut` (21,63) `bank(pOut,[1,1.12])` / H5 丸キー (276,63) stadium(0,0,64,32)・`circ(16,16,12.6)` `circ(48,16,12.6)` / H5 主流 `nOut` (MW−502,63) `bank(nOut,[1])` / H5 ギア (MW−272,63) 受け皿 `circ(19,16,16)`・キー `circ(19,16,12.8)` / H5 SORT `sOut` (MW−190,63) `bank(sOut,[1.28,1])` lip。輪郭 tOut/pOut/nOut/sOut は js:893, 910, 920, 924
  - `HdrKeyRow = { id: 'aux'|'com'|'party'|'io'|'mainstream'|'gear'|'sort'; x: number; y: number; caps: CapSpec[] }`
  - decor: ロゴ (28,13)・`MIL-SPEC` デカール (29,31.6)・型番 H1 (96,28.5)/ リベット (132.8,22.5)(506.2,22.5)/ 銘板の箱 (128,4,386,42)・`TTL-01 · TARGET ENGAGEMENT` (22,12)・上段 (22,20)・下段 (262,24.5)(箱内)/ SN バーコード (446,14)・`SN 0418-7A` (446,26)/ H3: TRB (ix+98,7)・タービン (ix+18,6)(ix+58,6)・ランプ群 (ix+124,12)・`⚠ ROTATING` (ix+8,42.5)・時計 (ix+iw−110,18)・`MSN CLOCK` (ix+iw−110,9.5)・型番 H3 (ix+iw−26,6)/ H4: `AUX` (MW−335,8.4)・`DSP` (MW−191,8.4)・縦ロッカー (MW−187,14) 17×30・`MODE` (MW−151,8.4)・T 字レバー (MW−150,14) 36×30・`COM` (MW−99,8.4)・型番 H4 (MW−25,6.5)/ H5: `PARTY OPS` (34,57.2)・CRT (349,59) 328×34・`SORT` (MW−222,77)
  - traces(区画座標・絶対): `h3` = `M {ix+112} 43 H {ix + (iw>=300 ? iw−120 : iw−24)}` / `h5a` = `M 96 57.6 H 336` / `h5b` = `M 690 57.6 H {MW−514}`(MW−514−690 > 40 のときだけ)
  - `meter = { ix: 518, iw: MW−879, showClock: iw >= 300 }`
- `export function ventLayout(MW: number): { xb0: number; xb1: number; chanL: { x: number; w: number }; chanR: { x: number; w: number }; pull: { x: number; w: 52 }; pullLabelX: number; hazR: number; pnX: number; leak: string }` = js:930-940(`xb0 = Math.round(MW/2−190)`・`xb1 = xb0+128`・左溝 [190, xb0−8]・右溝 [xb1+8, MW−164]・取っ手 x = MW/2−26・PULL x = MW/2+30・右ハザード MW−62・P/N MW−152・漏れ光 `M 0 -1.2 H {MW}`)

- [ ] Step 1: 失敗するテスト — `headerLayout(1189)` の H3 iw = 310・showClock true・`h5b` なし / `headerLayout(1465)` の H4 パネル x = 1108・`h5b` あり(`M 690 57.6 H 951`)/ 「1189 で作って stretchPlaced で 1465 に伸ばしたパネル」と `headerLayout(1465)` のパネルの pts が一致 / `ventLayout(1189)` = xb0 405・xb1 533・左溝 w 207・右溝 x 541 w 484 / `ventLayout(1465)` xb0 543 / `headerScale(980)` ≈ 0.824・`layoutMW(980) = 1189` / パス命令は絶対の M/H/V/L のみ
- [ ] Step 2: FAIL → Step 3: 実装 → Step 4: PASS / tsc
- [ ] Step 5: Commit `feat(milspec): ヘッダーと通気口の見本座標表(幅の関数・縮小率)`

---

### Task 3: 区画の骨組み(通気口の区画・行の高さ・開閉の動き・縮小)

**Files:** `MilspecLayout.tsx` / `military.css`(行定義 `.milspec-app` 1027-1034・閉じ時 2135-2140・isolation 1107-1112・`.milspec-zone-header` 1041)/ `__tests__/MilspecLayout.test.tsx`

**Interfaces:**
- 行: ヘッダー `calc(102px * var(--ms-hs, 1))` / 隙間 2px / 通気口 `calc(19px * var(--ms-hs, 1))` / 隙間 4px / workspace 1fr / footer(今のまま)。areas に `vent` を追加(サイドバー開・閉の両方)。ヘッダーを閉じたら ヘッダー行 0・通気口は y=2(見本 js:794)
- `div[data-ms-zone="vent"].milspec-zone-vent`(isolation の一覧に追加・overflow visible)。ヘッダー区画も overflow visible(装甲の影と H5 の突起のため)
- 閉じた状態はゾーン属性 `[data-ms-zone="header"][data-collapsed]` で持つ(今の `.milspec-hdr[data-collapsed]` 依存をやめる)。Layout の `isHeaderCollapsed` / `setIsHeaderCollapsed` / キーボードショートカットはそのまま使う
- `--ms-hs`(縮小率)= `headerScale(ヘッダー区画の実幅)`。MilspecLayout がヘッダー区画の幅を ResizeObserver で測り `.milspec-app` に style で入れる。ヘッダーと通気口の中身は `transform: scale(var(--ms-hs)); transform-origin: 0 0; width: calc(100% / var(--ms-hs))` の内箱に入れる(クラス `milspec-hs-box`)
- 開閉の動き(見本 `relayout` js:763-781 をそのまま): 閉じるとき = ヘッダー区画の複製(残像・`aria-hidden`・`pointer-events:none`)を元の位置に置き translateY(1.4px)→(−112px) 440ms で消す / 開閉どちらも 通気口・workspace・footer・rail の区画を FLIP(前後の矩形の差から translate → 0、640ms・見本のイージング)。`useReducedMotion` なら即時。関数 `relayoutZones(app: HTMLElement, change: () => void, kind: 'hdr', reduced: boolean): void` を `src/components/military/relayout.ts` に置く
- 中身(ヘッダー・通気口の部品)はまだ旧部品のままでよい(Task 5〜9 で置き換え)。旧 `MilspecHeader` の折りたたみボタンは残してよい(Task 9 で取っ手に移す)

- [ ] Step 1: 失敗するテスト — vent 区画がある / `--ms-hs` が幅 980 で 0.824 前後・1189 以上で 1 / 閉じたらゾーン属性 / `relayoutZones` が reduced で animate を呼ばない・通常で区画ごとに animate(happy-dom で矩形を偽装)
- [ ] Step 2〜4 / Commit `feat(milspec): ヘッダーと通気口の区画(行の高さ・閉じ方・縮小・開閉の動き)`

---

### Task 4: 標準部品のボタンをキーの見た目にする仕組み

**Files:** `MilspecKey.tsx` + `__tests__/MilspecKey.test.tsx` / `military.css`

**Interfaces:**
- `export function useKeyPressMotion(o: { btnRef: RefObject<HTMLElement | null>; kfRef: RefObject<HTMLElement | null>; pressed?: boolean; latch?: boolean }): void` — 今 `MilspecKey` の中にある押下の動き(pointerdown / window の pointerup・cancel / Enter・Space / blur / latch の戻り)を移す。`MilspecKey` はこれを使う(挙動・テスト不変)
- `MilspecKeyHost(props: { cap: CapSpec; label?: ReactNode; srLabel?: string; active?: boolean; children: (capNode: ReactNode) => ReactNode })` は作らない。代わりに次の使い方を決める:
  - 標準部品の `btnClassName` に `milspec-keybtn`(枠・背景なし・`position:relative`・幅高さはキーの bbox・`clip-path: polygon(キーの当たり判定)` は style で渡す)
  - `children` に `<MilspecKeyCap cap label active? />` + 視覚的に隠した名前 `<span className="milspec-sr">{名前}</span>`(TutorialMenu・LanguageSwitcher はボタンに aria-label が無いため)
  - `MilspecKeyCap` に `active?: boolean`(ランプ・下縁を緑に。表示メンバーに非表示がいるとき用)と、内部で `useKeyPressMotion({ btnRef: 最も近い祖先の button を effect で探す, kfRef })` を呼ぶ
  - CSS: `.milspec-keybtn:hover .milspec-key-hov` を `.milspec-key:hover .milspec-key-hov` と同じにする / `.milspec-keybtn:focus-visible .milspec-key-*` に MilspecKey と同じフォーカス枠 / `.milspec-sr` = 視覚的に隠す標準パターン
- `export function hitPolygon(cap: CapSpec): string` = clip-path 用の `polygon(...)`(bbox 原点基準・`offsetPoly(cap.pts, -0.8)`)

- [ ] Step 1: 失敗するテスト — `MilspecKey` の既存テストがすべて通る(切り出し後)/ ボタンの中の `MilspecKeyCap` が、ボタンを押すと animate される / `active` で class / `hitPolygon` の書式
- [ ] Step 2〜4 / Commit `feat(milspec): 押下の動きをフックに切り出し、標準部品のボタンにもキーの見た目と押し心地を付ける`

---

### Task 5: H1 ロゴ・H2 銘板(パタパタ)・H3 計器

**Files:** Create `header/Nameplate.tsx` `header/MeterPanel.tsx`(+ テスト)/ Modify `useTurbineCluster.ts`(+ テスト)/ `military.css`(見本 css:94-108, 284-316, 394-407, 567-572 → `milspec-` 名)

**Interfaces:**
- ロゴ: `button.milspec-logo`(`aria-label = t('app.return_home')`、押すと `navigate('/')`)+ 走るハイライト `span.milspec-logo-sweep`(css:394-404)
- `Nameplate(props: { title: string; sub: string })` — 見本 `flapText`(js:732-750)を ref で直接動かす。`title` / `sub` が変わったときだけ(sub は 120ms 遅れ)。文字幅は `document.fonts.ready` 後に測る。アンマウントでタイマーを全部止める。reduced なら即時。title = 今のコンテンツ名(`MilspecHeader.tsx:42-45` の取り方)、sub = 今のプラン名(`usePlanStore` の現在プランの title)
- `useTurbineCluster(fanCount, opts?: { onBeat?: (k: number) => void })` — 起動中、見本 js:1196 の間隔(`k < 6 ? 640 − k*70 : 280`)で `onBeat(k)` を呼ぶ。**`document.hidden` の間は rAF を止め、戻ったら再開**(フッターも恩恵を受ける。フッターの見た目・動きは変えない)
- `MeterPanel(props: { ix, iw, showClock })` — タービン 2 基(`useTurbineCluster(2, { onBeat: () => pulse('h3', { cls: 'warn', len: 10 }) })`、起動中は TRB のランプ `warn on`)/ TRB `button[aria-label=タービン起動]`(見本 `.tsw` css:297-301)/ ランプ 4 個(決定事項。SYNC は `SyncButton.tsx:27` と同じ store の値で決める・NET は `setFxSignalListener` で 60ms 点灯、アンマウントで解除)/ ドラム時計(6 桁・css:309-316・1 秒ごと・画面を開いてからの経過時間・タブ非表示で止めて戻ったら追いつく)/ `⚠ ROTATING`・`MSN CLOCK`・型番

- [ ] Step 1: 失敗するテスト — パタパタ: 文字が変わると 1 文字ずつ `<i>` になり、最後は正しい文字列 / アンマウントでタイマーが残らない / reduced で即時 / タービン: `onBeat` が見本の間隔で呼ばれる・`document.hidden` で rAF が止まる / 時計: 61 秒で `00:01:01` / NET ランプが信号で点く / SYNC の 4 状態
- [ ] Step 2〜4 / Commit `feat(milspec): ヘッダー上段の左側(ロゴ・銘板のパタパタ・計器とタービン 2 基・時計・ランプ)`

---

### Task 6: H4(AUX・DSP 縦ロッカー・MODE T 字レバー・COM)

**Files:** Create `header/AuxPanel.tsx` `header/ThemeRocker.tsx` `header/ModeLever.tsx`(+ テスト)/ `military.css`(css:182-275 の縦ロッカー・T 字レバー、走査線ワイプ css:616-617)

**Interfaces:**
- AUX: `TutorialMenu`(`btnClassName="milspec-keybtn"`・children = KeyCap + `milspec-sr`「チュートリアルを見る」)。ラベル = `MsIcon.tut` + `<b>t(…)</b>`(今の MilspecHeader の文言キーを使う)
- `ThemeRocker(props: { theme: 'dark' | 'light'; onToggle: () => void })` — 見本 `.vr`(上 = 昼・下 = 夜)。押すと走査線 `div.milspec-wipe`(画面全体・620ms・delay 120・js:1087)を流し、360ms 後に `onToggle()`(Layout の setTheme を直接呼ぶ関数を MilspecLayout から渡す。runTransition は使わない)。reduced なら即時。`aria-label` は今のテーマボタンと同じ文言キー
- `ModeLever()` — 見本 `.mlv`(role=switch・aria-checked=true(軍事表示中))。ドラッグ(pointer capture)・クリック・Space/Enter。`settle` の動き(js:1141-1157 の 380ms)のあと 240ms で `runTransition(() => setThemeStyle('standard'), 'theme')`(今の MilspecStyleToggle と同じ処理)。表示条件 = `useCanPreviewWip()`
- COM: 4 丸キー(決定事項)= 共有(`ShareButtons` の主ボタンと同じ処理を呼ぶ。`src/components/ShareButtons.tsx` を読み、共有モーダルを開く関数・共同編集中の表示(チップ・在席)を確認して、同じことを軍事のキー + ランプで表す。標準の ShareButtons の DOM は描かない。読み切れない機能があれば実装せず報告)/ 同期(`SyncButton` と同じ処理。見えない条件も同じ)/ 言語(`LanguageSwitcher` + KeyCap)/ ログイン(今の MilspecHeader 188-206 と同じ処理・ログイン中はアバターの頭文字をキーの刻印に)
- 型番 H4・刻印 AUX/DSP/MODE/COM

- [ ] Step 1: 失敗するテスト — チュートリアル・言語のメニューが開き、名前が読める / 縦ロッカーで 360ms 後に onToggle・reduced で即時 / レバーをクリック → 620ms 後に setThemeStyle('standard')・キーボードでも / 共有キーで共有モーダル / 同期キーが未ログインで出ない / ログインキーで LoginModal
- [ ] Step 2〜4 / Commit `feat(milspec): ヘッダー上段の右側(チュートリアル・昼夜ロッカー・MODE レバー・共有/同期/言語/ログイン)`

---

### Task 7: 攻略の軌跡の値を切り出し、ブラウン管に出す

**Files:** Create `src/components/progress/useProgressJourney.ts` + テスト / Modify `ProgressTrackingHUD.tsx`(DOM 不変)/ Create `header/MilspecCrt.tsx` + テスト / `military.css`(css:318-333, 573-575)

**Interfaces:**
- `useProgressJourney(): { empty: boolean; points: { x: number; y: number }[]; pct: number | null; cleared: boolean; activeDays: number; activeHours: number; openPanel: () => void }` — `ProgressTrackingHUD.tsx:233-326` の計算(`points` `pct` `cleared` `activeDays/Hours`・クリックで `useProgressRecording.getState().openPanel()`)をそのまま移す。ProgressTrackingHUD はこれを使う(出力の DOM・class・文言は 1 文字も変えない)
- `ProgressRecordPanel` と `ProgressCelebration` の出し方(条件・`_dismissedPlanIds`)も、軍事側で同じに出せるよう、必要なら同ファイルの中で小さな部品に分ける(標準の DOM は不変)
- `MilspecCrt()` — 見本 `.crt`(js:915-919・css:318-333)。表示 = 決定事項。軌跡 = `points` を viewBox 326×34 の x 110〜306・y 30〜4 に写す。値が増えたら `crtDraw`(js:751-761)で描き込む。クリックで boot(付け直し)+ 350ms 後に描き込み + `openPanel()`。`data-progress-hud-band` を付ける。空なら見本の格子だけ + `t('progress.empty_cta')` を小さく
- 軍事で `ProgressRecordPanel` が探す `[data-progress-drawer-anchor]` は通気口の下端に置く(Task 9)。それまではヘッダー区画の下端

- [ ] Step 1: 失敗するテスト — フックの値(既存 ProgressTrackingHUD のテストと同じ入力で同じ値)/ ProgressTrackingHUD の既存テストが全部通る / CRT の文字(`5D 12H`・`▲CLR`・`42%`)/ クリックで openPanel
- [ ] Step 2〜4(+ dev で standard-invariance exit 0)/ Commit `feat(progress): 攻略の軌跡の計算を useProgressJourney に切り出し、MIL-SPEC のブラウン管に表示`

---

### Task 8: H5(PARTY OPS・取り込み/その他・主流・表示メンバー・SORT)と新ヘッダーの組み立て

**Files:** Create `header/PartyOps.tsx` `header/MilspecHeaderV11.tsx`(+ テスト)/ Modify `MilspecLayout.tsx`(新ヘッダーに差し替え・MilspecToolbar を外す)/ Delete `MilspecToolbar.tsx` と旧 `MilspecHeader.tsx`(とそのテスト。必要なテストは新ファイルへ移す)

**Interfaces:**
- `MilspecHeaderV11(props: { theme; onToggleTheme; partySortOrder; setPartySortOrder; onAutoPlan; onImportLogs; statusOpen; setStatusOpen })` — `headerLayout(layoutMW(実幅))` を読み、`MilspecArmor id="hdr"`・`MilspecFxLayer traces`・H1〜H5 を absolute で置く(キーの置き方は区画①と同じ: 列の原点 + bbox)
- H5: パーティ編成(MilspecKey・`timeline:party-settings` + `completeEvent('party:opened')`)/ ステータス設定(MilspecKey・`setStatusOpen`・PartyStatusPopover)/ 取り込み(`ImportMenu` + KeyCap 丸)/ その他(`HeaderToolsMenu` + KeyCap 丸)/ CRT / 主流(MilspecKey・`MitigationSheet` を開く。刻印 = 見本の「野良の主流が見つかるかもしれないボタン」ではなく今の MilspecToolbar の文言キー)/ 表示メンバー(`PartyVisibilityMenu` + KeyCap 丸・非表示がいれば `active`)/ SORT(MilspecKey 2 個・latch・lip・`setPartySortOrder('light_party' | 'role')`・`role="group"` + `aria-pressed`)。アイコン = js:910-922 と同じ
- 刻印 PARTY OPS・SORT
- 1280 幅(縮小時)で各メニューが正しい位置に開く(メニューは getBoundingClientRect 基準なので変換後の位置で開くことを確認)

- [ ] Step 1: 失敗するテスト — 旧 MilspecToolbar のテスト 4 本と旧 MilspecHeader のテスト 5 本の意図を新ファイルで(パーティ編成の dispatch・ステータス設定でポップオーバーが実際に開く・SORT・テーマ・タービンはストアを触らない 等)/ 幅 1465 で H4 と SORT が右へ寄る
- [ ] Step 2〜4 / Commit `feat(milspec): ヘッダー下段(H5)と新ヘッダーの組み立て・旧ヘッダー/ツールバーの撤去`

---

### Task 9: 通気口(パンチング・溝の基板・光の玉・取っ手)

**Files:** Create `MilspecVent.tsx` + テスト / Modify `fx/engine.ts`(+ テスト)/ `military.css`(css:277-282, 335-353)

**Interfaces:**
- `MilspecVent(props: { isHeaderCollapsed: boolean; onToggleHeader: () => void })` — `ventLayout(layoutMW(実幅))`。パンチング板 `.milspec-perf`(0,0,MW,19)/ ハザード 2(16,6)(hazR,6) 46×7 / 刻印 `HDR PNL 1A · DO NOT STEP`(70,7)/ 溝 2 本(`ventChannelSVG`・`.milspec-chan`(高 8)・y=5.5)/ 光の玉のランプ列 `.milspec-lb-row`(xb0,5.5・赤 8px×11・gap4)/ 取っ手 `button.milspec-pull`(pull.x,2,52,15・`aria-label` = 開閉で変わる・`aria-expanded`)+ `PULL` / `P/N 7A-2213-0418`(pnX,7)/ 漏れ光 `lk:hdr`(MilspecFxLayer)/ `data-progress-drawer-anchor`(下端)
- 取っ手を押す = 見本 js:1091-1093(`tug` を付け、260ms 後に `onToggleHeader()`(= Task 3 の relayoutZones 経由)、さらに 200ms 後に `burst('ventL:')` `burst('ventR:')` stagger 25)
- `engine.ts`: `scanBall(row: HTMLElement): void` / `nudgeBall(row: HTMLElement): void` = js:1054-1069(`ballBusy`・reduced・電源・端で `burst('ventR:'|'ventL:', { stagger: 22, len: 9, speed: 2 })`)。通気口は 7 秒ごとに `scanBall`(js:1139。タブ非表示では出さない)・クリックで scanBall・ホバーで nudgeBall
- 旧 `MilspecHeader` の折りたたみボタンが残っていれば撤去(取っ手に一本化)
- 通気口内の刻印色は骨組み上の色(css:565-566)

- [ ] Step 1: 失敗するテスト — 取っ手で onToggleHeader・aria-expanded / 閉じても取っ手が押せる / scanBall が端で burst・二重起動しない・reduced で何もしない / 7 秒の定時がアンマウントで止まる / 溝の経路名が DOM にある
- [ ] Step 2〜4 / Commit `feat(milspec): 通気口(溝の基板・光の玉・取っ手でヘッダー開閉)`

---

### Task 10: 旧 CSS の撤去・検査・見本との突き合わせ

**Files:** `military.css`(旧 `.milspec-hdr*` `.milspec-logo-*`(旧)`.milspec-hud-btn` `.milspec-tool-btn` `.milspec-tb`(ツールバー)`.milspec-sort-btn` ほか。**フッターが使うタービン CSS は残す**。各クラスは src・scripts を grep して参照ゼロを確認してから)/ `zone-shot.mjs`(`--zone=header|vent`・見本は `#z-hdr` `#z-vent`)/ `military-smoke.mjs`(step: TRB でタービン・取っ手でヘッダー開閉・SORT・縦ロッカー)

- [ ] Step 1: 旧 CSS 撤去 → tsc / 関連 vitest
- [ ] Step 2: スクリプト追加
- [ ] Step 3: ゲート — standard-invariance / military-smoke / no-video-in-standard exit 0 / zone-fit = **ヘッダー・通気口・サイドバー・レールの違反 0**(フッターの既知だけ残る)/ zone-shot header・vent を dark/ja・light/ja・dark/en、幅 1489×679(開・閉)と 1280×720(縮小)で exit 0
- [ ] Step 4: 見本との突き合わせ(実装役が画像を見て差の一覧 → 明らかな崩れは直す)
- [ ] Step 5: Commit `feat(milspec): 旧ヘッダー/ツールバー CSS の撤去・ヘッダーと通気口の突き合わせと操作検査`

---

## 実行の割り当て(司令塔用メモ)

- 実装: 全タスク Sonnet。レビュー: 各タスク Sonnet、Task 3(区画・開閉の動き)・Task 7(標準の進捗の切り出し)・Task 8(組み立て)・最終の全体レビューは Opus
- military.css を全タスクが触るので直列。コミットは実装役
