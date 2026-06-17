# 表の情報列固定（PC・横スクロール時）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC でタイムライン表を横スクロールしたとき、左の情報列ブロック（フェーズ／ラベル／時間／敵の攻撃／元のダメージ／軽減後ダメージ）を画面に固定し、右のスキル列だけが横スクロールするようにする。

**Architecture:** 情報列を「sticky な独立ペイン」として分離する。各行は性能最適化 `content-visibility: auto` で独立した stacking context になり、軽減アイコン／色付きバーは行とは別レイヤーで行より後に描画されるため、情報列セルを行内で z-index 最大にしても軽減バーの下に潜る。そこで情報列（各行の情報セル＋フェーズ／ラベル／TL選択オーバーレイ）を sheetContainer の**最後**に描画する `position: sticky; left: 0` のペインへ集約し、不透明背景＋軽減レイヤーより高い z-index を与えてスクロールしてくるバーを隠す。スキル列セルと軽減レイヤーは現状のまま（スクロール側）。ヘッダー／コントロールバーは既存の `translateX` 同期を「スキル列領域のみ」に限定し、情報列領域は据え置く。

**Tech Stack:** React 18 + TypeScript（strict / tsc -b）、Vite、Tailwind v4（任意クラス＋CSS 変数）、Zustand、vitest（pool='vmThreads'）、Playwright。

## Global Constraints

