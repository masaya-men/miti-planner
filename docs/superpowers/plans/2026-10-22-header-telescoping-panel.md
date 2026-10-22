# MIL-SPEC ヘッダー「2 重パネル引き出し」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ヘッダー中央の金属が区画幅で伸びるのをやめ、上の板を左(滑る)/右(固定)に切り、右に付いた「エキスパンドメタルの下の板」+「網の奥で光る基板」が上の左の板の下から現れる形にする。

**Architecture:** `headerGeometry.ts` が板を切れ目(700/714/683)で左右に分け、右の半分と下の板・基板を MW 基準で置く(純関数)。装甲エンジンに新しい描画種 `drawer`(網・枠・汚れ・影・レール・止め・縁光)と `glow`(基板 + `data-trace` 配線)を足し、`MilspecArmor` が `kind` で描き分ける。光の粒は既存の `fx/engine.pulse` を専用タイマーで呼ぶ。`relayout.ts` の継ぎ目を帯ごとの階段(`clip-path: polygon`)にする。

**Tech Stack:** React 19 + TypeScript、SVG(pattern / mask / clipPath)、Web Animations API(既存エンジン)、vitest(happy-dom)、Playwright(検収の撮影)。

**Spec:** `docs/superpowers/specs/2026-10-22-header-telescoping-panel-design.md`(見本 = `docs/.private/2026-10-22-header-telescoping-panel-mockup/v3.html` + `engine.js`)

## Global Constraints

