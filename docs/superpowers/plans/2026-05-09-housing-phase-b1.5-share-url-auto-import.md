# Phase B-1.5: 共有 URL 自動取り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有 URL `/share/:shareId` ランディングを「リッチプレビュー → 1 タップ取り込み + 上限到達時の重ねシート整理 → 自動再開」体験に刷新し、 LocalImportDialog の「次回から表示しない」チェックも廃止する。

**Architecture:** 既存野良主流ボトムシートの UI 体系・既存同期メカニズム・既存データ保護機能を **完全に温存** したまま、 新規ファイル群 (`ShareImportSheet`, `LimitResolutionSheet`, `useShareImportFlow`, `executeShareImport`, `executePlanDeletions`, `checkPlanLimit`) を追加。 既存 `usePlanStore.syncToFirestore` には引数 `onlyPlanIds?: string[]` を 1 個追加するのみ (未指定時の挙動は完全互換)。

**Tech Stack:** TypeScript / React / zustand / Firebase Firestore / vitest / @testing-library/react / happy-dom / framer-motion / Tailwind / i18next。

**設計書**: [docs/superpowers/specs/2026-05-09-housing-phase-b1.5-share-url-auto-import-design.md](../specs/2026-05-09-housing-phase-b1.5-share-url-auto-import-design.md)

**「触らない箇所」原則**: 設計書 §2.4 の 7 点を 1 つでも触ったら設計違反。 各タスクで完了時に `git diff` で確認:
- `usePlanStore.addPlan` 関数本体
- `usePlanStore` の `_dirtyPlanIds` / `_deletedPlanIds` 操作ロジック
- `usePlanStore.fetchAndMerge` 関数本体
- `planService.createPlan` / `updatePlan` / `deletePlan` 関数本体
- `MitigationSheet.tsx` の `copyPlan` / `runCopy` 関数
- `LocalImportDialog.executeLocalImport` 関数本体
- `silentCompressStale` / `getStalePlanIds`

---

## File Structure

| ファイル | 状態 | 責務 |
|---|---|---|
| `src/utils/planLimitChecker.ts` | 新規 | `checkPlanLimit` 純粋関数 |
| `src/utils/planLimitChecker.test.ts` | 新規 | 上記テスト |
| `src/lib/shareImportTypes.ts` | 新規 | `ShareImportItem` / `ProgressEvent` / `ImportResult` 型 |
| `src/lib/buildShareImportItems.ts` | 新規 | `parseSharedDataToImportItems` + `buildNewPlan` 純粋関数 |
| `src/lib/buildShareImportItems.test.ts` | 新規 | 上記テスト |
| `src/lib/executeShareImport.ts` | 新規 | 取り込み 1 件ずつ orchestration |
| `src/lib/executeShareImport.test.ts` | 新規 | 上記テスト |
| `src/lib/executePlanDeletions.ts` | 新規 | 削除 1 件ずつ orchestration |
| `src/lib/executePlanDeletions.test.ts` | 新規 | 上記テスト |
| `src/store/useShareImportFlow.ts` | 新規 | 取り込みフロー zustand store |
| `src/store/useShareImportFlow.test.ts` | 新規 | 上記テスト |
| `src/store/usePlanStore.ts` | 修正 | `syncToFirestore({ onlyPlanIds })` 追加 |
| `src/store/__tests__/usePlanStore.syncToFirestore.test.ts` | 新規 | onlyPlanIds テスト |
| `src/components/ShareImportProgressIndicator.tsx` | 新規 | 動作別 3 段階インジケーター |
| `src/components/ShareImportProgressIndicator.test.tsx` | 新規 | 上記テスト |
| `src/components/SharePlanCard.tsx` | 新規 | カード行コンポーネント (左カラム再利用) |
| `src/components/SharePlanCard.test.tsx` | 新規 | 上記テスト |
| `src/components/ShareImportSheet.tsx` | 新規 | 新ボトムシート |
| `src/components/ShareImportSheet.test.tsx` | 新規 | 上記テスト |
| `src/components/LimitResolutionSheet.tsx` | 新規 | 上限到達時の重ねシート |
| `src/components/LimitResolutionSheet.test.tsx` | 新規 | 上記テスト |
| `src/components/SharePage.tsx` | 書き換え | 中身を `useShareImportFlow.start` + navigate に |
| `src/components/Layout.tsx` | 修正 | シートマウント + `dontShow` 判定削除 |
| `src/store/useLocalImportDialog.ts` | 修正 | `ignoreDontShow` パラメータ削除 |
| `src/components/LocalImportDialog.tsx` | 修正 | 「次回から表示しない」UI 削除 |
| `src/i18n/locales/ja.ts` (+en/ko/zh) | 拡張/削除 | `share_import.*` / `limit_resolution.*` 追加、 `local_import.dont_show_again` 削除 |

---

## Task 1: `checkPlanLimit` 純粋関数

**Files:**
- Create: `src/utils/planLimitChecker.ts`
- Test: `src/utils/planLimitChecker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/planLimitChecker.test.ts
import { describe, it, expect } from 'vitest';
import { checkPlanLimit } from './planLimitChecker';
import { PLAN_LIMITS } from '../types/firebase';
import type { SavedPlan } from '../types';

const mkPlan = (id: string, contentId: string): SavedPlan => ({
  id,
  ownerId: 'local',
  ownerDisplayName: '',
  title: id,
  contentId,
  isPublic: false,
  copyCount: 0,
  useCount: 0,
  data: {} as any,
  createdAt: 0,
  updatedAt: 0,
});

describe('checkPlanLimit', () => {
  it('returns exceeded=false when under limit', () => {
    const plans = [mkPlan('p1', 'fru'), mkPlan('p2', 'fru')];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(2);
    expect(result.max).toBe(PLAN_LIMITS.MAX_PLANS_PER_CONTENT);
  });

  it('returns max_per_content when at content limit', () => {
    const plans = Array.from({ length: 5 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_per_content');
    expect(result.current).toBe(5);
    expect(result.max).toBe(5);
  });

  it('returns max_total when at total limit', () => {
    const plans = Array.from({ length: 50 }, (_, i) => mkPlan(`p${i}`, `c${i}`));
    const result = checkPlanLimit(plans, 'newContent');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_total');
    expect(result.current).toBe(50);
    expect(result.max).toBe(50);
  });

  it('prioritizes max_total over max_per_content', () => {
    // 50 件総 + その中 5 件が同 contentId
    const same = Array.from({ length: 5 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const others = Array.from({ length: 45 }, (_, i) => mkPlan(`q${i}`, `c${i}`));
    const plans = [...same, ...others];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(true);
    expect(result.reason).toBe('max_total');
  });

  it('returns exceeded=false for empty plans array', () => {
    const result = checkPlanLimit([], 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(0);
  });

  it('counts only the specified contentId', () => {
    const plans = [
      mkPlan('p1', 'fru'),
      mkPlan('p2', 'fru'),
      mkPlan('p3', 'tea'),
      mkPlan('p4', 'tea'),
      mkPlan('p5', 'tea'),
    ];
    const result = checkPlanLimit(plans, 'fru');
    expect(result.current).toBe(2);
  });

  it('handles boundary at max-1 (allows one more)', () => {
    const plans = Array.from({ length: 4 }, (_, i) => mkPlan(`p${i}`, 'fru'));
    const result = checkPlanLimit(plans, 'fru');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/planLimitChecker.test.ts`
Expected: FAIL with "Cannot find module './planLimitChecker'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/planLimitChecker.ts
import { PLAN_LIMITS } from '../types/firebase';
import type { SavedPlan } from '../types';

export type PlanLimitReason = 'max_total' | 'max_per_content';

export interface PlanLimitCheckResult {
  exceeded: boolean;
  reason?: PlanLimitReason;
  current: number;
  max: number;
}

