# リキャスト専用行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインのヘッダー直下に固定のリキャスト専用行を追加し、 配置済みスキルのうち現在時刻でリキャスト中のものを FF14 ゲーム内 HUD の clockswipe 形式で表示する。

**Architecture:** ロジック (純粋関数) → アイコン単体 → 行全体 → CSS → Timeline 統合 → i18n の順で TDD ボトムアップ実装。 スクロール時のリアルタイム更新は React 再レンダーを避け、 `ref` で `style.setProperty` を直接呼ぶ既存パターン ([Timeline.tsx:222-232 の timeLabelRef](../../../src/components/Timeline.tsx#L222-L232)) を踏襲して GPU 描画に任せる。

**Tech Stack:** React 18 + TypeScript + Tailwind v4 + Zustand + vitest + React Testing Library。 CSS の `conic-gradient` + CSS custom properties で clockswipe を表現。

**Spec:** [docs/superpowers/specs/2026-05-13-recast-row-design.md](../specs/2026-05-13-recast-row-design.md)

---

## File Structure

| ファイル | 種別 | 責務 |
|---|---|---|
| `src/utils/recastRow.ts` | 新規 | 純粋関数: 残時間計算、 同スキル統合、 上限超過削除、 角度計算 |
| `src/utils/__tests__/recastRow.test.ts` | 新規 | recastRow.ts のユニットテスト |
| `src/components/RecastIcon.tsx` | 新規 | clockswipe アイコン単体 (forwardRef、 ref で style 直接更新可) |
| `src/components/__tests__/RecastIcon.test.tsx` | 新規 | RecastIcon の構造・初期状態テスト |
| `src/components/RecastRow.tsx` | 新規 | リキャスト行全体 (各メンバー列 + アイコン管理 + update メソッド) |
| `src/components/__tests__/RecastRow.test.tsx` | 新規 | RecastRow の構造・update 動作テスト |
| `src/index.css` | 修正 | `.recast-row`, `.recast-icon`, `.recast-icon::before`, `.recast-icon .recast-num` 等を追記 |
| `src/components/Timeline.tsx` | 修正 | RecastRow 挿入、 折り畳み state、 スクロールハンドラ内 update 呼び出し |
| `src/locales/ja.json` | 修正 | `timeline.recast_row.label = "リキャスト"` |
| `src/locales/en.json` | 修正 | `timeline.recast_row.label = "Recast"` |
| `src/locales/ko.json` | 修正 | `timeline.recast_row.label = "리캐스트"` (仮、 実装時確認) |
| `src/locales/zh.json` | 修正 | `timeline.recast_row.label = "技能冷却"` (仮、 実装時確認) |

---

## Task 1: ロジック関数 (recastRow.ts) を TDD で実装

**Files:**
- Create: `src/utils/recastRow.ts`
- Test: `src/utils/__tests__/recastRow.test.ts`

このタスクで実装する関数:
- `getActiveRecasts(placements, defs, currentTime)`: 現在時刻でリキャスト中の placement を最近 1 回ベースで集約して残時間順で返す
- `selectVisibleByLimit(actives, limit)`: 残時間昇順で並べ、 上限超え分を「残時間が短い側から」 削除し、 残ったものを配置時刻順で返す
- `calculateAngle(remainingSec, recastSec)`: clockswipe の透明領域角度 (deg) を返す

- [ ] **Step 1: テストファイル骨組みを書く**

Create `src/utils/__tests__/recastRow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, Mitigation } from '../../types';
import { getActiveRecasts, selectVisibleByLimit, calculateAngle } from '../recastRow';

const makeMitigation = (id: string, recast: number): Mitigation => ({
  id, jobId: 'WAR', name: { ja: id, en: id }, icon: '/icons/' + id + '.png',
  recast, duration: 10, type: 'all', value: 10,
});

const makePlacement = (id: string, mitigationId: string, time: number, ownerId = 'T1'): AppliedMitigation => ({
  id, mitigationId, time, ownerId,
});

describe('calculateAngle', () => {
  it('returns 0deg when no time elapsed (remaining = recast)', () => {
    expect(calculateAngle(60, 60)).toBe(0);
  });

  it('returns 180deg at half elapsed (remaining = recast/2)', () => {
    expect(calculateAngle(30, 60)).toBeCloseTo(180);
  });

  it('returns ~360deg when almost expired (remaining ≈ 0)', () => {
    expect(calculateAngle(0.01, 60)).toBeCloseTo(360, 0);
  });

  it('clamps to [0, 360]', () => {
    expect(calculateAngle(-10, 60)).toBe(360);
    expect(calculateAngle(100, 60)).toBe(0);
  });
});

describe('getActiveRecasts', () => {
  const defs = [makeMitigation('holmgang', 240), makeMitigation('thrill', 90)];

  it('includes a skill placed in the past that is still on CD', () => {
    const placements = [makePlacement('p1', 'holmgang', 0)];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result).toHaveLength(1);
    expect(result[0].mitigationId).toBe('holmgang');
    expect(result[0].remaining).toBe(180);
  });

  it('excludes skills whose CD has already expired', () => {
    const placements = [makePlacement('p1', 'thrill', 0)];
    const result = getActiveRecasts(placements, defs, 100);
    expect(result).toHaveLength(0);
  });

  it('excludes skills placed in the future (currentTime < placementTime)', () => {
    const placements = [makePlacement('p1', 'thrill', 200)];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result).toHaveLength(0);
  });

  it('uses the most recent placement when the same skill is placed multiple times', () => {
    const placements = [
      makePlacement('p1', 'thrill', 0),
      makePlacement('p2', 'thrill', 100),
    ];
    const result = getActiveRecasts(placements, defs, 120);
    expect(result).toHaveLength(1);
    expect(result[0].remaining).toBe(70);
  });

  it('returns placements sorted by ascending remaining time', () => {
    const placements = [
      makePlacement('p1', 'holmgang', 0),
      makePlacement('p2', 'thrill', 30),
    ];
    const result = getActiveRecasts(placements, defs, 60);
    expect(result[0].mitigationId).toBe('thrill');
    expect(result[1].mitigationId).toBe('holmgang');
  });
});

describe('selectVisibleByLimit', () => {
  it('returns all when count is within limit', () => {
    const actives = [
      { mitigationId: 'a', remaining: 10, placementTime: 0, recast: 60, ownerId: 'T1', placementId: 'p1' },
      { mitigationId: 'b', remaining: 30, placementTime: 5, recast: 60, ownerId: 'T1', placementId: 'p2' },
    ];
    const result = selectVisibleByLimit(actives, 6);
    expect(result).toHaveLength(2);
  });

  it('drops the shortest remaining when over limit', () => {
    const actives = [
      { mitigationId: 'a', remaining: 5,  placementTime: 0, recast: 60, ownerId: 'T1', placementId: 'p1' },
      { mitigationId: 'b', remaining: 30, placementTime: 5, recast: 60, ownerId: 'T1', placementId: 'p2' },
      { mitigationId: 'c', remaining: 60, placementTime: 1, recast: 60, ownerId: 'T1', placementId: 'p3' },
    ];
    const result = selectVisibleByLimit(actives, 2);
    expect(result.map(r => r.mitigationId)).toEqual(['c', 'b']);
  });

  it('reorders the surviving entries by placementTime ascending', () => {
    const actives = [
      { mitigationId: 'a', remaining: 50, placementTime: 30, recast: 60, ownerId: 'T1', placementId: 'p1' },
      { mitigationId: 'b', remaining: 60, placementTime: 10, recast: 60, ownerId: 'T1', placementId: 'p2' },
    ];
    const result = selectVisibleByLimit(actives, 6);
    expect(result.map(r => r.mitigationId)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認**

Run: `npm run test -- recastRow --reporter=verbose`
Expected: `Error: Cannot find module '../recastRow'` 等で全テスト失敗

- [ ] **Step 3: recastRow.ts を実装**

Create `src/utils/recastRow.ts`:

```typescript
import type { AppliedMitigation, Mitigation } from '../types';

export interface ActiveRecast {
  placementId: string;
  mitigationId: string;
  ownerId: string;
  placementTime: number;
  recast: number;
  remaining: number;
}

/**
 * clockswipe の透明領域角度を返す。
 * 残時間が recast に等しいとき (= 経過 0) は 0deg、
 * 残時間が 0 のとき (= 経過率 100%) は 360deg。
 */
export function calculateAngle(remainingSec: number, recastSec: number): number {
  if (recastSec <= 0) return 0;
  const elapsed = recastSec - remainingSec;
  const ratio = elapsed / recastSec;
  return Math.max(0, Math.min(360, ratio * 360));
}

/**
 * 配置済み mitigation のうち、 現在時刻でリキャスト中のものを集約して返す。
 * - 同じ mitigationId が複数 placement にある場合、 現在時刻から見て最近 1 回 (使用時刻 ≤ currentTime のうち最大の time) を採用
 * - 残時間 (remaining = recast - (currentTime - placementTime)) が 0 < remaining ≤ recast のものだけ含む
 * - 結果は残時間昇順
 */
export function getActiveRecasts(
  placements: AppliedMitigation[],
  defs: Mitigation[],
  currentTime: number,
): ActiveRecast[] {
  const defById = new Map(defs.map(d => [d.id, d]));

  // mitigationId × ownerId ごとに「使用済み (time ≤ currentTime) 最大時刻」 を選ぶ
  const latestByKey = new Map<string, AppliedMitigation>();
  for (const p of placements) {
    if (p.time > currentTime) continue;
    const key = p.ownerId + ':' + p.mitigationId;
    const existing = latestByKey.get(key);
    if (!existing || p.time > existing.time) {
      latestByKey.set(key, p);
    }
  }

  const actives: ActiveRecast[] = [];
  latestByKey.forEach((p) => {
    const def = defById.get(p.mitigationId);
    if (!def) return;
    const recast = def.recast;
    if (recast <= 0) return;
    const elapsed = currentTime - p.time;
    const remaining = recast - elapsed;
    if (remaining > 0 && remaining <= recast) {
      actives.push({
        placementId: p.id,
        mitigationId: p.mitigationId,
        ownerId: p.ownerId,
        placementTime: p.time,
        recast,
        remaining,
      });
    }
  });

  actives.sort((a, b) => a.remaining - b.remaining);
  return actives;
}

/**
 * 上限内に絞り、 配置時刻昇順で返す。
 * - 上限を超える場合、 残時間が短い側から削除 (= 一番早く空くスキルを消す)
 * - 残ったものを placementTime 昇順で並び直す
 */
export function selectVisibleByLimit(actives: ActiveRecast[], limit: number): ActiveRecast[] {
  if (actives.length <= limit) {
    return [...actives].sort((a, b) => a.placementTime - b.placementTime);
  }
  // actives は残時間昇順前提だが念のためソート
  const sortedByRemaining = [...actives].sort((a, b) => a.remaining - b.remaining);
  const survived = sortedByRemaining.slice(sortedByRemaining.length - limit);
  return survived.sort((a, b) => a.placementTime - b.placementTime);
}
```

- [ ] **Step 4: テストを走らせて全 PASS 確認**

Run: `npm run test -- recastRow --reporter=verbose`
Expected: 全テスト PASS (約 11 ケース)

- [ ] **Step 5: tsc + lint で型・スタイルチェック**

Run: `npx tsc --noEmit` および `npm run lint`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
rtk git add src/utils/recastRow.ts src/utils/__tests__/recastRow.test.ts
rtk git commit -m "feat(recast-row): ロジック関数 (calculateAngle/getActiveRecasts/selectVisibleByLimit) を TDD で実装"
```

---

## Task 2: RecastIcon コンポーネント (forwardRef + CSS variable)

**Files:**
- Create: `src/components/RecastIcon.tsx`
- Test: `src/components/__tests__/RecastIcon.test.tsx`

このコンポーネントは「単体の clockswipe アイコン」 で、 親 (RecastRow) から ref 経由で `style.setProperty` を直接呼ばれて状態を更新される構造にする。 React state は持たない。

- [ ] **Step 1: テストを書く**

Create `src/components/__tests__/RecastIcon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { RecastIcon } from '../RecastIcon';

describe('RecastIcon', () => {
  it('renders an img with the given iconUrl and alt', () => {
    const { container } = render(<RecastIcon iconUrl="/icons/holmgang.png" alt="Holmgang" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/icons/holmgang.png');
    expect(img?.getAttribute('alt')).toBe('Holmgang');
  });

  it('renders an overlay element (for clockswipe) and a number text node', () => {
    const { container } = render(<RecastIcon iconUrl="/x.png" alt="x" />);
    expect(container.querySelector('.recast-icon')).not.toBeNull();
    expect(container.querySelector('.recast-num')).not.toBeNull();
  });

  it('forwards ref to the root element so parent can set CSS variables', () => {
    const ref = createRef<HTMLDivElement>();
    render(<RecastIcon ref={ref} iconUrl="/x.png" alt="x" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.classList.contains('recast-icon')).toBe(true);
  });

  it('uses default CSS variable values when not overridden', () => {
    const { container } = render(<RecastIcon iconUrl="/x.png" alt="x" />);
    const el = container.querySelector('.recast-icon') as HTMLDivElement;
    expect(el.style.getPropertyValue('--cd-display')).toBe('none');
    expect(el.style.getPropertyValue('--cd-angle')).toBe('0deg');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npm run test -- RecastIcon`
Expected: `Cannot find module '../RecastIcon'` 等

- [ ] **Step 3: RecastIcon コンポーネントを実装**

Create `src/components/RecastIcon.tsx`:

```tsx
import { forwardRef } from 'react';

interface RecastIconProps {
  iconUrl: string;
  alt: string;
}

/**
 * リキャスト行内に常駐する clockswipe アイコン。
 *
 * 親 (RecastRow) は ref 経由で以下の CSS variable を直接更新する:
 * - `--cd-display`: 'none' | 'flex' (表示/非表示)
 * - `--cd-angle`: 'Ndeg' (clockswipe の透明領域角度)
 * - `--cd-order`: 数値 (flex order、 並び順)
 *
 * 残秒テキストは ref.current.querySelector('.recast-num').textContent で更新する。
 */
export const RecastIcon = forwardRef<HTMLDivElement, RecastIconProps>(
  ({ iconUrl, alt }, ref) => {
    return (
      <div
        ref={ref}
        className="recast-icon"
        style={{
          // 初期値: 非表示。 親が update() を呼ぶまで表示されない。
          ['--cd-display' as string]: 'none',
          ['--cd-angle' as string]: '0deg',
          ['--cd-order' as string]: 0,
        } as React.CSSProperties}
      >
        <img src={iconUrl} alt={alt} />
        <span className="recast-num" />
      </div>
    );
  },
);
RecastIcon.displayName = 'RecastIcon';
```

- [ ] **Step 4: テスト実行 → PASS 確認**

Run: `npm run test -- RecastIcon`
Expected: 全 PASS (4 ケース)

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/RecastIcon.tsx src/components/__tests__/RecastIcon.test.tsx
rtk git commit -m "feat(recast-row): RecastIcon コンポーネント (forwardRef + CSS variable)"
```

---

## Task 3: CSS スタイル定義 (index.css)

**Files:**
- Modify: `src/index.css` (末尾に追加、 既存スタイルを変更しない)

LoPo は既存 Tailwind v4 + 専用 CSS の併用パターンに従う。 既存ルール ([.claude/rules/css-rules.md](../../../.claude/rules/css-rules.md)) を遵守:
- `backdrop-filter` 直書きしない (今回不要)
- `clip-path: path()` 使わない (`conic-gradient` で実現)

- [ ] **Step 1: index.css の末尾を読んで追加位置を確認**

Run: `wc -l src/index.css` で行数確認、 末尾を見る (大体最終 30 行程度を Read で確認)

- [ ] **Step 2: 末尾にリキャスト行関連のスタイルを追記**

`src/index.css` の末尾に追加:

```css
/* ===== リキャスト専用行 (セッション 18) ===== */

.recast-row {
  display: contents; /* grid の親 (時刻行と同構造の row) を流用する場合 */
}

/* リキャスト行の cell (各メンバー列の枠) */
.recast-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  flex-wrap: wrap;
  padding: 4px var(--col-member-pad-x);
  border-right: 1px solid var(--color-app-border);
  min-height: 32px;
  background: rgba(96, 165, 250, 0.10);
}

/* 折り畳み時: 行高さを抑え、 アイコンを隠す */
.recast-row.collapsed .recast-cell {
  min-height: 18px;
  padding: 2px var(--col-member-pad-x);
}
.recast-row.collapsed .recast-icon {
  display: none !important;
}

/* リキャスト行 左端のシェブロン領域 (フェーズ + ラベル + 時間 列をまたぐラベル) */
.recast-label {
  grid-column: span 3;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
  color: #6a8aa8;
  font-size: 10px;
  font-weight: 600;
  background: rgba(96, 165, 250, 0.10);
  border-right: 1px solid var(--color-app-border);
  min-height: 32px;
}
.recast-row.collapsed .recast-label {
  min-height: 18px;
}
.recast-chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
  color: #6a8aa8;
  font-size: 11px;
}
.recast-chev:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 個別の clockswipe アイコン */
.recast-icon {
  display: var(--cd-display, none);
  order: var(--cd-order, 0);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}
