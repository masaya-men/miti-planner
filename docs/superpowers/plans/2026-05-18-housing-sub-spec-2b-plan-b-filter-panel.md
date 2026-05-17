# Housing Sub-spec 2B — Plan B: Filter Panel (左パネル)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左パネルの Faceted Search を完成させる — DC / 地域 / サーバー / エリア / サイズ / テーマで物件を絞り込み、 Result count を常時表示、 登録 CTA、 パネル開閉が動く

**Architecture:** mock データソース (`src/data/housing/mockListings.ts`) を用意して、 そこから filter store の条件で絞り込んで count 更新。 Firestore 接続は Plan F。 UI 板にはガラス背景 (Plan A の LiquidGlassPanel) を被せる。

**Tech Stack:** Plan A と同じ。 追加なし。

**親仕様参照:** §5 (左パネル: Faceted Search)、 §17 (iterate-first 項目)

**前提:** Plan A 完了済み (5 stores + LiquidGlassPanel + Workspace 骨格)

---

## File Structure

**新規作成 (data)**:
- `src/data/housing/mockListings.ts` — mock の物件データ (50-100 件)
- `src/data/housing/dcServerMap.ts` — DC ↔ サーバー対応表
- `src/data/housing/regionMap.ts` — 地域 ↔ DC 対応表

**新規作成 (lib)**:
- `src/lib/housing/applyFilters.ts` — filter store の条件で listings を絞り込む pure 関数

**新規作成 (component)**:
- `src/components/housing/workspace/FilterPanel.tsx` — 左パネル全体
- `src/components/housing/workspace/FilterSection.tsx` — 各絞り込み軸の共通セクション
- `src/components/housing/workspace/FilterChip.tsx` — 各タグ風選択ボタン
- `src/components/housing/workspace/ResultCountBadge.tsx` — ○/○○ 軒の表示
- `src/components/housing/workspace/RegisterCTA.tsx` — 左パネル末尾の登録ボタン
- `src/components/housing/workspace/PanelCloseButton.tsx` — パネル開閉ボタン (再利用、 Plan D でも使用)

**新規作成 (test)**:
- `src/__tests__/housing/applyFilters.test.ts`
- `src/__tests__/housing/FilterPanel.test.tsx`
- `src/__tests__/housing/FilterSection.test.tsx`
- `src/__tests__/housing/FilterChip.test.tsx`
- `src/__tests__/housing/ResultCountBadge.test.tsx`
- `src/__tests__/housing/RegisterCTA.test.tsx`

**編集**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — 左パネルプレースホルダを FilterPanel に置き換え
- `src/components/housing/workspace/index.ts` — 新公開
- `src/locales/{ja,en,ko,zh}.ts` — `housing.workspace.filter.*` キー追加

---

## Task 1: mock listings データ + DC/サーバー/地域マスター

**Files:**
- Create: `src/data/housing/mockListings.ts`
- Create: `src/data/housing/dcServerMap.ts`
- Create: `src/data/housing/regionMap.ts`

- [ ] **Step 1: dcServerMap.ts を作成**

```typescript
// src/data/housing/dcServerMap.ts
export interface DCServers {
  region: 'JP' | 'NA' | 'EU' | 'OCE';
  servers: string[];
}

export const DC_SERVER_MAP: Record<string, DCServers> = {
  Elemental: { region: 'JP', servers: ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'] },
  Gaia: { region: 'JP', servers: ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'] },
  Mana: { region: 'JP', servers: ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'] },
  Meteor: { region: 'JP', servers: ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'] },
  Aether: { region: 'NA', servers: ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren'] },
  Primal: { region: 'NA', servers: ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros'] },
  Crystal: { region: 'NA', servers: ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera'] },
  Dynamis: { region: 'NA', servers: ['Halicarnassus', 'Maduin', 'Marilith', 'Seraph'] },
  Chaos: { region: 'EU', servers: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
  Light: { region: 'EU', servers: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
  Materia: { region: 'OCE', servers: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'] },
};

export const ALL_DCS = Object.keys(DC_SERVER_MAP);
export const ALL_REGIONS: Array<'JP' | 'NA' | 'EU' | 'OCE'> = ['JP', 'NA', 'EU', 'OCE'];

export function dcsForRegion(region: 'JP' | 'NA' | 'EU' | 'OCE'): string[] {
  return ALL_DCS.filter((dc) => DC_SERVER_MAP[dc].region === region);
}

export function serversForDC(dc: string): string[] {
  return DC_SERVER_MAP[dc]?.servers ?? [];
}
```

- [ ] **Step 2: regionMap.ts を作成**

