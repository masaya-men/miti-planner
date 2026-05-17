# Housing Sub-spec 2B — Plan F: Finishing (仕上げ + 統合 + リリース可能化)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リリース可能な完成度に持っていく — 登録モーダル接続 + 物件単体 URL + 検索欄接続 + ロード/エラー状態 + アクセシビリティ + prefers-reduced-motion + Playwright E2E + 親仕様改訂 + Firestore データ統合の枠組み

**Architecture:**
- 既存 `HousingRegisterView` (Sub-spec 2A) を流用、 モーダルとして包む
- 物件単体 URL `/housing/p/:id` ルートで開いた時、 中央エリアにその物件が inline expansion 状態で着地
- 検索欄を top bar から filter store の `searchText` に接続
- ロード/エラー: スケルトン + トーストコンポーネントを汎用化
- a11y: ARIA labels の網羅、 キーボードナビ、 focus management
- reduced-motion: 動画停止、 auto-scroll 停止、 transition 無効
- E2E: 主要 3 シナリオ (受動ブラウザ、 能動探索、 ツアー受信) を Playwright で
- Firestore 統合は本書では「枠」 のみ (mockListings → housingListingsService 抽象化)、 実 API 接続は別件
- 親仕様 (`2026-05-07-housing-tour-phase1-design.md`) の §7-§8, §10, §11.2, §18 を本仕様参照に書き換え

**Tech Stack:** Plan A-E + Playwright (既存) + 既存 Sub-spec 2A コンポーネント

**親仕様参照:** §1 (背景)、 §8 (登録 CTA 接続)、 §9 (空/ロード/エラー)、 §10 (フロー)、 §12 (アクセシビリティ)、 §13 (テスト)、 §15 (Phase 2 接続)、 §16 (親仕様改訂)

**前提:** Plan A-E 完了済み

---

## File Structure

**新規作成 (component)**:
- `src/components/housing/workspace/HousingRegisterModal.tsx` — 登録モーダル wrapper (Sub-spec 2A の HousingRegisterView 呼び出し)
- `src/components/housing/workspace/SkeletonCard.tsx` — Pinterest 用 + 右パネル用スケルトン
- `src/components/housing/workspace/HousingToast.tsx` — トースト (共有完了、 エラー)

**新規作成 (lib)**:
- `src/lib/housing/housingListingsService.ts` — 物件取得抽象 (mock + future Firestore)
- `src/lib/housing/useReducedMotion.ts` — `prefers-reduced-motion` 監視フック

**新規作成 (test)**:
- `src/__tests__/housing/HousingRegisterModal.test.tsx`
- `src/__tests__/housing/SkeletonCard.test.tsx`
- `src/__tests__/housing/HousingToast.test.tsx`
- `src/__tests__/housing/housingListingsService.test.ts`
- `src/__tests__/housing/useReducedMotion.test.tsx`
- `src/__tests__/housing/a11y.test.tsx`
- `e2e/housing-workspace.spec.ts` (Playwright)

**編集**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — 登録モーダル placeholder を本物に
- `src/components/housing/workspace/TopBar.tsx` — 検索欄を filter store に接続
- `src/components/housing/workspace/SceneryVideo.tsx` — reduced-motion 反映 (既に書いてある, 検証)
- `src/components/housing/workspace/AutoScrollList.tsx` — reduced-motion で pause 強制
- `src/components/housing/workspace/CenterArea.tsx` — URL から listing id 受け取って inline expansion ハイライト
- `src/App.tsx` — `/housing/p/:listingId` ルート、 `/housing/tour/:tourId` ルートを HousingWorkspace に流す
- `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` — Sub-spec 2B 参照への書き換え

---

## Task 1: housingListingsService 抽象化 (TDD)

**Files:**
- Create: `src/lib/housing/housingListingsService.ts`
- Test: `src/__tests__/housing/housingListingsService.test.ts`

mockListings を fetch する関数を service に集約。 将来 Firestore に差し替えるとき 1 ファイルだけ書き換えれば済む形に。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/housingListingsService.test.ts
import { describe, it, expect } from 'vitest';
import { fetchAllListings, fetchListingById } from '../../lib/housing/housingListingsService';