- 対象は **PC（768px 以上）のみ**。モバイル（`MobileTimelineRow` 経路・`isMobileTimeline === true`）は一切変更しない・無影響。
- 色・影・背景は**デザイントークン（`--color-*`）経由**。px 直書きの色禁止、font-size は `--font-size-*` トークン経由（[ui-design.md](../../../.claude/rules/ui-design.md) / [DESIGN.md](../../../.claude/rules/DESIGN.md)）。
- `backdrop-filter` 直書き禁止・`clip-path: path()` 禁止（[css-rules.md](../../../.claude/rules/css-rules.md)）。影は `box-shadow` で実装。
- UI テキストは i18n キー経由（新規文言はないが、既存文言を移設する際もキーを保持）。
- マウス追従（`onMouseMove` 高頻度＋state 更新）禁止。hover は `onMouseEnter` 単位か CSS で。
- push 前は `npm run build`（tsc -b 厳密・未使用変数/型不足が罠）＋ `vitest run` 必須。vitest は `pool='vmThreads'` 維持・出力をパイプしない（[reference_vitest_*] memory）。
- 既存の列幅 CSS 変数（`--col-phase-w` / `--col-label-w` / `--col-time-w` / `--col-mechanic-w` / `--col-counter-w` / `--col-member-start`・[index.css:1343-1377](../../../src/index.css#L1343)）を流用。情報ペイン幅 = `--col-member-start`。
- デザイン変更フロー：見た目に関わる確定は実機でユーザー確認してから本番反映（[ui-design.md] 承認フロー）。
- 既存テストを壊さない。`recastRow.test.ts` / conflict 系など Timeline 関連テストが緑のまま。

## File Structure

| ファイル | 責務 | 変更種別 |
|----------|------|----------|
| `src/components/TimelineInfoColumns.tsx` | 1 行分の情報列（フェーズ／ラベル／時間／敵の攻撃／U.Dmg／Dmg）を描画する新コンポーネント。`TimelineRow` から抽出。 | 新規 |
| `src/components/TimelineRow.tsx` | スキル列セルのみを描画（情報列を `TimelineInfoColumns` へ移譲）。 | 改修 |
| `src/components/Timeline.tsx` | (a) 情報ペイン（sticky）を sheetContainer 末尾に描画し、`TimelineInfoColumns` 行・フェーズ/ラベル/TL選択オーバーレイをそこへ集約 (b) ヘッダー/コントロールバーの `translateX` をスキル領域限定に分割 (c) スクロール時の影クラス制御。 | 改修 |
| `src/index.css` | 情報ペインの z-index・不透明背景・境界影のトークン/クラス。 | 改修 |
| `src/components/__tests__/timelineFrozenInfo.test.tsx` | スクロール同期の分割（スキル領域だけ translateX）と影クラスのトグルの DOM ユニットテスト。 | 新規 |

> **注意（実装者向け）:** 情報列・各オーバーレイの JSX は既存実装を**そのまま移設**すること（クラス名・i18n キー・onClick ハンドラ・data 属性・CSS 変数を 1 文字も変えない）。本計画は「どこへ何を動かすか」と「新規スキャフォールドのコード」を示す。移設対象の現物は指定行を Read して使う。

---

## Phase 0: 準備とトークン

### Task 1: 情報ペイン用 CSS トークン／クラスを追加

**Files:**
- Modify: `src/index.css`（列幅変数定義の近傍・[index.css:1343-1397](../../../src/index.css#L1343) 付近）

**Interfaces:**
- Produces: CSS クラス `.timeline-info-pane`（sticky・幅 `--col-member-start`・不透明背景・高 z-index）、`.timeline-info-pane--scrolled`（右端 box-shadow）。CSS 変数 `--timeline-info-pane-z`（軽減レイヤーの最大 z=30 より十分上＝ `60`）。

- [ ] **Step 1: クラスとトークンを追加**

`src/index.css` の Timeline 列幅トークン群（`--col-member-start` 定義の下、PC メディアクエリ内）に追記する。背景はテーマ変数経由（`--color-bg-primary` / light は white を使う既存パターン＝ scrollContainer と同じ `bg-white dark:bg-[var(--color-bg-primary)]` に合わせる）。

```css
/* 情報列固定ペイン（PC 横スクロール時に左の情報列を据え置く） */
.timeline-info-pane {
    position: sticky;
    left: 0;
    z-index: 60; /* 軽減レイヤー(バー z-10/アイコン z-20/バッジ z-30)より上 */
    width: var(--col-member-start);
    min-width: var(--col-member-start);
    /* 背景は本文スクロール領域と同色（不透明）にしてスクロールしてくるバーを隠す */
    background: white;
}
.dark .timeline-info-pane {
    background: var(--color-bg-primary);
}
/* スクロール位置 > 0 のときだけ境界に控えめな影 */
.timeline-info-pane--scrolled {
    box-shadow: 6px 0 8px -4px rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npm run build`
Expected: EXIT 0（CSS 追加のみ・型影響なし）

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(timeline): 情報列固定ペイン用のCSSトークン/クラスを追加"
```

---

## Phase 1: ヘッダー／コントロールバーの translateX 分割

> ヘッダー・コントロールバーはスクロールコンテナ外で `transform: translateX(-scrollLeft)` により本文へ追従している（[Timeline.tsx:1290-1315](../../../src/components/Timeline.tsx#L1290)）。情報列見出し／ツールバーを据え置くため、translateX の対象を「スキル列領域のみ」に分割する。

### Task 2: ヘッダー／コントロールバー内部を「情報領域」と「スキル領域」に分け、translateX をスキル領域だけに当てる

**Files:**
- Modify: `src/components/Timeline.tsx`
  - `handleScrollSync`（[1290-1315](../../../src/components/Timeline.tsx#L1290)）
  - ヘッダー `#timeline-header-inner`（[2583-2696](../../../src/components/Timeline.tsx#L2583)）
  - コントロールバー `#timeline-controls-inner`（[2356 付近](../../../src/components/Timeline.tsx#L2356)）
- Test: `src/components/__tests__/timelineFrozenInfo.test.tsx`

**Interfaces:**
- Consumes: 既存 `scrollContainerRef`、`headerRef`、`controlBarRef`。
- Produces: 各 inner 内にスキル領域だけを包む要素 `#timeline-header-skill` / `#timeline-controls-skill`。`handleScrollSync` はこの 2 つ（＋本文の影クラス・Task 5）に `translateX` を当てる。情報領域（見出し/ツールバー）は translate しない。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/timelineFrozenInfo.test.tsx` を新規作成。`handleScrollSync` 相当のロジックを純関数として切り出す前提で、まず「スキル領域要素にだけ translateX が当たり、情報領域には当たらない」ことを検証する DOM テストを書く。

```tsx
import { describe, it, expect } from 'vitest';
import { applyHorizontalScrollSync } from '../Timeline.layoutHooks';

describe('applyHorizontalScrollSync', () => {
  it('スキル領域だけ translateX し、情報領域は動かさない', () => {
    const skill = document.createElement('div');
    const info = document.createElement('div');
    applyHorizontalScrollSync({ scrollLeft: 120, skillEls: [skill] });
    expect(skill.style.transform).toBe('translateX(-120px)');
    expect(info.style.transform).toBe(''); // 触らない
  });

  it('影クラスは scrollLeft>0 で付与、0 で除去', () => {
    const pane = document.createElement('div');
    applyHorizontalScrollSync({ scrollLeft: 1, skillEls: [], shadowEls: [pane] });
    expect(pane.classList.contains('timeline-info-pane--scrolled')).toBe(true);
    applyHorizontalScrollSync({ scrollLeft: 0, skillEls: [], shadowEls: [pane] });
    expect(pane.classList.contains('timeline-info-pane--scrolled')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/timelineFrozenInfo.test.tsx`
Expected: FAIL（`applyHorizontalScrollSync` 未定義）

- [ ] **Step 3: 純関数を実装**

`src/components/Timeline.layoutHooks.ts` に追加（既存ファイル・[Timeline.layoutHooks.ts](../../../src/components/Timeline.layoutHooks.ts)）。

```ts
export function applyHorizontalScrollSync(opts: {
  scrollLeft: number;
  skillEls: (HTMLElement | null | undefined)[];
  shadowEls?: (HTMLElement | null | undefined)[];
}): void {
  const { scrollLeft, skillEls, shadowEls = [] } = opts;
  for (const el of skillEls) {
    if (el) el.style.transform = `translateX(-${scrollLeft}px)`;
  }
  for (const el of shadowEls) {
    if (!el) continue;
    el.classList.toggle('timeline-info-pane--scrolled', scrollLeft > 0);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/timelineFrozenInfo.test.tsx`
Expected: PASS

- [ ] **Step 5: ヘッダー／コントロールバーの DOM を分割**

`#timeline-header-inner`（2583）の子のうち、**情報列見出し**（フェーズ/ラベル/時間/敵の攻撃/元ダメージ/軽減後ダメージ、2585-2685）はそのまま inner 直下に残す。**スキル領域**＝ `<RecastRow ... />`（2690）を `<div id="timeline-header-skill" className="flex items-center h-full will-change-transform">…</div>` で囲む。

同様に `#timeline-controls-inner`（2356）の子のうち、ツールバー（表を展開する/AA追加/メモ/undo/redo 等＝情報列幅に対応する左側）は inner 直下に残し、ジョブアイコン列（JobPickerRow 相当・スキル領域）を `<div id="timeline-controls-skill" className="flex items-center h-full will-change-transform">…</div>` で囲む。

> inner 自体の `translateX` は除去する（inner には当てない）。代わりに skill 要素にだけ当てる。inner には `will-change-transform` が付いていたら skill 側へ移す。

- [ ] **Step 6: `handleScrollSync` を新ロジックへ差し替え**

[Timeline.tsx:1290-1315](../../../src/components/Timeline.tsx#L1290) の本体を、`applyHorizontalScrollSync` 呼び出しに置き換える。

```ts
const handleScrollSync = () => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    const scrollLeft = sc.scrollLeft;
    applyHorizontalScrollSync({
        scrollLeft,
        skillEls: [
            headerRef.current?.querySelector('#timeline-header-skill') as HTMLElement | null,
            controlBarRef.current?.querySelector('#timeline-controls-skill') as HTMLElement | null,
        ],
        // shadowEls は Task 5 で情報ペイン ref を追加する
    });
};
```

> 縦スクロール同期や `paddingRight`（スクロールバー幅補正・[1332-1335](../../../src/components/Timeline.tsx#L1332)）など既存の他処理は残す。

- [ ] **Step 7: ビルド＋テスト＋実機（手動）確認**

Run: `npm run build && npx vitest run src/components/__tests__/timelineFrozenInfo.test.tsx`
Expected: build EXIT 0 / テスト PASS

手動（`npm run dev`・PC 幅）: 横スクロールすると**ヘッダーの情報列見出し（フェーズ/時間/敵の攻撃 等）が据え置きで残り**、ジョブアイコン列（リキャスト/ジョブピッカー）だけが動く。本文側はまだ全体が動く（Phase 2 で対応）ので、この時点では「ヘッダー見出しだけ固定」状態でよい。

- [ ] **Step 8: Commit**

```bash
git add src/components/Timeline.tsx src/components/Timeline.layoutHooks.ts src/components/__tests__/timelineFrozenInfo.test.tsx
git commit -m "feat(timeline): ヘッダー/コントロールバーのtranslateXをスキル領域に限定(情報見出しを固定)"
```

---

## Phase 2: 情報列を sticky ペインへ分離（本体）

### Task 3: 情報列を `TimelineInfoColumns` コンポーネントへ抽出（純リファクタ・見た目不変）

**Files:**
- Create: `src/components/TimelineInfoColumns.tsx`
- Modify: `src/components/TimelineRow.tsx`（情報列 JSX [336-682](../../../src/components/TimelineRow.tsx#L336) を移設し、`<TimelineInfoColumns .../>` 呼び出しに置換）

**Interfaces:**
- Produces: `export const TimelineInfoColumns: React.FC<TimelineInfoColumnsProps>`。props は `TimelineRow` が情報列描画に使っている値の部分集合（`time`, `events`, `damages`, `partyMembers`, `swapMarkers`, `phases`, `phaseColumnCollapsed`, `labelColumnVisible`, `hasPhases`, `showRowBorders`, `timelineSelectMode`, `labelSelectMode`, `contentLanguage`, `t` 由来表示, および onClick 系 `onPhaseAdd`/`onLabelAdd`/`onAddEventClick`/`onEventClick`/`onMobileDamageClick`/`onTimelineSelect`/`onTimelineSelectHover`）。
- Consumes: なし（既存 props をそのまま受け渡す）。

- [ ] **Step 1: `TimelineInfoColumns.tsx` を作成し、情報列 JSX を移設**

`TimelineRow.tsx` の Phase Column〜Dmg Column（[336-682](../../../src/components/TimelineRow.tsx#L336)）の JSX を**そのまま**新コンポーネントの return に移す。インポート（`clsx`, `Tooltip`, `PcTypeToggle`, `DamageTypeIcon`, `EventNameSpan`, `MobileTargetBadge`, `MobileMitiIcons`, `PcCopyButton`, `PcTargetToggle`, `AnimatedDamage`, `getEffectiveTarget`, `getEventName`, `formatDmg`, `getPhaseName`, アイコン等）も移す。props 型 `TimelineInfoColumnsProps` を定義し、本体で使う値を列挙。

> 行のルート `<div data-time-row absolute left-0 ...>`（304-307）と `--hover-line-*` style（314-322）は **`TimelineRow` 側に残す**（行コンテナはスキル側の責務）。`TimelineInfoColumns` は「行の中身のうち情報列部分」だけを返す（フラグメント）。hover line / 行 hover の扱いは Task 6 で調整するため、この Task では現状の DOM 位置（行内）を維持して見た目を変えない。

- [ ] **Step 2: `TimelineRow` から情報列を呼び出しに置換**

`TimelineRow.tsx` の 336-682 を `<TimelineInfoColumns {...infoProps} />` に置換。`infoProps` は上記 props を既存変数から渡すだけ。スキル列セル（[684-706](../../../src/components/TimelineRow.tsx#L684)）はそのまま残す。

- [ ] **Step 3: ビルド＋既存テスト**

Run: `npm run build && npx vitest run src/components/__tests__`
Expected: build EXIT 0 / 既存テスト緑（純リファクタなので回帰なし）

- [ ] **Step 4: 手動確認（見た目不変）**

`npm run dev`・PC 幅で、抽出前と表示が同一（情報列・ダメージ・フェーズ列が従来どおり）であることを目視。

- [ ] **Step 5: Commit**

```bash
git add src/components/TimelineInfoColumns.tsx src/components/TimelineRow.tsx
git commit -m "refactor(timeline): 情報列をTimelineInfoColumnsへ抽出(見た目不変)"
```

### Task 4: 情報ペイン（sticky）を sheetContainer 末尾に描画し、情報列をペインへ移す

**Files:**
- Modify: `src/components/Timeline.tsx`
  - 本文行の描画ループ（`TimelineRow` を並べる箇所・[2900 付近](../../../src/components/Timeline.tsx#L2900)）
  - フェーズオーバーレイ（[2955-3001](../../../src/components/Timeline.tsx#L2955)）／ラベルオーバーレイ（[3003 以降](../../../src/components/Timeline.tsx#L3003)）／TL選択オーバーレイ（[3052-3063](../../../src/components/Timeline.tsx#L3052)）
  - sheetContainer の子構成
- Modify: `src/components/TimelineRow.tsx`（情報列の呼び出しを除去し、スキル列セルのみ描画）

**Interfaces:**
- Consumes: `TimelineInfoColumns`（Task 3）、`.timeline-info-pane` クラス（Task 1）。
- Produces: `infoPaneRef`（`React.RefObject<HTMLDivElement>`）。情報ペイン DOM。

- [ ] **Step 1: 情報ペイン要素を追加**

sheetContainer（`sheetContainerRef`）の**最後の子**として情報ペインを追加する。ペインは行と同じ高さ全域（`height: ${sheetHeight}px` 相当・既存の `sheetWidth`/総高さ算出値を流用）を持つ `position: sticky` ブロック。

```tsx
{!isMobileTimeline && (
  <div ref={infoPaneRef} className="timeline-info-pane" style={{ height: `${sheetTotalHeight}px` }}>
    {/* (A) フェーズオーバーレイ群（2955-3001 から移設） */}
    {/* (B) ラベルオーバーレイ群（3003- から移設） */}
    {/* (C) TL選択オーバーレイ（overlayRef・3052-3063 から移設） */}
    {/* (D) 各行の情報列：行と同じ top で絶対配置 */}
    {infoRows /* = 行ループで生成した <div absolute top> 内に <TimelineInfoColumns/> */}
  </div>
)}
```

> `sheetTotalHeight` は既存の総高さ（最終行 top + 行高）を使う。算出済みの値があればそれを、無ければ行ループ最終 `currentY` を流用。

- [ ] **Step 2: 行ループで情報行を別途生成**

PC 経路の行ループ（`TimelineRow` を push している箇所）で、同じ `time`/`top` を使って情報行も生成し `infoRows` 配列へ push する。情報行のラッパは行と同じ絶対配置＋ content-visibility を踏襲：

```tsx
infoRows.push(
  <div
    key={`info-${time}`}
    className="absolute left-0 w-full flex h-[50px] group [content-visibility:auto] [contain-intrinsic-size:auto_50px]"
    style={{ top: `${top}px`,
      '--hover-line-left': /* 既存と同じ計算 */,
      '--hover-line-width': /* 既存と同じ計算 */,
    } as React.CSSProperties}
  >
    <TimelineInfoColumns {...infoProps} />
  </div>
);
```

- [ ] **Step 3: `TimelineRow` から情報列を除去**

`TimelineRow` は**スキル列セルのみ**を描画する（Task 3 で残した `<TimelineInfoColumns/>` 呼び出しを削除）。行ルートの幅・top はそのまま。これでスキル行と情報行が別レイヤーになる。

- [ ] **Step 4: フェーズ／ラベル／TL選択オーバーレイをペインへ移設**

[2955-3063](../../../src/components/Timeline.tsx#L2955) の 3 オーバーレイ JSX を sheetContainer 直下からペイン内（上記 A/B/C）へ**そのまま移動**。これらは元々 `left:0` で情報列領域に描画されるため、ペイン内に入れることで固定され、かつ軽減レイヤーより上に出る。`overlayRef` の参照はそのまま有効。

- [ ] **Step 5: ビルド＋テスト**

Run: `npm run build && npx vitest run src/components/__tests__`
Expected: build EXIT 0 / 既存テスト緑

- [ ] **Step 6: 手動確認（固定の成立＋バー非はみ出し）**

`npm run dev`・PC 幅・フルパーティ等で横スクロール領域を作り、右へスクロール：
- 情報列ブロックが据え置きで残る。
- スキル列・軽減アイコン・色付きバーだけが情報列の**下**を通り抜け、**情報列の上にはみ出さない**（複数行にまたぐ長いバーで上端/下端まで確認）。
- フェーズ縦ラベル（Phase 1 等）・ラベル区間・TL 選択ハイライトが情報列領域で従来どおり表示。

- [ ] **Step 7: Commit**

```bash
git add src/components/Timeline.tsx src/components/TimelineRow.tsx
git commit -m "feat(timeline): 情報列をsticky固定ペインへ分離(横スクロールでスキル列だけ動く)"
```

---

## Phase 3: 影とインタラクション仕上げ

### Task 5: スクロール時の境界影を情報ペインに付与

**Files:**
- Modify: `src/components/Timeline.tsx`（`handleScrollSync` の `shadowEls` に `infoPaneRef` を渡す）
- Test: `src/components/__tests__/timelineFrozenInfo.test.tsx`（影トグルは Task 2 で作成済み）

**Interfaces:**
- Consumes: `applyHorizontalScrollSync`（Task 2）、`infoPaneRef`（Task 4）。

- [ ] **Step 1: `handleScrollSync` に shadowEls を追加**

```ts
applyHorizontalScrollSync({
    scrollLeft,
    skillEls: [
        headerRef.current?.querySelector('#timeline-header-skill') as HTMLElement | null,
        controlBarRef.current?.querySelector('#timeline-controls-skill') as HTMLElement | null,
    ],
    shadowEls: [infoPaneRef.current],
});
```

- [ ] **Step 2: テスト（影トグル）を実行**

Run: `npx vitest run src/components/__tests__/timelineFrozenInfo.test.tsx`
Expected: PASS（Task 2 で書いた影トグルテスト）

- [ ] **Step 3: 手動確認**

横スクロール > 0 で情報ペイン右端に控えめな影が出る／左端へ戻すと消える。ライト／ダーク両方。

- [ ] **Step 4: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(timeline): 情報列固定ペインにスクロール時の境界影を付与"
```

### Task 6: hover とフェーズ列折りたたみの整合を確認・調整

**Files:**
- Modify: `src/components/Timeline.tsx` / `src/components/TimelineInfoColumns.tsx`（必要時のみ）

**Interfaces:**
- Consumes: 既存の hover（`group hover:bg-app-surface2`）、`phaseColumnCollapsed` / `labelColumnVisible` 切替。

- [ ] **Step 1: 情報行に独立した hover 背景を付与**

情報行とスキル行が別レイヤーになったため、行 hover の `group hover:bg-app-surface2` は各レイヤーで独立する。情報行ラッパ（Task 4 Step 2）に `hover:bg-app-surface2` を維持し、情報列内の hover line（`--hover-line-*`）が従来どおり出ることを確認。スキル行側の hover はスキル行で維持。

> 仕様判断：スキル列を hover したとき情報行も同時に光る「行全体 hover 同期」は**やらない**（マウス追従/高頻度 state 禁止の方針・perf 優先）。各レイヤー独立 hover で可とし、QA でユーザーに体感確認。

- [ ] **Step 2: フェーズ列折りたたみ（Shift+P）／ラベル折りたたみでペイン幅が追従するか確認**

`phaseColumnCollapsed` / `labelColumnVisible` で `--col-member-start`（＝ペイン幅）が変わるため、折りたたみでペイン幅・影位置・ヘッダー見出し位置が揃うことを手動確認。ズレる場合のみ、ペイン幅参照（`--col-member-start`）が再計算される構造か確認して修正。

- [ ] **Step 3: ビルド＋テスト**

Run: `npm run build && npx vitest run src/components/__tests__`
Expected: build EXIT 0 / テスト緑

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(timeline): 情報列固定の hover/フェーズ折りたたみ整合を調整"
```

---

## Phase 4: 総合 QA

### Task 7: Playwright ＋ 手動 QA チェックリスト消化

**Files:**
- 一時スクリプト: `/tmp/timeline-frozen-info.spec.ts`（Playwright・コミット不要）

**Interfaces:**
- Consumes: 完成した固定機能。

- [ ] **Step 1: Playwright で横スクロール後のスクショ取得**

playwright-skill を用い、PC 幅（一般多数派 `1920×1080 / deviceScaleFactor:2` と 開発者画面 `1489×679 / deviceScaleFactor:2.58` の両方）で /miti を開き、フルパーティ＋軽減配置のあるプランで本文を右へスクロール → スクショ。`tutorial-storage` 等のオーバーレイ抑制は [reference_playwright_miti_overlays] の手順に従う。

- [ ] **Step 2: 設計書 QA チェックリスト 1〜9 を消化**

[spec の §7](../specs/2026-06-18-timeline-frozen-info-columns-design.md) の 9 項目を確認。特に #3（バー非はみ出し・最重要）、#4（表展開併用）、#8（モバイル無影響）、#9（アイコンドラッグ/セルクリック退行なし）。

- [ ] **Step 3: フルビルド＋全テスト**

Run: `npm run build`（EXIT 0）→ `npx vitest run`（既知 failure 以外緑・[TODO.md] の既存 failure 一覧と照合）
Expected: build 緑 / 新規 failure なし

- [ ] **Step 4: ユーザー実機確認の依頼（デプロイ後）**

本番反映後、ユーザーに横スクロールで情報列固定を体感確認してもらう（1 件ずつ実機検証の方針）。ライト/ダーク・両 viewport。

- [ ] **Step 5: 完了処理**

`docs/TODO.md` の該当タスクを更新（完了なら `TODO_COMPLETED.md` へ移動）。

---

## Self-Review

**1. Spec coverage（spec 各節 → タスク対応）**
- §2 やること：情報列固定=Task 4 / スキル列だけスクロール=Task 4 / 常時固定=設計上トグル無し（全タスク前提）/ 影=Task 5 / トークン経由=Task 1。
- §2 やらないこと：モバイル不変=Global Constraints＋各 Step の `!isMobileTimeline` 条件。
- §3 現状構造：Phase 1（ヘッダー translateX）＝3 レイヤーのうちヘッダー/コントロールバー、Phase 2＝本文。
- §4 中核課題（content-visibility × 別レイヤー stacking）：Task 4 の sticky ペイン＋z=60＋不透明背景で解決。
- §5 変更対象：Task 1〜6 の Files に網羅。
- §6 影：Task 5。
- §7 QA：Task 7。
- §8 テスト方針：Task 2/5 の DOM ユニット＋Task 7 の Playwright/手動。
- §9 リスク/工数：Phase 分割で吸収。

**2. Placeholder scan:** 「移設対象の現物は指定行を Read」と明記し、巨大 JSX の再ペーストは避けつつ移設元行を厳密指定。`TBD`/`後で`/`適切に` 等の曖昧語なし。新規スキャフォールド（CSS・純関数・ペイン要素・情報行ラッパ）は実コードを記載。

**3. Type consistency:** `applyHorizontalScrollSync`（Task 2/5）、`TimelineInfoColumns`/`TimelineInfoColumnsProps`（Task 3/4）、`infoPaneRef`（Task 4/5）、CSS クラス `.timeline-info-pane` / `.timeline-info-pane--scrolled`（Task 1/5）、id `#timeline-header-skill`/`#timeline-controls-skill`（Task 2/5）— 名称はタスク間で一致。

**懸念（実装時に判断）:** Task 4 の `sheetTotalHeight` は既存の総高さ算出値を流用する前提。該当変数名が異なる場合は実装時に既存の行ループ最終 `currentY` を使う（spec §4 の方針内）。
