# MIL-SPEC v11 移植 — 区画① サイドバー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軍事テーマのサイドバーを、見本 v11 の S1〜S3 と**同じ見た目・同じ動き**(装甲・キー・ツリーの引き出し・PLAN CORE 基板・光)にし、標準テーマの「まとめて共有」「選択削除」を軍事でも使えるようにする。

**Architecture:** 見本の座標はすべて `sidebarGeometry.ts` に集め(純関数)、`MilspecArmor`(装甲)・`MilspecKey`(キー)・新設の `MilspecPlanCore`(基板)がそれを読んで描く。区画の幅は 274px 固定なので横には伸ばさず、縦だけ「y > 300 の点は区画の高さの差だけ下へ」動かす。光は見本の光エンジン(`pulse` / `burst` / `emit` / `leak` / `coreFire` / `energy` / `ambient`)を `src/components/military/fx/` へ移し、経路は DOM の `data-trace` 属性で名前を引く(登録の後片付けが要らない。まだ作っていない区画の経路名は見つからず静かに何もしない=後の区画が経路を足すと自動で光る)。複数選択は標準 `Sidebar.tsx` の処理をフック `usePlanMultiSelect` に切り出して両方から使う(標準の DOM・見た目は不変)。

**Tech Stack:** React 19 + Vite 7 + TypeScript / zustand / vitest(happy-dom・`--pool=forks`)/ Playwright(`scripts/milspec-sp2/_fixture.mjs`)

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`(§7・§11)。正典 = `C:\Users\masay\Desktop\FF14Sim\docs\.private\theme-refs\milspec-v11-full.html` + `milspec-v11.css` + `milspec-v11.js`(親リポジトリ側の gitignore 済みフォルダ。以下 `css:` `js:`)。棚卸し = `C:\Users\masay\Desktop\FF14Sim\docs\.private\2026-10-21-milspec-v11-inventory.md`。土台 = `docs/superpowers/plans/2026-10-21-milspec-v11-foundation.md`。

## 決定事項(2026-10-21 masaya)

- **見本と同じ完成度・同じアニメーションを最優先**。重くなってもまず見本どおりに動かす(軽量化は本番で見てから)。設計書 §4/§11 の「常時の光は十数秒に 1 本」は、見本どおり 0.8〜2.5 秒ごとに上書きする。見本と同じく、タブ非表示・`prefers-reduced-motion` では止める
- 置き場所は見本どおり: S1 中段 = 新規作成 / まとめて共有 / 選択削除。見本で「アップデート」(本体に機能なし)だった S3 上段のキーは同じ形で「取り込み」にする。「Template」と「現在のプランを削除」キーは置かない(見本に無い。1 件の削除は各プラン行の ✕ で 2 段確認)
- 複数選択中の見た目(見本に無いので Claude 判断): 2 つのキーは押すと沈んだまま。プラン行を押すと選択の入/切・選択中は左のランプが緑。ツリー上端に「選択 N(/10)・実行・取消」の帯。選択削除の実行はカバー付き 2 段(§7)

## Global Constraints

- 標準テーマは 1px も変えない: dev サーバ起動中に `node scripts/milspec-sp2/standard-invariance.mjs` が exit 0
- 軍事テーマの既存操作: `node scripts/milspec-sp2/military-smoke.mjs` が exit 0
- 背景動画・書体のコスト検査: `node scripts/milspec-polish/no-video-in-standard.mjs` が exit 0
- **動きは見本の値(時間・イージング・キーフレーム・遅延・乱数の幅)をそのまま移す**。勝手に間引かない・短くしない
- CSS はすべて `.theme-military` 前置で `src/styles/military.css` に書く。新クラスは `milspec-` 接頭辞(見本の `.tree` `.it` `.lg` `.pz-g` などをそのまま使わない)。見本の `#app.pc` は `.theme-military.theme-light`、`--on` などは土台の `--ma-*` へ読み替える
- 既存の `.milspec-lamp`(旧ランプ・ヘッダー等で使用中)は触らない。v11 のランプは別名 `milspec-led`
- 削除の 2 段確認(1 回目で武装・3 秒で解除・2 回目で実行)は 1 件削除・一括削除の両方で必ず残す
- i18n: 新しい文言キーは `src/locales/{ja,en,zh,zh-Hant,ko}.json` の 5 つすべてに同時に足す(該当ブロックだけを文字列として編集し、ファイル全体を整形し直さない)
- 見本の HTML/CSS/JS ファイルはコミットしない。見本のコードを TS へ移すのは可
- テストは `__tests__/` 配下。vitest は `npx vitest run --pool=forks <ファイル>` で変更ファイルに絞る。型は `npx tsc -b` exit 0
- コミットは `git commit -F <一時ファイル>`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。コメントは日本語

## Review Focus

