# 進捗HUD イテレーション2 実装計画（記録トースト + 記録ドロワー + バグA/D）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 進捗HUDの記録UXを刷新する — 記録時のホログラム風トースト、中央から降りる記録ドロワー（開＝記録モード・光の道フェーズナビ・ドラッグスクラブ活動入力）、および記録ハイライト/グラフアニメ停止のバグ2件を修正する。

**Architecture:** 既存 `feat/progress-tracking-hud` ブランチの続き。データは `useMitigationStore.progress`（points/cleared/activeDays/activeHours）。記録モード開閉は `useProgressRecording`。表示は `ProgressTrackingHUD`（JourneyStrip + PulseTrail canvas）。純粋ロジックは `src/lib/progressLogic.ts` に集約しTDD、UI演出は実機目視。canvas 描画は試作 4c0b94b の 1:1 移植を保持し、変更は data-binding 層と新規オーバーレイのみ。

**Tech Stack:** React + TypeScript + Zustand + Tailwind v4 + framer-motion + i18next + Web Animations API（演出）+ vitest（pool=vmThreads）。

## Global Constraints

- **canvas（PulseTrail）/ お祝い（ProgressCelebration）の描画ロジックは不変** — 1:1移植保持。変更してよいのは JourneyStrip の配列生成（data-binding）と新規オーバーレイのみ。[[feedback_keep_liked_prototype_visuals]]
- **`progress` は空が正常** — 空上書きガード（isEmptyPlanData/RESEED_FIELDS）に絶対に含めない。
- **progress 系 store アクションはローカル `set()` のみ**＋`_collabReadonly && !_collabActive` で純粋閲覧者ブロック（既存パターン踏襲）。collab 同期は Plan2（本計画対象外）。
- **対象 = PC**。モバイルは**非破壊のみ**（既存 MobileBottomSheet 経路を回帰させない）。モバイル作り込みは別タスク（TODO「スマホ最適化」）。
- **UIテキストは i18n キー経由**（ja/en/ko/zh 4言語・過不足ゼロ）。
- push 前に `npm run build`（tsc 厳密）+ `vitest run`（既知 housing 5件のみ赤が許容ベースライン）。
- 色は白黒＋機能色（青=進む/OK）。HUD演出の水色グローは進捗HUD固有の世界観として許容（既存 canvas と同系）。
- commit は各タスク末尾。コミットメッセージは日本語。`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を付す。

---

## ファイル構成

**新規作成:**
- `src/components/progress/ProgressRecordToast.tsx` — 記録トースト演出（B）
- `src/components/progress/PhaseRoad.tsx` — 光の道フェーズナビ（C）
- `src/components/progress/ActivityScrub.tsx` — 活動日数/時間ドラッグスクラブ（C）
- `src/lib/__tests__/progressToast.test.ts` — classifyRecord テスト
- `src/lib/__tests__/phaseRoad.test.ts` — 道の座標/時間マッピングテスト
- `src/lib/__tests__/normalizeProgress.test.ts` — migration 安全網（既存ロジックのテスト）
- `src/components/progress/__tests__/useProgressRecording.test.ts` — toast/undo 状態テスト

**変更:**
- `src/lib/progressLogic.ts` — `classifyRecord` / `phaseRoadPositions` / `roadTimeFromClick` / `clampActivity` 追加
- `src/components/progress/useProgressRecording.ts` — `toast` / `lastRecordedTs` 状態 + commit ロジック
- `src/components/progress/ProgressTrackingHUD.tsx` — D修正(useMemo) + トースト配線
- `src/components/progress/ProgressRecordPanel.tsx` — PCをドロワー化 + PanelBody再構成（記録開始ボタン/記録一覧撤去・道/スクラブ/踏破/undo）・モバイル分岐
- `src/components/Timeline.tsx` — progress:jump-to-time リスナに最寄りスナップ追加
- `src/index.css` — 記録モード時のフェーズ/ラベルオーバーレイ透過（A）
- `src/locales/{ja,en,ko,zh}.json`（フラット単一ファイル・`progress` namespace オブジェクト内）— トースト2キー + 踏破ラベル
- フェーズ/ラベルオーバーレイ（Timeline.tsx:3036/3087）に識別 `data-*` 属性付与（A）

---

## Phase 0 — 安全網 & バグ修正（低リスク先行）

### Task 1: D修正 — JourneyStrip の cornerX/cornerY/yTop を useMemo 安定化

**Files:**
- Modify: `src/components/progress/ProgressTrackingHUD.tsx`（JourneyStrip 内 154-222 付近）
- Test: `src/components/progress/__tests__/journeyStripMemo.test.tsx`（新規・任意。識別が難しければ Step1-2 を「実装＋手動」に簡略化可）

**Interfaces:**
- Consumes: なし
- Produces: 見た目不変。`PulseTrail` の effect が親再レンダーで再起動しなくなる。

- [ ] **Step 1: 現状を確認**

`ProgressTrackingHUD.tsx` の `JourneyStrip` 内で `yTop`/`cornerX`/`cornerY` が毎レンダー新規配列生成されている（186行付近）。`PulseTrail` の `useEffect` 依存 `[cornerX, cornerY, count, fullLine]`（146行）がこれで毎回変化する。

- [ ] **Step 2: useMemo 化**

`JourneyStrip` 関数本体の配列生成を `useMemo` で包む。`react` から `useMemo` を import に追加（既存 import 行 `import { useEffect, useRef, useState } from 'react';` に `useMemo` を足す）。

```tsx
// JourneyStrip 内、const n = points.length; の直後を以下に置換
const { cornerX, cornerY } = useMemo(() => {
  const TOP_Y = 16, BOT_Y = 84;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo;
  const yTop = points.map((p) => {
    if (span <= 0) return (TOP_Y + BOT_Y) / 2;
    const f = (p - lo) / span;
    return BOT_Y - f * (BOT_Y - TOP_Y);
  });
  const cx: number[] = [0];
  const cy: number[] = [BOT_Y];
  points.forEach((_, i) => {
    cx.push((i / n) * 100, ((i + 1) / n) * 100);
    cy.push(yTop[i], yTop[i]);
  });
  return { cornerX: cx, cornerY: cy };
}, [points, n]);
```

`points` 配列自体も親（ProgressTrackingHUD）で毎レンダー生成されている（250行 `const points = (progress.points ?? []).map(...)`）。これも安定化が必要 → 次ステップ。

- [ ] **Step 3: 親の points / celebrationIcons も useMemo 化**

`ProgressTrackingHUD` 本体（229-): `points`, `pct`, `celebrationIcons`, `total` を `useMemo` 化。deps = `progress.points`, `timelineEvents`, `progress`, `partyMembers`, `mitigations`。

```tsx
const total = useMemo(
  () => timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0,
  [timelineEvents]
);
const points = useMemo(
  () => (progress.points ?? []).map((p) => total > 0 ? Math.max(0, Math.min(100, (p.reachedPos / total) * 100)) : 0),
  [progress.points, total]
);
const pct = useMemo(() => computeProgressPercent(progress, total), [progress, total]);
```

（celebrationIcons は発火時のみ使うので必須ではないが、毎レンダー Set 生成を避けるなら useMemo 化してよい。）

- [ ] **Step 4: ビルド & 手動確認**

Run: `npm run build`
Expected: EXIT 0。

手動: dev で /miti を開き、記録を1点入れてグラフ帯に玉を出す → ヘッダー開閉ハンドルにマウスホバー → **玉が止まらず連続して走り続ける**ことを確認（修正前は頭から再起動）。

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/progress/ProgressTrackingHUD.tsx
rtk git commit -m "fix(progress): D ホバーでグラフアニメ停止を根治（cornerX/Y/points を useMemo 安定化・canvas不変）"
```

