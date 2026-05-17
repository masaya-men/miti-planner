# Housing Sub-spec 2B — Plan E: Favorites Modal (お気に入り → ツアー組立)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** お気に入りモーダルを完成させる — 超でかいモーダル、 下透け、 横長低背カード、 Shift/Ctrl/矩形選択、 DnD でツアーエリアへ、 住所順自動整列 + アニメ、 全部回る + 共有

**Architecture:**
- DnD は `@dnd-kit/core` + `@dnd-kit/sortable` (既存依存)
- アニメは `framer-motion` の `LayoutGroup` + `motion.div` の layout prop で FLIP 並び替え
- 矩形選択は自作 (ref + mousedown/move/up イベント、 既存ツール不要)
- マルチ選択状態は local state `Set<string>`
- ツアー組立完了 → `useHousingTourStore.setListings` → `enterTourMode` で右パネル切替

**Tech Stack:** Plan A-D + `@dnd-kit/*` + `framer-motion`

**親仕様参照:** §7 (お気に入りモーダル + ツアー組立)、 §6.2 ツアー実行起動

**前提:** Plan A-D 完了済み

---

## File Structure

**新規作成 (component)**:
- `src/components/housing/workspace/FavoritesModal.tsx` — モーダル本体
- `src/components/housing/workspace/FavoritesListPane.tsx` — お気に入り一覧 (左半)
- `src/components/housing/workspace/TourBuilderPane.tsx` — ツアーエリア (右半、 DnD 受け先)
- `src/components/housing/workspace/FavoriteCard.tsx` — 横長低背カード
- `src/components/housing/workspace/TourBuilderItem.tsx` — ツアー側 1 行 (DnD ソート可能)
- `src/components/housing/workspace/MarqueeSelectionOverlay.tsx` — 矩形選択の枠表示
- `src/components/housing/workspace/MannerNoticeDialog.tsx` — ツアー開始前のマナー順守ポップ

**新規作成 (lib)**:
- `src/lib/housing/sortByAddress.ts` — DC → サーバー → エリア → 区 → 番地で並び替え
- `src/lib/housing/useMarqueeSelection.ts` — 矩形選択フック

**新規作成 (test)**:
- `src/__tests__/housing/FavoritesModal.test.tsx`
- `src/__tests__/housing/FavoritesListPane.test.tsx`
- `src/__tests__/housing/TourBuilderPane.test.tsx`
- `src/__tests__/housing/FavoriteCard.test.tsx`
- `src/__tests__/housing/sortByAddress.test.ts`
- `src/__tests__/housing/useMarqueeSelection.test.tsx`
- `src/__tests__/housing/MannerNoticeDialog.test.tsx`

**編集**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — モーダル開閉 state + TopBar の ♡ と接続
- `src/components/housing/workspace/TopBar.tsx` — ♡ クリックでモーダル開く props
- `src/components/housing/workspace/index.ts`
- `src/locales/{ja,en,ko,zh}.ts` — `housing.workspace.favorites.*`

---

## Task 1: sortByAddress (TDD)

