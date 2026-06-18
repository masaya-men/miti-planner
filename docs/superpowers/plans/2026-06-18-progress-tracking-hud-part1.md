# 進捗トラッキングHUD Plan 1（本体・ソロ完結）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムライン（軽減表）の攻略進捗を「日ごとの最高到達点の波」としてヘッダー下段中央のHUDに可視化し、踏破時にお祝い演出を出す。ソロでも共同編集でも動作する本体を完成させる（collabリアルタイム同期は Plan 2）。

**Architecture:** 進捗は `PlanData.progress?`（表ごと）に持ち、既存のプラン保存（localStorage/Firestore）に相乗りする。純粋ロジック（同日max更新・進捗%算出）を独立モジュールに切り出して TDD。HUDの見た目は試作ブランチ `feat/progress-celebration-proto` の最新コミット `4c0b94b` から **1:1 移植**（独断で作り替えない）。表示は端末グローバルフラグ（localStorage・デフォルトON）で制御。

**Tech Stack:** React + TypeScript, Zustand, react-i18next, canvas（軌跡描画・移植）, canvas-confetti（お祝い）, framer-motion（アイコン降り・既存）。

## Global Constraints

- 言語: UIテキストは必ず i18n キー経由（ja/en/ko/zh の4言語に同一キー追加）。ハードコーディング禁止。
- 軌跡の光の見た目は試作 `4c0b94b` を **1:1 移植**。Claude が独断で別方式（SVG等）に作り替えない（spec「軌跡の光（確定・勝手に変えない）」）。
- 進捗データ `progress?` は「空が正常」なオプショナル。空上書きガード（`isEmptyPlanData` / `RESEED_FIELDS` / `emptyOverwriteSkips`）の対象に**含めない**。
- 既存プランは `progress === undefined`。すべての読み出しで `?? デフォルト` し、マイグレーション不要。
- 表示フラグは端末グローバル（localStorage）・デフォルトON。
- collab中の進捗更新は Plan 1 ではローカル `set()` のみ（リアルタイム委譲は Plan 2）。純粋閲覧者（`_collabReadonly && !_collabActive`）は書き込みブロック。
- push前は `npm run build`（tsc厳密）+ `npm run test`（vitest）必須（memory `feedback_vercel_tsc_strict` / `reference_vitest_vmthreads_hang` 安全手順）。
- 既存タイムラインのクリック挙動（軽減配置・編集）を壊さない。記録モードの横取りは記録モード中のみ。

---

## File Structure

**新規作成:**
- `src/lib/progressLogic.ts` — 純粋ロジック（mergeDailyBest / computeProgressPercent / isEmptyProgress / makeDayKey）。副作用なし・単体テスト対象。
- `src/lib/progressLogic.test.ts` — 上記のテスト。
- `src/store/useProgressBarVisibility.ts` — 端末グローバル表示フラグ（localStorage）。
- `src/store/useProgressBarVisibility.test.ts` — テスト。
- `src/components/progress/ProgressTrackingHUD.tsx` — HUD帯本体（試作 JourneyStrip + PulseTrail を移植・PlanData駆動）。
- `src/components/progress/ProgressCelebration.tsx` — お祝い演出（試作 Celebration を移植）。
- `src/components/progress/ProgressRecordPanel.tsx` — 記録パネル（PC=ポップオーバー / スマホ=MobileBottomSheet）。
- `src/components/progress/useProgressRecording.ts` — 記録モード状態（zustand・recordMode フラグ + 確定コールバック）。

**変更:**
- `src/types/index.ts` — `PlanProgress` 型追加、`PlanData.progress?` 追加。
- `src/store/useMitigationStore.ts` — `progress` state + getSnapshot/loadSnapshot 統合 + アクション群。
- `src/components/ConsolidatedHeader.tsx` — HUD配置（下段中央）+ 復帰ボタン（右グループ）。
- `src/components/TimelineRow.tsx`（または `Timeline.tsx`）— 記録モード中の時間クリック横取り。
- `src/locales/{ja,en,ko,zh}.json` — i18n キー追加。
- `package.json` — `canvas-confetti` + `@types/canvas-confetti` 依存追加。

---

## Phase A: データ層（純粋ロジック・TDD）

### Task A1: PlanProgress 型を追加

**Files:**
- Modify: `src/types/index.ts:240-256`（`PlanData` interface）

**Interfaces:**
- Produces: `PlanProgress`（`dailyBest: DailyBest[]`, `cleared: boolean`, `activeDays?: number`, `activeHours?: number`）、`DailyBest`（`day: string`, `reachedPos: number`）、`PlanData.progress?: PlanProgress`

- [ ] **Step 1: 型を追加**

`src/types/index.ts` の `PlanData` interface 直前に追加：