.recast-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.recast-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: conic-gradient(
    transparent 0 var(--cd-angle, 0deg),
    rgba(0, 0, 0, 0.55) var(--cd-angle, 0deg) 360deg
  );
}
.recast-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 10px;
  font-weight: 900;
  font-family: Arial, sans-serif;
  text-shadow: 0 0 3px #000, 0 0 2px #000, 0 0 1px #000;
  z-index: 2;
  line-height: 1;
}
```

- [ ] **Step 3: dev サーバーを起動してビジュアル確認 (簡易)**

この段階では DOM に何も置いていないので画面に変化はない。 ただし CSS のパースエラーがないか console を確認。

Run: `npm run dev` (バックグラウンド)。 ブラウザを開いて DevTools コンソールに CSS パースエラーが出ないことを確認。 確認できたら dev サーバー停止。

- [ ] **Step 4: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "feat(recast-row): clockswipe + 折り畳み用 CSS 追加"
```

---

## Task 4: RecastRow コンポーネント (列管理 + update メソッド)

**Files:**
- Create: `src/components/RecastRow.tsx`
- Test: `src/components/__tests__/RecastRow.test.tsx`

`RecastRow` は外部 (Timeline) から `useImperativeHandle` 経由で公開される `update(currentTime: number)` メソッドを持つ。 内部では各メンバーの配置済みスキル全種を `<RecastIcon ref={...} />` として常駐させ、 `update` 呼び出し時に Task 1 のロジック (`getActiveRecasts` + `selectVisibleByLimit`) を使って各アイコンの CSS variable を直接書き換える。

