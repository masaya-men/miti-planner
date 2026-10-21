# MIL-SPEC v11 移植 — 土台 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認済み見本 v11 を本体へ移植するための共通の土台(書体・材質トークン・装甲とキーの描画エンジン・区画の骨組み・自動検査)を作る。この計画の範囲では画面の見た目はほぼ変わらない(レールと区画の隙間だけ)。

**Architecture:** 見本 `milspec-v11.js` の描画ロジック(幾何・光・使い込み・装甲 SVG・キー SVG)を、DOM に依存しない TypeScript の純関数 `src/components/military/armor/` に移す。区画ごとのパネルは「見本の座標 + 伸びる位置」で定義し、`MilspecArmor` コンポーネントが区画の実寸(ResizeObserver)とテーマに合わせて SVG を作り直す。キーは `MilspecKey`(押せるボタン)と `MilspecKeyCap`(見た目だけ)に分ける。書体は MIL-SPEC の画面が出たときだけ Google Fonts を読み込む。

**Tech Stack:** React 19 + Vite 7 + TypeScript / vitest(happy-dom・`--pool=forks`)/ Playwright(`scripts/milspec-sp2/_fixture.mjs`)

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`(特に §6 性能・§11 v11 確定事項)。正典 = `docs/.private/theme-refs/milspec-v11-full.html` + `milspec-v11.css` + `milspec-v11.js`(gitignore・非公開。以下 `css:` `js:`)。棚卸し = `docs/.private/2026-10-21-milspec-v11-inventory.md`(以下 `inv:`)。

## Global Constraints

- 標準テーマは 1px も変えない: `node scripts/milspec-sp2/standard-invariance.mjs` が exit 0(dev サーバ起動中)
- 軍事テーマの既存操作: `node scripts/milspec-sp2/military-smoke.mjs` が exit 0
- 背景動画のコスト検査: `node scripts/milspec-polish/no-video-in-standard.mjs` が exit 0
- CSS はすべて `.theme-military` 前置で `src/styles/military.css` に書く。新しいクラス名は `milspec-` 接頭辞(見本の `.kk` `.lamp` `.th` などの短い名前をそのまま使わない)
- 新しい CSS 変数は `--ma-` 接頭辞(見本の `--pri-top` → `--ma-pri-top`)。既存の `--ms-*` は消さない
- アニメーションは transform / opacity / stroke-dashoffset のみ。`backdrop-filter` を書かない。`clip-path: path()` を使わない
- 表の行・セル・段ごとに付く効果を増やさない(spec §6)
- 見本の HTML/CSS/JS ファイルと元動画はコミットしない。見本のコードを TS へ移すのは可(公開リポに出てよいのは移植したコードだけ)
- テストは `__tests__/` 配下。vitest は `npx vitest run --pool=forks <ファイル>` で変更ファイルに絞る
- コミットは `git commit -F <一時ファイル>`(stdin の `-F -` は失敗する)。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 日本語でコメントを書く(周囲のコードに合わせる)

## Review Focus

1. **テーマ切替(ダーク⇄ライト)**: 装甲の色は SVG に焼き込まれるので、切り替えたら作り直さないと古い色のまま残る → Task 4 のテスト「テーマ変更で SVG を作り直す」
2. **区画の大きさが変わる**(ウィンドウのリサイズ・サイドバー開閉・高さ 679 / 1080 / 1440): パネルが見本の座標のまま切れたり隙間が空いたりする → Task 3 の `stretchSpec` テストと Task 4 の ResizeObserver テスト
3. **標準テーマの人が MIL-SPEC の書体を読み込まない**: → Task 1 の検査 E
4. **キーボード操作**: キーの見た目を変えても Enter / Space で押せて、フォーカス枠が見える → Task 5 のテスト
5. **1280 幅でボタンが隠れる**: サイドバー列が今より広くなる(244 → 274+レール)ため → Task 6 の `zone-fit.mjs`

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Create `src/components/military/useMilspecFonts.ts` | MIL-SPEC 表示時だけ Google Fonts の `<link>` を 1 回足す |
| Modify `src/components/military/MilspecLayout.tsx` | `useMilspecFonts()` 呼出し・レール区画・`MilspecSeam` / `MilspecChrome` の撤去 |
| Modify `scripts/milspec-polish/no-video-in-standard.mjs` | 検査 E(書体)を追加 |
| Modify `src/styles/military.css` | `--ma-*` 材質トークン(ダーク/ライト)・区画の列と隙間・レール・キーの CSS |
| Create `src/components/military/armor/geom.ts` | 幾何(js:14-88 の幾何部分) |
| Create `src/components/military/armor/color.ts` | 色計算・光(js:14-19, 48-49) |
| Create `src/components/military/armor/palette.ts` | CSS 変数 → 色表(js:93-99) |
| Create `src/components/military/armor/weather.ts` | 使い込み(js:104-162) |
| Create `src/components/military/armor/svg.ts` | 装甲 SVG・キー SVG・共通 defs(js:164-202, 211-237, 1203-1220) |
| Create `src/components/military/armor/stretch.ts` | 見本座標 → 実寸へ伸び縮み |
| Create `src/components/military/armor/types.ts` | 型 |
| Create `src/components/military/MilspecArmor.tsx` | 区画にパネル群を描く(実寸・テーマ・書体読込完了で作り直し) |
| Create `src/components/military/MilspecKey.tsx` | キー(押せる)と `MilspecKeyCap`(見た目だけ)・押下の動き |
| Create `src/components/military/MilspecRail.tsx` | レール区画(サイドバー開閉の取っ手の移設先) |
| Create `scripts/milspec-polish/zone-fit.mjs` | 4 幅で操作部品の隠れ・はみ出しを検査 |
| Create `scripts/milspec-polish/scroll-perf.mjs` | 表を縦スクロールしたときのフレーム時間を計測 |
| Delete `src/components/military/MilspecSeam.tsx` / `MilspecChrome.tsx`(+ 各テスト) | 見本に無い旧飾り |

---

### Task 1: 書体を MIL-SPEC 表示時だけ読み込む

**Files:**
- Create: `src/components/military/useMilspecFonts.ts`
- Create: `src/components/military/__tests__/useMilspecFonts.test.tsx`
- Modify: `src/components/military/MilspecLayout.tsx`(関数本体の先頭で呼ぶ)
- Modify: `scripts/milspec-polish/no-video-in-standard.mjs`

**Interfaces:**
- Produces: `export const MILSPEC_FONTS_HREF: string` / `export function useMilspecFonts(): void`

- [ ] **Step 1: 失敗するテストを書く** — `useMilspecFonts.test.tsx`
  - `it('MIL-SPEC の書体の <link> を head に 1 つだけ足す')`: 2 つのコンポーネントで呼んでも `document.head.querySelectorAll('link#milspec-fonts').length === 1`、`rel === 'stylesheet'`、`href === MILSPEC_FONTS_HREF`
  - `it('アンマウントしても <link> は残す')`(一度読んだ書体を消すと再読込が起きるため)
  - `it('href に 7 書体が入っている')`: `IBM+Plex+Sans+JP` `IBM+Plex+Mono` `Saira+Semi+Condensed` `Michroma` `Doto` `Share+Tech+Mono` `Orbitron` をすべて含み、`display=swap` を含む
- [ ] **Step 2: 失敗を確認** — `npx vitest run --pool=forks src/components/military/__tests__/useMilspecFonts.test.tsx` → FAIL(モジュールなし)
- [ ] **Step 3: 実装** — `MILSPEC_FONTS_HREF` = 見本 html:9 の URL と同じ文字列(`https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Saira+Semi+Condensed:wght@500;600;700&family=Michroma&family=Doto:wght@900&family=Share+Tech+Mono&family=Orbitron:wght@900&display=swap`)。`useEffect` で `id="milspec-fonts"` が無ければ作る。`MilspecLayout` の先頭で呼ぶ(MilspecLayout は軍事かつ PC のときだけ描画される = 標準・スマホでは読まない)。CSP(`vercel.json` の style-src / font-src)は Google Fonts を許可済みで変更不要
- [ ] **Step 4: 検査 E を追加** — `no-video-in-standard.mjs` の 4 ケース(標準/軍事 × PC/スマホ)で `fonts.googleapis.com/css2` かつ URL に `IBM+Plex+Sans+JP` を含むリクエストを数える。標準 PC・標準スマホ・軍事スマホ = 0 件で `OK E`、軍事 PC = 1 件以上で `OK E`。それ以外は `NG E` で fail++
- [ ] **Step 5: 確認** — 上の vitest + `MilspecLayout.test.tsx` が PASS / dev サーバ起動中に `node scripts/milspec-polish/no-video-in-standard.mjs` → OK A/B/D/E・exit 0
- [ ] **Step 6: Commit** — `feat(milspec): v11 の書体を MIL-SPEC 表示時だけ読み込む`

---

### Task 2: 材質トークン(ダーク/ライト)

**Files:**
- Modify: `src/styles/military.css`(`.theme-military.theme-dark` ブロックの末尾と `.theme-military.theme-light` ブロックの末尾。行は `grep -n "theme-military.theme-dark\|theme-military.theme-light" src/styles/military.css` で確認)
- Create: `src/components/military/__tests__/milspecTokens.test.ts`

**Interfaces:**
- Produces: CSS 変数。見本の名前に `ma-` を前置する(`--pri-top` → `--ma-pri-top`、`--a-edge` → `--ma-a-edge`、`--on` → `--ma-on`)。対象 = 見本 css:21-45(ダーク)/ css:46-67(ライト)/ css:68-77(意味色・基板。ライトの `--on` 上書き css:77 を含む)/ css:584-585(使い込み)。値は見本のまま。Task 3 の `readPalette` がこの名前を読む

- [ ] **Step 1: 失敗するテストを書く** — `milspecTokens.test.ts`(`node:fs` で military.css を文字列として読む)
  - `it('装甲の 4 トーンがダーク・ライト両方にある')`: `['pri','sec','chs','key']` × `['top','bot','hi','lo']` の `--ma-${k}-${s}:` が、ダークのブロックとライトのブロックそれぞれに出現する(ブロックは `.theme-military.theme-dark {` から次の `}` まで、と簡易に切り出す)
  - `it('意味色が定義されている')`: `--ma-on:` `--ma-warn:` `--ma-dng:` `--ma-sig:` が出現
  - `it('見本の短い名前を直接使っていない')`: military.css に正規表現 `/\s--(pri|sec|chs|key)-(top|bot|hi|lo):/` が無い
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装** — 上の Interfaces どおりに転記。見本の `.pa`(ダーク)= `.theme-military.theme-dark`、`.pc`(ライト)= `.theme-military.theme-light`。意味色・基板(テーマ共通)はダーク・ライト両ブロックへ同じ値で書く(ライトだけ `--ma-on: #2fd45e`)
- [ ] **Step 4: 確認** — vitest PASS / dev サーバで `standard-invariance.mjs` exit 0(トークンを足しただけで標準は不変)
- [ ] **Step 5: Commit** — `feat(milspec): v11 の材質トークン(--ma-*)をダーク/ライトに追加`