```ts
/** 進捗トラッキング: その日の最高到達点 */
export interface DailyBest {
    /** カレンダー日付 'YYYY-MM-DD' (JST)。同日の重複は最高到達点に統合 */
    day: string;
    /** その日の最高到達点。タイムライン上の秒位置 */
    reachedPos: number;
}

/** 進捗トラッキング (表ごと・未マイグレ既存プランは undefined) */
export interface PlanProgress {
    /** 日ごとの最高到達点の配列。横軸=日付順、縦軸=reachedPos */
    dailyBest: DailyBest[];
    /** クリアボタンで true */
    cleared: boolean;
    /** 任意・手入力。デフォルト非表示 */
    activeDays?: number;
    /** 任意・手入力。デフォルト非表示 */
    activeHours?: number;
}
```

`PlanData` interface の `memos?: PlanMemo[];` の直後に追加：

```ts
    /** 進捗トラッキング v1、 未マイグレ既存プランは undefined */
    progress?: PlanProgress;
```

- [ ] **Step 2: tsc で型が通ることを確認**

Run: `npx tsc -b --noEmit`（または `npm run build` の tsc 部分）
Expected: 既存と同じ結果（新規エラーが出ない）

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(progress): PlanData に progress? (PlanProgress) 型を追加"
```

---

### Task A2: 純粋ロジック progressLogic.ts（TDD）

**Files:**
- Create: `src/lib/progressLogic.ts`
- Test: `src/lib/progressLogic.test.ts`

**Interfaces:**
- Consumes: `DailyBest`, `PlanProgress`（Task A1）
- Produces:
  - `makeDayKey(date: Date): string` — Date → 'YYYY-MM-DD'（JST）
  - `mergeDailyBest(list: DailyBest[], entry: DailyBest): DailyBest[]` — 同日は max(reachedPos) に統合、日付昇順を維持
  - `removeDay(list: DailyBest[], day: string): DailyBest[]` — その日の点を削除
  - `computeProgressPercent(progress: PlanProgress | undefined, timelineTotalSec: number): number` — 最高reachedPos/全長*100（cleared なら100）、0〜100丸め
  - `isEmptyProgress(progress: PlanProgress | undefined): boolean` — dailyBest空 && !cleared && activeDays/Hours未設定

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/progressLogic.test.ts
import { describe, it, expect } from 'vitest';
import { makeDayKey, mergeDailyBest, removeDay, computeProgressPercent, isEmptyProgress } from './progressLogic';
import type { PlanProgress } from '../types';

describe('makeDayKey', () => {
    it('JST の YYYY-MM-DD を返す', () => {
        // 2026-06-18T15:00:00Z = JST 2026-06-19 00:00
        expect(makeDayKey(new Date('2026-06-18T15:00:00Z'))).toBe('2026-06-19');
        // 2026-06-18T14:59:00Z = JST 2026-06-18 23:59
        expect(makeDayKey(new Date('2026-06-18T14:59:00Z'))).toBe('2026-06-18');
    });
});

describe('mergeDailyBest', () => {
    it('新しい日を追加し日付昇順を保つ', () => {
        const r = mergeDailyBest([{ day: '2026-06-17', reachedPos: 100 }], { day: '2026-06-18', reachedPos: 50 });
        expect(r).toEqual([{ day: '2026-06-17', reachedPos: 100 }, { day: '2026-06-18', reachedPos: 50 }]);
    });
    it('同じ日は最高到達点に統合（より大きい時だけ更新）', () => {
        const base = [{ day: '2026-06-18', reachedPos: 80 }];
        expect(mergeDailyBest(base, { day: '2026-06-18', reachedPos: 120 })).toEqual([{ day: '2026-06-18', reachedPos: 120 }]);
        expect(mergeDailyBest(base, { day: '2026-06-18', reachedPos: 40 })).toEqual([{ day: '2026-06-18', reachedPos: 80 }]);
    });
    it('順不同の既存リストでも昇順に整列して返す', () => {
        const r = mergeDailyBest([{ day: '2026-06-18', reachedPos: 10 }], { day: '2026-06-16', reachedPos: 5 });
        expect(r.map(d => d.day)).toEqual(['2026-06-16', '2026-06-18']);
    });
});

describe('removeDay', () => {
    it('指定日の点だけ削除', () => {
        const r = removeDay([{ day: '2026-06-17', reachedPos: 1 }, { day: '2026-06-18', reachedPos: 2 }], '2026-06-17');
        expect(r).toEqual([{ day: '2026-06-18', reachedPos: 2 }]);
    });
});

describe('computeProgressPercent', () => {
    it('最高到達点 / 全長 * 100 を丸めて返す', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 30 }, { day: 'b', reachedPos: 90 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(30); // 90/300=0.3
    });
    it('cleared なら全長に関係なく 100', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 30 }], cleared: true };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
    it('progress 未設定 or 全長0 は 0', () => {
        expect(computeProgressPercent(undefined, 300)).toBe(0);
        expect(computeProgressPercent({ dailyBest: [], cleared: false }, 0)).toBe(0);
    });
    it('100 を超えない', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 400 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
});

describe('isEmptyProgress', () => {
    it('全て空なら true', () => {
        expect(isEmptyProgress(undefined)).toBe(true);
        expect(isEmptyProgress({ dailyBest: [], cleared: false })).toBe(true);
    });
    it('1点でもあれば false', () => {
        expect(isEmptyProgress({ dailyBest: [{ day: 'a', reachedPos: 1 }], cleared: false })).toBe(false);
        expect(isEmptyProgress({ dailyBest: [], cleared: true })).toBe(false);
        expect(isEmptyProgress({ dailyBest: [], cleared: false, activeDays: 3 })).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/progressLogic.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: Write implementation**

```ts
// src/lib/progressLogic.ts
import type { DailyBest, PlanProgress } from '../types';