---

### Task 2: normalizeProgress 単体テスト追加（migration 安全網）

**Files:**
- Test: `src/lib/__tests__/normalizeProgress.test.ts`（新規）

**Interfaces:**
- Consumes: `normalizeProgress(p: unknown): PlanProgress`（既存・progressLogic.ts:39）
- Produces: なし（テストのみ）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeProgress } from '../progressLogic';

describe('normalizeProgress', () => {
  it('undefined/null → 空 progress', () => {
    expect(normalizeProgress(undefined)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
    expect(normalizeProgress(null)).toEqual({ points: [], cleared: false, activeDays: undefined, activeHours: undefined });
  });
  it('新形式(points) はそのまま保持', () => {
    const p = { points: [{ ts: 5, reachedPos: 120 }], cleared: true, activeDays: 3, activeHours: 6 };
    expect(normalizeProgress(p)).toEqual(p);
  });
  it('旧形式(dailyBest) → points へ順序維持で救済', () => {
    const r = normalizeProgress({ dailyBest: [{ reachedPos: 30 }, { reachedPos: 90 }] });
    expect(r.points).toEqual([{ ts: 1, reachedPos: 30 }, { ts: 2, reachedPos: 90 }]);
    expect(r.cleared).toBe(false);
  });
  it('points も dailyBest も無い → 空 points', () => {
    expect(normalizeProgress({ cleared: false }).points).toEqual([]);
  });
  it('不正な reachedPos は 0 にフォールバック', () => {
    expect(normalizeProgress({ dailyBest: [{ reachedPos: 'x' as unknown as number }] }).points).toEqual([{ ts: 1, reachedPos: 0 }]);
  });
});
```

- [ ] **Step 2: テスト実行（全緑のはず＝既存ロジックの仕様固定）**

Run: `npx vitest run src/lib/__tests__/normalizeProgress.test.ts`
Expected: PASS（5件）。落ちたら normalizeProgress の挙動と齟齬 → テストを実挙動に合わせて修正（実装は変えない・これは安全網）。

- [ ] **Step 3: Commit**

```bash
rtk git add src/lib/__tests__/normalizeProgress.test.ts
rtk git commit -m "test(progress): normalizeProgress の migration 単体テストを追加（旧dailyBest救済の安全網）"
```

---

### Task 3: A修正 — 記録モード中のフェーズ/ラベルオーバーレイ透過

**Files:**
- Modify: `src/components/Timeline.tsx:3036`（フェーズ区間オーバーレイ）, `:3087`（ラベル区間オーバーレイ）— `data-*` 属性付与
- Modify: `src/index.css`（記録モードセクション 1337 付近）

**Interfaces:**
- Consumes: 既存 `.timeline-scroll-container[data-record-mode="1"]`
- Produces: 記録モード中だけフェーズ/ラベル列にも行ハイライトが透ける

- [ ] **Step 1: オーバーレイに識別属性を付与**

`Timeline.tsx:3036` のフェーズ区間 div の className 行に `data-phase-overlay` を追加:

```tsx
<div
  key={phase.id}
  data-phase-overlay
  className="absolute left-0 w-[24px] md:w-[var(--col-phase-w)] border-r border-b border-app-border bg-app-surface2 pointer-events-none z-10"
  style={{ top: `${top}px`, height: `${height}px` }}
>
```

`Timeline.tsx:3084` のラベル区間 div に `data-label-overlay` を追加（clsx の前・属性として）:

```tsx
<div
  key={`label-${label.id}`}
  data-label-overlay
  className={clsx(
    "absolute border-r border-b border-app-border/50 bg-app-surface2 pointer-events-none z-10",
    /* 既存の条件式そのまま */
  )}
  style={{ top: `${top}px`, height: `${height}px` }}
>
```

- [ ] **Step 2: 記録モード時のみ背景を透過する CSS を追加**

`src/index.css` の記録モードブロック（1355 の `}` の直後）に追記:

```css
/* 進捗記録モード中はフェーズ/ラベル区間オーバーレイの不透明背景を透かし、
   行ハイライト(青枠+bg)がフェーズ列/ラベル列でも途切れないようにする。
   記録モード限定セレクタなので通常表示・select-mode の見た目は不変。 */
.timeline-scroll-container[data-record-mode="1"] [data-phase-overlay],
.timeline-scroll-container[data-record-mode="1"] [data-label-overlay] {
    background-color: transparent;
}
```

- [ ] **Step 3: ビルド & 手動確認**

Run: `npm run build`
Expected: EXIT 0。

手動: dev /miti でフェーズを2つ以上作る → 記録ドロワー（or 現行パネル）で記録モード ON → タイムラインの行（フェーズ列を含む左端）にホバー → **青い枠がフェーズ列/ラベル列でも途切れず行全体を囲む**ことを確認。フェーズ名テキストが読めなくなっていないかも確認（読めなければ CSS を `rgba(...,0.3)` 程度の半透過へ調整）。記録モード OFF 時はフェーズ列の背景が従来どおり不透明であることも確認（回帰チェック）。

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/Timeline.tsx src/index.css
rtk git commit -m "fix(progress): A 記録ハイライトがフェーズ/ラベル列で切れる問題を根治（記録モード時のみオーバーレイ背景を透過）"
```

---

## Phase 1 — B 記録トースト

### Task 4: classifyRecord 純粋関数 + テスト

**Files:**
- Modify: `src/lib/progressLogic.ts`
- Test: `src/lib/__tests__/progressToast.test.ts`（新規）

**Interfaces:**
- Consumes: `PlanProgress`, `computeProgressPercent`
- Produces: `classifyRecord(progress: PlanProgress, reachedPos: number): 'update' | 'nice'`（**記録前**の progress を渡す）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from 'vitest';
import { classifyRecord } from '../progressLogic';
import type { PlanProgress } from '../../types';

const P = (reached: number[]): PlanProgress => ({ points: reached.map((r, i) => ({ ts: i + 1, reachedPos: r })), cleared: false });