---

### Task 3: 装甲とキーの描画エンジン(純関数)

**Files:**
- Create: `src/components/military/armor/types.ts` / `geom.ts` / `color.ts` / `palette.ts` / `weather.ts` / `svg.ts` / `stretch.ts`
- Create: `src/components/military/armor/__tests__/geom.test.ts` / `svg.test.ts` / `stretch.test.ts` / `palette.test.ts`

**Interfaces:**
- Produces(`types.ts`):
  - `type Pt = [number, number]`
  - `type Tone = 'pri' | 'sec' | 'chs' | 'key'`
  - `interface PanelSpec { pts: Pt[]; tone?: Tone; b?: number; shadow?: number; scribes?: string[]; seams?: string[]; pockets?: { b: number; pts: Pt[] }[]; circles?: unknown[]; wx?: WeatherSpec }`(`circles` と `WeatherSpec` の形は見本 js:146-202 の使われ方から決める。`scribes` / `seams` は見本どおり SVG path 文字列)
  - `interface PlacedPanel { x: number; y: number; w: number; h: number; spec: PanelSpec }`
  - `interface CapSpec { pts: Pt[]; b?: number }` 
  - `interface StretchFrame { w0: number; h0: number; sx: number; sy: number }`
  - `interface ArmorPalette`(見本 js:96-98 の戻り値と同じキー)