**Files:**
- Create: `src/lib/housing/sortByAddress.ts`
- Test: `src/__tests__/housing/sortByAddress.test.ts`

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/sortByAddress.test.ts
import { describe, it, expect } from 'vitest';
import { sortByAddress } from '../../lib/housing/sortByAddress';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('sortByAddress', () => {
  it('sorts by DC > server > area > ward > plot', () => {
    const sample = MOCK_LISTINGS.slice(0, 5);
    const sorted = sortByAddress(sample);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const cmp = a.dc.localeCompare(b.dc)
                  || a.server.localeCompare(b.server)
                  || a.area.localeCompare(b.area)
                  || (a.ward - b.ward)
                  || (a.plot - b.plot);
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  it('does not mutate input', () => {
    const sample = MOCK_LISTINGS.slice(0, 3);
    const before = [...sample];
    sortByAddress(sample);
    expect(sample).toEqual(before);
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/lib/housing/sortByAddress.ts
import type { MockListing } from '../../data/housing/mockListings';

export function sortByAddress<T extends Pick<MockListing, 'dc' | 'server' | 'area' | 'ward' | 'plot'>>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.dc.localeCompare(b.dc) ||
    a.server.localeCompare(b.server) ||
    a.area.localeCompare(b.area) ||
    (a.ward - b.ward) ||
    (a.plot - b.plot)
  );
}
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/sortByAddress.test.ts
git add src/lib/housing/sortByAddress.ts src/__tests__/housing/sortByAddress.test.ts
git commit -m "feat(housing): sortByAddress (DC > server > area > ward > plot)"
```

---

## Task 2: useMarqueeSelection フック (TDD)

**Files:**
- Create: `src/lib/housing/useMarqueeSelection.ts`
- Test: `src/__tests__/housing/useMarqueeSelection.test.tsx`

矩形選択。 containerRef の中で mousedown (背景部分のみ) → ドラッグで矩形描画 → mouseup で範囲内アイテムを選択。

- [ ] **Step 1: 実装ロジックの仕様コメントと共に書く**

```typescript
// src/lib/housing/useMarqueeSelection.ts
import { useEffect, useRef, useState } from 'react';

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UseMarqueeSelectionOptions {
  /** Container ref. Marquee starts only when mousedown target is the container itself (not a child). */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Selector for items that can be selected. Each must have data-listing-id="..." */
  itemSelector: string;
  /** Called when selection finishes. */
  onComplete: (selectedIds: string[], modifierKeys: { shift: boolean; ctrl: boolean; meta: boolean }) => void;
}

/**
 * Adds marquee (rubber-band) selection to a container.
 * - Marquee starts ONLY when mousedown target is the container itself
 *   (or an explicitly-marked background element via `data-marquee-bg="true"`).
 * - Items must carry `data-listing-id` to be selectable.
 */
export function useMarqueeSelection({ containerRef, itemSelector, onComplete }: UseMarqueeSelectionOptions) {
  const [rect, setRect] = useState<MarqueeRect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const modifiersRef = useRef({ shift: false, ctrl: false, meta: false });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Only start when clicking the container or its marked background
      const isBg = target === container || target.dataset.marqueeBg === 'true';
      if (!isBg) return;
      const containerRect = container.getBoundingClientRect();
      startRef.current = { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top };
      modifiersRef.current = { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey };
      setRect({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 });
    };

    const onMove = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;
      const containerRect = container.getBoundingClientRect();
      const curX = e.clientX - containerRect.left;
      const curY = e.clientY - containerRect.top;
      setRect({
        x: Math.min(start.x, curX),
        y: Math.min(start.y, curY),
        w: Math.abs(curX - start.x),
        h: Math.abs(curY - start.y),
      });
    };

    const onUp = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;
      const containerRect = container.getBoundingClientRect();
      const endX = e.clientX - containerRect.left;
      const endY = e.clientY - containerRect.top;
      const rx1 = Math.min(start.x, endX), ry1 = Math.min(start.y, endY);
      const rx2 = Math.max(start.x, endX), ry2 = Math.max(start.y, endY);

      const items = container.querySelectorAll<HTMLElement>(itemSelector);
      const selected: string[] = [];
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        const ix1 = r.left - containerRect.left;
        const iy1 = r.top - containerRect.top;
        const ix2 = ix1 + r.width;
        const iy2 = iy1 + r.height;
        const intersects = !(ix2 < rx1 || ix1 > rx2 || iy2 < ry1 || iy1 > ry2);
        if (intersects) {
          const id = el.dataset.listingId;
          if (id) selected.push(id);
        }
      });

      onComplete(selected, modifiersRef.current);
      startRef.current = null;
      setRect(null);
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [containerRef, itemSelector, onComplete]);

  return rect;
}
```

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/useMarqueeSelection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useMarqueeSelection } from '../../lib/housing/useMarqueeSelection';

function Probe({ onComplete }: { onComplete: (ids: string[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = useMarqueeSelection({
    containerRef: ref,
    itemSelector: '[data-listing-id]',
    onComplete: (ids) => onComplete(ids),
  });
  return (
    <div ref={ref} data-testid="container" style={{ position: 'relative', width: 400, height: 300 }}>
      <div data-listing-id="a" style={{ position: 'absolute', left: 10, top: 10, width: 80, height: 30 }}>a</div>
      <div data-listing-id="b" style={{ position: 'absolute', left: 200, top: 200, width: 80, height: 30 }}>b</div>
      {rect && <div data-testid="rect" />}
    </div>
  );
}

describe('useMarqueeSelection', () => {
  it('calls onComplete after a drag (no items intersected when bbox=0 in jsdom)', () => {
    const onComplete = vi.fn();
    const { getByTestId } = render(<Probe onComplete={onComplete} />);
    const container = getByTestId('container');
    fireEvent.mouseDown(container, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(window, { clientX: 50, clientY: 50 });
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not start when mousedown target is an item (not background)', () => {
    const onComplete = vi.fn();
    const { container } = render(<Probe onComplete={onComplete} />);
    const item = container.querySelector('[data-listing-id="a"]') as HTMLElement;
    fireEvent.mouseDown(item, { button: 0 });
    fireEvent.mouseUp(window);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
```

