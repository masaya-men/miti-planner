# 見た目切替 UI・MIL-SPEC 立ち上がり演出・区画の開閉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 切替ボタン/レバーを「見た目を切り替える」に統一して見やすくし、MIL-SPEC の立ち上がりを順番演出に、区画の開閉を「板が伸びずに時間差で滑り込む」動きにする。

**Architecture:** A/B は既存部品(MilspecStyleToggle / ModeLever)の見た目と文言の修正。C は `power.ts` の `powerOn` を区画ごとの WAAPI 演出に置き換える。D は (1) ヘッダー縮小率をサイドバー開状態の幅で固定する純関数、(2) 通気口の中央を「レール上の台車」にする純関数+DOM、(3) `relayout.ts` を「1 段目は旧配置で動かす → `change()` → 2 段目は新配置で動かす」の 2 段階にし、ヘッダー/通気口は左右 2 枚の複製に分けて右側を固定する。

**Tech Stack:** React 19 + TypeScript、Web Animations API、vitest(happy-dom)、i18next(ja/en/zh/zh-Hant/ko)。

**Spec:** `docs/superpowers/specs/2026-10-22-theme-switch-ui-design.md`(見本 = `docs/.private/2026-10-22-theme-switch-mockup/` の index.html A1・C3 / v2.html L1 / v3.html)

## Global Constraints

- 作業場所は `.claude/worktrees/milspec-polish`。全コマンドはそこで実行する。commit は親(司令塔)が検収後に行う。サブエージェントは commit しない。
- ユーザー向けの文言に「電源」「MIL-SPEC」を出さない。切替の説明は全て `app.theme_style_switch` = 「見た目を切り替える」。
- 新しい i18n キーは 5 言語同時: ja「見た目を切り替える」/ en「Switch appearance」/ zh「切换外观」/ zh-Hant「切換外觀」/ ko「화면 디자인 전환」。ロケール JSON は該当ブロックだけを文字列として編集する(全体の再整形はしない)。
- `backdrop-filter` の直書き禁止、`clip-path: path()` 禁止、CSS `zoom` 禁止。
- 動きは transform / opacity / clip-path(inset) だけ。毎フレームで幅を変えない。
- 動きを減らす設定(`prefers-reduced-motion` / 各関数の `reduced`)では演出なしで即時に切り替える。
- 開閉の既定値: 1 つの動き `PHASE_DUR = 420`ms、ずらす間 `PHASE_GAP = 80`ms、台車の遅れ `CARRIAGE_LAG = 60`ms、台車の走行 `CARRIAGE_DUR = 480`ms。今の「少し行き過ぎて戻る」keyframe(relayout.ts の `frames`)は残す。
- 右端基準の部品は、開閉中に画面上で一度も動かない。着いた後の位置合わせ(ずるっと動く)は禁止。
- 品質ゲート: 1489×679・deviceScaleFactor 2.58 の実寸の画面写真で見本と見比べる。push 前に `npm run build` と `npm run test:gate`。開発中は対象テストだけを `npx vitest run <path>` で回す。

## Review Focus

- 開閉の動きの最中に、もう一度開閉を押す(S/H キー連打、取っ手の連打)→ 動きの最中の入力は無視され、最後は必ず正しい状態に落ち着き、複製(`.milspec-ghost` / `.milspec-split`)が残らない。テスト → Task 6。
- 開閉の動きの最中に標準の見た目へ戻す / ページを離れる → 複製・タイマーが残らない。テスト → Task 6(`cancelRelayout`)。
- 1489 より狭い画面でサイドバーを開け閉めする → ヘッダー・通気口の部品の大きさが変わらない。テスト → Task 4。
- 動きを減らす設定 → 立ち上がり・開閉とも演出なしで即時。テスト → Task 3 / Task 6。
- 立ち上がり演出の途中で標準へ戻す(レバーを上げる)→ 暗幕・光の帯が残らない。テスト → Task 3(`disposePower`)。

---

### Task 1: 標準ヘッダーの切替ボタン(A)+ 新しい文言キー

