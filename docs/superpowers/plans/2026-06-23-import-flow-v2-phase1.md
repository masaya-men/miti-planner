# 取込フロー v2（前半）Implementation Plan — ①満杯時削除取込 + ③コンテンツ選択前段化

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スプシ取込で「取込前にコンテンツを選べる（誤紐付け根治）」「満杯時は既存表を削除して取り込める（既存 LimitResolutionSheet 流用）」を実現する。

**Architecture:** コンテンツ選択の純ロジックを `contentSelection.ts` に切り出し、新規作成画面と取込モーダルで共有。取込確定＋満杯ゲートを `importWithLimitCheck.ts` に切り出し、満杯時は共有取込で実績のある `LimitResolutionSheet`（`useShareImportFlow.setLimitContext` 経由）を流用。`LimitResolutionSheet` のマウントは `Layout` へ一元化。

**Tech Stack:** React 18 + TypeScript（strict / erasableSyntaxOnly）、zustand、framer-motion、react-i18next、vitest（pool='vmThreads'）。

**設計書:** [docs/superpowers/specs/2026-06-23-import-flow-v2-phase1-design.md](../specs/2026-06-23-import-flow-v2-phase1-design.md)

## Global Constraints

- 言語: コード/コメント/ドキュメントは日本語。
- UIテキストは i18n キー経由（ハードコード禁止）。4言語（ja/en/ko/zh）に追加。英語モードで崩れないこと。
- 色は機能色のみ（青=進む/OK・赤=危険/削除・黄=警告）、それ以外は白黒トークン（`app-*`）経由。px直書き禁止・`--font-size-*`/`text-app-*` トークン経由。
- 確定パイプラインの順序を変えない: `commitNewPlan`（addPlan→setLoadedPlanId→setCurrentPlanId）、`commitImportedPlan`（disconnect→exitCollabMode→直前保存→loadSnapshot）。
- 共有取込フロー（`executeShareImport`/`ShareImportSheet` の取込・削除ロジック）の挙動は変えない。接触は `LimitResolutionSheet` のマウント移動1点のみ。
- Vercel は `tsc -b` 厳密（未使用 import/変数で build 失敗）。push 前に `npm run build` + `vitest run` 必須。
- 上限定数は `PLAN_LIMITS`（`MAX_TOTAL_PLANS=50` / `MAX_PLANS_PER_CONTENT=5`）を参照（ハードコード禁止）。

## File Structure

- **新規** `src/lib/contentSelection.ts` — `hasContentRegistry` / `getFilteredBosses` / `deriveContentId` / 型 `ContentSelectionDefault`。コンテンツ選択の純ロジック。
- **新規** `src/lib/contentSelection.test.ts`（or `src/lib/__tests__/contentSelection.test.ts`）— 上記の単体テスト。
- **新規** `src/lib/sheetImport/importWithLimitCheck.ts` — 取込確定＋満杯ゲート（`LimitResolutionSheet` 待ち）。
- **新規** `src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts` — 上記の単体テスト。
- **改修** `src/components/NewPlanModal.tsx` — 選択ロジックを `contentSelection.ts` 呼び出しに差し替え（JSX不変）。
- **改修** `src/components/Layout.tsx` — `<LimitResolutionSheet />` を単一マウント。
- **改修** `src/components/ShareImportSheet.tsx` — 内部の `<LimitResolutionSheet />` とその import を撤去。
- **改修** `src/components/SpreadsheetImportModal.tsx` — 先頭にコンテンツ選択UI、`onImport` を `(result,{contentId})=>Promise<boolean>` に、`defaultSelection` Props、`handleConfirm` async化。
- **改修** `src/components/Timeline.tsx` — `handleSheetImport` を async＋`importWithLimitCheck`＋`opts.contentId`、`defaultSelection` 組み立て＆受け渡し。
- **改修** `src/locales/{ja,en,ko,zh}.json` — `sheetImport.target_content_label` 追加。

---

## Task 1: コンテンツ選択の純ロジックを `contentSelection.ts` に切り出す