describe('housingListingsService', () => {
  it('fetchAllListings returns the mock 50 listings', async () => {
    const listings = await fetchAllListings();
    expect(listings.length).toBe(50);
  });

  it('fetchListingById returns one matching listing', async () => {
    const listing = await fetchListingById('mock-001');
    expect(listing?.id).toBe('mock-001');
  });

  it('fetchListingById returns null for unknown id', async () => {
    const listing = await fetchListingById('does-not-exist');
    expect(listing).toBeNull();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/lib/housing/housingListingsService.ts
import { MOCK_LISTINGS, type MockListing } from '../../data/housing/mockListings';

/**
 * Single-point data access for housing listings.
 * Phase 1 implementation: returns mock data.
 * Phase 2 / production: swap to Firestore reads (housing_listings collection).
 */

export async function fetchAllListings(): Promise<MockListing[]> {
  // Simulate async to mirror future Firestore call
  return Promise.resolve(MOCK_LISTINGS);
}

export async function fetchListingById(id: string): Promise<MockListing | null> {
  return Promise.resolve(MOCK_LISTINGS.find((l) => l.id === id) ?? null);
}
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/housingListingsService.test.ts
git add src/lib/housing/housingListingsService.ts \
        src/__tests__/housing/housingListingsService.test.ts
git commit -m "feat(housing): listings service abstraction (mock now, Firestore later)"
```

---

## Task 2: useReducedMotion フック (TDD)

**Files:**
- Create: `src/lib/housing/useReducedMotion.ts`
- Test: `src/__tests__/housing/useReducedMotion.test.tsx`

- [ ] **Step 1: 実装 + テスト**

```typescript
// src/lib/housing/useReducedMotion.ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
```

```typescript
// src/__tests__/housing/useReducedMotion.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="r">{reduced ? 'yes' : 'no'}</span>;
}

describe('useReducedMotion', () => {
  it('returns false by default in jsdom', () => {
    render(<Probe />);
    expect(screen.getByTestId('r').textContent).toBe('no');
  });
});
```

- [ ] **Step 2: AutoScrollList を reduced-motion 連動に修正**

`src/components/housing/workspace/AutoScrollList.tsx` を編集:

```typescript
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

export const AutoScrollList: React.FC<AutoScrollListProps> = ({ listings }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  useAutoScroll(ref, { pxPerSecond: 24, paused: paused || reduced, loop: true });
  // 残りは同じ
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/useReducedMotion.test.tsx
npx vitest run src/__tests__/housing/AutoScrollList.test.tsx
git add src/lib/housing/useReducedMotion.ts \
        src/__tests__/housing/useReducedMotion.test.tsx \
        src/components/housing/workspace/AutoScrollList.tsx
git commit -m "feat(housing): useReducedMotion + AutoScrollList integration"
```

---

## Task 3: SkeletonCard (TDD)

**Files:**
- Create: `src/components/housing/workspace/SkeletonCard.tsx`
- Test: `src/__tests__/housing/SkeletonCard.test.tsx`

- [ ] **Step 1: 実装 + テスト**

```typescript
// src/components/housing/workspace/SkeletonCard.tsx
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

export interface SkeletonCardProps {
  variant?: 'pinterest' | 'right-panel';
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ variant = 'pinterest' }) => {
  const reduced = useReducedMotion();
  const shimmer = !reduced;
  if (variant === 'right-panel') {
    return (
      <div className="flex items-center gap-3 p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className={`w-12 h-12 rounded ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="flex-1 space-y-1">
          <div className={`h-3 rounded ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.10)' }} />
          <div className={`h-2.5 w-2/3 rounded ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.18)' }}>
      <div className={`aspect-video ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.10)' }} />
      <div className="p-3 space-y-2">
        <div className={`h-3 rounded ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className={`h-2.5 w-2/3 rounded ${shimmer ? 'animate-pulse' : ''}`} style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
    </div>
  );
};
```

```typescript
// src/__tests__/housing/SkeletonCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonCard } from '../../components/housing/workspace/SkeletonCard';

describe('SkeletonCard', () => {
  it('renders the pinterest variant by default', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the right-panel variant', () => {
    const { container } = render(<SkeletonCard variant="right-panel" />);
    expect(container.firstChild).toBeTruthy();
  });
});
```

- [ ] **Step 2: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/SkeletonCard.test.tsx
git add src/components/housing/workspace/SkeletonCard.tsx \
        src/__tests__/housing/SkeletonCard.test.tsx
git commit -m "feat(housing): SkeletonCard (pinterest + right-panel variants)"
```

---

## Task 4: HousingToast (TDD)

**Files:**
- Create: `src/components/housing/workspace/HousingToast.tsx`
- Test: `src/__tests__/housing/HousingToast.test.tsx`

簡単なトースト。 既存の `src/components/Toast` があるが Sub-spec 2B 用に内製、 重複は iterate で統合判断。

- [ ] **Step 1: 実装 + テスト**

```typescript
// src/components/housing/workspace/HousingToast.tsx
import { useEffect } from 'react';

export interface HousingToastProps {
  message: string;
  variant?: 'info' | 'error';
  duration?: number;
  onClose: () => void;
}

export const HousingToast: React.FC<HousingToastProps> = ({ message, variant = 'info', duration = 2500, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div
      role="status"
      className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-md text-sm"
      style={{
        background: variant === 'error' ? 'rgba(255,128,128,0.95)' : 'rgba(0,0,0,0.85)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.22)',
        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      {message}
    </div>
  );
};
```

```typescript
// src/__tests__/housing/HousingToast.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HousingToast } from '../../components/housing/workspace/HousingToast';

describe('HousingToast', () => {
  it('renders message', () => {
    render(<HousingToast message="hello" onClose={() => {}} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls onClose after duration', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<HousingToast message="x" duration={1000} onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/HousingToast.test.tsx
git add src/components/housing/workspace/HousingToast.tsx \
        src/__tests__/housing/HousingToast.test.tsx
git commit -m "feat(housing): HousingToast (info/error variants)"
```

---

## Task 5: HousingRegisterModal — Sub-spec 2A の HousingRegisterView 接続

**Files:**
- Create: `src/components/housing/workspace/HousingRegisterModal.tsx`
- Test: `src/__tests__/housing/HousingRegisterModal.test.tsx`

既存 `HousingRegisterView` をモーダルに包む。 ログイン未済なら LoginModal を出す。

- [ ] **Step 1: i18n 追加**

`housing.workspace.register_modal.{title,close,login_required}` (4 言語):
- ja: 'ハウジングを登録', '閉じる', 'ログインが必要です'
- en: 'Register your home', 'Close', 'Login required'
- ko: '집 등록', '닫기', '로그인 필요'
- zh: '登记房屋', '关闭', '需要登录'

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/HousingRegisterModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingRegisterModal } from '../../components/housing/workspace/HousingRegisterModal';

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn((sel: any) => sel({ user: { uid: 'test-uid' }, loading: false })),
}));