**Files:**
- Modify: `src/components/military/MilspecStyleToggle.tsx`
- Modify: `src/components/ConsolidatedHeader.tsx:311-316`(ボタンを `Tooltip` で包む)
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`(`app` ブロックに `theme_style_switch` を追加)
- Test: `src/components/military/__tests__/MilspecStyleToggle.test.tsx`

**Interfaces:**
- Produces: i18n キー `app.theme_style_switch`(Task 2 も使う)。

- [ ] **Step 1: 失敗するテストを追加**

```tsx
it('説明は向きに関係なく「見た目を切り替える」・素の title は付けない', async () => {
  // standard のとき
  const { getByRole, rerender } = render(<MilspecStyleToggle />);
  const btn = getByRole('button');
  expect(btn.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
  expect(btn.hasAttribute('title')).toBe(false);
  // military のとき
  act(() => useThemeStore.getState().setThemeStyle('military'));
  rerender(<MilspecStyleToggle />);
  expect(getByRole('button').getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
});
it('standard のとき svg は親の文字色を継ぐ(ホバー反転で白地に白にならない)', () => {
  const { container } = render(<MilspecStyleToggle />);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('class') ?? '').not.toMatch(/text-app-text|text-app-text-muted/);
});
it('5 言語すべてに theme_style_switch がある', () => {
  for (const lng of ['ja', 'en', 'zh', 'zh-Hant', 'ko']) expect(i18n.getResource(lng, 'translation', 'app.theme_style_switch')).toBeTruthy();
});
```
(既存テストファイルの render / i18n / store の初期化の書き方に合わせる。)

- [ ] **Step 2: 実行して失敗を確認** — `npx vitest run src/components/military/__tests__/MilspecStyleToggle.test.tsx` → 新しい 3 件が FAIL。

- [ ] **Step 3: 実装**
  - `MilspecStyleToggle`: `aria-label={t('app.theme_style_switch')}`、`title` を削除。svg の class は military のときだけ `text-app-accent`、それ以外は色クラスを付けない(親 `hoverInvert` の文字色を継ぐ)。
  - `ConsolidatedHeader`: `<Tooltip content={t('app.theme_style_switch')}>` で包む(隣の太陽ボタンと同じ書き方)。
  - 5 言語のロケールに Global Constraints の訳を追加。

- [ ] **Step 4: 実行して成功を確認** — 同じコマンドで全件 PASS。

---

### Task 2: MIL-SPEC のレバー(B: L1)と古い文言キーの撤去

**Files:**
- Modify: `src/components/military/header/ModeLever.tsx:133-158`
- Modify: `src/components/military/header/milspecH4.css:42-62`
- Modify: `src/locales/{ja,en,zh,zh-Hant,ko}.json`(`app.theme_style_to_milspec`・`app.theme_style_to_standard`・`milspec.hdr_lever_power_on` を削除。先に `grep -rn` で他に使っていないことを確認)
- Test: `src/components/military/header/__tests__/AuxPanel.test.tsx:229-236`

**Interfaces:**
- Consumes: `app.theme_style_switch`(Task 1)。
- Produces: レバー内の DOM クラス `milspec-mlv-rack`(2 個: `is-l` / `is-r`)、`milspec-mlv-glass`、`milspec-mlv-run`(`milspec-mlv-slot` の子)。

- [ ] **Step 1: 既存テストを書き換え+追加**

```tsx
it('aria-label は上でも下でも「見た目を切り替える」', async () => {
  initPower();
  const { getByRole } = lever();
  const sw = getByRole('switch');
  expect(sw.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
  await flush(1000);
  expect(sw.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
});
it('L1: ガラス窓・左右のラック・溝を流れる光がある', () => {
  const { container } = lever();
  expect(container.querySelectorAll('.milspec-mlv-rack')).toHaveLength(2);
  expect(container.querySelector('.milspec-mlv-glass')).not.toBeNull();
  expect(container.querySelector('.milspec-mlv-slot .milspec-mlv-run')).not.toBeNull();
});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/header/__tests__/AuxPanel.test.tsx` → 2 件 FAIL。

- [ ] **Step 3: 実装**
  - ModeLever: `label = t('app.theme_style_switch')` に固定。上の DOM を追加(LED・ハザード・つまみは残す)。
  - CSS(v2.html の `.l1` を MIL-SPEC の素材トークン `--ma-*` で作り直す): ラック = 溝の左右、幅 5px・`repeating-linear-gradient` の歯。ガラス = 内側 3px/8px、縁 `0 0 0 .6px rgba(var(--ma-on-rgb),.45)` + 弱い外光。光 = 溝の中の高さ 8px の帯が下から上へ、`1.8s` 無限、ホバー中 `.9s`。`@media (prefers-reduced-motion: reduce)` では帯を消し、縁の光だけ残す(既存の reduced ブロック :61-62 に追記)。
  - ロケールから古い 3 キーを削除。

- [ ] **Step 4: 成功を確認** — 同じテスト PASS、`npx vitest run src/components/military/__tests__/MilspecStyleToggle.test.tsx` も PASS(キー削除の影響なし)。

- [ ] **Step 5: 見た目の確認** — dev(`npm run dev`)で MIL-SPEC を開き、1489×679・DPR 2.58 でヘッダーのレバー付近を撮る。v2.html の L1(実際の大きさ)と並べて、ほかの H4 部品と質感が揃っていることを報告に画像パスで添える。

---

### Task 3: 立ち上がりの順番演出(C: C3)

**Files:**
- Modify: `src/components/military/power/power.ts`(`powerOn` / `powerOff` / `disposePower` / `setZoneDelays`)
- Modify: `src/components/military/power/milspecPower.css`
- Modify: `src/components/military/power/lampSequence.ts:13`(点灯の開始を光の帯の後へ)
- Test: `src/components/military/power/__tests__/power.test.ts`、`lampSequence.test.ts`

**Interfaces:**
- Produces: `export const BOOT_TIMING = { sidebar: { delay: 250, dur: 700 }, header: { delay: 370, dur: 700 }, workspace: { delay: 1150, dur: 900 }, lamps: 650, scan: 2100 } as const`(power.ts)。帯の要素クラス `milspec-sweep`(区画ごとに 1 個、power.ts が無ければ作る)。

順番(spec §3C): ① 暗い(今の off の暗幕 0.55 のまま) → ② サイドバー(上→下)とヘッダー(左→右)に光の帯が走り、帯が通った所から暗幕が退く。rail はサイドバーと同じ時刻・向き、vent と footer はヘッダーと同じ時刻・向き → ③ workspace の暗幕が蛍光灯のようにチカチカして消える。

- [ ] **Step 1: テストを書き換え(既存の「--pd が 140+i*60ms」の 2 件を置き換える)**

```ts
it('powerOn: サイドバー/レールの暗幕は上から下へ、ヘッダー/通気口/フッターは左から右へ退く', () => {
  // 6 区画 + 各 .milspec-dim を用意し、dim.animate を vi.fn で差し替える
  powerOn({ reduced: false });
  const call = (z: string) => dimAnim(z).mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
  expect(call('sidebar')[1]).toMatchObject({ delay: 250, duration: 700, fill: 'backwards' });
  expect(call('sidebar')[0].at(-1)!.clipPath).toBe('inset(100% 0 0 0)');
  expect(call('header')[1]).toMatchObject({ delay: 370, duration: 700 });
  expect(call('header')[0].at(-1)!.clipPath).toBe('inset(0 0 0 100%)');
  expect(call('rail')[1].delay).toBe(250);
  expect(call('footer')[1].delay).toBe(370);
});
it('powerOn: workspace の暗幕は 1150ms から 900ms チカチカして消える(steps(1,end))', () => {
  powerOn({ reduced: false });
  const [frames, opts] = dimAnim('workspace').mock.calls[0];
  expect(opts).toMatchObject({ delay: 1150, duration: 900, easing: 'steps(1, end)' });
  expect(frames.map((f: Keyframe) => f.opacity)).toEqual([0.55, 0.11, 0.55, 0.55, 0.055, 0.495, 0.22, 0.55, 0.55, 0]);
});
it('powerOn: 光の帯がサイドバーは縦・ヘッダーは横に走る', () => { /* .milspec-sweep の animate の最後の transform が translateY(...)/translateX(...) */ });
it('powerOn(reduced): 暗幕も帯も animate しない', () => { /* 既存の reduced テストに dim/sweep の animate 未呼び出しを追加 */ });
it('disposePower: .milspec-sweep を消し、暗幕の animate を止める', () => {});
```
(workspace の不透明度の列は index.html C3 の値(1 → 0.2 → …)に 0.55 を掛けたもの。offset は C3 と同じ `[0, .08, .16, .34, .4, .46, .52, .58, .72, 1]`。)

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/power/__tests__` → 新しい件が FAIL。

- [ ] **Step 3: 実装**
  - `powerOn`: `setZoneDelays` を使わず、各区画の `.milspec-dim` を `BOOT_TIMING` で `animate`(`fill: 'backwards'` で開始前は 0.55 を保つ。終わると CSS の `opacity: 0` に戻る)。`.milspec-sweep` を区画に足して帯を走らせる(サイドバー/レール = 縦・高さ 22%、ヘッダー/通気口/フッター = 横・幅 18%、色は `--ma-on-hot` の半透明、終わったら消す)。`blackout`・`burst`・`pulse`・`coreFire`・`trafficBp` の呼び出しは残す。`scanBall` のタイマーは 900 → `BOOT_TIMING.scan`。
  - `milspecPower.css`: `.milspec-dim` の `transition`(`--pd`)をやめる。`.milspec-sweep` の見た目を追加。
  - `lampSequence`: 開始を `BOOT_TIMING.lamps + i*45`。
  - `powerOff` / `disposePower`: 暗幕・帯の進行中の animate を `cancel()` し、帯の要素を消す。

- [ ] **Step 4: 成功を確認** — 同じコマンドで PASS。`npx vitest run src/components/military/header/__tests__/AuxPanel.test.tsx` も PASS(レバーの自動投入に影響なし)。

- [ ] **Step 5: 見た目の確認** — dev で標準 → MIL-SPEC に切り替える様子を 0.2 秒ごとに 12 枚撮り(1489×679・DPR 2.58)、② → ③ の順になっていることを画像パスで報告。

---

### Task 4: ヘッダー縮小率をサイドバー開状態の幅で固定

**Files:**
- Modify: `src/components/military/headerGeometry.ts`(純関数を追加)
- Create: `src/components/military/headerScaleContext.ts`
- Modify: `src/components/military/MilspecLayout.tsx:78-87`(縮小率の計算と Provider)
- Modify: `src/components/military/header/MilspecHeaderV11.tsx:34-44`、`src/components/military/MilspecVent.tsx:24-36`(MW の求め方)
- Test: `src/components/military/__tests__/headerGeometry.test.ts`

**Interfaces:**
- Produces:
  - `export const SIDEBAR_SPAN = 276`(サイドバー 274 + 列の隙間 2。開閉でヘッダー区画の幅が変わる量)
  - `export function headerScaleFor(zoneWidth: number, sidebarOpen: boolean): number` = `headerScale(sidebarOpen ? zoneWidth : zoneWidth - SIDEBAR_SPAN)`
  - `export function mwFor(zoneWidth: number, scale: number): number` = `Math.max(HDR_BASE_MW, Math.round(zoneWidth / scale))`
  - `headerScaleContext.ts`: `export const MilspecHeaderScaleContext = React.createContext<{ scale: number; sidebarOpen: boolean }>({ scale: 1, sidebarOpen: true })` と `export const useMilspecHeaderScale = () => React.useContext(MilspecHeaderScaleContext)`

- [ ] **Step 1: 失敗するテスト**

```ts
it('headerScaleFor: 開状態の幅で縮小率を決め、閉じても同じ値', () => {
  expect(headerScaleFor(1189, true)).toBe(1);
  expect(headerScaleFor(1000, true)).toBeCloseTo(1000 / 1189);
  expect(headerScaleFor(1276, false)).toBeCloseTo(1000 / 1189); // 閉じて 276 広がった
  expect(headerScaleFor(1465, false)).toBe(1);
});
it('mwFor: 実幅 ÷ 縮小率(1189 未満にはしない)', () => {
  expect(mwFor(1000, 1000 / 1189)).toBe(1189);
  expect(mwFor(1276, 1000 / 1189)).toBe(Math.round(1276 * 1189 / 1000));
  expect(mwFor(1465, 1)).toBe(1465);
});
it('狭い画面で開閉しても、右端の部品の画面上の位置と大きさが変わらない', () => {
  const s = 1000 / 1189; // 開: 区画 1000px / 閉: 1276px、区画の左端は 276px 左へ
  const scrX = (zoneLeft: number, w: number, open: boolean) => zoneLeft + headerScaleFor(w, open) * (mwFor(w, headerScaleFor(w, open)) - 150); // レバー x = MW - 150
  expect(scrX(300, 1000, true)).toBeCloseTo(scrX(24, 1276, false), 0);
  expect(headerScaleFor(1000, true)).toBeCloseTo(s);
});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/__tests__/headerGeometry.test.ts`。

- [ ] **Step 3: 実装** — 関数と Context を追加。MilspecLayout は `--ms-hs` を `headerScaleFor(w, props.isSidebarOpen)` で書き、`MilspecHeaderScaleContext.Provider` で `{ scale, sidebarOpen }` を配る(サイドバー開閉で再計算される依存にする)。MilspecHeaderV11 と MilspecVent は `layoutMW(w)` の代わりに `mwFor(w, scale)` を使う。CSS の内箱(military.css:1259-1263、`scale(var(--ms-hs))`・幅 `100% / --ms-hs`)はそのまま。

- [ ] **Step 4: 成功を確認** — 上のテスト + `npx vitest run src/components/military/__tests__/MilspecLayout.test.tsx src/components/military/header/__tests__/MilspecHeaderV11.test.tsx src/components/military/__tests__/MilspecVent.test.tsx` が PASS。

---

### Task 5: 通気口の中央を「レール上の台車」に

**Files:**
- Modify: `src/components/military/headerGeometry.ts`(`ventLayout` の近くに純関数を追加)
- Modify: `src/components/military/MilspecVent.tsx:56-92`
- Modify: `src/components/military/header/milspecVent.css`
- Test: `src/components/military/__tests__/headerGeometry.test.ts`、`MilspecVent.test.tsx`

**Interfaces:**
- Consumes: `useMilspecHeaderScale()`(Task 4)、`SIDEBAR_SPAN`。
- Produces:
  - `export const CARRIAGE_W = 252`、`export const RAIL_MARGIN = 6`
  - `export function ventCarriageX(MW: number): number` = `MW / 2 - 192`(格子 `xb0` の 2px 手前)
  - `export function ventRailRange(MW: number, sidebarOpen: boolean, scale: number): { x: number; w: number }`。区画内座標(1189 基準)。台車の画面上の走行量は `SIDEBAR_SPAN / 2`(=138px)で、区画内では `138 / scale`。開いた状態では、もう一方の位置は左に `138/scale` → `x = ventCarriageX(MW) - 138/scale - RAIL_MARGIN`。閉じた状態では右 → `x = ventCarriageX(MW) - RAIL_MARGIN`。どちらも `w = CARRIAGE_W + 138/scale + 2*RAIL_MARGIN`。
  - DOM: `[data-vent-carriage]`(left = `ventCarriageX(MW)`、中に `.milspec-lb-row`・`.milspec-pull`・PULL 文字を台車内の相対位置で置く)、`[data-vent-rail]`(left/width = `ventRailRange`、両端に `MilspecHazard` の止め金具)。

- [ ] **Step 1: 失敗するテスト**

```ts
it('ventRailRange: 開/閉どちらで描いても、画面上の同じ場所・同じ長さ', () => {
  const o = ventRailRange(1189, true, 1), c = ventRailRange(1465, false, 1);
  expect(300 + o.x).toBeCloseTo(24 + c.x); // 区画の左端は 開 300 / 閉 24(1489 画面)
  expect(o.w).toBeCloseTo(c.w);
  expect(o.w).toBeCloseTo(252 + 138 + 12);
});
it('ventRailRange: 狭い画面(縮小 0.84)でも画面上で一致', () => {
  const s = 1000 / 1189;
  const o = ventRailRange(mwFor(1000, s), true, s), c = ventRailRange(mwFor(1276, s), false, s);
  expect(300 + o.x * s).toBeCloseTo(24 + c.x * s, 0);
  expect(o.w * s).toBeCloseTo(c.w * s, 0);
});
```
MilspecVent.test.tsx に追加: `[data-vent-carriage]` の中に `.milspec-lb-row` と `button.milspec-pull` があり、`[data-vent-rail]` があること。既存 5 件(取っ手・aria・光の玉・溝の経路名)は変えずに PASS すること。

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/__tests__/headerGeometry.test.ts src/components/military/__tests__/MilspecVent.test.tsx`。

- [ ] **Step 3: 実装** — 台車とレールを描く。台車 = 金属の板 + 車輪 3 個 + 走行ランプ(`.milspec-carriage.is-moving` で `--ma-warn` に点灯、車輪が回る。Task 6 がこのクラスを付け外しする)。左右の溝(chanL/chanR)はレールの両端で終わるように幅を計算し直す(`chanL.w = rail.x - 8 - 190`、`chanR.x = rail.x + rail.w + 8`)。経路名 `ventL:` / `ventR:` は残す。見た目は v3.html を MIL-SPEC の素材トークンで作り直す。

- [ ] **Step 4: 成功を確認** — 同じテスト PASS。

- [ ] **Step 5: 見た目の確認** — dev で 1489×679・DPR 2.58 の通気口を、サイドバーを開いた状態と閉じた状態で撮る。レールが画面上で同じ位置にあり、台車がその両端にいることを画像で報告。

---

### Task 6: 開閉を 2 段階に(D)

**Files:**
- Modify: `src/components/military/relayout.ts`(全面的に書き換え)
- Modify: `src/components/military/MilspecLayout.tsx:89-122`(呼び出し・アンマウント時の `cancelRelayout`)
- Test: `src/components/military/__tests__/relayout.test.ts`(既存の「全員 620ms」の件を置き換える)

**Interfaces:**
- Consumes: `.milspec-carriage` / `is-moving`(Task 5)、`HDR_FRAME.sx = 700`(headerGeometry.ts:18、export する)、`--ms-hs`。
- Produces:
  - `export const PHASE_DUR = 420, PHASE_GAP = 80, CARRIAGE_LAG = 60, CARRIAGE_DUR = 480`
  - `export function relayoutZones(app: HTMLElement, change: () => void, kind: 'hdr' | 'sb', reduced: boolean): void`(呼び出し側の形は今のまま)
  - `export function cancelRelayout(app: HTMLElement): void`(進行中の animate とタイマーを止め、複製を消し、隠した区画を戻す。`change()` がまだなら即時に呼ぶ)
  - `export function splitZone(zone: HTMLElement, seamPx: number): { left: HTMLElement; right: HTMLElement; carriage: HTMLElement | null; restore(): void }` — 区画を隠し、その上に複製を 2 枚(`.milspec-split`、`inert`・`aria-hidden`・光エンジンの属性を除去=今の ghost と同じ処理)置く。左は `clip-path: inset(0 calc(100% - seam) 0 0)`、右は `inset(0 0 0 seam)`。通気口のときは、台車(`[data-vent-carriage]`)を両方から除き、台車だけの複製を `carriage` として返す。

全ての開閉は同じ骨組み: **1 段目は今の配置のまま動かす → 1 段目が終わって `PHASE_GAP` 後に `change()` → 2 段目は新しい配置で動かす**。動きの最中(`app` に `data-relayout` 属性)に来た `relayoutZones` は何もせずに戻る(状態も変えない)。

| 操作 | 1 段目(delay 0) | 2 段目(delay = 1 段目の終わり + 80) |
|---|---|---|
| サイドバーを閉じる | サイドバーが左へ抜ける(420) | `change()` → rail・workspace・footer が +D から 0 へ(420)。header・vent は `splitZone`(seam = 700×hs / 通気口は 190×hs): 左の複製が +D から 0 へ(420)、右の複製は動かない、台車の複製は `+D/2` から 0 へ(delay +60・480・`is-moving`) |
| サイドバーを開く | rail・workspace・footer が 0 → +D。header・vent を split: 左が 0 → +D、右は動かない、台車が 0 → +D/2(delay 60・480)。1 段目の終わり = 60+480 | `change()` → サイドバーが左から入る(420) |
| ヘッダーを開く | vent・workspace が 0 → +D(縦・下へ。workspace のはみ出しはフッターの下) | `change()` → ヘッダーが上から下りる(420) |
| ヘッダーを閉じる | ヘッダー(本物・まだ change 前)が上へ抜ける(420) | `change()` → vent・workspace が +D(下)から 0 へ(420) |

(D = 区画が実際に動く量を `getBoundingClientRect` で測る。今の relayout.ts と同じ測り方。サイドバーを開く 1 段目は `change()` 前なので、D は「開いたときのサイドバーの幅 + 隙間」=`SIDEBAR_SPAN × 1`(画面 px)を使う。)

- [ ] **Step 1: 失敗するテスト(既存の setup を流用。`animate` は vi.fn、タイマーは `vi.useFakeTimers()`)**

```ts
it('サイドバーを閉じる: 1 段目はサイドバーだけ(420)・change は 500ms 後・2 段目で左の板/他区画(420)・台車は +60 で 480', () => {
  relayoutZones(app, close, 'sb', false);
  expect(change).not.toHaveBeenCalled();
  expect(animOf('sidebar')[1]).toMatchObject({ duration: 420 });
  vi.advanceTimersByTime(500);
  expect(change).toHaveBeenCalledTimes(1);
  expect(animOf('workspace')[1]).toMatchObject({ duration: 420 });
  expect(app.querySelectorAll('.milspec-split')).not.toHaveLength(0);
  expect(carriageAnim()[1]).toMatchObject({ delay: 60, duration: 480 });
});
it('右の複製は animate されない', () => {});
it('ヘッダーを開く: 1 段目で vent/workspace が下がり、500ms 後に change → ヘッダーが下りる', () => {});
it('ヘッダーを閉じる: 1 段目はヘッダーだけ(残像は作らない)、500ms 後に change → vent/workspace が上がる', () => {});
it('サイドバーを開く: 1 段目の終わり(540)+80 = 620ms 後に change → サイドバーが入る', () => {});
it('動きの最中の 2 回目は無視され、終わると複製が残らない', () => {
  relayoutZones(app, close, 'sb', false); relayoutZones(app, open, 'sb', false);
  vi.runAllTimers(); finishAllAnimations();
  expect(change).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  expect(app.querySelector('.milspec-split, .milspec-ghost')).toBeNull();
  expect(app.hasAttribute('data-relayout')).toBe(false);
});
it('cancelRelayout: 途中で止めると change 済みになり、複製・属性が残らない', () => {});
it('動きを減らす設定: animate なしで change だけ(今のテストのまま)', () => {});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/__tests__/relayout.test.ts`。

- [ ] **Step 3: 実装** — 上の表のとおり。keyframe は今の `frames(...)`(行き過ぎ 1.8px)を全ての板の動きに使う。台車は `cubic-bezier(.45,0,.3,1)` で、最後に 0.8px 戻るだけ(v3.html の `runCar`)。全部終わったら `restore()`、`data-relayout` を外す。MilspecLayout のアンマウント(標準へ戻る)の cleanup で `cancelRelayout(appRef.current)`。

- [ ] **Step 4: 成功を確認** — `npx vitest run src/components/military/__tests__/relayout.test.ts src/components/military/__tests__/MilspecLayout.test.tsx src/components/military/__tests__/headerCollapseAnimator.test.ts src/components/military/__tests__/sidebarToggleAnimator.test.ts` が PASS。

- [ ] **Step 5: 実機の確認(必須)** — dev で 1489×679・DPR 2.58。サイドバーの開閉・ヘッダーの開閉をそれぞれ 60ms ごとに撮り、次の 3 点を画像パスつきで報告する。
  - 右端の部品(レバー・時計・並び替え・hazR)のピクセル位置が全コマで同じ。
  - 最後のコマの後に位置合わせの動きがない(終了直後と 300ms 後のコマが一致)。
  - 2 枚の複製の境目が無地の所にあり、見えないか自然な板の重なりに見える。
  - 1280×679(縮小あり)でも同じ確認を 1 回行う。

---

### Task 7: 仕上げの確認

- [ ] **Step 1:** `grep -rn "電源\|MIL-SPEC" src/locales/` でユーザー向け文言に残っていないことを確認(内部名・コメントは対象外)。
- [ ] **Step 2:** `npm run build` の exit code 0。
- [ ] **Step 3:** `npm run test:gate` が全件 PASS(出力は末尾のまとめだけ取り込む)。
- [ ] **Step 4:** masaya に実機で見てもらう項目(標準の切替ボタンのホバーと吹き出し / 切替直後の立ち上がり / レバー / 開閉 4 種)を、平易な言葉で一覧にして渡す。
