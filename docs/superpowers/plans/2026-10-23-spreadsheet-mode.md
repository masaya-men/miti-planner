# 軽減表スプシモード + ヘッダー跡地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減表の「スキルを置く部分」を 1 スキル = 1 列 28px のスプシ表示に切り替えられるようにし、その切替と「表示メンバーの 1 クリック切替」を、標準 / MIL-SPEC 両ヘッダーの「みんなの軽減表」ボタン跡地に置く。

**Architecture:** 表示モードは `useThemeStore` に 1 項目(`timelineView`)として端末保存し、`resolveTimelineView` が WIP 権限・チュートリアル・スマホで `'lanes'` に倒す。スプシ列の定義(`buildSheetColumns`)・クリック→列(`sheetColumnAt`)・配置判定(`resolveSheetTap`)・リキャスト線の区間(`cooldownSpans`)・座標の相互変換(`convertMemberX`)は `src/components/timeline/sheet/` の純粋関数にし、`Timeline.tsx` は `isSheetView` の分岐でそれらを呼ぶだけにする。行のマスは今まで通り 1 メンバー 1 要素(縦罫線は CSS、置いたものだけ絶対配置)。ヘッダー跡地は、標準 = `PartyToggleStrip`(ALL + 8 トグル)と既存 `SegmentButton`、MIL-SPEC = `headerGeometry` の新しいキー列 `members` / `view` を `PartyOps` が `MilspecKey` で描く。

**Tech Stack:** React 19 + TypeScript、zustand persist、Tailwind v4(`app-*` トークン)、MIL-SPEC は `--ma-*` トークン、vitest(happy-dom)、Playwright(検収撮影)。

**Spec:** `docs/superpowers/specs/2026-10-22-spreadsheet-mode-design.md`(末尾「追記」群が本文より優先)。見本 = `docs/.private/2026-10-22-spreadsheet-mode-mockup/index.html` 案 A(`VARIANTS.A`: 列幅 28 / 帯 6、アイコンは 18px)、跡地 = `docs/.private/2026-10-23-header-slot-mockup/index.html` の S1(標準)/ M1(MIL-SPEC)。

## Global Constraints