/** Date → 'YYYY-MM-DD' (JST = UTC+9) */
export function makeDayKey(date: Date): string {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** 同日は最高到達点に統合し、日付昇順で返す */
export function mergeDailyBest(list: DailyBest[], entry: DailyBest): DailyBest[] {
    const map = new Map<string, number>();
    for (const d of list) map.set(d.day, Math.max(map.get(d.day) ?? -Infinity, d.reachedPos));
    map.set(entry.day, Math.max(map.get(entry.day) ?? -Infinity, entry.reachedPos));
    return Array.from(map.entries())
        .map(([day, reachedPos]) => ({ day, reachedPos }))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export function removeDay(list: DailyBest[], day: string): DailyBest[] {
    return list.filter(d => d.day !== day);
}

/** 最高到達点 / 全長 * 100（cleared は 100）。0〜100 に丸めクランプ */
export function computeProgressPercent(progress: PlanProgress | undefined, timelineTotalSec: number): number {
    if (!progress) return 0;
    if (progress.cleared) return 100;
    if (timelineTotalSec <= 0 || progress.dailyBest.length === 0) return 0;
    const best = Math.max(...progress.dailyBest.map(d => d.reachedPos));
    return Math.max(0, Math.min(100, Math.round((best / timelineTotalSec) * 100)));
}

export function isEmptyProgress(progress: PlanProgress | undefined): boolean {
    if (!progress) return true;
    return (
        progress.dailyBest.length === 0 &&
        !progress.cleared &&
        progress.activeDays === undefined &&
        progress.activeHours === undefined
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/progressLogic.test.ts`
Expected: PASS（全ケース緑）

- [ ] **Step 5: Commit**

```bash
git add src/lib/progressLogic.ts src/lib/progressLogic.test.ts
git commit -m "feat(progress): 純粋ロジック(mergeDailyBest/computeProgressPercent等)をTDDで追加"
```

---

### Task A3: useMitigationStore に progress を統合

**Files:**
- Modify: `src/store/useMitigationStore.ts`（state宣言・初期値・getSnapshot・loadSnapshot・アクション）

**Interfaces:**
- Consumes: `mergeDailyBest`, `removeDay`, `makeDayKey`（Task A2）、`PlanProgress`, `DailyBest`（A1）
- Produces（store アクション）:
  - `recordReachedPoint(reachedPos: number): void` — 今日の点を mergeDailyBest で記録
  - `removeProgressDay(day: string): void`
  - `setCleared(cleared: boolean): void`
  - `setActiveDays(n: number | undefined): void` / `setActiveHours(n: number | undefined): void`
  - state: `progress: PlanProgress`（初期値 `{ dailyBest: [], cleared: false }`）

**注意:** 既存の memos アクション（`useMitigationStore.ts:1518-1570`）と同じ collab ガード（`_collabReadonly && !_collabActive` で純粋閲覧者ブロック）を踏襲。ただし Plan 1 では collab 委譲（`_collabHandlers`）は**使わず常にローカル `set()`**（委譲は Plan 2）。getSnapshot/loadSnapshot は memos と同じ箇所（agent調査: 行75/543/601-683 付近）に並べる。

- [ ] **Step 1: state 宣言・初期値・型を追加**

state interface に（memos の隣）:
```ts
progress: PlanProgress;
```
初期値（memos: [] の隣）:
```ts
progress: { dailyBest: [], cleared: false },
```
アクション型（メモアクション型の隣）:
```ts
recordReachedPoint: (reachedPos: number) => void;
removeProgressDay: (day: string) => void;
setCleared: (cleared: boolean) => void;
setActiveDays: (n: number | undefined) => void;
setActiveHours: (n: number | undefined) => void;
```

- [ ] **Step 2: getSnapshot / loadSnapshot に組み込む**

`getSnapshot` の返り値オブジェクト（memos: state.memos の隣）:
```ts
progress: state.progress,
```
`loadSnapshot` の `set({...})`（memos: snapshot.memos ?? [] の隣）:
```ts
progress: snapshot.progress ?? { dailyBest: [], cleared: false },
```

- [ ] **Step 3: アクション実装を追加**

`deleteAllMemos`（行1570 付近）の直後に追加。`mergeDailyBest`/`removeDay`/`makeDayKey` を import 済みにすること（ファイル冒頭の import に `import { mergeDailyBest, removeDay, makeDayKey } from '../lib/progressLogic';` を追加）:

```ts
recordReachedPoint: (reachedPos) => {
    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
    const day = makeDayKey(new Date());
    set((state) => ({
        progress: { ...state.progress, dailyBest: mergeDailyBest(state.progress.dailyBest, { day, reachedPos }) },
    }));
},
removeProgressDay: (day) => {
    if (get()._collabReadonly && !get()._collabActive) return;
    set((state) => ({
        progress: { ...state.progress, dailyBest: removeDay(state.progress.dailyBest, day) },
    }));
},
setCleared: (cleared) => {
    if (get()._collabReadonly && !get()._collabActive) return;
    set((state) => ({ progress: { ...state.progress, cleared } }));
},
setActiveDays: (n) => {
    if (get()._collabReadonly && !get()._collabActive) return;
    set((state) => ({ progress: { ...state.progress, activeDays: n } }));
},
setActiveHours: (n) => {
    if (get()._collabReadonly && !get()._collabActive) return;
    set((state) => ({ progress: { ...state.progress, activeHours: n } }));
},
```

- [ ] **Step 4: build + 既存テストが緑であることを確認**

Run: `npx tsc -b --noEmit` → Expected: PASS（型エラーなし。getSnapshot の戻り型に progress が必要なら型定義へ反映）
Run: `npx vitest run src/store` → Expected: 既存テスト緑（新規 progress フィールドで既存スナップショット系が壊れていないこと）

- [ ] **Step 5: Commit**

```bash
git add src/store/useMitigationStore.ts
git commit -m "feat(progress): useMitigationStore に progress state とアクションを統合"
```

---

## Phase B: 表示制御

### Task B1: 端末グローバル表示フラグ store（TDD）

**Files:**
- Create: `src/store/useProgressBarVisibility.ts`
- Test: `src/store/useProgressBarVisibility.test.ts`

**Interfaces:**
- Produces: `useProgressBarVisibility`（zustand）。state `visible: boolean`（初期=localStorage、未設定はtrue=デフォルトON）、actions `hide()` / `show()` / `toggle()`。localStorage キー `lopo_progress_bar_visible`（'false' で非表示）。

- [ ] **Step 1: Write the failing test**

```ts
// src/store/useProgressBarVisibility.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { readVisibleFromStorage, writeVisibleToStorage } from './useProgressBarVisibility';

describe('progress bar visibility storage', () => {
    beforeEach(() => localStorage.clear());
    it('未設定はデフォルトON(true)', () => {
        expect(readVisibleFromStorage()).toBe(true);
    });
    it('false 保存で非表示', () => {
        writeVisibleToStorage(false);
        expect(readVisibleFromStorage()).toBe(false);
    });
    it('true 保存で表示', () => {
        writeVisibleToStorage(false);
        writeVisibleToStorage(true);
        expect(readVisibleFromStorage()).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useProgressBarVisibility.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: Write implementation**

```ts
// src/store/useProgressBarVisibility.ts
import { create } from 'zustand';

const STORAGE_KEY = 'lopo_progress_bar_visible';

export function readVisibleFromStorage(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(STORAGE_KEY) !== 'false';
}
export function writeVisibleToStorage(v: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(v));
}

interface ProgressBarVisibilityState {
    visible: boolean;
    hide: () => void;
    show: () => void;
    toggle: () => void;
}

export const useProgressBarVisibility = create<ProgressBarVisibilityState>((set, get) => ({
    visible: readVisibleFromStorage(),
    hide: () => { writeVisibleToStorage(false); set({ visible: false }); },
    show: () => { writeVisibleToStorage(true); set({ visible: true }); },
    toggle: () => { const next = !get().visible; writeVisibleToStorage(next); set({ visible: next }); },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useProgressBarVisibility.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/useProgressBarVisibility.ts src/store/useProgressBarVisibility.test.ts
git commit -m "feat(progress): 端末グローバル表示フラグ store をTDDで追加"
```

---

### Task B2: ConsolidatedHeader に HUD配置 + 復帰ボタン

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx`（下段＝Layer B。左グループ末尾 line 391 と右グループ開始 line 393 の間、および右グループ内）

**Interfaces:**
- Consumes: `useProgressBarVisibility`（B1）、`ProgressTrackingHUD`（C2・この時点では仮スタブでよい）、i18n キー `progress.show_bar`（Phase F）

**注意:** この時点で `ProgressTrackingHUD` 未実装なら、まず `<div>progress hud</div>` の仮プレースホルダで配置し、Task C2 で中身を差し替える。配置場所はエージェント調査どおり「左ツール群と右リスト群の間の `flex-1` 中央」。

- [ ] **Step 1: import 追加**

```tsx
import { useProgressBarVisibility } from '../store/useProgressBarVisibility';
import { ProgressTrackingHUD } from './progress/ProgressTrackingHUD';
import { Eye } from 'lucide-react'; // 既存の lucide-react import 群に追加(復帰ボタンアイコン)
```

- [ ] **Step 2: HUDを下段中央に配置**

下段の左グループ閉じ `</div>`（line 391 付近）と右グループ開始 `<div className="flex items-center gap-1.5">`（line 393 付近）の間に挿入：

```tsx
{useProgressBarVisibility.getState().visible && (() => null)()}
{/* 中央: 進捗HUD（表示フラグON時のみ） */}
<ProgressHudSlot />
```

…ではなく、再レンダリングのため購読フックを使う。コンポーネント関数本体の上部で:
```tsx
const progressBarVisible = useProgressBarVisibility(s => s.visible);
```
を追加し、中央スロットを：
```tsx
{progressBarVisible && (
    <div className="flex-1 flex items-center justify-center min-w-0 px-3 overflow-visible">
        <div className="w-full max-w-[640px]">
            <ProgressTrackingHUD />
        </div>
    </div>
)}
```

- [ ] **Step 3: 復帰ボタンを右グループに追加**

右グループ（line 393-440）の適切な位置（例: MY Job Highlight ボタンの近く）に、**非表示のときだけ**出す復帰ボタン：

```tsx
{!progressBarVisible && (
    <button
        type="button"
        onClick={() => useProgressBarVisibility.getState().show()}
        className={/* 既存の pill ボタン共通クラスに合わせる */ ''}
        title={t('progress.show_bar')}
    >
        <Eye size={14} />
        <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('progress.show_bar')}</span>
    </button>
)}
```

（クラスは同ファイル内の既存ボタン＝MY Job Highlight ボタンのクラスを流用すること。i18n キーは Phase F で追加。先に追加してもよい）

- [ ] **Step 4: build 確認**

Run: `npx tsc -b --noEmit`
Expected: PASS（`ProgressTrackingHUD` を仮スタブにしている場合はスタブが存在すること）

- [ ] **Step 5: Commit**

```bash
git add src/components/ConsolidatedHeader.tsx
git commit -m "feat(progress): ヘッダー下段中央にHUDスロット+非表示時の復帰ボタンを配置"
```

---

## Phase C: HUD本体移植（4c0b94b を 1:1）

### Task C1: canvas-confetti 依存を追加

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 依存追加**

Run:
```bash
npm install canvas-confetti@^1.9.4
npm install -D @types/canvas-confetti@^1.9.0
```

- [ ] **Step 2: build 確認**

Run: `npx tsc -b --noEmit` → Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(progress): canvas-confetti 依存を追加"
```

---

### Task C2: ProgressTrackingHUD（試作 JourneyStrip + PulseTrail を移植）

**Files:**
- Create: `src/components/progress/ProgressTrackingHUD.tsx`
- 移植元（取得）: `git show feat/progress-celebration-proto:src/dev/progressProto/ProgressProtoPanel.tsx`

**Interfaces:**
- Consumes: `useMitigationStore`（`progress`・タイムライン全長）、`computeProgressPercent`/`isEmptyProgress`（A2）、`useProgressRecording`（D1・記録パネル開く）
- Produces: `ProgressTrackingHUD`（props なし。store から読む）

**移植手順（独断で見た目を変えない）:**

- [ ] **Step 1: 移植元コードを取得**

Run: `git show feat/progress-celebration-proto:src/dev/progressProto/ProgressProtoPanel.tsx > src/components/progress/ProgressTrackingHUD.tsx`
（取得後、ファイル冒頭の「開発専用・試作」コメントを通常コメントに直す）

- [ ] **Step 2: SEED依存を PlanData 駆動に差し替え**

- 試作の `points: number[]`（％配列・SEED）を、`useMitigationStore` の `progress.dailyBest` から算出した「日ごとの reachedPos を％へ正規化した配列」に置き換える。正規化＝`reachedPos / timelineTotalSec * 100`（`computeProgressPercent` と同じ分母）。
- `hours` は `progress.activeHours`、`cleared` は `progress.cleared` を使う。
- **PulseTrail（canvas 軌跡描画）のロジック・定数（cornerX/cornerY/SPEED/PERIOD_MIN/MAX/GAP/TAIL_FRAC/glow）は一切変更しない**（4c0b94b の見た目を保つ）。入力データだけ差し替える。
- タイムライン全長は store から取得（`timelineEvents` の最大 time 等。既存の算出関数があれば流用。なければ `Math.max(...timelineEvents.map(e => e.time))` 相当）。

- [ ] **Step 3: 右セクション（活動ドット ActivityDots）を一旦外す**

spec で「活動○×は今回スコープ外」。試作の右 ActivityDots は**レンダリングしない**（コードは残してもよいが表示しない）。中央軌跡＋左（進捗％／オプション日数時間）構成にする。

- [ ] **Step 4: HUDクリックで記録パネルを開く**

HUD帯のクリックハンドラで `useProgressRecording.getState().openPanel()` を呼ぶ（D1）。

- [ ] **Step 5: ConsolidatedHeader の仮スタブを本物に差し替え**

Task B2 で仮スタブにしていた場合、`ProgressTrackingHUD` import を本実装に向ける。

- [ ] **Step 6: 実機目視（dev:progress ではなく通常 dev）**

Run: `npm run dev` → `/miti` を開く（ログイン要）。進捗が空なら空状態（Task C3）、点があれば軌跡が出ることを目視。**4c0b94b と見た目が一致しているか**を確認（不一致なら移植ミス＝修正）。

- [ ] **Step 7: Commit**

```bash
git add src/components/progress/ProgressTrackingHUD.tsx src/components/ConsolidatedHeader.tsx
git commit -m "feat(progress): HUD本体を試作4c0b94bから1:1移植しPlanData駆動に"
```

---

### Task C3: 空状態（誘導型）

**Files:**
- Modify: `src/components/progress/ProgressTrackingHUD.tsx`

- [ ] **Step 1: 空判定で誘導表示に分岐**

`isEmptyProgress(progress)` が true のとき、軌跡の代わりに誘導文言（i18n `progress.empty_cta` = 「クリックして攻略の軌跡を記録」）を出す。クリックで記録パネルを開く（C2 Step4 と同じハンドラ）。1点でも入れば自動で軌跡表示へ（再レンダリングで分岐が変わる）。

- [ ] **Step 2: 実機目視**

Run: `npm run dev` → 新規プランで空状態の誘導が出る → 記録すると軌跡に切り替わる。

- [ ] **Step 3: Commit**

```bash
git add src/components/progress/ProgressTrackingHUD.tsx
git commit -m "feat(progress): 記録ゼロ時の誘導型空状態を追加"
```

---

## Phase D: 記録UX

### Task D1: 記録モード store + 記録パネル枠

**Files:**
- Create: `src/components/progress/useProgressRecording.ts`
- Create: `src/components/progress/ProgressRecordPanel.tsx`

**Interfaces:**
- Produces:
  - `useProgressRecording`（zustand）: state `panelOpen: boolean`, `recordMode: boolean`; actions `openPanel()`, `closePanel()`, `startRecordMode()`, `stopRecordMode()`, `commitReachedPos(sec: number)`（recordMode 中にタイムラインがクリックされたとき呼ぶ→`useMitigationStore.recordReachedPoint` 実行 + recordMode 終了）
  - `ProgressRecordPanel`（props: なし。store 駆動。PC=ヘッダー下のポップオーバー / スマホ=MobileBottomSheet）

- [ ] **Step 1: useProgressRecording を作成**

```ts
// src/components/progress/useProgressRecording.ts
import { create } from 'zustand';
import { useMitigationStore } from '../../store/useMitigationStore';

interface ProgressRecordingState {
    panelOpen: boolean;
    recordMode: boolean;
    openPanel: () => void;
    closePanel: () => void;
    startRecordMode: () => void;
    stopRecordMode: () => void;
    commitReachedPos: (sec: number) => void;
}

export const useProgressRecording = create<ProgressRecordingState>((set) => ({
    panelOpen: false,
    recordMode: false,
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false, recordMode: false }),
    startRecordMode: () => set({ recordMode: true }),
    stopRecordMode: () => set({ recordMode: false }),
    commitReachedPos: (sec) => {
        useMitigationStore.getState().recordReachedPoint(sec);
        set({ recordMode: false });
    },
}));
```

- [ ] **Step 2: ProgressRecordPanel の枠を作成**

PC=ヘッダー下のポップオーバー（既存の `HeaderPhaseDropdown.tsx` の Portal+外側クリック方式に倣う）、スマホ=`MobileBottomSheet`（`fillContent` or `height`）。中身は次タスクで充実。最低限：
- 「到達点を記録」ボタン → `startRecordMode()` ＋ パネルに「タイムラインの時間をクリックしてください」案内。
- 閉じる導線。

- [ ] **Step 3: build 確認**

Run: `npx tsc -b --noEmit` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/progress/useProgressRecording.ts src/components/progress/ProgressRecordPanel.tsx
git commit -m "feat(progress): 記録モードstoreと記録パネルの枠を追加"
```

---

### Task D2: タイムラインの時間クリック横取り

**Files:**
- Modify: `src/components/TimelineRow.tsx`（`onCellClick` / 時間セルクリック。agent調査: line 441 `onAddEventClick`, line 699 `onCellClick`）または `src/components/Timeline.tsx` のハンドラ

**注意（最重要・実機総点検）:** 記録モード中だけクリックを横取りし、既存の軽減配置・イベント追加を壊さない。`useProgressRecording.recordMode` が true のときのみ `stopPropagation()`+`preventDefault()` して秒位置を `commitReachedPos` へ。false なら従来どおり。memory `feedback_structural_refactor_runtime_audit`。

- [ ] **Step 1: 時間セル/列のクリックに記録モード分岐を追加**

時間セルのクリック経路（`onAddEventClick(time, e)` 相当）で、ハンドラ先頭に：

```tsx
import { useProgressRecording } from './progress/useProgressRecording';
// ...
// 時間クリックハンドラ内（既存処理の前）
if (useProgressRecording.getState().recordMode) {
    e.stopPropagation();
    e.preventDefault();
    useProgressRecording.getState().commitReachedPos(time); // time = 秒位置
    return;
}
// ↓ 既存処理（イベント追加 / 軽減配置）はそのまま
```

メンバー列クリック（`onCellClick`）にも、記録モード中は配置させず記録に回す同じガードを入れる（記録モード中は表全体が「時間ピッカー」になる）。

- [ ] **Step 2: 実機総点検（ON/OFF両方）**

Run: `npm run dev` → `/miti`：
- 記録モードOFF: 軽減配置・イベント追加が**従来どおり**動く（回帰なし）。
- 記録モードON（記録パネルで開始）: 表クリックで秒位置が記録され、軌跡に点が増える。配置は起きない。

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineRow.tsx
git commit -m "feat(progress): 記録モード中の時間クリック横取り(既存配置は不変)"
```

---

### Task D3: フェーズジャンプ流用

**Files:**
- Modify: `src/components/progress/ProgressRecordPanel.tsx`

**Interfaces:**
- Consumes: 既存フェーズジャンプ（`HeaderPhaseDropdown.tsx:63-67` の `onJump(startTime)` / Timeline のスクロール `scrollTo`）。記録パネルからフェーズを選ぶとタイムラインがそこへスクロール。

- [ ] **Step 1: 記録パネルにフェーズボタン群を追加**

`useMitigationStore` の `phases` を列挙し、各ボタンクリックで既存のフェーズジャンプ（Timeline へのスクロール）を呼ぶ。既存の `HeaderPhaseDropdown` が公開しているジャンプ手段を流用（同じコールバック経路に乗せる）。

- [ ] **Step 2: 実機目視**

Run: `npm run dev` → 記録パネルのフェーズボタンでタイムラインが該当位置へスクロール。

- [ ] **Step 3: Commit**

```bash
git add src/components/progress/ProgressRecordPanel.tsx
git commit -m "feat(progress): 記録パネルにフェーズジャンプ流用を追加"
```

---

### Task D4: クリアボタン + ±カウンター + 誤記録修正

**Files:**
- Modify: `src/components/progress/ProgressRecordPanel.tsx`

**Interfaces:**
- Consumes: `useMitigationStore`（`setCleared`/`setActiveDays`/`setActiveHours`/`removeProgressDay`/`progress`）

- [ ] **Step 1: クリアボタン**

「クリア（踏破）」ボタン → `setCleared(true)` → お祝い発火（E1 の発火条件に接続）。誤クリック用に「クリア解除」も小さく（`setCleared(false)`）。

- [ ] **Step 2: ±カウンター（活動日数・時間／任意）**

`activeDays`/`activeHours` を ± ステッパーで増減（最小0、未設定可）。spec どおりデフォルト非表示＝「活動日数・時間を入力（任意）」を開いた人だけ表示・入力。入れると HUD 左に出る（C2 が `activeHours` を読む）。

- [ ] **Step 3: 誤記録修正（その日の点を消す/直す）**

記録済み `dailyBest` を一覧し、各日に「削除」（`removeProgressDay(day)`）。

- [ ] **Step 4: build + 実機目視**

Run: `npx tsc -b --noEmit` → PASS。`npm run dev` でクリア/カウンター/削除が反映。

- [ ] **Step 5: Commit**

```bash
git add src/components/progress/ProgressRecordPanel.tsx
git commit -m "feat(progress): クリアボタン/±カウンター/誤記録修正を記録パネルに追加"
```

---

## Phase E: お祝い演出

### Task E1: ProgressCelebration（試作 Celebration を移植）+ 発火条件

**Files:**
- Create: `src/components/progress/ProgressCelebration.tsx`（移植元: `git show feat/progress-celebration-proto:src/dev/progressProto/ProgressProtoPanel.tsx` の Celebration 部分）
- Modify: `src/components/progress/ProgressTrackingHUD.tsx`（マウント＋発火条件）

**Interfaces:**
- Consumes: `canvas-confetti`、`useMitigations()`（降らせるアイコン＝設定パーティのジョブのスキルアイコン）、`useMitigationStore.progress.cleared`
- Produces: `ProgressCelebration`（props: `onDismiss: () => void`。クリックするまでループ）

**発火条件（spec）:** ①クリアボタン押下時 ②クリア済みの表を開いた時。

- [ ] **Step 1: Celebration を移植**

試作の Celebration（confetti 3砲 + framer-motion アイコン降り72個 + 「おめでとう！」）を新ファイルへ移植。**演出ロジックは変更しない**。アイコンは「設定パーティのジョブが持つスキルアイコン全部」を集める（agent調査: `MITIGATIONS.filter(m => m.jobId === member.jobId).map(m => m.icon)` を partyMembers ぶん集約・重複除去）。「おめでとう！」は i18n `progress.congrats`。

- [ ] **Step 2: クリックまでループ + dismiss**

オーバーレイは body へ createPortal（memory `reference_fixed_inside_backdrop_filter`：backdrop-filter 内の fixed 回避）。クリックで `onDismiss`。

- [ ] **Step 3: 発火条件を接続**

`ProgressTrackingHUD` で：
- `setCleared(true)` 実行時にお祝いを出す（D4 から呼ぶ or cleared の遷移 false→true を検知）。
- マウント時（＝表を開いた時）に `progress.cleared === true` ならお祝いを出す（seed-on-open 相当。Plan 1 では Firestore/localStorage ロード後のマウントで成立）。
- いったん dismiss したら同じ表では再表示しない（セッション内フラグ）。

- [ ] **Step 4: 本番安全（dev-gate不要・表示フラグ連動）**

お祝いは進捗表示フラグ（B1）が ON のときのみ動く（非表示中はHUDごと出ない）。canvas-confetti は本番に載る（dev-gate ではない）。パーティクル数は試作値を踏襲（過剰描画に注意）。

- [ ] **Step 5: 実機目視**

Run: `npm run dev` → クリア押下でお祝い、クリア済み表を開き直してお祝い、クリックで消える。

- [ ] **Step 6: Commit**

```bash
git add src/components/progress/ProgressCelebration.tsx src/components/progress/ProgressTrackingHUD.tsx
git commit -m "feat(progress): お祝い演出(confetti+スキルアイコン降り)を移植し発火条件を接続"
```

---

## Phase F: i18n + 仕上げ

### Task F1: i18n キーを4言語に追加

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`

**Interfaces:**
- Produces キー（`progress` 名前空間）: `show_bar`, `empty_cta`, `record_title`, `record_cta`, `record_hint`, `phase_jump`, `clear`, `clear_undo`, `active_days`, `active_hours`, `congrats`, `delete_day`

- [ ] **Step 1: 4ファイルに同一キーを追加**

ja.json（例）:
```json
"progress": {
    "show_bar": "進捗バーを表示",
    "empty_cta": "クリックして攻略の軌跡を記録",
    "record_title": "進捗を記録",
    "record_cta": "到達点を記録",
    "record_hint": "タイムラインの時間をクリックしてください",
    "phase_jump": "フェーズへ移動",
    "clear": "クリア（踏破）",
    "clear_undo": "クリアを取り消す",
    "active_days": "活動日数",
    "active_hours": "活動時間",
    "congrats": "おめでとう！",
    "delete_day": "この記録を削除"
}
```
en/ko/zh も同じキー構造で訳を入れる（英語モードで崩れないこと＝memory i18n ルール）。

- [ ] **Step 2: build + 全テスト**

Run: `npx tsc -b --noEmit` → PASS
Run: `npm run test`（vitest 全体・安全手順）→ Expected: 既存緑 + 新規緑（既知の housing 5件のみ赤は許容）

- [ ] **Step 3: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(progress): 進捗HUDの文言を4言語に追加"
```

---

### Task F2: 仕上げ（build/test 通し + 実機総点検）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: EXIT=0（tsc 厳密で未使用変数/型不足なし＝memory `feedback_vercel_tsc_strict`）

- [ ] **Step 2: フルテスト**

Run: `npm run test`（安全手順・出力をパイプしない＝memory `reference_vitest_vmthreads_hang`）
Expected: 新規テスト緑、既存緑（既知 housing 5件のみ赤）

- [ ] **Step 3: 実機総点検チェックリスト（`npm run dev` → `/miti`）**

- [ ] デフォルトON でHUDが下段中央に出る／× で消える／復帰ボタンで戻る（リロードしても状態維持＝端末グローバル）
- [ ] 空状態の誘導 → 記録で軌跡へ
- [ ] 記録モードON/OFF で軽減配置・イベント追加が**回帰していない**（最重要）
- [ ] クリアでお祝い → クリックで消える → クリア済み表を開き直すと再度お祝い
- [ ] 活動日数/時間は入れた人だけ左に出る
- [ ] 軌跡の見た目が試作 4c0b94b と一致
- [ ] ja/en/ko/zh で文言が崩れない
- [ ] collab中（共同編集ON）でも自端末で記録・表示できる（リアルタイム反映は Plan 2・ここでは保存されることだけ確認）

- [ ] **Step 4: Commit（あれば微修正）**

```bash
git add -A
git commit -m "chore(progress): Plan1 仕上げ(build/test/実機総点検)"
```

---

## Self-Review（plan作成者チェック済）

- **Spec coverage:** 表示制御(B)/データモデル(A)/記録UX(D)/ビジュアル(C,E)/i18n(F) すべてタスク化。活動○×はスコープ外として除外（spec一致）。collab同期は Plan 2（spec の分割方針一致）。
- **Placeholder:** 純粋ロジック・store・表示フラグは完全コード。移植系（C2/E1）は「4c0b94bから取得して移植・入力だけ差し替え」という実行可能手順（見た目を独断で作らない制約のため、新規コード化ではなく移植が正しい）。
- **Type consistency:** `PlanProgress`/`DailyBest`（A1）→ progressLogic（A2）→ store（A3）→ HUD（C2）/記録（D）で型・関数名（`recordReachedPoint`/`setCleared`/`removeProgressDay`/`computeProgressPercent`/`mergeDailyBest`/`isEmptyProgress`）が一貫。

## Plan 2 への申し送り（このPlanでは未実装）
- collab Yjs 同期（`PROGRESS_KEY`・`buildSeedDocFull`/`readPlanDataFull`・`buildArrByKey`・provider observe・API `_saveHandler`/`_logic` decideLoadFull）。
- `dailyBest` を「日付ごとの要素」で Yjs 配列同期（同日 max・2人別日で両方残す）。`cleared`/`activeDays`/`activeHours` は meta（last-write-wins）。
- store アクションに collab 委譲（`_collabHandlers`）を追加（Plan 1 はローカル set のみ）。
- `progress` は空が正常 → `RESEED_FIELDS`/`emptyOverwriteSkips`/`isEmptyPlanData` に**含めない**。