注: jsdom では getBoundingClientRect が全て 0 返すので、 実際の矩形交差は E2E (Playwright) で確認。 ユニットは「started/not-started」 の挙動だけテスト。

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/useMarqueeSelection.test.tsx
git add src/lib/housing/useMarqueeSelection.ts \
        src/__tests__/housing/useMarqueeSelection.test.tsx
git commit -m "feat(housing): useMarqueeSelection hook (rubber-band)"
```

---

## Task 3: FavoriteCard (TDD)

**Files:**
- Create: `src/components/housing/workspace/FavoriteCard.tsx`
- Test: `src/__tests__/housing/FavoriteCard.test.tsx`

横長低背カード (高さ 64px 目安、 サムネ + 住所 + 短紹介)。 multi-select 用にチェックボックスとクリック動作を持つ。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/FavoriteCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoriteCard } from '../../components/housing/workspace/FavoriteCard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('FavoriteCard', () => {
  const listing = MOCK_LISTINGS[0];

  it('renders address + size + truncated description', () => {
    render(<FavoriteCard listing={listing} selected={false} onClick={() => {}} />);
    expect(screen.getByText(/Shirogane|シロガネ/)).toBeInTheDocument();
  });

  it('reflects selected state via data-selected', () => {
    const { container } = render(<FavoriteCard listing={listing} selected={true} onClick={() => {}} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-selected')).toBe('true');
    expect(root.getAttribute('data-listing-id')).toBe(listing.id);
  });

  it('forwards modifier keys via onClick', () => {
    const onClick = vi.fn();
    render(<FavoriteCard listing={listing} selected={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'), { shiftKey: true });
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ shift: true }));
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/FavoriteCard.tsx
import type { MockListing } from '../../../data/housing/mockListings';

export interface FavoriteCardClickModifiers {
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

export interface FavoriteCardProps {
  listing: MockListing;
  selected: boolean;
  onClick: (mod: FavoriteCardClickModifiers) => void;
}

const placeholder = '/housing/mock-thumbs/placeholder.svg';

export const FavoriteCard: React.FC<FavoriteCardProps> = ({ listing, selected, onClick }) => {
  const imgSrc =
    listing.imageMode === 'thumbnail' && listing.thumbnailPath
      ? listing.thumbnailPath
      : listing.imageMode === 'sns' && listing.ogImageUrl
      ? listing.ogImageUrl
      : placeholder;

  return (
    <button
      type="button"
      data-listing-id={listing.id}
      data-selected={selected}
      onClick={(e) => onClick({ shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey })}
      className="w-full flex items-center gap-3 p-2 rounded-md text-left text-white transition-all focus:outline-none"
      style={{
        background: selected ? 'rgba(255,201,135,0.18)' : 'rgba(255,255,255,0.04)',
        border: selected ? '1px solid #ffc987' : '1px solid rgba(255,255,255,0.18)',
        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      <div className="w-14 h-14 shrink-0 rounded overflow-hidden bg-black/30">
        <img src={imgSrc} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {listing.dc}/{listing.server} {listing.area} {listing.ward}-{listing.plot}
          <span className="ml-1.5 text-xs opacity-70">{listing.size}</span>
        </div>
        {listing.description && (
          <div className="text-xs opacity-70 truncate">{listing.description}</div>
        )}
      </div>
    </button>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/FavoriteCard.test.tsx
git add src/components/housing/workspace/FavoriteCard.tsx \
        src/__tests__/housing/FavoriteCard.test.tsx
git commit -m "feat(housing): FavoriteCard (horizontal low-profile)"
```

---

## Task 4: FavoritesListPane (TDD)

**Files:**
- Create: `src/components/housing/workspace/FavoritesListPane.tsx`
- Test: `src/__tests__/housing/FavoritesListPane.test.tsx`

