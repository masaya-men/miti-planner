# Housing Sub-spec 2B — Plan C: Center Area (中央エリア)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中央エリアを完成させる — Map ⇄ Pinterest 切替、 Masonry グリッド、 マップ仮画像 + 30 軒の家マーク + ホバー吹き出しカード、 物件カードの inline expansion、 初回ランダム選出

**Architecture:**
- Map view = `public/housing/maps/sample-ward.webp` (mockup の map.png を流用) + JSON で 30 軒の (x,y) 座標 + サンプル listing 紐付け
- Pinterest view = CSS columns ベースの Masonry (`column-count` でブラウザネイティブ。 lazy-load は `<img loading="lazy">`)
- ViewModeToggle = 中央右上に固定配置
- 物件カードは Pinterest / Map 両方で**同じ `HousingCard` コンポーネント**を使用、 props で表示モードを切替
- inline expansion は state を持つ `HousingCardExpandable` で実装 (クリックすると同じ場所で展開)

**Tech Stack:** Plan A/B と同じ。 マップ画像は仮 (Phase 2 で本実装)。

**親仕様参照:** §4 (中央エリア)、 §1.2 (なぜここか — View Mode Switcher の慣習)

**前提:** Plan A, B 完了済み

---

## File Structure

**新規作成 (data)**:
- `src/data/housing/sampleWardLayout.ts` — マップ仮 30 軒の位置データ + sample listing 紐付け
- `public/housing/maps/sample-ward.webp` — mockup map 画像のコピー

**新規作成 (component)**:
- `src/components/housing/workspace/CenterArea.tsx` — 中央エリア全体 (Map/Pinterest 切替)
- `src/components/housing/workspace/ViewModeToggle.tsx` — Map ⇄ Pinterest 切替トグル
- `src/components/housing/workspace/MapView.tsx` — マップ表示
- `src/components/housing/workspace/MapBubbleCard.tsx` — 家マーク上のホバー吹き出しカード
- `src/components/housing/workspace/PinterestView.tsx` — Masonry グリッド
- `src/components/housing/workspace/HousingCard.tsx` — 物件カード (共通、 Pinterest 用)
- `src/components/housing/workspace/HousingCardExpanded.tsx` — inline expansion 状態
- `src/components/housing/workspace/EmptyResult.tsx` — 絞り込み 0 件メッセージ

**新規作成 (lib)**:
- `src/lib/housing/randomWard.ts` — 5 軒以上のワードからランダム選出

**新規作成 (test)**:
- `src/__tests__/housing/ViewModeToggle.test.tsx`
- `src/__tests__/housing/MapView.test.tsx`
- `src/__tests__/housing/MapBubbleCard.test.tsx`
- `src/__tests__/housing/PinterestView.test.tsx`
- `src/__tests__/housing/HousingCard.test.tsx`
- `src/__tests__/housing/HousingCardExpanded.test.tsx`
- `src/__tests__/housing/EmptyResult.test.tsx`
- `src/__tests__/housing/randomWard.test.ts`

**編集**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — 中央プレースホルダを CenterArea に置き換え
- `src/components/housing/workspace/index.ts` — 新公開
- `src/locales/{ja,en,ko,zh}.ts` — `housing.workspace.{center,card,empty}.*` 追加

---

## Task 1: マップ画像 + ワード位置データ

**Files:**
- Copy: `docs/.private/housing-tour-mockup/map.png` → `public/housing/maps/sample-ward.webp`
- Create: `src/data/housing/sampleWardLayout.ts`

- [ ] **Step 1: マップ画像コピー**

```bash
mkdir -p public/housing/maps
cp docs/.private/housing-tour-mockup/map.png public/housing/maps/sample-ward.png
# WebP 変換 (ffmpeg or cwebp)
ffmpeg -y -i public/housing/maps/sample-ward.png -q:v 80 public/housing/maps/sample-ward.webp
```

期待: `sample-ward.webp` が 100-300KB 程度

- [ ] **Step 2: 仮ワードレイアウトデータ**