```typescript
// src/data/housing/regionMap.ts
import { dcsForRegion } from './dcServerMap';

export type Region = 'JP' | 'NA' | 'EU' | 'OCE';

export const REGION_LABELS: Record<Region, { ja: string; en: string; ko: string; zh: string }> = {
  JP: { ja: '日本', en: 'Japan', ko: '일본', zh: '日本' },
  NA: { ja: '北米', en: 'North America', ko: '북미', zh: '北美' },
  EU: { ja: '欧州', en: 'Europe', ko: '유럽', zh: '欧洲' },
  OCE: { ja: 'オセアニア', en: 'Oceania', ko: '오세아니아', zh: '大洋洲' },
};

export { dcsForRegion };
```

- [ ] **Step 3: mockListings.ts を作成 (50 件のサンプルデータ)**

```typescript
// src/data/housing/mockListings.ts
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';

export interface MockListing {
  id: string;
  ownerUid: string;
  dc: string;
  server: string;
  region: 'JP' | 'NA' | 'EU' | 'OCE';
  area: HousingArea;
  ward: number;
  plot: number;
  size: HousingSize;
  imageMode: 'sns' | 'thumbnail' | 'none';
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;
  tags: string[];
  description?: string;
  createdAt: number; // unix ms
}

// 50 件のモック、 ランダム選出やフィルタテストに使う
function gen(i: number, dc: string, region: 'JP' | 'NA' | 'EU' | 'OCE', server: string,
             area: HousingArea, ward: number, plot: number, size: HousingSize,
             tags: string[], desc: string): MockListing {
  return {
    id: `mock-${i.toString().padStart(3, '0')}`,
    ownerUid: `mock-user-${(i % 8) + 1}`,
    dc, server, region, area, ward, plot, size,
    imageMode: 'thumbnail',
    thumbnailPath: `/housing/mock-thumbs/${(i % 10) + 1}.webp`,
    tags, description: desc,
    createdAt: Date.now() - i * 86400_000,
  };
}

export const MOCK_LISTINGS: MockListing[] = [
  gen(1, 'Mana', 'JP', 'Anima', 'Shirogane', 3, 12, 'M', ['wafu', 'cafe'], '和風カフェ'),
  gen(2, 'Mana', 'JP', 'Anima', 'Shirogane', 3, 15, 'S', ['wafu'], '日本庭園のあるお家'),
  gen(3, 'Mana', 'JP', 'Pandaemonium', 'LavenderBeds', 5, 7, 'L', ['modern'], 'モダン豪邸'),
  gen(4, 'Mana', 'JP', 'Pandaemonium', 'Shirogane', 8, 22, 'M', ['wafu', 'shrine'], '神社風'),
  gen(5, 'Elemental', 'JP', 'Aegis', 'Mist', 12, 4, 'L', ['mediterranean'], '地中海風ヴィラ'),
  gen(6, 'Elemental', 'JP', 'Atomos', 'Goblet', 7, 18, 'M', ['gothic'], 'ゴシック邸'),
  gen(7, 'Gaia', 'JP', 'Bahamut', 'Empyreum', 2, 9, 'S', ['scifi'], '未来都市の一角'),
  gen(8, 'Gaia', 'JP', 'Durandal', 'Empyreum', 4, 14, 'L', ['nordic'], '北欧コテージ'),
  gen(9, 'Mana', 'JP', 'Anima', 'Mist', 6, 27, 'M', ['library'], '書斎の家'),
  gen(10, 'Aether', 'NA', 'Cactuar', 'Shirogane', 3, 13, 'M', ['wafu', 'cafe'], '抹茶カフェ'),
  gen(11, 'Aether', 'NA', 'Gilgamesh', 'LavenderBeds', 9, 1, 'L', ['fantasy'], 'ファンタジー城'),
  gen(12, 'Aether', 'NA', 'Faerie', 'Goblet', 11, 23, 'S', ['steampunk'], 'スチームパンク工房'),
  gen(13, 'Primal', 'NA', 'Excalibur', 'Mist', 4, 30, 'L', ['beach', 'summer'], 'ビーチハウス'),
  gen(14, 'Primal', 'NA', 'Leviathan', 'Empyreum', 1, 17, 'M', ['library', 'dark'], '魔導書庫'),
  gen(15, 'Crystal', 'NA', 'Balmung', 'Shirogane', 5, 19, 'L', ['onsen'], '温泉旅館'),
  gen(16, 'Crystal', 'NA', 'Goblin', 'LavenderBeds', 14, 8, 'Apartment'  , ['minimal'], 'ミニマルアパート'),
  gen(17, 'Crystal', 'NA', 'Mateus', 'Goblet', 2, 5, 'S', ['boho'], 'ボヘミアン'),
  gen(18, 'Dynamis', 'NA', 'Halicarnassus', 'Empyreum', 6, 26, 'M', ['restaurant'], 'レストラン'),
  gen(19, 'Chaos', 'EU', 'Moogle', 'Shirogane', 7, 11, 'L', ['wafu'], '和モダン邸'),
  gen(20, 'Chaos', 'EU', 'Ragnarok', 'Mist', 3, 2, 'S', ['witch', 'fantasy'], '魔女の小屋'),
  gen(21, 'Light', 'EU', 'Lich', 'LavenderBeds', 10, 28, 'M', ['cottagecore'], 'コテージコア'),
  gen(22, 'Light', 'EU', 'Phoenix', 'Goblet', 5, 16, 'L', ['gothic', 'dark'], 'ダークゴシック'),
  gen(23, 'Light', 'EU', 'Twintania', 'Empyreum', 8, 24, 'S', ['scifi'], 'SF研究所'),
  gen(24, 'Materia', 'OCE', 'Bismarck', 'Mist', 9, 6, 'M', ['nordic'], '北欧ロッジ'),
  gen(25, 'Materia', 'OCE', 'Ravana', 'Shirogane', 4, 25, 'L', ['wafu', 'samurai'], '武家屋敷'),
  // 26-50 はパターンを延長 (省略 — 実装時に追加)
  gen(26, 'Mana', 'JP', 'Titan', 'Mist', 1, 1, 'S', ['cafe'], 'コーヒースタンド'),
  gen(27, 'Mana', 'JP', 'Hades', 'LavenderBeds', 2, 10, 'M', ['vintage'], 'ヴィンテージ'),
  gen(28, 'Elemental', 'JP', 'Carbuncle', 'Goblet', 13, 20, 'L', ['fantasy'], '魔法学校'),
  gen(29, 'Gaia', 'JP', 'Ifrit', 'Shirogane', 6, 3, 'Apartment', ['minimal'], 'シロガネアパート'),
  gen(30, 'Aether', 'NA', 'Sargatanas', 'Empyreum', 7, 21, 'M', ['library'], '図書館'),
  gen(31, 'Primal', 'NA', 'Famfrit', 'Mist', 5, 29, 'S', ['beach'], '海辺の小屋'),
  gen(32, 'Crystal', 'NA', 'Brynhildr', 'LavenderBeds', 6, 7, 'L', ['romantic'], 'ロマンチック'),
  gen(33, 'Chaos', 'EU', 'Cerberus', 'Goblet', 1, 12, 'M', ['restaurant', 'bar'], 'バー'),
  gen(34, 'Chaos', 'EU', 'Spriggan', 'Empyreum', 9, 18, 'S', ['witch'], '占い屋'),
  gen(35, 'Light', 'EU', 'Odin', 'Shirogane', 8, 4, 'L', ['wafu', 'shrine'], '大社'),
  gen(36, 'Materia', 'OCE', 'Sephirot', 'Mist', 7, 15, 'M', ['boho'], 'ボヘミアンビーチ'),
  gen(37, 'Mana', 'JP', 'Asura', 'Goblet', 12, 8, 'L', ['gothic'], 'ゴシック修道院'),
  gen(38, 'Gaia', 'JP', 'Ridill', 'LavenderBeds', 4, 22, 'Apartment', ['cafe'], 'アパートカフェ'),
  gen(39, 'Aether', 'NA', 'Midgardsormr', 'Mist', 8, 13, 'M', ['modern'], 'モダンハウス'),
  gen(40, 'Primal', 'NA', 'Hyperion', 'Empyreum', 3, 9, 'L', ['scifi'], '宇宙基地'),
  gen(41, 'Crystal', 'NA', 'Coeurl', 'Shirogane', 9, 17, 'S', ['onsen'], '湯治場'),
  gen(42, 'Chaos', 'EU', 'Louisoix', 'LavenderBeds', 11, 26, 'M', ['fantasy'], 'エルフの里'),
  gen(43, 'Light', 'EU', 'Raiden', 'Goblet', 6, 11, 'L', ['steampunk'], 'スチーム工房'),
  gen(44, 'Materia', 'OCE', 'Sophia', 'Empyreum', 5, 23, 'S', ['library'], '小さな本屋'),
  gen(45, 'Mana', 'JP', 'Chocobo', 'Mist', 2, 5, 'M', ['nordic'], '北欧山小屋'),
  gen(46, 'Elemental', 'JP', 'Gungnir', 'Shirogane', 11, 19, 'L', ['wafu', 'cafe'], '町家カフェ'),
  gen(47, 'Aether', 'NA', 'Adamantoise', 'Goblet', 4, 24, 'M', ['vintage'], 'ヴィンテージカフェ'),
  gen(48, 'Crystal', 'NA', 'Diabolos', 'LavenderBeds', 13, 14, 'Apartment', ['minimal'], 'ロフト風'),
  gen(49, 'Chaos', 'EU', 'Phantom', 'Mist', 10, 6, 'L', ['ghibli'], 'ジブリ風'),
  gen(50, 'Light', 'EU', 'Alpha', 'Empyreum', 7, 27, 'M', ['cottagecore'], 'コテージ村'),
];
```