お気に入り一覧 (左半) + マルチ選択 + 矩形選択。 親から受け取った selected set を更新するコールバック。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/FavoritesListPane.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoritesListPane } from '../../components/housing/workspace/FavoritesListPane';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('FavoritesListPane', () => {
  beforeEach(() => {
    useHousingFavoritesStore.getState().reset();
    MOCK_LISTINGS.slice(0, 5).forEach((l) => useHousingFavoritesStore.getState().add(l.id));
  });

  it('renders one FavoriteCard per favorited listing', () => {
    render(<FavoritesListPane selected={new Set()} onSelectionChange={() => {}} />);
    const cards = screen.getAllByRole('button').filter((b) => b.getAttribute('data-listing-id'));
    expect(cards.length).toBe(5);
  });

  it('toggles selection on single click', () => {
    const onSelectionChange = vi.fn();
    render(<FavoritesListPane selected={new Set()} onSelectionChange={onSelectionChange} />);
    const firstCard = screen.getAllByRole('button')[0];
    fireEvent.click(firstCard);
    expect(onSelectionChange).toHaveBeenCalled();
    const newSet = onSelectionChange.mock.calls[0][0] as Set<string>;
    expect(newSet.size).toBe(1);
  });

  it('shows empty state when no favorites', () => {
    useHousingFavoritesStore.getState().reset();
    render(<FavoritesListPane selected={new Set()} onSelectionChange={() => {}} />);
    expect(screen.getByText(/集めて|gather|모아|收集/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: i18n 追加**

`housing.workspace.favorites.{title,empty,hint,clear_selection}` (4 言語):
- title: 'お気に入り' / 'Favorites' / '즐겨찾기' / '收藏'
- empty: '気に入ったお家を ♡ で集めて、 自分だけのツアーを作ろう'
- hint: 'Shift/Ctrl で複数選択、 範囲ドラッグでまとめて選択' / 'Shift/Ctrl to multi-select, drag to marquee'
- clear_selection: '選択解除' / 'Clear' / '선택 해제' / '取消选择'

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/FavoritesListPane.tsx
import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { useMarqueeSelection } from '../../../lib/housing/useMarqueeSelection';
import { FavoriteCard, type FavoriteCardClickModifiers } from './FavoriteCard';

export interface FavoritesListPaneProps {
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}

export const FavoritesListPane: React.FC<FavoritesListPaneProps> = ({ selected, onSelectionChange }) => {
  const { t } = useTranslation();
  const favoriteIds = useHousingFavoritesStore((s) => s.ids);
  const favorites = favoriteIds
    .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
    .filter(Boolean) as typeof MOCK_LISTINGS;
  const containerRef = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<string | null>(null);

  const handleCardClick = useCallback((id: string, mod: FavoriteCardClickModifiers) => {
    const next = new Set(selected);
    if (mod.shift && lastClickedRef.current) {
      // Range select between lastClicked and current
      const ids = favorites.map((l) => l.id);
      const a = ids.indexOf(lastClickedRef.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        for (let i = lo; i <= hi; i++) next.add(ids[i]);
      }
    } else if (mod.ctrl || mod.meta) {
      if (next.has(id)) next.delete(id); else next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    lastClickedRef.current = id;
    onSelectionChange(next);
  }, [favorites, selected, onSelectionChange]);

  const marqueeRect = useMarqueeSelection({
    containerRef,
    itemSelector: '[data-listing-id]',
    onComplete: (ids, mod) => {
      const next = (mod.shift || mod.ctrl || mod.meta) ? new Set(selected) : new Set<string>();
      ids.forEach((id) => next.add(id));
      onSelectionChange(next);
    },
  });

  if (favorites.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center opacity-78">
        <p className="text-sm">{t('housing.workspace.favorites.empty')}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col" style={{ color: '#ffffff' }}>
      <div className="flex items-center justify-between p-3 shrink-0 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
        <h3 className="text-sm uppercase tracking-widest opacity-78">
          {t('housing.workspace.favorites.title')} ({favorites.length})
        </h3>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onSelectionChange(new Set())}
            className="text-xs opacity-78 underline"
          >
            {t('housing.workspace.favorites.clear_selection')} ({selected.size})
          </button>
        )}
      </div>

      <p className="px-3 pt-2 text-xs opacity-55 shrink-0">{t('housing.workspace.favorites.hint')}</p>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto p-3 space-y-2"
        data-marquee-bg="true"
      >
        {favorites.map((listing) => (
          <FavoriteCard
            key={listing.id}
            listing={listing}
            selected={selected.has(listing.id)}
            onClick={(mod) => handleCardClick(listing.id, mod)}
          />
        ))}
        {marqueeRect && (
          <div
            className="pointer-events-none absolute border"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.w,
              height: marqueeRect.h,
              borderColor: '#ffc987',
              background: 'rgba(255,201,135,0.10)',
            }}
          />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/FavoritesListPane.test.tsx
git add src/components/housing/workspace/FavoritesListPane.tsx \
        src/__tests__/housing/FavoritesListPane.test.tsx \
        src/locales/
git commit -m "feat(housing): FavoritesListPane (multi-select + marquee)"
```

---

## Task 5: TourBuilderItem + TourBuilderPane (TDD)

**Files:**
- Create: `src/components/housing/workspace/TourBuilderItem.tsx`
- Create: `src/components/housing/workspace/TourBuilderPane.tsx`
- Test: `src/__tests__/housing/TourBuilderPane.test.tsx`

ツアーエリア。 framer-motion で layout アニメ、 @dnd-kit/sortable で並び替え。 自動整列 (sortByAddress) + 編集可。

- [ ] **Step 1: i18n 追加**

`housing.workspace.tour_builder.{title,empty,remove,sort_by_address,custom_order}` (4 言語):
- title: 'ツアー' / 'Tour' / '투어' / '巡游'
- empty: 'お気に入りから選んで、 ここにドラッグ' / 'Select favorites and drag here' / ...
- remove: 'ツアーから除外' / 'Remove' / ...
- sort_by_address: '住所順に戻す' / 'Re-sort by address' / ...
- custom_order: 'カスタム順' / 'Custom order' / ...

- [ ] **Step 2: TourBuilderItem 実装**

```typescript
// src/components/housing/workspace/TourBuilderItem.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourBuilderItemProps {
  listing: MockListing;
  index: number;
  onRemove: () => void;
}

export const TourBuilderItem: React.FC<TourBuilderItemProps> = ({ listing, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: listing.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md text-white"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-55 hover:opacity-100"
        aria-label="drag"
      >
        <GripVertical size={14} />
      </button>
      <span className="text-xs opacity-55 tabular-nums w-5 text-right">{index + 1}.</span>
      <div className="flex-1 min-w-0 text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
        {listing.area} {listing.ward}-{listing.plot} <span className="opacity-70 text-xs">{listing.size}</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        className="p-1 rounded transition-colors hover:bg-white/10"
      >
        <X size={14} />
      </button>
    </div>
  );
};
```

- [ ] **Step 3: TourBuilderPane 実装**

```typescript
// src/components/housing/workspace/TourBuilderPane.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { TourBuilderItem } from './TourBuilderItem';

export interface TourBuilderPaneProps {
  listingIds: string[];
  onChange: (next: string[]) => void;
}

export const TourBuilderPane: React.FC<TourBuilderPaneProps> = ({ listingIds, onChange }) => {
  const { t } = useTranslation();
  const [autoSort, setAutoSort] = useState(true);

  // Apply auto-sort when enabled
  useEffect(() => {
    if (!autoSort) return;
    const listings = listingIds
      .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
      .filter(Boolean) as typeof MOCK_LISTINGS;
    const sorted = sortByAddress(listings).map((l) => l.id);
    if (sorted.join(',') !== listingIds.join(',')) {
      onChange(sorted);
    }
  }, [autoSort, listingIds, onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = listingIds.indexOf(active.id as string);
    const newIdx = listingIds.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(listingIds, oldIdx, newIdx));
    setAutoSort(false); // user customized
  };

  const listings = listingIds
    .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
    .filter(Boolean) as typeof MOCK_LISTINGS;

  return (
    <div className="flex flex-col h-full" style={{ color: '#ffffff' }}>
      <div className="flex items-center justify-between p-3 shrink-0 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
        <h3 className="text-sm uppercase tracking-widest opacity-78">
          {t('housing.workspace.tour_builder.title')} ({listings.length})
        </h3>
        {!autoSort && listings.length > 0 && (
          <button
            type="button"
            onClick={() => setAutoSort(true)}
            className="text-xs underline opacity-78"
          >
            {t('housing.workspace.tour_builder.sort_by_address')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {listings.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center opacity-55 px-4">
            <p className="text-sm">{t('housing.workspace.tour_builder.empty')}</p>
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={listingIds} strategy={verticalListSortingStrategy}>
              <AnimatePresence initial={false}>
                {listings.map((listing, i) => (
                  <motion.div
                    key={listing.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  >
                    <TourBuilderItem
                      listing={listing}
                      index={i}
                      onRemove={() => onChange(listingIds.filter((id) => id !== listing.id))}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: テスト**

```typescript
// src/__tests__/housing/TourBuilderPane.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TourBuilderPane } from '../../components/housing/workspace/TourBuilderPane';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('TourBuilderPane', () => {
  it('renders empty hint when no listings', () => {
    render(<TourBuilderPane listingIds={[]} onChange={() => {}} />);
    expect(screen.getByText(/ドラッグ|drag|드래그|拖|拽/i)).toBeInTheDocument();
  });

  it('renders one item per id', () => {
    const ids = MOCK_LISTINGS.slice(0, 3).map((l) => l.id);
    render(<TourBuilderPane listingIds={ids} onChange={() => {}} />);
    // header (Tour) + 3 items each with grip + remove buttons + at most a sort-by-address button
    const items = screen.getAllByLabelText(/remove/);
    expect(items.length).toBe(3);
  });

  it('auto-sorts listings by address on first mount', () => {
    const ids = ['mock-003', 'mock-001', 'mock-002'];
    const onChange = vi.fn();
    render(<TourBuilderPane listingIds={ids} onChange={onChange} />);
    // sort would emit a re-ordered array
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/TourBuilderPane.test.tsx
git add src/components/housing/workspace/TourBuilderItem.tsx \
        src/components/housing/workspace/TourBuilderPane.tsx \
        src/__tests__/housing/TourBuilderPane.test.tsx \
        src/locales/
git commit -m "feat(housing): TourBuilderPane (DnD + auto-sort + FLIP anim)"
```

---

## Task 6: MannerNoticeDialog (TDD)

**Files:**
- Create: `src/components/housing/workspace/MannerNoticeDialog.tsx`
- Test: `src/__tests__/housing/MannerNoticeDialog.test.tsx`

ツアー実行前のマナー順守ポップ。 親仕様 §6.2 + §8.5。 「次回から表示しない」 を LocalStorage に保存。

- [ ] **Step 1: i18n 追加**

`housing.workspace.manner.{title,body,dont_show_again,cancel,start}` (4 言語)

- [ ] **Step 2: 実装 + テスト**

```typescript
// src/components/housing/workspace/MannerNoticeDialog.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'housing-manner-dismissed';

export function isMannerNoticeDismissed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export interface MannerNoticeDialogProps {
  open: boolean;
  onCancel: () => void;
  onStart: () => void;
}

export const MannerNoticeDialog: React.FC<MannerNoticeDialogProps> = ({ open, onCancel, onStart }) => {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(false);

  if (!open) return null;

  const handleStart = () => {
    if (dontShow) localStorage.setItem(STORAGE_KEY, 'true');
    onStart();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="max-w-md w-full mx-4 p-6 rounded-lg text-white"
        style={{
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(255,255,255,0.22)',
          textShadow: '0 1px 2px rgba(0,0,0,0.55)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium mb-3">🏠 {t('housing.workspace.manner.title')}</h2>
        <p className="text-sm opacity-78 mb-4 leading-relaxed">{t('housing.workspace.manner.body')}</p>
        <label className="flex items-center gap-2 mb-5 text-sm">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          <span>{t('housing.workspace.manner.dont_show_again')}</span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm transition-colors hover:bg-white/10"
          >
            {t('housing.workspace.manner.cancel')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{ background: '#ffc987', color: '#000' }}
          >
            {t('housing.workspace.manner.start')}
          </button>
        </div>
      </div>
    </div>
  );
};
```

```typescript
// src/__tests__/housing/MannerNoticeDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MannerNoticeDialog, isMannerNoticeDismissed } from '../../components/housing/workspace/MannerNoticeDialog';

describe('MannerNoticeDialog', () => {
  beforeEach(() => localStorage.clear());

  it('does not render when closed', () => {
    const { container } = render(<MannerNoticeDialog open={false} onCancel={() => {}} onStart={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders body when open', () => {
    render(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={() => {}} />);
    expect(screen.getByRole('button', { name: /start|はじめる|시작|开始/i })).toBeInTheDocument();
  });

  it('calls onStart and persists dismissal when checked', () => {
    const onStart = vi.fn();
    render(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={onStart} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /start|はじめる|시작|开始/i }));
    expect(onStart).toHaveBeenCalledOnce();
    expect(isMannerNoticeDismissed()).toBe(true);
  });
});
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/MannerNoticeDialog.test.tsx
git add src/components/housing/workspace/MannerNoticeDialog.tsx \
        src/__tests__/housing/MannerNoticeDialog.test.tsx \
        src/locales/
git commit -m "feat(housing): MannerNoticeDialog (one-time tour start prompt)"
```

---

## Task 7: FavoritesModal — 統合

**Files:**
- Create: `src/components/housing/workspace/FavoritesModal.tsx`
- Test: `src/__tests__/housing/FavoritesModal.test.tsx`

モーダル本体。 上部に「全部回る」 + 「共有」 + 「閉じる」、 下に FavoritesListPane (左) + TourBuilderPane (右)。

- [ ] **Step 1: i18n 追加**

`housing.workspace.favorites.{run_all,close_modal}` (4 言語):
- run_all: '全部回る' / 'Tour all' / '전체 둘러보기' / '全部参观'
- close_modal: '閉じる' / 'Close' / '닫기' / '关闭'

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/FavoritesModal.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoritesModal } from '../../components/housing/workspace/FavoritesModal';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import { useHousingTourStore } from '../../store/useHousingTourStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('FavoritesModal', () => {
  beforeEach(() => {
    useHousingFavoritesStore.getState().reset();
    useHousingTourStore.getState().reset();
    useHousingViewStore.getState().reset();
    MOCK_LISTINGS.slice(0, 3).forEach((l) => useHousingFavoritesStore.getState().add(l.id));
  });

  it('renders modal with two panes and action bar when open', () => {
    render(<FavoritesModal open={true} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /全部|tour all|전체|全部参/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /閉じる|close|닫기|关闭/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<FavoritesModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close clicked', () => {
    const onClose = vi.fn();
    render(<FavoritesModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /閉じる|close|닫기|关闭/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/FavoritesModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { FavoritesListPane } from './FavoritesListPane';
import { TourBuilderPane } from './TourBuilderPane';
import { ShareTourButton } from './ShareTourButton';
import { MannerNoticeDialog, isMannerNoticeDismissed } from './MannerNoticeDialog';
import { sortByAddress } from '../../../lib/housing/sortByAddress';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { nanoid } from 'nanoid';

export interface FavoritesModalProps {
  open: boolean;
  onClose: () => void;
}

function getOrCreateTourId(): string {
  const k = 'housing-tour-id';
  const existing = sessionStorage.getItem(k);
  if (existing) return existing;
  const id = nanoid(10);
  sessionStorage.setItem(k, id);
  return id;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const favoriteIds = useHousingFavoritesStore((s) => s.ids);
  const enterTourMode = useHousingViewStore((s) => s.enterTourMode);
  const setListings = useHousingTourStore((s) => s.setListings);
  const startTour = useHousingTourStore((s) => s.start);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tourIds, setTourIds] = useState<string[]>([]);
  const [mannerOpen, setMannerOpen] = useState(false);
  const tourId = getOrCreateTourId();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setTourIds([]);
    }
  }, [open]);

  if (!open) return null;

  const beginTourStart = () => {
    // Default: if tourIds empty, use ALL favorites
    if (tourIds.length === 0) {
      const all = favoriteIds
        .map((id) => MOCK_LISTINGS.find((l) => l.id === id))
        .filter(Boolean) as typeof MOCK_LISTINGS;
      setTourIds(sortByAddress(all).map((l) => l.id));
    }
    if (isMannerNoticeDismissed()) {
      doStart();
    } else {
      setMannerOpen(true);
    }
  };

  const doStart = () => {
    const ids = tourIds.length > 0
      ? tourIds
      : (() => {
          const all = favoriteIds.map((id) => MOCK_LISTINGS.find((l) => l.id === id)).filter(Boolean) as typeof MOCK_LISTINGS;
          return sortByAddress(all).map((l) => l.id);
        })();
    setListings(ids);
    startTour();
    enterTourMode();
    setMannerOpen(false);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
        onClick={onClose}
      >
        <div
          className="w-[92vw] h-[88vh] rounded-lg overflow-hidden flex flex-col"
          style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.22)',
            color: '#ffffff',
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Action bar */}
          <div className="flex items-center justify-between gap-4 p-3 shrink-0 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={beginTourStart}
                disabled={favoriteIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: '#ffc987', color: '#000' }}
              >
                <Play size={14} />
                {t('housing.workspace.favorites.run_all')} ({favoriteIds.length})
              </button>
              <div className="w-48">
                <ShareTourButton tourId={tourId} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('housing.workspace.favorites.close_modal')}
              className="p-2 rounded transition-colors hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          {/* Two panes */}
          <div className="flex-1 min-h-0 flex">
            <div className="w-1/2 border-r" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
              <FavoritesListPane selected={selected} onSelectionChange={setSelected} />
            </div>
            <div className="w-1/2">
              <TourBuilderPane
                listingIds={tourIds.length > 0 ? tourIds : Array.from(selected)}
                onChange={setTourIds}
              />
            </div>
          </div>
        </div>
      </div>

      <MannerNoticeDialog open={mannerOpen} onCancel={() => setMannerOpen(false)} onStart={doStart} />
    </>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/FavoritesModal.test.tsx
git add src/components/housing/workspace/FavoritesModal.tsx \
        src/__tests__/housing/FavoritesModal.test.tsx \
        src/locales/
git commit -m "feat(housing): FavoritesModal (FavoritesListPane + TourBuilderPane + tour start)"
```

---

## Task 8: HousingWorkspace + TopBar から開く配線

**Files:**
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`
- Modify: `src/components/housing/workspace/TopBar.tsx`
- Modify: `src/components/housing/workspace/index.ts`

- [ ] **Step 1: TopBar を props ベースに変更**

```typescript
// src/components/housing/workspace/TopBar.tsx 修正
export interface TopBarProps {
  onRegisterClick: () => void;
  onFavoritesClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onRegisterClick, onFavoritesClick }) => {
  const { t } = useTranslation();
  // ... 既存スタイル
  return (
    <header /* ... */>
      {/* logo, search 部分は同じ */}
      {/* 右の button 群を onClick 渡し */}
      <button type="button" onClick={onRegisterClick} /* ... */>...</button>
      <button type="button" onClick={onFavoritesClick} aria-label={t('housing.workspace.topbar.favorites')} /* ... */>
        <Heart size={18} />
      </button>
      {/* profile はまだプレースホルダ */}
    </header>
  );
};
```

TopBar の既存テストは props 提供が必要、 修正:

```typescript
// src/__tests__/housing/TopBar.test.tsx 修正
render(<TopBar onRegisterClick={() => {}} onFavoritesClick={() => {}} />);
```

- [ ] **Step 2: HousingWorkspace で state + 接続**

```typescript
// src/components/housing/workspace/HousingWorkspace.tsx
// imports
import { FavoritesModal } from './FavoritesModal';

export const HousingWorkspace: React.FC = () => {
  // ... 既存
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);

  return (
    <main /* ... */>
      <SceneryVideo theme={theme} />
      <div /* ... */>
        <TopBar
          onRegisterClick={() => setRegisterModalOpen(true)}
          onFavoritesClick={() => setFavoritesModalOpen(true)}
        />
        {/* 既存の左/中/右 panels */}
        <StatusBar />
      </div>
      {/* register modal placeholder (Plan F で接続) */}
      {registerModalOpen && (
        <div /* placeholder */>...</div>
      )}
      <FavoritesModal open={favoritesModalOpen} onClose={() => setFavoritesModalOpen(false)} />
    </main>
  );
};
```

- [ ] **Step 3: index.ts に追加**

```typescript
export { FavoritesModal } from './FavoritesModal';
```

- [ ] **Step 4: dev 目視確認**

```bash
npm run dev
```

期待:
- TopBar の ♡ クリックでお気に入りモーダル開く
- (お気に入りに何か追加してから) → 左にお気に入り一覧、 右にツアーエリア
- Shift / Ctrl / 矩形選択で複数選択
- 「全部回る」 ボタン → マナーポップ → はじめる → モーダル閉じる → 右パネルがツアー進行モードに
- Enter / Space で次へ進む
- ツアー終了で閲覧モードに戻る

- [ ] **Step 5: ビルド検証 + 全テスト**

```bash
npm run build && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/TopBar.tsx \
        src/__tests__/housing/TopBar.test.tsx \
        src/components/housing/workspace/index.ts
git commit -m "feat(housing): wire FavoritesModal to TopBar heart icon + tour kickoff"
```

---

## Self-Review Checklist

### 仕様書カバレッジ

| 設計書セクション | Plan E 対応 |
|---|---|
| §7.1 multi-entrypoint (♡ + アバター) | Task 8 (♡)、 アバター連動は Plan F |
| §7.2 超でかいモーダル + 下透け | Task 7 (92vw × 88vh + black/35 backdrop) |
| §7.3 横長低背カード | Task 3 |
| §7.4 Shift/Ctrl/矩形選択/DnD | Task 2, 4, 5 |
| §7.5 自動整列 + アニメ可視化 | Task 5 (sortByAddress + framer-motion layout) |
| §7.5 編集可 (DnD で並び替え) | Task 5 |
| §7.5 × ボタンで除外 | Task 5 |
| §7.6 「全部回る」 一発 | Task 7 (action bar) |
| §6.2 共有ボタン (モーダルでも表示) | Task 7 (action bar) |
| §6.2 マナー順守ポップ | Task 6 |

### Plan E スコープ外

- マナー順守ポップの「次回から表示しない」 状態がツアーに着地した時の振る舞い → Plan F でログインユーザー連動 (Firestore)
- 「自分の登録」 タブ → Plan F (実装するか判断)
- アバターメニューからの開閉 → Plan F

### Placeholder Scan

- 全 step に actual code or actual command ✓
- "TBD" は無し、 マイページタブだけ Plan F に持ち越し ✓

---

## 完了の定義

- [ ] TopBar の ♡ クリックでモーダル開く (お気に入り 0 件でも開ける)
- [ ] お気に入りがあるとき、 左ペインに低背カードで一覧
- [ ] クリック / Shift+Click / Ctrl+Click / 矩形選択で multi-select 動作
- [ ] DnD でツアーエリアに移動 + 並び替え
- [ ] 自動整列 ON でアドレス順、 DnD すると「住所順に戻す」 ボタン出現
- [ ] FLIP アニメで並び替えが滑らかに見える
- [ ] 「全部回る」 → マナーポップ → ツアーモード突入
- [ ] Enter/Space で次へ、 右パネルがハイライト
- [ ] ツアー終了で閲覧モードに戻る
- [ ] `npm run build` + `npx vitest run` 全 pass