- 作業場所は `.claude/worktrees/milspec-polish`。全コマンドはそこで実行。commit は親(司令塔)が検収後に行う。サブエージェントは commit しない。
- 決定値(設計書 §0 / D8): 影 1.00 / 汚れ・傷 2.0 / 下の板の暗さ 1.00 / 光の強さ 0.55 / 暗幕 0.88 はそのまま(`--ms-backdrop-veil` を触らない)。
- 切れ目: 外枠 700 / 上段 714 / 下段 683(区画座標・1189 基準)。右の板と下の板と基板は画面に固定。左の板だけ滑る。着いた後の位置合わせは禁止。
- 「みんなの軽減表」のくぼみ(`headerGeometry.ts:121,131`)と `PartyOps.tsx:106-108` は触らない(別件で検討中)。
- CSS: `backdrop-filter` 直書き禁止 / `clip-path: path()` 禁止(`polygon()`・`inset()` は可)/ CSS `zoom` 禁止。新しい色は `--ma-drw-*` トークンで dark・light 両方に入れる。直書き色禁止。
- 動きは transform / opacity / clip-path だけ。静止中にヘッダーを毎フレーム描き直さない。`glow` SVG にぼかしフィルタを置かない。
- 動きを減らす設定(`isFxActive()` が false)では粒を出さない。電源 off では基板の光を消す。
- 画面写真の検収: 1489×679・deviceScaleFactor 2.58 で撮り、見本 v3 の同じ状態と見比べる(撮影スクリプトは scratchpad に置く。dev は http://127.0.0.1:5173/miti?noboot が動いている前提。MIL-SPEC 表示は `localStorage['theme-storage'] = {"state":{"theme":"dark","themeStyle":"military"},"version":2}`、サイドバーは `lopo_sidebar_open`、閉じるのは S キー)。
- 開発中は対象テストだけ `npx vitest run <path>`。push 前だけ `npm run build` + `npm run test:gate`。

## Review Focus

- 1489 の画面でサイドバーを開いたとき、下の板・基板が 1px も見えない(切れ目が合わさる)。閉じたとき窓が 276px。→ Task 3 Step 5。
- 開閉の途中のどのコマでも、窓の中に上の板の切れ端が静止して見えない(階段の継ぎ目)。右端の部品が動かない。→ Task 4 Step 5。
- 1280(縮小)・1920・2560 で網の目・枠・レール・基板の部品の大きさが変わらず、窓の長さだけ変わる。→ Task 5。
- 静止中にヘッダーの塗り直しが起きない。粒 1 本の塗り直しが `glow` SVG の矩形に収まる。→ Task 5 Step 3。
- `relayout.test.ts:136` の「継ぎ目は 700×hs」は階段に置き換わる。通気口・フッターの継ぎ目(inset)は今のまま PASS。→ Task 4。
- 基板の粒が AMB の抽選に入っていない(`fx/engine.ts` の `AMB` を触っていない)。→ Task 3 Step 3。

---

### Task 1: 座標表 — 切れ目で左右に分け、右の半分・下の板・基板を MW 基準で置く

**Files:**
- Modify: `src/components/military/headerGeometry.ts:60-173`(`basePanels` / `headerLayout`)
- Modify: `src/components/military/armor/types.ts:27-44`(`PanelSpec.extra?`、`DrawerSpec` / `GlowSpec`、`PlacedPanel.spec` の型。`PlacedPanel` は `:44`)
- Modify: `src/components/military/armor/stretch.ts:61-70`(`kind` 付きの spec は素通し)
- Test: `src/components/military/__tests__/headerGeometry.test.ts`

**Interfaces:**
- Produces:
  - `export const HDR_CUTS = { chs: 700, h3: 714, h5: 683 } as const`
  - `export const HDR_BANDS: { y0: number; y1: number; cut: number }[]` = `[0,4,700] [4,48,714] [48,52,700] [52,100,683] [100,102,700]`
  - `export function headerLayout(MW: number, opts?: { sidebarOpen: boolean; scale: number })` — 戻り値は今の形のまま + `drawer: { x0: number; x1: number; rest: [number, number] }`(`rest` = 左の板の切れ目が休む 2 か所。区画座標。`opts` 省略時は `[cut, cut + 276]`)
  - `panels` の順序: `[glow, drawer, chsL, chsR, h1, h2, h3L, h3R, h4, h5L, h5R]`。`frame` は `{ w0: MW, h0: 102, sx: 9999, sy: 9999 }`(伸ばし終わった印)
  - `types.ts`: `interface DrawerSpec { kind: 'drawer'; x0; x1; rest: [number, number]; bands; shadow; dirt; dark }`、`interface GlowSpec { kind: 'glow'; x0; x1; windows: [number, number][]; glow }`、`PanelSpec.extra?: string`、`PlacedPanel.spec: PanelSpec | DrawerSpec | GlowSpec`
  - `stretchPlaced`: `'kind' in p.spec` なら `p` をそのまま返す
- Consumes: `clipHalf`(`armor/geom.ts:42`)、`seedOf`(`weather.ts:9`)、`SIDEBAR_SPAN`(`headerGeometry.ts:16`)

- [ ] **Step 1: 失敗するテストを追加**(`headerGeometry.test.ts` の `MW=1189` / `MW=1465` の件は新しい順序に書き換える)

```ts
it('切れ目: 外枠 700 / 上段 714 / 下段 683、帯は 5 本', () => {
  expect(HDR_CUTS).toEqual({ chs: 700, h3: 714, h5: 683 });
  expect(HDR_BANDS.map((b) => b.cut)).toEqual([700, 714, 700, 683, 700]);
});
it('MW=1189: 左右の半分が切れ目で接し、下の板・基板は窓 0', () => {
  const l = headerLayout(1189);
  const by = (name: string) => l.panels.find((p) => p.name === name)!;
  expect(l.panels.map((p) => p.name)).toEqual(['glow', 'drawer', 'chsL', 'chsR', 'h1', 'h2', 'h3L', 'h3R', 'h4', 'h5L', 'h5R']);
  expect(Math.max(...by('h3L').spec.pts.map((p) => p[0]))).toBe(714 - by('h3L').x);
  expect(by('h3R').x).toBe(714);
  expect(by('h5R').x).toBe(683);
  expect(by('chsR').x).toBe(700);
  expect(l.drawer.rest).toEqual([683 + 0, 683 + 276]); // 規定: 下段の切れ目基準
  expect(l.frame).toEqual({ w0: 1189, h0: 102, sx: 9999, sy: 9999 });
});
it('MW=1465: 右の半分は全点が +276 平行移動(歪まない)。左は不動', () => {
  const a = headerLayout(1189), b = headerLayout(1465);
  const pts = (l: ReturnType<typeof headerLayout>, n: string) => { const p = l.panels.find((q) => q.name === n)!; return p.spec.pts.map(([x, y]) => [x + p.x, y + p.y]); };
  expect(pts(b, 'h5R')).toEqual(pts(a, 'h5R').map(([x, y]) => [x + 276, y]));
  expect(pts(b, 'h3R')).toEqual(pts(a, 'h3R').map(([x, y]) => [x + 276, y]));
  expect(pts(b, 'h5L')).toEqual(pts(a, 'h5L'));
  expect(b.panels.find((p) => p.name === 'h4')!.x).toBe(1108);
});
it('下の板は右に付く: x1 = (MW−1189) + 714 + 60、休む 2 か所は {sidebarOpen, scale} から', () => {
  const o = headerLayout(1189, { sidebarOpen: true, scale: 1 }), c = headerLayout(1465, { sidebarOpen: false, scale: 1 });
  expect(o.drawer.x1).toBe(714 + 60); expect(c.drawer.x1).toBe(276 + 714 + 60);
  expect(o.drawer.rest).toEqual(c.drawer.rest); // 画面上の同じ 2 か所(区画座標は左端基準で同じ)
  const s = 1000 / 1189, n = headerLayout(mwFor(1276, s), { sidebarOpen: false, scale: s });
  expect(n.drawer.rest[1] - n.drawer.rest[0]).toBeCloseTo(276 / s, 3);
});
it('CRT のくぼみは 4px 短い(330)。h5b の経路と H5 中央の継ぎ目線は無い。h3 の継ぎ目は左の板で終わる', () => {
  const l = headerLayout(1465);
  const h5L = l.panels.find((p) => p.name === 'h5L')!;
  const crt = h5L.spec.pockets![0].pts; expect(Math.max(...crt.map((p) => p[0])) - Math.min(...crt.map((p) => p[0]))).toBe(330);
  expect(l.decor.h5.crt.w).toBe(324);
  expect(l.traces.map((t) => t.name)).toEqual(['h3', 'h5a']);
  expect(l.traces.find((t) => t.name === 'h3')!.d).toBe('M 630 43 H 706');
  expect(h5L.spec.seams).toEqual(['M 96 5.6 H 336']);
});
it('stretchPlaced: kind 付きの板は動かさない', () => {
  const p = { x: 683, y: 0, w: 400, h: 102, spec: { kind: 'drawer', x0: 623, x1: 774, rest: [683, 959], bands: HDR_BANDS, shadow: 1, dirt: 2, dark: 1 } } as PlacedPanel;
  expect(stretchPlaced(p, { w0: 1189, h0: 102, sx: 700, sy: 9999 }, 1465, 102)).toBe(p);
});
```

- [ ] **Step 2: 実行して失敗を確認** — `npx vitest run src/components/military/__tests__/headerGeometry.test.ts` → 新しい件が FAIL(型エラーで走らない場合は `types.ts` の追加だけ先に入れる)。

- [ ] **Step 3: 実装**
  - `basePanels()` の chassis / h3 / h5 を `splitSpec(spec, cut)`(見本 engine.js の `splitSpec` を TypeScript に写す: `clipHalf(pts, −1, 0, cut)` と `clipHalf(pts, 1, 0, −cut)`、くぼみ・ボルトは中心 x、彫り線・継ぎ目は最初の M の x、`wx.heat` / `wx.wear` は中心 x で振り分け、`seed = seedOf(dedupe(元の pts))`)で左右に分け、`name` を付ける。
  - 右の半分は `stretchPlaced(p, { ...HDR_FRAME, sx: p.x − 1 }, MW, HDR_H)`(全点が +(MW−1189))。左は `sx: 9999`。h4 は右(今の `MW − 357` のまま)。
  - CRT のくぼみ `chamRect(334 → 330, …)`、`decor.h5.crt.w` 328 → 324。h3 の `seams` を `['M 630 43 H 706']` に、`traces.h3` を `M 630 43 H 706` に。`h5b` と `:116` の継ぎ目線を削る。
  - `drawer`(`DrawerSpec`)と `glow`(`GlowSpec`)を MW から直接置く: `x0 = 683 − 60`、`x1 = (MW − 1189) + 714 + 60`、`windows = [[6,46],[54,98]]`、`rest = [683 + (MW_open − 1189), 683 + (MW_open − 1189) + SIDEBAR_SPAN / scale]`(`MW_open = sidebarOpen ? MW : MW − SIDEBAR_SPAN / scale`)。値は D8 の定数。
  - `frame` を `{ w0: MW, h0: 102, sx: 9999, sy: 9999 }` に。`stretchPlaced` は `'kind' in p.spec` で素通し。

- [ ] **Step 4: 実行して成功を確認** — 同じコマンドで全件 PASS。`npx vitest run src/components/military/__tests__/MilspecArmor.test.tsx` も PASS(まだ `kind` を描かないので、描画側は Task 2)。

---

### Task 2: 装甲エンジン — 下の板(網・枠・汚れ・影・レール・止め・縁光)と基板を描く

**Files:**
- Create: `src/components/military/armor/drawer.ts`(`drawerSVG` / `glowSVG` / `DRAWER` 定数 / パターン defs)
- Modify: `src/components/military/armor/svg.ts:46`(`spec.extra` を汚しの後に足す)、`:85-98`(`armorDefsSVG` に共通 defs: `g-vs` / `g-vs-up` / `sh-near-*` / `sh-far-*` / `grime-r` / `oil-r` / `polish-r` / `rust-r` / `print-r` / `frame-grime` / `glow-g` / `hz` / `blur2` / `blur8`)
- Modify: `src/components/military/MilspecArmor.tsx:51-54`(`kind` で `drawerSVG` / `glowSVG` / `armorSVG` を選ぶ)
- Modify: `src/components/military/armor/palette.ts:5-21`(`--ma-drw-*` を読む)、`src/styles/military.css:174-211` と `:282-318`(トークン追加)
- Test: `src/components/military/armor/__tests__/drawer.test.ts`(新規)、`src/components/military/__tests__/MilspecArmor.test.tsx`

**Interfaces:**
- Produces:
  - `export const DRAWER = { shadow: 1, dirt: 2, dark: 1, glow: 0.55 } as const`
  - `export function drawerSVG(spec: DrawerSpec, pal: ArmorPalette, id: string): string` — 台 3 本(`armorSVG` の長方形)→ 窓ごとに 網パターン・結び目の汚れ・平鋼の枠+ビード+欠け・錆/亜鉛・下辺の汚れ+しずく・台の厚み・油/磨き筋・休む 2 か所のつや/黒ずみ・抉り傷・指紋・角の汚れ・粒・暗さ → 縁光(マスク `blur8` の静的にじみ × 帯の縁パターン、色 `--ma-on`)→ 中央レール → ハザード止め・ローラー・弧の傷 → 上の板の縁の影(帯ごと near 3.5px / far 18px、幅は窓幅で頭打ち)
  - `export function glowSVG(spec: GlowSpec, pal: ArmorPalette, id: string): string` — 窓の `clipPath` → 基板(`--ma-pcb`)・シルク線・配線(縁 `--ma-cu-dim` 2.2 + 芯 `--ma-cu` 1.3)を `path.milspec-trc[data-trace="drw:n"]` として(n = 1〜6、上段 3 本・下段 3 本、240px ごとに折れを繰り返す)・パッド(`--ma-gold`)・チップ(型番 `LP-0418`)・静的なにじみ `glow-g` → 全体 `<g class="milspec-drw-glow" opacity="0.55">`
  - `ArmorPalette` に `drw: { lit, dark, knot, edgeHi, frame, zinc, rust }`(全て `--ma-drw-*`)
  - CSS: `html.theme-military[data-ms-power="off"] .milspec-drw-glow { opacity: 0 }`、`.milspec-drw-glow { transition: opacity 300ms }`(`power/milspecPower.css`)
- Consumes: `armorSVG`、`chipsSVG`(`weather.ts:12`)、`rng`(`:5`)、`nut` 相当は `stl-nut`(`svg.ts:97`)

- [ ] **Step 1: 失敗するテスト**

```ts
describe('drawerSVG(下の板)', () => {
  const spec: DrawerSpec = { kind: 'drawer', x0: 623, x1: 1050, rest: [683, 959], bands: HDR_BANDS, shadow: 1, dirt: 2, dark: 1 };
  it('網のパターンは穴を塗らない(pattern の中に全面 rect が無い)・枠・レール・ハザード・ローラーがある', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect(s).toMatch(/<pattern id="d-mesh" width="20" height="10"/);
    expect(s).not.toMatch(/<pattern id="d-mesh"[^>]*>\s*<rect[^>]*width="20" height="10"/);
    expect(s).toMatch(/fill="url\(#hz\)"/);           // ハザード止め
    expect(s).toMatch(/fill="url\(#stl-fl\)"/);       // 中央レール
    expect((s.match(/url\(#stl-nut\)/g) ?? []).length).toBeGreaterThanOrEqual(2); // ローラー
  });
  it('汚れ 2.0 は 1.0 より抉り傷・しずくが多い。0 なら無い', () => {
    const n = (d: number) => (drawerSVG({ ...spec, dirt: d }, pal, 'd').match(/class="drw-gouge"/g) ?? []).length;
    expect(n(2)).toBeGreaterThan(n(1)); expect(n(0)).toBe(0);
  });
  it('休む 2 か所(rest)につや・黒ずみが置かれる', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect(s).toMatch(/cx="688"[^>]*fill="url\(#polish-r\)"/); // rest[0] + 5
    expect(s).toMatch(/cx="954"[^>]*fill="url\(#polish-r\)"/); // rest[1] − 5
  });
  it('色は直書きせずトークン(pal.drw)から', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect(s).not.toMatch(/#9aa3a9|#565e64|#b8c0c5/);
  });
  it('縁光のマスクは静的(use が基板ではなく自前のにじみを参照)、blur は下の板にだけ', () => {
    expect(drawerSVG(spec, pal, 'd')).toMatch(/<mask id="d-rim"[\s\S]*filter="url\(#blur8\)"/);
    expect(glowSVG(gspec, pal, 'g')).not.toMatch(/filter=/);
  });
});
describe('glowSVG(基板)', () => {
  it('配線は data-trace="drw:1"〜"drw:6" の path.milspec-trc、窓で clipPath、不透明度 0.55', () => {
    const s = glowSVG(gspec, pal, 'g');
    for (let i = 1; i <= 6; i++) expect(s).toMatch(new RegExp(`class="milspec-trc"[^>]*data-trace="drw:${i}"`));
    expect(s).toMatch(/<clipPath id="g-win">/); expect(s).toMatch(/class="milspec-drw-glow" opacity="0.55"/);
  });
  it('部品は 240px ごとの繰り返し(窓が長いほどチップが増える。伸びない)', () => {
    const a = glowSVG({ ...gspec, x1: gspec.x0 + 300 }, pal, 'g'), b = glowSVG({ ...gspec, x1: gspec.x0 + 1100 }, pal, 'g');
    expect((b.match(/LP-0418/g) ?? []).length).toBeGreaterThan((a.match(/LP-0418/g) ?? []).length);
  });
});
// MilspecArmor.test.tsx
it('kind:drawer / kind:glow の板は armorSVG ではなく専用の描画で描く', () => { /* innerHTML に data-trace="drw:1" と id="…-mesh" がある */ });
it('--ma-drw-* は dark / light の両方に定義されている', () => { /* milspecTokens.test.ts の作法で military.css を読んで確認 */ });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/armor/__tests__/drawer.test.ts src/components/military/__tests__/MilspecArmor.test.tsx src/components/military/__tests__/milspecTokens.test.ts`。

- [ ] **Step 3: 実装** — 見本 v3 の `meshDefs` / `meshField` / `GLOWS.a.svg` / `drawerSVG` / `machinedEdge` を TypeScript に写す。色は `pal.drw.*`、`--ma-on` / `--ma-warn` / `--ma-pcb` / `--ma-cu` / `--ma-gold` は既存トークン。抉り傷に `class="drw-gouge"`。縁光のマスクは**自前のにじみ楕円**(基板の `<use>` ではなく)。`glowSVG` にフィルタを置かない。`MilspecArmor` は `spec.kind === 'drawer' ? drawerSVG : spec.kind === 'glow' ? glowSVG : armorSVG`。トークンは dark に見本の値、light は明るい亜鉛めっき寄りの暫定値。

- [ ] **Step 4: 成功を確認** — Step 2 のコマンドで全件 PASS。

- [ ] **Step 5: 見た目の確認(見本との突き合わせ)** — dev(1489×679・DPR 2.58、サイドバー閉)でヘッダー区画を撮り、見本 v3 の「閉(引き出し)」の a 案(影 1.00 / 汚れ 2.0 / 暗さ 1.00 / 光 0.55)の舞台と、窓の部分(x=724〜1000)を同じ縮尺で並べて報告。網の目の明暗(「／」明・「＼」暗)、枠のビード、結び目の汚れ、抉り傷、レール、ハザード、基板の緑と配線が見本と同じ位置関係にあること。ライトテーマでも 1 枚撮る。

---

### Task 3: ヘッダーの配線 — 枠・縮小率・基板の粒・電源

**Files:**
- Modify: `src/components/military/header/MilspecHeaderV11.tsx:35-59`(`headerLayout(mw, { sidebarOpen, scale })`、`frame` は `L.frame` をそのまま、粒のタイマー)
- Modify: `src/components/military/power/milspecPower.css`(`.milspec-drw-glow` の off と transition)
- Test: `src/components/military/header/__tests__/MilspecHeaderV11.test.tsx`

**Interfaces:**
- Consumes: `useMilspecHeaderScale()`(`headerScaleContext`)、`pulse` / `isFxActive`(`fx/engine.ts:17-22, 56`)、`onPower`(`power/power.ts`)
- Produces: `export const DRW_PULSE = { minMs: 900, maxMs: 2200, len: 9, speed: 3.4 }`(`MilspecHeaderV11.tsx`)。タイマーは `mw > HDR_BASE_MW` のときだけ `pulse(\`drw:${1 + i % 6}\`, { len: 9, speed: 3.4, cls: '' })`。`AMB`(`fx/engine.ts:242`)は変更しない。

- [ ] **Step 1: 失敗するテスト**

```tsx
it('装甲に 下の板(id *-mesh)と 基板(data-trace="drw:1")が入り、枠の伸縮線は 9999', () => { /* render → container.querySelector('[data-ms-armor="hdr"] [data-trace="drw:1"]') が存在 */ });
it('MW 1189(サイドバー開)では粒を出さない。MW 1465 では 0.9〜2.2 秒おきに drw:n を pulse(AMB は呼ばない)', () => {
  // engine を vi.mock、useMilspecHeaderScale を {scale:1, sidebarOpen:false}、区画幅 1465 の ResizeObserver を模す
  vi.advanceTimersByTime(2300); expect(pulse).toHaveBeenCalledWith(expect.stringMatching(/^drw:[1-6]$/), expect.objectContaining({ len: 9, speed: 3.4 }));
});
it('動きを減らす設定(isFxActive=false)では pulse を呼ばない', () => {});
it('CRT の箱は幅 324', () => {});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/header/__tests__/MilspecHeaderV11.test.tsx`。

- [ ] **Step 3: 実装** — `headerLayout(mw, { sidebarOpen, scale })`、`frame` は `L.frame`(`sx: 9999`)。粒のタイマー effect(`setTimeout` の連鎖。アンマウントで止める。`document.hidden` は `isFxActive` が見る)。`milspecPower.css` に off / transition。`grep -n "AMB" src/components/military/fx/engine.ts` の差分が無いことを確認。

- [ ] **Step 4: 成功を確認** — Step 2 のコマンド + `npx vitest run src/components/military/__tests__/headerGeometry.test.ts src/components/military/__tests__/MilspecArmor.test.tsx` PASS。

- [ ] **Step 5: 実機の確認(必須)** — 1489×679・DPR 2.58 で (a) サイドバー開: 窓が 0 で下の板・基板が見えない(切れ目 714 / 683 / 700 で上の板が合わさる)、(b) 閉: 窓 276 に網と基板、粒が走る瞬間を 1 枚、(c) `?noboot` なしで入り、暗幕が退いた直後に基板の光が点く(電源 off のコマと on のコマ)、を画像パスつきで報告。見本 v3 の a 案「開(収納)」「閉(引き出し)」と並べる。1920×1080・DPR 2 でも (a)(b) を 1 回(開いていても窓 431 が見えるのが仕様)。

---

### Task 4: relayout — 継ぎ目を帯ごとの階段にする

**Files:**
- Modify: `src/components/military/relayout.ts:164-231`(`rightClone` / `splitZone` / `swapRight`)、`:360-368`(`seamOf`)
- Test: `src/components/military/__tests__/relayout.test.ts:136`(置き換え)、`:407`(複製 3 枚の件は通気口なので変更なし)

**Interfaces:**
- Produces:
  - `export type Seam = number | { x: number; y0: number; y1: number }[]`
  - `seamOf(app, zone)`: ヘッダーは `HDR_BANDS.map((b) => ({ x: b.cut * hs, y0: b.y0 * hs, y1: b.y1 * hs }))`、通気口は `VENT_SEAM * hs`、フッターは今のまま
  - `splitZone(zone, seam: Seam, box?)`: `seam` が配列のとき 左 = `clip-path: polygon(<階段の左側 + CLIP_PAD の外側余白>)`、右 = `polygon(<階段の右側>)`。数値のときは今の `inset`
  - `SplitZone.edge` は配列の継ぎ目では常に `null`
- Consumes: `HDR_BANDS`(Task 1)

- [ ] **Step 1: 失敗するテスト**(`relayout.test.ts:136` を置き換え)

```ts
it('右の複製は動かない(transform なし)・継ぎ目は ヘッダー = 帯ごとの階段(700/714/700/683/700 × hs)/ 通気口 190×hs', () => {
  relayoutZones(app, close, 'sb', false); vi.advanceTimersByTime(500);
  const hdr = app.querySelector('[data-split="right"][data-zone="header"]') as HTMLElement; // 複製に data-zone を付ける
  expect(hdr.style.clipPath).toMatch(/^polygon\(/);
  expect(hdr.style.clipPath).toContain('714px'); expect(hdr.style.clipPath).toContain('683px'); expect(hdr.style.clipPath).toContain('700px');
  expect(hdr.style.clipPath).not.toContain('path(');
  const left = app.querySelector('[data-split="left"][data-zone="header"]') as HTMLElement;
  expect(left.style.clipPath).toMatch(/^polygon\(/);
  const vent = app.querySelector('[data-split="right"][data-zone="vent"]') as HTMLElement;
  expect(vent.style.clipPath).toBe('inset(-16px -16px -16px 190px)');
  expect(hdr.getAnimations?.().length ?? 0).toBe(0);
});
it('階段の継ぎ目: 縮小率 0.8 なら x も y も 0.8 倍', () => { /* --ms-hs: 0.8 → polygon に 571.2px / 546.4px / 560px, 3.2px / 38.4px */ });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/__tests__/relayout.test.ts`。

- [ ] **Step 3: 実装** — 階段の点列: 左 = `(−P,−P) → (cut_0+… 各帯の x を y0/y1 でつなぐ) → (…, H+P) → (−P, H+P)`、右 = その鏡(右端は `W+P`)。`P = CLIP_PAD`、`W/H` は複製の `box.r`。`clip-path` は `polygon(x1px y1px, …)`。複製に `data-zone` を付ける。`swapRight` も同じ継ぎ目で作り直す。

- [ ] **Step 4: 成功を確認** — `npx vitest run src/components/military/__tests__/relayout.test.ts src/components/military/__tests__/MilspecLayout.test.tsx src/components/military/__tests__/headerCollapseAnimator.test.ts src/components/military/__tests__/sidebarToggleAnimator.test.ts` PASS。

- [ ] **Step 5: 実機の確認(必須)** — 1489×679・DPR 2.58。サイドバーの閉じる・開くをそれぞれ 60ms ごとに撮り(Task 6 の撮り方と同じ)、画像パスつきで報告:
  - 右端の部品(レバー・時計・軽減表・SORT)のピクセル位置が全コマで同じ。
  - 窓の中に上の板の切れ端(上段 700〜714 / 下段 683〜700 の帯)が静止して見えるコマが無い。網と基板はどのコマでも画面上の同じ位置。
  - 終了直後と 300ms 後のコマが一致(位置合わせの動きが無い)。
  - 見本 v3 の「開閉を再生」の途中のコマと並べて、左の板の切れ目が網の上を滑る見え方が同じ。
  - 1280×679(縮小 0.844)でも閉じる 1 回。

---

### Task 5: 仕上げ — 画面幅・テーマ・電源・動きを減らす・性能

**Files:**
- Modify(必要なら): `src/styles/military.css`(`--ma-drw-*` light の値の調整)、`src/components/military/armor/drawer.ts`(見た目の微調整のみ)
- Test: 既存の件が PASS のまま(新規テストは無し。見た目の検収タスク)

- [ ] **Step 1: 画面幅** — 1280×679(DPR 2.58)/ 1920×1080(DPR 2)/ 2560×1440(DPR 1)で、サイドバー開・閉のヘッダーを撮る。網の目・枠・レール・基板の部品が同じ大きさで、窓の長さだけ変わること。2560 の窓(1071 / 1347px)で基板の繰り返しが自然なこと。
- [ ] **Step 2: テーマ・電源・動きを減らす** — ライトテーマで閉じた状態を 1 枚(`--ma-drw-*` light の値を masaya 確認用に報告)。電源 off(`?noboot` なしで入った直後)で基板の光が消えている 1 枚。OS の「動きを減らす」(Playwright `reducedMotion: 'reduce'`)で 3 秒間に粒が 0 本・にじみと縁光は点いている 1 枚。
- [ ] **Step 3: 性能** — Chrome DevTools(Playwright CDP `Overlay.setShowPaintRects` または Performance 録画 5 秒)で、サイドバー閉・静止中にヘッダー区画の塗り直しが 0 回/秒、粒が走る間の塗り直し矩形が基板 SVG の矩形(窓)に収まることを報告。`docs/.private/perf-tools/` の手順があればそれを使う。基準超過(静止中に塗り直しが続く)なら原因(フィルタ / マスク / アニメの置き場所)を直してから次へ。
- [ ] **Step 4: 既存テスト** — `npx vitest run src/components/military/` が PASS。

---

### Task 6: push 前ゲートと検収資料

- [ ] **Step 1:** `npm run build` の exit code 0(tsc -b 厳密)。
- [ ] **Step 2:** `npm run test:gate` PASS。
- [ ] **Step 3:** Task 2〜5 の画像を 1 つのフォルダ(scratchpad)にまとめ、「見本 v3 の同じ状態 / 本物」の対で並べた一覧(パス + 1 行の所見)を親へ報告。masaya に確認してもらう論点: light の `--ma-drw-*` の値、1920 で窓が常時見えること(設計書 §5 Q1)、軽減表のくぼみ(§5 Q2)。