**Files:**
- Create: `src/lib/contentSelection.ts`
- Test: `src/lib/__tests__/contentSelection.test.ts`

**Interfaces:**
- Consumes: `ContentLevel`, `ContentCategory`, `ContentDefinition`（`src/types`）、`getSeriesByLevel`, `getContentBySeries`（`src/data/contentRegistry`）。
- Produces:
  - `hasContentRegistry(cat: ContentCategory | null): cat is 'savage' | 'ultimate'`
  - `getFilteredBosses(level: ContentLevel | null, category: ContentCategory | null): ContentDefinition[]`
  - `deriveContentId(boss: ContentDefinition | null, category: ContentCategory | null, title: string): string | null`
  - `interface ContentSelectionDefault { contentId: string | null; level: ContentLevel | null; category: ContentCategory | null; title: string }`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/contentSelection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hasContentRegistry, getFilteredBosses, deriveContentId } from '../contentSelection';
import type { ContentDefinition } from '../../types';

const mkBoss = (id: string): ContentDefinition => ({ id } as ContentDefinition);

describe('hasContentRegistry', () => {
  it('savage / ultimate は true', () => {
    expect(hasContentRegistry('savage')).toBe(true);
    expect(hasContentRegistry('ultimate')).toBe(true);
  });
  it('dungeon / raid / custom / null は false', () => {
    expect(hasContentRegistry('dungeon')).toBe(false);
    expect(hasContentRegistry('raid')).toBe(false);
    expect(hasContentRegistry('custom')).toBe(false);
    expect(hasContentRegistry(null)).toBe(false);
  });
});