```typescript
// src/data/housing/sampleWardLayout.ts
import { MOCK_LISTINGS } from './mockListings';

export interface PlotPosition {
  plot: number; // 1-30
  x: number;    // 0..1 normalized
  y: number;    // 0..1 normalized
  listingId: string | null; // null = empty plot
}

// シロガネ ワード 3 (Mana/Anima) を初期サンプルワードに使う
export const SAMPLE_WARD_KEY = 'mana-anima-shirogane-3';

export const SAMPLE_WARD_LAYOUT: PlotPosition[] = [
  // 30 plot を画像座標系でラフに配置。 実 Phase 2 で正確な位置に置き換える
  { plot: 1,  x: 0.12, y: 0.18, listingId: 'mock-001' },
  { plot: 2,  x: 0.22, y: 0.18, listingId: null },
  { plot: 3,  x: 0.32, y: 0.18, listingId: null },
  { plot: 4,  x: 0.42, y: 0.18, listingId: null },
  { plot: 5,  x: 0.52, y: 0.18, listingId: null },
  { plot: 6,  x: 0.62, y: 0.18, listingId: null },
  { plot: 7,  x: 0.12, y: 0.30, listingId: null },
  { plot: 8,  x: 0.22, y: 0.30, listingId: null },
  { plot: 9,  x: 0.32, y: 0.30, listingId: null },
  { plot: 10, x: 0.42, y: 0.30, listingId: null },
  { plot: 11, x: 0.52, y: 0.30, listingId: null },
  { plot: 12, x: 0.62, y: 0.30, listingId: 'mock-001' }, // sample
  { plot: 13, x: 0.12, y: 0.42, listingId: null },
  { plot: 14, x: 0.22, y: 0.42, listingId: null },
  { plot: 15, x: 0.32, y: 0.42, listingId: 'mock-002' },
  { plot: 16, x: 0.42, y: 0.42, listingId: null },
  { plot: 17, x: 0.52, y: 0.42, listingId: null },
  { plot: 18, x: 0.62, y: 0.42, listingId: null },
  { plot: 19, x: 0.12, y: 0.54, listingId: null },
  { plot: 20, x: 0.22, y: 0.54, listingId: null },
  { plot: 21, x: 0.32, y: 0.54, listingId: null },
  { plot: 22, x: 0.42, y: 0.54, listingId: 'mock-004' },
  { plot: 23, x: 0.52, y: 0.54, listingId: null },
  { plot: 24, x: 0.62, y: 0.54, listingId: null },
  { plot: 25, x: 0.12, y: 0.66, listingId: null },
  { plot: 26, x: 0.22, y: 0.66, listingId: null },
  { plot: 27, x: 0.32, y: 0.66, listingId: 'mock-009' },
  { plot: 28, x: 0.42, y: 0.66, listingId: null },
  { plot: 29, x: 0.52, y: 0.66, listingId: null },
  { plot: 30, x: 0.62, y: 0.66, listingId: null },
];

export function listingForPlot(plot: number) {
  const p = SAMPLE_WARD_LAYOUT.find((x) => x.plot === plot);
  if (!p?.listingId) return null;
  return MOCK_LISTINGS.find((l) => l.id === p.listingId) ?? null;
}

export function listingsInSampleWard() {
  return SAMPLE_WARD_LAYOUT
    .map((p) => p.listingId ? MOCK_LISTINGS.find((l) => l.id === p.listingId) : null)
    .filter((l): l is NonNullable<typeof l> => l !== null);
}
```

- [ ] **Step 3: Commit**

```bash
git add public/housing/maps/ src/data/housing/sampleWardLayout.ts
git commit -m "feat(housing): sample ward layout data + map asset"
```

---

## Task 2: randomWard ロジック (TDD)

**Files:**
- Create: `src/lib/housing/randomWard.ts`
- Test: `src/__tests__/housing/randomWard.test.ts`

設計書 §4.1: 5 軒以上登録のあるワードからランダム選出。 Plan C ではサンプルワード固定で良いが、 ロジックは入れておく (Phase 2 / 統合時に活きる)。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/randomWard.test.ts
import { describe, it, expect } from 'vitest';
import { pickRandomWard, listListingsForWard, wardKeyOf } from '../../lib/housing/randomWard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('wardKeyOf', () => {
  it('builds a deterministic key from listing fields', () => {
    const key = wardKeyOf({ dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3 });
    expect(key).toBe('mana-anima-shirogane-3');
  });
});

describe('pickRandomWard', () => {
  it('returns a ward key that has at least 5 listings', () => {
    // mock は 50 件、 ただし各ワード 1 件しかない → 5 件ある ward は無い → null
    const result = pickRandomWard(MOCK_LISTINGS, 5);
    expect(result).toBeNull();
  });

  it('returns a ward key when threshold met (synthetic test)', () => {
    // 同じ ward に 5 件入れたデータで検証
    const synthetic = Array.from({ length: 5 }, (_, i) => ({
      ...MOCK_LISTINGS[0], id: `s-${i}`, plot: i + 1,
    }));
    const result = pickRandomWard(synthetic, 5);
    expect(result).not.toBeNull();
    expect(result).toBe('mana-anima-shirogane-3');
  });

  it('returns null when no ward meets threshold', () => {
    const result = pickRandomWard(MOCK_LISTINGS, 100);
    expect(result).toBeNull();
  });
});