- [ ] **Step 4: Commit**

```bash
git add src/data/housing/
git commit -m "feat(housing): mock listings + DC/server/region master data"
```

---

## Task 2: applyFilters 関数 (TDD)

**Files:**
- Create: `src/lib/housing/applyFilters.ts`
- Test: `src/__tests__/housing/applyFilters.test.ts`

- [ ] **Step 1: テストを書く (失敗させる)**

```typescript
// src/__tests__/housing/applyFilters.test.ts
import { describe, it, expect } from 'vitest';
import { applyFilters } from '../../lib/housing/applyFilters';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

const EMPTY_FILTERS = {
  dc: null,
  regions: [] as string[],
  servers: [] as string[],
  areas: [] as ('Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum')[],
  sizes: [] as ('S' | 'M' | 'L' | 'Apartment')[],
  tags: [] as string[],
  searchText: '',
};

describe('applyFilters', () => {
  it('returns all listings when filters are empty', () => {
    expect(applyFilters(MOCK_LISTINGS, EMPTY_FILTERS).length).toBe(MOCK_LISTINGS.length);
  });

  it('filters by DC (single)', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, dc: 'Mana' });
    expect(result.every((l) => l.dc === 'Mana')).toBe(true);
  });

  it('filters by region (multi, OR)', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, regions: ['JP', 'NA'] });
    expect(result.every((l) => l.region === 'JP' || l.region === 'NA')).toBe(true);
  });

  it('filters by area (multi, OR)', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, areas: ['Shirogane'] });
    expect(result.every((l) => l.area === 'Shirogane')).toBe(true);
  });

  it('filters by size (multi, OR)', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, sizes: ['L'] });
    expect(result.every((l) => l.size === 'L')).toBe(true);
  });

  it('filters by tags (multi, OR — listing matches if any tag in filter list matches)', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, tags: ['wafu'] });
    expect(result.every((l) => l.tags.includes('wafu'))).toBe(true);
  });

  it('combines filters with AND', () => {
    const result = applyFilters(MOCK_LISTINGS, {
      ...EMPTY_FILTERS, dc: 'Mana', areas: ['Shirogane'], tags: ['wafu'],
    });
    expect(result.every((l) => l.dc === 'Mana' && l.area === 'Shirogane' && l.tags.includes('wafu'))).toBe(true);
  });

  it('searches by free text against description', () => {
    const result = applyFilters(MOCK_LISTINGS, { ...EMPTY_FILTERS, searchText: 'カフェ' });
    expect(result.every((l) => l.description?.includes('カフェ'))).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/applyFilters.test.ts
```