- [ ] **Step 1: テストを書く**

Create `src/components/__tests__/RecastRow.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import type { AppliedMitigation, Mitigation, PartyMember } from '../../types';
import { RecastRow, type RecastRowHandle } from '../RecastRow';

const mitigations: Mitigation[] = [
  { id: 'holmgang', jobId: 'WAR', name: { ja: '鬨', en: 'Holmgang' }, icon: '/h.png', recast: 240, duration: 8, type: 'all', value: 0, isInvincible: true },
  { id: 'thrill',   jobId: 'WAR', name: { ja: '原初', en: 'Thrill' },   icon: '/t.png', recast: 90,  duration: 15, type: 'all', value: 10 },
];

const partyMembers: PartyMember[] = [
  { id: 'T1', jobId: 'WAR', role: 'tank' },
  { id: 'T2', jobId: 'PLD', role: 'tank' },
  { id: 'H1', jobId: 'SCH', role: 'healer' },
  { id: 'H2', jobId: 'WHM', role: 'healer' },
  { id: 'D1', jobId: 'MNK', role: 'dps' },
  { id: 'D2', jobId: 'RPR', role: 'dps' },
  { id: 'D3', jobId: 'BLM', role: 'dps' },
  { id: 'D4', jobId: 'BRD', role: 'dps' },
];

describe('RecastRow', () => {
  it('renders a label cell with chevron', () => {
    const { container } = render(<RecastRow partyMembers={partyMembers} placements={[]} mitigationDefs={mitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    expect(container.querySelector('.recast-label')).not.toBeNull();
    expect(container.querySelector('.recast-chev')).not.toBeNull();
  });

  it('renders one cell per member (8 cells)', () => {
    const { container } = render(<RecastRow partyMembers={partyMembers} placements={[]} mitigationDefs={mitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    expect(container.querySelectorAll('.recast-cell').length).toBe(8);
  });

  it('renders one RecastIcon per placed skill species per member', () => {
    const placements: AppliedMitigation[] = [
      { id: 'p1', mitigationId: 'holmgang', time: 30, ownerId: 'T1' },
      { id: 'p2', mitigationId: 'thrill',   time: 60, ownerId: 'T1' },
      { id: 'p3', mitigationId: 'thrill',   time: 100, ownerId: 'T1' }, // 同 species: 1 アイコンに統合
    ];
    const { container } = render(<RecastRow partyMembers={partyMembers} placements={placements} mitigationDefs={mitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    const t1Cell = container.querySelectorAll('.recast-cell')[0];
    const icons = t1Cell.querySelectorAll('.recast-icon');
    expect(icons.length).toBe(2); // holmgang + thrill (thrill は species で統合)
  });

  it('on update(currentTime), sets --cd-display to flex only for active recasts', () => {
    const placements: AppliedMitigation[] = [
      { id: 'p1', mitigationId: 'thrill', time: 0,  ownerId: 'T1' }, // 60 で残 30
      { id: 'p2', mitigationId: 'holmgang', time: 0, ownerId: 'T1' }, // 60 で残 180
    ];
    const ref = createRef<RecastRowHandle>();
    const { container } = render(<RecastRow ref={ref} partyMembers={partyMembers} placements={placements} mitigationDefs={mitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    ref.current?.update(60);

    const t1Cell = container.querySelectorAll('.recast-cell')[0];
    const icons = Array.from(t1Cell.querySelectorAll('.recast-icon')) as HTMLDivElement[];
    expect(icons.every(el => el.style.getPropertyValue('--cd-display') === 'flex')).toBe(true);
  });

  it('on update(currentTime), hides icons whose recast has expired', () => {
    const placements: AppliedMitigation[] = [
      { id: 'p1', mitigationId: 'thrill', time: 0, ownerId: 'T1' }, // 100 秒で expired
    ];
    const ref = createRef<RecastRowHandle>();
    const { container } = render(<RecastRow ref={ref} partyMembers={partyMembers} placements={placements} mitigationDefs={mitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    ref.current?.update(100);

    const icon = container.querySelector('.recast-cell')!.querySelector('.recast-icon') as HTMLDivElement;
    expect(icon.style.getPropertyValue('--cd-display')).toBe('none');
  });

  it('respects T/H limit (6) and DPS limit (2)', () => {
    // 7 種を T1 に、 3 種を D1 に配置 → T1 は 6 表示、 D1 は 2 表示
    const manyMitigations: Mitigation[] = Array.from({ length: 7 }).map((_, i) => ({
      id: 'tank' + i, jobId: 'WAR', name: { ja: 't' + i, en: 't' + i }, icon: '/x.png', recast: 60 + i * 10, duration: 10, type: 'all' as const, value: 0,
    })).concat(Array.from({ length: 3 }).map((_, i) => ({
      id: 'dps' + i, jobId: 'MNK', name: { ja: 'd' + i, en: 'd' + i }, icon: '/x.png', recast: 60 + i * 10, duration: 10, type: 'all' as const, value: 0,
    })));

    const placements: AppliedMitigation[] = [
      ...Array.from({ length: 7 }).map((_, i) => ({ id: 'pT' + i, mitigationId: 'tank' + i, time: 0, ownerId: 'T1' })),
      ...Array.from({ length: 3 }).map((_, i) => ({ id: 'pD' + i, mitigationId: 'dps' + i, time: 0, ownerId: 'D1' })),
    ];

    const ref = createRef<RecastRowHandle>();
    const { container } = render(<RecastRow ref={ref} partyMembers={partyMembers} placements={placements} mitigationDefs={manyMitigations} collapsed={false} onToggleCollapse={() => {}} labelText="リキャスト" />);
    ref.current?.update(20);

    const cells = container.querySelectorAll('.recast-cell');
    const t1Visible = Array.from(cells[0].querySelectorAll('.recast-icon')).filter(el => (el as HTMLElement).style.getPropertyValue('--cd-display') === 'flex');
    const d1Visible = Array.from(cells[4].querySelectorAll('.recast-icon')).filter(el => (el as HTMLElement).style.getPropertyValue('--cd-display') === 'flex');
    expect(t1Visible.length).toBe(6);
    expect(d1Visible.length).toBe(2);
  });

  it('collapsed=true adds .collapsed class to root', () => {
    const { container } = render(<RecastRow partyMembers={partyMembers} placements={[]} mitigationDefs={mitigations} collapsed={true} onToggleCollapse={() => {}} labelText="リキャスト" />);
    expect(container.querySelector('.recast-row')?.classList.contains('collapsed')).toBe(true);
  });
});
```