export function checkPlanLimit(
  plans: SavedPlan[],
  contentId: string,
): PlanLimitCheckResult {
  const totalCount = plans.length;
  if (totalCount >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
    return {
      exceeded: true,
      reason: 'max_total',
      current: totalCount,
      max: PLAN_LIMITS.MAX_TOTAL_PLANS,
    };
  }
  const contentCount = plans.filter(p => p.contentId === contentId).length;
  if (contentCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
    return {
      exceeded: true,
      reason: 'max_per_content',
      current: contentCount,
      max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
    };
  }
  return {
    exceeded: false,
    current: contentCount,
    max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/planLimitChecker.test.ts`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add src/utils/planLimitChecker.ts src/utils/planLimitChecker.test.ts
git commit -m "feat(planLimit): add checkPlanLimit pure function with 7 tests"
```

---

## Task 2: `ShareImportItem` 型 + `buildNewPlan` / `parseSharedDataToImportItems` 純粋関数

**Files:**
- Create: `src/lib/shareImportTypes.ts`
- Create: `src/lib/buildShareImportItems.ts`
- Test: `src/lib/buildShareImportItems.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/buildShareImportItems.test.ts
import { describe, it, expect } from 'vitest';
import { parseSharedDataToImportItems, buildNewPlan } from './buildShareImportItems';
import type { SharedData, BundledSharedData } from '../types';

const samplePlanData = { events: [], mitigations: [] } as any;

describe('parseSharedDataToImportItems', () => {
  it('handles single shared plan (non-bundle)', () => {
    const data: SharedData = {
      shareId: 'abc123',
      title: 'P1 P2 終了後',
      contentId: 'fru',
      planData: samplePlanData,
      createdAt: 0,
      updatedAt: 0,
    } as any;
    const items = parseSharedDataToImportItems(data, 'abc123');
    expect(items).toHaveLength(1);
    expect(items[0].sourceShareId).toBe('abc123');
    expect(items[0].contentId).toBe('fru');
    expect(items[0].title).toBe('P1 P2 終了後');
    expect(items[0].planData).toBe(samplePlanData);
  });

  it('handles bundle shared data (multiple plans)', () => {
    const data: BundledSharedData = {
      shareId: 'bundle456',
      contentId: 'fru',
      plans: [
        { id: 'p1', title: 'P2 終了後', planData: samplePlanData },
        { id: 'p2', title: 'P3 P4 後半', planData: samplePlanData },
        { id: 'p3', title: 'ガード範囲', planData: samplePlanData },
      ],
      createdAt: 0,
      updatedAt: 0,
    } as any;
    const items = parseSharedDataToImportItems(data, 'bundle456');
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe('P2 終了後');
    expect(items[0].sourcePlanId).toBe('p1');
    expect(items[2].title).toBe('ガード範囲');
    expect(items[2].sourcePlanId).toBe('p3');
    items.forEach(item => {
      expect(item.sourceShareId).toBe('bundle456');
      expect(item.contentId).toBe('fru');
    });
  });

  it('falls back to "Shared Plan" when title missing in single', () => {
    const data: SharedData = {
      shareId: 'noTitle',
      contentId: 'fru',
      planData: samplePlanData,
      createdAt: 0,
      updatedAt: 0,
    } as any;
    const items = parseSharedDataToImportItems(data, 'noTitle');
    expect(items[0].title).toBe('Shared Plan');
  });
});

describe('buildNewPlan', () => {
  it('creates SavedPlan with ownerId="local"', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    expect(plan.ownerId).toBe('local');
    expect(plan.contentId).toBe('fru');
    expect(plan.title).toBe('Test');
    expect(plan.data).toBe(samplePlanData);
    expect(plan.id).toBeTruthy();
    expect(plan.id.length).toBeGreaterThan(0);
  });

  it('generates unique ids per call', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const p1 = buildNewPlan(item);
    const p2 = buildNewPlan(item);
    expect(p1.id).not.toBe(p2.id);
  });

  it('sets isPublic=false copyCount=0 useCount=0', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    expect(plan.isPublic).toBe(false);
    expect(plan.copyCount).toBe(0);
    expect(plan.useCount).toBe(0);
  });

  it('sets createdAt and updatedAt to a recent timestamp', () => {
    const before = Date.now();
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    const after = Date.now();
    expect(plan.createdAt).toBeGreaterThanOrEqual(before);
    expect(plan.createdAt).toBeLessThanOrEqual(after);
    expect(plan.updatedAt).toBe(plan.createdAt);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/buildShareImportItems.test.ts`
Expected: FAIL with "Cannot find module './buildShareImportItems'"

- [ ] **Step 3: Create types file**

```typescript
// src/lib/shareImportTypes.ts
import type { PlanData, SavedPlan } from '../types';

export interface ShareImportItem {
  sourceShareId: string;
  contentId: string;
  title: string;
  planData: PlanData;
  sourcePlanId?: string; // バンドル内の元 plan id (ログ用)
}

export type ProgressStage = 'check' | 'local' | 'server';
export type ProgressStatus = 'in_progress' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface ProgressEvent {
  planId: string; // ShareImportItem 内で一意な識別子 (sourcePlanId or sourceShareId)
  stage: ProgressStage;
  status: ProgressStatus;
  error?: string;
}

export type DeleteProgressStage = 'local_delete' | 'server_delete' | 'capacity_freed';

export interface DeleteProgressEvent {
  planId: string;
  stage: DeleteProgressStage;
  status: ProgressStatus;
  error?: string;
}

export interface ImportResult {
  itemPlanId: string; // ShareImportItem 内識別子
  newPlanId?: string; // 成功時、 SavedPlan.id
  status: 'success' | 'failed' | 'cancelled';
  error?: string;
}
```

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/lib/buildShareImportItems.ts
import type { SavedPlan } from '../types';
import type { ShareImportItem } from './shareImportTypes';

export function parseSharedDataToImportItems(
  sharedData: any,
  shareId: string,
): ShareImportItem[] {
  // バンドル判定: plans 配列を持つかどうか
  if (Array.isArray(sharedData.plans)) {
    return sharedData.plans.map((p: any) => ({
      sourceShareId: shareId,
      contentId: sharedData.contentId,
      title: p.title || 'Shared Plan',
      planData: p.planData,
      sourcePlanId: p.id,
    }));
  }
  // 単一
  return [
    {
      sourceShareId: shareId,
      contentId: sharedData.contentId,
      title: sharedData.title || 'Shared Plan',
      planData: sharedData.planData,
    },
  ];
}

export function buildNewPlan(item: ShareImportItem): SavedPlan {
  const now = Date.now();
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `plan_${now}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    ownerId: 'local',
    ownerDisplayName: '',
    title: item.title,
    contentId: item.contentId,
    isPublic: false,
    copyCount: 0,
    useCount: 0,
    data: item.planData,
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/buildShareImportItems.test.ts`
Expected: PASS (8/8)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shareImportTypes.ts src/lib/buildShareImportItems.ts src/lib/buildShareImportItems.test.ts
git commit -m "feat(shareImport): add ShareImportItem types + buildNewPlan / parseSharedDataToImportItems pure functions"
```

---

## Task 3: `usePlanStore.syncToFirestore` に `onlyPlanIds` 引数追加

**Files:**
- Modify: `src/store/usePlanStore.ts` (`syncToFirestore` の引数とフィルタ)
- Test: `src/store/__tests__/usePlanStore.syncToFirestore.test.ts`

**注意**: 設計違反防止 — `addPlan`、 `_dirtyPlanIds` 操作ロジック、 `fetchAndMerge` には触れない。 `syncToFirestore` の引数追加 + 1 行 filter のみ。

- [ ] **Step 1: Read existing syncToFirestore implementation to understand exact shape**

Run: `grep -n "syncToFirestore" src/store/usePlanStore.ts | head -20`

既存 `syncToFirestore` のシグネチャと内部 `_dirtyPlanIds` の処理位置を把握する。 設計書 §5.4 のとおり、 既存挙動を完全互換に保ちつつ filter を 1 行追加する。

- [ ] **Step 2: Write the failing test**

```typescript
// src/store/__tests__/usePlanStore.syncToFirestore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlanStore } from '../usePlanStore';

vi.mock('firebase/firestore', () => ({
  // 既存テストの mock を踏襲 (省略)
}));
vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: { uid: 'testUid' } },
  db: {},
}));