- Produces(関数):
  - `geom.ts`: `dedupe` `offsetPoly(pts, d)` `offsetLine(pts, d)` `pd(pts)` `clipHalf(poly, a, b, c)` `bbox(pts)` `centroid(pts)` `spanAt(pts, y)` `circ(cx, cy, r, n?)` `stadium(x, y, w, h, n?)` `chamRect(w, h, tl?, tr?, br?, bl?)` `shift(pts, x, y)` `bank(outline, weights, opts?) : Pt[][]` — 見本の同名関数と同じ入出力
  - `color.ts`: `hex` `mix` `css` `shade(ox, oy, raised)` `facetCol(b, t)` と定数 `LIGHT` `FLAT`
  - `palette.ts`: `readPalette(el: Element): ArmorPalette` — 見本 `palette()` と同じ。ただし変数名は Task 2 の `--ma-*`
  - `weather.ts`: `rng(seed)` `seedOf(pts)` `weatherSVG(spec, pts, inner, id): string`(+ 内部の chips / scratches / streak)
  - `svg.ts`: `armorSVG(spec: PanelSpec, pal: ArmorPalette, id: string): string` / `capSVG(cap: CapSpec, pal: ArmorPalette, id: string): string` / `armorDefsSVG(): string`(見本 js:1203-1220 のうち粒子ノイズ・汚れ・鋼のグラデ。fxglow js:1209-1211 は光の段階なので入れない)
  - `stretch.ts`: `stretchSpec(spec: PanelSpec, f: StretchFrame, w: number, h: number): PanelSpec` / `stretchPlaced(p: PlacedPanel, f: StretchFrame, w: number, h: number): PlacedPanel`

