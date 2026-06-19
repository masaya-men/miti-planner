# 進捗詳細パネル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 記録ドロワーにシェブロンで開く「進捗詳細パネル」（到達点の履歴・ひとことメモ・個別削除＋全消去）を追加し、進捗HUDを完成させる。

**Architecture:** 既存の進捗ストア（`useMitigationStore.progress.points`）に `note?` を足し、表示・整形の純粋関数を `progressLogic.ts` に追加。プレゼン用の行コンポーネント（`ProgressHistoryRow`）と、ストアを束ねるパネル（`ProgressDetailPanel`）を新設し、`ProgressRecordPanel` から開閉する。削除は即時＋インラインUndo、全消去は既存 `ConfirmDialog`。

**Tech Stack:** React + TypeScript / Zustand / react-i18next / vitest + @testing-library/react（happy-dom）/ lucide-react。

設計書: [docs/superpowers/specs/2026-06-19-progress-detail-panel-design.md](../specs/2026-06-19-progress-detail-panel-design.md)

## Global Constraints

- **言語**: コード内コメント・ドキュメントは日本語（CLAUDE.md）。
- **i18n**: UI文言は必ず `t('progress.xxx', '日本語デフォルト')` 経由。4言語（ja/en/ko/zh）必須。interpolation は i18next の `{{var}}` 形式（`{n}` はトーストアニメ専用なので使わない）。
- **CSS**: 色・フォントサイズはトークン経由（`--app-blue` / `--app-red` 等）。ハードコード hex 禁止。`backdrop-filter` 直書き禁止。
- **データロスト防止**: 表示は新しい順だが `progress.points` は時系列（追記）順で保存。削除・メモ更新・Undo は**必ず points 配列内の実 index** を使う（表示順インデックスを渡さない）。
- **collab readonly ガード**: 進捗を書き換えるストアアクションは全て `if (get()._collabReadonly && !get()._collabActive) return;` を先頭に置く（既存パターン）。
- **テスト実行**: `npx vitest run <file>`（watch 禁止・出力をパイプしない。memory `reference_vitest_vmthreads_hang`）。型チェックは `npm run build`。
- **コミット**: 各コミットメッセージ末尾に必ず
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を付ける（以降の commit 手順では省略表記するが必ず付与）。RTK 環境のため `git` は `rtk git` で実行してよい。
- **進捗は共有されない**: `progress` は共有/コピー時に `stripSharedPersonalData` で丸ごと除去済み（監査済）。`note` を足してもプライバシー面の新規リスクは無い。

---

## File Structure

- `src/types/index.ts` — `ProgressPoint.note?` 追加（Task 1）
- `src/lib/progressLogic.ts` — 純粋関数追加: `insertProgressPoint` / `phaseAtTime` / `pointPercent` / `formatClock` / `formatTimeOfDay` / `formatMonthDay` / `dayBucket`（Task 1）
- `src/lib/__tests__/progressLogic.test.ts` — 上記のテスト（Task 1）
- `src/store/useMitigationStore.ts` — アクション追加: `setProgressPointNote` / `clearAllProgressPoints` / `insertProgressPointAt`（Task 2）
- `src/store/__tests__/useMitigationStore.progress.test.ts` — ストアアクションのテスト（Task 2・新規）
- `src/components/progress/ProgressHistoryRow.tsx` — 1行（プレゼン＋メモ編集）（Task 3・新規）
- `src/components/progress/__tests__/ProgressHistoryRow.test.tsx` — 行テスト（Task 3・新規）
- `src/components/progress/ProgressDetailPanel.tsx` — パネル本体（Task 4・新規）
- `src/components/progress/__tests__/ProgressDetailPanel.test.tsx` — パネルテスト（Task 4・新規）
- `src/components/progress/ProgressRecordPanel.tsx` — シェブロン＋開閉＋パネル描画（Task 5）
- `src/locales/{ja,en,ko,zh}.json` — i18n キー（Task 6）

---

## Task 1: 型変更 + 純粋ロジック（progressLogic）

**Files:**
- Modify: `src/types/index.ts:241-246`（ProgressPoint）
- Modify: `src/lib/progressLogic.ts`（関数追加・末尾）
- Test: `src/lib/__tests__/progressLogic.test.ts`（追記）

**Interfaces:**
- Produces:
  - `ProgressPoint` に `note?: string`
  - `insertProgressPoint(list: ProgressPoint[] | undefined, index: number, point: ProgressPoint): ProgressPoint[]`
  - `phaseAtTime(phases: { name: LocalizedString; startTime: number }[], sec: number): { name: LocalizedString } | null`
  - `pointPercent(reachedPos: number, totalSec: number): number`
  - `formatClock(sec: number): string`（"m:ss"）
  - `formatTimeOfDay(ts: number): string`（JST "H:MM"）
  - `formatMonthDay(ts: number): string`（JST "M/D"）
  - `dayBucket(ts: number, nowTs: number): 'today' | 'yesterday' | 'older'`

- [ ] **Step 1: 型に note を追加**

`src/types/index.ts` の `ProgressPoint` を次に変更:

```ts
export interface ProgressPoint {
    /** 記録時刻 (epoch ms)。並び順 = クリック順 / 日付ラベルの算出に使う */
    ts: number;
    /** その時クリックした到達点。タイムライン上の秒位置 */
    reachedPos: number;
    /** 任意のひとことメモ。未設定は undefined（共有時は progress ごと除去され他人に渡らない） */
    note?: string;
}
```

- [ ] **Step 2: 失敗するテストを書く（純粋関数まとめて）**

`src/lib/__tests__/progressLogic.test.ts` の末尾に追記。先頭の import 行に新関数を足す:

