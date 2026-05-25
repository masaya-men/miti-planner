# 軽減表メモ機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減表シートの任意位置にユーザーが Plain text メモを置けるようにする (縦=時間軸固定、 横=フリー、 DnD 可、 上限 100 個×100 文字、 既存ゴミ箱メニュー統合、 PC のみ)。

**Architecture:** 既存 `PlanData` に optional `memos[]` フィールド追加。 縦座標は `timeSec` (連続秒)、 横座標は `xRatio` (0.0〜1.0 比率) で持つ。 メモモードは [useMitigationStore](src/store/useMitigationStore.ts) の新規 `toolMode` で AA 追加モードと排他制御。 DnD は既存軽減アイコンと同じ pointer events 自作 ([Timeline.tsx:463](src/components/Timeline.tsx#L463) パターン)。 一括削除は既存 [ClearMitigationsPopover](src/components/ClearMitigationsPopover.tsx) にメニュー追加で集約。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind v4 + react-i18next + lucide-react + clsx + framer-motion (既存に揃える)

**Spec:** [docs/superpowers/specs/2026-05-25-mitigation-memo-design.md](../specs/2026-05-25-mitigation-memo-design.md)

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| 修正 | `src/types/index.ts` | `PlanMemo` 型 + `PlanData.memos?` |
| 修正 | `src/types/firebase.ts` | `MEMO_LIMITS` 定数 |
| 新規 | `src/components/Memo/coords.ts` | 座標変換ヘルパ (px ↔ timeSec / xRatio) |
| 修正 | `src/store/useMitigationStore.ts` | `toolMode` state + メモ CRUD + AA との排他 |
| 新規 | `src/components/Memo/MemoOverlay.tsx` | メモの描画 + DnD (pointer events) |
| 新規 | `src/components/Memo/MemoInputBox.tsx` | 新規/編集 共用インライン入力ボックス |
| 新規 | `src/components/Memo/MemoFloatingBar.tsx` | メモモード ON 中の下部バー (count + Exit) |
| 新規 | `src/components/Memo/memo.css` | メモスタイル (`.plan-memo`, `--dragging`) |
| 修正 | `src/components/Timeline.tsx` | 鉛筆アイコン追加 + MemoOverlay/InputBox/FloatingBar 配線 + シートクリックハンドラ |
| 修正 | `src/components/ClearMitigationsPopover.tsx` | メニュー項目「メモを全削除」 + 確認ダイアログ |
| 修正 | `src/locales/ja.json` | `memo.*` キー (実値) |
| 修正 | `src/locales/en.json` | `memo.*` キー (ja 値コピー、 翻訳は後追い) |
| 修正 | `src/locales/ko.json` | `memo.*` キー (ja 値コピー) |
| 修正 | `src/locales/zh.json` | `memo.*` キー (ja 値コピー) |
| 新規 | `src/components/Memo/__tests__/coords.test.ts` | 座標変換単体テスト |
| 新規 | `src/store/__tests__/useMitigationStore.memo.test.ts` | store メモアクション + 排他テスト |
| 新規 | `src/types/__tests__/planMemo.compat.test.ts` | 既存プラン (`memos === undefined`) 後方互換テスト |

---

## Phase 1: 表示 + 新規作成 (= 最初のリリース単位)

### Task 1: PlanMemo 型 + MEMO_LIMITS 定数 + 既存プラン後方互換テスト

**Files:**
- Modify: `src/types/index.ts:213-227` (PlanData)
- Modify: `src/types/firebase.ts:154-160` (PLAN_LIMITS 隣に追加)
- Create: `src/types/__tests__/planMemo.compat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/types/__tests__/planMemo.compat.test.ts
import { describe, it, expect } from 'vitest';
import type { PlanData, PlanMemo } from '../index';
import { MEMO_LIMITS } from '../firebase';

describe('PlanMemo 後方互換', () => {
  it('memos === undefined の既存 PlanData をそのまま受け取れる', () => {
    const legacy: PlanData = {
      currentLevel: 100,
      timelineEvents: [],
      timelineMitigations: [],
      phases: [],
      partyMembers: [],
      aaSettings: { damage: 0, type: 'magical', target: 'MT' },
      schAetherflowPatterns: {},
    };
    expect(legacy.memos).toBeUndefined();
  });

  it('PlanMemo の必須フィールドが揃っている', () => {
    const memo: PlanMemo = {
      id: 'memo_1',
      text: 'テスト',
      timeSec: 12.5,
      xRatio: 0.4,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    expect(memo.timeSec).toBe(12.5);
    expect(memo.xRatio).toBe(0.4);
  });

  it('MEMO_LIMITS が公開されている', () => {
    expect(MEMO_LIMITS.MAX_MEMOS_PER_PLAN).toBe(100);
    expect(MEMO_LIMITS.MAX_TEXT_LENGTH).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/__tests__/planMemo.compat.test.ts`
Expected: FAIL (PlanMemo 型未定義 / MEMO_LIMITS 未定義)

- [ ] **Step 3: Add PlanMemo type and memos? to PlanData**

In `src/types/index.ts`, replace the `PlanData` block:

```ts
export interface PlanMemo {
    /** crypto.randomUUID() */
    id: string;
    /** 最大 MEMO_LIMITS.MAX_TEXT_LENGTH 文字 */
    text: string;
    /** 縦軸 = 何秒地点 (連続値、 0.0〜sheet 最終秒) */
    timeSec: number;
    /** 横軸 = シート横幅 (メンバー並び幅) に対する 0.0〜1.0 比率 */
    xRatio: number;
    /** Date.now() */
    createdAt: number;
    updatedAt: number;
}

export interface PlanData {
    currentLevel: number;
    timelineEvents: TimelineEvent[];
    timelineMitigations: AppliedMitigation[];
    phases: Phase[];
    labels?: Label[];
    partyMembers: PartyMember[];
    aaSettings: {
        damage: number;
        type: 'physical' | 'magical' | 'unavoidable';
        target: 'MT' | 'ST';
    };
    schAetherflowPatterns: Record<string, 1 | 2>;
    myMemberId?: string | null;
    /** メモ機能 v1 (#57)、 未マイグレ既存プランは undefined */
    memos?: PlanMemo[];
}
```

- [ ] **Step 4: Add MEMO_LIMITS to firebase.ts**

In `src/types/firebase.ts`, after the `PLAN_LIMITS` block (around line 160):

```ts
export const MEMO_LIMITS = {
  /** 1 プランに置けるメモ最大数 */
  MAX_MEMOS_PER_PLAN: 100,
  /** メモ 1 件の最大文字数 */
  MAX_TEXT_LENGTH: 100,
} as const;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/types/__tests__/planMemo.compat.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: TypeScript build check**

Run: `npm run build`
Expected: PASS (新規型による既存コードへの破壊なし。 `memos?` は optional なので既存 PlanData リテラルがそのまま通る)

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/types/firebase.ts src/types/__tests__/planMemo.compat.test.ts
git commit -m "feat(memo): #57 PlanMemo 型 + MEMO_LIMITS 定数 (Phase 1 Task 1)"
```

---

### Task 2: 座標変換ヘルパ (px ↔ timeSec / xRatio)

**Files:**
- Create: `src/components/Memo/coords.ts`
- Create: `src/components/Memo/__tests__/coords.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/Memo/__tests__/coords.test.ts
import { describe, it, expect } from 'vitest';
import { pxToTimeSec, timeSecToPx, pxToXRatio, xRatioToPx, clampMemoCoords } from '../coords';

describe('Memo coords 変換', () => {
  describe('pxToTimeSec / timeSecToPx', () => {
    it('px = 0 → timeSec = offsetTime (= 0 or -10 in preStart)', () => {
      expect(pxToTimeSec(0, 50, 0)).toBe(0);
      expect(pxToTimeSec(0, 50, -10)).toBe(-10);
    });
    it('px = pixelsPerSecond → timeSec = offsetTime + 1', () => {
      expect(pxToTimeSec(50, 50, 0)).toBe(1);
      expect(pxToTimeSec(50, 50, -10)).toBe(-9);
    });
    it('timeSec round-trip', () => {
      const sec = 12.5;
      expect(pxToTimeSec(timeSecToPx(sec, 50, 0), 50, 0)).toBeCloseTo(sec);
    });
  });

  describe('pxToXRatio / xRatioToPx', () => {
    it('px = 0 → xRatio = 0', () => {
      expect(pxToXRatio(0, 800)).toBe(0);
    });
    it('px = width → xRatio = 1', () => {
      expect(pxToXRatio(800, 800)).toBe(1);
    });
    it('px = width / 2 → xRatio = 0.5', () => {
      expect(pxToXRatio(400, 800)).toBe(0.5);
    });
    it('xRatio round-trip', () => {
      const r = 0.37;
      expect(pxToXRatio(xRatioToPx(r, 800), 800)).toBeCloseTo(r);
    });
  });

  describe('clampMemoCoords', () => {
    it('timeSec を [0, maxTime] にクランプ', () => {
      expect(clampMemoCoords({ timeSec: -5, xRatio: 0.5 }, 60).timeSec).toBe(0);
      expect(clampMemoCoords({ timeSec: 999, xRatio: 0.5 }, 60).timeSec).toBe(60);
      expect(clampMemoCoords({ timeSec: 30, xRatio: 0.5 }, 60).timeSec).toBe(30);
    });
    it('xRatio を [0, 1] にクランプ', () => {
      expect(clampMemoCoords({ timeSec: 10, xRatio: -0.2 }, 60).xRatio).toBe(0);
      expect(clampMemoCoords({ timeSec: 10, xRatio: 1.5 }, 60).xRatio).toBe(1);
      expect(clampMemoCoords({ timeSec: 10, xRatio: 0.7 }, 60).xRatio).toBe(0.7);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Memo/__tests__/coords.test.ts`
Expected: FAIL (coords.ts 未作成)

- [ ] **Step 3: Implement coords helpers**

Create `src/components/Memo/coords.ts`:

```ts
/**
 * Memo 座標変換ヘルパ。
 *
 * LoPo 軽減表は縦軸 = 時間 (Timeline.tsx:789 で y = (time - offsetTime) * pixelsPerSecond)、
 * 横軸 = パーティーメンバー横並び。 メモはシート上の任意 (timeSec, xRatio) に置く。
 *
 * - timeSec: 連続値の秒数 (= 縦座標の絶対値、 ウィンドウ縦サイズ変わっても保たれる)
 * - xRatio:  シート横幅に対する 0.0〜1.0 比率 (= ウィンドウ幅変わっても比例追従)
 */

export interface MemoCoords {
    timeSec: number;
    xRatio: number;
}

/** y 座標 (px) → timeSec。 Timeline.tsx の y = (time - offsetTime) * pixelsPerSecond の逆 */
export function pxToTimeSec(yPx: number, pixelsPerSecond: number, offsetTime: number): number {
    return yPx / pixelsPerSecond + offsetTime;
}

/** timeSec → y 座標 (px)。 Timeline.tsx と同じ計算 */
export function timeSecToPx(timeSec: number, pixelsPerSecond: number, offsetTime: number): number {
    return (timeSec - offsetTime) * pixelsPerSecond;
}

/** x 座標 (px) → xRatio (0〜1) */
export function pxToXRatio(xPx: number, widthPx: number): number {
    if (widthPx <= 0) return 0;
    return xPx / widthPx;
}

/** xRatio (0〜1) → x 座標 (px) */
export function xRatioToPx(xRatio: number, widthPx: number): number {
    return xRatio * widthPx;
}

/** 座標を [0, maxTime] × [0, 1] にクランプ (画面外配置防止) */
export function clampMemoCoords(coords: MemoCoords, maxTime: number): MemoCoords {
    return {
        timeSec: Math.max(0, Math.min(maxTime, coords.timeSec)),
        xRatio: Math.max(0, Math.min(1, coords.xRatio)),
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Memo/__tests__/coords.test.ts`
Expected: PASS (10/10)

- [ ] **Step 5: Commit**

```bash
git add src/components/Memo/coords.ts src/components/Memo/__tests__/coords.test.ts
git commit -m "feat(memo): #57 座標変換ヘルパ (Phase 1 Task 2)"
```

---

### Task 3: useMitigationStore に toolMode + メモ CRUD + AA との排他

**Files:**
- Modify: `src/store/useMitigationStore.ts` (MitigationState interface に追加、 actions 実装)
- Create: `src/store/__tests__/useMitigationStore.memo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/__tests__/useMitigationStore.memo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { MEMO_LIMITS } from '../../types/firebase';

describe('useMitigationStore memo actions', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    useMitigationStore.setState({ memos: [], toolMode: 'idle' });
  });

  it('toolMode 初期値は idle', () => {
    expect(useMitigationStore.getState().toolMode).toBe('idle');
  });

  it('setToolMode("memo") で memo モードに入る', () => {
    useMitigationStore.getState().setToolMode('memo');
    expect(useMitigationStore.getState().toolMode).toBe('memo');
  });

  it('memo モードと aa-placement モードは排他 (memo ON → aa OFF)', () => {
    useMitigationStore.setState({ toolMode: 'aa-placement' });
    useMitigationStore.getState().setToolMode('memo');
    expect(useMitigationStore.getState().toolMode).toBe('memo');
  });

  it('addMemo でメモが追加される', () => {
    useMitigationStore.getState().addMemo({ text: 'テスト', timeSec: 10, xRatio: 0.5 });
    const memos = useMitigationStore.getState().memos;
    expect(memos).toHaveLength(1);
    expect(memos[0].text).toBe('テスト');
    expect(memos[0].timeSec).toBe(10);
    expect(memos[0].xRatio).toBe(0.5);
    expect(memos[0].id).toMatch(/^memo_/);
    expect(memos[0].createdAt).toBeGreaterThan(0);
  });

  it('addMemo は上限 (MAX_MEMOS_PER_PLAN) を超えると false を返す', () => {
    for (let i = 0; i < MEMO_LIMITS.MAX_MEMOS_PER_PLAN; i++) {
      useMitigationStore.getState().addMemo({ text: `m${i}`, timeSec: i, xRatio: 0.5 });
    }
    expect(useMitigationStore.getState().memos).toHaveLength(MEMO_LIMITS.MAX_MEMOS_PER_PLAN);
    const result = useMitigationStore.getState().addMemo({ text: 'overflow', timeSec: 0, xRatio: 0.5 });
    expect(result).toBe(false);
    expect(useMitigationStore.getState().memos).toHaveLength(MEMO_LIMITS.MAX_MEMOS_PER_PLAN);
  });

  it('updateMemo でテキストと座標を変更できる', () => {
    useMitigationStore.getState().addMemo({ text: '元', timeSec: 5, xRatio: 0.1 });
    const id = useMitigationStore.getState().memos[0].id;
    useMitigationStore.getState().updateMemo(id, { text: '変更後', timeSec: 20, xRatio: 0.8 });
    const updated = useMitigationStore.getState().memos[0];
    expect(updated.text).toBe('変更後');
    expect(updated.timeSec).toBe(20);
    expect(updated.xRatio).toBe(0.8);
  });

  it('deleteMemo で指定 id のメモが消える', () => {
    useMitigationStore.getState().addMemo({ text: 'a', timeSec: 1, xRatio: 0.1 });
    useMitigationStore.getState().addMemo({ text: 'b', timeSec: 2, xRatio: 0.2 });
    const idToDelete = useMitigationStore.getState().memos[0].id;
    useMitigationStore.getState().deleteMemo(idToDelete);
    expect(useMitigationStore.getState().memos).toHaveLength(1);
    expect(useMitigationStore.getState().memos[0].text).toBe('b');
  });

  it('deleteAllMemos で全消去', () => {
    useMitigationStore.getState().addMemo({ text: 'a', timeSec: 1, xRatio: 0.1 });
    useMitigationStore.getState().addMemo({ text: 'b', timeSec: 2, xRatio: 0.2 });
    useMitigationStore.getState().deleteAllMemos();
    expect(useMitigationStore.getState().memos).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/useMitigationStore.memo.test.ts`
Expected: FAIL (toolMode / addMemo / updateMemo / deleteMemo / deleteAllMemos 未定義)

- [ ] **Step 3: Add toolMode + memos to MitigationState interface**

In `src/store/useMitigationStore.ts` MitigationState interface (around line 49-78), add:

```ts
    // メモ機能 (#57)
    memos: import('../types').PlanMemo[];
    toolMode: 'idle' | 'aa-placement' | 'memo';
```

And in the actions section:

```ts
    setToolMode: (mode: 'idle' | 'aa-placement' | 'memo') => void;
    addMemo: (input: { text: string; timeSec: number; xRatio: number }) => boolean;
    updateMemo: (id: string, patch: Partial<{ text: string; timeSec: number; xRatio: number }>) => void;
    deleteMemo: (id: string) => void;
    deleteAllMemos: () => void;
```

- [ ] **Step 4: Add initial state and implementations**

In the store factory (`create<MitigationState>(...)((set, get) => ({ ... }))`), add to initial state:

```ts
    memos: [],
    toolMode: 'idle',
```

And add the action implementations (near setAaSettings around line 1128):

```ts
    setToolMode: (mode) => set({ toolMode: mode }),

    addMemo: (input) => {
        const { MEMO_LIMITS } = require('../types/firebase');
        const current = get().memos;
        if (current.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN) return false;
        const now = Date.now();
        const memo = {
            id: `memo_${crypto.randomUUID()}`,
            text: input.text,
            timeSec: input.timeSec,
            xRatio: input.xRatio,
            createdAt: now,
            updatedAt: now,
        };
        set({ memos: [...current, memo] });
        return true;
    },

    updateMemo: (id, patch) => set((state) => ({
        memos: state.memos.map(m =>
            m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
        ),
    })),

    deleteMemo: (id) => set((state) => ({
        memos: state.memos.filter(m => m.id !== id),
    })),

    deleteAllMemos: () => set({ memos: [] }),
```

Replace `require` with proper top-of-file `import`:

```ts
import { MEMO_LIMITS } from '../types/firebase';
```

(And remove the inline require.)

- [ ] **Step 5: Add memos to loadSnapshot/persist**

Find `loadSnapshot` (around line 357) and the persisted snapshot creation (around line 301), add `memos` to both:

```ts
// loadSnapshot 内
memos: snapshot.memos ?? [],

// snapshot 作成側
memos: state.memos,
```

Also add `memos: state.memos` to the persist partialize section (around line 1224).

- [ ] **Step 6: Wire memos to PlanData persistence**

メモは `usePlanStore.updatePlan` 経由で `plan.data.memos` に保存される必要がある。 既に [usePlanStore.ts:151-156](src/store/usePlanStore.ts#L151-L156) の `updatePlan` が `data: PlanData` を merge する形なので、 メモ操作のたびに `usePlanStore.getState().updatePlan(planId, { data: { ...currentData, memos: newMemos }})` を呼ぶ — これは Task 9 で Timeline.tsx 側の dispatcher で実装する。 ここではまず useMitigationStore 自体に持つだけ。

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/store/__tests__/useMitigationStore.memo.test.ts`
Expected: PASS (8/8)

- [ ] **Step 8: Run full type check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.memo.test.ts
git commit -m "feat(memo): #57 useMitigationStore に toolMode + メモ CRUD (Phase 1 Task 3)"
```

---

### Task 4: i18n キー追加 (ja に値、 en/ko/zh は ja コピー)

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

- [ ] **Step 1: Add memo keys to ja.json**

In `src/locales/ja.json`, add a top-level `"memo"` object (alphabetical position, after the existing key that comes before `n*`):

```json
  "memo": {
    "mode_toggle_label": "メモ",
    "mode_toggle_tooltip": "シートにメモを書き込む",
    "floating_bar_count": "メモ {{count}}/{{max}}",
    "floating_bar_exit": "終了 (Esc)",
    "input_placeholder": "メモを入力 (最大 {{max}} 文字)",
    "input_save": "保存",
    "input_cancel": "キャンセル",
    "context_delete": "削除",
    "clear_all_menu_label": "メモを全削除",
    "confirm_clear_all_title": "メモを全削除しますか",
    "confirm_clear_all_body": "{{count}} 件のメモが消えます。 元に戻せません。",
    "confirm_clear_all_ok": "全削除",
    "confirm_clear_all_cancel": "やめる",
    "limit_reached": "メモは最大 {{max}} 件までです"
  },
```

- [ ] **Step 2: Copy the same block (ja values) to en.json / ko.json / zh.json**

各ファイルに同じ block を追加。 翻訳は別タスクで後追い (LoPo の慣行、 memory `feedback_no_hardcoding` ではなく i18n の段階リリース慣行)。

- [ ] **Step 3: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(memo): #57 i18n キー追加 (ja 値、 en/ko/zh は ja コピー先行 Phase 1 Task 4)"
```

---

### Task 5: MemoOverlay (表示のみ、 DnD 後回し)

**Files:**
- Create: `src/components/Memo/MemoOverlay.tsx`
- Create: `src/components/Memo/memo.css`

- [ ] **Step 1: Create memo.css**

`src/components/Memo/memo.css`:

```css
.plan-memo {
    position: absolute;
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text, #fff);
    opacity: 1;
    mix-blend-mode: difference;
    pointer-events: auto;
    user-select: none;
    max-width: 200px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.4;
    transform: translate(-50%, 0);
    z-index: 15;
}

.plan-memo--dragging {
    opacity: 0.6;
    cursor: grabbing;
}

.plan-memo--readonly {
    pointer-events: none;
}

@media (max-width: 767px) {
    /* スマホ: メモは表示するが、 編集操作は無効 (pointer-events: none) */
    .plan-memo {
        pointer-events: none;
    }
}
```

- [ ] **Step 2: Create MemoOverlay.tsx (表示のみ)**

`src/components/Memo/MemoOverlay.tsx`:

```tsx
import React from 'react';
import clsx from 'clsx';
import type { PlanMemo } from '../../types';
import { timeSecToPx, xRatioToPx } from './coords';
import './memo.css';

interface MemoOverlayProps {
    memos: PlanMemo[];
    pixelsPerSecond: number;
    offsetTime: number;
    sheetWidth: number;
    /** メモモード ON 中は touchable、 OFF 中は readonly */
    interactive: boolean;
    /** クリック時 (= 編集モーダル起動)、 Task 12 で実装 */
    onMemoClick?: (memo: PlanMemo) => void;
}

export const MemoOverlay: React.FC<MemoOverlayProps> = ({
    memos,
    pixelsPerSecond,
    offsetTime,
    sheetWidth,
    interactive,
    onMemoClick,
}) => {
    return (
        <>
            {memos.map(memo => {
                const top = timeSecToPx(memo.timeSec, pixelsPerSecond, offsetTime);
                const left = xRatioToPx(memo.xRatio, sheetWidth);
                return (
                    <div
                        key={memo.id}
                        className={clsx('plan-memo', !interactive && 'plan-memo--readonly')}
                        style={{ top: `${top}px`, left: `${left}px` }}
                        onClick={interactive ? () => onMemoClick?.(memo) : undefined}
                    >
                        {memo.text}
                    </div>
                );
            })}
        </>
    );
};
```

- [ ] **Step 3: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Memo/MemoOverlay.tsx src/components/Memo/memo.css
git commit -m "feat(memo): #57 MemoOverlay 表示のみ実装 (Phase 1 Task 5)"
```

---

### Task 6: MemoInputBox (新規作成、 100 文字上限)

**Files:**
- Create: `src/components/Memo/MemoInputBox.tsx`

- [ ] **Step 1: Implement MemoInputBox**

`src/components/Memo/MemoInputBox.tsx`:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMO_LIMITS } from '../../types/firebase';

interface MemoInputBoxProps {
    /** 配置位置 (シート相対 px) */
    topPx: number;
    leftPx: number;
    /** 既存メモを編集中なら初期値、 新規なら空 */
    initialText?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
}

export const MemoInputBox: React.FC<MemoInputBoxProps> = ({
    topPx,
    leftPx,
    initialText = '',
    onSave,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [text, setText] = useState(initialText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSave = () => {
        onSave(text.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    return (
        <div
            className="absolute z-30 bg-app-surface border border-app-border rounded p-2 shadow-lg flex flex-col gap-1"
            style={{ top: `${topPx}px`, left: `${leftPx}px`, width: 220 }}
            onClick={(e) => e.stopPropagation()}
        >
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MEMO_LIMITS.MAX_TEXT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t('memo.input_placeholder', { max: MEMO_LIMITS.MAX_TEXT_LENGTH })}
                className="bg-app-bg text-app-text text-app-sm px-2 py-1 rounded border border-app-border resize-none"
                rows={3}
                maxLength={MEMO_LIMITS.MAX_TEXT_LENGTH}
            />
            <div className="flex justify-end gap-1 text-app-xs">
                <span className="text-app-text-muted self-center mr-auto">
                    {text.length}/{MEMO_LIMITS.MAX_TEXT_LENGTH}
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-2 py-0.5 rounded hover:bg-app-surface2 text-app-text-muted"
                >
                    {t('memo.input_cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="px-2 py-0.5 rounded bg-app-blue text-white hover:bg-app-blue/80"
                >
                    {t('memo.input_save')}
                </button>
            </div>
        </div>
    );
};
```

- [ ] **Step 2: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Memo/MemoInputBox.tsx
git commit -m "feat(memo): #57 MemoInputBox 入力 UI (Phase 1 Task 6)"
```

---

### Task 7: MemoFloatingBar (count + Exit)

**Files:**
- Create: `src/components/Memo/MemoFloatingBar.tsx`

- [ ] **Step 1: Implement MemoFloatingBar**

`src/components/Memo/MemoFloatingBar.tsx`:

```tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MEMO_LIMITS } from '../../types/firebase';

interface MemoFloatingBarProps {
    memoCount: number;
    onExit: () => void;
}

export const MemoFloatingBar: React.FC<MemoFloatingBarProps> = ({ memoCount, onExit }) => {
    const { t } = useTranslation();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onExit();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onExit]);

    return createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-app-surface border border-app-border rounded-full shadow-lg px-4 py-2 flex items-center gap-3 text-app-sm">
            <Pencil size={14} className="text-app-text" />
            <span className="font-medium">
                {t('memo.floating_bar_count', { count: memoCount, max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN })}
            </span>
            <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-app-surface2 text-app-text-muted"
            >
                <X size={12} />
                {t('memo.floating_bar_exit')}
            </button>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Memo/MemoFloatingBar.tsx
git commit -m "feat(memo): #57 MemoFloatingBar (Phase 1 Task 7)"
```

---

### Task 8: Timeline.tsx に鉛筆アイコン + メモモード切替 (排他)

**Files:**
- Modify: `src/components/Timeline.tsx` (around line 2026, AASettingsPopover の直後に鉛筆ボタン追加)

- [ ] **Step 1: Add toolMode hook + memo count to component**

Timeline.tsx の `canUndo` 取得部 ([Timeline.tsx:567](src/components/Timeline.tsx#L567)) と同じあたりに追加:

```ts
const toolMode = useMitigationStore(s => s.toolMode);
const memos = useMitigationStore(s => s.memos);
const isMemoMode = toolMode === 'memo';
```

- [ ] **Step 2: Add Pencil button after AASettingsPopover block ([Timeline.tsx:2036](src/components/Timeline.tsx#L2036) 直後)**

```tsx
{/* メモモード切替 — AA 追加モードと同じパターン、 PC のみテキスト */}
<div className="relative hidden md:flex items-center">
    <button
        type="button"
        onClick={() => {
            useMitigationStore.getState().setToolMode(isMemoMode ? 'idle' : 'memo');
        }}
        title={t('memo.mode_toggle_tooltip')}
        className={clsx(
            "group/btn flex items-center gap-1 px-2 py-1 rounded transition-all duration-150 cursor-pointer",
            isMemoMode
                ? "bg-app-blue/15 text-app-blue"
                : "text-app-text hover:bg-app-surface2"
        )}
    >
        <Pencil size={14} className="transition-transform duration-300 group-hover/btn:scale-110 shrink-0" />
        <span className="font-black text-app-base uppercase tracking-wider hidden md:block">{t('memo.mode_toggle_label')}</span>
    </button>
</div>
```

スマホ非対応: `hidden md:flex` でボタン自体を非表示。

- [ ] **Step 3: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Visual check (実機 PC で鉛筆アイコン表示確認のみ、 動作はまだ)**

```bash
npm run dev
```

ブラウザで `/` を開き、 軽減表ツールバーに鉛筆アイコンが AA ボタンの隣に表示されることを目視。 クリックでハイライト切り替わることを確認 (まだメモは置けない)。

- [ ] **Step 5: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(memo): #57 Timeline 鉛筆アイコン + メモモード切替 (Phase 1 Task 8)"
```

---

### Task 9: Timeline.tsx で MemoOverlay + シートクリック → 新規作成

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: Import MemoOverlay / MemoInputBox / MemoFloatingBar / coords**

Timeline.tsx 先頭の import 群に追加:

```ts
import { MemoOverlay } from './Memo/MemoOverlay';
import { MemoInputBox } from './Memo/MemoInputBox';
import { MemoFloatingBar } from './Memo/MemoFloatingBar';
import { pxToTimeSec, pxToXRatio, clampMemoCoords } from './Memo/coords';
import { MEMO_LIMITS } from '../types/firebase';
```

- [ ] **Step 2: Add input box state**

`toolMode` 取得した近くに追加:

```ts
const [memoInput, setMemoInput] = useState<{
    topPx: number;
    leftPx: number;
    timeSec: number;
    xRatio: number;
    editingId?: string;
    initialText?: string;
} | null>(null);
const sheetContainerRef = useRef<HTMLDivElement>(null);
```

`sheetContainerRef` は MemoOverlay と click handler 配置用のラッパー要素に付ける。 シート本体の `<div>` で既に ref がある場合はそれを利用 (例: `scrollContainerRef` または `timelineGridRef` 等)。 該当 ref が無ければ新規追加し、 既存シート描画 div に付与。

- [ ] **Step 3: Implement memo sheet click handler**

```ts
const handleSheetClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMemoMode) return;
    // 既存メモやボタンの上をクリックした時は無視 (currentTarget でなく target を見る)
    if (e.target !== e.currentTarget) return;
    if (memos.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN) {
        showToast(t('memo.limit_reached', { max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN }));
        return;
    }
    const rect = sheetContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top + (scrollContainerRef.current?.scrollTop ?? 0);
    const offsetTime = showPreStart ? -10 : 0;
    const { timeSec, xRatio } = clampMemoCoords({
        timeSec: pxToTimeSec(yPx, pixelsPerSecond, offsetTime),
        xRatio: pxToXRatio(xPx, rect.width),
    }, maxTime);
    setMemoInput({ topPx: yPx, leftPx: xPx, timeSec, xRatio });
}, [isMemoMode, memos.length, showPreStart, pixelsPerSecond, maxTime, t]);
```

`showToast` import を確認: `import { showToast } from './Toast';` が既にあるはず、 なければ追加。

- [ ] **Step 4: Wire memo save → store.addMemo + usePlanStore.updatePlan**

```ts
const handleMemoSave = useCallback((text: string) => {
    if (!memoInput) return;
    if (!text) {
        // 新規で空文字 → 何もしない (削除でもない、 そもそも追加されてない)
        setMemoInput(null);
        return;
    }
    const ok = useMitigationStore.getState().addMemo({
        text,
        timeSec: memoInput.timeSec,
        xRatio: memoInput.xRatio,
    });
    if (!ok) {
        showToast(t('memo.limit_reached', { max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN }));
    } else {
        // PlanData.memos へ反映 (markDirty 経由)
        const planId = usePlanStore.getState().currentPlanId;
        if (planId) {
            const newMemos = useMitigationStore.getState().memos;
            const plan = usePlanStore.getState().getPlan(planId);
            if (plan) {
                usePlanStore.getState().updatePlan(planId, {
                    data: { ...plan.data, memos: newMemos },
                });
            }
        }
    }
    setMemoInput(null);
}, [memoInput, t]);
```

- [ ] **Step 5: Render MemoOverlay + MemoInputBox + MemoFloatingBar in JSX**

シート本体の `<div>` (= sheetContainerRef を持つ要素) に `onClick={handleSheetClick}` を付け、 中に MemoOverlay を絶対配置:

```tsx
<div ref={sheetContainerRef} onClick={handleSheetClick} className="relative ...">
    {/* 既存のシート描画 */}
    ...
    <MemoOverlay
        memos={memos}
        pixelsPerSecond={pixelsPerSecond}
        offsetTime={showPreStart ? -10 : 0}
        sheetWidth={sheetContainerRef.current?.getBoundingClientRect().width ?? 0}
        interactive={isMemoMode}
    />
    {memoInput && (
        <MemoInputBox
            topPx={memoInput.topPx}
            leftPx={memoInput.leftPx}
            initialText={memoInput.initialText}
            onSave={handleMemoSave}
            onCancel={() => setMemoInput(null)}
        />
    )}
</div>
{isMemoMode && (
    <MemoFloatingBar
        memoCount={memos.length}
        onExit={() => useMitigationStore.getState().setToolMode('idle')}
    />
)}
```

(=実装は既存 Timeline.tsx の JSX 構造に合わせて、 シート本体の最外側 div または `relative` を持つ wrapper に統合する)

- [ ] **Step 6: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(memo): #57 Timeline メモ表示 + 新規作成配線 (Phase 1 Task 9)"
```

---

### Task 10: Phase 1 実機検証 + Phase 1 完了 push

- [ ] **Step 1: Build + test all**

Run:
```bash
npm run build
npx vitest run
```
Expected: 両方 PASS

- [ ] **Step 2: Local dev server で実機検証 (memory `feedback_endpoint_user_verification`)**

```bash
npm run dev
```

ブラウザで `/` を開き、 ログイン状態でプランを 1 つ開く:

- [ ] 鉛筆アイコンが AA ボタンの隣に表示される (PC)
- [ ] 鉛筆クリック → メモモード ON、 下部にフローティングバー「メモ 0/100 終了 (Esc)」 表示
- [ ] AA モード ON 中に鉛筆クリック → AA 自動 OFF + メモ ON (排他)
- [ ] シート空白クリック → 入力ボックス、 「テスト」 と入力して保存 → メモが表示される
- [ ] フローティングバーの「終了 (Esc)」 でメモモード OFF、 メモは見えたまま (但しクリックしても反応しない)
- [ ] ブラウザリロード → メモが残っている
- [ ] 5 分以上待つ or タブ切替 → Firestore に同期される (devtools の Network で確認可)
- [ ] スマホサイズ (viewport 767px 以下) で鉛筆ボタンが消え、 既存メモは見えたまま

- [ ] **Step 3: 既存プラン破壊なし確認**

- [ ] メモ追加していない既存プランを開いて軽減表が壊れないこと
- [ ] AA モードが従来どおり動くこと
- [ ] Undo/Redo がメモ操作と関係なく動くこと

- [ ] **Step 4: Push + 本番デプロイ確認**

```bash
git push
```

Vercel 自動デプロイ (memory `reference_vercel_git_autodeploy`) 完了後、 lopoly.app で同じ実機検証を 1 回:

- [ ] 本番でメモが置ける
- [ ] 本番で Firestore に同期される (別端末ログイン → 同じメモが見える)

---

## Phase 2: DnD + 編集 + 右クリック削除

### Task 11: MemoOverlay に DnD 実装 (pointer events)

**Files:**
- Modify: `src/components/Memo/MemoOverlay.tsx`
- Modify: `src/components/Timeline.tsx` (DnD 完了時の updateMemo + planStore 反映)

- [ ] **Step 1: Extend MemoOverlay props with onDragEnd**

`MemoOverlayProps` に追加:

```ts
onMemoDragEnd?: (id: string, newCoords: { timeSec: number; xRatio: number }) => void;
pixelsPerSecond, offsetTime, sheetWidth はそのまま (= clientX/Y → 比率変換のため)
maxTime: number; // clamp 用
```

- [ ] **Step 2: Implement pointer DnD inside MemoOverlay**

`MemoOverlay.tsx` の memo 描画部を `<div>` から DnD-aware にする:

```tsx
import { pxToTimeSec, pxToXRatio, clampMemoCoords } from './coords';

const [draggingId, setDraggingId] = useState<string | null>(null);
const dragStateRef = useRef<{ id: string; startX: number; startY: number; origLeft: number; origTop: number } | null>(null);

const handlePointerDown = (e: React.PointerEvent, memo: PlanMemo) => {
    if (!interactive) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const top = timeSecToPx(memo.timeSec, pixelsPerSecond, offsetTime);
    const left = xRatioToPx(memo.xRatio, sheetWidth);
    dragStateRef.current = {
        id: memo.id,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: left,
        origTop: top,
    };
    setDraggingId(memo.id);
};

const handlePointerMove = (e: React.PointerEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const newLeft = s.origLeft + dx;
    const newTop = s.origTop + dy;
    // 視覚的に追従させるため inline style を書き換える (React state 更新は pointerup でのみ)
    const el = document.querySelector(`[data-memo-id="${s.id}"]`) as HTMLElement;
    if (el) {
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
    }
};

const handlePointerUp = (e: React.PointerEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const newLeft = s.origLeft + dx;
    const newTop = s.origTop + dy;
    const offsetTimeVal = offsetTime;
    const coords = clampMemoCoords({
        timeSec: pxToTimeSec(newTop, pixelsPerSecond, offsetTimeVal),
        xRatio: pxToXRatio(newLeft, sheetWidth),
    }, maxTime);
    onMemoDragEnd?.(s.id, coords);
    dragStateRef.current = null;
    setDraggingId(null);
};
```

各 memo の `<div>` に:

```tsx
<div
    key={memo.id}
    data-memo-id={memo.id}
    className={clsx('plan-memo', draggingId === memo.id && 'plan-memo--dragging', !interactive && 'plan-memo--readonly')}
    style={{ top: `${top}px`, left: `${left}px` }}
    onPointerDown={(e) => handlePointerDown(e, memo)}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onClick={interactive && !dragStateRef.current ? () => onMemoClick?.(memo) : undefined}
>
    {memo.text}
</div>
```

- [ ] **Step 3: Wire onMemoDragEnd in Timeline.tsx**

Timeline.tsx の MemoOverlay 描画に prop 追加:

```tsx
<MemoOverlay
    ...
    maxTime={maxTime}
    onMemoDragEnd={(id, coords) => {
        useMitigationStore.getState().updateMemo(id, coords);
        const planId = usePlanStore.getState().currentPlanId;
        if (planId) {
            const newMemos = useMitigationStore.getState().memos;
            const plan = usePlanStore.getState().getPlan(planId);
            if (plan) {
                usePlanStore.getState().updatePlan(planId, {
                    data: { ...plan.data, memos: newMemos },
                });
            }
        }
    }}
/>
```

- [ ] **Step 4: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 実機検証 — メモを掴んでドラッグできること、 ドラッグ中だけ opacity 0.6**

```bash
npm run dev
```

- [ ] メモをマウスで掴むと cursor が grabbing、 opacity 0.6
- [ ] ドラッグ中、 マウス追従で位置が変わる
- [ ] pointerup で位置確定、 opacity 1 に戻る
- [ ] リロード → 確定後の位置で残っている

- [ ] **Step 6: Commit**

```bash
git add src/components/Memo/MemoOverlay.tsx src/components/Timeline.tsx
git commit -m "feat(memo): #57 MemoOverlay DnD (pointer events 自作 Phase 2 Task 11)"
```

---

### Task 12: メモクリック → 編集モーダル + 空文字確定で削除

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: Wire onMemoClick → open MemoInputBox in edit mode**

Timeline.tsx の `handleMemoClick`:

```ts
const handleMemoClick = useCallback((memo: PlanMemo) => {
    if (!isMemoMode) return;
    const offsetTime = showPreStart ? -10 : 0;
    const top = timeSecToPx(memo.timeSec, pixelsPerSecond, offsetTime);
    const rect = sheetContainerRef.current?.getBoundingClientRect();
    const left = xRatioToPx(memo.xRatio, rect?.width ?? 0);
    setMemoInput({
        topPx: top,
        leftPx: left,
        timeSec: memo.timeSec,
        xRatio: memo.xRatio,
        editingId: memo.id,
        initialText: memo.text,
    });
}, [isMemoMode, showPreStart, pixelsPerSecond]);
```

MemoOverlay の `onMemoClick={handleMemoClick}` に接続。

- [ ] **Step 2: Update handleMemoSave to handle edit + delete branches**

```ts
const handleMemoSave = useCallback((text: string) => {
    if (!memoInput) return;
    const planId = usePlanStore.getState().currentPlanId;
    const trimmed = text.trim();

    if (memoInput.editingId) {
        // 編集モード
        if (!trimmed) {
            // 空文字確定 = 削除 (確認なし、 spec §4.5)
            useMitigationStore.getState().deleteMemo(memoInput.editingId);
        } else {
            useMitigationStore.getState().updateMemo(memoInput.editingId, {
                text: trimmed,
            });
        }
    } else {
        // 新規作成
        if (!trimmed) {
            setMemoInput(null);
            return;
        }
        const ok = useMitigationStore.getState().addMemo({
            text: trimmed,
            timeSec: memoInput.timeSec,
            xRatio: memoInput.xRatio,
        });
        if (!ok) {
            showToast(t('memo.limit_reached', { max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN }));
            setMemoInput(null);
            return;
        }
    }

    // PlanData 反映 + markDirty
    if (planId) {
        const newMemos = useMitigationStore.getState().memos;
        const plan = usePlanStore.getState().getPlan(planId);
        if (plan) {
            usePlanStore.getState().updatePlan(planId, {
                data: { ...plan.data, memos: newMemos },
            });
        }
    }
    setMemoInput(null);
}, [memoInput, t]);
```

- [ ] **Step 3: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 実機検証**

```bash
npm run dev
```

- [ ] 既存メモをクリック → 入力ボックスが既存テキストで開く
- [ ] テキストを変更して保存 → 表示が更新される
- [ ] テキストを空にして保存 → メモが消える
- [ ] リロード → 変更が残っている

- [ ] **Step 5: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(memo): #57 メモ編集 + 空文字確定で削除 (Phase 2 Task 12)"
```

---

### Task 13: 右クリック → コンテキストメニュー「削除」

**Files:**
- Modify: `src/components/Memo/MemoOverlay.tsx` (右クリックハンドラ追加)
- Modify: `src/components/Timeline.tsx` (onMemoDelete prop 配線)

- [ ] **Step 1: Add onMemoDelete prop to MemoOverlay**

`MemoOverlayProps` に追加:

```ts
onMemoDelete?: (id: string) => void;
```

memo の `<div>` に:

```tsx
onContextMenu={(e) => {
    if (!interactive) return;
    e.preventDefault();
    onMemoDelete?.(memo.id);
}}
```

仕様 §4.5: 1 件削除は誤操作リスク低なので確認ダイアログなし。 右クリック即削除。

- [ ] **Step 2: Wire in Timeline.tsx**

```tsx
<MemoOverlay
    ...
    onMemoDelete={(id) => {
        useMitigationStore.getState().deleteMemo(id);
        const planId = usePlanStore.getState().currentPlanId;
        if (planId) {
            const newMemos = useMitigationStore.getState().memos;
            const plan = usePlanStore.getState().getPlan(planId);
            if (plan) {
                usePlanStore.getState().updatePlan(planId, {
                    data: { ...plan.data, memos: newMemos },
                });
            }
        }
    }}
/>
```

- [ ] **Step 3: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 実機検証**

- [ ] メモを右クリック → ブラウザのコンテキストメニューは出ず、 メモが即削除される
- [ ] リロード → 削除が残っている
- [ ] AA アイコンの右クリック (= 既存挙動) と衝突しないこと

- [ ] **Step 5: Commit**

```bash
git add src/components/Memo/MemoOverlay.tsx src/components/Timeline.tsx
git commit -m "feat(memo): #57 メモ右クリック削除 (Phase 2 Task 13)"
```

---

### Task 14: Phase 2 実機検証 + push

- [ ] **Step 1: Build + test all**

Run:
```bash
npm run build
npx vitest run
```
Expected: 両方 PASS

- [ ] **Step 2: Phase 2 ゴールデンパス実機検証**

- [ ] 新規メモ作成 → ドラッグして移動 → クリックで編集 → 右クリックで削除 を 1 通り
- [ ] AA モード ↔ メモモード 切替が排他で動く
- [ ] 共有 URL を発行 → 別ブラウザで開いてメモが見える (snapshot)

- [ ] **Step 3: Push**

```bash
git push
```

---

## Phase 3: ゴミ箱メニュー + 上限警告 + 確認ダイアログ

### Task 15: ClearMitigationsPopover に「メモを全削除」 メニュー追加

**Files:**
- Modify: `src/components/ClearMitigationsPopover.tsx`

- [ ] **Step 1: Read existing structure**

[ClearMitigationsPopover.tsx](src/components/ClearMitigationsPopover.tsx) は現在「軽減を全削除」 等のメニュー項目を縦に並べている (要素は実装時に確認)。 そこに「メモを全削除」 を追加する。

- [ ] **Step 2: Add memo count + delete handler props (or read directly from store)**

ClearMitigationsPopover の中で:

```ts
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';

const memos = useMitigationStore(s => s.memos);
const memoCount = memos.length;

const handleClearAllMemos = () => {
    onClose();
    setConfirmDialog({
        title: t('memo.confirm_clear_all_title'),
        body: t('memo.confirm_clear_all_body', { count: memoCount }),
        confirmLabel: t('memo.confirm_clear_all_ok'),
        cancelLabel: t('memo.confirm_clear_all_cancel'),
        onConfirm: () => {
            useMitigationStore.getState().deleteAllMemos();
            const planId = usePlanStore.getState().currentPlanId;
            if (planId) {
                const plan = usePlanStore.getState().getPlan(planId);
                if (plan) {
                    usePlanStore.getState().updatePlan(planId, {
                        data: { ...plan.data, memos: [] },
                    });
                }
            }
        },
    });
};
```

`setConfirmDialog` の構造は ClearMitigationsPopover の既存使い方に合わせる (実装時に既存「軽減を全削除」 の confirm 実装を参照して同じ API を使う)。

- [ ] **Step 3: Add menu item in JSX**

Popover 内の既存メニュー項目リストに追加 (memoCount > 0 のときのみ有効):

```tsx
<button
    type="button"
    onClick={handleClearAllMemos}
    disabled={memoCount === 0}
    className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 rounded text-left text-app-sm",
        memoCount > 0
            ? "hover:bg-red-500/10 text-app-text hover:text-red-400 cursor-pointer"
            : "text-app-text-muted cursor-not-allowed"
    )}
>
    <Pencil size={14} />
    <span>{t('memo.clear_all_menu_label')}</span>
    <span className="ml-auto text-app-text-muted text-app-xs">{memoCount}</span>
</button>
```

`Pencil` import 追加。

- [ ] **Step 4: TypeScript build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 実機検証**

- [ ] ゴミ箱ボタン → Popover に「メモを全削除」 項目が表示される
- [ ] メモ 0 件のとき項目が非活性
- [ ] メモあるとき項目クリック → 確認ダイアログ「メモを全削除しますか N 件のメモが消えます…」
- [ ] OK → 全メモ消える、 リロード後も残らない
- [ ] キャンセル → 何もしない

- [ ] **Step 6: Commit**

```bash
git add src/components/ClearMitigationsPopover.tsx
git commit -m "feat(memo): #57 ClearMitigationsPopover にメモ全削除メニュー (Phase 3 Task 15)"
```

---

### Task 16: 上限警告 toast (新規作成時 100 件超え)

すでに Task 9 の `handleSheetClick` 内で `memos.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN` 時に `showToast(t('memo.limit_reached'))` を呼んでいる。 念のためここで確認。

- [ ] **Step 1: 実機で 100 件メモを置いて 101 件目で toast 表示確認**

```bash
npm run dev
```

- [ ] 100 件メモを置く (テストプランで作業)
- [ ] 101 件目を置こうとシートクリック → toast「メモは最大 100 件までです」 表示
- [ ] フローティングバーの count 表示が「メモ 100/100」 になっている

- [ ] **Step 2: Commit if any tweaks were needed**

(変更なしなら commit 不要、 ある場合)
```bash
git commit -m "fix(memo): #57 上限警告 toast 表示 (Phase 3 Task 16)"
```

---

### Task 17: Phase 3 最終確認 + Done 条件チェック + push

- [ ] **Step 1: Build + test all**

```bash
npm run build
npx vitest run
```
Expected: 両方 PASS

- [ ] **Step 2: spec §13 Done 条件を 1 つずつチェック**

- [ ] `PlanData.memos[]` 型 + `MEMO_LIMITS` 定数導入、 既存プランが壊れない
- [ ] 鉛筆アイコンが PC 軽減表ツールバーに表示、 スマホでは非表示
- [ ] メモモード ON でシートをクリック → 入力ボックス → Save でメモ確定
- [ ] DnD で位置変更、 pointerup で markDirty、 ドラッグ中だけ opacity 0.6
- [ ] 右クリック削除 / 空文字確定削除 / ClearMitigationsPopover の「メモを全削除」 (確認あり) の 3 経路
- [ ] AA 追加モードとの排他 (両方 ON にできない)
- [ ] 共有 URL で snapshot に memos が乗る
- [ ] 4 言語 i18n キー追加 (ja に値、 en/ko/zh は ja コピーで先行)
- [ ] `npm run build` + `npx vitest run` がパスする
- [ ] 本番 (lopoly.app) で実機ゴールデンパス確認

- [ ] **Step 3: §12 残リスクの実機検証**

- [ ] `mix-blend-mode: difference` の見え方を実機 (glassmorphism 背景) で確認、 読みづらければ代替案 (screen/overlay) に切替
- [ ] シート最終秒を超えた timeSec のメモが clamp で内側に収まる

- [ ] **Step 4: Push + 本番デプロイ**

```bash
git push
```

Vercel 自動デプロイ完了後、 lopoly.app で同じゴールデンパスを通す。

- [ ] **Step 5: docs/TODO.md 更新 + #57 完了マーク**

`docs/TODO.md` の「現在の状態」 を #57 完了に更新、 完了タスクは `docs/TODO_COMPLETED.md` へ移動。

- [ ] **Step 6: 完了 commit**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md
git commit -m "docs(todo): #57 軽減表メモ機能 v1 完了"
git push
```

---

## Phase 4 (後追い): en/ko/zh 翻訳

i18n キーは Phase 1 Task 4 で ja コピーが入っている。 後日翻訳タスクで `memo.*` キーを正式翻訳に置き換える (LoPo の通常 i18n 後追い慣行)。

---

## 全体ノート

- **vitest 実行**: `npx vitest run` 推奨 (`memory reference_vitest_vmthreads_hang`)。 パイプ禁止、 ファイル出力で受ける場合は `--reporter=verbose > /tmp/vitest.log 2>&1`
- **build 確認**: 各 task 終わりで `npm run build` を必ず通す (memory `feedback_vercel_tsc_strict`)
- **commit 粒度**: 各 task 単位で commit、 Phase 完了で push (Vercel Hobby ビルド枠節約、 memory `feedback_vercel_builds`)
- **デプロイ**: `git push main` で lopoly.app 自動反映 (memory `reference_vercel_git_autodeploy`)、 手動 `vercel --prod` 不要
- **メモテストデータ**: テスト用プランで作業し、 本番ユーザーのプランは触らない (memory `feedback_housing_data_disposable` 同思想)