describe('getFilteredBosses', () => {
  it('level が null なら空配列', () => {
    expect(getFilteredBosses(null, 'savage')).toEqual([]);
  });
  it('非Registry系カテゴリなら空配列', () => {
    expect(getFilteredBosses(100, 'dungeon')).toEqual([]);
    expect(getFilteredBosses(100, null)).toEqual([]);
  });
  it('Registry系 + level 指定で配列を返す（型は ContentDefinition[]）', () => {
    const result = getFilteredBosses(100, 'savage');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('deriveContentId', () => {
  it('boss があれば boss.id', () => {
    expect(deriveContentId(mkBoss('fru'), 'ultimate', '無視される')).toBe('fru');
  });
  it('Registry系で boss 無しなら null', () => {
    expect(deriveContentId(null, 'savage', 'なにか')).toBeNull();
  });
  it('非Registry系は title.trim()', () => {
    expect(deriveContentId(null, 'dungeon', '  AAC ライトヘビー  ')).toBe('AAC ライトヘビー');
  });
  it('非Registry系で title 空なら null', () => {
    expect(deriveContentId(null, 'dungeon', '   ')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/__tests__/contentSelection.test.ts`
Expected: FAIL（`contentSelection` モジュール未作成）

- [ ] **Step 3: 実装を書く**

`src/lib/contentSelection.ts`:
```ts
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { getSeriesByLevel, getContentBySeries } from '../data/contentRegistry';

/** 取込モーダル等へ「今開いているコンテンツ」を初期選択として渡すための型 */
export interface ContentSelectionDefault {
  contentId: string | null;
  level: ContentLevel | null;
  category: ContentCategory | null;
  title: string;
}

/** 零式・絶のみドロップダウン選択。それ以外は自由入力。 */
export function hasContentRegistry(
  cat: ContentCategory | null,
): cat is 'savage' | 'ultimate' {
  return cat === 'savage' || cat === 'ultimate';
}

/**
 * 零式・絶のコンテンツ一覧（フラットリスト）。
 * シリーズ単位で patch 降順、シリーズ内は registry 既定順。
 * NewPlanModal の filteredBosses と同一ロジック。
 */
export function getFilteredBosses(
  level: ContentLevel | null,
  category: ContentCategory | null,
): ContentDefinition[] {
  if (!level || !hasContentRegistry(category)) return [];
  const series = getSeriesByLevel(level).filter((s) => s.category === category);
  const seriesWithContents = series.map((s) => ({ series: s, contents: getContentBySeries(s.id) }));
  seriesWithContents.sort((a, b) => {
    const maxPatch = (items: ContentDefinition[]) =>
      items.reduce((acc, c) => (c.patch.localeCompare(acc, undefined, { numeric: true }) > 0 ? c.patch : acc), '0');
    return maxPatch(b.contents).localeCompare(maxPatch(a.contents), undefined, { numeric: true });
  });
  return seriesWithContents.flatMap((sc) => sc.contents);
}

/**
 * 選択状態から contentId を決める。
 * - 零式・絶: 選択ボスの id
 * - それ以外: 入力タイトル（空なら null）
 */
export function deriveContentId(
  boss: ContentDefinition | null,
  category: ContentCategory | null,
  title: string,
): string | null {
  if (boss) return boss.id;
  if (hasContentRegistry(category)) return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/contentSelection.test.ts`
Expected: PASS（全 it 緑）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/contentSelection.ts src/lib/__tests__/contentSelection.test.ts
rtk git commit -m "feat(import): コンテンツ選択の純ロジックをcontentSelection.tsに切り出し"
```

---

## Task 2: NewPlanModal を `contentSelection.ts` 利用に差し替え（JSX不変）

**Files:**
- Modify: `src/components/NewPlanModal.tsx:6-11`（import）, `:32-33`（local hasContentRegistry 削除）, `:77-87`（filteredBosses）, `:167`（contentId）

**Interfaces:**
- Consumes: Task 1 の `hasContentRegistry`, `getFilteredBosses`, `deriveContentId`。
- Produces: なし（既存挙動を維持）。

- [ ] **Step 1: import を差し替え**

`src/components/NewPlanModal.tsx` の contentRegistry import（6-10行目）から `getSeriesByLevel`, `getContentBySeries` を外し、`CATEGORY_LABELS` のみ残す。直後に contentSelection を import:
```ts
import {
    CATEGORY_LABELS,
} from '../data/contentRegistry';
import { hasContentRegistry, getFilteredBosses, deriveContentId } from '../lib/contentSelection';
```

- [ ] **Step 2: ローカル `hasContentRegistry` 定義を削除**

32-33行目の以下を削除（import 版を使う）:
```ts
// 零式・絶はドロップダウンから選択、それ以外は自由入力
const hasContentRegistry = (cat: ContentCategory | null): cat is 'savage' | 'ultimate' =>
    cat === 'savage' || cat === 'ultimate';
```

- [ ] **Step 3: `filteredBosses` を util 呼び出しに置換**

77-87行目の `React.useMemo` 本体を置換:
```ts
    const filteredBosses = React.useMemo(
        () => getFilteredBosses(level, category),
        [level, category],
    );
```

- [ ] **Step 4: contentId 算出を util 呼び出しに置換**

167行目を置換:
```ts
        const contentId = deriveContentId(boss, category, title);
```

- [ ] **Step 5: 型チェック＆既存テストが通ることを確認**

Run: `npx vitest run NewPlanModal`
Expected: PASS（NewPlanModal 関連テストが緑。テストが無い場合は次の tsc で担保）
Run: `npx tsc -b --pretty false`
Expected: エラーなし（未使用 import が残っていれば失敗するので、その場合は import を整理）

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/NewPlanModal.tsx
rtk git commit -m "refactor(new-plan): コンテンツ選択ロジックをcontentSelection.tsへ寄せる(JSX不変)"
```

---

## Task 3: 取込確定＋満杯ゲートを `importWithLimitCheck.ts` に切り出す

**Files:**
- Create: `src/lib/sheetImport/importWithLimitCheck.ts`
- Test: `src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts`

**Interfaces:**
- Consumes: `SheetImportResult`（`./buildPlanFromSheets`）、`checkPlanLimit`（`../../utils/planLimitChecker`）、`commitImportedPlan`（`./commitImportedPlan`）、`usePlanStore`（`../../store/usePlanStore`）、`useShareImportFlow`（`../../store/useShareImportFlow`）。
- Produces: `importWithLimitCheck(result: SheetImportResult, contentId: string | null, title: string): Promise<boolean>`（確定したら true、満杯シートでキャンセルなら false）。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { SavedPlan } from '../../../types';
import { PLAN_LIMITS } from '../../../types/firebase';
import { importWithLimitCheck } from '../importWithLimitCheck';
import { usePlanStore } from '../../../store/usePlanStore';
import { useShareImportFlow } from '../../../store/useShareImportFlow';
import { commitImportedPlan } from '../commitImportedPlan';

vi.mock('../../../store/usePlanStore', () => ({ usePlanStore: { getState: vi.fn() } }));
vi.mock('../../../store/useShareImportFlow', () => ({ useShareImportFlow: { getState: vi.fn() } }));
vi.mock('../commitImportedPlan', () => ({ commitImportedPlan: vi.fn(() => 'newPlanId') }));

const mkPlan = (id: string, contentId: string): SavedPlan => ({
  id, ownerId: 'local', ownerDisplayName: '', title: id, contentId,
  isPublic: false, copyCount: 0, useCount: 0, data: {} as any, createdAt: 0, updatedAt: 0,
});

const result = {
  timelineEvents: [], timelineMitigations: [], phases: [], labels: [], party: [], skipped: [],
} as any;

const setPlans = (plans: SavedPlan[]) =>
  (usePlanStore.getState as Mock).mockReturnValue({ plans });

let setLimitContext: Mock;
beforeEach(() => {
  vi.clearAllMocks();
  setLimitContext = vi.fn();
  (useShareImportFlow.getState as Mock).mockReturnValue({ setLimitContext });
  (commitImportedPlan as Mock).mockReturnValue('newPlanId');
});

describe('importWithLimitCheck', () => {
  it('上限内なら setLimitContext を呼ばず即 commit、true を返す', async () => {
    setPlans([mkPlan('p1', 'fru')]);
    const committed = await importWithLimitCheck(result, 'fru', 'タイトル');
    expect(committed).toBe(true);
    expect(setLimitContext).not.toHaveBeenCalled();
    expect(commitImportedPlan).toHaveBeenCalledWith(result, { contentId: 'fru', title: 'タイトル' });
  });

  it('max_per_content 到達なら setLimitContext を {reason, contentId} で呼ぶ', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }, (_, i) => mkPlan(`p${i}`, 'fru')));
    const promise = importWithLimitCheck(result, 'fru', 'タイトル');
    await Promise.resolve();
    expect(setLimitContext).toHaveBeenCalledTimes(1);
    const ctx = setLimitContext.mock.calls[0][0];
    expect(ctx.reason).toBe('max_per_content');
    expect(ctx.contentId).toBe('fru');
    expect(ctx.neededCount).toBe(1);
    ctx.resolve('resolved');
    expect(await promise).toBe(true);
    expect(commitImportedPlan).toHaveBeenCalledWith(result, { contentId: 'fru', title: 'タイトル' });
  });

  it('max_total 到達なら contentId=null で呼ぶ', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_TOTAL_PLANS }, (_, i) => mkPlan(`p${i}`, `c${i}`)));
    const promise = importWithLimitCheck(result, 'newContent', 'タイトル');
    await Promise.resolve();
    const ctx = setLimitContext.mock.calls[0][0];
    expect(ctx.reason).toBe('max_total');
    expect(ctx.contentId).toBeNull();
    ctx.resolve('resolved');
    await promise;
  });

  it('cancelled なら commit せず false を返す', async () => {
    setPlans(Array.from({ length: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }, (_, i) => mkPlan(`p${i}`, 'fru')));
    const promise = importWithLimitCheck(result, 'fru', 'タイトル');
    await Promise.resolve();
    const ctx = setLimitContext.mock.calls[0][0];
    ctx.resolve('cancelled');
    expect(await promise).toBe(false);
    expect(commitImportedPlan).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts`
Expected: FAIL（`importWithLimitCheck` 未作成）

- [ ] **Step 3: 実装を書く**

`src/lib/sheetImport/importWithLimitCheck.ts`:
```ts
import type { SheetImportResult } from './buildPlanFromSheets';
import { checkPlanLimit } from '../../utils/planLimitChecker';
import { commitImportedPlan } from './commitImportedPlan';
import { usePlanStore } from '../../store/usePlanStore';
import { useShareImportFlow } from '../../store/useShareImportFlow';

/**
 * スプシ取込を確定する。選択コンテンツが上限のときは共有取込と同じ
 * LimitResolutionSheet（useShareImportFlow.limitContext）を立てて削除完了を待ち、
 * 枠が空いてから確定する。
 *
 * @returns 確定したら true。満杯シートで「やめる」なら false（呼び出し側はモーダルを閉じない）。
 */
export async function importWithLimitCheck(
  result: SheetImportResult,
  contentId: string | null,
  title: string,
): Promise<boolean> {
  const plans = usePlanStore.getState().plans;
  const limit = checkPlanLimit(plans, contentId);

  if (limit.exceeded) {
    const decision = await new Promise<'resolved' | 'cancelled'>((resolve) => {
      useShareImportFlow.getState().setLimitContext({
        reason: limit.reason!,
        contentId: limit.reason === 'max_total' ? null : contentId,
        neededCount: 1,
        planId: null,
        resolve,
      });
    });
    if (decision === 'cancelled') return false;
    // 'resolved' = LimitResolutionSheet が削除完了済み → 枠が空いた
  }

  commitImportedPlan(result, { contentId, title });
  return true;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts`
Expected: PASS（4 it 緑）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/sheetImport/importWithLimitCheck.ts src/lib/sheetImport/__tests__/importWithLimitCheck.test.ts
rtk git commit -m "feat(import): 取込確定+満杯ゲート importWithLimitCheck を追加(LimitResolutionSheet流用)"
```

---

## Task 4: `LimitResolutionSheet` のマウントを `Layout` へ一元化

**Files:**
- Modify: `src/components/Layout.tsx:38`（import付近）, `:887`（`<ShareImportSheet />` 付近）
- Modify: `src/components/ShareImportSheet.tsx:22`（import）, `:457`（render）

**Interfaces:**
- Consumes: 既存 `LimitResolutionSheet`（変更しない）。
- Produces: グローバル単一マウント（共有取込・スプシ取込の両方の `setLimitContext` に応答）。

- [ ] **Step 1: Layout に import を追加**

`src/components/Layout.tsx` の `import { ShareImportSheet } from './ShareImportSheet';`（38行目）の直後に追加:
```ts
import { LimitResolutionSheet } from './LimitResolutionSheet';
```

- [ ] **Step 2: Layout に単一マウントを追加**

`src/components/Layout.tsx:887` の `<ShareImportSheet />` の直後に追加:
```tsx
            <ShareImportSheet />
            {/* 上限解消シートはグローバル単一マウント（共有取込・スプシ取込の両方が setLimitContext で呼ぶ） */}
            <LimitResolutionSheet />
```

- [ ] **Step 3: ShareImportSheet 内の重複マウントと import を撤去**

`src/components/ShareImportSheet.tsx:457` の以下を削除:
```tsx
            {/* 上限ヒット時に重ねて開く解消シート。 limitContext が null の間は内部で何も描画しない */}
            <LimitResolutionSheet />
```
さらに 22行目の import を削除:
```ts
import { LimitResolutionSheet } from './LimitResolutionSheet';
```

- [ ] **Step 4: 型チェック＆共有取込テストが通ることを確認**

Run: `npx tsc -b --pretty false`
Expected: エラーなし（ShareImportSheet 側の未使用 import 残りがあれば失敗するので整理）
Run: `npx vitest run ShareImportSheet LimitResolutionSheet`
Expected: PASS（ShareImportSheet.test は `LimitResolutionSheet` を null モック済みのため影響なし）

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Layout.tsx src/components/ShareImportSheet.tsx
rtk git commit -m "refactor(import): LimitResolutionSheetのマウントをLayoutへ一元化(取込でも流用可能に)"
```

---

## Task 5: SpreadsheetImportModal にコンテンツ選択UIを追加し onImport を contentId 渡し＋async に

**Files:**
- Modify: `src/components/SpreadsheetImportModal.tsx`（Props・state・初期化・JSX・handleConfirm）
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`（`sheetImport.target_content_label`）

**Interfaces:**
- Consumes: Task 1 の `hasContentRegistry`, `getFilteredBosses`, `deriveContentId`, `ContentSelectionDefault`。`getContentById`（`../data/contentRegistry`）、`CATEGORY_LABELS`（`../data/contentRegistry`）。既存 `new_plan.*` i18n キー。
- Produces: `onImport(result, { contentId: string | null }): Promise<boolean>` を呼ぶ。`defaultSelection: ContentSelectionDefault` Props を受ける。

- [ ] **Step 1: i18n キーを4言語に追加**

各ロケールの `sheetImport` ブロックに1キー追加（`rights_notice` の隣など）:
- `src/locales/ja.json`: `"target_content_label": "取り込み先のコンテンツ",`
- `src/locales/en.json`: `"target_content_label": "Target content",`
- `src/locales/ko.json`: `"target_content_label": "가져올 콘텐츠",`
- `src/locales/zh.json`: `"target_content_label": "导入目标内容",`
（レベル/カテゴリ/ボス/名前入力の各ラベルは既存 `new_plan.level_label` / `new_plan.category_label` / `new_plan.content_label` / `new_plan.plan_name_label` / `new_plan.plan_name_placeholder` / `new_plan.no_matches` / `new_plan.select_level_first` を流用＝新規翻訳不要）

- [ ] **Step 2: import と Props を拡張**

`src/components/SpreadsheetImportModal.tsx` の import 群に追加:
```ts
import { hasContentRegistry, getFilteredBosses, deriveContentId } from '../lib/contentSelection';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import { CATEGORY_LABELS, getContentById } from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
```
`Props` を変更:
```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
```
コンポーネント引数も変更:
```ts
export const SpreadsheetImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
```

- [ ] **Step 3: コンテンツ選択 state と初期化を追加**

既存 state（`assignment` の宣言の下あたり）に追加:
```ts
  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');
```
モーダルが開くたびに `defaultSelection` から初期化（既存の `useEffect` 群の近くに追加）:
```ts
  useEffect(() => {
    if (!isOpen) return;
    const d = defaultSelection;
    setSelLevel(d.level ?? null);
    setSelCategory(d.category ?? null);
    if (d.contentId && hasContentRegistry(d.category)) {
      setSelBoss(getContentById(d.contentId) ?? null);
      setSelTitle('');
    } else {
      setSelBoss(null);
      setSelTitle(d.category && !hasContentRegistry(d.category) ? d.title : '');
    }
  }, [isOpen, defaultSelection]);
```
選択値の派生（`blockReason` 計算の近くに追加）:
```ts
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const filteredBosses = useMemo(() => getFilteredBosses(selLevel, selCategory), [selLevel, selCategory]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);
```
（`lang` が既に定義済みなら重複させない）

- [ ] **Step 4: コンテンツ選択 UI を貼り付け欄の前に追加**

`{/* Scrollable Content */}` 直下、`{/* Step 1: Mode */}` の **前** に挿入:
```tsx
            {/* Step 0: 取り込み先コンテンツ選択 */}
            <div className="space-y-2">
              <label className="text-app-lg text-app-text-muted block">
                {t('sheetImport.target_content_label')}
              </label>
              {/* Level */}
              <div className="flex gap-2 flex-wrap">
                {LEVEL_OPTIONS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => { setSelLevel(lv); setSelBoss(null); }}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
                      selLevel === lv
                        ? 'border-app-text bg-app-text/5 text-app-text'
                        : 'border-app-border text-app-text-muted hover:border-app-text/40',
                    )}
                  >
                    Lv{lv}
                  </button>
                ))}
              </div>
              {/* Category */}
              <div className="flex gap-2 flex-wrap pt-1">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setSelCategory(cat); setSelBoss(null); setSelTitle(''); }}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
                      selCategory === cat
                        ? 'border-app-text bg-app-text/5 text-app-text'
                        : 'border-app-border text-app-text-muted hover:border-app-text/40',
                    )}
                  >
                    {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Boss (零式・絶) */}
              {hasContentRegistry(selCategory) && (
                selLevel ? (
                  filteredBosses.length > 0 ? (
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pt-1">
                      {filteredBosses.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelBoss(b)}
                          className={clsx(
                            'w-full px-3 py-2 rounded-lg text-app-2xl font-bold border text-left transition-all duration-200 cursor-pointer active:scale-[0.98]',
                            selBoss?.id === b.id
                              ? 'border-app-text bg-app-text/5 text-app-text'
                              : 'border-app-border text-app-text-muted hover:border-app-text/40',
                          )}
                        >
                          {b.name[lang] || b.name.ja}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.no_matches')}</p>
                  )
                ) : (
                  <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.select_level_first')}</p>
                )
              )}
              {/* 自由入力タイトル (ダンジョン/レイド/その他) */}
              {selCategory !== null && !hasContentRegistry(selCategory) && (
                <input
                  type="text"
                  value={selTitle}
                  onChange={(e) => setSelTitle(e.target.value)}
                  placeholder={t('new_plan.plan_name_placeholder')}
                  className="w-full bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted mt-1"
                  spellCheck={false}
                />
              )}
            </div>
```

- [ ] **Step 5: handleConfirm を async 化し contentId を渡す**

`handleConfirm` を置換:
```ts
  const handleConfirm = useCallback(async () => {
    if (entries.length === 0) return;
    const partyOverride = includeMitigations ? buildPartyOverride(assignment) : undefined;
    const result = buildPlanFromSheets(
      entries,
      { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
      { includeMitigations, partyOverride },
    );
    const committed = await onImport(result, { contentId: selectedContentId });
    if (committed) handleClose();
  }, [entries, includeMitigations, assignment, onImport, handleClose, selectedContentId]);
```
確定ボタンは `onClick={handleConfirm}` のままで async 対応OK。

- [ ] **Step 6: handleClose にコンテンツ選択 state のリセットを追加**

`handleClose` 内の各 setter の並びに追加（再オープン時の残留防止）:
```ts
    setSelLevel(null);
    setSelCategory(null);
    setSelBoss(null);
    setSelTitle('');
```
（次の Step 7 で `isOpen` 初期化 effect が再設定するため挙動は `defaultSelection` 由来に戻る）

- [ ] **Step 7: 型チェックで配線を確認**

Run: `npx tsc -b --pretty false`
Expected: エラーなし（このタスク単体では `Timeline` がまだ旧シグネチャの可能性 → Task 6 と前後する場合は Task 6 まで通してから tsc。subagent 実行では Task 6 完了後に通ること）

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/SpreadsheetImportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(import): スプシ取込モーダルに取込先コンテンツ選択を追加・onImportをcontentId渡し+async化"
```

---

## Task 6: Timeline を新シグネチャに配線（async handler + importWithLimitCheck + defaultSelection）

**Files:**
- Modify: `src/components/Timeline.tsx:1277-1298`（handleSheetImport）, `:1271-1274`（defaultSelection 組み立て付近）, `:3947-3951`（モーダル呼び出し）, import 追加

**Interfaces:**
- Consumes: Task 3 の `importWithLimitCheck`、Task 1 の `ContentSelectionDefault`、Task 5 の新 `SpreadsheetImportModal` Props。
- Produces: なし（UIフローの完成）。

- [ ] **Step 1: import を追加**

`src/components/Timeline.tsx` の import 群に追加:
```ts
import { importWithLimitCheck } from '../lib/sheetImport/importWithLimitCheck';
import type { ContentSelectionDefault } from '../lib/contentSelection';
```

- [ ] **Step 2: defaultSelection を組み立てる**

`currentContentId` 定義（1274行目）の直後に追加:
```ts
    const sheetImportDefault = useMemo<ContentSelectionDefault>(() => ({
        contentId: currentContentId,
        level: currentPlan?.level ?? null,
        category: currentPlan?.category ?? null,
        title: currentPlan?.title ?? '',
    }), [currentContentId, currentPlan]);
```
（`useMemo` が未 import なら React の import に追加。`currentPlan` は1271行目で取得済み）

- [ ] **Step 3: handleSheetImport を async + importWithLimitCheck に置換**

1277-1298行目の `handleSheetImport` を置換:
```ts
    // スプシ取り込み: コンテンツ選択値で確定。満杯時は LimitResolutionSheet で削除を待つ。
    const handleSheetImport = useCallback(
        async (result: SheetImportResult, opts: { contentId: string | null }): Promise<boolean> => {
            const committed = await importWithLimitCheck(
                result,
                opts.contentId,
                t('sheetImport.default_plan_title'),
            );
            if (committed) showToast(t('sheetImport.created'));
            return committed;
        },
        [t],
    );
```
（旧 `PLAN_LIMITS` を使う満杯チェックと `commitImportedPlan` 直呼びは削除。`commitImportedPlan` の import が Timeline で他に使われていなければ未使用になるので削除。`PLAN_LIMITS` が Timeline 内の他箇所で使われていなければ import も削除。tsc で確認）

- [ ] **Step 4: モーダル呼び出しに defaultSelection を渡す**

3947-3951行目を置換:
```tsx
            <SpreadsheetImportModal
                isOpen={showSheetImport}
                onClose={() => setShowSheetImport(false)}
                onImport={handleSheetImport}
                defaultSelection={sheetImportDefault}
            />
```

- [ ] **Step 5: 型チェック＆全体ビルド**

Run: `npx tsc -b --pretty false`
Expected: エラーなし（未使用 `commitImportedPlan` / `PLAN_LIMITS` import が残れば失敗 → 削除）
Run: `npm run build`
Expected: build 成功

- [ ] **Step 6: 関連テストを実行**

Run: `npx vitest run contentSelection importWithLimitCheck ShareImportSheet LimitResolutionSheet`
Expected: PASS（既知の無関係 failure＝TopBar 4件 / HousingWorkspace 1件 は対象外）

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(import): スプシ取込を選択コンテンツ+満杯ゲートに配線(誤紐付け根治・async)"
```

---

## 実機検証（全タスク完了後・push前にユーザーと）

設計書 §3-E の実機6項目を1つずつ確認（[[feedback_one_fix_one_verify]] [[feedback_endpoint_user_verification]]）:
1. 別コンテンツを選んで取込 → 正しい棚に入る（誤紐付け根治）
2. 5/5で1枚削除して取込 → 入る／「やめる」で何も消えず取込モーダルにデータ残る
3. 50枚で別コンテンツの表を削除して取込 → 横断削除が効く
4. collab中の表から取込 → 壊れない（Bug#1非再発）
5. 共有コピー取込の満杯解消が従来どおり（マウント移動の巻き添えなし）
6. 新規作成画面が従来どおり（contentSelection.ts 差し替えの巻き添えなし）

## Self-Review（この計画の点検結果）

- **Spec coverage**: ①=Task 3+4+5+6（流用＋配線）/ ③=Task 1+2+5+6（選択UI＋contentId配線）/ 共通化=Task 1+2 / マウント一元化=Task 4。spec 全節に対応タスクあり。
- **Placeholder**: なし（全 step に実コード/実コマンド/期待出力）。
- **Type consistency**: `onImport(result, {contentId}) => Promise<boolean>`（Task 5 定義 = Task 6 消費）、`importWithLimitCheck(result, contentId, title): Promise<boolean>`（Task 3 定義 = Task 6 消費）、`ContentSelectionDefault`（Task 1 定義 = Task 5/6 消費）、`deriveContentId`/`getFilteredBosses`/`hasContentRegistry`（Task 1 定義 = Task 2/5 消費）で一貫。
- **タスク順序の注意**: Task 5 単体では Timeline が旧シグネチャのままなので tsc が一時的に赤になり得る。subagent 実行では Task 6 まで通して全体 tsc/build を緑にする（Task 6 Step 5 で担保）。