describe('classifyRecord', () => {
  it('記録ゼロからの初回は update', () => {
    expect(classifyRecord({ points: [], cleared: false }, 50)).toBe('update');
  });
  it('過去最高より奥 → update', () => {
    expect(classifyRecord(P([30, 80]), 120)).toBe('update');
  });
  it('過去最高と同じ → nice（更新ならず）', () => {
    expect(classifyRecord(P([30, 80]), 80)).toBe('nice');
  });
  it('過去最高より手前 → nice', () => {
    expect(classifyRecord(P([30, 80]), 50)).toBe('nice');
  });
  it('reachedPos=0 で points 空 → nice（0は更新でない）', () => {
    expect(classifyRecord({ points: [], cleared: false }, 0)).toBe('nice');
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `npx vitest run src/lib/__tests__/progressToast.test.ts`
Expected: FAIL（classifyRecord is not a function）。

- [ ] **Step 3: 実装**

`src/lib/progressLogic.ts` 末尾に追加:

```ts
/**
 * 記録する reachedPos が「チームのこれまでの最高到達点」を更新するか判定する。
 * 記録前の progress を渡すこと。最高を超えたら 'update'、そうでなければ 'nice'。
 * （0 は更新扱いにしない＝points 空 + reachedPos 0 は 'nice'）
 */
export function classifyRecord(progress: PlanProgress, reachedPos: number): 'update' | 'nice' {
    const points = progress.points ?? [];
    const prevMax = points.length ? Math.max(...points.map(p => p.reachedPos)) : 0;
    return reachedPos > prevMax ? 'update' : 'nice';
}
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `npx vitest run src/lib/__tests__/progressToast.test.ts`
Expected: PASS（5件）。

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/progressLogic.ts src/lib/__tests__/progressToast.test.ts
rtk git commit -m "feat(progress): classifyRecord（更新/未更新判定）を純粋関数でTDD追加"
```

---

### Task 5: useProgressRecording に toast + lastRecordedTs を追加し commit で確定

**Files:**
- Modify: `src/components/progress/useProgressRecording.ts`
- Test: `src/components/progress/__tests__/useProgressRecording.test.ts`（新規）

**Interfaces:**
- Consumes: `classifyRecord`, `computeProgressPercent`, `useMitigationStore`（recordReachedPoint / progress / timelineEvents / removeProgressPoint）
- Produces: store に
  - `toast: { kind: 'update' | 'nice'; pct: number; ts: number } | null`
  - `lastRecordedTs: number | null`
  - `clearToast(): void`
  - `undoLastRecord(): void`
  - `commitReachedPos(sec)` が記録時に toast と lastRecordedTs をセット

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProgressRecording } from '../useProgressRecording';
import { useMitigationStore } from '../../../store/useMitigationStore';

function setupTimeline() {
  // total=200 になるよう timelineEvents をセット
  useMitigationStore.setState({
    timelineEvents: [{ id: 'e', time: 200, name: '', damage: 0, type: 'physical', target: 'MT' } as any],
    progress: { points: [], cleared: false },
    _collabReadonly: false, _collabActive: false,
  } as any);
}

describe('useProgressRecording commit/undo/toast', () => {
  beforeEach(() => {
    setupTimeline();
    useProgressRecording.setState({ panelOpen: true, recordMode: true, toast: null, lastRecordedTs: null });
  });

  it('初回記録で update トースト + pct + lastRecordedTs を立てる', () => {
    useProgressRecording.getState().commitReachedPos(100); // 100/200 = 50%
    const t = useProgressRecording.getState().toast;
    expect(t?.kind).toBe('update');
    expect(t?.pct).toBe(50);
    expect(useProgressRecording.getState().lastRecordedTs).not.toBeNull();
    // 記録されている
    expect(useMitigationStore.getState().progress.points.length).toBe(1);
  });

  it('過去最高より手前は nice・pct は最高基準で減らない', () => {
    useProgressRecording.getState().commitReachedPos(160); // 80% update
    useProgressRecording.getState().commitReachedPos(40);  // 手前 → nice, pct=80
    const t = useProgressRecording.getState().toast;
    expect(t?.kind).toBe('nice');
    expect(t?.pct).toBe(80);
  });

  it('undoLastRecord は直前の点だけ消す', () => {
    useProgressRecording.getState().commitReachedPos(100);
    expect(useMitigationStore.getState().progress.points.length).toBe(1);
    useProgressRecording.getState().undoLastRecord();
    expect(useMitigationStore.getState().progress.points.length).toBe(0);
    expect(useProgressRecording.getState().lastRecordedTs).toBeNull();
  });

  it('clearToast で toast=null', () => {
    useProgressRecording.getState().commitReachedPos(100);
    useProgressRecording.getState().clearToast();
    expect(useProgressRecording.getState().toast).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `npx vitest run src/components/progress/__tests__/useProgressRecording.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

`src/components/progress/useProgressRecording.ts` を以下に置き換え:

```ts
// 記録モード store — 到達点記録パネルの開閉 + 記録モード ON/OFF + 記録トースト/直前undo を管理する
import { create } from 'zustand';
import { useMitigationStore } from '../../store/useMitigationStore';
import { classifyRecord, computeProgressPercent } from '../../lib/progressLogic';

export interface ProgressToast {
    kind: 'update' | 'nice';
    pct: number;
    ts: number; // 再生トリガ（同じ kind/pct でも ts 変化で再再生）
}

interface ProgressRecordingState {
    panelOpen: boolean;
    recordMode: boolean;
    toast: ProgressToast | null;
    lastRecordedTs: number | null;
    openPanel: () => void;
    closePanel: () => void;
    startRecordMode: () => void;
    stopRecordMode: () => void;
    /** タイムライン上の時間をクリックしたとき呼ぶ。1点記録 → トースト確定 → パネルを閉じる */
    commitReachedPos: (sec: number) => void;
    /** このセッションで最後に記録した1点だけ取り消す */
    undoLastRecord: () => void;
    clearToast: () => void;
}

function timelineTotal(): number {
    const ev = useMitigationStore.getState().timelineEvents;
    return ev.length ? Math.max(...ev.map((e) => e.time)) : 0;
}

export const useProgressRecording = create<ProgressRecordingState>((set) => ({
    panelOpen: false,
    recordMode: false,
    toast: null,
    lastRecordedTs: null,
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false, recordMode: false }),
    startRecordMode: () => set({ recordMode: true }),
    stopRecordMode: () => set({ recordMode: false }),
    commitReachedPos: (sec) => {
        const mit = useMitigationStore.getState();
        // viewer ブロックは store 側でも効くが、ここでは記録前 progress を読んで種別判定する
        const before = mit.progress;
        const kind = classifyRecord(before, sec);
        mit.recordReachedPoint(sec); // {ts: Date.now(), reachedPos: sec} を append
        const after = useMitigationStore.getState().progress;
        const pct = computeProgressPercent(after, timelineTotal());
        // 追加された点の ts を拾う（recordReachedPoint が実際に追加したか = 末尾の reachedPos 一致で確認）
        const pts = after.points;
        const lastTs = pts.length && pts[pts.length - 1].reachedPos === sec ? pts[pts.length - 1].ts : null;
        set({
            panelOpen: false,
            recordMode: false,
            toast: { kind, pct, ts: Date.now() },
            lastRecordedTs: lastTs,
        });
    },
    undoLastRecord: () => {
        const ts = useProgressRecording.getState().lastRecordedTs;
        if (ts == null) return;
        const mit = useMitigationStore.getState();
        const idx = mit.progress.points.findIndex((p) => p.ts === ts);
        if (idx >= 0) mit.removeProgressPoint(idx);
        set({ lastRecordedTs: null, toast: null });
    },
    clearToast: () => set({ toast: null }),
}));
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `npx vitest run src/components/progress/__tests__/useProgressRecording.test.ts`
Expected: PASS（4件）。

（注: vitest は pool=vmThreads。Firebase mock のため。既存 vitest.config を変更しない。）

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/progress/useProgressRecording.ts src/components/progress/__tests__/useProgressRecording.test.ts
rtk git commit -m "feat(progress): 記録commitでトースト種別/pct/直前undo用tsを確定（toast/lastRecordedTs状態をTDD追加）"
```

---

### Task 6: トースト文言 i18n（2キー × 4言語）

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`（各ファイル内の `"progress": { ... }` オブジェクトに追記。既存 `record_cta` 等と同じブロック）

**Interfaces:**
- Produces: i18n キー `progress.record_toast_update` / `progress.record_toast_nice`
- **規約**: 値の中に文字 `{n}` を1つ含める（数字カウントの差し込み位置・Task7 がここで split する）。

- [ ] **Step 1: 既存 progress ブロックの場所を確認**

locales はフラット単一ファイル（`src/locales/{ja,en,ko,zh}.json`）。各ファイルの `"progress": {` ブロック内（既存 `record_cta` の近く・ja.json では 2531 行付近）に追記する。

- [ ] **Step 2: 4言語に2キー追加**

ja:
```json
"record_toast_update": "最高到達点を更新！ 現在 {n}%",
"record_toast_nice": "ナイス！ この調子 現在 {n}%",
```
en:
```json
"record_toast_update": "New furthest point! Now at {n}%",
"record_toast_nice": "Nice! Keep it up — now at {n}%",
```
ko:
```json
"record_toast_update": "최고 도달 지점 갱신! 현재 {n}%",
"record_toast_nice": "좋아요! 이대로 — 현재 {n}%",
```
zh:
```json
"record_toast_update": "刷新最远到达点！当前 {n}%",
"record_toast_nice": "不错！继续保持 — 当前 {n}%",
```

各言語とも値に `{n}` を**ちょうど1つ**含めること（数字の差し込み位置）。`%` は `{n}` の直後に置く。

- [ ] **Step 3: JSON 妥当性 & ビルド確認**

Run: `npm run build`
Expected: EXIT 0（JSON 構文エラーなし）。

- [ ] **Step 4: Commit**

```bash
rtk git add src/locales
rtk git commit -m "i18n(progress): 記録トースト文言(update/nice)を4言語追加（{n}は数字カウント差し込み位置）"
```

---

### Task 7: ProgressRecordToast コンポーネント + HUD 配線

**Files:**
- Create: `src/components/progress/ProgressRecordToast.tsx`
- Modify: `src/components/progress/ProgressTrackingHUD.tsx`（JourneyStrip のグラフ帯にトーストを重ねる + toast 購読）

**Interfaces:**
- Consumes: `useProgressRecording`（toast / clearToast）, `useTranslation`
- Produces: `<ProgressRecordToast />`（props なし・store 駆動）

- [ ] **Step 1: コンポーネント実装（演出は mock toast-combo-v4.html seq を React へ移植）**

`src/components/progress/ProgressRecordToast.tsx` を新規作成:

```tsx
/**
 * 記録トースト — 記録した瞬間にグラフ帯中央へホログラム演出で表示。
 * 演出（確定）: 走査線でホログラム起動 → 文字デコード解読 → 数字0からカウントアップ。
 * 約1.3秒立ち上がり → 4秒表示 → 明滅フェードアウト。光の玉(canvas)は後ろを通る(z下)。
 * モック: .superpowers/brainstorm/4302-1781796445/content/toast-combo-v4.html (seq)
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgressRecording } from './useProgressRecording';

const GLYPHS = 'アカサタナハマヤラワン0123456789#%&@$<>/\\=+*';
const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const HOLD = 4000;

export function ProgressRecordToast() {
  const { t } = useTranslation();
  const toast = useProgressRecording((s) => s.toast);
  const clearToast = useProgressRecording((s) => s.clearToast);
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const my = ++tokenRef.current;
    const root = rootRef.current, textEl = textRef.current, scan = scanRef.current;
    if (!root || !textEl || !scan) return;

    // 文言を prefix + {n} + suffix に分割（{n} は数字カウント位置）
    const template = t(`progress.record_toast_${toast.kind}`);
    const [prefix, suffix = ''] = template.split('{n}');

    // span 構築: prefix を 1 文字ずつ + 数字 span + suffix
    textEl.innerHTML = '';
    const preSpans: HTMLSpanElement[] = [];
    [...prefix].forEach((ch) => {
      const s = document.createElement('span');
      s.style.display = 'inline-block';
      if (ch === ' ') s.style.width = '.4ch';
      s.dataset.f = ch; s.textContent = ch;
      textEl.appendChild(s); preSpans.push(s);
    });
    const numSpan = document.createElement('span');
    numSpan.className = 'font-black'; numSpan.style.color = '#bfe9ff';
    numSpan.textContent = '0'; textEl.appendChild(numSpan);
    const sufSpan = document.createElement('span');
    sufSpan.style.color = '#bfe9ff'; sufSpan.textContent = suffix; textEl.appendChild(sufSpan);

    // タイミング(seq)
    const holoDur = 780, decStart = 320, decDur = 700, numStart = 880, numDur = 560;
    const END = Math.max(decStart + decDur, numStart + numDur, holoDur) + 60;
    const target = toast.pct;

    // ホログラム明滅 + 走査線
    root.style.opacity = '1';
    root.animate(
      [{ opacity: 0 }, { opacity: .6, offset: .1 }, { opacity: .2, offset: .15 }, { opacity: .9, offset: .24 }, { opacity: .5, offset: .32 }, { opacity: 1 }],
      { duration: holoDur, easing: 'linear', fill: 'forwards' }
    );
    scan.style.opacity = '1';
    scan.animate(
      [{ top: '-2px', opacity: 0 }, { top: '0px', opacity: 1, offset: .12 }, { top: '44px', opacity: 1, offset: .88 }, { top: '46px', opacity: 0 }],
      { duration: holoDur, easing: 'ease-out', fill: 'forwards' }
    );

    const s0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (my !== tokenRef.current) return;
      const e = now - s0;
      const n = preSpans.length;
      preSpans.forEach((s, i) => {
        const f = s.dataset.f || '';
        const lockAt = decStart + (i / n) * decDur * 0.8 + 50;
        if (e < decStart) { s.style.opacity = '0'; }
        else if (e < lockAt) { s.style.opacity = '0.65'; if (f !== ' ') s.textContent = rnd(); }
        else { s.textContent = f; s.style.opacity = '1'; }
      });
      if (e < numStart) { numSpan.textContent = '0'; }
      else {
        const p = Math.min(1, (e - numStart) / numDur);
        const ez = 1 - Math.pow(1 - p, 3);
        numSpan.textContent = String(Math.round(target * ez));
        numSpan.style.textShadow = p < 1 ? '0 0 14px rgba(160,230,255,.95)' : '0 0 8px rgba(150,230,255,.6)';
      }
      if (e < END) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // 4秒後に明滅フェードアウト → store クリア
    const outTimer = setTimeout(() => {
      if (my !== tokenRef.current) return;
      const a = root.animate(
        [{ opacity: 1 }, { opacity: .3, offset: .3 }, { opacity: .65, offset: .5 }, { opacity: 0 }],
        { duration: 440, fill: 'forwards' }
      );
      a.onfinish = () => { if (my === tokenRef.current) clearToast(); };
    }, HOLD);

    return () => { cancelAnimationFrame(raf); clearTimeout(outTimer); };
  }, [toast, t, clearToast]);

  if (!toast) return null;
  return (
    <div
      ref={rootRef}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none whitespace-nowrap font-extrabold text-app-base"
      style={{
        opacity: 0, color: '#dff4ff', letterSpacing: '.03em',
        textShadow: '0 0 10px rgba(150,230,255,.6), 0 1px 2px rgba(0,0,0,.9)',
        padding: '6px 16px', borderRadius: '999px',
        background: 'radial-gradient(ellipse at center, rgba(8,14,28,0.74) 0%, rgba(8,14,28,0.35) 60%, rgba(8,14,28,0) 100%)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span ref={textRef} />
      <span ref={scanRef} className="absolute left-0 right-0 pointer-events-none"
        style={{ height: '2px', top: 0, opacity: 0, background: 'linear-gradient(90deg, transparent, rgba(150,230,255,.95), transparent)', boxShadow: '0 0 10px rgba(150,230,255,.9)' }} />
    </div>
  );
}
```

注: `rnd()` は引数なし版。mock の `rnd(GLYPHS)` を本実装では `rnd()` に統一済（GLYPHS はモジュール定数）。

- [ ] **Step 2: HUD のグラフ帯にトーストを重ねる**

`ProgressTrackingHUD.tsx` の `JourneyStrip` 中央グラフ帯（215行 `<div className="relative flex-1 h-11 overflow-visible">`）の中、`<PulseTrail .../>` の直後に `<ProgressRecordToast />` を追加。import も追加:

```tsx
import { ProgressRecordToast } from './ProgressRecordToast';
// ...
<div className="relative flex-1 h-11 overflow-visible">
  <PulseTrail cornerX={cornerX} cornerY={cornerY} count={cleared ? 3 : 1} fullLine={cleared} />
  <ProgressRecordToast />
</div>
```

注: 空状態（isEmpty）のときグラフ帯は描画されないが、記録すると即 isEmpty=false になり JourneyStrip が出るため、記録直後のトーストは JourneyStrip 内に表示される。整合OK。

- [ ] **Step 3: ビルド & 手動確認**

Run: `npm run build`
Expected: EXIT 0。

手動: dev /miti でタイムラインに攻撃を置き全長を作る → 記録モードで行クリック → **グラフ帯中央にホログラム→デコード→数字カウントのトーストが出て4秒で消える**。更新時/未更新時で文言が変わる（一度奥を記録→次に手前を記録で「ナイス！」）。4言語切替で文言が変わる。

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/progress/ProgressRecordToast.tsx src/components/progress/ProgressTrackingHUD.tsx
rtk git commit -m "feat(progress): B 記録トースト(ホログラム起動→デコード→数字カウントアップ)を実装しHUDへ配線"
```

---

## Phase 2 — C 記録ドロワー（PC）

### Task 8: 光の道 純粋関数（座標 + クリック→時間）+ テスト

**Files:**
- Modify: `src/lib/progressLogic.ts`
- Test: `src/lib/__tests__/phaseRoad.test.ts`（新規）

**Interfaces:**
- Consumes: `Phase`（{ id, name, startTime, ... }）— 実型は `src/types` を確認
- Produces:
  - `phaseRoadPositions(phases: {id:string;name:LocalizedString;startTime:number}[], totalSec: number): {id:string;name:LocalizedString;leftPct:number;time:number}[]`
  - `roadTimeFromClick(fraction: number, totalSec: number): number`（0〜totalSec にクランプ・四捨五入）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from 'vitest';
import { phaseRoadPositions, roadTimeFromClick } from '../progressLogic';

describe('phaseRoadPositions', () => {
  it('開始時間に比例して leftPct を返す（4〜96 にクランプ）', () => {
    const phases = [
      { id: 'a', name: { ja: 'P1' } as any, startTime: 0 },
      { id: 'b', name: { ja: 'P2' } as any, startTime: 210 },
      { id: 'c', name: { ja: 'P3' } as any, startTime: 420 },
    ];
    const r = phaseRoadPositions(phases, 420);
    expect(r[0].leftPct).toBe(4);     // 0% → 下限4
    expect(r[1].leftPct).toBe(50);    // 210/420
    expect(r[2].leftPct).toBe(96);    // 100% → 上限96
    expect(r[1].time).toBe(210);
  });
  it('total<=0 は空配列', () => {
    expect(phaseRoadPositions([{ id: 'a', name: {} as any, startTime: 0 }], 0)).toEqual([]);
  });
});

describe('roadTimeFromClick', () => {
  it('fraction×total を四捨五入', () => {
    expect(roadTimeFromClick(0.5, 200)).toBe(100);
    expect(roadTimeFromClick(0.25, 201)).toBe(50);
  });
  it('0〜total にクランプ', () => {
    expect(roadTimeFromClick(-0.1, 200)).toBe(0);
    expect(roadTimeFromClick(1.5, 200)).toBe(200);
  });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `npx vitest run src/lib/__tests__/phaseRoad.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装**

`src/lib/progressLogic.ts` 末尾に追加（`LocalizedString` を types から import）。先頭の import 行を `import type { ProgressPoint, PlanProgress, LocalizedString } from '../types';` に拡張:

```ts
/** 光の道: 各フェーズを開始時間に比例した leftPct(4〜96) に配置。total<=0 は空。 */
export function phaseRoadPositions(
    phases: { id: string; name: LocalizedString; startTime: number }[],
    totalSec: number
): { id: string; name: LocalizedString; leftPct: number; time: number }[] {
    if (totalSec <= 0) return [];
    return phases.map((p) => ({
        id: p.id,
        name: p.name,
        time: p.startTime,
        leftPct: Math.min(96, Math.max(4, (p.startTime / totalSec) * 100)),
    }));
}

/** 道のクリック割合(0〜1) → タイムライン時間(秒・0〜total にクランプ・四捨五入)。 */
export function roadTimeFromClick(fraction: number, totalSec: number): number {
    return Math.max(0, Math.min(totalSec, Math.round(fraction * totalSec)));
}
```

- [ ] **Step 4: テスト実行で成功確認**

Run: `npx vitest run src/lib/__tests__/phaseRoad.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/progressLogic.ts src/lib/__tests__/phaseRoad.test.ts
rtk git commit -m "feat(progress): 光の道の座標(phaseRoadPositions)とクリック→時間(roadTimeFromClick)をTDD追加"
```

---

### Task 9: progress:jump-to-time リスナに最寄り時間スナップを追加

**Files:**
- Modify: `src/components/Timeline.tsx:1222-1229`（handleProgressJump）

**Interfaces:**
- Consumes: `timeToYMapRef`（既存・Map<time, Y>）, `handleNavJump`
- Produces: 任意時間でも最寄りの有効行へジャンプ

- [ ] **Step 1: リスナにスナップを追加**

`Timeline.tsx` の `handleProgressJump`（1223行付近）を以下に変更:

```tsx
const handleProgressJump = (e: Event) => {
    const { time } = (e as CustomEvent<{ time: number }>).detail ?? {};
    if (typeof time !== 'number') return;
    // 道クリックの任意時間 → timeToYMap に存在する最寄りの時間へスナップ（厳密さ不要）
    const map = timeToYMapRef.current;
    if (map.has(time)) { handleNavJump(time); return; }
    let nearest: number | null = null, best = Infinity;
    map.forEach((_y, tk) => { const d = Math.abs(tk - time); if (d < best) { best = d; nearest = tk; } });
    if (nearest !== null) handleNavJump(nearest);
};
```

- [ ] **Step 2: ビルド & 既存ジャンプ回帰確認**

Run: `npm run build`
Expected: EXIT 0。

手動: 既存のフェーズジャンプ（ヘッダーのフェーズドロップダウン）が従来どおり動く（完全一致時はスナップが自分自身を選ぶので不変）。

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(progress): progress:jump-to-time を任意時間対応に（最寄り行スナップ・光の道クリック用）"
```

---

### Task 10: 活動スクラブ clamp 純粋関数 + テスト

**Files:**
- Modify: `src/lib/progressLogic.ts`
- Test: `src/lib/__tests__/phaseRoad.test.ts`（既存ファイルに追記）

**Interfaces:**
- Produces: `clampActivity(n: number): number`（0未満→0・整数化）

- [ ] **Step 1: テスト追記（失敗確認）**

`phaseRoad.test.ts` に追記:
```ts
import { clampActivity } from '../progressLogic';
describe('clampActivity', () => {
  it('0未満は0・整数化', () => {
    expect(clampActivity(-3)).toBe(0);
    expect(clampActivity(2.7)).toBe(3);
    expect(clampActivity(0)).toBe(0);
  });
});
```
Run: `npx vitest run src/lib/__tests__/phaseRoad.test.ts` → FAIL。

- [ ] **Step 2: 実装**

```ts
/** 活動日数/時間の値を 0 以上の整数にクランプ。 */
export function clampActivity(n: number): number {
    return Math.max(0, Math.round(n));
}
```
Run: `npx vitest run src/lib/__tests__/phaseRoad.test.ts` → PASS。

- [ ] **Step 3: Commit**

```bash
rtk git add src/lib/progressLogic.ts src/lib/__tests__/phaseRoad.test.ts
rtk git commit -m "feat(progress): clampActivity(0以上整数)をTDD追加"
```

---

### Task 11: ActivityScrub コンポーネント（ドラッグスクラブ・低感度・脱箱）

**Files:**
- Create: `src/components/progress/ActivityScrub.tsx`

**Interfaces:**
- Consumes: `clampActivity`
- Produces: `<ActivityScrub label value unit onChange />`（汎用1単位スクラブ）
  - props: `{ label?: string; value: number | undefined; unit: string; onChange: (n: number) => void }`

- [ ] **Step 1: 実装**

`src/components/progress/ActivityScrub.tsx`:

```tsx
/**
 * 活動日数/時間のドラッグスクラブ入力。数字を左右ドラッグで増減（感度 16px=1・低感度）。
 * 箱なし・点線下線のみ（脱ピル）。タップ用に小さな −/＋ 併設。
 * ドラッグ中はローカル state で表示更新し、pointerup で onChange へコミット（毎フレームの親再レンダー回避）。
 */
import { useRef, useState } from 'react';
import { clampActivity } from '../../lib/progressLogic';

const PX_PER_UNIT = 16; // 16px ドラッグで 1 変化（低感度＝細かく合わせやすい）

export function ActivityScrub({ label, value, unit, onChange }: {
  label?: string; value: number | undefined; unit: string; onChange: (n: number) => void;
}) {
  const base = value ?? 0;
  const [draft, setDraft] = useState<number | null>(null);
  const startRef = useRef({ x: 0, v: 0 });
  const display = draft ?? base;

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, v: base };
    setDraft(base);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (draft === null) return;
    const d = Math.round((e.clientX - startRef.current.x) / PX_PER_UNIT);
    setDraft(clampActivity(startRef.current.v + d));
  };
  const onPointerUp = () => {
    if (draft !== null) { onChange(draft); setDraft(null); }
  };

  return (
    <div className="flex items-baseline gap-2">
      {label && <span className="text-app-2xs text-app-text-muted font-bold">{label}</span>}
      <span onClick={() => onChange(clampActivity(base - 1))}
        className="text-app-md text-app-text-sec cursor-pointer select-none px-1 hover:text-app-text active:scale-90">−</span>
      <span
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        className="font-black tabular-nums text-app-lg text-app-text cursor-ew-resize px-1 pb-0.5 select-none"
        style={{ textShadow: '0 0 10px rgba(120,200,255,.45)', borderBottom: '1px dashed rgba(120,200,255,.4)' }}
      >
        {display}<span className="text-app-2xs text-app-text-muted ml-0.5">{unit}</span>
      </span>
      <span onClick={() => onChange(clampActivity(base + 1))}
        className="text-app-md text-app-text-sec cursor-pointer select-none px-1 hover:text-app-text active:scale-90">＋</span>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: EXIT 0。（配線は Task 13 で。ここでは型・構文のみ確認。未使用 import 警告が出ないよう、配線まで一気にやる場合は Task 13 とまとめてコミットでも可。）

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/progress/ActivityScrub.tsx
rtk git commit -m "feat(progress): 活動日数/時間のドラッグスクラブ入力(低感度16px/1・脱箱)を追加"
```

---

### Task 12: PhaseRoad コンポーネント（光の道 UI・クリックでジャンプ）

**Files:**
- Create: `src/components/progress/PhaseRoad.tsx`

**Interfaces:**
- Consumes: `useMitigationStore`（phases / timelineEvents）, `useThemeStore`（contentLanguage）, `getPhaseName`, `phaseRoadPositions`, `roadTimeFromClick`
- Produces: `<PhaseRoad />`（props なし）。クリックで `progress:jump-to-time` を発火。

- [ ] **Step 1: 実装**

`src/components/progress/PhaseRoad.tsx`:

```tsx
/**
 * 光の道 — フェーズを開始時間に比例配置した発光ライン。
 * ライン上のどこをクリックしてもその比例時間へ大タイムラインがジャンプ（progress:jump-to-time）。
 * フェーズが無ければ非表示。旧 PhaseJumpButtons の置換。
 */
import { useRef } from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getPhaseName } from '../../types';
import { phaseRoadPositions, roadTimeFromClick } from '../../lib/progressLogic';

export function PhaseRoad() {
  const { contentLanguage } = useThemeStore();
  const phases = useMitigationStore((s) => s.phases);
  const timelineEvents = useMitigationStore((s) => s.timelineEvents);
  const lineRef = useRef<HTMLDivElement>(null);

  const total = timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0;
  const nodes = phaseRoadPositions(
    phases.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime })),
    total
  );
  if (nodes.length === 0) return null;

  const jump = (time: number) => {
    window.dispatchEvent(new CustomEvent('progress:jump-to-time', { detail: { time } }));
  };
  const onLineClick = (e: React.MouseEvent) => {
    const el = lineRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    jump(roadTimeFromClick(frac, total));
  };

  return (
    <div className="relative h-12 select-none" aria-label="phase road">
      {/* 発光ライン（クリックで比例時間ジャンプ） */}
      <div
        ref={lineRef}
        onClick={onLineClick}
        className="absolute left-0 right-0 cursor-pointer"
        style={{ top: '10px', height: '14px' }}
      >
        <div className="absolute left-0 right-0" style={{
          top: '0px', height: '1px',
          background: 'linear-gradient(90deg, rgba(120,200,255,0) 0%, rgba(120,200,255,.55) 8%, rgba(120,200,255,.55) 92%, rgba(120,200,255,0) 100%)',
          boxShadow: '0 0 6px rgba(120,200,255,.4)',
        }} />
      </div>
      {/* ノード + フェーズ名 */}
      {nodes.map((nd) => (
        <div key={nd.id}>
          <span
            onClick={(e) => { e.stopPropagation(); jump(nd.time); }}
            className="absolute cursor-pointer"
            style={{
              left: `${nd.leftPct}%`, top: '10px', transform: 'translate(-50%,-50%)',
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#cfeaff', boxShadow: '0 0 8px rgba(150,220,255,.9)',
            }}
          />
          <span
            onClick={(e) => { e.stopPropagation(); jump(nd.time); }}
            className="absolute text-app-2xs font-bold text-app-blue hover:text-app-text whitespace-nowrap cursor-pointer"
            style={{ left: `${nd.leftPct}%`, top: '20px', transform: 'translateX(-50%)' }}
          >
            {getPhaseName(nd.name, contentLanguage)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

注: 記録モード中、このコンポーネントはドロワー内（ヘッダー側）にあり、タイムライン行の onClickCapture とは別 DOM のため打点に横取りされない。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: EXIT 0。（配線は Task 13。）

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/progress/PhaseRoad.tsx
rtk git commit -m "feat(progress): 光の道フェーズナビ(比例配置・クリックで時間ジャンプ)を追加"
```

---

### Task 13: 踏破ラベル i18n + PCドロワー化 + PanelBody 再構成

**Files:**
- Modify: `src/locales/{ja,en,ko,zh}.json`（`progress.clear` を「踏破」へ + `progress.drawer_prompt_main`/`drawer_prompt_sub`/`undo_last` を4言語追加）
- Modify: `src/components/progress/ProgressRecordPanel.tsx`（PCPopover→Drawer・PanelBody 再構成・記録開始ボタン/記録一覧撤去・道/スクラブ/踏破/undo・開=記録モード・モバイル分岐維持）

**Interfaces:**
- Consumes: `PhaseRoad`, `ActivityScrub`, `useProgressRecording`（startRecordMode/closePanel/undoLastRecord/lastRecordedTs）, `useMitigationStore`（progress.activeDays/Hours/cleared, setActiveDays/Hours, setCleared）
- Produces: PC 記録ドロワー

- [ ] **Step 1: i18n を更新（踏破ラベル + ドロワー新キー）**

各 `src/locales/{ja,en,ko,zh}.json` の `"progress"` ブロックで:
- `progress.clear` の値を更新（ja「踏破」/ en「Cleared」/ ko「클리어」/ zh「通关」）。`progress.clear_section` 見出しも「踏破」へ（ja「踏破」）。`cleared`（既存 👑 表示用）はそのまま。
- 新規キー追加（4言語）:
  - `drawer_prompt_main` = ja「今日はどこまで進みましたか？」/ en「How far did you get today?」/ ko「오늘은 어디까지 갔나요?」/ zh「今天进行到哪里了？」
  - `drawer_prompt_sub` = ja「タイムラインをクリックして記録しましょう」/ en「Click the timeline to record」/ ko「타임라인을 클릭해 기록하세요」/ zh「点击时间轴进行记录」
  - `undo_last` = ja「直前の記録を取り消す」/ en「Undo last record」/ ko「방금 기록 취소」/ zh「撤销刚才的记录」

- [ ] **Step 2: ClearSection を脱箱・踏破ラベルに（同ファイル内）**

`ProgressRecordPanel.tsx` の `ClearSection` のボタン文言は `t('progress.clear', '踏破')` を参照（既存キー値が「踏破」になったのでフォールバックも更新）。見た目は最小化（既存の青枠ボタンは維持可・絵文字は使っていないので変更不要。`cleared` 表示の `👑` は既存仕様＝残す）。

- [ ] **Step 3: PanelBody を再構成**

`PanelBody`（244行）を以下に置換。記録開始トグル・record_hint・DailyBestList を撤去し、プロンプト/PhaseRoad/ActivityScrub/ClearSection/undo を配置:

```tsx
const PanelBody: React.FC = () => {
  const { t } = useTranslation();
  const activeDays = useMitigationStore(s => s.progress.activeDays);
  const activeHours = useMitigationStore(s => s.progress.activeHours);
  const setActiveDays = useMitigationStore(s => s.setActiveDays);
  const setActiveHours = useMitigationStore(s => s.setActiveHours);
  const lastRecordedTs = useProgressRecording(s => s.lastRecordedTs);
  const undoLastRecord = useProgressRecording(s => s.undoLastRecord);

  return (
    <div className="flex flex-col gap-4">
      {/* プロンプト */}
      <div className="text-center">
        <div className="text-app-lg font-bold text-app-text" style={{ textShadow: '0 0 12px rgba(120,200,255,.4)' }}>
          {t('progress.drawer_prompt_main')}
        </div>
        <div className="text-app-2xs text-app-text-muted mt-0.5">{t('progress.drawer_prompt_sub')}</div>
      </div>
      {/* 光の道（フェーズナビ） */}
      <PhaseRoad />
      {/* 下段: 活動スクラブ / 踏破 / 直前undo */}
      <div className="flex items-end justify-between gap-4 flex-wrap border-t border-glass-border pt-3">
        <div className="flex items-center gap-6">
          <ActivityScrub label={t('progress.active_days', '活動')} value={activeDays} unit={t('progress.active_days_unit', '日')} onChange={setActiveDays} />
          <ActivityScrub value={activeHours} unit={t('progress.active_hours_unit', 'h')} onChange={setActiveHours} />
        </div>
        <div className="flex items-center gap-4">
          <ClearSectionInline />
          {lastRecordedTs != null && (
            <button onClick={undoLastRecord} title={t('progress.undo_last', '直前の記録を取り消す')}
              className="text-app-md text-app-text-sec hover:text-red-400 cursor-pointer active:scale-90">↶</button>
          )}
        </div>
      </div>
    </div>
  );
};
```

`ClearSectionInline` は既存 `ClearSection` を踏破ラベル・最小スタイルに整えた版（同ファイル内に定義 or 既存 `ClearSection` を流用）。新規 import: `import { PhaseRoad } from './PhaseRoad';` `import { ActivityScrub } from './ActivityScrub';`。撤去: `PhaseJumpButtons` / `DailyBestList` / `Stepper` / `ActiveTimeSection`（未使用になる定義は削除）。`makeDayKey`/`formatReached` import も未使用なら削除。

- [ ] **Step 4: PC をドロワー化 + 開＝記録モード**

`PCPopover`（296行）を「中央グラフ下から降りる横長ドロワー」に作り替える。`createPortal` で body 直下に固定配置、ヘッダー下にフル幅寄りで配置。マウント時に `startRecordMode()` を呼ぶ。clip 展開 + ホログラム明滅 + 走査線の開演出（framer-motion or WAAPI）。

```tsx
const PCDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const startRecordMode = useProgressRecording(s => s.startRecordMode);

  // 開いた瞬間に記録モード ON（PC のみ）
  useEffect(() => { startRecordMode(); }, [startRecordMode]);

  // 外側クリック閉じ（記録モード中はタイムライン打点に使うため閉じない＝既存ロジック踏襲）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (useProgressRecording.getState().recordMode) return;
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 開演出: clip 上→下 + 明滅
  useEffect(() => {
    const el = drawerRef.current; if (!el) return;
    el.animate(
      [{ clipPath: 'inset(0 0 100% 0)', opacity: 0, transform: 'translateY(-6px)' },
       { clipPath: 'inset(0 0 0% 0)', opacity: 1, transform: 'translateY(0)' }],
      { duration: 460, easing: 'cubic-bezier(.16,.8,.3,1)', fill: 'forwards' }
    );
  }, []);

  return createPortal(
    <div ref={drawerRef}
      className="fixed z-[9999] glass-tier3 rounded-b-lg shadow-sm overflow-hidden"
      style={{ top: '92px', left: '50%', transform: 'translateX(-50%)', width: 'min(720px, 92vw)' }}
    >
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-glass-border">
        <button onClick={onClose} className="text-app-text p-1 rounded-lg hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 cursor-pointer active:scale-90">
          <X size={14} />
        </button>
      </div>
      <div className="px-5 py-4"><PanelBody /></div>
    </div>,
    document.body
  );
};
```

メインコンポーネント `ProgressRecordPanel`（362行）の PC 分岐を `PCDrawer` に差し替え（モバイルは `MobileBottomSheet` のまま）。**モバイルの PanelBody は記録モード自動 ON にしない**（PCDrawer の useEffect だけが startRecordMode を呼ぶ。モバイルは別途「スマホ最適化」で対応）。

※モバイルで PanelBody から記録開始手段が消える点について: 本イテレーションは PC 優先のため、モバイルは暫定で「ドロワーを開いた状態でタイムラインをタップ→記録」が record モード OFF だと打点されない。→ **モバイルは当面 `MobileBottomSheet` 表示時に `startRecordMode()` を呼ぶ最小対応**（PanelBody 内ではなく ProgressRecordPanel のモバイル分岐側 useEffect で）を入れ、打点自体は動く状態にする。レイアウト最適化のみ別タスク。

- [ ] **Step 5: ビルド & 手動総点検**

Run: `npm run build`
Expected: EXIT 0。

手動（PC）:
1. グラフ帯クリック → ドロワーが中央下へホログラム演出で降りる。
2. 開いた瞬間に記録モード ON（タイムライン行ホバーで青枠ハイライト＝Task3）。
3. 光の道クリック → 大タイムラインがその辺へスクロール。フェーズ名クリックでそのフェーズへ。
4. 活動日数/時間の数字を左右ドラッグで増減（低感度）。−/＋タップも効く。
5. 踏破クリックでお祝い演出（既存）。
6. タイムライン行クリック → 記録 → トースト（Task7）→ ドロワー閉じる。
7. 直前 undo（↶）で最後の記録が消える。
8. 記録一覧・記録開始ボタンが無いことを確認。
9. 4言語でプロンプト/踏破が翻訳される。

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/progress/ProgressRecordPanel.tsx src/locales
rtk git commit -m "feat(progress): C 記録ドロワー(PC・開=記録モード/光の道/活動スクラブ/踏破/直前undo・記録開始ボタンと記録一覧を撤去・脱ピル)"
```

---

## Phase 3 — 仕上げ

### Task 14: 全体ビルド/テスト & 回帰確認

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: EXIT 0。

- [ ] **Step 2: フルテスト**

Run: `npx vitest run`
Expected: 既知 housing 5件（TopBar 4 + HousingWorkspace 1）のみ赤。進捗HUD 新規テスト全緑。

`ConsolidatedHeader.viewer.test.tsx` が ProgressRecordToast 追加で落ちないか確認（既存 stub パターンに ProgressRecordToast/PhaseRoad/ActivityScrub が必要なら stub 追加）。

- [ ] **Step 3: collab viewer 回帰**

手動 or 既存テスト: 純粋閲覧者（readonly viewer）で記録系アクションがブロックされ、トースト/ドロワーが破壊的動作をしないことを確認（store ガード既存）。

- [ ] **Step 4: Commit（必要なら stub 修正）**

```bash
rtk git add -A
rtk git commit -m "test(progress): イテレーション2 回帰修正(ConsolidatedHeader.viewer stub 等)"
```

---

### Task 15: ledger 更新 & ブランチ最終レビュー準備

- [ ] **Step 1: `.git/sdd/progress.md` にイテレーション2完了を追記**（実装サマリ・残=ユーザー実機総点検）

- [ ] **Step 2: `docs/TODO.md` の進捗HUD行を更新**（イテレーション2 実装完了・残=実機総点検→main merge）

- [ ] **Step 3: Commit**

```bash
rtk git add .git/sdd/progress.md docs/TODO.md
rtk git commit -m "docs(progress): イテレーション2(トースト/ドロワー/バグA・D)実装完了を記録"
```

- [ ] **Step 4: 最終レビュー依頼**（requesting-code-review or opus 全ブランチレビュー）→ 修正 → **ユーザー実機総点検（A/B/C/D + 4言語 + 記録モードON/OFF回帰 + collab viewer）** → main merge = 本番デプロイ。

---

## Self-Review（計画 vs spec）

- **A**（ハイライト切れ）→ Task 3 ✅
- **B**（トースト: 種別/pct/文言/演出/配線）→ Task 4(判定)/5(commit確定)/6(i18n)/7(演出+配線) ✅
- **C**（ドロワー: 開=記録モード/光の道/活動スクラブ/踏破/undo/記録一覧廃止/脱ピル/ジャンプ）→ Task 8(道ロジック)/9(スナップ)/10(clamp)/11(スクラブ)/12(道UI)/13(ドロワー+再構成) ✅
- **D**（アニメ停止）→ Task 1 ✅
- **normalizeProgress テスト** → Task 2 ✅
- **モバイル非破壊** → Task 13 Step4 で最小 startRecordMode 対応 ✅（作り込みは別タスク）
- **型整合**: `classifyRecord(progress, reachedPos)`, `phaseRoadPositions/roadTimeFromClick/clampActivity`, `toast/lastRecordedTs/undoLastRecord/clearToast`, `ActivityScrub` props, `PhaseRoad` 無 props — 各タスク間で一致。
- **確認済み（実装前 grep で確定）**: locales = フラット単一ファイル `src/locales/{ja,en,ko,zh}.json` の `"progress"` ブロック（per-dir translation.json ではない）。`Phase = { id, name: LocalizedString, startTime, endTime }`（types/index.ts:118）。`getPhaseName(name: string | LocalizedString, lang?: string): string`（types/index.ts:9）。phaseRoadPositions/PhaseRoad の型はこれに一致。
```