1. **一括削除で選んでいないプランが消える / 消えない**: → Task 5 のテスト「選んだ ID だけを、ログイン時は deleteFromFirestore で消す」
2. **圧縮されたプランへの切替でデータが消える**: ツリーを作り直しても `selectPlan` の手順(保存 → 解凍 → 切替)を変えない → Task 6 で既存テスト「圧縮プランは解凍完了まで setCurrentPlanId を呼ばない」を残して通す
3. **画面の高さが見本と違う(720 / 1080 / 1440)**: S3 が下に貼り付かない・基板の IC が切れる・光の経路がずれる → Task 3「高さ 1080 で S3 が 401px 下がる」/ Task 2「高さで IC が下に付いてくる」/ Task 7 で光の経路も `sbY` を通す
4. **光の粒が溜まり続ける(タブを長時間開きっぱなし)**: 1 発ごとに要素 2 個を足して終わったら消す → Task 4「アニメが終わると複製を消す」「タブ非表示では常時の光を出さない」
5. **英語など長い文言でキーの刻印がはみ出す**: → Task 8 の zone-shot で ja と en を測る

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Create `src/components/military/MilspecDecor.tsx` | 小さな飾り: `MilspecLed` `MilspecStencil` `MilspecMark` `MilspecScrew` `MilspecRivet` `MilspecMaintPlate` `MilspecBarcode` |
| Create `src/components/military/milspecIcons.tsx` | 見本のアイコン(使う分) |
| Create `src/components/military/armor/pcb.ts` | 基板の部品と `planCoreSVG`(純関数) |
| Create `src/components/military/MilspecPlanCore.tsx` | PLAN CORE 基板(高さに追従) |
| Create `src/components/military/sidebarGeometry.ts` | サイドバーの見本座標と縦の伸び縮み |
| Create `src/components/military/fx/engine.ts` | 光エンジン(pulse / burst / lenAt / emit / leak / dotFlash / coreFire / energy / ambient) |
| Create `src/components/military/fx/MilspecFxLayer.tsx` | 区画に光の経路(継ぎ目・漏れ光)を置く SVG 層 |
| Create `src/hooks/usePlanMultiSelect.ts` | 複数選択の state と処理(標準 Sidebar.tsx から切り出し) |
| Modify `src/components/Sidebar.tsx` | 切り出したフックを使う(DOM・見た目は不変) |
| Modify `src/components/military/MilspecContentTree.tsx` | 見本のツリーと選択モード・光 |
| Modify `src/components/military/MilspecSidebar.tsx` | S1〜S3 の組み立て・光の配線 |
| Modify `src/components/military/MilspecLayout.tsx` | 常時の光の開始/停止 |
| Modify `src/styles/military.css` | v11 のサイドバー・光の CSS を追加・旧サイドバー CSS を削除 |
| Modify `src/locales/*.json`(5 つ) | 新しい文言キー |
| Create `scripts/milspec-polish/zone-shot.mjs` | 見本と本体の区画を同じ条件でスクショ + 刻印はみ出し検査 |
| Modify `scripts/milspec-sp2/military-smoke.mjs` | サイドバーの操作を追加 |

---

### Task 1: 小さな飾り部品とアイコン

**Files:**
- Create: `src/components/military/MilspecDecor.tsx` / `src/components/military/milspecIcons.tsx`
- Create: `src/components/military/__tests__/MilspecDecor.test.tsx`
- Modify: `src/styles/military.css`(SP1 サイドバー節の手前に「v11 飾り」節を新設)

**Interfaces:**
- Produces(すべて `aria-hidden="true"`。位置は親が `style` で渡す):
  - `MilspecLed(props: { state?: 'off' | 'on' | 'warn' | 'dng'; size?: number; flick?: boolean; style?: CSSProperties }): JSX.Element` — 見本 `lampH`(js:250)と同じ 3 層 `span.milspec-led > i.milspec-led-lens > i.milspec-led-src`。`state` → class `is-on` / `is-warn` / `is-dng`、`size` → `--s`、`flick` → class `is-flick`(見本 `.lamp.flick`。点灯した瞬間のチラつき)
  - `MilspecStencil(props: { en: string; sub?: string; hi?: boolean; style? })` — 見本 `lgH`(js:253)。`sub` が空なら副題の span を出さない
  - `MilspecMark(props: { text: string; style? })` — 見本 `idH`(js:251)
  - `MilspecScrew(props: { rotate?: string; style? })`(ホバーで回る css:111-116)/ `MilspecRivet(props: { style? })`(css:604-605)
  - `MilspecMaintPlate(props: { title: string; bars: number[]; width: number; style? })` — 見本 js:849
  - `MilspecBarcode(props: { h?: number; style? })` + `export function barcodeRects(h: number, bars?: number[]): { w: number; rects: { x: number; w: number }[] }` — 見本 `barH`(js:252)の計算
  - `milspecIcons.tsx`: `export const MsIcon: Record<'plus'|'share'|'multi'|'imp'|'save'|'rest'|'dup'|'rename'|'close'|'fold', () => JSX.Element>`。plus〜rest は js:254-273、`dup` `rename` `close` は js:824、`fold` は js:825

**CSS(見本 → 新クラス):** css:97-101(`.lg` → `.milspec-stencil`・`.mid` → `.milspec-mark`)/ css:110-116(`.scr` → `.milspec-screw`)/ css:118-141(`.lamp` → `.milspec-led`。`blink` は今回使わないので移さない。`flick` は移す。`#app[data-power="off"]` の規則は区画⑥まで移さない)/ css:604-609(`.rv` `.mp` `.bc`)