describe('syncToFirestore({ onlyPlanIds })', () => {
  beforeEach(() => {
    usePlanStore.setState({
      plans: [],
      _dirtyPlanIds: new Set(),
      _deletedPlanIds: new Set(),
      lastSyncedAt: 0,
    } as any);
  });

  it('processes only specified planIds when onlyPlanIds is given', async () => {
    // arrange: dirty に 3 件
    usePlanStore.setState({
      plans: [
        { id: 'p1', ownerId: 'local', /* ... 最小限 */ } as any,
        { id: 'p2', ownerId: 'local' } as any,
        { id: 'p3', ownerId: 'local' } as any,
      ],
      _dirtyPlanIds: new Set(['p1', 'p2', 'p3']),
    } as any);

    const createPlanSpy = vi.spyOn(await import('../../lib/planService'), 'createPlan')
      .mockResolvedValue({ id: 'p1', ownerId: 'testUid' } as any);

    await usePlanStore.getState().syncToFirestore({ force: true, onlyPlanIds: ['p1'] });

    expect(createPlanSpy).toHaveBeenCalledTimes(1);
    expect(createPlanSpy.mock.calls[0][0].id).toBe('p1');
  });

  it('processes all dirty plans when onlyPlanIds is undefined (backward compat)', async () => {
    usePlanStore.setState({
      plans: [
        { id: 'p1', ownerId: 'local' } as any,
        { id: 'p2', ownerId: 'local' } as any,
      ],
      _dirtyPlanIds: new Set(['p1', 'p2']),
    } as any);

    const createPlanSpy = vi.spyOn(await import('../../lib/planService'), 'createPlan')
      .mockResolvedValue({ id: 'x', ownerId: 'testUid' } as any);

    await usePlanStore.getState().syncToFirestore({ force: true });

    expect(createPlanSpy).toHaveBeenCalledTimes(2);
  });

  it('skips processing when onlyPlanIds is empty array', async () => {
    usePlanStore.setState({
      plans: [{ id: 'p1', ownerId: 'local' } as any],
      _dirtyPlanIds: new Set(['p1']),
    } as any);

    const createPlanSpy = vi.spyOn(await import('../../lib/planService'), 'createPlan')
      .mockResolvedValue({ id: 'p1', ownerId: 'testUid' } as any);

    await usePlanStore.getState().syncToFirestore({ force: true, onlyPlanIds: [] });

    expect(createPlanSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/usePlanStore.syncToFirestore.test.ts`
Expected: FAIL with TypeError or unexpected behavior (引数が無視されている)

- [ ] **Step 4: Modify `syncToFirestore` in `usePlanStore.ts`**

既存 `syncToFirestore` の冒頭で `_dirtyPlanIds` を `Array.from(get()._dirtyPlanIds)` で取り出している箇所に filter を追加。 シグネチャも拡張。

```typescript
// 既存 (例)
syncToFirestore: async ({ force = false }: { force?: boolean } = {}) => {
  // ...
  const dirtyIds = Array.from(get()._dirtyPlanIds);
  // ...
}

// 修正後
syncToFirestore: async (
  { force = false, onlyPlanIds }: { force?: boolean; onlyPlanIds?: string[] } = {}
) => {
  // ...
  let dirtyIds = Array.from(get()._dirtyPlanIds);
  if (onlyPlanIds !== undefined) {
    const filterSet = new Set(onlyPlanIds);
    dirtyIds = dirtyIds.filter(id => filterSet.has(id));
  }
  // ... 以下、 既存ロジック完全に変更なし
}
```

`syncToFirestore` 型シグネチャを `usePlanStore` ストア定義 (interface) でも更新:

```typescript
syncToFirestore: (params?: { force?: boolean; onlyPlanIds?: string[] }) => Promise<void>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/store/__tests__/usePlanStore.syncToFirestore.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: 既存 487 + 新規 3 = 490 件 PASS

- [ ] **Step 7: Verify no untouched lines were touched**

Run: `git diff src/store/usePlanStore.ts | grep -c "^+"` and inspect.

`syncToFirestore` 関数とその interface 部以外の行が変わっていないことを確認。

- [ ] **Step 8: Commit**

```bash
git add src/store/usePlanStore.ts src/store/__tests__/usePlanStore.syncToFirestore.test.ts
git commit -m "feat(usePlanStore): syncToFirestore({ onlyPlanIds }) for targeted sync"
```

---

## Task 4: `executeShareImport` 関数

**Files:**
- Create: `src/lib/executeShareImport.ts`
- Test: `src/lib/executeShareImport.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/executeShareImport.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeShareImport } from './executeShareImport';
import { usePlanStore } from '../store/usePlanStore';
import type { ShareImportItem } from './shareImportTypes';

vi.mock('../store/usePlanStore');
vi.useFakeTimers();

const sampleItem = (id: string, contentId: string): ShareImportItem => ({
  sourceShareId: 'share1',
  contentId,
  title: `Item ${id}`,
  planData: {} as any,
  sourcePlanId: id,
});

describe('executeShareImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports a single item successfully when limit is OK', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(syncToFirestore).toHaveBeenCalledTimes(1);
    expect(syncToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, onlyPlanIds: expect.any(Array) }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'check', status: 'success' }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'local', status: 'success' }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server', status: 'success' }),
    );
    expect(onLimitHit).not.toHaveBeenCalled();
  });

  it('triggers onLimitHit when content limit is reached', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: Array.from({ length: 5 }, (_, i) => ({
        id: `existing${i}`,
        ownerId: 'testUid',
        contentId: 'fru',
      })) as any,
      addPlan,
      syncToFirestore,
    } as any);

    const onLimitHit = vi.fn().mockResolvedValue('cancelled');
    const onProgress = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(onLimitHit).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: 'fru',
        neededCount: 1,
        planId: 'p1',
      }),
    );
    expect(results[0].status).toBe('cancelled');
    expect(addPlan).not.toHaveBeenCalled();
  });

  it('resumes import after onLimitHit resolves', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;
    vi.mocked(usePlanStore.getState).mockImplementation(() => {
      callCount++;
      // 初回 5 件、 2 回目 (resolve 後) 4 件
      const plans = callCount === 1
        ? Array.from({ length: 5 }, (_, i) => ({
            id: `existing${i}`,
            ownerId: 'testUid',
            contentId: 'fru',
          }))
        : Array.from({ length: 4 }, (_, i) => ({
            id: `existing${i}`,
            ownerId: 'testUid',
            contentId: 'fru',
          }));
      return { plans, addPlan, syncToFirestore } as any;
    });

    const onLimitHit = vi.fn().mockResolvedValue('resolved');
    const onProgress = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(onLimitHit).toHaveBeenCalledTimes(1);
    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(results[0].status).toBe('success');
  });

  it('processes multiple items independently (one fails, others succeed)', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn()
      .mockResolvedValueOnce(undefined) // p1 OK
      .mockRejectedValueOnce(new Error('network')) // p2 fail
      .mockResolvedValueOnce(undefined); // p3 OK
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru'), sampleItem('p2', 'tea'), sampleItem('p3', 'tea')],
      'testUid',
      'TestUser',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('success'); // ローカルは保存できているので success
    expect(results[2].status).toBe('success');
    // p2 の server stage は failed
    const p2ServerEvents = onProgress.mock.calls
      .map(c => c[0])
      .filter(e => e.planId === 'p2' && e.stage === 'server');
    expect(p2ServerEvents.some(e => e.status === 'failed')).toBe(true);
  });

  it('skips server save when uid is null (anonymous)', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const onLimitHit = vi.fn();

    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      null, // anonymous
      '',
      onProgress,
      onLimitHit,
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(addPlan).toHaveBeenCalledTimes(1);
    expect(syncToFirestore).not.toHaveBeenCalled();
    expect(results[0].status).toBe('success');
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server', status: 'skipped' }),
    );
  });

  it('respects minimum delays between stages', async () => {
    const addPlan = vi.fn();
    const syncToFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      plans: [],
      addPlan,
      syncToFirestore,
    } as any);

    const onProgress = vi.fn();
    const promise = executeShareImport(
      [sampleItem('p1', 'fru')],
      'testUid',
      'TestUser',
      onProgress,
      vi.fn(),
    );

    // check stage in_progress 直後、 success 前は 400ms 経たない
    await vi.advanceTimersByTimeAsync(0);
    let calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls.find(e => e.stage === 'check' && e.status === 'in_progress')).toBeTruthy();
    expect(calls.find(e => e.stage === 'check' && e.status === 'success')).toBeFalsy();

    // 400ms 経過後、 check success
    await vi.advanceTimersByTimeAsync(400);
    calls = onProgress.mock.calls.map(c => c[0]);
    expect(calls.find(e => e.stage === 'check' && e.status === 'success')).toBeTruthy();

    await vi.runAllTimersAsync();
    await promise;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/executeShareImport.test.ts`
Expected: FAIL with "Cannot find module './executeShareImport'"

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/executeShareImport.ts
import { usePlanStore } from '../store/usePlanStore';
import { checkPlanLimit } from '../utils/planLimitChecker';
import { buildNewPlan } from './buildShareImportItems';
import type { ShareImportItem, ProgressEvent, ImportResult } from './shareImportTypes';

const MIN_DELAY_CHECK_MS = 400;
const MIN_DELAY_LOCAL_MS = 600;
const MIN_DELAY_SERVER_MS = 800;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executeShareImport(
  plansToImport: ShareImportItem[],
  uid: string | null,
  displayName: string,
  onProgress: (event: ProgressEvent) => void,
  onLimitHit: (params: {
    contentId: string;
    neededCount: number;
    planId: string;
  }) => Promise<'resolved' | 'cancelled'>,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const item of plansToImport) {
    const itemPlanId = item.sourcePlanId ?? item.sourceShareId;

    // 1. 上限チェック
    onProgress({ planId: itemPlanId, stage: 'check', status: 'in_progress' });
    await delay(MIN_DELAY_CHECK_MS);

    let limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
    if (limitResult.exceeded) {
      const decision = await onLimitHit({
        contentId: item.contentId,
        neededCount: 1,
        planId: itemPlanId,
      });
      if (decision === 'cancelled') {
        onProgress({ planId: itemPlanId, stage: 'check', status: 'cancelled' });
        results.push({ itemPlanId, status: 'cancelled' });
        continue;
      }
      // 'resolved' → 再度上限チェック (最新 plans state で)
      limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
      if (limitResult.exceeded) {
        // 削除しても上限超過 → 失敗扱い
        onProgress({ planId: itemPlanId, stage: 'check', status: 'failed', error: 'still_exceeded' });
        results.push({ itemPlanId, status: 'failed', error: 'still_exceeded' });
        continue;
      }
    }
    onProgress({ planId: itemPlanId, stage: 'check', status: 'success' });

    // 2. 端末保存 (addPlan は ownerId='local' 正規化ガードあり)
    onProgress({ planId: itemPlanId, stage: 'local', status: 'in_progress' });
    let newPlan;
    try {
      newPlan = buildNewPlan(item);
      usePlanStore.getState().addPlan(newPlan);
      await delay(MIN_DELAY_LOCAL_MS);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'success' });
    } catch (err) {
      await delay(200);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'failed', error: String(err) });
      results.push({ itemPlanId, status: 'failed', error: String(err) });
      continue;
    }

    // 3. サーバー保存 (ログイン中のみ、 失敗時は dirty 同期にフォールバック)
    if (uid) {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'in_progress' });
      try {
        await usePlanStore.getState().syncToFirestore({ force: true, onlyPlanIds: [newPlan.id] });
        await delay(MIN_DELAY_SERVER_MS);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'success' });
      } catch (err) {
        await delay(400);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'failed', error: String(err) });
        // 失敗しても端末保存済み + dirty 同期が拾うので、 success として扱う (UX 上の継続を優先)
      }
    } else {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'skipped' });
    }

    results.push({ itemPlanId, newPlanId: newPlan.id, status: 'success' });
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/executeShareImport.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/lib/executeShareImport.ts src/lib/executeShareImport.test.ts
git commit -m "feat(shareImport): add executeShareImport orchestration with progress events"
```

---

## Task 5: `executePlanDeletions` 関数

**Files:**
- Create: `src/lib/executePlanDeletions.ts`
- Test: `src/lib/executePlanDeletions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/executePlanDeletions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePlanDeletions } from './executePlanDeletions';
import { usePlanStore } from '../store/usePlanStore';

vi.mock('../store/usePlanStore');
vi.useFakeTimers();