**移植の決まり:**
- 見本の `uid++` で作る SVG の id は、引数 `id` を接頭辞にする(同じ画面に同じ id が二重にできないよう、呼ぶ側が一意にする)
- 見本の `canvas` で作る粒子ノイズ(js:1204-1206)は `armorDefsSVG` の外へ出し、`MilspecArmor`(Task 4)がブラウザでだけ 1 回作る。純関数側は DOM を触らない
- `stretchSpec` の規則: 点の x が `f.sx` より大きければ `x + (w - f.w0)`、y が `f.sy` より大きければ `y + (h - f.h0)`。それ以外はそのまま。`pts` / `pockets[].pts` / `circles` の中心 / `scribes` と `seams` の path(`M` `L` `H` `V` の絶対座標だけを対象。それ以外の命令が来たら `Error` を投げる)すべてに同じ規則を当てる

- [ ] **Step 1: 失敗するテストを書く**
  - `geom.test.ts`: `offsetPoly` で 10×10 の正方形を内側に 1 → 8×8(各頂点が 1 ずつ内側)/ `bbox(chamRect(20, 10, 3))` = `{x:0,y:0,w:20,h:10}` / `bank(chamRect(100, 20), [1, 1])` が 2 個の多角形を返し、その bbox の幅の合計が 100 未満(隙間がある)/ `stadium(0,0,30,10)` の bbox が 30×10
  - `svg.test.ts`: 見本 js:800-802 の S1 パネル(`pts` 12 点・`scribes: ['M 142 105 H 206']`)を `armorSVG` に通した文字列に、`<polygon` が 12 個以上(辺ごとの面取り)・`id="t1f"`(id 接頭辞 `t1`)・`M 142 105 H 206` が含まれる / 同じ入力なら 2 回とも同じ文字列(乱数は形から決まる)/ `capSVG` が `<polygon` を含む
  - `stretch.test.ts`: `f = {w0:274, h0:122, sx:137, sy:61}` で w=300, h=122 → 点 `[232,0]` は `[258,0]`、`[16,0]` はそのまま / path `'M 142 105 H 206'` は `'M 168 105 H 232'`(x が sx を超える数だけ +26。142 も 137 超なので動く)/ `'M 0 0 C 1 1 2 2 3 3'` で Error
  - `palette.test.ts`(happy-dom): 要素に `--ma-pri-top: #555b61` などを style で与えると `readPalette(el).pri.top` が `[0x55,0x5b,0x61]`(見本 `hex()` の戻り値の形に合わせる)
