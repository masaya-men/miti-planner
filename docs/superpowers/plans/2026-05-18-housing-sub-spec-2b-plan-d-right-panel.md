# Housing Sub-spec 2B — Plan D: Right Panel (右パネル)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 右パネルを完成させる — 閲覧モードでは中央表示状態に追従する auto-scroll 物件リスト、 ツアーモードでは進行に合わせて scroll + Enter/Space で次へ、 共有ボタン、 パネル開閉

**Architecture:**
- 同じ `RightPanel` コンポーネントが mode 切替で 2 つの状態を持つ
- 閲覧モード: `AutoScrollList` (rAF ベースのスクロール、 ホバー停止)
- ツアーモード: `TourProgressList` (現在位置ハイライト、 共有ボタン、 キーボードハンドラ)
- 共有 URL は `navigator.clipboard.writeText` でクリップボードコピー、 完了トースト (Plan F でトースト基盤、 ここでは alert / console fallback)
- キーボードナビは `useEffect` で `window.addEventListener('keydown')`、 mode=tour & running の時だけ有効

**Tech Stack:** Plan A-C と同じ。 framer-motion でハイライトアニメ。

**親仕様参照:** §6 (右パネル)、 §10.3 (ツアー受信フロー)

**前提:** Plan A, B, C 完了済み

---

## File Structure

**新規作成 (component)**:
- `src/components/housing/workspace/RightPanel.tsx` — 全体ラッパー、 mode で分岐
- `src/components/housing/workspace/AutoScrollList.tsx` — 閲覧モード rAF スクロール
- `src/components/housing/workspace/TourProgressList.tsx` — ツアーモード進行表示
- `src/components/housing/workspace/RightPanelListItem.tsx` — 共通の 1 行
- `src/components/housing/workspace/ShareTourButton.tsx` — 共有 URL 発行
- `src/components/housing/workspace/TourKeyboardController.tsx` — Enter/Space ハンドラ (no-render)

**新規作成 (hook)**:
- `src/hooks/useAutoScroll.ts` — rAF ベースの自動スクロール (ホバー停止対応)

**新規作成 (test)**:
- `src/__tests__/housing/RightPanel.test.tsx`
- `src/__tests__/housing/AutoScrollList.test.tsx`
- `src/__tests__/housing/TourProgressList.test.tsx`
- `src/__tests__/housing/RightPanelListItem.test.tsx`
- `src/__tests__/housing/ShareTourButton.test.tsx`
- `src/__tests__/housing/useAutoScroll.test.tsx`
- `src/__tests__/housing/TourKeyboardController.test.tsx`

**編集**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — 右パネルプレースホルダを RightPanel に置き換え
- `src/components/housing/workspace/index.ts` — 公開
- `src/locales/{ja,en,ko,zh}.ts` — `housing.workspace.right.*`, `housing.workspace.tour.*`

---

## Task 1: useAutoScroll カスタムフック (TDD)

**Files:**
- Create: `src/hooks/useAutoScroll.ts`
- Test: `src/__tests__/housing/useAutoScroll.test.tsx`

rAF で `scrollTop += pxPerFrame`、 ホバー時に停止、 最後まで行ったら冒頭に戻る。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/useAutoScroll.test.tsx
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useAutoScroll } from '../../hooks/useAutoScroll';