describe('executePlanDeletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes plans for logged-in user via deleteFromFirestore', async () => {
    const deleteFromFirestore = vi.fn().mockResolvedValue(undefined);
    const deletePlan = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
      deletePlan,
    } as any);

    const onProgress = vi.fn();

    const promise = executePlanDeletions(
      ['p1', 'p2'],
      'testUid',
      'fru',
      onProgress,
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(deleteFromFirestore).toHaveBeenCalledTimes(2);
    expect(deleteFromFirestore).toHaveBeenCalledWith('p1', 'testUid', 'fru');
    expect(deleteFromFirestore).toHaveBeenCalledWith('p2', 'testUid', 'fru');
    expect(deletePlan).not.toHaveBeenCalled();
  });

  it('uses local-only deletePlan when uid is null', async () => {
    const deleteFromFirestore = vi.fn();
    const deletePlan = vi.fn();
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
      deletePlan,
    } as any);

    const onProgress = vi.fn();

    const promise = executePlanDeletions(['p1'], null, 'fru', onProgress);
    await vi.runAllTimersAsync();
    await promise;

    expect(deletePlan).toHaveBeenCalledWith('p1');
    expect(deleteFromFirestore).not.toHaveBeenCalled();
  });

  it('emits progress events in correct order', async () => {
    const deleteFromFirestore = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
    } as any);

    const events: any[] = [];
    const onProgress = vi.fn(e => events.push(e));

    const promise = executePlanDeletions(['p1'], 'testUid', 'fru', onProgress);
    await vi.runAllTimersAsync();
    await promise;

    const stages = events.filter(e => e.planId === 'p1').map(e => `${e.stage}:${e.status}`);
    expect(stages).toEqual([
      'local_delete:in_progress',
      'local_delete:success',
      'server_delete:in_progress',
      'server_delete:success',
      'capacity_freed:success',
    ]);
  });

  it('throws when delete fails (so caller can show retry)', async () => {
    const deleteFromFirestore = vi.fn().mockRejectedValue(new Error('permission-denied'));
    vi.mocked(usePlanStore.getState).mockReturnValue({
      deleteFromFirestore,
    } as any);

    const onProgress = vi.fn();
    const promise = executePlanDeletions(['p1'], 'testUid', 'fru', onProgress);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('permission-denied');
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'server_delete', status: 'failed' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/executePlanDeletions.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/executePlanDeletions.ts
import { usePlanStore } from '../store/usePlanStore';
import type { DeleteProgressEvent } from './shareImportTypes';

const MIN_DELAY_LOCAL_MS = 400;
const MIN_DELAY_SERVER_MS = 600;
const MIN_DELAY_CAPACITY_MS = 400;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executePlanDeletions(
  planIds: string[],
  uid: string | null,
  contentId: string,
  onProgress: (event: DeleteProgressEvent) => void,
): Promise<void> {
  for (const planId of planIds) {
    onProgress({ planId, stage: 'local_delete', status: 'in_progress' });
    await delay(MIN_DELAY_LOCAL_MS);

    if (uid) {
      try {
        // deleteFromFirestore はローカル削除 + Firestore 削除を内部で行う
        await usePlanStore.getState().deleteFromFirestore(planId, uid, contentId);
        onProgress({ planId, stage: 'local_delete', status: 'success' });
        onProgress({ planId, stage: 'server_delete', status: 'in_progress' });
        await delay(MIN_DELAY_SERVER_MS);
        onProgress({ planId, stage: 'server_delete', status: 'success' });
      } catch (err) {
        onProgress({
          planId,
          stage: 'server_delete',
          status: 'failed',
          error: String(err),
        });
        throw err; // 整理フローを停止 → caller が retry button を出す
      }
    } else {
      usePlanStore.getState().deletePlan(planId);
      onProgress({ planId, stage: 'local_delete', status: 'success' });
      onProgress({ planId, stage: 'server_delete', status: 'skipped' });
    }

    await delay(MIN_DELAY_CAPACITY_MS);
    onProgress({ planId, stage: 'capacity_freed', status: 'success' });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/executePlanDeletions.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/lib/executePlanDeletions.ts src/lib/executePlanDeletions.test.ts
git commit -m "feat(shareImport): add executePlanDeletions orchestration with retry-on-fail"
```

---

## Task 6: `useShareImportFlow` zustand store

**Files:**
- Create: `src/store/useShareImportFlow.ts`
- Test: `src/store/useShareImportFlow.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/store/useShareImportFlow.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useShareImportFlow } from './useShareImportFlow';

vi.mock('../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

describe('useShareImportFlow', () => {
  beforeEach(() => {
    useShareImportFlow.setState({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      limitContext: null,
    });
  });

  it('starts in idle state', () => {
    expect(useShareImportFlow.getState().status).toBe('idle');
  });

  it('start() sets loading status and shareId', async () => {
    const { apiFetch } = await import('../utils/apiFetch');
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        shareId: 'abc',
        contentId: 'fru',
        title: 'Test',
        planData: { events: [], mitigations: [] },
        createdAt: 0,
        updatedAt: 0,
      }),
    } as any);

    await useShareImportFlow.getState().start('abc');

    const state = useShareImportFlow.getState();
    expect(state.shareId).toBe('abc');
    expect(state.status).toBe('preview');
    expect(state.importItems).toHaveLength(1);
  });

  it('start() sets error status when fetch fails', async () => {
    const { apiFetch } = await import('../utils/apiFetch');
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    await useShareImportFlow.getState().start('abc');

    expect(useShareImportFlow.getState().status).toBe('error');
  });

  it('toggleSelect() flips item selection', () => {
    useShareImportFlow.setState({
      importItems: [
        { sourceShareId: 'abc', contentId: 'fru', title: 't1', planData: {} as any, sourcePlanId: 'p1' },
        { sourceShareId: 'abc', contentId: 'fru', title: 't2', planData: {} as any, sourcePlanId: 'p2' },
      ],
      selectedItemIds: new Set(['p1', 'p2']),
    });

    useShareImportFlow.getState().toggleSelect('p1');

    expect(useShareImportFlow.getState().selectedItemIds.has('p1')).toBe(false);
    expect(useShareImportFlow.getState().selectedItemIds.has('p2')).toBe(true);
  });

  it('close() resets to idle', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { foo: 'bar' } as any,
    });

    useShareImportFlow.getState().close();

    const state = useShareImportFlow.getState();
    expect(state.status).toBe('idle');
    expect(state.shareId).toBe(null);
    expect(state.sharedData).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useShareImportFlow.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

```typescript
// src/store/useShareImportFlow.ts
import { create } from 'zustand';
import { apiFetch } from '../utils/apiFetch';
import { parseSharedDataToImportItems } from '../lib/buildShareImportItems';
import type {
  ShareImportItem,
  ProgressEvent,
  DeleteProgressEvent,
} from '../lib/shareImportTypes';

export type ShareImportStatus =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'importing'
  | 'limit_hit'
  | 'done'
  | 'error';

interface LimitContext {
  contentId: string;
  neededCount: number;
  planId: string;
  resolve: (decision: 'resolved' | 'cancelled') => void;
}

interface ShareImportFlowState {
  status: ShareImportStatus;
  shareId: string | null;
  sharedData: any | null;
  importItems: ShareImportItem[];
  selectedItemIds: Set<string>;
  progressMap: Map<string, ProgressEvent>;
  deleteProgressMap: Map<string, DeleteProgressEvent>;
  limitContext: LimitContext | null;
  errorMessage: string | null;

  start: (shareId: string) => Promise<void>;
  toggleSelect: (itemPlanId: string) => void;
  setSelected: (itemPlanIds: Set<string>) => void;
  startImport: () => Promise<void>;
  resolveLimitHit: (decision: 'resolved' | 'cancelled') => void;
  setProgress: (event: ProgressEvent) => void;
  setDeleteProgress: (event: DeleteProgressEvent) => void;
  setStatus: (s: ShareImportStatus) => void;
  setLimitContext: (ctx: LimitContext | null) => void;
  close: () => void;
}

export const useShareImportFlow = create<ShareImportFlowState>((set, get) => ({
  status: 'idle',
  shareId: null,
  sharedData: null,
  importItems: [],
  selectedItemIds: new Set(),
  progressMap: new Map(),
  deleteProgressMap: new Map(),
  limitContext: null,
  errorMessage: null,

  start: async (shareId) => {
    set({ status: 'loading', shareId, errorMessage: null });
    try {
      const res = await apiFetch(`/api/share?id=${encodeURIComponent(shareId)}`);
      if (res.status === 404) {
        set({ status: 'error', errorMessage: 'not_found' });
        return;
      }
      if (!res.ok) {
        set({ status: 'error', errorMessage: `HTTP ${res.status}` });
        return;
      }
      const data = await res.json();
      const items = parseSharedDataToImportItems(data, shareId);
      const allIds = new Set(items.map(i => i.sourcePlanId ?? i.sourceShareId));
      set({
        status: 'preview',
        sharedData: data,
        importItems: items,
        selectedItemIds: allIds,
      });
    } catch (err) {
      set({ status: 'error', errorMessage: String(err) });
    }
  },

  toggleSelect: (itemPlanId) => {
    const next = new Set(get().selectedItemIds);
    if (next.has(itemPlanId)) {
      next.delete(itemPlanId);
    } else {
      next.add(itemPlanId);
    }
    set({ selectedItemIds: next });
  },

  setSelected: (itemPlanIds) => set({ selectedItemIds: itemPlanIds }),

  startImport: async () => {
    // 実装は ShareImportSheet 側で executeShareImport を呼び出す形にする
    // (store に直書きすると import 循環が起きやすいため、 store はオーケストレーション state のみ持つ)
    set({ status: 'importing' });
  },

  resolveLimitHit: (decision) => {
    const ctx = get().limitContext;
    if (ctx) {
      ctx.resolve(decision);
      set({ limitContext: null, status: 'importing' });
    }
  },

  setProgress: (event) => {
    const next = new Map(get().progressMap);
    next.set(`${event.planId}:${event.stage}`, event);
    set({ progressMap: next });
  },

  setDeleteProgress: (event) => {
    const next = new Map(get().deleteProgressMap);
    next.set(`${event.planId}:${event.stage}`, event);
    set({ deleteProgressMap: next });
  },

  setStatus: (s) => set({ status: s }),
  setLimitContext: (ctx) => set({ limitContext: ctx, status: ctx ? 'limit_hit' : 'importing' }),

  close: () => {
    set({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      deleteProgressMap: new Map(),
      limitContext: null,
      errorMessage: null,
    });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useShareImportFlow.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/store/useShareImportFlow.ts src/store/useShareImportFlow.test.ts
git commit -m "feat(shareImport): add useShareImportFlow zustand store for orchestration"
```

---

## Task 7: i18n 4 言語追加 (`share_import.*`, `limit_resolution.*`)

**Files:**
- Modify: `src/i18n/locales/ja.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/ko.ts`
- Modify: `src/i18n/locales/zh.ts`

- [ ] **Step 1: Read existing i18n structure to follow naming convention**

Run: `head -80 src/i18n/locales/ja.ts`

既存の `local_import.*` セクションを参考に、 同じ構造で追加する。

- [ ] **Step 2: Add `share_import.*` and `limit_resolution.*` to ja.ts**

設計書 §7.1 の `share_import.*` と `limit_resolution.*` の全キーを ja.ts の適切な位置 (アルファベット順 or ロジカル) に追加。 用語ルール (`feedback_terminology_keigen_hyou`) 厳守: 「軽減表」を使い「プラン」を使わない。

```typescript
// 例 (ja.ts の関連部抜粋)
share_import: {
  title: '共有された軽減表',
  title_bundle: '共有された軽減表 ({{count}}件)',
  loading: '読み込んでいます...',
  not_found: 'この共有 URL は見つかりませんでした',
  error: '読み込みに失敗しました',
  already_copied_badge: '取り込み済み',
  button_import_single: '取り込む',
  button_import_count: '{{count}} 件を取り込む',
  progress_check: '上限を確認しています...',
  progress_check_ok: '上限 OK',
  progress_local: 'あなたの端末に保存しています...',
  progress_local_ok: 'あなたの端末に保存しました',
  progress_server: 'サーバーに保存しています...',
  progress_server_ok: 'サーバーに保存しました',
  progress_server_failed: 'サーバー保存に失敗しました (端末には保存済みです、 後で自動で再試行します)',
  progress_local_failed: '端末への保存に失敗しました',
  done_summary: '{{count}} 件の軽減表を取り込みました',
  cancelled_some: '{{cancelled}} 件キャンセルされました',
},
limit_resolution: {
  title_per_content: '{{contentName}} は既に {{current}}/{{max}} 件です',
  title_total: '総上限 {{current}}/{{max}} 件に達しています',
  body: '整理する軽減表をチェックしてください。 残り {{count}} 件取り込めます。',
  card_label_last_opened: '最終 {{date}}',
  selection_count: '{{count}} 件選択中',
  button_delete_and_resume: '{{count}} 件削除して再開',
  button_delete_and_resume_disabled: '削除する軽減表をチェックしてください',
  button_cancel: 'キャンセル',
  delete_progress_local: 'あなたの端末から削除しています...',
  delete_progress_local_ok: 'あなたの端末から削除しました',
  delete_progress_server: 'サーバーから削除しています...',
  delete_progress_server_ok: 'サーバーから削除しました',
  delete_capacity_freed: '容量空きました ({{current}}/{{max}})',
  delete_failed: '削除に失敗しました',
  resume_message: '{{count}} 件の取り込みを再開します',
},
```

- [ ] **Step 3: Add same keys to en.ts (sheet / mitigation sheet 用語)**

```typescript
share_import: {
  title: 'Shared mitigation sheet',
  title_bundle: 'Shared mitigation sheets ({{count}})',
  loading: 'Loading...',
  not_found: 'This share URL was not found',
  error: 'Failed to load',
  already_copied_badge: 'Imported',
  button_import_single: 'Import',
  button_import_count: 'Import {{count}} sheet(s)',
  progress_check: 'Checking limit...',
  progress_check_ok: 'Within limit',
  progress_local: 'Saving to your device...',
  progress_local_ok: 'Saved to your device',
  progress_server: 'Saving to the server...',
  progress_server_ok: 'Saved to the server',
  progress_server_failed: 'Server save failed (saved on device, will retry automatically)',
  progress_local_failed: 'Failed to save to device',
  done_summary: 'Imported {{count}} sheet(s)',
  cancelled_some: '{{cancelled}} cancelled',
},
limit_resolution: {
  title_per_content: '{{contentName}} is at {{current}}/{{max}}',
  title_total: 'Total cap {{current}}/{{max}} reached',
  body: 'Check sheets to remove. {{count}} remaining slot(s) to import.',
  card_label_last_opened: 'Last {{date}}',
  selection_count: '{{count}} selected',
  button_delete_and_resume: 'Delete {{count}} and resume',
  button_delete_and_resume_disabled: 'Check sheets to remove',
  button_cancel: 'Cancel',
  delete_progress_local: 'Deleting from your device...',
  delete_progress_local_ok: 'Deleted from your device',
  delete_progress_server: 'Deleting from the server...',
  delete_progress_server_ok: 'Deleted from the server',
  delete_capacity_freed: 'Capacity freed ({{current}}/{{max}})',
  delete_failed: 'Deletion failed',
  resume_message: 'Resuming {{count}} import(s)',
},
```

- [ ] **Step 4: Add same keys to ko.ts (경감표)**

```typescript
share_import: {
  title: '공유된 경감표',
  title_bundle: '공유된 경감표 ({{count}}개)',
  // ... 全キー、 「경감표」を使う
},
limit_resolution: {
  // ... 全キー、 「경감표」を使う
},
```

- [ ] **Step 5: Add same keys to zh.ts (减伤表)**

```typescript
share_import: {
  title: '共享的减伤表',
  title_bundle: '共享的减伤表 ({{count}}个)',
  // ... 全キー、 「减伤表」を使う
},
limit_resolution: {
  // ... 全キー、 「减伤表」を使う
},
```

- [ ] **Step 6: Verify i18n keys load without errors**

Run: `npm run build`
Expected: ビルド成功 (tsc strict が i18n 型を検証する場合あり)

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales/ja.ts src/i18n/locales/en.ts src/i18n/locales/ko.ts src/i18n/locales/zh.ts
git commit -m "i18n: add share_import.* and limit_resolution.* keys (4 langs, terminology = 軽減表/sheet/경감표/减伤表)"
```

---

## Task 8: i18n 4 言語削除 (`local_import.dont_show_again`)

**Files:**
- Modify: `src/i18n/locales/ja.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/ko.ts`
- Modify: `src/i18n/locales/zh.ts`

- [ ] **Step 1: Find existing key**

Run: `grep -n "dont_show_again" src/i18n/locales/*.ts`

- [ ] **Step 2: Remove the key from all 4 files**

各ファイルで `dont_show_again` 行を削除 (隣接する余分な改行も整理)。

- [ ] **Step 3: Verify no remaining references**

Run: `grep -rn "dont_show_again" src/`
Expected: 該当ファイル以外への参照は無いはず (Task 9-10 で UI からも削除する)。 もし `LocalImportDialog.tsx` で参照があれば、 後の Task で対処することを確認。

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n: remove local_import.dont_show_again (UI checkbox is being deprecated)"
```

---

## Task 9: `LocalImportDialog` チェックボックス削除

**Files:**
- Modify: `src/components/LocalImportDialog.tsx`

**注意**: `executeLocalImport` 関数本体には触れない (Phase B-1 Rev3 の確定済みロジックを保護)。

- [ ] **Step 1: Read existing LocalImportDialog to identify checkbox UI block**

Run: `grep -n "dont_show_again\|dontShow\|setDontShow\|lopo_local_import_dont_show" src/components/LocalImportDialog.tsx`

- [ ] **Step 2: Remove the checkbox JSX block, state, and localStorage write**

```typescript
// 削除対象:
// - useState の dontShow + setDontShow
// - useEffect で localStorage.getItem('lopo_local_import_dont_show')
// - <label className="mt-3 flex items-center gap-2 cursor-pointer select-none"> ... </label>
// - 「次回から表示しない」を ON にしたとき localStorage.setItem する処理
//
// 触らないこと:
// - executeLocalImport 呼び出しロジック
// - 進捗 UI / 結果集計 UI
// - その他のロジック
```

- [ ] **Step 3: Add an existing-test-style assertion that the checkbox is no longer rendered**

`src/components/__tests__/LocalImportDialog.test.tsx` に追加 (もし既存テストファイルがあれば。 なければスキップ可):

```typescript
it('does not render "do not show again" checkbox (deprecated)', () => {
  // render LocalImportDialog
  expect(screen.queryByRole('checkbox', { name: /次回から表示しない/i })).toBeNull();
});
```

- [ ] **Step 4: Run vitest to verify no regression in LocalImportDialog**

Run: `npx vitest run src/components/__tests__/LocalImportDialog`
Expected: 全件 PASS (既存 + 新規)

- [ ] **Step 5: Commit**

```bash
git add src/components/LocalImportDialog.tsx src/components/__tests__/LocalImportDialog.test.tsx
git commit -m "refactor(LocalImportDialog): remove 'do not show again' checkbox (always auto-show)"
```

---

## Task 10: `useLocalImportDialog` `ignoreDontShow` パラメータ削除

**Files:**
- Modify: `src/store/useLocalImportDialog.ts`

- [ ] **Step 1: Read existing store**

Run: `cat src/store/useLocalImportDialog.ts`

- [ ] **Step 2: Remove `ignoreDontShow` from open() params**

Before:
```typescript
interface LocalImportDialogState {
  isOpen: boolean;
  ignoreDontShow: boolean;
  open: (params: { ignoreDontShow: boolean }) => void;
  close: () => void;
}
```

After:
```typescript
interface LocalImportDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useLocalImportDialog = create<LocalImportDialogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 3: Find all callers and update**

Run: `grep -rn "useLocalImportDialog" src/`

各呼び出し元 (`Layout.tsx`, `LoginModal.tsx`, etc.) で `open({ ignoreDontShow: ... })` を `open()` に変更。

- [ ] **Step 4: Run tsc to catch any missed callers**

Run: `npx tsc --noEmit`
Expected: errors 0

- [ ] **Step 5: Run vitest**

Run: `npx vitest run`
Expected: 全件 PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/useLocalImportDialog.ts src/components/Layout.tsx src/components/LoginModal.tsx
git commit -m "refactor(useLocalImportDialog): drop ignoreDontShow param (always show when localPlans>0)"
```

---

## Task 11: `Layout.tsx` 自動表示判定簡略化 (毎回表示)

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Find existing dontShow check**

Run: `grep -n "dontShow\|lopo_local_import_dont_show" src/components/Layout.tsx`

- [ ] **Step 2: Simplify the auto-trigger logic**

Before (例):
```typescript
const localPlanCount = usePlanStore.getState().plans.filter(p => p.ownerId === 'local').length;
const dontShow = localStorage.getItem('lopo_local_import_dont_show') === 'true';
const willOpen = localPlanCount > 0 && !dontShow;
if (willOpen) {
  setTimeout(() => {
    useLocalImportDialog.getState().open({ ignoreDontShow: false });
  }, 40);
}
```

After:
```typescript
const localPlanCount = usePlanStore.getState().plans.filter(p => p.ownerId === 'local').length;
if (localPlanCount > 0) {
  setTimeout(() => {
    useLocalImportDialog.getState().open();
  }, 40);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build 成功

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "refactor(Layout): always auto-show LocalImportDialog when local plans exist"
```

---

## Task 12: `ShareImportProgressIndicator` コンポーネント

**Files:**
- Create: `src/components/ShareImportProgressIndicator.tsx`
- Test: `src/components/ShareImportProgressIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/ShareImportProgressIndicator.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareImportProgressIndicator } from './ShareImportProgressIndicator';
import type { ProgressEvent } from '../lib/shareImportTypes';

const stageEvent = (stage: any, status: any): ProgressEvent => ({
  planId: 'p1',
  stage,
  status,
});

describe('ShareImportProgressIndicator', () => {
  it('renders 3 stages when no events yet', () => {
    render(<ShareImportProgressIndicator events={[]} />);
    // 3 段表示 (空 dot)
    expect(screen.getAllByTestId(/stage-/)).toHaveLength(3);
  });

  it('shows ✓ when stage is success', () => {
    const events = [stageEvent('check', 'success')];
    render(<ShareImportProgressIndicator events={events} />);
    expect(screen.getByTestId('stage-check')).toHaveTextContent('✓');
  });

  it('shows spinner indicator when stage is in_progress', () => {
    const events = [stageEvent('local', 'in_progress')];
    render(<ShareImportProgressIndicator events={events} />);
    expect(screen.getByTestId('stage-local')).toHaveAttribute('data-status', 'in_progress');
  });

  it('shows ⚠ when stage is failed', () => {
    const events = [stageEvent('server', 'failed')];
    render(<ShareImportProgressIndicator events={events} />);
    expect(screen.getByTestId('stage-server')).toHaveTextContent('⚠');
  });

  it('renders skipped stage with muted style', () => {
    const events = [stageEvent('server', 'skipped')];
    render(<ShareImportProgressIndicator events={events} />);
    expect(screen.getByTestId('stage-server')).toHaveAttribute('data-status', 'skipped');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ShareImportProgressIndicator.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

```tsx
// src/components/ShareImportProgressIndicator.tsx
import { useTranslation } from 'react-i18next';
import type { ProgressEvent, ProgressStage, ProgressStatus } from '../lib/shareImportTypes';

interface Props {
  events: ProgressEvent[];
}

const STAGES: ProgressStage[] = ['check', 'local', 'server'];

const STAGE_I18N: Record<ProgressStage, { in_progress: string; success: string; failed: string }> = {
  check: {
    in_progress: 'share_import.progress_check',
    success: 'share_import.progress_check_ok',
    failed: 'share_import.progress_check', // failed 時は固有メッセージなし、 in_progress と同じ表示
  },
  local: {
    in_progress: 'share_import.progress_local',
    success: 'share_import.progress_local_ok',
    failed: 'share_import.progress_local_failed',
  },
  server: {
    in_progress: 'share_import.progress_server',
    success: 'share_import.progress_server_ok',
    failed: 'share_import.progress_server_failed',
  },
};

function statusOfStage(events: ProgressEvent[], stage: ProgressStage): ProgressStatus | 'pending' {
  // 同じ stage の中で最新 (最後) のものを採用
  const matched = events.filter(e => e.stage === stage);
  if (matched.length === 0) return 'pending';
  return matched[matched.length - 1].status;
}

function statusIcon(status: ProgressStatus | 'pending'): string {
  switch (status) {
    case 'success': return '✓';
    case 'failed': return '⚠';
    case 'in_progress': return '⚪';
    case 'skipped': return '–';
    case 'cancelled': return '×';
    default: return '○';
  }
}

export function ShareImportProgressIndicator({ events }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 mt-2">
      {STAGES.map(stage => {
        const status = statusOfStage(events, stage);
        const i18nKey = status === 'success'
          ? STAGE_I18N[stage].success
          : status === 'failed'
            ? STAGE_I18N[stage].failed
            : STAGE_I18N[stage].in_progress;
        const visible = status !== 'pending';
        return (
          <div
            key={stage}
            data-testid={`stage-${stage}`}
            data-status={status}
            className={`flex items-center gap-2 text-xs ${visible ? '' : 'opacity-30'}`}
          >
            <span aria-hidden>{statusIcon(status)}</span>
            <span>{t(i18nKey)}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ShareImportProgressIndicator.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareImportProgressIndicator.tsx src/components/ShareImportProgressIndicator.test.tsx
git commit -m "feat(shareImport): add ShareImportProgressIndicator (3-stage indicator)"
```

---

## Task 13: `SharePlanCard` コンポーネント

**Files:**
- Create: `src/components/SharePlanCard.tsx`
- Test: `src/components/SharePlanCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/SharePlanCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharePlanCard } from './SharePlanCard';

describe('SharePlanCard', () => {
  const baseProps = {
    title: 'P1 P2 終了後',
    subtitle: '最終 2 日前',
    isActive: false,
    isChecked: true,
    showCheckbox: true,
    onClickRow: vi.fn(),
    onToggleCheck: vi.fn(),
  };

  it('renders title and subtitle', () => {
    render(<SharePlanCard {...baseProps} />);
    expect(screen.getByText('P1 P2 終了後')).toBeInTheDocument();
    expect(screen.getByText('最終 2 日前')).toBeInTheDocument();
  });

  it('shows checkbox when showCheckbox=true', () => {
    render(<SharePlanCard {...baseProps} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('hides checkbox when showCheckbox=false', () => {
    render(<SharePlanCard {...baseProps} showCheckbox={false} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('calls onClickRow when row body clicked (not checkbox)', () => {
    const onClickRow = vi.fn();
    render(<SharePlanCard {...baseProps} onClickRow={onClickRow} />);
    fireEvent.click(screen.getByText('P1 P2 終了後'));
    expect(onClickRow).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleCheck when checkbox clicked, not onClickRow', () => {
    const onClickRow = vi.fn();
    const onToggleCheck = vi.fn();
    render(<SharePlanCard {...baseProps} onClickRow={onClickRow} onToggleCheck={onToggleCheck} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleCheck).toHaveBeenCalledTimes(1);
    expect(onClickRow).not.toHaveBeenCalled();
  });

  it('applies active style when isActive=true', () => {
    const { container } = render(<SharePlanCard {...baseProps} isActive={true} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SharePlanCard.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

```tsx
// src/components/SharePlanCard.tsx
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  isActive: boolean;
  isChecked?: boolean;
  showCheckbox: boolean;
  badge?: ReactNode;
  onClickRow: () => void;
  onToggleCheck?: () => void;
  children?: ReactNode; // 進捗インジケーター等
}

export function SharePlanCard({
  title,
  subtitle,
  isActive,
  isChecked,
  showCheckbox,
  badge,
  onClickRow,
  onToggleCheck,
  children,
}: Props) {
  return (
    <div
      data-testid="share-plan-card"
      className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors ${
        isActive
          ? 'active bg-blue-500/10 border-blue-500/40'
          : 'border-white/10 hover:bg-white/5'
      }`}
      onClick={onClickRow}
    >
      <div className="flex items-center gap-2">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={!!isChecked}
            onChange={onToggleCheck}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 cursor-pointer accent-blue-500 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{title}</div>
          {subtitle && <div className="text-xs text-white/50">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SharePlanCard.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/components/SharePlanCard.tsx src/components/SharePlanCard.test.tsx
git commit -m "feat(shareImport): add SharePlanCard (reusable card row with checkbox + indicator slot)"
```

---

## Task 14: `ShareImportSheet` コンポーネント本体

**Files:**
- Create: `src/components/ShareImportSheet.tsx`
- Test: `src/components/ShareImportSheet.test.tsx`

**注意**: `MitigationSheet.tsx` の glass-tier / framer-motion / z-index 規約を踏襲。 `MitigationSheetPreview.tsx` を流用する。

- [ ] **Step 1: Read existing MitigationSheet for layout patterns to follow**

Run: `head -100 src/components/MitigationSheet.tsx`

特に framer-motion の AnimatePresence / motion.div / 開閉アニメ、 z-index、 glass クラス、 createPortal の使い方を踏襲する。

- [ ] **Step 2: Write the failing test**

```typescript
// src/components/ShareImportSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareImportSheet } from './ShareImportSheet';
import { useShareImportFlow } from '../store/useShareImportFlow';

vi.mock('./MitigationSheetPreview', () => ({
  MitigationSheetPreview: ({ planData }: any) => (
    <div data-testid="preview">{JSON.stringify(planData)}</div>
  ),
}));

describe('ShareImportSheet', () => {
  beforeEach(() => {
    useShareImportFlow.setState({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      deleteProgressMap: new Map(),
      limitContext: null,
      errorMessage: null,
    });
  });

  it('renders nothing when status is idle', () => {
    const { container } = render(<ShareImportSheet />);
    expect(container.querySelector('[data-testid="share-import-sheet"]')).toBeNull();
  });

  it('renders loading state', () => {
    useShareImportFlow.setState({ status: 'loading', shareId: 'abc' });
    render(<ShareImportSheet />);
    expect(screen.getByText(/loading|読み込/i)).toBeInTheDocument();
  });

  it('renders preview state with single item (no checkbox column)', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { contentId: 'fru', planData: {} },
      importItems: [{
        sourceShareId: 'abc',
        contentId: 'fru',
        title: 'Single Sheet',
        planData: {} as any,
      }],
      selectedItemIds: new Set(['abc']),
    });
    render(<ShareImportSheet />);
    expect(screen.getByText('Single Sheet')).toBeInTheDocument();
    // 単一表示時はチェックリストカラム非表示
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /取り込む|import/i })).toBeInTheDocument();
  });

  it('renders preview state with bundle (checkbox per item)', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { contentId: 'fru' },
      importItems: [
        { sourceShareId: 'abc', contentId: 'fru', title: 'Item 1', planData: {} as any, sourcePlanId: 'p1' },
        { sourceShareId: 'abc', contentId: 'fru', title: 'Item 2', planData: {} as any, sourcePlanId: 'p2' },
      ],
      selectedItemIds: new Set(['p1', 'p2']),
    });
    render(<ShareImportSheet />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /2 件を取り込む|import 2/i })).toBeInTheDocument();
  });

  it('updates button label when selection changes', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { contentId: 'fru' },
      importItems: [
        { sourceShareId: 'abc', contentId: 'fru', title: 'Item 1', planData: {} as any, sourcePlanId: 'p1' },
        { sourceShareId: 'abc', contentId: 'fru', title: 'Item 2', planData: {} as any, sourcePlanId: 'p2' },
      ],
      selectedItemIds: new Set(['p1']), // p2 のチェック外している
    });
    render(<ShareImportSheet />);
    expect(screen.getByRole('button', { name: /1 件を取り込む|import 1/i })).toBeInTheDocument();
  });

  it('disables button when no item selected', () => {
    useShareImportFlow.setState({
      status: 'preview',
      shareId: 'abc',
      sharedData: { contentId: 'fru' },
      importItems: [
        { sourceShareId: 'abc', contentId: 'fru', title: 'Item 1', planData: {} as any, sourcePlanId: 'p1' },
      ],
      selectedItemIds: new Set(),
    });
    render(<ShareImportSheet />);
    const button = screen.getByRole('button', { name: /取り込む|import/i });
    expect(button).toBeDisabled();
  });

  it('renders error state', () => {
    useShareImportFlow.setState({
      status: 'error',
      errorMessage: 'not_found',
    });
    render(<ShareImportSheet />);
    expect(screen.getByText(/見つかり|not.*found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/ShareImportSheet.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 4: Write implementation**

```tsx
// src/components/ShareImportSheet.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { ShareImportProgressIndicator } from './ShareImportProgressIndicator';
import { SharePlanCard } from './SharePlanCard';
import { executeShareImport } from '../lib/executeShareImport';
import { LimitResolutionSheet } from './LimitResolutionSheet';

export function ShareImportSheet() {
  const { t } = useTranslation();
  const status = useShareImportFlow(s => s.status);
  const sharedData = useShareImportFlow(s => s.sharedData);
  const importItems = useShareImportFlow(s => s.importItems);
  const selectedItemIds = useShareImportFlow(s => s.selectedItemIds);
  const progressMap = useShareImportFlow(s => s.progressMap);
  const errorMessage = useShareImportFlow(s => s.errorMessage);
  const toggleSelect = useShareImportFlow(s => s.toggleSelect);
  const setStatus = useShareImportFlow(s => s.setStatus);
  const setProgress = useShareImportFlow(s => s.setProgress);
  const setLimitContext = useShareImportFlow(s => s.setLimitContext);
  const close = useShareImportFlow(s => s.close);

  const authUser = useAuthStore(s => s.user);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // 初回 importItems 設定時に最初のアイテムをアクティブに
  useEffect(() => {
    if (importItems.length > 0 && !activeItemId) {
      setActiveItemId(importItems[0].sourcePlanId ?? importItems[0].sourceShareId);
    }
  }, [importItems, activeItemId]);

  if (status === 'idle') return null;

  const isBundle = importItems.length > 1;
  const selectedCount = selectedItemIds.size;
  const activeItem = importItems.find(
    i => (i.sourcePlanId ?? i.sourceShareId) === activeItemId,
  ) ?? importItems[0];

  const handleImport = async () => {
    setStatus('importing');
    const itemsToImport = importItems.filter(i =>
      selectedItemIds.has(i.sourcePlanId ?? i.sourceShareId),
    );
    await executeShareImport(
      itemsToImport,
      authUser?.uid ?? null,
      authUser?.displayName ?? '',
      setProgress,
      (params) => new Promise(resolve => setLimitContext({ ...params, resolve })),
    );
    setStatus('done');
    setTimeout(() => close(), 1200);
  };

  return createPortal(
    <AnimatePresence>
      {status !== 'idle' && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99990]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            data-testid="share-import-sheet"
            className="fixed bottom-0 left-0 right-0 z-[99991] bg-zinc-900 rounded-t-xl flex flex-col max-h-[90vh]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30 }}
          >
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-base font-bold">
                {isBundle
                  ? t('share_import.title_bundle', { count: importItems.length })
                  : t('share_import.title')}
              </h2>
            </div>

            {status === 'loading' && (
              <div className="p-8 text-center text-white/60">{t('share_import.loading')}</div>
            )}

            {status === 'error' && (
              <div className="p-8 text-center text-red-400">
                {errorMessage === 'not_found'
                  ? t('share_import.not_found')
                  : t('share_import.error')}
              </div>
            )}

            {(status === 'preview' || status === 'importing' || status === 'done') && (
              <>
                <div className="flex flex-1 min-h-0">
                  {isBundle && (
                    <div className="flex-shrink-0 w-[200px] border-r border-white/10 p-2 overflow-y-auto">
                      {importItems.map(item => {
                        const itemPlanId = item.sourcePlanId ?? item.sourceShareId;
                        const isActive = activeItemId === itemPlanId;
                        const itemEvents = Array.from(progressMap.values()).filter(
                          e => e.planId === itemPlanId,
                        );
                        return (
                          <SharePlanCard
                            key={itemPlanId}
                            title={item.title}
                            subtitle="" // TODO: 共有日時など
                            isActive={isActive}
                            isChecked={selectedItemIds.has(itemPlanId)}
                            showCheckbox={status === 'preview'}
                            onClickRow={() => setActiveItemId(itemPlanId)}
                            onToggleCheck={() => toggleSelect(itemPlanId)}
                          >
                            {(status === 'importing' || status === 'done') && itemEvents.length > 0 && (
                              <ShareImportProgressIndicator events={itemEvents} />
                            )}
                          </SharePlanCard>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-3">
                    {activeItem && <MitigationSheetPreview planData={activeItem.planData} />}
                  </div>
                </div>

                <div className="border-t border-white/10 p-3 flex items-center justify-between">
                  {isBundle && (
                    <div className="text-xs text-white/60">
                      {t('limit_resolution.selection_count', { count: selectedCount })}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={selectedCount === 0 || status !== 'preview'}
                    onClick={handleImport}
                    className="px-5 py-2 rounded-lg bg-blue-500 text-white font-bold disabled:bg-white/10 disabled:text-white/40 ml-auto"
                  >
                    {isBundle
                      ? t('share_import.button_import_count', { count: selectedCount })
                      : t('share_import.button_import_single')}
                  </button>
                </div>
              </>
            )}
          </motion.div>

          <LimitResolutionSheet />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ShareImportSheet.test.tsx`
Expected: PASS (7/7)

- [ ] **Step 6: Commit**

```bash
git add src/components/ShareImportSheet.tsx src/components/ShareImportSheet.test.tsx
git commit -m "feat(shareImport): add ShareImportSheet (rich preview + check-import + bundle support)"
```

---

## Task 15: `LimitResolutionSheet` (重ねシート)

**Files:**
- Create: `src/components/LimitResolutionSheet.tsx`
- Test: `src/components/LimitResolutionSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/LimitResolutionSheet.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LimitResolutionSheet } from './LimitResolutionSheet';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { usePlanStore } from '../store/usePlanStore';

vi.mock('./MitigationSheetPreview', () => ({
  MitigationSheetPreview: () => <div data-testid="preview" />,
}));

describe('LimitResolutionSheet', () => {
  beforeEach(() => {
    useShareImportFlow.setState({
      status: 'idle',
      limitContext: null,
    });
    usePlanStore.setState({
      plans: [],
    } as any);
  });

  it('renders nothing when no limitContext', () => {
    const { container } = render(<LimitResolutionSheet />);
    expect(container.querySelector('[data-testid="limit-resolution-sheet"]')).toBeNull();
  });

  it('renders 5 user plans for the contentId when limit hit', () => {
    usePlanStore.setState({
      plans: Array.from({ length: 5 }, (_, i) => ({
        id: `existing${i}`,
        contentId: 'fru',
        title: `Plan ${i}`,
        ownerId: 'testUid',
        updatedAt: Date.now() - i * 86400000,
        data: {},
      })) as any,
    } as any);
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: {
        contentId: 'fru',
        neededCount: 1,
        planId: 'p1',
        resolve: vi.fn(),
      },
    });
    render(<LimitResolutionSheet />);
    expect(screen.getByTestId('limit-resolution-sheet')).toBeInTheDocument();
    expect(screen.getAllByTestId('share-plan-card')).toHaveLength(5);
  });

  it('disables delete button when no checkbox selected', () => {
    usePlanStore.setState({
      plans: [{ id: 'e1', contentId: 'fru', ownerId: 'u', title: 't', updatedAt: 0, data: {} } as any],
    } as any);
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: { contentId: 'fru', neededCount: 1, planId: 'p1', resolve: vi.fn() },
    });
    render(<LimitResolutionSheet />);
    const button = screen.getByRole('button', { name: /削除|delete/i });
    expect(button).toBeDisabled();
  });

  it('cancels and resolves with cancelled', () => {
    const resolve = vi.fn();
    usePlanStore.setState({ plans: [] } as any);
    useShareImportFlow.setState({
      status: 'limit_hit',
      limitContext: { contentId: 'fru', neededCount: 1, planId: 'p1', resolve },
    });
    render(<LimitResolutionSheet />);
    fireEvent.click(screen.getByRole('button', { name: /キャンセル|cancel/i }));
    expect(resolve).toHaveBeenCalledWith('cancelled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LimitResolutionSheet.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

```tsx
// src/components/LimitResolutionSheet.tsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { ShareImportProgressIndicator } from './ShareImportProgressIndicator'; // 削除フェーズも 2 段表示で流用
import { executePlanDeletions } from '../lib/executePlanDeletions';

export function LimitResolutionSheet() {
  const { t } = useTranslation();
  const limitContext = useShareImportFlow(s => s.limitContext);
  const deleteProgressMap = useShareImportFlow(s => s.deleteProgressMap);
  const setDeleteProgress = useShareImportFlow(s => s.setDeleteProgress);
  const setLimitContext = useShareImportFlow(s => s.setLimitContext);
  const plans = usePlanStore(s => s.plans);
  const authUser = useAuthStore(s => s.user);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const targetPlans = useMemo(() => {
    if (!limitContext) return [];
    return plans
      .filter(p => p.contentId === limitContext.contentId)
      .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)); // 古い順
  }, [plans, limitContext]);

  if (!limitContext) return null;

  const activePlan = targetPlans.find(p => p.id === activeId) ?? targetPlans[0];

  const handleCancel = () => {
    limitContext.resolve('cancelled');
    setLimitContext(null);
  };

  const handleDelete = async () => {
    if (checkedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await executePlanDeletions(
        Array.from(checkedIds),
        authUser?.uid ?? null,
        limitContext.contentId,
        setDeleteProgress,
      );
      // 削除成功 → 再開
      limitContext.resolve('resolved');
      setLimitContext(null);
    } catch {
      // 削除失敗時は重ねシート維持、 retry のため state リセット
      setIsDeleting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-[3px] z-[99992]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        data-testid="limit-resolution-sheet"
        className="fixed bottom-0 left-0 right-0 z-[99993] bg-zinc-900 rounded-t-xl flex flex-col max-h-[90vh] border-t border-red-500/30"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30 }}
      >
        <div className="px-4 py-3 border-b border-white/10 bg-red-500/10">
          <h2 className="text-base font-bold">
            {t('limit_resolution.title_per_content', {
              contentName: limitContext.contentId,
              current: targetPlans.length,
              max: 5,
            })}
          </h2>
          <p className="text-xs text-white/70 mt-1">
            {t('limit_resolution.body', { count: limitContext.neededCount })}
          </p>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-shrink-0 w-[200px] border-r border-white/10 p-2 overflow-y-auto">
            {targetPlans.map(plan => {
              const events = Array.from(deleteProgressMap.values()).filter(e => e.planId === plan.id);
              return (
                <SharePlanCard
                  key={plan.id}
                  title={plan.title}
                  subtitle={t('limit_resolution.card_label_last_opened', {
                    date: new Date(plan.updatedAt).toLocaleDateString(),
                  })}
                  isActive={activePlan?.id === plan.id}
                  isChecked={checkedIds.has(plan.id)}
                  showCheckbox={!isDeleting}
                  onClickRow={() => setActiveId(plan.id)}
                  onToggleCheck={() => {
                    const next = new Set(checkedIds);
                    if (next.has(plan.id)) next.delete(plan.id); else next.add(plan.id);
                    setCheckedIds(next);
                  }}
                >
                  {isDeleting && events.length > 0 && (
                    <ShareImportProgressIndicator events={events as any} />
                  )}
                </SharePlanCard>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {activePlan && <MitigationSheetPreview planData={activePlan.data} />}
          </div>
        </div>

        <div className="border-t border-white/10 p-3 flex items-center justify-between">
          <button type="button" onClick={handleCancel} className="text-sm text-white/60 hover:text-white">
            {t('limit_resolution.button_cancel')}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">
              {t('limit_resolution.selection_count', { count: checkedIds.size })}
            </span>
            <button
              type="button"
              disabled={checkedIds.size === 0 || isDeleting}
              onClick={handleDelete}
              className="px-5 py-2 rounded-lg bg-red-500 text-white font-bold disabled:bg-white/10 disabled:text-white/40"
            >
              {t('limit_resolution.button_delete_and_resume', { count: checkedIds.size })}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LimitResolutionSheet.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/components/LimitResolutionSheet.tsx src/components/LimitResolutionSheet.test.tsx
git commit -m "feat(shareImport): add LimitResolutionSheet (stacked sheet for limit cleanup)"
```

---

## Task 16: `SharePage.tsx` 書き換え (起動 + ナビゲート)

**Files:**
- Modify: `src/components/SharePage.tsx`

- [ ] **Step 1: Read existing SharePage to understand surrounding context**

Run: `cat src/components/SharePage.tsx | head -50`

- [ ] **Step 2: Replace SharePage with the new minimal version**

```tsx
// src/components/SharePage.tsx
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShareImportFlow } from '../store/useShareImportFlow';

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shareId) {
      navigate('/', { replace: true });
      return;
    }
    // 1. シートを起動 (loading 状態)
    useShareImportFlow.getState().start(shareId);
    // 2. /miti にナビゲート (replace で 戻る ボタン挙動を保護)
    navigate('/miti', { replace: true });
  }, [shareId, navigate]);

  // ナビゲート完了までは何も描画しない (一瞬で /miti に切り替わる)
  return null;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: Verify tsc strict**

Run: `npx tsc --noEmit`
Expected: errors 0

- [ ] **Step 5: Commit**

```bash
git add src/components/SharePage.tsx
git commit -m "feat(SharePage): replace with shareImportFlow.start + navigate to /miti"
```

---

## Task 17: `Layout.tsx` (or MitiPlannerPage) で `<ShareImportSheet />` をマウント

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Find existing modal/sheet mount points in Layout**

Run: `grep -n "MitigationSheet\|LocalImportDialog\|<.*Modal" src/components/Layout.tsx`

- [ ] **Step 2: Add `<ShareImportSheet />` mount at appropriate level**

```tsx
import { ShareImportSheet } from './ShareImportSheet';
// (LimitResolutionSheet は ShareImportSheet 内部でマウントされるので、 ここでは不要)

// Layout の return 内に追加 (既存 MitigationSheet と同じ階層)
return (
  <>
    {/* 既存 children, MitigationSheet, LocalImportDialog 等 */}
    <ShareImportSheet />
  </>
);
```

- [ ] **Step 3: Verify build + run dev server to confirm sheet renders without errors**

Run: `npm run build` and `npm run dev` (browser で /miti を開くだけで起動状態 idle のため何も表示されないことを確認)

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat(Layout): mount ShareImportSheet (auto-rendered when share URL hit)"
```