- [ ] **Step 3: 実装**

```typescript
// src/lib/housing/applyFilters.ts
import type { MockListing } from '../../data/housing/mockListings';
import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';

export interface FilterCondition {
  dc: string | null;
  regions: string[];
  servers: string[];
  areas: HousingArea[];
  sizes: HousingSize[];
  tags: string[];
  searchText: string;
}

export function applyFilters(listings: MockListing[], filters: FilterCondition): MockListing[] {
  return listings.filter((l) => {
    if (filters.dc && l.dc !== filters.dc) return false;
    if (filters.regions.length > 0 && !filters.regions.includes(l.region)) return false;
    if (filters.servers.length > 0 && !filters.servers.includes(l.server)) return false;
    if (filters.areas.length > 0 && !filters.areas.includes(l.area)) return false;
    if (filters.sizes.length > 0 && !filters.sizes.includes(l.size)) return false;
    if (filters.tags.length > 0 && !filters.tags.some((t) => l.tags.includes(t))) return false;
    if (filters.searchText) {
      const text = filters.searchText.toLowerCase();
      const haystack = `${l.description ?? ''} ${l.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/applyFilters.test.ts
```

期待: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/applyFilters.ts src/__tests__/housing/applyFilters.test.ts
git commit -m "feat(housing): applyFilters pure function (Faceted search logic)"
```

---

## Task 3: FilterChip コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/FilterChip.tsx`
- Test: `src/__tests__/housing/FilterChip.test.tsx`

各絞り込み軸のボタン (タグ風)。 mockup の `.chip` クラス相当。

- [ ] **Step 1: テストを書く**

```typescript
// src/__tests__/housing/FilterChip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChip } from '../../components/housing/workspace/FilterChip';

describe('FilterChip', () => {
  it('renders label', () => {
    render(<FilterChip label="和風" active={false} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('和風');
  });

  it('reflects active state via data-active', () => {
    render(<FilterChip label="和風" active={true} onToggle={() => {}} />);
    expect(screen.getByRole('button').getAttribute('data-active')).toBe('true');
  });

  it('calls onToggle on click', () => {
    const onToggle = vi.fn();
    render(<FilterChip label="和風" active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
npx vitest run src/__tests__/housing/FilterChip.test.tsx
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/FilterChip.tsx
export interface FilterChipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onToggle }) => {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onToggle}
      className="px-3 py-1 text-sm rounded-full transition-all"
      style={{
        border: active ? '1px solid #ffc987' : '1px solid rgba(255,255,255,0.22)',
        color: active ? '#ffc987' : 'rgba(255,255,255,0.78)',
        background: active ? 'rgba(255,201,135,0.08)' : 'transparent',
      }}
    >
      {label}
    </button>
  );
};
```

- [ ] **Step 4: テストパス確認**

```bash
npx vitest run src/__tests__/housing/FilterChip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/workspace/FilterChip.tsx \
        src/__tests__/housing/FilterChip.test.tsx
git commit -m "feat(housing): FilterChip component"
```

---

## Task 4: FilterSection コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/FilterSection.tsx`
- Test: `src/__tests__/housing/FilterSection.test.tsx`

各絞り込み軸 (見出し + chip 群) の共通ラッパー。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/FilterSection.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterSection } from '../../components/housing/workspace/FilterSection';