- [ ] **Step 2: 失敗を確認** — `npx vitest run --pool=forks src/components/military/armor/__tests__/` → FAIL
- [ ] **Step 3: 実装** — 見本 js の該当関数を型付きで移す(上の決まり以外は同じ計算)。`stretch.ts` は新規
- [ ] **Step 4: 確認** — 同じ vitest が全 PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): 装甲とキーの描画エンジンを TS の純関数に移植`

---

### Task 4: `MilspecArmor`(区画にパネルを描くコンポーネント)

**Files:**
- Create: `src/components/military/MilspecArmor.tsx`
- Create: `src/components/military/__tests__/MilspecArmor.test.tsx`
- Modify: `src/styles/military.css`(SP1 シェル節の近く)

**Interfaces:**
- Consumes: Task 3 の `armorSVG` `armorDefsSVG` `readPalette` `stretchPlaced`、`useThemeStore`(`theme` = 'dark' | 'light')
- Produces: `export function MilspecArmor(props: { id: string; frame: StretchFrame; panels: PlacedPanel[]; className?: string }): JSX.Element`。DOM = `div.milspec-armor[data-ms-armor=<id>][aria-hidden=true]` の中に、パネルごとに `svg.milspec-armor-panel`(絶対配置)。親(区画)を `position:relative` 前提で全面に重ねる。`pointer-events:none`

**決まり:**
- 親要素の実寸を `ResizeObserver` で取り、`stretchPlaced(p, frame, 実幅, 実高)` を通してから描く
- 作り直すきっかけ = 実寸の変化 / `theme` の変化 / `document.fonts.ready` の解決時(見本 js:1226 と同じ)
- 色は `readPalette(document.documentElement)` で読む(`--ma-*` は `<html>` のクラスで決まるため)
- SVG は文字列を `innerHTML` で入れる(React の要素にしない。ノード数が多く、再描画の比較を避けるため)。`useLayoutEffect` で行う
- 共通 defs(粒子ノイズを含む)は画面に 1 つだけ。最初にマウントした `MilspecArmor` が `document.body` 直下に `svg#milspec-armor-defs`(幅 0・高さ 0・`aria-hidden`)を作り、以後は使い回す