- [ ] **Step 1: 失敗するテストを書く** — `MilspecDecor.test.tsx`
  - `it('MilspecLed は 3 層で aria-hidden、state と flick が class になる')`
  - `it('MilspecStencil は sub が空なら副題を出さない')`
  - `it('barcodeRects は見本 barH と同じ幅')`: `barcodeRects(6).w` を `toBeCloseTo(32.9, 1)`(既定 18 本: 0.7×合計 29 + 0.7×18)、`rects.length === 9`
- [ ] **Step 2: 失敗を確認** — `npx vitest run --pool=forks src/components/military/__tests__/MilspecDecor.test.tsx` → FAIL
- [ ] **Step 3: 実装**(CSS を含む)
- [ ] **Step 4: 確認** — vitest PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): v11 の飾り部品(ランプ・刻印・ネジ・リベット・点検板・バーコード)とアイコン`

---

### Task 2: PLAN CORE 基板

**Files:**
- Create: `src/components/military/armor/pcb.ts` + `armor/__tests__/pcb.test.ts`
- Create: `src/components/military/MilspecPlanCore.tsx` + `__tests__/MilspecPlanCore.test.tsx`
- Modify: `src/styles/military.css`(css:358-369, 593-598 を `.milspec-pcb` 配下へ)

**Interfaces:**
- Consumes: `geom.ts` の `pd` `P` `busPaths`
- Produces:
  - `pcb.ts`: `export const PLAN_CORE = { w: 249.2, h0: 451.2, sy: 161.6 }` / `export function planCoreSVG(o: { h: number; id: string }): string` — 見本 `buildPlanCore`(js:480-530)と、それが使う `cu` `via` `silk` `smd` `qfp4`(js:367-375, 468-479)を文字列で組み立てる。返すのは `<svg>` の**中身**
  - `MilspecPlanCore(props: { style?: CSSProperties }): JSX.Element` — `svg.milspec-pcb.milspec-plan-core[aria-hidden]`。幅 249.2 固定、高さは親から渡された値ではなく自分の親要素の実高(ResizeObserver。0 は無視)

**決まり:**
- 縦の伸び縮み: 見本の座標で `y > PLAN_CORE.sy` の点はすべて `y + (h - PLAN_CORE.h0)` へ。配線・ビア・IC・部品・シルク文字・クリップの多角形すべてに同じ規則(座標を出力する直前に 1 つの関数 `Y(y)` を通す)
- 光の経路: 配線の `<path>` に `data-trace="<見本の経路名>"`(`s2k0`〜`s2k3` / `s2x0`〜`s2x3` / `s2L0`〜`s2B5`)。端子がある配線は `data-trace-end="x,y"`(見本 `o.end`。Y 変換後の値)
- `core-glow`(js:519)は `opacity="0"` で入れ、class `milspec-core-glow`(Task 4 の `coreFire` が光らせる)
- SVG の id は `o.id` を接頭辞にする

- [ ] **Step 1: 失敗するテストを書く** — `pcb.test.ts`
  - `it('見本の高さでは IC が見本の位置')`: `planCoreSVG({ h: 451.2, id: 't' })` に x=111・y=359 の IC の rect と文字 `PLAN CORE`
  - `it('高さが伸びると IC が下に付いてくる')`: `h: 852` で IC の rect の y が 759.8、幹線の始点 `M 3.6 0` は不変
  - `it('配線に経路名と端子位置が付く')`: `data-trace="s2k0"` `data-trace="s2B5"` と `data-trace-end=` を含む
  - `it('id 接頭辞が付く')`: `clip-path="url(#t)"` と `id="tg"` を含む
  - `MilspecPlanCore.test.tsx`: `it('aria-hidden で、親の高さが変わると作り直す')`(ResizeObserver を偽物に差し替え、451.2 → 852 で innerHTML が変わる)
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): サイドバーの基板 PLAN CORE(高さに追従・光の経路名つき)`

---

### Task 3: サイドバーの座標表

**Files:**
- Create: `src/components/military/sidebarGeometry.ts` + `__tests__/sidebarGeometry.test.ts`