describe('HousingRegisterModal', () => {
  it('does not render when closed', () => {
    const { container } = render(<HousingRegisterModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders register form when open and user logged in', () => {
    render(<HousingRegisterModal open={true} onClose={() => {}} />);
    // Sub-spec 2A の form 内のいくつかの要素を確認 (フォーム タイトル等)
    expect(screen.getByLabelText(/閉じる|close|닫기|关闭/i)).toBeInTheDocument();
  });

  it('calls onClose when close clicked', () => {
    const onClose = vi.fn();
    render(<HousingRegisterModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/閉じる|close|닫기|关闭/i));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/HousingRegisterModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { HousingRegisterView } from '../register/HousingRegisterView';
import { LoginModal } from '../../LoginModal';

export interface HousingRegisterModalProps {
  open: boolean;
  onClose: () => void;
}

export const HousingRegisterModal: React.FC<HousingRegisterModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s: any) => s.user);
  const [loginOpen, setLoginOpen] = useState(false);

  if (!open) return null;

  if (!user) {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
          <div
            className="max-w-sm w-full mx-4 p-6 rounded-lg text-white"
            style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.22)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-medium mb-2">{t('housing.workspace.register_modal.title')}</h2>
            <p className="text-sm opacity-78 mb-4">{t('housing.workspace.register_modal.login_required')}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-sm hover:bg-white/10">
                {t('housing.workspace.register_modal.close')}
              </button>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="px-3 py-1.5 rounded text-sm font-medium"
                style={{ background: '#ffc987', color: '#000' }}
              >
                Login
              </button>
            </div>
          </div>
        </div>
        <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 overflow-y-auto py-8" onClick={onClose}>
      <div
        className="max-w-2xl w-full mx-4 rounded-lg"
        style={{ background: 'var(--color-app-bg, #000)', border: '1px solid rgba(255,255,255,0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <h2 className="text-base font-medium text-white">{t('housing.workspace.register_modal.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('housing.workspace.register_modal.close')}
            className="p-2 rounded text-white hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <HousingRegisterView />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: HousingWorkspace で接続**

```typescript
// src/components/housing/workspace/HousingWorkspace.tsx
import { HousingRegisterModal } from './HousingRegisterModal';

// state はそのまま、 placeholder を本物に置換:
<HousingRegisterModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
```

- [ ] **Step 5: index.ts 公開**

```typescript
export { HousingRegisterModal } from './HousingRegisterModal';
```

- [ ] **Step 6: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/HousingRegisterModal.test.tsx
git add src/components/housing/workspace/HousingRegisterModal.tsx \
        src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/index.ts \
        src/__tests__/housing/HousingRegisterModal.test.tsx \
        src/locales/
git commit -m "feat(housing): HousingRegisterModal (wraps Sub-spec 2A view + login gating)"
```

---

## Task 6: 検索欄を filter store に接続

**Files:**
- Modify: `src/components/housing/workspace/TopBar.tsx`
- Modify: `src/__tests__/housing/TopBar.test.tsx`

- [ ] **Step 1: TopBar に検索 input の onChange を追加**

```typescript
// src/components/housing/workspace/TopBar.tsx
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';

export const TopBar: React.FC<TopBarProps> = ({ onRegisterClick, onFavoritesClick }) => {
  const { t } = useTranslation();
  const searchText = useHousingFilterStore((s) => s.searchText);
  const setSearchText = useHousingFilterStore((s) => s.setSearchText);

  return (
    <header /* ... 既存 */>
      {/* logo 略 */}
      <div /* ... */>
        <Search size={16} className="opacity-60" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t('housing.workspace.topbar.search_placeholder')}
          className="bg-transparent outline-none w-full text-sm text-white placeholder-white/55"
        />
      </div>
      {/* 右側ボタン群 略 */}
    </header>
  );
};
```

- [ ] **Step 2: テスト追加**

```typescript
// src/__tests__/housing/TopBar.test.tsx 追加
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

it('updates filter store when search input changes', () => {
  useHousingFilterStore.getState().setSearchText('');
  render(<TopBar onRegisterClick={() => {}} onFavoritesClick={() => {}} />);
  const input = screen.getByPlaceholderText(/お家|find|집|搜索/i);
  fireEvent.change(input, { target: { value: 'cafe' } });
  expect(useHousingFilterStore.getState().searchText).toBe('cafe');
});
```

- [ ] **Step 3: 目視確認 + Commit**

```bash
npx vitest run src/__tests__/housing/TopBar.test.tsx
npm run dev
# /housing で検索欄に文字入れる → Pinterest ビューが filter される
git add src/components/housing/workspace/TopBar.tsx \
        src/__tests__/housing/TopBar.test.tsx
git commit -m "feat(housing): wire TopBar search box to filter store"
```

---

## Task 7: 物件単体 URL ルート (`/housing/p/:listingId`)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`
- Modify: `src/components/housing/workspace/CenterArea.tsx`
- Modify: `src/components/housing/workspace/PinterestView.tsx`

URL に listingId があれば、 ロード時に対応カードを inline expansion 状態で表示。

- [ ] **Step 1: App.tsx でルート差し替え**

```typescript
// src/App.tsx 該当行
<Route path="/housing" element={<HousingWorkspace />} />
<Route path="/housing/p/:listingId" element={<HousingWorkspace />} />
<Route path="/housing/tour/:tourId" element={<HousingWorkspace />} />
<Route path="/housing/legacy" element={<HousingPage />} />
```

- [ ] **Step 2: HousingWorkspace で URL params を読み、 Center に渡す**

```typescript
// src/components/housing/workspace/HousingWorkspace.tsx
import { useParams } from 'react-router-dom';

export const HousingWorkspace: React.FC = () => {
  const { listingId, tourId } = useParams<{ listingId?: string; tourId?: string }>();
  // ... 既存
  return (
    <main /* ... */>
      {/* ... */}
      <section data-region="center" /* ... */>
        <CenterArea focusListingId={listingId} initialTourId={tourId} />
      </section>
      {/* ... */}
    </main>
  );
};
```

- [ ] **Step 3: CenterArea + PinterestView で focusListingId に対応**

`CenterArea.tsx`:

```typescript
export interface CenterAreaProps {
  focusListingId?: string;
  initialTourId?: string;
}

export const CenterArea: React.FC<CenterAreaProps> = ({ focusListingId, initialTourId }) => {
  // 既存ロジック
  // PinterestView に focusListingId を渡す
  return (
    <div /* ... */>
      <ViewModeToggle />
      {viewMode === 'map' ? (
        // ...
      ) : (
        <PinterestView listings={pinterestListings} initialExpandedId={focusListingId} />
      )}
    </div>
  );
};
```

`PinterestView.tsx`:

```typescript
export interface PinterestViewProps {
  listings: MockListing[];
  initialExpandedId?: string;
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings, initialExpandedId }) => {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  // 残り同じ
};
```

Map view の場合は viewMode を pinterest に強制切替 + focusListingId をスクロール対象に。 これは iterate-first で許容、 初期実装は pinterest で着地する仕様で良し。

`CenterArea.tsx` に追記:

```typescript
import { useEffect } from 'react';
// 既存 imports

export const CenterArea: React.FC<CenterAreaProps> = ({ focusListingId, initialTourId }) => {
  const setViewMode = useHousingViewStore((s) => s.setViewMode);

  // If URL focuses a listing, force pinterest mode (easier to surface a single card)
  useEffect(() => {
    if (focusListingId) setViewMode('pinterest');
  }, [focusListingId, setViewMode]);
  // ... 既存
};
```

- [ ] **Step 4: 目視確認**

```bash
npm run dev
# /housing/p/mock-001 を開く → Pinterest ビューで該当カードが expanded 状態
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx \
        src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/CenterArea.tsx \
        src/components/housing/workspace/PinterestView.tsx
git commit -m "feat(housing): /housing/p/:listingId route lands with card expanded"
```

---

## Task 8: ツアー URL 受信 (`/housing/tour/:tourId`)

**Files:**
- Modify: `src/components/housing/workspace/CenterArea.tsx` or HousingWorkspace
- Modify: `src/components/housing/workspace/RightPanel.tsx`

`initialTourId` を受け取って tour store に流す。 ただし mock データでは「実 tour データ」 がないので、 「URL から開いた = お気に入りが空でもツアーを再現できる」 シナリオは Plan F では枠だけ。 実 tour データの永続化 (Firestore) は別件。

- [ ] **Step 1: 設計のメモのみ追記**

`docs/superpowers/specs/2026-05-17-housing-sub-spec-2b-gallery-tour-design.md` の §17 (iterate-first 項目) に「ツアー共有 URL の受信側完成版は実 tour データ永続化 (Firestore) が必要」 と追記:

```markdown
- ツアー共有 URL 受信側のツアー復元: 永続化は Firestore (`housing_tours/{id}`) 必要、 Sub-spec 2B の mock では tour id だけ復元 + listings は LocalStorage 連動
```

- [ ] **Step 2: 現実装で動く範囲を実装**

`HousingWorkspace.tsx`:

```typescript
import { useEffect } from 'react';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';

export const HousingWorkspace: React.FC = () => {
  const { listingId, tourId } = useParams<{ listingId?: string; tourId?: string }>();
  const tourListingIds = useHousingTourStore((s) => s.listingIds);
  const startTour = useHousingTourStore((s) => s.start);
  const enterTourMode = useHousingViewStore((s) => s.enterTourMode);

  // If a tour URL is opened AND the local store has the tour built up,
  // automatically enter tour mode. (Cross-device URL is Plan F scope-out.)
  useEffect(() => {
    if (tourId && tourListingIds.length > 0) {
      sessionStorage.setItem('housing-tour-id', tourId);
      startTour();
      enterTourMode();
    }
  }, [tourId, tourListingIds.length, startTour, enterTourMode]);

  // 残り同じ
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx \
        docs/superpowers/specs/2026-05-17-housing-sub-spec-2b-gallery-tour-design.md
git commit -m "feat(housing): handle /housing/tour/:tourId (local restore only for Phase 1)"
```

---

## Task 9: アクセシビリティ網羅 (a11y テスト)

**Files:**
- Create: `src/__tests__/housing/a11y.test.tsx`
- Modify: 既存コンポーネントに aria 補強 (必要に応じて)

- [ ] **Step 1: a11y チェックリスト**

各コンポーネントで以下を満たすかテスト:
- 全 button に `aria-label` (テキスト無しアイコンボタン)
- 全 img に `alt` (装飾なら `alt=""`)
- input に `placeholder` (ラベル代わり)
- モーダルに `role="dialog"` + `aria-modal="true"`
- focus management: モーダル開いたら最初のフォーカス可能要素へ

- [ ] **Step 2: FavoritesModal に dialog role 追加**

```typescript
// FavoritesModal.tsx の内側 div に
<div role="dialog" aria-modal="true" /* ... */>
```

同様に `MannerNoticeDialog`, `HousingRegisterModal` にも。

- [ ] **Step 3: a11y テスト**

```typescript
// src/__tests__/housing/a11y.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';

describe('a11y for HousingWorkspace', () => {
  it('all icon-only buttons have aria-label', () => {
    const { container } = render(
      <MemoryRouter><HousingWorkspace /></MemoryRouter>
    );
    const buttons = container.querySelectorAll('button');
    buttons.forEach((b) => {
      const hasText = b.textContent && b.textContent.trim().length > 0;
      const hasAria = b.getAttribute('aria-label');
      // each button should have either visible text or aria-label
      expect(hasText || hasAria).toBeTruthy();
    });
  });

  it('all images have alt attribute (may be empty for decorative)', () => {
    const { container } = render(
      <MemoryRouter><HousingWorkspace /></MemoryRouter>
    );
    container.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('alt')).not.toBeNull();
    });
  });
});
```

- [ ] **Step 4: 失敗があれば該当箇所修正 (aria-label 追加)**

- [ ] **Step 5: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/a11y.test.tsx
git add src/__tests__/housing/a11y.test.tsx \
        src/components/housing/workspace/FavoritesModal.tsx \
        src/components/housing/workspace/MannerNoticeDialog.tsx \
        src/components/housing/workspace/HousingRegisterModal.tsx
git commit -m "feat(housing): accessibility — dialog roles + aria audit"
```

---

## Task 10: Playwright E2E — 主要 3 シナリオ

**Files:**
- Create: `e2e/housing-workspace.spec.ts`

設計書 §10 の 3 つのフロー (受動/能動/ツアー受信)。

- [ ] **Step 1: E2E テスト**

```typescript
// e2e/housing-workspace.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Housing Workspace', () => {
  test('passive browse → favorite → tour', async ({ page }) => {
    await page.goto('/housing');
    // 動画背景が再生されている (poster ではない)
    const dayVideo = page.locator('video[data-scenery="day"]');
    await expect(dayVideo).toHaveAttribute('data-active', 'true');

    // 中央エリアにマップが表示
    const map = page.getByAltText(/map|マップ|지도|地图/i);
    await expect(map).toBeVisible();

    // Pinterest に切替
    await page.getByRole('button', { name: /一覧|grid|그리드|网格/i }).click();
    // カードが多数並ぶ
    const cards = page.locator('[data-region="center"] button:has(img)');
    await expect(cards.first()).toBeVisible();

    // 1 つ目をクリック → expanded
    await cards.first().click();
    const closeBtn = page.getByLabel(/閉じる|close/i);
    await expect(closeBtn).toBeVisible();

    // ♡ ボタンクリック → お気に入りに追加
    await page.getByLabel(/お気に入り|favorite/i).first().click();
    await closeBtn.click();

    // top bar の ♡ クリック → モーダル
    await page.locator('header').getByLabel(/お気に入り|favorites/i).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('active filter → result count updates', async ({ page }) => {
    await page.goto('/housing');
    const count = page.locator('[data-region="left"]').getByText(/\/\s?50/);
    await expect(count).toBeVisible();

    await page.getByText('Mana').click();
    // count 数字が 50 より小さくなる
    await expect(page.locator('[data-region="left"]')).toContainText(/\/ 50/);
  });

  test('tour URL lands on workspace (graceful even without local tour data)', async ({ page }) => {
    await page.goto('/housing/tour/test-abc');
    // 通常 workspace の状態に着地、 エラーにならない
    await expect(page.getByRole('img', { name: /lopo/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: 実行**

```bash
npx playwright test e2e/housing-workspace.spec.ts
```

期待: 3 シナリオ全て pass

失敗箇所があれば該当機能を修正してパスさせる。

- [ ] **Step 3: Commit**

```bash
git add e2e/housing-workspace.spec.ts
git commit -m "test(housing): E2E for 3 main flows (browse/filter/tour-url)"
```

---

## Task 11: 親仕様 (Phase 1 設計書) を Sub-spec 2B 参照に書き換え

**Files:**
- Modify: `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md`

設計書 §16 (改訂指針) に従って親仕様を更新。

- [ ] **Step 1: §7 (ギャラリー/検索) を簡略化**

該当節を以下に置き換え:

```markdown
## 7. ギャラリー / 検索

**詳細は [Sub-spec 2B 設計書](./2026-05-17-housing-sub-spec-2b-gallery-tour-design.md) §4-§5 を参照。**

要約:
- 中央エリアで Map ⇄ Pinterest を切り替え (1 ページ完結)
- 左パネルで Faceted Search (DC / 地域 / サーバー / エリア / サイズ / タグ)
- Result count は常時表示
- 物件カードは inline expansion (ページ遷移なし)
```

- [ ] **Step 2: §8 (ツアー機能、 マップなし) を簡略化**

```markdown
## 8. ツアー機能

**詳細は [Sub-spec 2B 設計書](./2026-05-17-housing-sub-spec-2b-gallery-tour-design.md) §6-§7 を参照。**

要約:
- 右パネルで進行 (閲覧/ツアーで auto-scroll の中身が切替)
- お気に入りモーダル (Shift/Ctrl/矩形選択 + DnD でツアー組立)
- Enter / Space で次へ
- 共有 URL: `/housing/tour/{id}`
```

- [ ] **Step 3: §10 (ページ構成) のボトムナビ案を廃止のメモを追記**

`§10.1` 末尾に追加:

```markdown
**改訂 (2026-05-17)**: ボトムナビ式 (探す/回る/登録の画面切替) は廃止。 1 ページ完結の Adaptive Workspace に置き換え。 詳細は [Sub-spec 2B 設計書](./2026-05-17-housing-sub-spec-2b-gallery-tour-design.md) §3 参照。
```

- [ ] **Step 4: §11.2 (グラスモーフィズム背景) にオーバーライドを記載**

```markdown
**改訂 (2026-05-17)**: 上記の LoPo 統一表現 (純白/漆黒 + プリズム光) は**ハウジングに限り Sub-spec 2B トンマナにオーバーライド**される (景色動画 + 暖色アクセント + Lucky Graphics 流リキッドグラス)。 詳細は [Sub-spec 2B 設計書](./2026-05-17-housing-sub-spec-2b-gallery-tour-design.md) §2 参照。
```

- [ ] **Step 5: §18 (実装サブスペック分解) に分割経緯**

```markdown
### Sub-spec 2A: Registration (登録) ← 完了
- 登録フォーム + 画像 3 択 + URL 自動補完
- タグマスター実装

### Sub-spec 2B: Gallery & Tour ← Sub-spec 2B 設計書で再定義
- [詳細](./2026-05-17-housing-sub-spec-2b-gallery-tour-design.md)
- 1 ページ完結 Adaptive Workspace + 6 Plan で実装
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md
git commit -m "docs(housing): redirect Phase 1 spec §7-§8/§10/§11.2/§18 to Sub-spec 2B"
```

---

## Task 12: 仕上げの動作確認 + ビルド完全検証

- [ ] **Step 1: 全テスト**

```bash
npx vitest run
```

期待: 全 pass

- [ ] **Step 2: TypeScript 厳密チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし

- [ ] **Step 3: ビルド**

```bash
npm run build
```

期待: エラーなし

- [ ] **Step 4: dev で全機能目視**

```bash
npm run dev
```

チェックリスト:
- [ ] `/housing` でワークスペース表示
- [ ] 動画背景 (Light/Dark 切替で day/night)
- [ ] 左パネル: 6 セクション、 count 連動、 閉じれる
- [ ] 中央: Map → 30 軒のうち登録ある 5 箇所が浮く、 ホバー拡大
- [ ] 中央: Pinterest → Masonry、 検索欄連動、 inline expansion
- [ ] 右パネル: auto-scroll、 ホバー停止、 ツアー時 ハイライト + Enter/Space
- [ ] お気に入り: ♡ で追加 → モーダル → Shift/Ctrl/矩形/DnD → 全部回る → マナーポップ → ツアー
- [ ] 登録 CTA (top bar + 左パネル末尾): 両方とも HousingRegisterModal を開く
- [ ] `/housing/p/mock-001`: 該当カードが expanded
- [ ] `/housing/tour/test`: workspace に着地 (エラーなし)
- [ ] `/housing/legacy`: 旧 HousingPage が動く
- [ ] DevTools で `prefers-reduced-motion: reduce` を有効化 → 動画停止 + auto-scroll 停止

- [ ] **Step 5: E2E**

```bash
npx playwright test
```

- [ ] **Step 6: 最終 Commit + iterate メモ**

```bash
git commit --allow-empty -m "chore(housing): Sub-spec 2B Plan A-F 完了 — iterate フェーズへ"
```

---

## Self-Review Checklist

### 仕様書カバレッジ

| 設計書セクション | Plan F 対応 |
|---|---|
| §6.3 物件単体共有 URL | Task 7 |
| §6.3 ツアー共有 URL 受信 | Task 8 (枠) |
| §8 登録 CTA 接続 (Sub-spec 2A 呼び出し) | Task 5 |
| §5.3 検索欄 → filter store 接続 | Task 6 |
| §9.4 ロード中スケルトン | Task 3 |
| §9.5 エラー + トースト | Task 4 |
| §12 アクセシビリティ | Task 9 |
| §13.3 E2E (Playwright) | Task 10 |
| §16 親仕様の改訂 | Task 11 |
| §17 iterate-first | Task 12 (調整は手動) |

### 親仕様カバレッジ確認 (全 Sub-spec 2B 横断)

| 親仕様セクション | 実装場所 |
|---|---|
| §4 データモデル | mockListings (Plan B) + housingListingsService (Plan F)。 実 Firestore は別件 |
| §5 認証 | Sub-spec 2A 完了部分を流用、 register modal の login gate (Task 5) |
| §6 登録フロー | Sub-spec 2A 既存 + register modal wrap (Task 5) |
| §7 ギャラリー | Plan A-D で全て |
| §8 ツアー | Plan D, E |
| §9 削除依頼 | **Sub-spec 2B スコープ外** (親仕様 §9 のフローは Phase 3) |
| §10 ルーティング | Plan A (基本) + Task 7-8 (詳細) |
| §11 UI/UX | Plan A-E + Task 11 (親仕様改訂) |
| §13 セキュリティ Rules | Sub-spec 2A 完了範囲 |

### Placeholder Scan

- 全 step に actual code or actual command ✓
- "TBD" 無し、 機能未実装は明示的に Phase 2 / 別件として記載 ✓

---

## 完了の定義

- [ ] `/housing` で 1 ページ完結のワークスペースが動作
- [ ] 全ルート (`/housing`, `/housing/p/:id`, `/housing/tour/:id`, `/housing/legacy`) が機能
- [ ] 登録 CTA (top bar + 左パネル末尾) → HousingRegisterModal → Sub-spec 2A view
- [ ] 検索欄が filter store に連動
- [ ] スケルトン + トースト機能完備
- [ ] `prefers-reduced-motion` で動画停止 + auto-scroll 停止
- [ ] a11y チェック合格
- [ ] Playwright E2E 3 シナリオ合格
- [ ] 親仕様の §7-§8, §10, §11.2, §18 が Sub-spec 2B 参照に書き換え
- [ ] `npm run build` + `npx vitest run` + `npx playwright test` 全 pass

これで **Sub-spec 2B = Gallery & Tour の 1 ページ完結アダプティブワークスペースが完成**、 リリース可能な状態。 残りは iterate (色値・spacing・アニメ秒数の手動調整) のみ。