- [ ] **Step 1: 失敗するテストを書く**(happy-dom。`ResizeObserver` はテスト内で手動発火できる偽物に差し替える)
  - `it('パネルの数だけ svg を描き、aria-hidden で操作を邪魔しない')`
  - `it('親の幅が変わると伸びる位置より右の点が動いた SVG に作り直す')`: 幅 274 → 300 で、パネルの polygon の points に `258,` が現れる(Task 3 の stretch テストと同じ点)
  - `it('テーマが変わると SVG を作り直す')`: `useThemeStore.setState({ theme: 'light' })` の前後で `innerHTML` が変わる(テスト内で `<html>` に `--ma-pri-top` をダーク値/ライト値で切り替えて与える)
  - `it('共通 defs は 2 つ描いても 1 つ')`: `MilspecArmor` を 2 個描いても `svg#milspec-armor-defs` は 1 個
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装** — CSS: `.theme-military .milspec-armor { position:absolute; inset:0; pointer-events:none; z-index:0 }` / `.theme-military .milspec-armor-panel { position:absolute; overflow:visible }`
- [ ] **Step 4: 確認** — vitest PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): 区画にパネルを描く MilspecArmor(実寸・テーマ・書体読込で作り直し)`

---

### Task 5: `MilspecKey` / `MilspecKeyCap`(キー)

**Files:**
- Create: `src/components/military/MilspecKey.tsx`
- Create: `src/components/military/__tests__/MilspecKey.test.tsx`
- Modify: `src/styles/military.css`(見本 css:143-180 のキー部分を `milspec-key` 系の名前に置き換えて移植)

**Interfaces:**
- Consumes: Task 3 の `capSVG` `bbox` `centroid` `offsetPoly`、Task 4 と同じ色の読み方
- Produces:
  - `export function MilspecKey(props: { cap: CapSpec; label?: React.ReactNode; onClick?: () => void; pressed?: boolean; disabled?: boolean; className?: string; labelOffset?: Pt } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>): JSX.Element` — `<button type="button" class="milspec-key">` の中に、ホバー層 `.milspec-key-hov` > 押し込み層 `.milspec-key-kf` > キーの SVG + 刻印 `.milspec-key-lb`、当たり判定の SVG(見本 js:281-288 と同じ構造)。`aria-*` と `data-*` はそのまま `<button>` へ渡す。`pressed` は `aria-pressed` に出す
  - `export function MilspecKeyCap(props: { cap: CapSpec; label?: React.ReactNode; className?: string }): JSX.Element` — 見た目だけ(`aria-hidden`、`<button>` を持たない)。既存の部品(ImportMenu など、自分で `<button>` を持つもの)の下に敷く用途

**決まり:**
- 押下の動き = 見本 js:681-720(抵抗 → 沈む → 底で当たる → バネで戻り少し行き過ぎて止まる・押している間は底で止まる)。WAAPI で transform のみ。`prefers-reduced-motion` のときは動かさない
- Enter / Space で `onClick` が呼ばれる(`<button>` の標準動作のまま)。`:focus-visible` で見本 css:150 の枠を出す
- キーの位置は親が決める(`MilspecKey` 自身は `position:absolute` にしない。置き方は各区画の計画で決める)

- [ ] **Step 1: 失敗するテストを書く**
  - `it('button として描かれ、aria-label と aria-pressed が渡る')`
  - `it('クリックと Enter / Space で onClick が呼ばれる')`(`@testing-library/user-event`)
  - `it('disabled のときは onClick が呼ばれない')`
  - `it('MilspecKeyCap は button を持たず aria-hidden')`
  - `it('動きを減らす設定では押しても animate を呼ばない')`(`Element.prototype.animate` を spy)
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — vitest PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): キー部品 MilspecKey / MilspecKeyCap(押下の重さ・キーボード操作・動きを減らす対応)`

---

### Task 6: 区画の骨組み(レールと隙間)+ 4 幅の検査

**Files:**
- Create: `src/components/military/MilspecRail.tsx` + `__tests__/MilspecRail.test.tsx`
- Modify: `src/components/military/MilspecLayout.tsx` / `__tests__/MilspecLayout.test.tsx`
- Modify: `src/components/military/MilspecSidebar.tsx`(開閉の取っ手 `.milspec-sb-collapse` をレールへ移すため、取っ手部分を削る)+ そのテスト
- Modify: `src/styles/military.css`(`.milspec-app` の `grid-template-columns` / 畳み時の `:has(...)` / 旧 seam・chrome・sb-collapse の CSS)
- Delete: `src/components/military/MilspecSeam.tsx` / `MilspecChrome.tsx` とそれぞれのテスト(`MilspecChrome.test.tsx` は既知の単独失敗テストを含む)
- Create: `scripts/milspec-polish/zone-fit.mjs`

**Interfaces:**
- Produces: `export function MilspecRail(props: { isSidebarOpen: boolean; onToggleSidebar: () => void }): JSX.Element` — `div[data-ms-zone="rail"]` 内に、サイドバー開閉の `<button>`(`aria-label` は今の `.milspec-sb-collapse` と同じ文言キー・`aria-expanded={isSidebarOpen}`)
- 列 = 見本 js:789, 792-793: 開 `274px 22px 1fr`・閉 `0 22px 1fr`。列の隙間 `column-gap: 2px`(隙間から背景動画が見える)。行の構成(header / workspace / footer)と行の高さはこの計画では変えない(各区画の計画で変える)