**Interfaces:**
- Consumes: `armor/types.ts` の `PlacedPanel` `StretchFrame` `CapSpec` `Pt`、`geom.ts` の `bank` `shift` `chamRect`
- Produces:
  - `export const SB_FRAME: StretchFrame = { w0: 274, h0: 679, sx: 274, sy: 300 }`
  - `export function sbY(y: number, h: number): number` — `y > 300 ? y + (h - 679) : y`
  - `export function sbPath(d: string, h: number): string` — M/L/H/V 絶対座標の path の y を `sbY` で変換(光の経路用)
  - `export const SB_PANELS: PlacedPanel[]` — 4 枚: S1(js:800-802)/ S2(js:814-817)/ 補修板(js:818)/ S3(js:844)。キー列が乗るパネルの `pockets` に受け皿を入れる(見本 `cluster` js:291 と同じ: `{ b: 1.8, pts: shift(outline, 列x - パネルx, 列y - パネルy) }`)。S2 の基板の床 pocket(`b: 2.4`・`fill: 'var(--ma-pcb)'`)は見本どおり
  - `export interface SbKeyRow { id: 'content' | 'actions' | 'service' | 'dock'; x: number; y: number; caps: CapSpec[] }` / `export const SB_KEY_ROWS` — `content` = (12,17) `bank(cOut,[1.0,0.7,1.0,1.36])`・`lip: true` / `actions` = (12,66) `bank(aOut,[1.15,1.3,1.12])` / `service` = (12,619) `bank(uOut,[1])` / `dock` = (12,646) `bank(bOut,[1,0.82])`。輪郭 cOut / aOut / uOut / bOut は js:804, 809, 846, 855
  - `export const SB_TREE_BOX = { x: 12, y: 138, w: 250, h0: 452 }`
  - `export const SB_DECOR` — 刻印 `CONTENT SELECT`(20,7)・`SERVICE`(150,620.5)・`IDX-2 · PLAN INDEX`(14,123)/ 型番 S1(247,56)・S2(240,121)・S3(246,627.4)/ ネジ (159,107,'10deg')・(183,107,'70deg')/ リベット (24.2,596.4)・(55.2,596.4)/ 点検板 (150,628.2)/ バーコード (212,628.8)
  - `export const SB_TRACES: { name: string; d: string; pc: 'seam' | 'leak' }[]` — 光の経路(区画座標・絶対座標):
    - `s1` seam `'M 10 60 H 116 L 120 56 H 228 L 232 60 H 236'`(js:807 を絶対化。S1 は区画の (0,0) なのでそのまま区画座標)
    - `s3` seam: S3 パネル (0,612) の seam js:845 を区画座標へ = `'M 8 643.2 H 146 L 149 640.2 H 264'`
    - `lk:s1s2` leak `'M 4 112 H 137 L 146.5 121 H 203.5 L 213 112 H 270'`(js:852)
    - `lk:s2s3` leak `'M 8 609 H 230 L 237 616 H 272'`(js:853 を絶対化)
    - `lk:s2rail` leak `'M 275 118 V 604'`(js:854)
- 装甲パネルに入れる scribes / seams も絶対座標に直す(`stretchPath` は M/L/H/V の絶対座標だけ): S1 seam `'M 10 60 H 116 L 120 56 H 228 L 232 60 H 236'`・scribe `'M 142 105 H 206'` / S2 scribes `'M 264 460 L 244 480'` `'M 5.5 34 V 466'` `'M 12 16 H 124 L 128 20'` `'M 232 20 L 236 16 H 268'` / S3 seam `'M 8 31.2 H 146 L 149 28.2 H 264'`(パネル座標)