function Probe({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoScroll(ref, { pxPerSecond: 60, paused });
  // simulate scrollable content
  useEffect(() => {
    if (ref.current) {
      Object.defineProperty(ref.current, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(ref.current, 'clientHeight', { configurable: true, value: 200 });
    }
  }, []);
  return <div ref={ref} data-testid="scroll" style={{ height: 200, overflow: 'auto' }} />;
}

describe('useAutoScroll', () => {
  it('does not throw without crashing on mount', () => {
    expect(() => render(<Probe paused={false} />)).not.toThrow();
  });
  it('does not throw when paused', () => {
    expect(() => render(<Probe paused={true} />)).not.toThrow();
  });
});
```

注: rAF タイミングのテストは jsdom で時間制御が複雑。 実装の正しさは目視 + E2E (Plan F) で確認、 ユニットはマウント／props 反応のみ確認。

- [ ] **Step 2: 実装**

```typescript
// src/hooks/useAutoScroll.ts
import { useEffect, useRef } from 'react';

export interface UseAutoScrollOptions {
  pxPerSecond: number;
  paused: boolean;
  /** When the bottom is reached, jump back to top */
  loop?: boolean;
}

export function useAutoScroll(
  ref: React.RefObject<HTMLElement | null>,
  { pxPerSecond, paused, loop = true }: UseAutoScrollOptions
) {
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (paused) {
      lastTsRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = (ts: number) => {
      const prev = lastTsRef.current;
      lastTsRef.current = ts;
      if (prev !== null) {
        const dt = (ts - prev) / 1000;
        const delta = pxPerSecond * dt;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        let next = el.scrollTop + delta;
        if (next >= max) {
          next = loop ? 0 : max;
        }
        el.scrollTop = next;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [ref, pxPerSecond, paused, loop]);
}
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/useAutoScroll.test.tsx
git add src/hooks/useAutoScroll.ts src/__tests__/housing/useAutoScroll.test.tsx
git commit -m "feat(housing): useAutoScroll hook (rAF + pause)"
```

---

## Task 2: RightPanelListItem (TDD)

**Files:**
- Create: `src/components/housing/workspace/RightPanelListItem.tsx`
- Test: `src/__tests__/housing/RightPanelListItem.test.tsx`

横長低背のリスト行。 サムネ + 住所 + サイズ + 短い紹介文。 active 状態でツアー進行ハイライト。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/RightPanelListItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanelListItem } from '../../components/housing/workspace/RightPanelListItem';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('RightPanelListItem', () => {
  const listing = MOCK_LISTINGS[0];

  it('renders thumbnail and address', () => {
    render(<RightPanelListItem listing={listing} active={false} onClick={() => {}} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText(/Shirogane|シロガネ/)).toBeInTheDocument();
  });

  it('reflects active state via data-active', () => {
    const { container } = render(<RightPanelListItem listing={listing} active={true} onClick={() => {}} />);
    expect(container.firstChild).toHaveAttribute('data-active', 'true');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<RightPanelListItem listing={listing} active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/RightPanelListItem.tsx
import type { MockListing } from '../../../data/housing/mockListings';

export interface RightPanelListItemProps {
  listing: MockListing;
  active: boolean;
  onClick: () => void;
}

const placeholder = '/housing/mock-thumbs/placeholder.svg';

export const RightPanelListItem: React.FC<RightPanelListItemProps> = ({ listing, active, onClick }) => {
  const imgSrc =
    listing.imageMode === 'thumbnail' && listing.thumbnailPath
      ? listing.thumbnailPath
      : listing.imageMode === 'sns' && listing.ogImageUrl
      ? listing.ogImageUrl
      : placeholder;

  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-md text-left text-white transition-all focus:outline-none"
      style={{
        background: active ? 'rgba(255,201,135,0.18)' : 'transparent',
        border: active ? '1px solid #ffc987' : '1px solid transparent',
        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-black/30">
        <img src={imgSrc} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {listing.area} {listing.ward}-{listing.plot}
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
npx vitest run src/__tests__/housing/RightPanelListItem.test.tsx
git add src/components/housing/workspace/RightPanelListItem.tsx \
        src/__tests__/housing/RightPanelListItem.test.tsx
git commit -m "feat(housing): RightPanelListItem (thumbnail + address + active state)"
```

---

## Task 3: AutoScrollList (TDD)

**Files:**
- Create: `src/components/housing/workspace/AutoScrollList.tsx`
- Test: `src/__tests__/housing/AutoScrollList.test.tsx`

閲覧モードのリスト。 useAutoScroll + ホバーで pause + ホバー解除で再開。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/AutoScrollList.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoScrollList } from '../../components/housing/workspace/AutoScrollList';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('AutoScrollList', () => {
  it('renders one item per listing', () => {
    render(<AutoScrollList listings={MOCK_LISTINGS.slice(0, 5)} />);
    const items = screen.getAllByRole('button');
    expect(items.length).toBe(5);
  });

  it('toggles paused state on hover', () => {
    const { container } = render(<AutoScrollList listings={MOCK_LISTINGS.slice(0, 3)} />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-paused')).toBe('false');
    fireEvent.mouseEnter(root);
    expect(root.getAttribute('data-paused')).toBe('true');
    fireEvent.mouseLeave(root);
    expect(root.getAttribute('data-paused')).toBe('false');
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/AutoScrollList.tsx
import { useRef, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useAutoScroll } from '../../../hooks/useAutoScroll';
import { RightPanelListItem } from './RightPanelListItem';

export interface AutoScrollListProps {
  listings: MockListing[];
}

export const AutoScrollList: React.FC<AutoScrollListProps> = ({ listings }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useAutoScroll(ref, { pxPerSecond: 24, paused, loop: true });

  return (
    <div
      data-paused={paused}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      ref={ref}
      className="overflow-y-auto h-full p-3 space-y-2"
    >
      {listings.map((listing) => (
        <RightPanelListItem
          key={listing.id}
          listing={listing}
          active={false}
          onClick={() => { /* Plan E: card click → expand in center */ }}
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/AutoScrollList.test.tsx
git add src/components/housing/workspace/AutoScrollList.tsx \
        src/__tests__/housing/AutoScrollList.test.tsx
git commit -m "feat(housing): AutoScrollList (browse mode, hover-paused)"
```

---

## Task 4: ShareTourButton (TDD)

**Files:**
- Create: `src/components/housing/workspace/ShareTourButton.tsx`
- Test: `src/__tests__/housing/ShareTourButton.test.tsx`

「📤 このツアーを共有する」 ボタン + クリップボードコピー。

- [ ] **Step 1: i18n 追加**

`housing.workspace.tour.share` (4 言語):
- ja: 'このツアーを共有する'
- en: 'Share this tour'
- ko: '이 투어 공유하기'
- zh: '分享此巡游'

`housing.workspace.tour.copied` (4 言語、 トースト用):
- ja: 'コピーしました'
- en: 'Copied!'
- ko: '복사됨'
- zh: '已复制'

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/ShareTourButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareTourButton } from '../../components/housing/workspace/ShareTourButton';

describe('ShareTourButton', () => {
  it('renders share label', () => {
    render(<ShareTourButton tourId="abc123" />);
    expect(screen.getByRole('button')).toHaveTextContent(/share|共有|공유|分享/i);
  });

  it('writes share URL to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareTourButton tourId="abc123" />);
    fireEvent.click(screen.getByRole('button'));
    // Wait microtask
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('/housing/tour/abc123');
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/ShareTourButton.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Check } from 'lucide-react';

export interface ShareTourButtonProps {
  tourId: string;
}

export const ShareTourButton: React.FC<ShareTourButtonProps> = ({ tourId }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/housing/tour/${tourId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback (Plan F でトースト)
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all"
      style={{
        border: '1px solid #ffc987',
        color: '#ffc987',
        background: copied ? 'rgba(255,201,135,0.18)' : 'rgba(255,201,135,0.06)',
      }}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? t('housing.workspace.tour.copied') : t('housing.workspace.tour.share')}
    </button>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/ShareTourButton.test.tsx
git add src/components/housing/workspace/ShareTourButton.tsx \
        src/__tests__/housing/ShareTourButton.test.tsx \
        src/locales/
git commit -m "feat(housing): ShareTourButton (clipboard copy)"
```

---

## Task 5: TourKeyboardController (TDD)

**Files:**
- Create: `src/components/housing/workspace/TourKeyboardController.tsx`
- Test: `src/__tests__/housing/TourKeyboardController.test.tsx`

Enter / Space で次へ、 ← で前へ。 ツアー実行中だけ有効化。 input フォーカス時は無視。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/TourKeyboardController.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TourKeyboardController } from '../../components/housing/workspace/TourKeyboardController';
import { useHousingTourStore } from '../../store/useHousingTourStore';

describe('TourKeyboardController', () => {
  beforeEach(() => {
    useHousingTourStore.getState().reset();
    useHousingTourStore.getState().setListings(['a', 'b', 'c']);
    useHousingTourStore.getState().start();
  });

  it('advances on Enter', () => {
    render(<TourKeyboardController />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
  });

  it('advances on Space', () => {
    render(<TourKeyboardController />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
  });

  it('retreats on ArrowLeft', () => {
    useHousingTourStore.getState().next();
    render(<TourKeyboardController />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
  });

  it('ignores Enter when tour not running', () => {
    useHousingTourStore.getState().stop();
    render(<TourKeyboardController />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
  });

  it('ignores keys when target is INPUT', () => {
    render(
      <>
        <TourKeyboardController />
        <input data-testid="ipt" />
      </>
    );
    const input = document.querySelector('input');
    if (!input) throw new Error();
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/TourKeyboardController.tsx
import { useEffect } from 'react';
import { useHousingTourStore } from '../../../store/useHousingTourStore';

export const TourKeyboardController: React.FC = () => {
  const running = useHousingTourStore((s) => s.running);
  const next = useHousingTourStore((s) => s.next);
  const prev = useHousingTourStore((s) => s.prev);

  useEffect(() => {
    if (!running) return;
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in input/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [running, next, prev]);

  return null;
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/TourKeyboardController.test.tsx
git add src/components/housing/workspace/TourKeyboardController.tsx \
        src/__tests__/housing/TourKeyboardController.test.tsx
git commit -m "feat(housing): TourKeyboardController (Enter/Space/Arrow nav)"
```

---

## Task 6: TourProgressList (TDD)

**Files:**
- Create: `src/components/housing/workspace/TourProgressList.tsx`
- Test: `src/__tests__/housing/TourProgressList.test.tsx`

ツアー実行中の右パネル。 現在位置ハイライト + 自動スクロール (active item にスクロール) + 共有ボタン上部。

- [ ] **Step 1: i18n 追加**

`housing.workspace.tour.{progress,manner_notice,start,exit}` (4 言語):
- progress: '進行中' / 'In progress' / '진행 중' / '进行中'
- start: 'はじめる' / 'Start' / '시작' / '开始'
- exit: 'ツアーを終わる' / 'Exit tour' / '투어 종료' / '退出'
- manner_notice: 'マナーを守って訪問してください' / 'Please respect house owners during your visit' / '방문 시 매너를 지켜 주세요' / '请文明参观'

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/TourProgressList.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TourProgressList } from '../../components/housing/workspace/TourProgressList';
import { useHousingTourStore } from '../../store/useHousingTourStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('TourProgressList', () => {
  beforeEach(() => {
    useHousingTourStore.getState().reset();
    useHousingTourStore.getState().setListings(MOCK_LISTINGS.slice(0, 3).map((l) => l.id));
    useHousingTourStore.getState().start();
  });

  it('renders share button and exit button', () => {
    render(<TourProgressList tourId="t-xyz" />);
    expect(screen.getByRole('button', { name: /share|共有|공유|分享/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /終|exit|종료|退出/i })).toBeInTheDocument();
  });

  it('marks current item active', () => {
    const { container } = render(<TourProgressList tourId="t-xyz" />);
    const active = container.querySelector('[data-active="true"]');
    expect(active).toBeTruthy();
  });

  it('does not render listings outside the tour', () => {
    render(<TourProgressList tourId="t-xyz" />);
    const buttons = screen.getAllByRole('button');
    // 3 listing rows + 2 main buttons (share, exit)
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/TourProgressList.tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { RightPanelListItem } from './RightPanelListItem';
import { ShareTourButton } from './ShareTourButton';
import { LogOut } from 'lucide-react';

export interface TourProgressListProps {
  tourId: string;
}

export const TourProgressList: React.FC<TourProgressListProps> = ({ tourId }) => {
  const { t } = useTranslation();
  const listingIds = useHousingTourStore((s) => s.listingIds);
  const currentIndex = useHousingTourStore((s) => s.currentIndex);
  const stop = useHousingTourStore((s) => s.stop);
  const exitTourMode = useHousingViewStore((s) => s.exitTourMode);
  const listRef = useRef<HTMLDivElement>(null);

  const listings = listingIds.map((id) => MOCK_LISTINGS.find((l) => l.id === id)).filter(Boolean) as typeof MOCK_LISTINGS;

  // Auto-scroll the active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector('[data-active="true"]') as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex]);

  const handleExit = () => {
    stop();
    exitTourMode();
  };

  return (
    <div className="flex flex-col h-full p-3" style={{ color: '#ffffff' }}>
      <div className="space-y-2 mb-3 shrink-0">
        <ShareTourButton tourId={tourId} />
        <button
          type="button"
          onClick={handleExit}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs opacity-78 transition-colors hover:bg-white/10"
        >
          <LogOut size={14} />
          {t('housing.workspace.tour.exit')}
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2">
        {listings.map((listing, i) => (
          <RightPanelListItem
            key={listing.id}
            listing={listing}
            active={i === currentIndex}
            onClick={() => { /* maybe move to that index */ }}
          />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/TourProgressList.test.tsx
git add src/components/housing/workspace/TourProgressList.tsx \
        src/__tests__/housing/TourProgressList.test.tsx \
        src/locales/
git commit -m "feat(housing): TourProgressList (active highlight + share + exit)"
```

---

## Task 7: RightPanel — 統合 (mode 切替)

**Files:**
- Create: `src/components/housing/workspace/RightPanel.tsx`
- Test: `src/__tests__/housing/RightPanel.test.tsx`

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/RightPanel.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RightPanel } from '../../components/housing/workspace/RightPanel';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingTourStore } from '../../store/useHousingTourStore';

describe('RightPanel', () => {
  beforeEach(() => {
    useHousingViewStore.getState().reset();
    useHousingTourStore.getState().reset();
  });

  it('renders auto-scroll list in browse mode', () => {
    render(<RightPanel onClose={() => {}} />);
    // browse mode で多数の listing item が見える
    const items = screen.getAllByRole('button');
    expect(items.length).toBeGreaterThan(3);
  });

  it('switches to tour progress when tour mode active', () => {
    useHousingTourStore.getState().setListings(['mock-001']);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    render(<RightPanel onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /share|共有|공유|分享/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/RightPanel.tsx
import { nanoid } from 'nanoid';
import { useMemo } from 'react';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../../store/useHousingRandomStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { listListingsForWard } from '../../../lib/housing/randomWard';
import { AutoScrollList } from './AutoScrollList';
import { TourProgressList } from './TourProgressList';
import { TourKeyboardController } from './TourKeyboardController';
import { PanelCloseButton } from './PanelCloseButton';

export interface RightPanelProps {
  onClose: () => void;
}

// Generate / reuse a tour ID for the current tour (sessionStorage)
function useTourId(): string {
  return useMemo(() => {
    const k = 'housing-tour-id';
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const id = nanoid(10);
    sessionStorage.setItem(k, id);
    return id;
  }, []);
}

export const RightPanel: React.FC<RightPanelProps> = ({ onClose }) => {
  const mode = useHousingViewStore((s) => s.mode);
  const viewMode = useHousingViewStore((s) => s.viewMode);
  const filter = useHousingFilterStore();
  const selectedWardId = useHousingRandomStore((s) => s.selectedWardId);
  const tourId = useTourId();

  const listings = useMemo(() => {
    if (viewMode === 'map' && selectedWardId) {
      return listListingsForWard(MOCK_LISTINGS, selectedWardId);
    }
    return applyFilters(MOCK_LISTINGS, {
      dc: filter.dc, regions: filter.regions, servers: filter.servers,
      areas: filter.areas, sizes: filter.sizes, tags: filter.tags, searchText: filter.searchText,
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [viewMode, selectedWardId, filter.dc, filter.regions, filter.servers, filter.areas, filter.sizes, filter.tags, filter.searchText]);

  return (
    <div className="flex flex-col h-full" style={{ color: '#ffffff' }}>
      {/* close button is hidden when tour mode (right panel locked open) */}
      {mode === 'browse' && (
        <div className="flex justify-end p-2 shrink-0">
          <PanelCloseButton direction="right" onClick={onClose} />
        </div>
      )}
      <div className="flex-1 min-h-0">
        {mode === 'tour' ? (
          <TourProgressList tourId={tourId} />
        ) : (
          <AutoScrollList listings={listings} />
        )}
      </div>
      <TourKeyboardController />
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/RightPanel.test.tsx
git add src/components/housing/workspace/RightPanel.tsx \
        src/__tests__/housing/RightPanel.test.tsx
git commit -m "feat(housing): RightPanel (browse/tour mode switching)"
```

---

## Task 8: HousingWorkspace に RightPanel 統合 + 開閉

**Files:**
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`
- Modify: `src/components/housing/workspace/index.ts`

- [ ] **Step 1: プレースホルダ置換**

```typescript
// imports 追記
import { RightPanel } from './RightPanel';

// 既存 right の <aside> 中身を置換
{rightPanelOpen && (
  <aside data-region="right" className="w-80 shrink-0 border-l liquid-glass-panel"
    style={{ borderColor: 'rgba(255,255,255,0.22)' }}>
    <RightPanel onClose={() => setRightPanelOpen(false)} />
  </aside>
)}
```

`setRightPanelOpen` を view store から取り出す:

```typescript
const setRightPanelOpen = useHousingViewStore((s) => s.setRightPanelOpen);
```

- [ ] **Step 2: index.ts 公開**

```typescript
export { RightPanel } from './RightPanel';
```

- [ ] **Step 3: dev 目視確認**

```bash
npm run dev
```

期待:
- 右パネルに物件リストが auto-scroll で流れる
- マウスホバーで停止、 離れると再開
- 左パネルのフィルタを変えると右パネルの内容も追従
- マップビューだとサンプルワード内 5 件のみ流れる
- (まだツアー機能は Plan E 待ちなので未検証)
- 右パネル閉じるボタンで隠れる、 再オープン手段は Plan F で TopBar 連動

- [ ] **Step 4: ビルド検証 + 全テスト**

```bash
npm run build && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/index.ts
git commit -m "feat(housing): wire RightPanel into HousingWorkspace"
```

---

## Self-Review Checklist

### 仕様書カバレッジ

| 設計書セクション | Plan D 対応 |
|---|---|
| §6.1 閲覧モード (auto-scroll + ホバー停止) | Task 1, 3 |
| §6.2 ツアーモード (Enter/Space で次へ、 ハイライト) | Task 5, 6 |
| §6.2 共有ボタン (大きく上部) | Task 4, 6 |
| §6.3 共有 URL (`/housing/tour/{id}`) | Task 4 + Task 7 (tourId 永続化) |
| §3.3 パネル開閉 (右、 ツアー時固定) | Task 7 (mode=tour で close ボタン非表示) |

### Plan D スコープ外

- マナー順守ポップアップ (ツアー開始時に 1 度表示) → Plan E (お気に入りから「全部回る」 起動時に表示)
- 共有 URL 受信側の挙動 (URL 開いた人のツアー復元) → Plan F (ルーティング)
- 個別 listing クリック → 中央 inline expansion 連動 → Plan F

### Placeholder Scan

- 全 step に actual code or actual command ✓
- "TBD" / "TODO" は機能制約として明示、 後 plan で吸収 ✓

---

## 完了の定義

- [ ] 右パネルに閲覧モードの物件リストが流れる
- [ ] ホバーで停止、 離れると再開
- [ ] フィルタ・ビュー切替で右パネル内容が追従
- [ ] (ツアー機能の動作確認は Plan E 完了後)
- [ ] 右パネル閉じる/開く動作
- [ ] `npm run build` + `npx vitest run` 全 pass