```ts
import {
  insertProgressPoint, phaseAtTime, pointPercent,
  formatClock, formatTimeOfDay, formatMonthDay, dayBucket,
} from '../progressLogic';
import type { LocalizedString } from '../../types';
```

末尾に追記:

```ts
describe('insertProgressPoint', () => {
  it('指定 index に挿入し順序を保つ（Undo復元用）', () => {
    const base = [{ ts: 1, reachedPos: 10 }, { ts: 3, reachedPos: 30 }];
    expect(insertProgressPoint(base, 1, { ts: 2, reachedPos: 20 }))
      .toEqual([{ ts: 1, reachedPos: 10 }, { ts: 2, reachedPos: 20 }, { ts: 3, reachedPos: 30 }]);
  });
  it('範囲外 index はクランプ（末尾/先頭）', () => {
    expect(insertProgressPoint([{ ts: 1, reachedPos: 1 }], 99, { ts: 2, reachedPos: 2 }))
      .toEqual([{ ts: 1, reachedPos: 1 }, { ts: 2, reachedPos: 2 }]);
  });
  it('元配列を破壊しない / undefined 安全', () => {
    const base = [{ ts: 1, reachedPos: 1 }];
    insertProgressPoint(base, 0, { ts: 9, reachedPos: 9 });
    expect(base).toEqual([{ ts: 1, reachedPos: 1 }]);
    expect(insertProgressPoint(undefined, 0, { ts: 1, reachedPos: 1 })).toEqual([{ ts: 1, reachedPos: 1 }]);
  });
});

describe('phaseAtTime', () => {
  const phases = [
    { name: { ja: 'P1' } as LocalizedString, startTime: 0 },
    { name: { ja: 'P2' } as LocalizedString, startTime: 100 },
    { name: { ja: 'P3' } as LocalizedString, startTime: 200 },
  ];
  it('sec を含むフェーズ（startTime<=sec の最後）を返す', () => {
    expect(phaseAtTime(phases, 150)?.name).toEqual({ ja: 'P2' });
    expect(phaseAtTime(phases, 200)?.name).toEqual({ ja: 'P3' });
  });
  it('最初のフェーズより前 / フェーズ無しは null', () => {
    expect(phaseAtTime([{ name: { ja: 'P' } as LocalizedString, startTime: 50 }], 10)).toBeNull();
    expect(phaseAtTime([], 10)).toBeNull();
  });
  it('未ソートでも最大 startTime<=sec を選ぶ', () => {
    const unsorted = [
      { name: { ja: 'B' } as LocalizedString, startTime: 100 },
      { name: { ja: 'A' } as LocalizedString, startTime: 0 },
    ];
    expect(phaseAtTime(unsorted, 120)?.name).toEqual({ ja: 'B' });
  });
});

describe('pointPercent', () => {
  it('割合を 0〜100 に丸めクランプ', () => {
    expect(pointPercent(150, 300)).toBe(50);
    expect(pointPercent(400, 300)).toBe(100);
    expect(pointPercent(-5, 300)).toBe(0);
  });
  it('total<=0 は 0', () => {
    expect(pointPercent(50, 0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('m:ss に整形', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(225)).toBe('3:45');
  });
});

describe('formatTimeOfDay / formatMonthDay (JST)', () => {
  it('JST の時刻と月日', () => {
    // 2026-06-19T12:34:00Z = JST 21:34
    const ts = Date.parse('2026-06-19T12:34:00Z');
    expect(formatTimeOfDay(ts)).toBe('21:34');
    expect(formatMonthDay(ts)).toBe('6/19');
  });
});

describe('dayBucket (JST)', () => {
  it('今日 / 昨日 / それ以前を判定', () => {
    const now = Date.parse('2026-06-19T05:00:00Z'); // JST 6/19 14:00
    expect(dayBucket(Date.parse('2026-06-19T10:00:00Z'), now)).toBe('today');     // JST 6/19 19:00
    expect(dayBucket(Date.parse('2026-06-18T10:00:00Z'), now)).toBe('yesterday'); // JST 6/18 19:00
    expect(dayBucket(Date.parse('2026-06-17T10:00:00Z'), now)).toBe('older');
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/progressLogic.test.ts`
Expected: FAIL（`insertProgressPoint is not a function` 等）

- [ ] **Step 4: 実装を追加**

`src/lib/progressLogic.ts` の末尾に追記（先頭 import は既に `ProgressPoint, PlanProgress, LocalizedString` を含む）:

```ts
/** 指定 index に点を挿入（削除のUndo復元用・非破壊・範囲外はクランプ） */
export function insertProgressPoint(
    list: ProgressPoint[] | undefined, index: number, point: ProgressPoint
): ProgressPoint[] {
    const base = list ?? [];
    const i = Math.max(0, Math.min(index, base.length));
    return [...base.slice(0, i), point, ...base.slice(i)];
}

/** reachedPos を含むフェーズ（startTime<=sec で最大の startTime）を返す。無ければ null。未ソート安全。 */
export function phaseAtTime(
    phases: { name: LocalizedString; startTime: number }[], sec: number
): { name: LocalizedString } | null {
    let best: { name: LocalizedString } | null = null;
    let bestStart = -1;
    for (const p of phases) {
        if (p.startTime <= sec && p.startTime >= bestStart) { best = { name: p.name }; bestStart = p.startTime; }
    }
    return best;
}

/** 1点の到達割合 (reachedPos/totalSec*100) を 0〜100 に丸めクランプ */
export function pointPercent(reachedPos: number, totalSec: number): number {
    if (totalSec <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((reachedPos / totalSec) * 100)));
}

/** 秒 → "m:ss"（フェーズ未定義時の到達点ラベル用） */
export function formatClock(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** epoch ms → JST "H:MM"（記録時刻表示） */
export function formatTimeOfDay(ts: number): string {
    const jst = new Date(ts + 9 * 60 * 60 * 1000);
    return `${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

/** epoch ms → JST "M/D" */
export function formatMonthDay(ts: number): string {
    const jst = new Date(ts + 9 * 60 * 60 * 1000);
    return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

/** ts が今日/昨日/それ以前か（JST 基準・makeDayKey で日付比較） */
export function dayBucket(ts: number, nowTs: number): 'today' | 'yesterday' | 'older' {
    const day = makeDayKey(new Date(ts));
    if (day === makeDayKey(new Date(nowTs))) return 'today';
    if (day === makeDayKey(new Date(nowTs - 24 * 60 * 60 * 1000))) return 'yesterday';
    return 'older';
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/progressLogic.test.ts`
Expected: PASS（全 describe 緑）

- [ ] **Step 6: コミット**

```bash
git add src/types/index.ts src/lib/progressLogic.ts src/lib/__tests__/progressLogic.test.ts
git commit -m "feat(progress): ProgressPoint.note + 詳細パネル用の純粋ロジック(phaseAtTime/pointPercent/日時整形/insert)"
```

---

## Task 2: ストアアクション（note更新 / 全消去 / 復元挿入）

**Files:**
- Modify: `src/store/useMitigationStore.ts:202`（interface に3行）/ `:1611` の直後（実装）/ 先頭 import に `insertProgressPoint`・`ProgressPoint`
- Test: `src/store/__tests__/useMitigationStore.progress.test.ts`（新規）

**Interfaces:**
- Consumes: `insertProgressPoint`（Task 1）, `ProgressPoint`
- Produces:
  - `setProgressPointNote(index: number, note: string): void`（空文字で note 削除）
  - `clearAllProgressPoints(): void`（points のみ空に・cleared/activeDays/activeHours 不変）
  - `insertProgressPointAt(index: number, point: ProgressPoint): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useMitigationStore.progress.test.ts`（新規）:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

const seed = (points: { ts: number; reachedPos: number; note?: string }[], extra = {}) =>
  useMitigationStore.setState({
    progress: { points, cleared: false, ...extra },
    _collabReadonly: false, _collabActive: false,
  } as any);

describe('useMitigationStore progress detail actions', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    seed([]);
  });

  it('setProgressPointNote: 指定点に note を付ける', () => {
    seed([{ ts: 1, reachedPos: 10 }, { ts: 2, reachedPos: 20 }]);
    useMitigationStore.getState().setProgressPointNote(1, '  初到達  ');
    const pts = useMitigationStore.getState().progress.points;
    expect(pts[1].note).toBe('初到達'); // trim される
    expect(pts[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 空文字は note を削除（undefined化）', () => {
    seed([{ ts: 1, reachedPos: 10, note: 'x' }]);
    useMitigationStore.getState().setProgressPointNote(0, '   ');
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });

  it('setProgressPointNote: 範囲外 index は無変化', () => {
    seed([{ ts: 1, reachedPos: 10 }]);
    useMitigationStore.getState().setProgressPointNote(5, 'x');
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });

  it('clearAllProgressPoints: points だけ空に（cleared/活動は不変）', () => {
    seed([{ ts: 1, reachedPos: 10 }], { cleared: true, activeDays: 3, activeHours: 5 });
    useMitigationStore.getState().clearAllProgressPoints();
    const p = useMitigationStore.getState().progress;
    expect(p.points).toEqual([]);
    expect(p.cleared).toBe(true);
    expect(p.activeDays).toBe(3);
    expect(p.activeHours).toBe(5);
  });

  it('insertProgressPointAt: 元の位置に復元できる', () => {
    seed([{ ts: 1, reachedPos: 10 }, { ts: 3, reachedPos: 30 }]);
    useMitigationStore.getState().insertProgressPointAt(1, { ts: 2, reachedPos: 20 });
    expect(useMitigationStore.getState().progress.points.map(p => p.ts)).toEqual([1, 2, 3]);
  });

  it('collab 閲覧者(readonly)は書き換えをブロック', () => {
    seed([{ ts: 1, reachedPos: 10 }]);
    useMitigationStore.setState({ _collabReadonly: true, _collabActive: false } as any);
    useMitigationStore.getState().clearAllProgressPoints();
    useMitigationStore.getState().setProgressPointNote(0, 'x');
    expect(useMitigationStore.getState().progress.points).toHaveLength(1);
    expect(useMitigationStore.getState().progress.points[0].note).toBeUndefined();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.progress.test.ts`
Expected: FAIL（`setProgressPointNote is not a function` 等）

- [ ] **Step 3: import を足す**

`src/store/useMitigationStore.ts` 先頭の progressLogic import（現状 `import { appendProgressPoint, removeProgressPoint, normalizeProgress } from '../lib/progressLogic';`）に `insertProgressPoint` を追加:

```ts
import { appendProgressPoint, removeProgressPoint, normalizeProgress, insertProgressPoint } from '../lib/progressLogic';
```

`ProgressPoint` 型が型 import に含まれていなければ、types からの型 import に追加する（例: `import type { ..., ProgressPoint } from '../types';`）。

- [ ] **Step 4: interface に3行追加**

`src/store/useMitigationStore.ts:202`（`setActiveHours` の次・`}` の前）に追加:

```ts
    setProgressPointNote: (index: number, note: string) => void;
    clearAllProgressPoints: () => void;
    insertProgressPointAt: (index: number, point: ProgressPoint) => void;
```

- [ ] **Step 5: 実装を追加**

`src/store/useMitigationStore.ts` の `setActiveHours` 実装（`:1609-1612`）の直後に追加:

```ts
                setProgressPointNote: (index, note) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => {
                        if (index < 0 || index >= state.progress.points.length) return {} as any;
                        const trimmed = note.trim();
                        const points = state.progress.points.map((p, i) => {
                            if (i !== index) return p;
                            if (!trimmed) { const { note: _omit, ...rest } = p; return rest; }
                            return { ...p, note: trimmed };
                        });
                        return { progress: { ...state.progress, points } };
                    });
                },
                clearAllProgressPoints: () => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, points: [] } }));
                },
                insertProgressPointAt: (index, point) => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
                    set((state) => ({ progress: { ...state.progress, points: insertProgressPoint(state.progress.points, index, point) } }));
                },
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.progress.test.ts`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.progress.test.ts
git commit -m "feat(progress): ストアに setProgressPointNote/clearAllProgressPoints/insertProgressPointAt"
```

---

## Task 3: ProgressHistoryRow（1行・プレゼン＋メモ編集）

**Files:**
- Create: `src/components/progress/ProgressHistoryRow.tsx`
- Test: `src/components/progress/__tests__/ProgressHistoryRow.test.tsx`

**Interfaces:**
- Consumes: `pointPercent`, `formatTimeOfDay`, `formatMonthDay`, `dayBucket`（Task 1）, `ProgressPoint`
- Produces: `ProgressHistoryRow` (default export) with props:
  ```ts
  interface ProgressHistoryRowProps {
    point: ProgressPoint;
    index: number;        // points 配列内の実 index
    isBest: boolean;
    totalSec: number;
    phaseLabel: string;   // 事前算出済み（フェーズ名 or "m:ss 地点"）
    onDelete: (index: number) => void;
    onSetNote: (index: number, note: string) => void;
  }
  ```

- [ ] **Step 1: 失敗するテストを書く**

`src/components/progress/__tests__/ProgressHistoryRow.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressHistoryRow from '../ProgressHistoryRow';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

const base = {
  point: { ts: Date.parse('2026-06-19T12:34:00Z'), reachedPos: 150 },
  index: 0, isBest: true, totalSec: 300, phaseLabel: 'フェーズ2',
  onDelete: vi.fn(), onSetNote: vi.fn(),
};

describe('ProgressHistoryRow', () => {
  it('フェーズラベルと % を表示し、最高バッジを出す', () => {
    render(<ProgressHistoryRow {...base} />);
    expect(screen.getByText('フェーズ2')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();        // 150/300
    expect(screen.getByText('progress.best')).toBeTruthy();
  });

  it('isBest=false では最高バッジを出さない', () => {
    render(<ProgressHistoryRow {...base} isBest={false} />);
    expect(screen.queryByText('progress.best')).toBeNull();
  });

  it('ゴミ箱クリックで onDelete(index)', () => {
    const onDelete = vi.fn();
    render(<ProgressHistoryRow {...base} index={2} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('progress.delete_record'));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it('メモ click で入力欄、blur で onSetNote(index, 値)', () => {
    const onSetNote = vi.fn();
    render(<ProgressHistoryRow {...base} index={1} onSetNote={onSetNote} />);
    fireEvent.click(screen.getByText('progress.add_memo')); // 空なので追加プレースホルダ
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '初到達' } });
    fireEvent.blur(input);
    expect(onSetNote).toHaveBeenCalledWith(1, '初到達');
  });

  it('既存メモを表示する', () => {
    render(<ProgressHistoryRow {...base} point={{ ...base.point, note: 'やった' }} />);
    expect(screen.getByText('やった')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressHistoryRow.test.tsx`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装を書く**

`src/components/progress/ProgressHistoryRow.tsx`:

```tsx
// 進捗履歴の1行 — フェーズ名/最高/メモ（1行目）＋ バー/％/日時（2行目）＋ 右ガターのゴミ箱
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ProgressPoint } from '../../types';
import { pointPercent, formatTimeOfDay, formatMonthDay, dayBucket } from '../../lib/progressLogic';

interface ProgressHistoryRowProps {
    point: ProgressPoint;
    index: number;
    isBest: boolean;
    totalSec: number;
    phaseLabel: string;
    onDelete: (index: number) => void;
    onSetNote: (index: number, note: string) => void;
}

const ProgressHistoryRow: React.FC<ProgressHistoryRowProps> = ({
    point, index, isBest, totalSec, phaseLabel, onDelete, onSetNote,
}) => {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const pct = pointPercent(point.reachedPos, totalSec);

    // 日時ラベル（JST・今日/昨日/M/D）
    const bucket = dayBucket(point.ts, Date.now());
    const time = formatTimeOfDay(point.ts);
    const dateLabel =
        bucket === 'today' ? `${t('progress.today', '今日')} ${time}`
        : bucket === 'yesterday' ? `${t('progress.yesterday', '昨日')} ${time}`
        : `${formatMonthDay(point.ts)} ${time}`;

    const startEdit = () => { setDraft(point.note ?? ''); setEditing(true); };
    const commit = () => { setEditing(false); if ((point.note ?? '') !== draft.trim()) onSetNote(index, draft); };

    return (
        <div className="group flex items-stretch border-b border-app-border/60 last:border-b-0 md:hover:bg-app-blue/5 transition-colors">
            <div className="flex-1 min-w-0 py-2.5 pl-3.5 pr-1">
                {/* 1行目: フェーズ / 最高 / メモ */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-blue shrink-0" style={{ boxShadow: '0 0 6px var(--app-blue)' }} />
                    <span className="text-app-sm font-semibold text-app-text shrink-0">{phaseLabel}</span>
                    {isBest && (
                        <span className="text-app-2xs font-black text-app-blue border border-app-blue/45 rounded px-1 shrink-0">
                            {t('progress.best', '最高')}
                        </span>
                    )}
                    {editing ? (
                        <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value.slice(0, 60))}
                            onBlur={commit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') { setEditing(false); }
                            }}
                            placeholder={t('progress.memo_placeholder', 'ひとことメモ')}
                            className="flex-1 min-w-0 text-app-xs text-app-text bg-app-blue/5 border border-app-blue/50 rounded px-1.5 py-0.5 outline-none"
                        />
                    ) : point.note ? (
                        <span onClick={startEdit} className="flex-1 min-w-0 text-app-xs italic text-app-text-sec truncate cursor-text">
                            {point.note}
                        </span>
                    ) : (
                        <span onClick={startEdit} className="flex-1 min-w-0 text-app-2xs text-app-text-muted cursor-text">
                            {t('progress.add_memo', '＋メモ')}
                        </span>
                    )}
                </div>
                {/* 2行目: バー / ％ / 日時 */}
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 min-w-0 h-1.5 rounded-full bg-app-blue/15 overflow-hidden">
                        <div className="h-full rounded-full bg-app-blue" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-app-xs font-black text-app-blue tabular-nums shrink-0">{pct}%</span>
                    <span className="text-app-2xs text-app-text-muted tabular-nums shrink-0">{dateLabel}</span>
                </div>
            </div>
            {/* 右ガター: ゴミ箱（PCはホバーで出現・スマホは常時） */}
            <button
                onClick={() => onDelete(index)}
                aria-label={t('progress.delete_record', 'この記録を削除')}
                className={clsx(
                    'w-11 shrink-0 flex items-center justify-center border-l border-app-border/60',
                    'text-app-text-muted hover:text-app-red transition-all duration-200 cursor-pointer active:scale-90',
                    'md:opacity-0 md:group-hover:opacity-100'
                )}
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

export default ProgressHistoryRow;
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressHistoryRow.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/progress/ProgressHistoryRow.tsx src/components/progress/__tests__/ProgressHistoryRow.test.tsx
git commit -m "feat(progress): ProgressHistoryRow（バー+メモ+日時+ホバーゴミ箱）"
```

---

## Task 4: ProgressDetailPanel（リスト・空状態・全消去・インラインUndo）

**Files:**
- Create: `src/components/progress/ProgressDetailPanel.tsx`
- Test: `src/components/progress/__tests__/ProgressDetailPanel.test.tsx`

**Interfaces:**
- Consumes: `ProgressHistoryRow`（Task 3）, `ConfirmDialog`（既存）, `phaseAtTime` / `formatClock`（Task 1）, `getPhaseName`（types）, `useMitigationStore` actions（Task 2）, `useThemeStore`
- Produces: `ProgressDetailPanel`（default export・props なし・ストア駆動）

- [ ] **Step 1: 失敗するテストを書く**

`src/components/progress/__tests__/ProgressDetailPanel.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgressDetailPanel from '../ProgressDetailPanel';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('../../../store/useThemeStore', () => ({
  useThemeStore: (sel?: any) => { const s = { contentLanguage: 'ja' }; return sel ? sel(s) : s; },
}));

const actions = {
  removeProgressPoint: vi.fn(),
  clearAllProgressPoints: vi.fn(),
  setProgressPointNote: vi.fn(),
  insertProgressPointAt: vi.fn(),
};
let state: any;
vi.mock('../../../store/useMitigationStore', () => ({
  useMitigationStore: (sel: (s: any) => unknown) => sel(state),
}));

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  state = {
    ...actions,
    phases: [],
    timelineEvents: [{ id: 'e', time: 300 }],
    progress: { points: [
      { ts: 1, reachedPos: 60 },
      { ts: 2, reachedPos: 240 },
    ], cleared: false },
  };
});

describe('ProgressDetailPanel', () => {
  it('件数見出しと行を表示（新しい順）', () => {
    render(<ProgressDetailPanel />);
    expect(screen.getByText('progress.detail_title')).toBeTruthy();
    // 2点ぶんの % が出る（60/300=20, 240/300=80）
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('全消去 → ConfirmDialog → 確定で clearAllProgressPoints', () => {
    render(<ProgressDetailPanel />);
    fireEvent.click(screen.getByText('progress.clear_all'));
    // ConfirmDialog の確定ボタン（confirmLabel=progress.clear_all_confirm_ok）
    fireEvent.click(screen.getByText('progress.clear_all_confirm_ok'));
    expect(actions.clearAllProgressPoints).toHaveBeenCalled();
  });

  it('点が無いと空状態を表示し全消去を出さない', () => {
    state.progress = { points: [], cleared: false };
    render(<ProgressDetailPanel />);
    expect(screen.getByText('progress.empty_title')).toBeTruthy();
    expect(screen.queryByText('progress.clear_all')).toBeNull();
  });

  it('個別削除で removeProgressPoint(実index) を呼ぶ', () => {
    render(<ProgressDetailPanel />);
    // 先頭行（表示は新しい順なので reachedPos=240=実index1）の削除
    const delButtons = screen.getAllByLabelText('progress.delete_record');
    fireEvent.click(delButtons[0]);
    expect(actions.removeProgressPoint).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressDetailPanel.test.tsx`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装を書く**

`src/components/progress/ProgressDetailPanel.tsx`:

```tsx
// 進捗詳細パネル — 到達点の履歴（新しい順）/ 個別削除＋インラインUndo / 全消去（確認ダイアログ）
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getPhaseName, type ProgressPoint } from '../../types';
import { phaseAtTime, formatClock } from '../../lib/progressLogic';
import { ConfirmDialog } from '../ConfirmDialog';
import ProgressHistoryRow from './ProgressHistoryRow';

const ProgressDetailPanel: React.FC = () => {
    const { t } = useTranslation();
    const contentLanguage = useThemeStore((s) => s.contentLanguage);
    const points = useMitigationStore((s) => s.progress.points);
    const phases = useMitigationStore((s) => s.phases);
    const timelineEvents = useMitigationStore((s) => s.timelineEvents);
    const removeProgressPoint = useMitigationStore((s) => s.removeProgressPoint);
    const clearAllProgressPoints = useMitigationStore((s) => s.clearAllProgressPoints);
    const setProgressPointNote = useMitigationStore((s) => s.setProgressPointNote);
    const insertProgressPointAt = useMitigationStore((s) => s.insertProgressPointAt);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pending, setPending] = useState<{ point: ProgressPoint; index: number } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const totalSec = timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0;
    const maxReached = points.length ? Math.max(...points.map((p) => p.reachedPos)) : -1;
    const bestIndex = points.findIndex((p) => p.reachedPos === maxReached);

    const labelFor = (p: ProgressPoint): string => {
        const ph = phaseAtTime(phases, p.reachedPos);
        return ph ? getPhaseName(ph.name, contentLanguage) : `${formatClock(p.reachedPos)} ${t('progress.reach_at_suffix', '地点')}`;
    };

    const handleDelete = (index: number) => {
        const point = points[index];
        if (!point) return;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        removeProgressPoint(index);
        setPending({ point, index });
        undoTimer.current = setTimeout(() => setPending(null), 5000);
    };
    const handleUndo = () => {
        if (!pending) return;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        insertProgressPointAt(pending.index, pending.point);
        setPending(null);
    };

    return (
        <div className="border-t border-app-border">
            {/* 見出し */}
            <div className="flex items-center justify-between px-3.5 py-2">
                <span className="text-app-xs font-bold text-app-text">
                    {t('progress.detail_title', '到達の記録')} ({points.length})
                </span>
            </div>

            {/* インラインUndo帯 */}
            {pending && (
                <div className="flex items-center justify-center gap-3 px-3.5 py-1.5 bg-app-blue/5 border-y border-app-border">
                    <span className="text-app-2xs text-app-text-sec">{t('progress.deleted_one', '1件削除しました')}</span>
                    <button onClick={handleUndo}
                        className="flex items-center gap-1 text-app-2xs font-bold text-app-blue hover:underline cursor-pointer active:scale-95">
                        <Undo2 size={12} /> {t('progress.undo', '元に戻す')}
                    </button>
                </div>
            )}

            {points.length === 0 ? (
                <div className="px-3.5 py-6 text-center">
                    <div className="text-app-sm text-app-text-sec font-semibold">{t('progress.empty_title', 'まだ記録がありません')}</div>
                    <div className="text-app-2xs text-app-text-muted mt-1">{t('progress.empty_hint', 'タイムラインの到達した時間をクリックで記録')}</div>
                </div>
            ) : (
                <>
                    {/* リスト（新しい順）— 表示は reverse だが操作は実 index */}
                    <div className="overflow-y-auto" style={{ maxHeight: '190px' }}>
                        {points.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => (
                            <ProgressHistoryRow
                                key={p.ts}
                                point={p}
                                index={i}
                                isBest={i === bestIndex}
                                totalSec={totalSec}
                                phaseLabel={labelFor(p)}
                                onDelete={handleDelete}
                                onSetNote={setProgressPointNote}
                            />
                        ))}
                    </div>
                    {/* フッター: 全消去 */}
                    <div className="flex justify-center px-3.5 py-2 border-t border-app-border">
                        <button onClick={() => setConfirmOpen(true)}
                            className="text-app-2xs text-app-red border border-app-red/35 rounded-md px-3 py-1 hover:bg-app-red/10 transition-all duration-200 cursor-pointer active:scale-95">
                            {t('progress.clear_all', '全消去')}
                        </button>
                    </div>
                </>
            )}

            <ConfirmDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => { clearAllProgressPoints(); setConfirmOpen(false); }}
                title={t('progress.clear_all_confirm_title', '全消去')}
                message={t('progress.clear_all_confirm_message', { count: points.length, defaultValue: '到達記録 {{count}} 件をすべて消します。元に戻せません。' })}
                confirmLabel={t('progress.clear_all_confirm_ok', '全部消す')}
                variant="danger"
            />
        </div>
    );
};

export default ProgressDetailPanel;
```

> 注: テストの「20%/80%」は `ProgressHistoryRow` が `pointPercent` で出す。`reach_at_suffix`（地点）キーは i18n タスクで追加（Task 6）。フォールバック文字列を渡しているのでキー未追加でも動く。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressDetailPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/progress/ProgressDetailPanel.tsx src/components/progress/__tests__/ProgressDetailPanel.test.tsx
git commit -m "feat(progress): ProgressDetailPanel（履歴リスト/空状態/全消去確認/インラインUndo）"
```

---

## Task 5: ProgressRecordPanel 統合（シェブロン開閉）

**Files:**
- Modify: `src/components/progress/ProgressRecordPanel.tsx`（PCDrawer の下部・モバイルシートの下部・新規 `ChevronToggle`）
- Test: `src/components/progress/__tests__/ProgressRecordPanel.detail.test.tsx`（新規）

**Interfaces:**
- Consumes: `ProgressDetailPanel`（Task 4）

- [ ] **Step 1: 失敗するテストを書く**

`src/components/progress/__tests__/ProgressRecordPanel.detail.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressRecordPanel } from '../ProgressRecordPanel';
import { useProgressRecording } from '../useProgressRecording';
import { useMitigationStore } from '../../../store/useMitigationStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

describe('ProgressRecordPanel 詳細トグル（モバイル）', () => {
  beforeEach(() => {
    (window as any).innerWidth = 375;
    useMitigationStore.getState().resetForTutorial();
    useMitigationStore.setState({
      progress: { points: [{ ts: 1, reachedPos: 100 }], cleared: false },
      _collabReadonly: false, _collabActive: false,
    } as any);
    useProgressRecording.setState({ panelOpen: true, pendingClose: 0 } as any);
  });

  it('シェブロンで詳細パネルを開閉する', () => {
    render(<ProgressRecordPanel />);
    // 開く前は詳細見出しが無い
    expect(screen.queryByText('progress.detail_title')).toBeNull();
    fireEvent.click(screen.getByLabelText('progress.toggle_detail'));
    expect(screen.getByText('progress.detail_title')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressRecordPanel.detail.test.tsx`
Expected: FAIL（`toggle_detail` ボタンが無い）

- [ ] **Step 3: ChevronToggle と詳細描画を追加**

`src/components/progress/ProgressRecordPanel.tsx` を編集:

(a) import に追加:

```tsx
import ProgressDetailPanel from './ProgressDetailPanel';
```

(b) ファイル内（`PanelBody` の近く）に `ChevronToggle` を追加:

```tsx
// 詳細パネル開閉のシェブロン（角度ゆるめ＝chevron B）
const ChevronToggle: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => {
    const { t } = useTranslation();
    return (
        <button onClick={onClick} aria-label={t('progress.toggle_detail', '記録の詳細')} aria-expanded={open}
            className="p-1 rounded-lg text-app-blue hover:bg-app-toggle transition-all duration-200 cursor-pointer active:scale-90">
            <svg width="26" height="22" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', filter: 'drop-shadow(0 0 5px rgba(120,200,255,.45))' }}>
                <polyline points="5 10.5 14 14.5 23 10.5" />
            </svg>
        </button>
    );
};
```

(c) **PCDrawer**: 本文（`<div className="px-5 py-3.5"><PanelBody /></div>`）の直後、既存の「1つ戻る」絶対配置 `<div className="absolute bottom-2 right-3 z-10"><UndoLastPointButton /></div>` を**置き換え**、下記の相対バー＋詳細描画にする。`PCDrawer` 冒頭に `const [detailOpen, setDetailOpen] = useState(false);` を追加:

```tsx
            <div className="px-5 py-3.5"><PanelBody /></div>
            {/* 下部バー: シェブロン中央 + 直前undo右 */}
            <div className="relative flex items-center justify-center h-7 px-3">
                <ChevronToggle open={detailOpen} onClick={() => setDetailOpen((v) => !v)} />
                <div className="absolute right-3"><UndoLastPointButton /></div>
            </div>
            {detailOpen && <ProgressDetailPanel />}
```

(d) **モバイル**（`ProgressRecordPanel` 内 `MobileBottomSheet` の中身）: 現状の `<PanelBody />` と「1つ戻る」を、下記に置き換え。`ProgressRecordPanel` 本体に `const [detailOpenMobile, setDetailOpenMobile] = useState(false);` を追加:

```tsx
                <div className="py-2">
                    <PanelBody />
                    <div className="relative flex items-center justify-center h-8 mt-1">
                        <ChevronToggle open={detailOpenMobile} onClick={() => setDetailOpenMobile((v) => !v)} />
                        <div className="absolute right-0"><UndoLastPointButton /></div>
                    </div>
                    {detailOpenMobile && <ProgressDetailPanel />}
                </div>
```

> `useState` を使うため、`ProgressRecordPanel.tsx` の React import に `useState` が含まれること（既に含まれている）。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/progress/__tests__/ProgressRecordPanel.detail.test.tsx`
Expected: PASS

> happy-dom で `MobileBottomSheet` が `createPortal` する場合も RTL は `document.body` を検索するため `getByText` で見つかる。`toggle_detail` ボタンが複数（万一）出るときは `getAllByLabelText(...)[0]` を使う。

- [ ] **Step 5: コミット**

```bash
git add src/components/progress/ProgressRecordPanel.tsx src/components/progress/__tests__/ProgressRecordPanel.detail.test.tsx
git commit -m "feat(progress): 記録ドロワーにシェブロンで開く詳細パネルを統合(PC/モバイル)"
```

---

## Task 6: i18n（ja/en/ko/zh）＋ 仕上げ検証

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`（`progress` ブロックに追記）

**Interfaces:** なし（既存コンポーネントの `t('progress.*', '日本語デフォルト')` を本物の翻訳に置換）

- [ ] **Step 1: ja.json に追記**

`src/locales/ja.json` の `progress` ブロック末尾、`"undo_last": "直前の記録を取り消す"` の行に `,` を足し、直後に追加:

```json
        "detail_title": "到達の記録",
        "best": "最高",
        "add_memo": "＋メモ",
        "memo_placeholder": "ひとことメモ",
        "clear_all": "全消去",
        "clear_all_confirm_title": "全消去",
        "clear_all_confirm_message": "到達記録 {{count}} 件をすべて消します。元に戻せません。",
        "clear_all_confirm_ok": "全部消す",
        "deleted_one": "1件削除しました",
        "undo": "元に戻す",
        "empty_title": "まだ記録がありません",
        "empty_hint": "タイムラインの到達した時間をクリックで記録",
        "reach_at_suffix": "地点",
        "delete_record": "この記録を削除",
        "toggle_detail": "記録の詳細",
        "today": "今日",
        "yesterday": "昨日"
```

- [ ] **Step 2: en.json に追記（同じ場所・同じ手順）**

```json
        "detail_title": "Progress log",
        "best": "Best",
        "add_memo": "+ Note",
        "memo_placeholder": "Add a note",
        "clear_all": "Clear all",
        "clear_all_confirm_title": "Clear all",
        "clear_all_confirm_message": "This will delete all {{count}} records. This can't be undone.",
        "clear_all_confirm_ok": "Delete all",
        "deleted_one": "1 record deleted",
        "undo": "Undo",
        "empty_title": "No records yet",
        "empty_hint": "Click a reached point on the timeline to record it",
        "reach_at_suffix": "",
        "delete_record": "Delete this record",
        "toggle_detail": "Record details",
        "today": "Today",
        "yesterday": "Yesterday"
```

> en の `reach_at_suffix` は空（"3:45" だけで自然）。`ProgressDetailPanel.labelFor` は `${clock} ${suffix}` で末尾空白が出るが `formatClock` 側はトリム不要（表示上問題なし）。気になる場合は en だけ `"at "` を前置に変える案もあるが今回は空で可。

- [ ] **Step 3: ko.json に追記**

```json
        "detail_title": "도달 기록",
        "best": "최고",
        "add_memo": "＋메모",
        "memo_placeholder": "한 줄 메모",
        "clear_all": "전체 삭제",
        "clear_all_confirm_title": "전체 삭제",
        "clear_all_confirm_message": "도달 기록 {{count}}건을 모두 삭제합니다. 되돌릴 수 없습니다.",
        "clear_all_confirm_ok": "모두 삭제",
        "deleted_one": "1건 삭제했습니다",
        "undo": "되돌리기",
        "empty_title": "아직 기록이 없습니다",
        "empty_hint": "타임라인의 도달 지점을 클릭해 기록",
        "reach_at_suffix": "지점",
        "delete_record": "이 기록을 삭제",
        "toggle_detail": "기록 상세",
        "today": "오늘",
        "yesterday": "어제"
```

- [ ] **Step 4: zh.json に追記**

```json
        "detail_title": "进度记录",
        "best": "最高",
        "add_memo": "＋备注",
        "memo_placeholder": "一句备注",
        "clear_all": "全部清除",
        "clear_all_confirm_title": "全部清除",
        "clear_all_confirm_message": "将删除全部 {{count}} 条记录。无法撤销。",
        "clear_all_confirm_ok": "全部删除",
        "deleted_one": "已删除 1 条",
        "undo": "撤销",
        "empty_title": "还没有记录",
        "empty_hint": "点击时间轴上的到达点进行记录",
        "reach_at_suffix": "处",
        "delete_record": "删除此记录",
        "toggle_detail": "记录详情",
        "today": "今天",
        "yesterday": "昨天"
```

- [ ] **Step 5: 4ファイルが正しい JSON か確認（ビルド型チェック含む）**

Run: `npm run build`
Expected: EXIT 0（型エラー無し・JSON パース成功）

- [ ] **Step 6: 進捗関連テスト全実行**

Run: `npx vitest run src/lib/__tests__/progressLogic.test.ts src/store/__tests__/useMitigationStore.progress.test.ts src/components/progress`
Expected: 全 PASS

- [ ] **Step 7: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(progress): 詳細パネルの文言を4言語追加"
```

---

## 完了後の検証（実機・ユーザー）

writing-plans / 実装の自動テストとは別に、実機総点検を行う（記録モードON/OFF回帰含む）:
- PC: シェブロンで開閉 → 履歴が新しい順 → メモ入力/編集/空で消える → 個別削除＋元に戻す → 全消去（確認→点だけ消える・CLEAR!👑/活動日数は残る）→ 空状態
- 4言語で文言崩れ無し（特に確認ダイアログの件数 {{count}}）
- スマホ（MobileBottomSheet）で同等動作・ゴミ箱常時表示
- collab 閲覧者では編集/削除がブロックされる
- 既存の記録（タイムラインclickで記録→ドロワー閉じ）回帰 / トースト回帰

---

## Self-Review（spec 突合・記入済み）

- **Spec coverage**: §2 確定仕様の各項（入口シェブロン=Task5 / 開き方=Task5 / 行B=Task3 / メモ=Task1+3 / 削除個別=Task4 / 全消去=Task4 / 見出しフッター=Task4 / 並び順=Task4 / 空状態=Task4）、§3 データモデル=Task1、§4 ストア=Task2、§5 純粋ロジック=Task1、§6 コンポーネント=Task3/4/5、§9 i18n=Task6 を網羅。
- **Placeholder scan**: TODO/TBD 無し。全ステップに実コード・実コマンド・期待結果あり。
- **Type consistency**: `setProgressPointNote(index,note)` / `clearAllProgressPoints()` / `insertProgressPointAt(index,point)`（Task2 宣言＝Task4 使用一致）。`ProgressHistoryRow` props（Task3 定義＝Task4 使用一致）。`pointPercent` / `phaseAtTime` / `formatClock` / `dayBucket`（Task1 定義＝Task3/4 使用一致）。
- **既知の留意**: en の `reach_at_suffix` は空文字（自然な英語のため）。row テストの `progress.best` 等は react-i18next モック（`t:(k)=>k`）がキーを返す前提。