- [ ] **Step 1: 失敗するテストを書く**
  - `it('受け皿がパネルに入る')`: S1 の `pockets.length === 2`、S3 は 2、S2 は 1
  - `it('キーの数')`: content 4 / actions 3 / service 1 / dock 2
  - `it('パス命令が絶対座標だけ')`: すべての scribes / seams / SB_TRACES の d が `/^[MLHV0-9 .\-]+$/`
  - `it('高さ 1080 で S3 が 401px 下がり S1 は動かない')`: `stretchPlaced(S3, SB_FRAME, 274, 1080).y === 1013`、S1 の y は 0、S2 の h は 893
  - `it('sbY と sbPath')`: `sbY(619, 1080) === 1020` / `sbY(17, 1080) === 17` / `sbPath('M 8 609 H 230 L 237 616 H 272', 1080) === 'M 8 1010 H 230 L 237 1017 H 272'`
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): サイドバーの見本座標表(装甲・受け皿・キー・飾り・光の経路)と縦の伸び縮み`

---

### Task 4: 光エンジン

**Files:**
- Create: `src/components/military/fx/engine.ts` + `fx/__tests__/engine.test.ts`
- Create: `src/components/military/fx/MilspecFxLayer.tsx` + `fx/__tests__/MilspecFxLayer.test.tsx`
- Modify: `src/components/military/armor/defs.ts`(`ensureDefs` の共通 defs に見本 js:1209-1211 の `fxglow` `fxglow2` `fxglow3` を足す。id は `milspec-fxglow` `milspec-fxglow2` `milspec-fxglow3`)
- Modify: `src/styles/military.css`(css:371-376, 599-602 → `.milspec-pz-g` `.milspec-pz-c` `.milspec-tdot-f`。`url(#fxglow)` は新 id に。`--sig-rgb` `--sig-hot` `--warn-rgb` `--warn-hot` が `--ma-*` に無ければ見本 css:68-77 の値で足す)
- Modify: `src/components/military/MilspecLayout.tsx`(マウント時に `startAmbient()`、アンマウントで止める)

**Interfaces:**
- 経路の引き方: `.milspec-app` 内の `path[data-trace="<名前>"]`。付属属性 `data-trace-pc`(`seam` / `leak` / 空)・`data-trace-next`(続きの経路名)・`data-trace-end`(`"x,y"` 端子位置)。見つからない名前は何もしない(0 を返す)
- Produces(`engine.ts`。見本の同名関数と同じ計算・同じ既定値・同じ乱数の幅):
  - `isFxActive(): boolean` — `prefers-reduced-motion` でない・`document.hidden` でない・`document.documentElement.dataset.msPower !== 'off'`(電源は区画⑥。今は常に on 扱い)
  - `pulse(name: string, o?: PulseOpts): number` — js:319-336。複製 2 本(class `milspec-pz-g` / `milspec-pz-c` + pc + o.cls)を元の path の隣に足し、`strokeDashoffset` を WAAPI で動かし、終わったら消す。`chain` と `data-trace-next` で続きへ。戻り値 = 遅延+時間(ms)。`netBlink`(js:316-318)は `onSignal` コールバック(`setFxSignalListener(fn)` で登録。区画②のヘッダーの NET ランプが使う。今は未登録で何もしない)
  - `type PulseOpts = { from?: number; to?: number; rev?: boolean; len?: number; delay?: number; dur?: number; speed?: number; ease?: string; cls?: string; chain?: boolean }`
  - `burst(prefix: string, o?: PulseOpts & { n?: number; stagger?: number; jit?: number }): void` — js:337-341
  - `lenAt(path: SVGPathElement, x: number, y: number): number` — js:342(121 点)
  - `toPathSpace(path: SVGPathElement, clientX: number, clientY: number): { x: number; y: number }` — 画面座標 → その path の座標(`getScreenCTM().inverse()`)。見本の「区画の左上 − 層の位置」の引き算の代わり
  - `emit(node: Element, name: string, o?: PulseOpts & { both?: boolean }): number` — js:343-350。node の中心を `toPathSpace` → `lenAt`
  - `leak(name: string, delay?: number, o?: PulseOpts): number` — js:535(`len: 26, speed: 1.05, chain: false`)
  - `dotFlash(svg: SVGElement, x: number, y: number, delay: number): void` — js:536-541
  - `coreFire(d: number, o?: { dim?: boolean }): void` — js:543-553。`.milspec-plan-core` 内の `.milspec-core-glow` と `s2L/R/T/B 0〜5`。端子は `data-trace-end`
  - `energy(src: Element | null): void` — js:555-583 を全部移す(ツリー内なら幹線 `s2k0` の x=3.6 で、行の中心の高さから流す。`toPathSpace` で行の中心 y を基板座標に直して `lenAt(path, 3.6, y)`)。レール・ヘッダー・通気口・ジョブ基板の経路名(`rail:a*` `lk:hdr` `lk:tb` `h5a` `h5b` `ventL:` `ventR:` `bp:*`)も見本どおり呼ぶ(今は見つからず何もしない)。`trafficBp`(js:352-356)も同ファイルに移す
  - `startAmbient(): () => void` — js:357-365。重み表 AMB(js:357)・間隔 800〜2500ms・5% で `coreFire(0, { dim: true })`。戻り値で停止(タイマー解除)
  - `MilspecFxLayer(props: { traces: { name: string; d: string; pc?: string; next?: string }[] }): JSX.Element` — 区画全面の `svg.milspec-fx[aria-hidden]`(`position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:1`)に、各経路を `path.milspec-trc[data-trace]`(`fill:none; stroke:none`)で置く

- [ ] **Step 1: 失敗するテストを書く** — `engine.test.ts`(happy-dom。`SVGPathElement.prototype.getTotalLength` を 100 を返す偽物に、`Element.prototype.animate` を `{ onfinish: null, cancel() {} }` を返す spy に差し替える)
  - `it('pulse は複製を 2 本足し、アニメが終わると消す')`: 呼んだ直後 `.milspec-pz-g` と `.milspec-pz-c` が 1 本ずつ・spy の戻り値の `onfinish()` を呼ぶと 0 本
  - `it('pulse は見本と同じ dash を使う')`: `len: 12` で `strokeDasharray === '12 136'`(L=100: `12 ${100 + 36}`)、animate の keyframes が `[{strokeDashoffset: 12}, {strokeDashoffset: -100}]`
  - `it('名前が無い・動きを減らす・タブ非表示なら何もせず 0')`
  - `it('data-trace-next があれば終点まで行った光が続きへ流れる')`(偽タイマー)
  - `it('burst は接頭辞の経路から n 本だけ流す')`
  - `it('startAmbient はタブ非表示のとき光を出さず、停止関数でタイマーが止まる')`(偽タイマー)
  - `it('energy はツリー内の要素から幹線 s2k0〜s2k3 に流し、そのあと IC を光らせる')`: `s2k0`〜`s2k3` に複製ができ、時間を進めると `s2L0` にも複製ができる
  - `MilspecFxLayer.test.tsx`: `it('経路を data-trace 付きで置き、aria-hidden')`
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — PASS / `MilspecLayout.test.tsx` PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): 光エンジン(光の粒・束・押した所から・漏れ光・IC の発火・選択のエネルギー・常時の光)`

---

### Task 5: 複数選択を標準 Sidebar からフックへ切り出す(標準の動きは不変)

**Files:**
- Create: `src/hooks/usePlanMultiSelect.ts` + `src/hooks/__tests__/usePlanMultiSelect.test.ts`
- Modify: `src/components/Sidebar.tsx`(state 849-855・1189-1190 / `toggleMultiSelectMode` 1165-1174 / `toggleItemId` 1176-1186 / `handleShareBundle` 1192-1231 / 削除ループ 1826-1840 をフックに置き換える。JSX・class・文言・フローティングバー・確認ダイアログ・Shift 選択・見出しの一括選択の DOM は**そのまま**)

**Interfaces:**
- Consumes: `MultiSelectState`(`src/types/sidebarTypes.ts:27`)、Sidebar.tsx が今使っている store・`decompressPlanData`・`showToast` と同じ import
- Produces:
```ts
export const MULTI_SHARE_LIMIT = 10;
export function usePlanMultiSelect(): {
  multiSelect: MultiSelectState;
  setMultiSelect: React.Dispatch<React.SetStateAction<MultiSelectState>>; // 標準の Shift 選択・見出し一括選択用
  toggleMode: (mode: 'share' | 'delete') => void;   // 同じモード 2 回目 → 解除 / 別モード → 選択を空にして切替
  toggleId: (id: string) => void;                   // share は 10 件まで
  reset: () => void;
  bundleOpen: boolean;
  bundlePlans: { contentId: string | null; title: string; planData: any }[];
  openBundleShare: () => Promise<void>;             // 今の handleShareBundle と同じ手順
  closeBundleShare: () => void;                     // モーダルを閉じて reset
  deleteSelected: () => Promise<void>;              // 今の削除ループと同じ。終わったら reset
};
```
- 標準の `showDeleteConfirm` は Sidebar.tsx に残す

- [ ] **Step 1: 失敗するテストを書く** — `usePlanMultiSelect.test.ts`(`renderHook`)
  - `it('同じモードを 2 回押すと解除、別モードへは選択を空にして切替')`
  - `it('共有モードは 10 件まで、削除モードは無制限')`
  - `it('選んだ ID だけを、ログイン時は deleteFromFirestore、未ログイン時は deletePlan で消し、終わると解除')`
  - `it('まとめて共有: 現在プランを保存し、解凍に失敗したプランを除いてモーダルを開く')`
  - `it('まとめて共有: 1 件も残らなければトーストを出してモーダルを開かない')`
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装** — 関数の本体をそのまま移す(手順・呼ぶ関数・順番を変えない)
- [ ] **Step 4: 確認** — 新テスト PASS / 標準 Sidebar を描く既存テスト PASS / `npx tsc -b` exit 0 / dev サーバで `standard-invariance.mjs` exit 0
- [ ] **Step 5: Commit** — `refactor(sidebar): 複数選択(まとめて共有・選択削除)の state と処理を usePlanMultiSelect に切り出し`

---

### Task 6: ツリー(引き出し・層の行・プラン行・選択モード・光)

**Files:**
- Modify: `src/components/military/MilspecContentTree.tsx` + `__tests__/MilspecContentTree.test.tsx`
- Modify: `src/styles/military.css`(見本 css:412-453 → 新クラス。`.tree .it` の clip-path は polygon なので可)
- Modify: `src/locales/*.json`(5 つ)

**Interfaces:**
- Consumes: Task 1 の `MilspecLed` `MsIcon`、Task 4 の `energy`
- Produces: `MilspecContentTree(props: { tab: MilspecTreeTab; select?: { mode: 'share' | 'delete'; selectedIds: string[]; onToggle: (id: string) => void } })`。`select` が無いときは今までどおり。既存 export(`MilspecTreeTab` `useMilspecTreeTabs` `tabForPlanCategory`)は変えない
- 新しい文言キー(5 言語・Task 7 で使うものも含めてここで足す): `milspec.sb_select_count`(ja `選択 {{count}}`)/ `milspec.sb_bulk_delete_armed`(ja `もう一度押すと{{count}}件を削除`)/ `milspec.sb_series_fold`・`milspec.sb_series_unfold`(ja `シリーズを畳む`・`シリーズを開く`)/ `milspec.sb_content_sub`(ja `コンテンツ`・en は空文字)/ `milspec.sb_service_sub`(ja `保守`・en は空文字)/ `milspec.sb_content_group`(ja `コンテンツ種別`)

**見本との対応:**
| 見本 | 本体 |
|---|---|
| `.tree .hd` + `.fold`(js:825, 827) | 零式タブのシリーズ見出し `div.milspec-tr-hd` + `button.milspec-tr-fold[aria-expanded][aria-label]`。見出しの文字クリックでも開閉(js:1096)。初期 = 現在プランのシリーズだけ開く(無ければ先頭) |
| `.grp-list` | `div.milspec-tr-list`(閉じたら `hidden`) |
| `.it` = 層 | コンテンツ見出し `button.milspec-tr-it`(`.milspec-tr-n` = シリーズ内の 1 始まり 2 桁 / `.milspec-tr-nm` / `MilspecLed` = 現在のコンテンツなら `on`)。押したときの機能は今の `MilspecContentGroup` と同じ(プランがあれば開閉・無ければ新規作成) |
| `.plan` + `.ops` | `PlanRow` → `div.milspec-tr-plan[role=button](.is-sel)` + `.milspec-tr-ops`(複製 / 名前を変更 / 削除・2 段確認 `.is-armed`)。改名の動きは今のまま |
| `.add` | `button.milspec-tr-add`(上限なら出さない) |
| 絶・その他・アーカイブ | シリーズ見出しなしで `.milspec-tr-it` / `.milspec-tr-plan` を並べる(アーカイブはプラン行を直接) |

**動き(見本どおり):**
- 引き出し = 見本 `foldTo`(js:1120-1134)をそのまま。共通関数 `foldDrawer(list: HTMLElement, open: boolean, reduced: boolean): void` を同ファイルに置き、シリーズの開閉と層の開閉の両方で使う。`reduced` は `useReducedMotion`(`src/lib/housing/useReducedMotion`、MilspecKey と同じ)
- 層の行を押す = js:1102-1106: 押した行のランプに `flick`(付け直しで再生)・横の揺れ(js:1105 のキーフレーム・460ms)・`energy(行)`
- プラン行を選ぶ = js:1097-1100: `energy(行)`(プランの切替処理 `selectPlan` は今のまま)
- ホバー・押下・ops の出方・＋の回転・fold の回転は CSS(css:413-453)

**選択モード(`select` があるとき):** プラン行のクリック / Enter / Space は `onToggle(plan.id)`(切替しない)。行は `role="checkbox"` `aria-checked`。ops は出さない。行の左に `MilspecLed`(選択中 = `on`)

- [ ] **Step 1: 失敗するテストを書く**(既存 5 本はセレクタだけ新 class に直して残す)
  - `it('シリーズの開閉ボタンで一覧が開閉し aria-expanded が変わる')`
  - `it('現在のプランのシリーズだけ最初から開いている')`
  - `it('層の行に番号と、現在のコンテンツならランプ点灯')`
  - `it('層の行を押すと energy が呼ばれ、ランプに flick が付く')`(`fx/engine` を `vi.mock`)
  - `it('選択モードではプラン行を押すとプランを切り替えず onToggle が呼ばれる')`
  - `it('動きを減らす設定では開閉で animate を呼ばない')`
  - 既存の「圧縮プランは解凍完了まで setCurrentPlanId を呼ばない」「削除は2段階」が PASS
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): サイドバーのツリーを v11 に(シリーズの引き出し・層の行・プラン行・選択モード・光)`

---

### Task 7: サイドバーの組み立て(S1〜S3)

**Files:**
- Modify: `src/components/military/MilspecSidebar.tsx` + `__tests__/MilspecSidebar.test.tsx`
- Modify: `src/styles/military.css`(サイドバー区画。`.milspec-zone-sidebar` の `overflow:hidden` を `visible` に変える = 漏れ光 `lk:s2rail` が区画の右 1px 外を通るため。ツリー箱は自分でスクロールする)

**Interfaces:**
- Consumes: Task 1〜6、`MilspecArmor`(`{ id, frame, panels }`)、`MilspecKey`(`{ cap, label, onClick, pressed, latch, disabled, ... }`・位置は親が `style` の left/top)、`ShareModal`(`bundlePlans` モード。Sidebar.tsx:1693-1702 と同じ渡し方)

**構成(区画内すべて absolute。縦位置は `sbY(y, H)`、H は区画の実高 = ResizeObserver):**
- `MilspecArmor id="sb" frame={SB_FRAME} panels={SB_PANELS}`
- `MilspecPlanCore` を (12.4, 138.4)、高さ `sbY(589.6, H) - 138.4` の箱の中に
- `MilspecFxLayer traces={SB_TRACES の d を sbPath(d, H) で変換したもの}`
- S1 `content` 列: `div[role="group"][aria-label=milspec.sb_content_group]` に 4 キー(`sidebar.tab_*`)。`pressed` = 今のタブ・`latch`。押すとタブ切替。**切り替わったときに `energy(キー)`**(js:1017-1019)
- S1 `actions` 列: 新規作成(`sidebar.new_plan` → `milspec:new-plan`)/ まとめて共有(`sidebar.multi_select_mode` → `toggleMode('share')`・`pressed`=共有モード中・`latch`)/ 選択削除(`sidebar.select_delete` → `toggleMode('delete')`・同上)。アイコン plus / share / multi。**押すたびに `emit(キー, 's1', { both: true, len: 14 })`**(見本 `data-bus="s1"` js:810, 1023)
- S2: 刻印・型番。ツリー箱 `SB_TREE_BOX`(高さ `sbY(590, H) - 138`・縦スクロール・スクロールバー非表示 css:412)に `MilspecContentTree`(選択モード中は `select` を渡す)。選択モード中は箱の上端に**選択の帯** `div.milspec-sb-selbar`(`milspec.sb_select_count` + 共有なら `/10`・実行キー・取消キー)
  - 共有の実行 = `sidebar.share_together` → `openBundleShare()`
  - 削除の実行 = カバー付き 2 段: 1 回目で武装(`milspec.sb_bulk_delete_armed`・赤)・3 秒で解除・2 回目で `deleteSelected()`。0 件なら `disabled`
  - 取消 = `sidebar.cancel` → `reset()`。選択モード中は `Escape` でも `reset()`
- S3 `service` 列: 取り込み(`nav.import` → `useLocalImportDialog.getState().open()`)。アイコン imp。刻印 `SERVICE` + `milspec.sb_service_sub`・点検板 `MAINT LOG · 07`(bars 88/62/76%・幅 54)・バーコード・型番 S3
- S3 `dock` 列: バックアップ / 復元(今と同じモーダル)。アイコン save / rest
- 飾り: `SB_DECOR` を全部
- 撤去: 旧 CONTENT パネル(タブ・4 ボタン・Template・現在のプラン削除)・旧 DOCK・ステンシル `ENCOUNTER INDEX`
- `ShareModal`(bundle)を `bundleOpen` で描く

- [ ] **Step 1: 失敗するテストを書く**(`MilspecSidebar.test.tsx` を書き直す。「取っ手はサイドバー内に無い」「DEPLOYMENT は無い」は残す)
  - `it('装甲・基板・光の層・ツリーを描く')`: `[data-ms-armor="sb"]` / `.milspec-plan-core` / `path[data-trace="s1"]` / ツリー
  - `it('コンテンツのキーでタブが切り替わり、押したキーが aria-pressed=true、energy が呼ばれる')`(`fx/engine` を `vi.mock`)
  - `it('新規作成キーが milspec:new-plan を出し、s1 に光を流す')`
  - `it('まとめて共有キーで選択モードに入り、もう一度で抜ける')`
  - `it('選択削除は 1 回目で武装、2 回目で選んだプランだけ消す')` / `it('武装は 3 秒で解除')`(偽タイマー)
  - `it('Escape で選択モードを抜ける')`
  - `it('取り込みキーで取り込みダイアログ、バックアップ・復元キーでモーダルを開く')`
  - `it('Template と「現在のプランを削除」キーは無い')`
- [ ] **Step 2: 失敗を確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 確認** — `MilspecSidebar` `MilspecContentTree` `MilspecLayout` のテスト PASS / `npx tsc -b` exit 0
- [ ] **Step 5: Commit** — `feat(milspec): サイドバーを v11 の S1〜S3 に(装甲・キー・基板・光・まとめて共有/選択削除)`

---

### Task 8: 旧 CSS の撤去・検査の追加・見本との突き合わせ

**Files:**
- Modify: `src/styles/military.css`(旧サイドバー: `.milspec-sb` `.milspec-scenario` `.milspec-s-*` `.milspec-dock` `.milspec-tree-tabs/tab` `.milspec-tree-series-hd` `.milspec-tree-group` `.milspec-tree-head*` `.milspec-tree-plans` `.milspec-pi*` とその light / スクロールバー規則。消す前に各クラスを `grep -rn "<クラス名>" src` し、TSX から参照があるものは残す)
- Create: `scripts/milspec-polish/zone-shot.mjs`
- Modify: `scripts/milspec-sp2/military-smoke.mjs`
- Modify: `docs/TODO.md`

**Interfaces:**
- `node scripts/milspec-polish/zone-shot.mjs --zone=sidebar --mock=<見本 html の絶対パス> --out=<出力フォルダ> [--theme=dark|light] [--lang=ja|en]`
  - 見本: `file://` で開き、起動のレバー演出が終わるまで 2.5 秒待ち、`#z-sb` を撮る(viewport 1489×679・deviceScaleFactor 2)。ライトは見本のテーマ切替ロッカーを押してから撮る
  - 本体: `launch` / `gotoMiti` / `applyFixture({ military: true })` → `--lang` に切替(i18next の言語保存キーは `src/i18n` の設定から確認)→ `[data-ms-zone="sidebar"]` を同条件で撮る
  - `<out>/sidebar-mock-<theme>.png` / `<out>/sidebar-app-<theme>-<lang>.png`
  - 刻印はみ出し検査: 本体の `.milspec-key-lb` で `scrollWidth > clientWidth + 1` があれば文言を出して exit 1
  - 光の確認: 本体でコンテンツのキーを押した 400ms 後に `.milspec-pz-c` が 1 本以上あること(無ければ exit 1)。その瞬間も撮って `<out>/sidebar-app-energy.png`
- `military-smoke.mjs` に step: 「コンテンツキーで絶タブ」「シリーズの開閉で aria-expanded 反転」「まとめて共有キーで選択の帯が出て、Escape で消える」

- [ ] **Step 1: 旧 CSS を消す** → `npx tsc -b` exit 0 / Task 6・7 の vitest PASS
- [ ] **Step 2: スクリプトを書く**
- [ ] **Step 3: ゲート**(dev サーバ起動中)
  - `standard-invariance.mjs` / `military-smoke.mjs` / `no-video-in-standard.mjs` → すべて exit 0
  - `zone-fit.mjs` → **サイドバーとレールの要素の違反 0 件**(ヘッダー/フッターの既知の失敗は区画②④で解消。件数だけ記録)
  - `zone-shot.mjs` を dark/ja・light/ja・dark/en で → exit 0
- [ ] **Step 4: 見本との突き合わせ(司令塔)** — 画像を並べ、位置・形・色・文字・光の違いを一覧にし、直すものは該当タスクのファイルへ戻して直す
- [ ] **Step 5: TODO 更新** — MIL-SPEC 行に「区画①サイドバー完了・zone-fit の残り件数・光は見本どおりの頻度(masaya 決定)」。100 行以内を確認
- [ ] **Step 6: Commit** — `feat(milspec): 旧サイドバー CSS の撤去・見本突き合わせスクリプトとサイドバーの操作検査`
- [ ] **Step 7: masaya 目視**(本番で見る段取りは司令塔が masaya に確認してから)

---

## 実行の割り当て(司令塔用メモ)

- 実装: 全タスク Sonnet。レビュー: 各タスク Sonnet、Task 4(光エンジン)・Task 5(データ消失に関わる)・最終の全体レビューは Opus
- military.css・locales を複数タスクが触るので**直列**で 1 タスクずつ。コミットは実装役がタスクごと