- 作業場所 `.claude/worktrees/milspec-polish`。commit は親が検収後に行う。サブエージェントは commit しない。
- **着手条件**: 2 重パネル計画(`docs/superpowers/plans/2026-10-22-header-telescoping-panel.md`)の Task 1〜4 が入ったあと。本計画の MIL-SPEC 部分は `headerGeometry.ts` の `splitPlaced` / `h5R`(x = `HDR_CUTS.h5` = 683 基準の右の板)の上に乗る。`headerGeometry.ts` の `drawer` / `glow` / `HDR_BANDS` / `basePanels` の h3・chassis は触らない。
- 設計書の決定値: 列幅 28px(`--sheet-col-w`)/ 帯 6px(`--sheet-band-w`)/ 置いたアイコン 18px(`--sheet-icon-px`、`SHEET_ICON_PX = 18`)/ リキャスト線 2px `rgba(239,68,68,.45)` 相当(標準は `bg-red-500/45`)/ 行高 25(`ROW_UNIT_PX.pc`)は不変。
- `isSheetView === false` のとき、`TimelineRow` / `JobPickerRow` / `MilspecJackRow` / `MitigationItem` / `Timeline` の DOM と style は 1 文字も変わらないこと(新 prop は省略可・既定値で旧出力)。`src/components/__tests__/Timeline.layout.test.tsx`・`MitigationItem.milspec.test.tsx`・`Timeline.recastBand.milspec.test.tsx`・`TimelineRow.milspecAttrs.test.tsx`・`TimelineRow.multiAttack.test.tsx`・`JobPickerRow.test.tsx`・`RecastRow.test.tsx` は変更なしで PASS。
- PC のみ(`isMobileTimeline` のとき切替 UI を出さず、実効モードは `'lanes'`)。WIP: `useCanPreviewWip()` が false なら切替 UI を出さず実効 `'lanes'`。
- 1 マス 1 DOM 禁止。マスは `visiblePartyMembers` 1 人 1 要素のまま(`TimelineRow.tsx:646-665`)。
- 「みんなの軽減表」はヘッダーのボタンを外すだけ。`MitigationSheet.tsx`・`api/popular`・`PopularConsentDialog`・admin featured・`copyCount`・`Timeline.tsx:4380` の文言・i18n キー `popular.*` は触らない。
- i18n は 5 言語同時(`src/locales/{ja,en,zh,zh-Hant,ko}.json`)。文字列直書き禁止。`src/locales/__tests__/zh-hant-completeness.test.ts` PASS。
- CSS: `backdrop-filter` 直書き禁止 / `clip-path: path()` 禁止 / CSS `zoom` 禁止 / 色は `app-*` トークンか MIL-SPEC は `--ma-*`。赤は「できない」の意味でだけ(リキャスト線・トースト)。マウス追従 + state 更新禁止(ホバー予告は初版では**作らない**)。
- 開発中は対象テストだけ `npx vitest run <path>`。push 前だけ `npm run build` + `npm run test:gate`。
- 実機確認は 1489×679・DPR 2.58(dev http://127.0.0.1:5173 が動いている前提。MIL-SPEC 表示は `localStorage['theme-storage']` の `themeStyle:'military'`、`?noboot`)。見本と並べて報告(memory `feedback_visual_fidelity_requires_screenshot_diff`)。

## Review Focus

- 共同編集の相手が「ふつう」で自分が「スプシ」のとき、相手のカーソルとメモが相手と同じジョブの列の中に出る(列の外・左の情報列は同じ位置)。→ Task 9 Step 1 の `convertMemberX` テスト + Step 5 の 2 タブ確認。
- 表示メンバーを減らしたあと(列が減る)に置いたアイコン・帯・線・競合矢印が、見出しのスキルアイコンと同じ x にある(横スクロール中・サイドバー開閉後も)。→ Task 8 Step 4 の実機確認(`[data-sheet-col]` 見出しと `[data-mit-icon]` の `getBoundingClientRect().left` を比較)。
- 版違い(`rampart` / `rampart_v2_pld`)・セラフィズム差し替え(`manifestation` / `accession`)・仮想アイテム(`isVirtual`/`parentId`)を置いたとき「列が無い」で消えない。→ Task 3 Step 1 の `sheetColumnIndex` テスト。
- チャージ技(`maxCharges`)で、線の有無と「押せる / 押せない」が一致する(2 チャージ技は 1 回目のあと線なしで押せる、2 回目のあと線ありで押せない)。→ Task 6 Step 1 の `cooldownSpans` テスト + Task 4 Step 1 の `resolveSheetTap` テスト。
- 保存値が `'sheet'` のまま WIP 権限を失う / スマホで開く / チュートリアルを始めると、必ずレーン表示に戻り、保存値は消えない。→ Task 1 Step 1。

---

### Task 1: 表示モードの保存と解決 + i18n キー

**Files:**
- Modify: `src/store/useThemeStore.ts:15-28`(state)、`:48-64`(persist `version: 2 → 3`、`migrate`)、`:78-92`(`resolveTimelineView` / `useEffectiveTimelineView` を `resolveThemeStyle` の下に追加)
- Modify: `src/locales/ja.json` / `en.json` / `zh.json` / `zh-Hant.json` / `ko.json`(`ui` ブロックと `timeline` ブロックに追加。`feedback_locale_json_textual_edit`: 該当ブロックだけを textual 編集)
- Test: `src/store/__tests__/timelineView.test.ts`(新規)

**Interfaces:**
- Produces:
  - `export type TimelineView = 'lanes' | 'sheet'`
  - `ThemeState.timelineView: TimelineView`(既定 `'lanes'`)、`setTimelineView(view: TimelineView): void`
  - `export function resolveTimelineView(saved: TimelineView, canPreview: boolean, tutorialActive: boolean, isMobile: boolean): TimelineView` — `canPreview` が false / `tutorialActive` / `isMobile` のどれかなら `'lanes'`、それ以外は `saved`
  - `export function useEffectiveTimelineView(): TimelineView` — `useThemeStore((s) => s.timelineView)` + `useCanPreviewWip()` + `useTutorialStore((s) => s.isActive)` + `window.innerWidth < 768`(`Timeline.tsx:768` と同じ式)
  - i18n キー(5 言語。訳は ja/en を正、zh/zh-Hant/ko は実装者が同じ意味で付ける):
    - `ui.party_visibility_members`: 表示メンバー / Members
    - `ui.party_visibility_all`: ALL / ALL(5 言語とも "ALL")
    - `ui.party_visibility_all_tooltip`: 全員を表示 / Show everyone
    - `ui.table_view`: 表の見た目 / Table view
    - `ui.table_view_lanes`: ふつう / Normal
    - `ui.table_view_sheet`: スプシ / Sheet
    - `timeline.sheet_col_tooltip`: `{{name}}（リキャスト {{recast}}秒 / 効果 {{duration}}秒）` / `{{name}} (recast {{recast}}s / duration {{duration}}s)`
    - `timeline.sheet_on_cooldown`: リキャスト中です / On cooldown
- Consumes: `getCanPreviewWip` / `useCanPreviewWip`(`src/hooks/useCanPreviewWip.ts:6-15`)、`useTutorialStore`(`useThemeStore.ts:4` で import 済み)

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/store/__tests__/timelineView.test.ts
import { describe, it, expect } from 'vitest';
import { useThemeStore, resolveTimelineView } from '../useThemeStore';
describe('timelineView', () => {
  it('既定は lanes。setTimelineView で sheet に変わる', () => {
    expect(useThemeStore.getState().timelineView).toBe('lanes');
    useThemeStore.getState().setTimelineView('sheet');
    expect(useThemeStore.getState().timelineView).toBe('sheet');
  });
  it('resolveTimelineView: 権限なし / チュートリアル中 / スマホ は常に lanes。保存値は使わない', () => {
    expect(resolveTimelineView('sheet', true, false, false)).toBe('sheet');
    expect(resolveTimelineView('sheet', false, false, false)).toBe('lanes');
    expect(resolveTimelineView('sheet', true, true, false)).toBe('lanes');
    expect(resolveTimelineView('sheet', true, false, true)).toBe('lanes');
    expect(resolveTimelineView('lanes', true, false, false)).toBe('lanes');
  });
  it('persist version 3: 旧 state(timelineView 無し)は lanes に補われる', () => {
    const migrate = (useThemeStore as unknown as { persist: { getOptions(): { migrate: (s: unknown, v: number) => unknown } } }).persist.getOptions().migrate;
    expect((migrate({ theme: 'dark', themeStyle: 'standard' }, 2) as { timelineView: string }).timelineView).toBe('lanes');
  });
});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/store/__tests__/timelineView.test.ts` → FAIL(`timelineView` が undefined / `resolveTimelineView` 未定義)。

- [ ] **Step 3: 実装** — `useThemeStore.ts` に state・setter・`version: 3`・`migrate` に `if (version < 3 && state.timelineView == null) state.timelineView = 'lanes';` を追加。`resolveTimelineView` / `useEffectiveTimelineView` を `useThemeStore.ts:78-92` の作法で追加。5 言語の JSON に上記キーを追加(`ui` ブロックは `"party_visibility_invert"` の直後、`timeline` ブロックは `"cannot_place_here"` の直後)。

- [ ] **Step 4: 成功を確認** — `npx vitest run src/store/__tests__/timelineView.test.ts src/store/__tests__/themeTutorial.test.ts src/locales/__tests__/zh-hant-completeness.test.ts` → 全件 PASS。

---

### Task 2: 標準ヘッダーの跡地(S1)— ALL + 8 トグル・「表の見た目」2 択・歯車とみんなの軽減表の撤去

**Files:**
- Create: `src/components/PartyToggleStrip.tsx`
- Modify: `src/components/ConsolidatedHeader.tsx:31`(`MitigationSheet` import 削除)、`:36`(`PartyVisibilityMenu` import 削除)、`:152`(`isMitiSheetOpen` 削除)、`:408-451`(右グループを差し替え)、`:530-534`(`<MitigationSheet>` 削除)
- Modify: `src/components/__tests__/ConsolidatedHeader.viewer.test.tsx:137-`(表示/非表示スイッチの件を新部品に書き換え)
- Test: `src/components/__tests__/PartyToggleStrip.test.tsx`(新規)

**Interfaces:**
- Produces: `export function PartyToggleStrip({ sortOrder, size = 22 }: { sortOrder: 'light_party' | 'role'; size?: number }): JSX.Element`
  - 中身: 丸いカプセル(`h-9 rounded-full border border-app-border px-[5px] flex items-center gap-px`)の中に、先頭 **ALL** ボタン(`aria-label={t('ui.party_visibility_all_tooltip')}`、幅 `auto` の `text-[10px] font-black tracking-[0.06em] px-1.5 h-[22px] rounded-full`、`hiddenPartyMemberIds.length === 0` のとき点灯 `bg-app-text/10`)→ 区切り `w-px h-4 bg-app-text/20 mx-[3px]` → `getSortedPartyMemberIds(sortOrder)` 順の 8 ボタン(`data-member-toggle={id}`、`aria-pressed={!hidden}`、`aria-label={t('ui.party_visibility_toggle_tooltip', { id, action })}`、`Tooltip` 付き、22×22 `rounded-full`、中にジョブアイコン `img` 18×18 `rounded`、非表示は `grayscale opacity-30 scale-[.88]`、表示中は `bg-app-text/10`。ジョブ未設定は `PartyVisibilityMenu.tsx:244-249` と同じく `id` 文字)。
  - 区切り線: `sortOrder === 'role'` なら隣り合うメンバーの `role` が変わる所、`'light_party'` なら 4 人目と 5 人目の間だけ。
  - クリック: 1 人 = `PartyVisibilityMenu.tsx:108-115` と同じ `useRenderPendingStore.getState().show()` → 2 重 rAF → `toggleHiddenPartyMember(id)`。ALL = 同じ段取りで `setHiddenPartyMemberIds([])`。
  - 全表示 / 全非表示 / 反転 / ダブルクリックは作らない(masaya 決定)。
- Consumes: `useMitigationStore`(`hiddenPartyMemberIds` / `toggleHiddenPartyMember` / `setHiddenPartyMemberIds`、`useMitigationStore.ts:76, 880-884`)、`useJobs`(`src/hooks/useSkillsData.ts`)、`getSortedPartyMemberIds`(`src/constants/party.ts:13`)、`Tooltip`(`src/components/ui/Tooltip.tsx`)、`useRenderPendingStore`
- ヘッダー右グループの新しい並び(`ConsolidatedHeader.tsx:408-451` を置き換え。左から): `<span className="text-app-base font-black text-app-text uppercase tracking-[0.15em]">{t('ui.party_visibility_members')}</span>` → `<PartyToggleStrip sortOrder={partySortOrder} />` → 区切り線(`:422` と同じ div)→ `{t('ui.table_view')}` の span → `{canPreviewWip && !isMobile && <SegmentButton options={[{value:'lanes',label:t('ui.table_view_lanes')},{value:'sheet',label:t('ui.table_view_sheet')}]} value={timelineView} onChange={setTimelineView} size="sm" pill />}`(`timelineView` / `setTimelineView` は `useThemeStore`。見出し span も `canPreviewWip` の内側)→ 区切り線 → SORT の span + SegmentButton(`:440-450` そのまま)。`readOnly` でも全部有効(`:427-429` のコメントの方針)。

- [ ] **Step 1: 失敗するテスト**

```tsx
// src/components/__tests__/PartyToggleStrip.test.tsx(ConsolidatedHeader.viewer.test.tsx の mock 作法に合わせる)
it('8 人分のトグルと ALL が描かれ、非表示の人は aria-pressed=false', () => {
  useMitigationStore.setState({ hiddenPartyMemberIds: ['D1'] });
  render(<PartyToggleStrip sortOrder="role" />);
  expect(screen.getAllByRole('button').filter(b => b.hasAttribute('data-member-toggle'))).toHaveLength(8);
  expect(screen.getByRole('button', { name: /D1/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: /MT/ })).toHaveAttribute('aria-pressed', 'true');
});
it('トグルを押すと(2 重 rAF の後)toggleHiddenPartyMember が呼ばれる。ALL は setHiddenPartyMemberIds([])', async () => {
  /* vi.useFakeTimers + requestAnimationFrame を vi.stubGlobal で即時化 → click(D1) → hiddenPartyMemberIds が [] / click(ALL) で [] */
});
// ConsolidatedHeader.viewer.test.tsx:139 の件を書き換え
it('viewer 時でも表示メンバーのトグルと表の見た目の切替は無効化されない', () => {
  /* render(viewer) → screen.getByRole('button', { name: /MT/ }) が not disabled、/ui\.table_view_sheet/ も not disabled */
});
it('「みんなの軽減表」ボタンと歯車は無い', () => {
  /* screen.queryByText(/popular\.open_popular/) === null、queryByRole('button', { name: /ui\.party_visibility$/ }) === null */
});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/__tests__/PartyToggleStrip.test.tsx src/components/__tests__/ConsolidatedHeader.viewer.test.tsx`。

- [ ] **Step 3: 実装** — `PartyToggleStrip.tsx` を作り、`ConsolidatedHeader.tsx` を上の並びに。`PartyVisibilityMenu.tsx` 自体は消さない(MIL-SPEC 側は Task 5 で外す。両方外したあとファイルを消すかは親が判断)。

- [ ] **Step 4: 成功を確認** — Step 2 のコマンド PASS。

- [ ] **Step 5: 実機** — 標準ダーク、1489×679・DPR 2.58、サイドバー開で下段を撮り、見本 S1 のカード(`index.html:239`、`right:285px` 基準)と並べる。トグル 22px・カプセル 36px・2 択が SORT と同じ部品であること。進捗 HUD(`:400-406`)ON でも HUD が潰れないこと(縮むのは許容)。画像パスつきで報告。

---

### Task 3: スプシ列の定義(純粋関数)

**Files:**
- Create: `src/components/timeline/sheet/sheetColumns.ts`
- Test: `src/components/timeline/__tests__/sheetColumns.test.ts`

**Interfaces:**
- Produces:
  - `export const SHEET_COL_W = 28`、`export const SHEET_ICON_PX = 18`、`export const SHEET_BAND_W = 6`
  - `export interface SheetColumn { mitigationId: string; def: Mitigation }`
  - `export function buildSheetColumns(jobId: string | null, defs: readonly Mitigation[], currentLevel: number): SheetColumn[]` — `defs.filter(m => m.jobId === jobId)` → `minLevel`/`maxLevel` と `hidden` で絞る(`MitigationSelector.tsx:149-153` と同じ。**`requires` では絞らない**)→ `getMitigationPriority(a.id) - getMitigationPriority(b.id)`(`src/data/mockData.ts:137`)で並べる。`jobId` が null なら `[]`。
  - `export function sheetColumnIndex(columns: readonly SheetColumn[], mitigationId: string, defs: readonly Mitigation[]): number` — 置いた技をどの列に描くか。順に: (1) `mitigationId` と同じ id の列 → (2) `SERAPHISM_TRANSFORMS`(`src/utils/scholarShieldRules.ts:8-11`)の逆引き(manifestation → adloquium、accession → concitation)の列 → (3) 同じ `jobId` + 同じ `icon` の列(`getSharedCooldownIds` の規則、`resourceTracker.ts:29-37`。版違い `rampart` ↔ `rampart_v2_pld`、`feint_base_drg` ↔ `feint_drg`)→ (4) 見つからなければ `-1`。
  - `export function sheetColumnAt(clientX: number, cellLeft: number, colW = SHEET_COL_W): number` — `Math.floor((clientX - cellLeft) / colW)`
  - `export function buildSheetColumnMap(members: readonly PartyMember[], defs: readonly Mitigation[], currentLevel: number): ReadonlyMap<string, SheetColumn[]>` — メンバー id → 列(`jobId` 無しは `[]`)
- Consumes: `getMitigationPriority`(`mockData.ts:137`)、`Mitigation` / `PartyMember`(`src/types/index.ts:34, 180`)

- [ ] **Step 1: 失敗するテスト**(`defs` は `src/data/mockData.ts` の `MITIGATIONS` を直接 import)

```ts
it('pld Lv100: hidden を除き、requires 技(無ければ 0 列でよい)は残し、表示順は getMitigationPriority 昇順', () => {
  const cols = buildSheetColumns('pld', MITIGATIONS, 100);
  expect(cols.length).toBeGreaterThanOrEqual(9);
  expect(cols.every(c => !c.def.hidden)).toBe(true);
  const pri = cols.map(c => getMitigationPriority(c.mitigationId));
  expect(pri).toEqual([...pri].sort((a, b) => a - b));
  // ランパートは版違いが 2 本並ばない(Lv100 では rampart_v2_pld だけ)
  expect(cols.filter(c => c.def.icon === '/icons/Rampart.png')).toHaveLength(1);
});
it('sch Lv100: requires 技(セラフィズム系)の列はあるが hidden(manifestation/accession)の列は無い', () => {
  const ids = buildSheetColumns('sch', MITIGATIONS, 100).map(c => c.mitigationId);
  expect(ids).not.toContain('manifestation');
  expect(ids).toContain('adloquium');
});
it('sheetColumnIndex: 直接一致 / セラフィズム差し替え / 版違い(同 jobId + 同 icon)/ 無ければ -1', () => {
  const sch = buildSheetColumns('sch', MITIGATIONS, 100);
  expect(sheetColumnIndex(sch, 'manifestation', MITIGATIONS)).toBe(sch.findIndex(c => c.mitigationId === 'adloquium'));
  const pld90 = buildSheetColumns('pld', MITIGATIONS, 90);
  const v2 = MITIGATIONS.find(m => m.id === 'rampart_v2_pld')!;
  expect(sheetColumnIndex(pld90, v2.id, MITIGATIONS)).toBe(pld90.findIndex(c => c.def.icon === v2.icon));
  expect(sheetColumnIndex(pld90, 'no_such_skill', MITIGATIONS)).toBe(-1);
});
it('sheetColumnAt: 28px 刻み', () => { expect(sheetColumnAt(100 + 57, 100)).toBe(2); expect(sheetColumnAt(100, 100)).toBe(0); });
it('buildSheetColumnMap: jobId 無しは []', () => { expect(buildSheetColumnMap([{ id: 'D1', role: 'melee', jobId: null } as PartyMember], MITIGATIONS, 100).get('D1')).toEqual([]); });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/timeline/__tests__/sheetColumns.test.ts`。
- [ ] **Step 3: 実装** — 上の Interfaces どおり。`SERAPHISM_TRANSFORMS` は `scholarShieldRules.ts` から `export` に昇格させて逆引きする(値を書き写さない)。
- [ ] **Step 4: 成功を確認** — 同コマンド PASS。

---

### Task 4: クリック → 置く / 消す / 弾く / 相手を選ぶ(純粋判定)+ トースト部品の切り出し

**Files:**
- Create: `src/components/timeline/sheet/sheetTap.ts`
- Create: `src/components/timeline/sheet/PlacementToast.tsx`(`Timeline.tsx:516-520` の見た目を 1 部品に)
- Modify: `src/components/Timeline.tsx:358-364, 473, 516-520`(`MitigationItem` のローカルトーストを `PlacementToast` に差し替え。state と文言はそのまま)
- Test: `src/components/timeline/__tests__/sheetTap.test.ts`、`src/components/__tests__/MitigationItem.milspec.test.tsx`(変更なしで PASS)

**Interfaces:**
- Produces:
  - `export type SheetTapResult = { kind: 'remove'; id: string } | { kind: 'place'; linkedMitigationId?: string; warning?: string } | { kind: 'blocked'; message?: string } | { kind: 'selectTarget' } | { kind: 'selectShield'; shields: AppliedMitigation[] }`
  - `export function resolveSheetTap(def: Mitigation, time: number, ownerMitigations: AppliedMitigation[], allMitigations: AppliedMitigation[], t: (k: string, o?: object) => string): SheetTapResult` — 順に: 同 `mitigationId` + 同 `time` の配置があれば `remove`(`MitigationSelector.tsx:211-214`)→ `validateMitigationPlacement(def, time, ownerMitigations, t)`(`resourceTracker.ts:423`)が `available:false`(`conflictOverride` 含む)なら `blocked`(`message` を添える)→ `resolveMitigationTap(def, time, allMitigations)`(`mitigationTapResolver.ts:19`)の結果をそのまま(`place` のときは `warning` に `status.warning ? status.message : undefined`)
  - `export function buildAppliedMitigation(def: Mitigation, time: number, ownerId: string, extra?: { targetId?: string; linkedMitigationId?: string }): AppliedMitigation` — `Timeline.tsx:2266-2274` と同じ形(`id: genId()`、`duration: def.duration`)。`handleMitigationSelect` もこれを呼ぶように置き換える。
  - `PlacementToast({ message }: { message: string | null })` — `message` が null なら何も描かない。見た目は `Timeline.tsx:517-519` のクラスそのまま。
- Consumes: `validateMitigationPlacement`、`resolveMitigationTap`、`genId`(Timeline.tsx で使っているもの)

- [ ] **Step 1: 失敗するテスト**(`mitigationTapResolver.test.ts` の作法で def を手で組む。`validateMitigationPlacement` は `getMitigationsFromStore` を使うので `useMasterDataStore` / 静的データのどちらでも動く id(例 `reprisal_pld`、`divine_benison`)を使う)

```ts
it('同じ技が同じ秒にあれば remove', () => { expect(resolveSheetTap(reprisal, 10, [placed(reprisal,10,'MT')], [], t)).toEqual({ kind: 'remove', id: expect.any(String) }); });
it('リキャスト中(60 秒技を 10 秒後)は blocked(conflictOverride でも置かない)', () => { expect(resolveSheetTap(reprisal, 20, [placed(reprisal,10,'MT')], [], t).kind).toBe('blocked'); });
it('後ろの配置と被る(警告)なら place + warning', () => { const r = resolveSheetTap(reprisal, 10, [placed(reprisal,40,'MT')], [], t); expect(r.kind).toBe('place'); expect((r as any).warning).toBeTruthy(); });
it('2 チャージ技は 1 回目のあと place、2 回目のあと blocked', () => { /* divine_benison(maxCharges 2, recast 30): uses at 0 → tap at 5 = place / uses at 0,1 → tap at 5 = blocked */ });
it('scope target は selectTarget、copiesShield は selectShield / 1 枚なら place+linked', () => { /* resolveMitigationTap のテストと同じ材料 */ });
it('buildAppliedMitigation は handleMitigationSelect と同じ形', () => { expect(buildAppliedMitigation(reprisal, 10, 'MT', { targetId: 'ST' })).toMatchObject({ mitigationId: reprisal.id, time: 10, duration: reprisal.duration, ownerId: 'MT', targetId: 'ST' }); });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/timeline/__tests__/sheetTap.test.ts`。
- [ ] **Step 3: 実装** — 上のとおり。`PlacementToast` を切り出し、`MitigationItem` は `<PlacementToast message={toastMessage} />` に。
- [ ] **Step 4: 成功を確認** — `npx vitest run src/components/timeline/__tests__/sheetTap.test.ts src/components/__tests__/MitigationItem.milspec.test.tsx src/utils/__tests__/mitigationTapResolver.test.ts` PASS。

---

### Task 5: MIL-SPEC の跡地(M1)— `headerGeometry` の `members` / `view` キー列と `PartyOps`

**Files:**
- Modify: `src/components/military/headerGeometry.ts:40-43`(`HdrKeyRow.id` の union)、`:177-182`(h5R の pockets)、`:197-205`(`keyRows`)、`:233`(`decor.h5` に `members` / `view` の刻印位置)
- Modify: `src/components/military/header/PartyOps.tsx:5-7, 50, 54-55, 68-69, 105-118, 128`(主流・歯車・`MitigationSheet` を外し、`members` / `view` を描く)
- Modify: `src/components/military/__tests__/headerGeometry.test.ts:69-72, 77, 98-101`
- Test: `src/components/military/header/__tests__/PartyOps.test.tsx`(新規)

**Interfaces:**
- 依存(2 重パネル計画 Task 1 の成果物): `splitPlaced` で分かれた `h5R`(`x = 683`、板内座標は `683` を引く)、`HDR_CUTS.h5 = 683`、右の半分は `headerLayout` が `+dx` で平行移動する(`headerGeometry.ts:164`)。新しい受け皿は `p5R.pockets` に `pocket(outline, MW - n, 61.5, p5Rp)` で足す(`:177-182` の作法)。
- Produces(区画座標・1189 基準、右端基準 `MW - n`):
  - `HdrKeyRow.id` に `'members' | 'view'` を追加し、`'mainstream' | 'gear'` を削除
  - 受け皿: `pocket(chamRect(264, 35, 5, 5, 5, 5), MW - 505, 61.5, p5Rp)`(= 684〜948、切れ目 683 の右・SORT 刻印 `MW-222` の左)。`nOut` / `circ(19,16,16)` の受け皿は削除。`sOut`(SORT)は据え置き。
  - `keyRows`: `{ id: 'members', x: MW - 501, y: 66, caps: [ALL, MT, ST, …8 人] }` = 9 個の `shift(chamRect(19, 26, 3.2, 3.2, 3.2, 3.2), dx, 0)`、`dx = [0, 22, 43, 64, 85, 106, 127, 148, 169]`(ALL のあとだけ +3)、全部 `lip: true`。`{ id: 'view', x: MW - 306, y: 66, caps: [shift(chamRect(28, 26, 3.2,…), 0, 0), shift(…, 31, 0)] }`、`lip: true`。
  - `decor.h5.members = { x: MW - 501, y: 56 }`、`decor.h5.view = { x: MW - 306, y: 56 }`(受け皿の上、H5 の板の上端 52 と受け皿 61.5 の間に `MilspecStencil`(5.6px)を置く)
- `PartyOps.tsx`:
  - 刻印: `<MilspecStencil en="MEMBERS" sub={t('ui.party_visibility_members')} hi style={{ left: d.members.x, top: d.members.y }} />`、`<MilspecStencil en="VIEW" sub={t('ui.table_view')} hi …/>`。
  - `members` 列: 1 つ目 = ALL キー(`label={<b>{t('ui.party_visibility_all')}</b>}`、`latch pressed={hiddenPartyMemberIds.length === 0}`、`onClick` = `setHiddenPartyMemberIds([])` を `PartyVisibilityMenu.tsx:119-126` の 2 重 rAF で)。2〜9 = `getSortedPartyMemberIds(partySortOrder)` 順のメンバー(`latch pressed={!hidden}`、`label` = ジョブアイコン `<img className="milspec-key-av" src={job.icon} />`(`military.css:1748` の 12px 丸)か、ジョブ無しは `<b>{id}</b>`、`aria-label` は `ui.party_visibility_toggle_tooltip`、`data-member-toggle={id}`、`onClick` = `toggleHiddenPartyMember(id)` を 2 重 rAF で)。
  - `view` 列: SORT と同じ連動キー(`PartyOps.tsx:120-126` の写し)。`[['lanes', t('ui.table_view_lanes')], ['sheet', t('ui.table_view_sheet')]]`、`pressed={timelineView === value}`、`onClick={() => setTimelineView(value)}`。`useCanPreviewWip()` が false のときは `view` 列と VIEW 刻印を描かない(受け皿は描いたまま)。
  - 撤去: `main` 行・`gear` 行・`MitigationSheet`・`PartyVisibilityMenu` の import・`mitiOpen`・`hasHidden`・`mainName`・`visName`。
- Consumes: `MilspecKey`(`MilspecKey.tsx:190`、`latch` / `pressed` / `lip` の挙動は `:130-138`)、`MilspecStencil`(`MilspecDecor.tsx:20`)、`useThemeStore.timelineView` / `setTimelineView`(Task 1)

- [ ] **Step 1: 失敗するテスト**(`headerGeometry.test.ts` の該当行を書き換え + `PartyOps.test.tsx` 新規。`MilspecHeaderV11.test.tsx` の mock 作法に合わせる)

```ts
// headerGeometry.test.ts
expect(l.keyRows.map((r) => r.id)).toEqual(['aux', 'com', 'party', 'io', 'members', 'view', 'sort']);
expect(['aux','com','party','io','members','view','sort'].map((id) => n(id).caps.length)).toEqual([1, 4, 2, 2, 9, 2, 2]);
expect(n('members').x).toBe(1465 - 501); expect(n('view').x).toBe(1465 - 306);
expect(n('members').caps.every((c) => c.lip) && n('view').caps.every((c) => c.lip)).toBe(true);
expect(sp(l, 'h5R').pockets?.length).toBe(2);           // 受け皿: members+view 1 枚 + sort
expect(pk('h5R', 0)[0]).toBeCloseTo(1465 - 505 + 5 - 959, 6); // chamRect 先頭 = [5,0] + [MW-505, 11]
expect(pk('h5R', 1)).toEqual([1287 - 959, 11]);         // sort は据え置き
expect(l.decor.h5.members).toEqual({ x: 1465 - 501, y: 56 });
// PartyOps.test.tsx
it('ALL + 8 人のトグルキーと ふつう/スプシ の連動キーがあり、みんなの軽減表・歯車は無い', () => {
  /* render(<PartyOps MW={1189} …/>) → [data-member-toggle] が 8 個、name=/ui\.party_visibility_all/ が 1 個、
     /ui\.table_view_lanes/ が aria-checked or data-pressed、queryByText(/popular\.title/) が null、/app\.fab_party_visibility/ が null */
});
it('D1 を押すと(2 重 rAF 後)hiddenPartyMemberIds に D1 が入り、ALL で空に戻る', () => {});
it('canPreviewWip=false なら view キーを描かない', () => { /* vi.mock('../../../hooks/useCanPreviewWip') */ });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/military/__tests__/headerGeometry.test.ts src/components/military/header/__tests__/PartyOps.test.tsx`。
- [ ] **Step 3: 実装** — 上のとおり。
- [ ] **Step 4: 成功を確認** — Step 2 + `npx vitest run src/components/military/header/__tests__/MilspecHeaderV11.test.tsx src/components/military/__tests__/MilspecArmor.test.tsx src/components/military/__tests__/relayout.test.ts` PASS。
- [ ] **Step 5: 実機** — MIL-SPEC、1489×679・DPR 2.58、サイドバー開と閉の 2 枚。見本 M1(`index.html:275-287`、区画 x684〜952)と並べ、受け皿が切れ目 683 の右・SORT 刻印の左に収まり、サイドバー開閉で画面上の位置が動かないこと(2 重パネル計画 Review Focus と同じ基準)。ALL と 8 キーが「沈んで下縁が緑」= 表示中、浮いて灰色 = 非表示。

---

### Task 6: リキャスト線の区間とスプシ座標(純粋関数)— **上位モデル推奨**(チャージ技の充電シミュレーションと `hideEmptyRows` / `maxTime` の切り詰めを帯と同じ規則で合わせる必要があり、ここが崩れると「線と押せるが矛盾」で不合格になる)

**Files:**
- Create: `src/components/timeline/sheet/sheetGeometry.ts`
- Test: `src/components/timeline/__tests__/sheetGeometry.test.ts`

**Interfaces:**
- Produces:
  - `export function sheetIconLeft(colStart: number, colIndex: number, colW = SHEET_COL_W, iconPx = SHEET_ICON_PX): number` = `colStart + colIndex * colW + (colW - iconPx) / 2`
  - `export function cooldownSpans(def: Mitigation, uses: readonly number[], placedTime: number): [number, number][]` — `placedTime` に置いた 1 件が引く線の秒区間(開始, 終了)。`uses` = 同 owner・同共有リキャスト群(`getSharedCooldownIds`)の配置秒(昇順、`placedTime` を含む)。
    - 非チャージ技: `[[placedTime + max(1, def.duration) - 1, placedTime + def.recast]]`(帯の終点の秒から)。`def.recast <= 0` なら `[]`。
    - チャージ技(`def.maxCharges`、実効数は `effectiveMaxCharges`): `getRemainingCharges`(`resourceTracker.ts:296-367`)と同じ充電シミュレーションで「残り 0 になった瞬間 → 次の 1 チャージ回復まで」の区間だけ。`placedTime` の使用で 0 にならなければ `[]`。`requires` 窓方式は `[]`。
  - `export function cooldownLineBox(layout: RowLayout, span: [number, number], maxTime: number, isRowVisible: (t: number) => boolean): { top: number; height: number } | null` — `top = barStartY(layout, span[0])` を基点に、終点は `min(span[1], maxTime)` の行の `topOf + unitPx/2`。`hideEmptyRows` 時は終点が隠れた秒なら、その手前の可視秒(`Timeline.tsx:3696-3709` と同じ探し方)に切り詰める。高さ 0 以下は null。
- Consumes: `barStartY` / `RowLayout`(`rowLayout.ts:131, 41`)、`effectiveMaxCharges` / `getRemainingCharges`(`resourceTracker.ts`。シミュレーション本体を `chargeStateAt(def, uses, t)` として `resourceTracker.ts` から export に切り出し、`getRemainingCharges` と `cooldownSpans` の両方がそれを呼ぶ。既存の `src/utils/__tests__/chargeLevelGate.test.ts` が PASS のまま)

- [ ] **Step 1: 失敗するテスト**

```ts
it('非チャージ: 帯の終点から recast まで', () => { expect(cooldownSpans(reprisal /*dur15 rc60*/, [10], 10)).toEqual([[24, 70]]); });
it('効果 1 秒以下は置いた秒から', () => { expect(cooldownSpans(assize /*dur1 rc40*/, [10], 10)).toEqual([[10, 50]]); });
it('2 チャージ技: 1 回目は線なし、2 回目(0 になる)は次の回復まで', () => {
  expect(cooldownSpans(benison /*max2 rc30*/, [0], 0)).toEqual([]);
  expect(cooldownSpans(benison, [0, 5], 5)).toEqual([[5, 30]]); // 0 で消費開始→30 で 1 つ戻る
});
it('resolveSheetTap と矛盾しない: 線のある秒は blocked、無い秒は place', () => { /* 上の benison 例で t=20 → blocked、t=31 → place */ });
it('cooldownLineBox: maxTime で切る・隠れた終点は手前の可視秒へ・高さ 0 は null', () => { /* computeRowLayout で times 0..30、hideEmptyRows で 25 だけ可視 */ });
it('sheetIconLeft: 28 列で 18px は左右 5px', () => { expect(sheetIconLeft(100, 2)).toBe(100 + 56 + 5); });
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/timeline/__tests__/sheetGeometry.test.ts`。
- [ ] **Step 3: 実装** — 上のとおり。
- [ ] **Step 4: 成功を確認** — 同コマンド + `npx vitest run src/utils/__tests__/chargeLevelGate.test.ts src/utils/__tests__/sameSkillConflicts.test.ts src/components/timeline/__tests__/sheetTap.test.ts` PASS。

---

### Task 7: 列幅・縦罫線・列見出し(表の骨組みをスプシ化)

**Files:**
- Create: `src/components/timeline/sheet/SheetColumnHeader.tsx`(下段 = 列ごとの静的スキルアイコン)
- Create: `src/components/timeline/sheet/sheet.css`(`--sheet-col-w: 28px; --sheet-icon-px: 18px; --sheet-band-w: 6px;` と縦罫線・MIL-SPEC 上書き)
- Modify: `src/components/TimelineRow.tsx:31-58`(prop `sheetCols?: ReadonlyMap<string, number>`)、`:646-665`(幅と `data-sheet-cols`)
- Modify: `src/components/JobPickerRow.tsx:12-26, 55-104`(prop `sheetCols?`、幅、上段のジョブ名 + 位置)、`src/components/military/table/MilspecJackRow.tsx:85-98`(同じ幅)
- Modify: `src/components/Timeline.tsx:771`(`isSheetView`)、`:2675-2678` の直後(`sheetColumnMap` を useMemo)、`:2998-3011`(リキャスト表示ボタンをスプシでは隠す)、`:3078-3090`(`sheetCols` を渡す)、`:3209-3215`(スプシでは `RecastRow` の代わりに `SheetColumnHeader`)、`:3343-3367`(`sheetCols` を渡す)、`:1537-1542`(`recastRowRef.current` が null でも落ちない = 既に `?.`)
- Test: `src/components/__tests__/TimelineRow.sheet.test.tsx`、`src/components/__tests__/JobPickerRow.sheet.test.tsx`、`src/components/timeline/__tests__/SheetColumnHeader.test.tsx`(新規)

**Interfaces:**
- Produces:
  - `TimelineRow` / `JobPickerRow` / `MilspecJackRow` の prop `sheetCols?: ReadonlyMap<string, number>`(メンバー id → 列数)。**未指定なら今の出力と同一**。指定時はメンバー要素の `style.width/minWidth/maxWidth` = `calc(var(--sheet-col-w) * ${n})`(n = 0 なら `var(--sheet-col-w)` 1 列ぶんの空き)、`paddingLeft/Right: 0`、`data-sheet-cols={n}`。`TimelineRow` の memo 比較は `rowPropsEqual`(Map は参照比較)なので `Timeline` 側で参照が安定した Map を渡す。
  - 縦罫線(`sheet.css`): `[data-sheet-cols] { background: repeating-linear-gradient(90deg, transparent 0 calc(var(--sheet-col-w) - 1px), var(--color-app-border, rgba(255,255,255,.10)) calc(var(--sheet-col-w) - 1px) var(--sheet-col-w)); }`(Tailwind トークンの実値は `src/index.css:8-19` を読んで確かめる。`feedback_css_token_verify_before_use`)。ジョブの境目は要素の `border-r`(既存)を `border-app-text/20` に。
  - `JobPickerRow` 上段(スプシ時): `n >= 3` ならアイコン(18px)+ `<span class="text-[10px] font-black">{job 名}</span>` + `<span class="text-[9px] font-mono text-app-text-muted">{member.id}</span>`、`n < 3` ならアイコンだけ。クリック / 右クリックは今のまま。
  - `SheetColumnHeader({ members, sheetColumnMap, getMemberRefCallback? }: …)` — `RecastRow` の位置(`#timeline-header-inner` のメンバー領域、h-10)に、メンバーごとに `data-sheet-member={id}` の箱(幅 = 列数 × `--sheet-col-w`)を置き、その中に列ごとの `<div data-sheet-col={mitigationId} class="w-[var(--sheet-col-w)] h-full flex items-center justify-center">` + `<img data-mit-icon …>`(`--sheet-icon-px`、`bg-black/50 rounded border border-app-border`、`Tooltip content={t('timeline.sheet_col_tooltip', { name, recast: def.recast, duration: def.duration })}`)。`isMilspecTable` では `renderMilspecIdle` を使わない。
  - `Timeline.tsx`: `const timelineView = useEffectiveTimelineView(); const isSheetView = timelineView === 'sheet' && !isMobileTimeline;`、`const sheetColumnMap = useMemo(() => isSheetView ? buildSheetColumnMap(sortedPartyMembers, MITIGATIONS, currentLevel) : null, [...])`、`const sheetCols = useMemo(() => sheetColumnMap && new Map([...sheetColumnMap].map(([id, c]) => [id, c.length])), [sheetColumnMap])`。
- Consumes: Task 3 の `buildSheetColumnMap`、`useEffectiveTimelineView`(Task 1)

- [ ] **Step 1: 失敗するテスト**

```tsx
// TimelineRow.sheet.test.tsx(TimelineRow.milspecAttrs.test.tsx の render 作法)
it('sheetCols 未指定なら width は getColumnCssVar のまま・data-sheet-cols 無し', () => {});
it('sheetCols={MT:9} なら width=calc(var(--sheet-col-w) * 9)、padding 0、data-sheet-cols="9"。要素数は 1 人 1 個のまま', () => {});
// JobPickerRow.sheet.test.tsx
it('sheetCols 指定時: 3 列以上はジョブ名と位置の文字がある、2 列以下はアイコンだけ', () => {});
// SheetColumnHeader.test.tsx
it('列ごとに data-sheet-col=mitigationId のアイコンが列数ぶん並ぶ', () => {});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/__tests__/TimelineRow.sheet.test.tsx src/components/__tests__/JobPickerRow.sheet.test.tsx src/components/timeline/__tests__/SheetColumnHeader.test.tsx`。
- [ ] **Step 3: 実装** — 上のとおり。`sheet.css` は `Timeline.tsx` で import。
- [ ] **Step 4: 成功を確認** — Step 2 + Global Constraints の既存テスト 7 本 PASS。
- [ ] **Step 5: 実機** — スプシに切り替え(ヘッダーのキー)、配置なしの状態で 1489×679・DPR 2.58 を撮り、見本案 A(`?` 無し。見本の `kDemo` を外した状態)と並べる。列幅 28・縦罫線・ジョブ境目の濃い線・2 段見出し・横スクロールが出ること。レーン表示に戻して 1 枚、変化が無いこと。

---

### Task 8: 置く・消す・帯・線・矢印・ポップオーバー(スプシの本体)— **上位モデル推奨**(`Timeline.tsx:3525-3785` の配置ループに分岐を足し、既存のレーン表示を 1px も変えないことと、`MitigationItem` の `iconPx` 化を同時に行う)

**Files:**
- Create: `src/components/timeline/sheet/SheetCooldownLines.tsx`(`data-mit-cd` の薄い要素を配置の数だけ描く)
- Create: `src/components/timeline/sheet/SheetTargetPopover.tsx`(相手 / 鼓舞を選ぶ小窓)
- Modify: `src/components/Timeline.tsx:117-140`(`MitigationItemProps.iconPx?: number`)、`:277, 527-528, 550, 625, 658`(`MITI_ICON_PX` → `iconPx`、`mitiIconOffset` は `(rowLayout.unitPx - iconPx) / 2`)、`:2137-2158`(`handleCellClick` にスプシ分岐)、`:2735-2759`(`columnCenterX` を列中央に)、`:3525-3785`(スプシでは Phase 1 を飛ばして `sheetIconLeft`)
- Modify: `src/components/timeline/rowLayout.ts:128`(`mitiIconOffset(unitPx, iconPx = MITI_ICON_PX)`)
- Test: `src/components/__tests__/Timeline.sheet.test.tsx`(新規)、既存 7 本

**Interfaces:**
- `MitigationItem` の `iconPx`(既定 `MITI_ICON_PX`)。帯の始点 `top = iconPx / 2`、終点目盛りも同じ。**既定で呼べば出力は同一**。
- `handleCellClick(memberId, time, e)` のスプシ分岐(`:2150` のガードの後ろ): `const cols = sheetColumnMap.get(memberId); const cell = e.currentTarget as HTMLElement; const i = sheetColumnAt(e.clientX, cell.getBoundingClientRect().left); const col = cols?.[i]; if (!col) return;` → `resolveSheetTap(col.def, time, ownerMitigations, timelineMitigations, t)`:
  - `remove` → `removeMitigation(id)` / `place` → `addMitigation(buildAppliedMitigation(col.def, time, memberId, { linkedMitigationId }))`(`warning` は `PlacementToast` ではなく既存の競合表示に任せる)/ `blocked` → `cell` に `data-shake` を 300ms 付ける(CSS `@keyframes` 0.25s、`translateX(±2px)`)+ `setSheetToast(message ?? t('timeline.cannot_place_here'))`(`PlacementToast` を Timeline 直下に 1 個)/ `selectTarget` / `selectShield` → `setSheetPopover({ memberId, time, def, kind, shields, x: e.clientX, y: e.clientY })`。
- `SheetTargetPopover({ state, onPick, onClose })`: `glass-tier3 fixed z-[99999] rounded-2xl p-2`(`PartyVisibilityMenu.tsx:209` と同じ器、`reference_modal_light_mode_white_bg`)。`selectTarget` = 4×2 のジョブアイコン(`MitigationSelector.tsx:462-503` と同じ材料・`targetCannotBeSelf` は disabled)、`selectShield` = 鼓舞の一覧(`:508-` と同じ。0 件なら「有効な鼓舞がありません」+ そのまま置くボタン)。`onPick({ targetId? , linkedMitigationId? })` → `addMitigation(buildAppliedMitigation(...))`。外側クリック / Escape で閉じる。画面端はクランプ(`PartyVisibilityMenu.tsx:134-151` の式)。
- 配置ループ(`:3543` の `Object.entries(mitigationsByOwner).forEach`)のスプシ分岐: `displayItems` の生成(`:3549-3627`)はそのまま。`isSheetView` のとき Phase 1(`:3645-3680`)を通さず、各 item で `const ci = sheetColumnIndex(cols, mitigation.mitigationId, MITIGATIONS)`(仮想は `parentId` の item の列)→ `ci < 0` なら描画せず `if (import.meta.env.DEV) console.warn('[sheet] no column', mitigation.mitigationId)` → `absoluteLeft = sheetIconLeft(colStart, ci)`、`iconPx={SHEET_ICON_PX}`、`layoutReady={layout !== undefined}`。`height`(帯)の計算 `:3691-3753` は共通。
- `SheetCooldownLines({ layout, items, cols, memberLayout, maxTime, hideEmptyRows, isRowVisible })`: 配置 1 件ごとに `getSharedCooldownIds(mitigationId)` の各 id の列(`sheetColumnIndex`)に、`cooldownSpans(def, uses, time)` × `cooldownLineBox` の箱を `<div data-mit-cd class="absolute w-[2px] bg-red-500/45 pointer-events-none" style={{ left: colCenter - 1, top, height }} />` で描く。仮想アイテムと `autoHidden` は対象外。
- 競合矢印 `:2748-2755`: `isSheetView` なら `columnCenterX = layout.left + sheetIconLeft(0, ci) + SHEET_ICON_PX / 2`。
- Consumes: Task 3・4・6 の全関数、`getSharedCooldownIds`(`resourceTracker.ts:29`)

- [ ] **Step 1: 失敗するテスト**(`Timeline.layout.test.tsx` の render / mock 作法。`useThemeStore.setState({ timelineView: 'sheet' })` + `vi.mock('../../hooks/useCanPreviewWip', () => ({ useCanPreviewWip: () => true, getCanPreviewWip: () => true }))`)

```tsx
it('スプシ: 置いたアイコンは列の左端 + 5px、幅 18px(data-mit-icon の style)', () => {});
it('スプシ: リキャスト線 data-mit-cd が配置の数だけあり、共有リキャストの列にも引かれる', () => {});
it('スプシ: マスをクリックすると MitigationSelector は開かず addMitigation が呼ばれる。もう一度で removeMitigation', () => {});
it('スプシ: リキャスト中のマスは data-shake が付きトーストが出て addMitigation は呼ばれない', () => {});
it('レーン: timelineView=sheet でも canPreviewWip=false なら従来 DOM(data-sheet-cols 無し・data-mit-cd 無し)', () => {});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/__tests__/Timeline.sheet.test.tsx`。
- [ ] **Step 3: 実装** — 上のとおり。`MitigationItem` の置き換えは `MITI_ICON_PX` の 5 か所だけ。
- [ ] **Step 4: 成功を確認** — Step 2 + Global Constraints の既存 7 本 + `src/components/timeline/__tests__/` 全部 PASS。
- [ ] **Step 5: 実機(必須)** — 1489×679・DPR 2.58、スプシで (a) 置く・もう一度で消す、(b) リプライザルを置いて帯 15 秒 + 薄赤の線 60 秒、(c) 線の上のマスを押して揺れ + 赤トースト、(d) ディヴァインベニゾンを 2 回置いて線が 2 回目からだけ出る、(e) インターベンションで小窓 → 相手を選んで置く、(f) 表示メンバーを 2 人減らしたあとに見出しアイコンと置いたアイコンの `left` が一致(Playwright で `[data-sheet-col]` と `[data-mit-icon]` の `getBoundingClientRect().left` を同じ列で比較し、差 ≤ 1px を報告)、(g) 横スクロールで右端の列を見る、を画像パスつきで報告。見本案 A(`DEMO` 配置あり)と (b) を並べる。レーン表示に戻して「置いたものが今まで通りの位置」を 1 枚。

---

### Task 9: 共同編集 — メモとカーソルの横位置を「ジョブの列の中」で合わせる

**Files:**
- Create: `src/components/timeline/sheet/memberX.ts`
- Modify: `src/components/Timeline.tsx:1081-1100`(メモ作成の `xRatio`)、`:1167`(メモ編集の `leftPx`)、`:1445-1462`(カーソル送信の `xRatio`)、`:3792-3800`(`MemoOverlay` に渡す座標)、`src/components/collab/CursorOverlay.tsx:66`(`xRatioToPx` の前に変換)
- Test: `src/components/timeline/__tests__/memberX.test.ts`、`src/components/collab/__tests__/CursorOverlay.test.tsx`(変更なしで PASS)

**Interfaces:**
- 決定(設計書追記 Q1 = b / カーソル): 保存・送信する `xRatio` は **常にレーン表示の座標**(データの形と古いクライアントとの互換を保つ)。スプシ表示では「読むとき」に レーン → スプシ、「書くとき」に スプシ → レーン へ変換する。presence に `view` は**足さない**(送る側が必ずレーン座標に直すので要らない。設計書 §3.6 の `view` 追加と「相手を隠す」は追記で撤回済み)。
- Produces:
  - `export interface MemberBand { id: string; left: number; width: number }`
  - `export function lanesBands(members: readonly PartyMember[], memberStart: number, thW: number, dpsW: number, padX: number): MemberBand[]` — レーン表示の列(`getColumnCssVar` と同じ: 幅 = `thW|dpsW + padX*2`、`index.css:1587-1591` の実値 151 / 53 / 2.9 を `getComputedStyle(document.documentElement).getPropertyValue('--col-th-w')` 等から読む。読めなければその数)
  - `export function sheetBands(members: readonly PartyMember[], memberLayout: ReadonlyMap<string, { left: number; width: number }>): MemberBand[]`
  - `export function convertMemberX(x: number, from: readonly MemberBand[], to: readonly MemberBand[]): number` — `x` を含む `from` の帯 → 同じ id の `to` の帯の同じ割合。どの帯にも入らなければ `x` のまま(左の情報列は両表示で同じ)。`to` に同じ id が無ければ(相手が非表示)`x` のまま。
  - `export function lanesSheetWidth(bands: readonly MemberBand[], fallback: number): number` — レーン表示のシート幅 = 最後の帯の右端(帯が無ければ `fallback`)
  - `Timeline.tsx`: `const lanes = isSheetView ? lanesBands(visiblePartyMembers, memberStartPx, …) : null`(`memberStartPx` = 最初の `[data-member-id]` の `offsetLeft`、`:1086-1089` と同じ取り方を useLayoutEffect で state 化)、`const sheet = isSheetView ? sheetBands(visiblePartyMembers, memberLayout) : null`。読む: `px = convertMemberX(xRatio * lanesWidth, lanes, sheet)`。書く: `xRatio = convertMemberX(px, sheet, lanes) / lanesWidth`。`isSheetView` が false なら今の式のまま。
  - `CursorOverlay` は `xRatioToPx` の代わりに prop `toLocalXRef: React.RefObject<(xRatio: number) => number>` を受け、rAF 内で `.current(pos.xRatio)` を呼ぶ(`timeToYMapRef` と同じ「参照箱」方式。レーン表示では `xRatioToPx(xRatio, width)` を入れる)。
- Consumes: `memberLayout`(`Timeline.tsx:2721`)、`visiblePartyMembers`、`MemoOverlay`(`MemoOverlay.tsx:56, 106, 138` の `xRatioToPx` / `pxToXRatio` に同じ変換を prop で差し込む)

- [ ] **Step 1: 失敗するテスト**

```ts
const lanes = [{ id: 'MT', left: 570, width: 156.8 }, { id: 'H1', left: 726.8, width: 156.8 }];
const sheet = [{ id: 'MT', left: 570, width: 28 * 13 }, { id: 'H1', left: 934, width: 28 * 14 }];
it('帯の中は同じ割合に移る', () => { expect(convertMemberX(726.8 + 78.4, lanes, sheet)).toBeCloseTo(934 + 196, 6); });
it('帯の外(左の情報列)はそのまま', () => { expect(convertMemberX(100, lanes, sheet)).toBe(100); });
it('相手側に無い帯(非表示)はそのまま', () => { expect(convertMemberX(726.8 + 10, lanes, [sheet[0]])).toBe(736.8); });
it('往復で元に戻る', () => { expect(convertMemberX(convertMemberX(600, lanes, sheet), sheet, lanes)).toBeCloseTo(600, 6); });
it('lanesBands は getColumnCssVar と同じ幅(T/H 151+5.8、DPS 53+5.8)', () => {});
```

- [ ] **Step 2: 失敗を確認** — `npx vitest run src/components/timeline/__tests__/memberX.test.ts`。
- [ ] **Step 3: 実装** — 上のとおり。
- [ ] **Step 4: 成功を確認** — Step 2 + `npx vitest run src/components/collab/__tests__/CursorOverlay.test.tsx src/components/Memo/__tests__/ src/lib/collab/__tests__/presence.test.ts` PASS。
- [ ] **Step 5: 実機(2 タブ・本番相当の部屋。memory `reference_collab_two_client_version_skew`: 両タブともリロードしてから)** — (a) 片方レーン・片方スプシ: レーン側で MT の列の中央にメモを置く → スプシ側で MT の列の中(13 列の中央付近)に出る。スプシ側で H1 の列の右端にメモを置く → レーン側で H1 の列の右端。カーソル ON で同じことを確認。(b) 両方スプシ: 置く・消すが相手に即反映。画像パスつきで報告。

---

### Task 10: MIL-SPEC の質感とテーマ確認

**Files:**
- Modify: `src/components/timeline/sheet/sheet.css`(`.theme-military .milspec-app` 前置の上書き)、`src/styles/military.css:174-213`(必要なら `--ma-sheet-line` 等のトークンを dark / light 両方に)
- Test: `src/components/military/__tests__/milspecTokens.test.ts`(新トークンがあれば dark / light 両方に定義されている件を追加)

- [ ] **Step 1:** 置いたアイコン・帯・終点は `data-mit-icon` / `data-mit-bar` / `data-mit-end` で `milspecTable.css:245-275` の上書きが自動で効くことを実機で確認(18px でも `box-shadow` 枠が崩れないこと)。
- [ ] **Step 2:** 新要素の MIL-SPEC 版を `sheet.css` に書く: `[data-mit-cd]` = `background: rgba(var(--ma-dng-rgb), .45)`、縦罫線 = `--ma-cell-line`(`military.css:194`)、ジョブ境目 = `--ma-row-line`、列見出し `[data-sheet-col] img` = `milspecTable.css:248-253` と同じ角丸 2px + 影、上段のジョブ名文字 = `--ma-txt-atk`、揺れ・トーストは標準と共通。色の直書き禁止。
- [ ] **Step 3:** 実機: MIL-SPEC ダーク / ライト、標準ライトでスプシを 1 枚ずつ(配置あり)。標準ダークの見本案 A と、MIL-SPEC は既存のレーン表示の MIL-SPEC と質感が揃っていることを並べて報告。`npx vitest run src/components/military/__tests__/milspecTokens.test.ts` PASS。

---

### Task 11: push 前ゲートと検収資料

- [ ] **Step 1:** `npm run build` の exit code 0。
- [ ] **Step 2:** `npm run test:gate` PASS。
- [ ] **Step 3:** Task 2・5・7・8・9・10 の画像を scratchpad の 1 フォルダにまとめ、「見本 / 本物」の対で一覧(パス + 1 行の所見)を親へ報告。masaya に確認してもらう論点: (1) MIL-SPEC の受け皿の幅(264)と刻印 MEMBERS / VIEW の文言、(2) 標準の見出し文字の有無で下段が窮屈でないか(進捗 HUD ON のとき)、(3) 18px のアイコン、(4) ホバー予告を次版で入れるか。