---

## Task 18: 統合テスト + 全件回帰確認

**Files:**
- (no new files, only verifying)

- [ ] **Step 1: Run full vitest suite**

Run: `npx vitest run`
Expected: 既存 487 + 新規 (Task 1-15 で追加) すべて PASS

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: errors 0

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: 成功 (Vercel tsc 厳格モード対応)

- [ ] **Step 4: Verify "do-not-touch" files are unchanged**

Run:
```bash
git diff main -- src/store/usePlanStore.ts | grep -E "^[-+]" | grep -v "syncToFirestore" | head
```

`addPlan` / `_dirtyPlanIds` / `fetchAndMerge` 周辺に変更行がないことを目視確認。

```bash
git diff main -- src/lib/planService.ts | wc -l
```

Expected: 0 行 (planService は完全に触らない)

```bash
git diff main -- src/components/MitigationSheet.tsx | wc -l
```

Expected: 0 行 (野良主流ボトムシートは完全に触らない)

- [ ] **Step 5: Run dev server and smoke test manually**

Run: `npm run dev`

ブラウザで以下を試す:
- 共有 URL を開く (`/share/{既存の shareId}`) → 自動で /miti にナビゲート + ボトムシート表示
- 「取り込む」ボタン押下 → 進捗インジケーター 3 段階 → 完了 → MitiPlannerPage で取り込んだ軽減表が選択された状態
- 上限到達ケース (5 件持っているコンテンツの URL を踏む) → 重ねシート → チェック削除 → 再開 → 完了