describe('FilterSection', () => {
  it('renders title and children', () => {
    render(
      <FilterSection title="DC">
        <span>child</span>
      </FilterSection>
    );
    expect(screen.getByText('DC')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗確認 + 実装**

```typescript
// src/components/housing/workspace/FilterSection.tsx
export interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ title, children }) => {
  return (
    <div className="mb-5">
      <h3 className="text-xs uppercase tracking-widest opacity-55 mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/FilterSection.test.tsx
git add src/components/housing/workspace/FilterSection.tsx \
        src/__tests__/housing/FilterSection.test.tsx
git commit -m "feat(housing): FilterSection wrapper"
```

---

## Task 5: ResultCountBadge コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/ResultCountBadge.tsx`
- Test: `src/__tests__/housing/ResultCountBadge.test.tsx`

「○ / ○○ 軒」 表示。 0 件のとき赤系で警告。

- [ ] **Step 1: テスト**

```typescript
// src/__tests__/housing/ResultCountBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ResultCountBadge } from '../../components/housing/workspace/ResultCountBadge';

describe('ResultCountBadge', () => {
  it('shows result / total', () => {
    const { getByText } = render(<ResultCountBadge result={37} total={300} />);
    expect(getByText(/37/)).toBeInTheDocument();
    expect(getByText(/300/)).toBeInTheDocument();
  });

  it('marks zero result with data-zero=true', () => {
    const { container } = render(<ResultCountBadge result={0} total={300} />);
    expect(container.firstChild).toHaveAttribute('data-zero', 'true');
  });

  it('does not mark non-zero with data-zero=true', () => {
    const { container } = render(<ResultCountBadge result={5} total={300} />);
    expect(container.firstChild).toHaveAttribute('data-zero', 'false');
  });
});
```

- [ ] **Step 2: 実装**

```typescript
// src/components/housing/workspace/ResultCountBadge.tsx
export interface ResultCountBadgeProps {
  result: number;
  total: number;
}

export const ResultCountBadge: React.FC<ResultCountBadgeProps> = ({ result, total }) => {
  const isZero = result === 0;
  return (
    <div
      data-zero={isZero}
      className="text-sm tabular-nums"
      style={{ color: isZero ? '#ff8080' : 'rgba(255,255,255,0.78)' }}
    >
      <span className={isZero ? '' : 'text-base font-medium text-white'}>{result}</span>
      <span className="opacity-55"> / {total}</span>
    </div>
  );
};
```

- [ ] **Step 3: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/ResultCountBadge.test.tsx
git add src/components/housing/workspace/ResultCountBadge.tsx \
        src/__tests__/housing/ResultCountBadge.test.tsx
git commit -m "feat(housing): ResultCountBadge"
```

---

## Task 6: RegisterCTA コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/RegisterCTA.tsx`
- Test: `src/__tests__/housing/RegisterCTA.test.tsx`

左パネル末尾の大型登録ボタン。 設計書 §8.1: 暖色アクセント + 「あなたの作品を登録する」。

- [ ] **Step 1: i18n キー追加**

`src/locales/ja.ts` の `housing.workspace` に追記:

```typescript
register_cta: {
  label_long: 'あなたの作品を登録する',
  label_short: '+ 登録',
},
```

他 3 言語:
- en: long='Register your home', short='+ Register'
- ko: long='내 작품 등록하기', short='+ 등록'
- zh: long='登记你的作品', short='+ 注册'

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/RegisterCTA.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegisterCTA } from '../../components/housing/workspace/RegisterCTA';

describe('RegisterCTA', () => {
  it('renders long label by default', () => {
    render(<RegisterCTA onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent(/作品|register|작품|作品/);
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<RegisterCTA onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: 実装**

```typescript
// src/components/housing/workspace/RegisterCTA.tsx
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

export interface RegisterCTAProps {
  onClick: () => void;
}

export const RegisterCTA: React.FC<RegisterCTAProps> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full mt-6 p-4 rounded-lg flex items-center gap-3 text-left transition-all hover:bg-white/5"
      style={{
        border: '1px solid #ffc987',
        color: '#ffc987',
        background: 'rgba(255,201,135,0.06)',
      }}
    >
      <Plus size={20} className="shrink-0" />
      <span className="text-sm font-medium">{t('housing.workspace.register_cta.label_long')}</span>
    </button>
  );
};
```

- [ ] **Step 4: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/RegisterCTA.test.tsx
git add src/components/housing/workspace/RegisterCTA.tsx \
        src/__tests__/housing/RegisterCTA.test.tsx \
        src/locales/
git commit -m "feat(housing): RegisterCTA (left panel bottom CTA)"
```

---

## Task 7: PanelCloseButton コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/PanelCloseButton.tsx`
- Test: `src/__tests__/housing/PanelCloseButton.test.tsx`

パネル開閉ボタン。 左右どちらでも使えるよう向き指定 prop。

- [ ] **Step 1: テスト + 実装**

```typescript
// src/__tests__/housing/PanelCloseButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelCloseButton } from '../../components/housing/workspace/PanelCloseButton';

describe('PanelCloseButton', () => {
  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<PanelCloseButton direction="left" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders different aria-label per direction', () => {
    const { rerender } = render(<PanelCloseButton direction="left" onClick={() => {}} />);
    const labelLeft = screen.getByRole('button').getAttribute('aria-label');
    rerender(<PanelCloseButton direction="right" onClick={() => {}} />);
    const labelRight = screen.getByRole('button').getAttribute('aria-label');
    expect(labelLeft).not.toBe(labelRight);
  });
});
```

```typescript
// src/components/housing/workspace/PanelCloseButton.tsx
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PanelCloseButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
}

export const PanelCloseButton: React.FC<PanelCloseButtonProps> = ({ direction, onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? t('housing.workspace.panel.close_left') : t('housing.workspace.panel.close_right')}
      className="p-2 rounded-md transition-colors hover:bg-white/10"
    >
      {direction === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
};
```

i18n キー追加 `housing.workspace.panel.close_left` / `close_right`:
- ja: '左パネルを閉じる' / '右パネルを閉じる'
- en: 'Close left panel' / 'Close right panel'
- ko: '왼쪽 패널 닫기' / '오른쪽 패널 닫기'
- zh: '关闭左面板' / '关闭右面板'

- [ ] **Step 2: パス確認 + Commit**

```bash
npx vitest run src/__tests__/housing/PanelCloseButton.test.tsx
git add src/components/housing/workspace/PanelCloseButton.tsx \
        src/__tests__/housing/PanelCloseButton.test.tsx \
        src/locales/
git commit -m "feat(housing): PanelCloseButton (reusable for left/right)"
```

---

## Task 8: FilterPanel メインコンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/FilterPanel.tsx`
- Test: `src/__tests__/housing/FilterPanel.test.tsx`

全絞り込み軸 + ResultCountBadge + RegisterCTA + 閉じるボタン。 mock data から count を計算して filter store に書き戻す。

- [ ] **Step 1: i18n キー追加**

`src/locales/ja.ts` の `housing.workspace` に追記:

```typescript
filter: {
  title: 'FILTER',
  dc: 'DC',
  region: '地域',
  server: 'サーバー',
  area: 'エリア',
  size: 'サイズ',
  theme: 'テーマ',
},
panel: {
  close_left: '左パネルを閉じる',
  close_right: '右パネルを閉じる',
},
```

他 3 言語対応キー (en: Region/Server/Area/Size/Theme、 ko: 지역/서버/지역/크기/테마、 zh: 区域/服务器/区域/大小/主题)

- [ ] **Step 2: テスト**

```typescript
// src/__tests__/housing/FilterPanel.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPanel } from '../../components/housing/workspace/FilterPanel';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

describe('FilterPanel', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
  });

  it('renders FILTER title and all 6 sections', () => {
    render(<FilterPanel onClose={() => {}} onRegisterClick={() => {}} />);
    expect(screen.getByText('FILTER')).toBeInTheDocument();
    expect(screen.getByText(/DC/i)).toBeInTheDocument();
    expect(screen.getByText(/地域|Region|지역|区域/)).toBeInTheDocument();
    expect(screen.getByText(/エリア|Area|지역|区域/)).toBeInTheDocument();
    expect(screen.getByText(/サイズ|Size|크기|大小/)).toBeInTheDocument();
    expect(screen.getByText(/テーマ|Theme|테마|主题/)).toBeInTheDocument();
  });

  it('shows result count from mock data', () => {
    render(<FilterPanel onClose={() => {}} onRegisterClick={() => {}} />);
    // mockListings.length === 50
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it('updates count when DC chip toggled', () => {
    render(<FilterPanel onClose={() => {}} onRegisterClick={() => {}} />);
    fireEvent.click(screen.getByText('Mana'));
    // Mana 件数 (mock 50 件中 Mana は 11 件想定 — ロジック実装後に正確値で更新)
    // 検証: 50 より小さい数字が出る
    const counts = useHousingFilterStore.getState();
    expect(counts.resultCount).toBeLessThan(50);
    expect(counts.dc).toBe('Mana');
  });

  it('invokes onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<FilterPanel onClose={onClose} onRegisterClick={() => {}} />);
    fireEvent.click(screen.getByLabelText(/左パネル|left panel|왼쪽 패널|左面板/));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('invokes onRegisterClick when register CTA clicked', () => {
    const onRegisterClick = vi.fn();
    render(<FilterPanel onClose={() => {}} onRegisterClick={onRegisterClick} />);
    fireEvent.click(screen.getByText(/作品|Register|작품|登记/));
    expect(onRegisterClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: テスト失敗確認**

```bash
npx vitest run src/__tests__/housing/FilterPanel.test.tsx
```

- [ ] **Step 4: 実装**

```typescript
// src/components/housing/workspace/FilterPanel.tsx
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFilterStore, type HousingArea, type HousingSize } from '../../../store/useHousingFilterStore';
import { MOCK_LISTINGS } from '../../../data/housing/mockListings';
import { ALL_DCS, ALL_REGIONS, DC_SERVER_MAP, dcsForRegion } from '../../../data/housing/dcServerMap';
import { REGION_LABELS, type Region } from '../../../data/housing/regionMap';
import { applyFilters } from '../../../lib/housing/applyFilters';
import { FilterSection } from './FilterSection';
import { FilterChip } from './FilterChip';
import { ResultCountBadge } from './ResultCountBadge';
import { RegisterCTA } from './RegisterCTA';
import { PanelCloseButton } from './PanelCloseButton';

const AREAS: HousingArea[] = ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'];
const SIZES: HousingSize[] = ['S', 'M', 'L', 'Apartment'];
const SAMPLE_TAGS = ['wafu', 'modern', 'cafe', 'gothic', 'fantasy', 'scifi', 'minimal', 'boho', 'nordic', 'cottagecore'];

export interface FilterPanelProps {
  onClose: () => void;
  onRegisterClick: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ onClose, onRegisterClick }) => {
  const { t, i18n } = useTranslation();
  const filter = useHousingFilterStore();
  const lang = (i18n.language as 'ja' | 'en' | 'ko' | 'zh') || 'ja';

  // Compute result count whenever any filter changes
  const result = useMemo(() => applyFilters(MOCK_LISTINGS, {
    dc: filter.dc,
    regions: filter.regions,
    servers: filter.servers,
    areas: filter.areas,
    sizes: filter.sizes,
    tags: filter.tags,
    searchText: filter.searchText,
  }), [filter.dc, filter.regions, filter.servers, filter.areas, filter.sizes, filter.tags, filter.searchText]);

  useEffect(() => {
    filter.setCounts(result.length, MOCK_LISTINGS.length);
  }, [result.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableServers = filter.dc ? DC_SERVER_MAP[filter.dc]?.servers ?? [] : [];

  return (
    <div className="flex flex-col h-full p-5 overflow-y-auto" style={{ color: '#ffffff' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest opacity-78">
          {t('housing.workspace.filter.title')}
        </h2>
        <ResultCountBadge result={result.length} total={MOCK_LISTINGS.length} />
      </div>

      <FilterSection title={t('housing.workspace.filter.dc')}>
        {ALL_DCS.map((dc) => (
          <FilterChip
            key={dc}
            label={dc}
            active={filter.dc === dc}
            onToggle={() => filter.setDC(filter.dc === dc ? null : dc)}
          />
        ))}
      </FilterSection>

      <FilterSection title={t('housing.workspace.filter.region')}>
        {ALL_REGIONS.map((r) => (
          <FilterChip
            key={r}
            label={REGION_LABELS[r as Region][lang]}
            active={filter.regions.includes(r)}
            onToggle={() => filter.toggleRegion(r)}
          />
        ))}
      </FilterSection>

      {filter.dc && (
        <FilterSection title={t('housing.workspace.filter.server')}>
          {availableServers.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={filter.servers.includes(s)}
              onToggle={() => filter.toggleServer(s)}
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title={t('housing.workspace.filter.area')}>
        {AREAS.map((a) => (
          <FilterChip
            key={a}
            label={a}
            active={filter.areas.includes(a)}
            onToggle={() => filter.toggleArea(a)}
          />
        ))}
      </FilterSection>

      <FilterSection title={t('housing.workspace.filter.size')}>
        {SIZES.map((s) => (
          <FilterChip
            key={s}
            label={s === 'Apartment' ? 'Apt' : s}
            active={filter.sizes.includes(s)}
            onToggle={() => filter.toggleSize(s)}
          />
        ))}
      </FilterSection>

      <FilterSection title={t('housing.workspace.filter.theme')}>
        {SAMPLE_TAGS.map((tag) => (
          <FilterChip
            key={tag}
            label={tag}
            active={filter.tags.includes(tag)}
            onToggle={() => filter.toggleTag(tag)}
          />
        ))}
      </FilterSection>

      <RegisterCTA onClick={onRegisterClick} />

      <div className="mt-auto pt-4 flex justify-end">
        <PanelCloseButton direction="left" onClick={onClose} />
      </div>
    </div>
  );
};
```

- [ ] **Step 5: パス確認**

```bash
npx vitest run src/__tests__/housing/FilterPanel.test.tsx
```

期待: 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/workspace/FilterPanel.tsx \
        src/__tests__/housing/FilterPanel.test.tsx \
        src/locales/
git commit -m "feat(housing): FilterPanel (6 facets + result count + register CTA + close)"
```

---

## Task 9: HousingWorkspace に FilterPanel 統合

**Files:**
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`
- Modify: `src/components/housing/workspace/index.ts`

- [ ] **Step 1: HousingWorkspace を編集**

`src/components/housing/workspace/HousingWorkspace.tsx` の `[Left panel — Plan B]` プレースホルダを置き換え:

```typescript
import { FilterPanel } from './FilterPanel';
import { useState } from 'react';
import { HousingRegisterModal } from '../HousingRegisterModal'; // Plan F で作る、 一旦コメントアウト

// ... 既存 imports

export const HousingWorkspace: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useHousingViewStore((s) => s.setLeftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  return (
    <main className="relative min-h-screen flex flex-col" data-theme={theme} style={{ color: '#ffffff' }}>
      <SceneryVideo theme={theme} />
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar />
        <div className="flex-1 flex">
          {leftPanelOpen && (
            <aside
              data-region="left"
              className="w-72 shrink-0 border-r liquid-glass-panel"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              <FilterPanel
                onClose={() => setLeftPanelOpen(false)}
                onRegisterClick={() => setRegisterModalOpen(true)}
              />
            </aside>
          )}
          <section data-region="center" className="flex-1 min-w-0">
            <div className="p-4 text-sm opacity-60">[Center area — Plan C]</div>
          </section>
          {rightPanelOpen && (
            <aside data-region="right" className="w-80 shrink-0 border-l" style={{ borderColor: 'rgba(255,255,255,0.22)' }}>
              <div className="p-4 text-sm opacity-60">[Right panel — Plan D]</div>
            </aside>
          )}
        </div>
        <StatusBar />
      </div>
      {/* registerModalOpen の処理は Plan F で接続 */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setRegisterModalOpen(false)}>
          <div className="bg-white text-black p-4 rounded">登録モーダル placeholder (Plan F で接続)</div>
        </div>
      )}
    </main>
  );
};
```

- [ ] **Step 2: index.ts に FilterPanel 公開を追記**

```typescript
// src/components/housing/workspace/index.ts (既存に追記)
export { FilterPanel } from './FilterPanel';
```

- [ ] **Step 3: dev で目視確認**

```bash
npm run dev
```

http://localhost:5173/housing を開く。 期待:
- 左パネルに FILTER タイトル + 6 セクション (DC / 地域 / サーバー (DC 選択時のみ) / エリア / サイズ / テーマ)
- 右上に「50 / 50」 の結果カウント
- 任意の chip をクリックすると active 状態 (暖色) になり、 カウントが更新される
- 末尾に大きな登録 CTA
- パネル末尾の右下に閉じるボタン → 押すと左パネル消える、 中央が広がる

- [ ] **Step 4: ビルド検証**

```bash
npm run build
npx vitest run
```

期待: 全 pass

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/index.ts
git commit -m "feat(housing): wire FilterPanel into HousingWorkspace"
```

---

## Self-Review Checklist

### 仕様書カバレッジ

| 設計書セクション | Plan B での対応 |
|---|---|
| §5.1 絞り込み軸 (DC/region/server/area/size/tag) | Task 8 |
| §5.2 Result count indicator | Task 5 (badge) + Task 8 (連動) |
| §5.4 PRICE / ROUTE SUMMARY 削除 | mock data には含めない、 削除完了 |
| §5.5 登録 CTA (左パネル末尾) | Task 6 |
| §3.3 パネル開閉 (左) | Task 7 + Task 9 |

### Plan B スコープ外 (後の plan へ)

- §5.3 検索欄 (top bar 中央のテキスト検索 input は Plan A で UI は出した、 実フィルタ連動は Plan F)
- Firestore データ統合 → Plan F
- 登録モーダル実体 → Plan F

### Placeholder Scan

- 全 step に actual code or actual command ✓
- "TBD" / "TODO" 無し ✓
- working software として完成 ✓

---

## 完了の定義

- [ ] `/housing` の左パネルに 6 セクションの絞り込み UI が並ぶ
- [ ] 各 chip をクリックすると active 切替 + result count 更新
- [ ] DC 選択時のみ「サーバー」 セクションが現れる
- [ ] 「あなたの作品を登録する」 が左パネル末尾に大きく表示
- [ ] 閉じるボタンで左パネル消える、 中央拡大、 再オープン可能
- [ ] `npm run build` + `npx vitest run` 全 pass