describe('listListingsForWard', () => {
  it('returns listings matching the ward key', () => {
    const listings = listListingsForWard(MOCK_LISTINGS, 'mana-anima-shirogane-3');
    expect(listings.every((l) =>
      `${l.dc}-${l.server}-${l.area}-${l.ward}`.toLowerCase() === 'mana-anima-shirogane-3'
    )).toBe(true);
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/lib/housing/randomWard.ts
import type { MockListing } from '../../data/housing/mockListings';

export function wardKeyOf(input: Pick<MockListing, 'dc' | 'server' | 'area' | 'ward'>): string {
  return `${input.dc}-${input.server}-${input.area}-${input.ward}`.toLowerCase();
}

export function listListingsForWard(listings: MockListing[], wardKey: string): MockListing[] {
  return listings.filter((l) => wardKeyOf(l) === wardKey);
}

export function pickRandomWard(listings: MockListing[], minListings: number = 5): string | null {
  const grouped = new Map<string, number>();
  for (const l of listings) {
    const key = wardKeyOf(l);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  const eligible: string[] = [];
  for (const [key, count] of grouped) {
    if (count >= minListings) eligible.push(key);
  }
  if (eligible.length === 0) return null;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx];
}
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/randomWard.test.ts
git add src/lib/housing/randomWard.ts src/__tests__/housing/randomWard.test.ts
git commit -m "feat(housing): randomWard selector (>=N listings threshold)"
```

---

## Task 3: ViewModeToggle (TDD)

**Files:**
- Create: `src/components/housing/workspace/ViewModeToggle.tsx`
- Test: `src/__tests__/housing/ViewModeToggle.test.tsx`

中央右上の Map ⇄ Pinterest 切替。 設計書 §4.2 + §1.2 (Yelp / GitHub 慣習)。

- [ ] **Step 1: i18n 追加**

`housing.workspace.center.toggle.{map,pinterest}` (JA: マップ / 一覧、 EN: Map / Grid、 KO: 지도 / 그리드、 ZH: 地图 / 网格)

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/ViewModeToggle.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewModeToggle } from '../../components/housing/workspace/ViewModeToggle';
import { useHousingViewStore } from '../../store/useHousingViewStore';

describe('ViewModeToggle', () => {
  beforeEach(() => useHousingViewStore.getState().reset());

  it('renders both options', () => {
    render(<ViewModeToggle />);
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('marks current view as active', () => {
    useHousingViewStore.getState().setViewMode('map');
    render(<ViewModeToggle />);
    const buttons = screen.getAllByRole('button');
    const active = buttons.find((b) => b.getAttribute('data-active') === 'true');
    expect(active?.textContent).toMatch(/マップ|map|지도|地图/i);
  });

  it('switches view on click', () => {
    render(<ViewModeToggle />);
    fireEvent.click(screen.getByText(/一覧|grid|그리드|网格/i));
    expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/ViewModeToggle.tsx
import { useTranslation } from 'react-i18next';
import { Map, LayoutGrid } from 'lucide-react';
import { useHousingViewStore } from '../../../store/useHousingViewStore';

export const ViewModeToggle: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useHousingViewStore((s) => s.viewMode);
  const setViewMode = useHousingViewStore((s) => s.setViewMode);

  return (
    <div className="inline-flex rounded-md overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.04)' }}>
      <button
        type="button"
        data-active={viewMode === 'map'}
        onClick={() => setViewMode('map')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all"
        style={{
          background: viewMode === 'map' ? 'rgba(255,201,135,0.18)' : 'transparent',
          color: viewMode === 'map' ? '#ffc987' : 'rgba(255,255,255,0.78)',
        }}
      >
        <Map size={14} />
        {t('housing.workspace.center.toggle.map')}
      </button>
      <button
        type="button"
        data-active={viewMode === 'pinterest'}
        onClick={() => setViewMode('pinterest')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all"
        style={{
          background: viewMode === 'pinterest' ? 'rgba(255,201,135,0.18)' : 'transparent',
          color: viewMode === 'pinterest' ? '#ffc987' : 'rgba(255,255,255,0.78)',
        }}
      >
        <LayoutGrid size={14} />
        {t('housing.workspace.center.toggle.pinterest')}
      </button>
    </div>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/ViewModeToggle.test.tsx
git add src/components/housing/workspace/ViewModeToggle.tsx \
        src/__tests__/housing/ViewModeToggle.test.tsx \
        src/locales/
git commit -m "feat(housing): ViewModeToggle (Map/Pinterest switch, top-right)"
```

---

## Task 4: HousingCard (TDD)

**Files:**
- Create: `src/components/housing/workspace/HousingCard.tsx`
- Test: `src/__tests__/housing/HousingCard.test.tsx`

Pinterest グリッド 1 セル分。 サムネ + 住所 + サイズ + タグ 2 個。 クリック時の挙動は親で。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/HousingCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingCard } from '../../components/housing/workspace/HousingCard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('HousingCard', () => {
  const listing = MOCK_LISTINGS[0];

  it('renders thumbnail (img) and address', () => {
    render(<HousingCard listing={listing} onClick={() => {}} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByText(/Shirogane|シロガネ/)).toBeInTheDocument();
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<HousingCard listing={listing} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows up to 2 tags', () => {
    const withManyTags = { ...listing, tags: ['a', 'b', 'c', 'd'] };
    render(<HousingCard listing={withManyTags} onClick={() => {}} />);
    // a, b should be visible; c, d not.
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.queryByText('c')).toBeNull();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/HousingCard.tsx
import type { MockListing } from '../../../data/housing/mockListings';

export interface HousingCardProps {
  listing: MockListing;
  onClick: () => void;
}

const placeholderImage = '/housing/mock-thumbs/placeholder.svg';

export const HousingCard: React.FC<HousingCardProps> = ({ listing, onClick }) => {
  const imgSrc =
    listing.imageMode === 'thumbnail' && listing.thumbnailPath
      ? listing.thumbnailPath
      : listing.imageMode === 'sns' && listing.ogImageUrl
      ? listing.ogImageUrl
      : placeholderImage;

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left rounded-lg overflow-hidden transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#ffc987]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.18)' }}
    >
      <div className="aspect-video bg-black/20 overflow-hidden">
        <img
          src={imgSrc}
          alt={`${listing.area} ${listing.ward}-${listing.plot}`}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
        <div className="text-sm font-medium">
          {listing.area} {listing.ward}-{listing.plot}
          <span className="ml-2 text-xs opacity-70">{listing.size}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {listing.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};
```

placeholder svg を `public/housing/mock-thumbs/placeholder.svg` で作成 (簡単な暖色グラデ円 1 個):

```bash
mkdir -p public/housing/mock-thumbs
cat > public/housing/mock-thumbs/placeholder.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225">
  <defs><radialGradient id="g" cx="50%" cy="40%"><stop offset="0%" stop-color="#ffe2b3"/><stop offset="100%" stop-color="#3a2818"/></radialGradient></defs>
  <rect width="400" height="225" fill="url(#g)"/>
</svg>
EOF
```

mock-thumbs の 1-10 は当面 placeholder.svg にフォールバック (実装時に画像追加可能)。

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/HousingCard.test.tsx
git add src/components/housing/workspace/HousingCard.tsx \
        src/__tests__/housing/HousingCard.test.tsx \
        public/housing/mock-thumbs/
git commit -m "feat(housing): HousingCard (Pinterest cell)"
```

---

## Task 5: HousingCardExpanded (TDD)

**Files:**
- Create: `src/components/housing/workspace/HousingCardExpanded.tsx`
- Test: `src/__tests__/housing/HousingCardExpanded.test.tsx`

inline expansion 時の詳細ビュー。 大画像 + 全タグ + 紹介文 + ボタン (♡ お気に入り / + ツアー / 🔗 URL / ↗ SNS / ← 閉じる)。

- [ ] **Step 1: i18n 追加**

`housing.workspace.card.{favorite,add_to_tour,copy_url,open_sns,close}` (各 4 言語)

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/HousingCardExpanded.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingCardExpanded } from '../../components/housing/workspace/HousingCardExpanded';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';

describe('HousingCardExpanded', () => {
  beforeEach(() => useHousingFavoritesStore.getState().reset());
  const listing = MOCK_LISTINGS[0];

  it('renders all tags, description, and action buttons', () => {
    render(<HousingCardExpanded listing={listing} onClose={() => {}} />);
    listing.tags.forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByLabelText(/お気に入り|favorite/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ツアー|tour/i)).toBeInTheDocument();
  });

  it('toggles favorite when ♡ clicked', () => {
    render(<HousingCardExpanded listing={listing} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/お気に入り|favorite/i));
    expect(useHousingFavoritesStore.getState().contains(listing.id)).toBe(true);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<HousingCardExpanded listing={listing} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/閉じる|close/i));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders SNS link when postUrl present', () => {
    const withUrl = { ...listing, postUrl: 'https://example.com/post/123', imageMode: 'sns' as const };
    render(<HousingCardExpanded listing={withUrl} onClose={() => {}} />);
    const link = screen.getByRole('link', { name: /sns|↗|開く|open/i });
    expect(link.getAttribute('href')).toBe('https://example.com/post/123');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/HousingCardExpanded.tsx
import { useTranslation } from 'react-i18next';
import { Heart, Plus, Link as LinkIcon, ExternalLink, X } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';

export interface HousingCardExpandedProps {
  listing: MockListing;
  onClose: () => void;
}

export const HousingCardExpanded: React.FC<HousingCardExpandedProps> = ({ listing, onClose }) => {
  const { t } = useTranslation();
  const favorites = useHousingFavoritesStore();
  const isFavorite = favorites.contains(listing.id);

  const imgSrc =
    listing.imageMode === 'thumbnail' && listing.thumbnailPath
      ? listing.thumbnailPath
      : listing.imageMode === 'sns' && listing.ogImageUrl
      ? listing.ogImageUrl
      : '/housing/mock-thumbs/placeholder.svg';

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/housing/p/${listing.id}`);
    } catch {
      // ignore — fallback to selection prompt (Plan F でトースト対応)
    }
  };

  return (
    <div
      className="rounded-lg overflow-hidden text-white"
      style={{
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.22)',
        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      <div className="aspect-video bg-black/30">
        <img src={imgSrc} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">
            {listing.dc} / {listing.server} / {listing.area} {listing.ward}-{listing.plot}
            <span className="ml-2 text-sm opacity-70">{listing.size}</span>
          </div>
          <button
            type="button"
            aria-label={t('housing.workspace.card.close')}
            onClick={onClose}
            className="p-1.5 rounded transition-colors hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {listing.description && (
          <p className="text-sm opacity-78 leading-relaxed">{listing.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {listing.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }}>{tag}</span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            aria-label={t('housing.workspace.card.favorite')}
            onClick={() => isFavorite ? favorites.remove(listing.id) : favorites.add(listing.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
            style={{
              border: isFavorite ? '1px solid #ffc987' : '1px solid rgba(255,255,255,0.22)',
              color: isFavorite ? '#ffc987' : 'inherit',
              background: isFavorite ? 'rgba(255,201,135,0.08)' : 'transparent',
            }}
          >
            <Heart size={14} fill={isFavorite ? '#ffc987' : 'none'} />
            <span className="text-sm">{t('housing.workspace.card.favorite')}</span>
          </button>

          <button
            type="button"
            aria-label={t('housing.workspace.card.add_to_tour')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,0.22)' }}
          >
            <Plus size={14} />
            <span className="text-sm">{t('housing.workspace.card.add_to_tour')}</span>
          </button>

          <button
            type="button"
            aria-label={t('housing.workspace.card.copy_url')}
            onClick={copyShareUrl}
            className="p-2 rounded-md transition-colors hover:bg-white/10"
          >
            <LinkIcon size={14} />
          </button>

          {listing.postUrl && (
            <a
              href={listing.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('housing.workspace.card.open_sns')}
              className="p-2 rounded-md transition-colors hover:bg-white/10"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/HousingCardExpanded.test.tsx
git add src/components/housing/workspace/HousingCardExpanded.tsx \
        src/__tests__/housing/HousingCardExpanded.test.tsx \
        src/locales/
git commit -m "feat(housing): HousingCardExpanded (inline expansion with actions)"
```

---

## Task 6: MapBubbleCard (TDD)

**Files:**
- Create: `src/components/housing/workspace/MapBubbleCard.tsx`
- Test: `src/__tests__/housing/MapBubbleCard.test.tsx`

家マークの上に浮く吹き出しカード。 ホバーで拡大 + アクション表示。 CSS :hover で実装 (マウス追従禁止ルール対応)。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/MapBubbleCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapBubbleCard } from '../../components/housing/workspace/MapBubbleCard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('MapBubbleCard', () => {
  const listing = MOCK_LISTINGS[0];

  it('positions itself at given x,y as percent', () => {
    const { container } = render(
      <MapBubbleCard listing={listing} x={0.25} y={0.5} onClick={() => {}} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.left).toBe('25%');
    expect(root.style.top).toBe('50%');
  });

  it('renders thumbnail + address', () => {
    render(<MapBubbleCard listing={listing} x={0.1} y={0.1} onClick={() => {}} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText(/Shirogane|シロガネ/)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MapBubbleCard listing={listing} x={0.1} y={0.1} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/MapBubbleCard.tsx
import type { MockListing } from '../../../data/housing/mockListings';

export interface MapBubbleCardProps {
  listing: MockListing;
  /** Normalized 0..1 inside parent map container */
  x: number;
  y: number;
  onClick: () => void;
}

const placeholder = '/housing/mock-thumbs/placeholder.svg';

export const MapBubbleCard: React.FC<MapBubbleCardProps> = ({ listing, x, y, onClick }) => {
  const imgSrc =
    listing.imageMode === 'thumbnail' && listing.thumbnailPath
      ? listing.thumbnailPath
      : listing.imageMode === 'sns' && listing.ogImageUrl
      ? listing.ogImageUrl
      : placeholder;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -translate-x-1/2 -translate-y-full hover:scale-[1.6] hover:z-30 transition-transform duration-200 origin-bottom focus:outline-none"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      <div
        className="w-20 rounded-lg overflow-hidden text-white"
        style={{
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,201,135,0.5)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      >
        <div className="aspect-square bg-black/30">
          <img src={imgSrc} alt={`${listing.area} ${listing.plot}`} loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div className="px-1.5 py-1 text-[10px] leading-tight">
          {listing.area.slice(0, 3)} {listing.ward}-{listing.plot}
        </div>
      </div>
      {/* Pin (down-pointing arrow under the card) */}
      <div
        className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #ffc987' }}
      />
    </button>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/MapBubbleCard.test.tsx
git add src/components/housing/workspace/MapBubbleCard.tsx \
        src/__tests__/housing/MapBubbleCard.test.tsx
git commit -m "feat(housing): MapBubbleCard (hover-expand, CSS-only)"
```

---

## Task 7: MapView (TDD)

**Files:**
- Create: `src/components/housing/workspace/MapView.tsx`
- Test: `src/__tests__/housing/MapView.test.tsx`

サンプルワード画像 + 各 plot に MapBubbleCard を配置。 listing が紐づくものだけ表示。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/MapView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapView } from '../../components/housing/workspace/MapView';

describe('MapView', () => {
  it('renders the map image', () => {
    render(<MapView wardKey="mana-anima-shirogane-3" onCardClick={() => {}} />);
    const img = screen.getByAltText(/map|マップ|지도|地图/i);
    expect(img.getAttribute('src')).toContain('/housing/maps/');
  });

  it('renders one MapBubbleCard per registered plot (not empty plots)', () => {
    const { container } = render(<MapView wardKey="mana-anima-shirogane-3" onCardClick={() => {}} />);
    // sample-ward-layout で listingId が non-null は 5 plot (mock-001, 001, 002, 004, 009)
    // mock-001 is reused — should still render as 2 different bubbles (plot 1, plot 12)
    const bubbles = container.querySelectorAll('button[type="button"]');
    expect(bubbles.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: i18n 追加**: `housing.workspace.center.map_alt` (JA: 'ハウジングマップ' / EN: 'Housing map' / KO: '하우징 지도' / ZH: '住宅地图')

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/MapView.tsx
import { useTranslation } from 'react-i18next';
import { SAMPLE_WARD_LAYOUT } from '../../../data/housing/sampleWardLayout';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { MapBubbleCard } from './MapBubbleCard';

export interface MapViewProps {
  wardKey: string;
  onCardClick: (listingId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ onCardClick }) => {
  const { t } = useTranslation();

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <div className="relative max-w-4xl w-full aspect-[4/3]">
        <img
          src="/housing/maps/sample-ward.webp"
          alt={t('housing.workspace.center.map_alt')}
          className="absolute inset-0 w-full h-full object-contain"
          loading="eager"
        />
        {SAMPLE_WARD_LAYOUT.map((plot) => {
          if (!plot.listingId) return null;
          const listing = MOCK_LISTINGS.find((l) => l.id === plot.listingId);
          if (!listing) return null;
          return (
            <MapBubbleCard
              key={plot.plot}
              listing={listing}
              x={plot.x}
              y={plot.y}
              onClick={() => onCardClick(listing.id)}
            />
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/MapView.test.tsx
git add src/components/housing/workspace/MapView.tsx \
        src/__tests__/housing/MapView.test.tsx \
        src/locales/
git commit -m "feat(housing): MapView (image + bubble cards at sample plots)"
```

---

## Task 8: PinterestView (TDD)

**Files:**
- Create: `src/components/housing/workspace/PinterestView.tsx`
- Test: `src/__tests__/housing/PinterestView.test.tsx`

CSS columns ベースの Masonry。 列数は画面幅で自動 (Tailwind `columns-2 md:columns-3 lg:columns-4`)。 inline expansion の state を持つ。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/PinterestView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinterestView } from '../../components/housing/workspace/PinterestView';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('PinterestView', () => {
  it('renders one card per listing', () => {
    const listings = MOCK_LISTINGS.slice(0, 5);
    render(<PinterestView listings={listings} />);
    const cards = screen.getAllByRole('button').filter((b) => b.querySelector('img'));
    expect(cards.length).toBe(5);
  });

  it('expands a card when clicked', () => {
    const listings = MOCK_LISTINGS.slice(0, 3);
    const { container } = render(<PinterestView listings={listings} />);
    const firstCard = container.querySelector('button[type="button"]');
    if (!firstCard) throw new Error('no card');
    fireEvent.click(firstCard);
    // After click, the expanded view should render (look for close button or wider layout)
    expect(screen.getByLabelText(/閉じる|close/i)).toBeInTheDocument();
  });

  it('collapses when expanded close clicked', () => {
    const listings = MOCK_LISTINGS.slice(0, 3);
    const { container } = render(<PinterestView listings={listings} />);
    const firstCard = container.querySelector('button[type="button"]');
    if (!firstCard) throw new Error('no card');
    fireEvent.click(firstCard);
    fireEvent.click(screen.getByLabelText(/閉じる|close/i));
    expect(screen.queryByLabelText(/閉じる|close/i)).toBeNull();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/PinterestView.tsx
import { useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingCard } from './HousingCard';
import { HousingCardExpanded } from './HousingCardExpanded';

export interface PinterestViewProps {
  listings: MockListing[];
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="p-4 columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
      {listings.map((listing) => (
        <div key={listing.id} className="break-inside-avoid">
          {expandedId === listing.id ? (
            <HousingCardExpanded
              listing={listing}
              onClose={() => setExpandedId(null)}
            />
          ) : (
            <HousingCard listing={listing} onClick={() => setExpandedId(listing.id)} />
          )}
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/PinterestView.test.tsx
git add src/components/housing/workspace/PinterestView.tsx \
        src/__tests__/housing/PinterestView.test.tsx
git commit -m "feat(housing): PinterestView (Masonry via CSS columns + inline expansion)"
```

---

## Task 9: EmptyResult (TDD)

**Files:**
- Create: `src/components/housing/workspace/EmptyResult.tsx`
- Test: `src/__tests__/housing/EmptyResult.test.tsx`

設計書 §9.1: 中央エリアに「該当ハウジングがありません」 + 「条件を変更してください」。

- [ ] **Step 1: i18n 追加**

`housing.workspace.empty.{title,hint}` (4 言語)
- ja: '該当ハウジングがありません' / '条件を変更してください'
- en: 'No homes match your filters' / 'Try adjusting your filters'
- ko: '조건에 맞는 집이 없습니다' / '필터를 조정해 주세요'
- zh: '没有符合条件的房屋' / '请调整筛选条件'

- [ ] **Step 2: テスト + 実装**

```typescript
// src/__tests__/housing/EmptyResult.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyResult } from '../../components/housing/workspace/EmptyResult';

describe('EmptyResult', () => {
  it('renders title and hint', () => {
    render(<EmptyResult />);
    expect(screen.getByText(/該当|no homes|조건|没有/i)).toBeInTheDocument();
    expect(screen.getByText(/条件|adjusting|필터|筛选/i)).toBeInTheDocument();
  });
});
```

```typescript
// src/components/housing/workspace/EmptyResult.tsx
import { useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';

export const EmptyResult: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-white p-8"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}>
      <SearchX size={48} className="opacity-55 mb-4" />
      <h2 className="text-lg font-medium mb-2">{t('housing.workspace.empty.title')}</h2>
      <p className="text-sm opacity-70">{t('housing.workspace.empty.hint')}</p>
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/EmptyResult.test.tsx
git add src/components/housing/workspace/EmptyResult.tsx \
        src/__tests__/housing/EmptyResult.test.tsx \
        src/locales/
git commit -m "feat(housing): EmptyResult component"
```

---

## Task 10: CenterArea — 統合 (Map / Pinterest / Empty 切替)

**Files:**
- Create: `src/components/housing/workspace/CenterArea.tsx`
- Test: 統合は HousingWorkspace 経由で
- Modify: `src/components/housing/workspace/index.ts`

- [ ] **Step 1: 実装**

```typescript
// src/components/housing/workspace/CenterArea.tsx
import { useEffect, useMemo } from 'react';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../../store/useHousingRandomStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { pickRandomWard, listListingsForWard, wardKeyOf } from '../../../lib/housing/randomWard';
import { ViewModeToggle } from './ViewModeToggle';
import { MapView } from './MapView';
import { PinterestView } from './PinterestView';
import { EmptyResult } from './EmptyResult';

const SAMPLE_WARD_KEY = 'mana-anima-shirogane-3';

export const CenterArea: React.FC = () => {
  const viewMode = useHousingViewStore((s) => s.viewMode);
  const filter = useHousingFilterStore();
  const selectedWardId = useHousingRandomStore((s) => s.selectedWardId);
  const selectWard = useHousingRandomStore((s) => s.selectWard);

  // Initial random ward selection (only once per session)
  useEffect(() => {
    if (selectedWardId === null) {
      // mock データだとどのワードも 5 軒未満なのでサンプルワード固定
      // 実 Firestore 統合時には pickRandomWard を使う
      const random = pickRandomWard(MOCK_LISTINGS, 5);
      selectWard(random ?? SAMPLE_WARD_KEY);
    }
  }, [selectedWardId, selectWard]);

  const activeWardKey = selectedWardId ?? SAMPLE_WARD_KEY;

  // Apply filters to listings shown
  const allFiltered = useMemo(() => applyFilters(MOCK_LISTINGS, {
    dc: filter.dc, regions: filter.regions, servers: filter.servers,
    areas: filter.areas, sizes: filter.sizes, tags: filter.tags, searchText: filter.searchText,
  }), [filter.dc, filter.regions, filter.servers, filter.areas, filter.sizes, filter.tags, filter.searchText]);

  // Pinterest: filtered listings (new-first)
  const pinterestListings = useMemo(
    () => [...allFiltered].sort((a, b) => b.createdAt - a.createdAt),
    [allFiltered]
  );

  // Map view: listings in the active ward (regardless of filter, for now — Phase 2 で要再考)
  const mapWardListings = useMemo(
    () => listListingsForWard(MOCK_LISTINGS, activeWardKey),
    [activeWardKey]
  );

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 right-3 z-10">
        <ViewModeToggle />
      </div>

      {viewMode === 'map' ? (
        mapWardListings.length === 0 ? (
          <EmptyResult />
        ) : (
          <MapView wardKey={activeWardKey} onCardClick={() => { /* TODO: Plan E でツアー追加経由 */ }} />
        )
      ) : (
        pinterestListings.length === 0 ? (
          <EmptyResult />
        ) : (
          <PinterestView listings={pinterestListings} />
        )
      )}
    </div>
  );
};
```

- [ ] **Step 2: index.ts に CenterArea 追加**

```typescript
// src/components/housing/workspace/index.ts (追記)
export { CenterArea } from './CenterArea';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/housing/workspace/CenterArea.tsx \
        src/components/housing/workspace/index.ts
git commit -m "feat(housing): CenterArea (Map/Pinterest/Empty switching + filter-aware)"
```

---

## Task 11: HousingWorkspace に CenterArea 統合

**Files:**
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`

- [ ] **Step 1: プレースホルダ置換**

`HousingWorkspace.tsx` の `[Center area — Plan C]` を削除して `<CenterArea />` を入れる:

```typescript
// imports 追記
import { CenterArea } from './CenterArea';

// section data-region="center" の中身を置換
<section data-region="center" className="flex-1 min-w-0">
  <CenterArea />
</section>
```

- [ ] **Step 2: dev 目視確認**

```bash
npm run dev
```

期待:
- 右上にトグル (デフォルト Map)
- マップビューでサンプルワード画像表示 + 5 plot に吹き出しカード
- 吹き出しにホバーで拡大、 アクセント色の枠
- Pinterest 切替で全 50 件が masonry で並ぶ
- カードクリックで inline expansion
- 左パネルでフィルタすると Pinterest 側だけ絞り込まれる (マップは現状ワード固定)
- フィルタ 0 件で「該当ハウジングがありません」 表示

- [ ] **Step 3: ビルド検証 + 全テスト**

```bash
npm run build
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx
git commit -m "feat(housing): wire CenterArea into HousingWorkspace"
```

---

## Self-Review Checklist

### 仕様書カバレッジ

| 設計書セクション | Plan C 対応 |
|---|---|
| §4.1 マップ (30 軒、 ホバー拡大) | Task 1, 6, 7 |
| §4.2 Pinterest (Masonry、 新着順) | Task 8 |
| §4.3 inline expansion + SNS リンク | Task 5 |
| §4.4 マップ吹き出し (自己完結、 連動なし) | Task 6 (CSS :hover、 マウス追従禁止ルール対応) |
| §4.5 切替時の状態継承 | Task 10 (filter store 共有) |
| §4 初回ランダム (5 軒以上) | Task 2, 10 |
| §9.1 空状態 (絞り込み 0) | Task 9 |
| §3 View Mode Switcher の慣習 (右上) | Task 3 |

### Plan C スコープ外

- マップとフィルタの連動 (現状サンプルワード固定) → Phase 2 / Plan F で再評価
- 物件単体共有 URL の着地 (`/housing/p/{id}` 開いた時に該当カードを expanded で開く) → Plan F
- 物件カードからツアー追加 → Plan D/E で実装

### Placeholder Scan

- 全 step に actual code or actual command ✓
- "TBD" / "TODO" がコメントレベルで残るが、 機能としては動作する状態 (Plan F で完成) ✓

---

## 完了の定義

- [ ] `/housing` を開くと中央エリアにマップ画像 + 5 つの吹き出しカード
- [ ] 右上トグルで Pinterest 切替、 50 件が Masonry で並ぶ
- [ ] カードクリックで inline expansion → 詳細 + アクションボタン
- [ ] ♡ お気に入りボタンで store に追加される
- [ ] フィルタ 0 件で空状態メッセージ表示
- [ ] `npm run build` + `npx vitest run` 全 pass