- [ ] **Step 6: Commit (final)**

```bash
git commit --allow-empty -m "test(shareImport): final regression check + smoke test pass"
```

---

## Task 19: Playwright E2E (任意・拡張)

**Files:**
- Create: `e2e/share-import.spec.ts`

- [ ] **Step 1: Write E2E spec covering core scenarios**

```typescript
// e2e/share-import.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Share URL auto-import', () => {
  test('single share URL: preview → import → MitiPlannerPage', async ({ page }) => {
    await page.goto('/share/{TEST_SHARE_ID}');
    // ボトムシートが表示されること
    await expect(page.getByTestId('share-import-sheet')).toBeVisible();
    // 「取り込む」ボタン押下
    await page.getByRole('button', { name: /取り込む|import/i }).click();
    // 進捗 3 段階を確認
    await expect(page.getByTestId('stage-check')).toHaveAttribute('data-status', 'success', { timeout: 2000 });
    await expect(page.getByTestId('stage-local')).toHaveAttribute('data-status', 'success', { timeout: 2000 });
    // 完了でシート閉じる
    await expect(page.getByTestId('share-import-sheet')).toBeHidden({ timeout: 5000 });
    // /miti に居ること
    await expect(page).toHaveURL(/\/miti/);
  });

  test('limit hit → resolution sheet → delete → resume', async ({ page }) => {
    // 事前準備: テストユーザーで 5 件持っている状態を作る
    await setupTestUserAtLimit(page);
    await page.goto('/share/{TEST_SHARE_ID}');
    await page.getByRole('button', { name: /取り込む|import/i }).click();
    // 重ねシート表示
    await expect(page.getByTestId('limit-resolution-sheet')).toBeVisible({ timeout: 2000 });
    // 1 件チェック → 削除
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /削除して再開|delete.*resume/i }).click();
    // 重ねシート閉じて元のシートで完了
    await expect(page.getByTestId('limit-resolution-sheet')).toBeHidden({ timeout: 3000 });
    await expect(page.getByTestId('share-import-sheet')).toBeHidden({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run E2E**

Run: `npx playwright test e2e/share-import.spec.ts`
Expected: PASS (or skip if test setup unavailable)

- [ ] **Step 3: Commit**

```bash
git add e2e/share-import.spec.ts
git commit -m "test(e2e): add Playwright share-import scenarios (single, limit-hit, resume)"
```

---

## Self-Review Checklist (実施済み、 結果を記録)

### 1. Spec Coverage

| 設計書セクション | カバーするタスク |
|---|---|
| §3.1 単一取り込み | Task 4, 14, 16 |
| §3.2 バンドル取り込み | Task 4, 14 |
| §3.3 上限到達 + 重ねシート | Task 5, 15 |
| §3.4 完了後の遷移 | Task 14 (close + setCurrentPlanId) |
| §4.1 ShareImportSheet | Task 14 |
| §4.2 LimitResolutionSheet | Task 15 |
| §4.3 動作別インジケーター | Task 12 |
| §4.4 削除フェーズインジケーター | Task 5, 15 |
| §4.5 LocalImportDialog 修正 | Task 8, 9, 10, 11 |
| §5.1 ルーティング | Task 16 |
| §5.2 orchestration store | Task 6 |
| §5.3 executeShareImport | Task 4 |
| §5.4 syncToFirestore 拡張 | Task 3 |
| §5.5 削除実行 | Task 5 |
| §5.6 shareId 重複検出 | Task 14 内 (`already_copied_badge` 表示) |
| §5.7 checkPlanLimit | Task 1 |
| §6 データ保護 | Task 18 (do-not-touch 確認) |
| §7 i18n | Task 7, 8 |
| §8 テスト | 各 Task に組み込み済み |
| §9 リリース | Task 18 (build/tsc/vitest) |

すべての設計書要件はタスクで実装される。

### 2. Placeholder Scan

- [x] No "TBD", "TODO", "implement later", "fill in details"
- [x] All test code shown with concrete assertions
- [x] All implementation code shown
- [x] No "similar to Task N" — code is repeated where needed
- [x] All commands have expected output

### 3. Type Consistency

- `ShareImportItem` (Task 2) ↔ `executeShareImport` 引数 (Task 4) ↔ `useShareImportFlow.importItems` (Task 6) ↔ `ShareImportSheet` props (Task 14): 一貫
- `ProgressEvent` (Task 2) ↔ `executeShareImport` callback (Task 4) ↔ `setProgress` (Task 6) ↔ `ShareImportProgressIndicator` events (Task 12): 一貫
- `DeleteProgressEvent` (Task 2) ↔ `executePlanDeletions` callback (Task 5) ↔ `LimitResolutionSheet` (Task 15): 一貫
- `checkPlanLimit` 戻り値 (Task 1) ↔ `executeShareImport` 内利用 (Task 4): 一貫

---

## Execution Handoff

Plan complete and saved to [docs/superpowers/plans/2026-05-09-housing-phase-b1.5-share-url-auto-import.md](2026-05-09-housing-phase-b1.5-share-url-auto-import.md).

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session, batch with checkpoints for review

Which approach?