- [ ] **Step 1: 失敗するテストを書く**
  - `MilspecRail.test.tsx`: 取っ手が `aria-expanded` を持ち、クリックで `onToggleSidebar` が呼ばれる
  - `MilspecLayout.test.tsx` を更新: `[data-ms-zone="rail"]` がある / `[data-ms-zone="seam"]` と `.milspec-console-frame` が無い / 背景動画が先頭の子のまま
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装** — `MilspecSeam` の位置(grid-area `seam`)を `rail` に置き換える。サイドバーの取っ手は `MilspecRail` へ移し、`MilspecSidebar` からは消す
- [ ] **Step 4: `zone-fit.mjs` を書く** — `launch` / `gotoMiti` / `applyFixture({military:true})` を使い、viewport 1280×720 / 1489×679 / 1920×1080 / 2560×1440 × サイドバー開・閉で、`.milspec-app` 内の見えている `button, a[href], [role="button"], [role="tab"], input, select` すべてについて (a) 矩形が viewport 内 (b) 中心点の `document.elementFromPoint` がその要素自身か子孫、を確かめる。表の中(`#timeline-scroll-container` 等の縦スクロール領域の中)の要素は (a) を「スクロール領域の矩形の内側にあるものだけ」対象にする。違反があれば要素の `aria-label`/テキストと幅を出して exit 1
- [ ] **Step 5: 確認** — vitest(Rail / Layout / Sidebar)PASS / `npx tsc -b` exit 0 / dev サーバで `standard-invariance.mjs` `military-smoke.mjs` `zone-fit.mjs` が exit 0。`zone-fit.mjs` が 1280 で失敗した場合は、その要素の一覧を報告して止まる(勝手にサイドバー幅を変えない)
- [ ] **Step 6: Commit** — `feat(milspec): 区画の骨組みを v11 に(レール新設・隙間 2px・旧 seam/chrome 撤去)+ 4 幅の隠れ検査`

---

### Task 7: 表のスクロール性能の計測(基準取り)

**Files:**
- Create: `scripts/milspec-polish/scroll-perf.mjs`
- Modify: `docs/TODO.md`(MIL-SPEC の状態行に計測値を 1 行)

**Interfaces:**
- Produces: `node scripts/milspec-polish/scroll-perf.mjs [--theme=standard|military] [--save=<name>] [--compare=<name>]`。結果は `scripts/milspec-polish/.perf/<name>.json`(コミットしない。`.gitignore` に `scripts/milspec-polish/.perf/` を追加)

**決まり:**
- 計測方法は `docs/.private/perf-tools/README.md` の罠に従う(最初に読む)。本番ビルド(`npm run build` → `npx vite preview`)で測る。dev では測らない
- fixture: 1/2/3 段の混在行を含む 300 行以上の表(`_fixture.mjs` の既存 fixture を使えるか確認し、足りなければ同ファイルに `applyFixture` のオプションを足す)
- 測るもの: 表の縦スクロール領域を一定速度で 3 秒スクロールしたときの `requestAnimationFrame` 間隔の p50 / p95 / 16.7ms 超の割合。3 回測って中央値
- `--compare` は基準と比べて p95 が 10% 以上悪化したら exit 1

- [ ] **Step 1: スクリプトを書く**
- [ ] **Step 2: 標準と軍事の基準を保存** — `--theme=standard --save=base-standard` と `--theme=military --save=base-military`
- [ ] **Step 3: 同じ条件で `--compare=base-military` を 1 回流し、exit 0 になる(計測のぶれが 10% 未満)ことを確認**。ぶれが大きければ回数・時間を増やす
- [ ] **Step 4: TODO に計測値を記録** — 「MIL-SPEC スクロール基準(本番ビルド・1489×679): 標準 p95=○ms / 軍事 p95=○ms」
- [ ] **Step 5: Commit** — `test(milspec): 表のスクロール性能の計測スクリプトと基準`

---

## この後の計画(区画ごと・この土台を使う)

spec §11 の順番で、区画ごとに 1 本ずつ計画を書く。各計画の最後のゲートは「見本と同じ幅(1489×679)でスクショを撮り、見本と並べて突き合わせ → masaya 目視」。

1. サイドバー(S1〜S3・ツリーの引き出し・PLAN CORE 基板・まとめて共有/選択削除の配線)
2. ヘッダー + 通気口(H1〜H5・銘板・計器・タービン 2 基・攻略の軌跡・共有/同期キー・ヘッダーの開閉を通気口へ)
3. 表の操作列 + 差込口 + 表(照準・致死の斜線・行のぼかし影の置き換え・`scroll-perf.mjs --compare`)
4. フッター + レールの装甲
5. 光(配線を走る光・選択のエネルギー・常時の光)
6. 大レバー + 電源投入演出