注: テスト用の `PartyMember` 型が `src/types/index.ts` のものと一致していることを確認 (jobId / role / id)。 違いがあればテストの mock 部分を実型に合わせる。

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npm run test -- RecastRow --reporter=verbose`
Expected: `Cannot find module '../RecastRow'` 等

- [ ] **Step 3: RecastRow コンポーネントを実装**

Create `src/components/RecastRow.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { AppliedMitigation, Mitigation, PartyMember } from '../types';
import { RecastIcon } from './RecastIcon';
import { getActiveRecasts, selectVisibleByLimit, calculateAngle } from '../utils/recastRow';

export interface RecastRowHandle {
  update: (currentTime: number) => void;
}

interface RecastRowProps {
  partyMembers: PartyMember[];
  placements: AppliedMitigation[];
  mitigationDefs: Mitigation[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  labelText: string;
}

const LIMIT_TH = 6;
const LIMIT_DPS = 2;

export const RecastRow = forwardRef<RecastRowHandle, RecastRowProps>(
  ({ partyMembers, placements, mitigationDefs, collapsed, onToggleCollapse, labelText }, ref) => {
    // メンバーごとに「これまで配置されたことのある全 mitigationId」 を抽出 (DOM 常駐用)
    const speciesByMember = useMemo(() => {
      const map = new Map<string, string[]>();
      for (const m of partyMembers) map.set(m.id, []);
      const seen = new Set<string>();
      for (const p of placements) {
        const key = p.ownerId + ':' + p.mitigationId;
        if (seen.has(key)) continue;
        seen.add(key);
        const arr = map.get(p.ownerId);
        if (arr) arr.push(p.mitigationId);
      }
      return map;
    }, [partyMembers, placements]);

    // 各アイコンの ref をメンバー×mitigationId のキーで持つ
    const iconRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    useImperativeHandle(ref, () => ({
      update: (currentTime: number) => {
        const placementsByOwner = new Map<string, AppliedMitigation[]>();
        for (const p of placements) {
          if (!placementsByOwner.has(p.ownerId)) placementsByOwner.set(p.ownerId, []);
          placementsByOwner.get(p.ownerId)!.push(p);
        }

        for (const member of partyMembers) {
          const memberPlacements = placementsByOwner.get(member.id) ?? [];
          const actives = getActiveRecasts(memberPlacements, mitigationDefs, currentTime);
          const limit = member.role === 'dps' ? LIMIT_DPS : LIMIT_TH;
          const visible = selectVisibleByLimit(actives, limit);

          const visibleByMitId = new Map(visible.map((v, idx) => [v.mitigationId, { ...v, order: idx }]));
          const species = speciesByMember.get(member.id) ?? [];

          for (const mitId of species) {
            const key = member.id + ':' + mitId;
            const el = iconRefs.current.get(key);
            if (!el) continue;
            const entry = visibleByMitId.get(mitId);
            if (!entry) {
              el.style.setProperty('--cd-display', 'none');
              continue;
            }
            el.style.setProperty('--cd-display', 'flex');
            el.style.setProperty('--cd-angle', calculateAngle(entry.remaining, entry.recast) + 'deg');
            el.style.setProperty('--cd-order', String(entry.order));
            const num = el.querySelector('.recast-num');
            if (num) num.textContent = String(Math.ceil(entry.remaining));
          }
        }
      },
    }), [partyMembers, placements, mitigationDefs, speciesByMember]);

    return (
      <div className={collapsed ? 'recast-row collapsed' : 'recast-row'}>
        <div className="recast-label">
          <span
            className="recast-chev"
            onClick={onToggleCollapse}
            role="button"
            aria-label={collapsed ? 'expand recast row' : 'collapse recast row'}
          >
            {collapsed ? '▶' : '▼'}
          </span>
          {labelText}
        </div>
        {partyMembers.map(member => {
          const species = speciesByMember.get(member.id) ?? [];
          return (
            <div key={member.id} className="recast-cell" data-member={member.id} data-role={member.role}>
              {species.map(mitId => {
                const def = mitigationDefs.find(d => d.id === mitId);
                if (!def) return null;
                const key = member.id + ':' + mitId;
                return (
                  <RecastIcon
                    key={key}
                    ref={(el) => { iconRefs.current.set(key, el); }}
                    iconUrl={def.icon}
                    alt={def.name.ja || def.name.en || mitId}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  },
);
RecastRow.displayName = 'RecastRow';
```

注: 上記実装は `display: contents` を root に適用する想定で書いてある (CSS 側で `.recast-row { display: contents }` 指定済み) ため、 親 (Timeline) の grid 構造に直接 cell が並ぶ。 もし grid 構造を流用しない場合は、 root を `display: grid` にして親と同じ template-columns を持たせる代替案を Task 5 で検討する。

- [ ] **Step 4: テスト実行 → PASS 確認**

Run: `npm run test -- RecastRow --reporter=verbose`
Expected: 全 PASS (7 ケース)

- [ ] **Step 5: tsc + lint チェック**

Run: `npx tsc --noEmit` および `npm run lint`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/RecastRow.tsx src/components/__tests__/RecastRow.test.tsx
rtk git commit -m "feat(recast-row): RecastRow コンポーネント + update メソッド (上限・並び順・同 species 統合)"
```

---

## Task 5: Timeline.tsx 統合 (折り畳み state + RecastRow 挿入 + scroll handler)

**Files:**
- Modify: `src/components/Timeline.tsx`

このタスクは既存の大きいファイルへの介入なので、 変更を最小限に分ける。

- [ ] **Step 1: 既存スクロール処理位置を特定し、 設計を確認**

Run: Grep で `onScroll` および `scrollContainerRef` の使用箇所を確認。 スクロールイベントハンドラが既に存在するか、 新規追加が必要かを判断。

```bash
grep -n "onScroll\|scrollContainerRef\.current\.addEventListener" src/components/Timeline.tsx | head -20
```

もし既存ハンドラがあればその中に処理を追加、 なければ `useEffect` で `scrollContainerRef.current.addEventListener('scroll', handler, { passive: true })` を新規追加。

- [ ] **Step 2: 折り畳み state 追加**

[Timeline.tsx:740 付近](../../../src/components/Timeline.tsx#L740) の `labelColumnCollapsed` 定義の下に追記:

```tsx
const [recastRowCollapsed, setRecastRowCollapsed] = useState(() => {
  try { return localStorage.getItem('lopo-recast-row-collapsed') === 'true'; } catch { return false; }
});

const handleToggleRecastRow = () => {
  setRecastRowCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem('lopo-recast-row-collapsed', String(next)); } catch {}
    return next;
  });
};
```

- [ ] **Step 3: recastRowRef を Timeline 本体に追加**

[Timeline.tsx:547 付近](../../../src/components/Timeline.tsx#L547) (Timeline コンポーネント本体の useRef 群が並ぶ場所) に追加:

```tsx
import { RecastRow, type RecastRowHandle } from './RecastRow';
// ...
const recastRowRef = useRef<RecastRowHandle>(null);
```

- [ ] **Step 4: ヘッダーと本文の間に RecastRow を挿入**

スクロールコンテナの中、 ヘッダー (sticky な部分) と本文 (TimelineRow が並ぶ部分) の間に `<RecastRow />` を 1 つ挿入する。 既存の grid template-columns と整合するように `display: contents` 戦略で配置 (CSS で対応済み)。

実装位置は実装時に既存の JSX 構造を Read で確認して決定。 期待形:

```tsx
<RecastRow
  ref={recastRowRef}
  partyMembers={sortedPartyMembers}
  placements={timelineMitigations}
  mitigationDefs={MITIGATIONS}
  collapsed={recastRowCollapsed}
  onToggleCollapse={handleToggleRecastRow}
  labelText={t('timeline.recast_row.label')}
/>
```

- [ ] **Step 5: スクロールイベントで update を呼ぶ**

既存のスクロールハンドラ (or 新規 useEffect) で:

```tsx
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;
  const handler = () => {
    const scrollTop = container.scrollTop;
    // 現在時刻 = スクロール上端の Y → 時刻
    // pixelsPerSecond と offsetTime と timeToYMap を考慮 (既存ロジックと同じ)
    const offsetTime = showPreStart ? -10 : 0;
    let currentTime: number;
    if (hideEmptyRows && timeToYMapRef.current) {
      // hideEmptyRows モード: Y に最も近い可視時刻を逆引き
      let closest = offsetTime;
      let minDiff = Infinity;
      timeToYMapRef.current.forEach((y, t) => {
        const diff = Math.abs(y - scrollTop);
        if (diff < minDiff) { minDiff = diff; closest = t; }
      });
      currentTime = closest;
    } else {
      currentTime = offsetTime + Math.round(scrollTop / pixelsPerSecond);
    }
    recastRowRef.current?.update(currentTime);
  };
  handler(); // 初回呼び出し (現在のスクロール位置で初期化)
  container.addEventListener('scroll', handler, { passive: true });
  return () => container.removeEventListener('scroll', handler);
}, [pixelsPerSecond, showPreStart, hideEmptyRows]);
```

注: 既存に類似ハンドラがあれば併合する。 重複イベントリスナを避ける。

- [ ] **Step 6: ローカル dev で動作確認**

```bash
npm run dev
```

ブラウザでタイムラインを開き:
- 配置済みスキルがあるプランで、 ヘッダー直下にリキャスト行が出現することを確認
- スクロールするとリキャスト中のアイコンが現れて clockswipe が動くことを確認
- 折り畳みシェブロンをクリックすると行が縮むことを確認
- リロード後も折り畳み状態が維持されることを確認 (localStorage)

OK ならスクショ撮影してユーザーに見せる (見せ方は別途決定、 必要なら playwright-skill で screenshot)。

- [ ] **Step 7: tsc + build + 全テスト**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Expected: 全部 PASS

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(recast-row): Timeline.tsx 統合 (折り畳み state + RecastRow 挿入 + scroll handler)"
```

---

## Task 6: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

- [ ] **Step 1: ja.json に追加**

`timeline` セクション内に `recast_row` を追加:

```json
"timeline": {
  ...既存...,
  "recast_row": {
    "label": "リキャスト"
  }
}
```

- [ ] **Step 2: en.json に追加**

```json
"recast_row": {
  "label": "Recast"
}
```

- [ ] **Step 3: ko.json に追加 (仮、 公式訳語に要確認)**

```json
"recast_row": {
  "label": "리캐스트"
}
```

実装後、 [reference_ff14_jobguide_urls.md](../../../C:/Users/masay/.claude/projects/c--Users-masay-Desktop-FF14Sim/memory/reference_ff14_jobguide_urls.md) 経由で公式韓国語版を確認し、 正式訳に置き換える。

- [ ] **Step 4: zh.json に追加 (仮、 公式訳語に要確認)**

```json
"recast_row": {
  "label": "技能冷却"
}
```

実装後、 公式中国語版で確認し正式訳に置き換える。

- [ ] **Step 5: 各言語で表示確認**

```bash
npm run dev
```

ブラウザで言語を切り替え (ja/en/ko/zh)、 リキャスト行のラベルが正しく表示されることを確認。

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(recast-row): i18n キー追加 (timeline.recast_row.label)"
```

---

## Task 7: 動作確認、 既存機能リグレッション、 デプロイ

**Files:** なし (動作確認 + commit + push のみ)

- [ ] **Step 1: フルテスト**

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Expected: 全部 PASS

- [ ] **Step 2: ローカル dev で既存機能リグレッションを確認**

以下の既存機能が壊れていないことを確認:
- 配置済みアイコンの表示 (本文)
- アイコンドラッグでの時刻変更
- フェーズオーバーレイ (色付き背景)
- ラベル列の表示
- フェーズ列・ラベル列の折り畳み
- スクロール挙動 (スムーズスクロール)
- モバイル表示 (PC 向けの仕様なのでモバイルで奇妙な見た目になっていないか)
- 既存の vitest 全 PASS

- [ ] **Step 3: ユーザーに実機確認を依頼**

「ローカル dev でこんな感じになりました」 として、 ブラウザのスクショまたは動画でユーザーに確認してもらう。 ユーザーの「OK」 を待つ。

- [ ] **Step 4: push + 本番デプロイ**

ユーザー承認後:
```bash
rtk git push origin feat/recast-row  # ブランチ作業の場合
# or
rtk git push origin main             # main 直接の場合
```

Vercel デプロイが自動で走ることを確認。 デプロイログでエラーがないこと、 本番 URL で動作することを確認。

- [ ] **Step 5: ユーザーに本番確認を依頼**

ユーザーが本番で動作確認し「OK」 を出したら、 TODO.md の「次セッション最優先 1 (リキャスト専用行)」 を `TODO_COMPLETED.md` に移動。

- [ ] **Step 6: 完了報告**

セッション完了時のチェックリスト (引き継ぎメッセージ、 TODO.md 整理、 docs 更新) を実施。 「効果中スキル最上行残し」 (次セッション最優先 2) は別タスクとして残置。

---

## 自己レビュー — Spec coverage check

Spec の各セクションが対応する Task:

| Spec セクション | 対応 Task |
|---|---|
| 2.1 対象スキル | Task 1 (getActiveRecasts) |
| 2.2 列構造 | Task 4 (各メンバー cell)、 Task 5 (Timeline 統合) |
| 2.3 現在時刻 | Task 5 (scroll handler) |
| 2.4 並び順 | Task 1 (selectVisibleByLimit)、 Task 4 (CSS order 適用) |
| 2.5 アイコン外観 | Task 2 (img のみ)、 Task 3 (CSS) |
| 2.6 同時表示数の上限 | Task 1 (selectVisibleByLimit)、 Task 4 (LIMIT_TH/LIMIT_DPS) |
| 2.7 CD オーバーレイ | Task 1 (calculateAngle)、 Task 3 (CSS conic-gradient)、 Task 4 (--cd-angle 更新) |
| 2.8 残秒テキスト | Task 2 (span.recast-num)、 Task 3 (CSS)、 Task 4 (textContent 更新) |
| 2.9 行高さ | Task 3 (CSS min-height) |
| 2.10 0 個の列 | Task 4 (cell は常駐、 中身が空) |
| 3. 折り畳み UI | Task 3 (CSS)、 Task 4 (collapsed prop + chevron)、 Task 5 (state + localStorage) |
| 4. 実装方針 | Task 1-5 全体 |
| 5. i18n | Task 6 |
| 6. やらないこと (スコープ外) | 各タスクで実装しない |
| 7. 未確定事項 | Task 5 (シェブロン位置)、 Task 6 (中韓訳語)、 Task 5 (scroll 方式)、 Task 7 (モバイル確認) |

カバレッジ漏れなし。

---

## 自己レビュー — Type consistency

主要な型シグネチャ:

| 型/名前 | 定義位置 | 使用位置 |
|---|---|---|
| `ActiveRecast` | Task 1 | Task 1, Task 4 |
| `RecastRowHandle.update(currentTime: number): void` | Task 4 | Task 5 |
| `RecastRowProps.placements: AppliedMitigation[]` | Task 4 | Task 5 |
| `--cd-display`, `--cd-angle`, `--cd-order` | Task 2 初期化、 Task 4 更新 | Task 3 で参照 |
| `localStorage` キー `lopo-recast-row-collapsed` | Task 5 | (永続化のみ) |

一貫性 OK。

---

## 自己レビュー — Placeholder scan

- 「TBD」 / 「TODO」 / 「実装時に決定」 のうち、 Spec 7 章の未確定事項に紐づくものはすべて Task 5/6/7 で具体的なアクション (Read 確認、 ユーザー確認) に展開済み
- 「Add appropriate error handling」 等の曖昧な指示なし
- 全テストコードは実コードを記述済み
- 全実装コードは具体的なコードを記述済み

placeholders なし。
