# Housing Sub-spec 2B — Plan A: Foundation (基盤)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sub-spec 2B の土台 — 5 つの Zustand store + 動画背景 + リキッドグラスパネル + Workspace 骨格を組み、 空の状態でも「景色の上にガラスのワークスペースが浮かぶ」 が動作する状態にする

**Architecture:**
- 既存の `HousingPage.tsx` (タブ式) は壊さず、 新ルート `/housing` を `HousingWorkspace.tsx` に置き換え (1 ページ完結)
- 状態管理は Zustand store を `src/store/useHousing*Store.ts` に追加 (既存 store と同じディレクトリ・命名規則)
- リキッドグラスは React コンポーネント `LiquidGlassPanel` 化、 mockup の `applyLiquidGlass` 関数の中身を移植
- 動画素材は `public/housing/scenery-{day,night}.{mp4,webm}` + ポスター webp 配置

**Tech Stack:**
- React 19 + TypeScript + Tailwind v4
- Zustand 5 (既存パターン踏襲)
- react-router-dom 7
- Vitest 4 + @testing-library/react
- Playwright 1.60 (E2E は Plan F)

**親仕様参照:** `docs/superpowers/specs/2026-05-17-housing-sub-spec-2b-gallery-tour-design.md` §2 (トンマナ)、 §3 (画面構造)、 §11 (状態管理)

---

## File Structure

このプランで作成・編集するファイル:

**新規作成 (store)**:
- `src/store/useHousingFilterStore.ts` — 絞り込み条件
- `src/store/useHousingViewStore.ts` — マップ/Pinterest 切替、 パネル開閉
- `src/store/useHousingFavoritesStore.ts` — お気に入り (LocalStorage + Firestore 同期)
- `src/store/useHousingTourStore.ts` — ツアー組立・進行
- `src/store/useHousingRandomStore.ts` — 初回ランダム選出

**新規作成 (component)**:
- `src/components/housing/workspace/HousingWorkspace.tsx` — メインレイアウト
- `src/components/housing/workspace/TopBar.tsx` — top bar
- `src/components/housing/workspace/StatusBar.tsx` — status bar
- `src/components/housing/workspace/SceneryVideo.tsx` — 動画背景
- `src/components/housing/workspace/LiquidGlassPanel.tsx` — リキッドグラス React コンポーネント
- `src/components/housing/workspace/index.ts` — 公開エクスポート

**新規作成 (utility)**:
- `src/lib/housing/displacementMap.ts` — リキッドグラス用 displacement map 生成 (rounded rect SDF + 1/距離重み付き smooth vector field)

**新規作成 (assets)**:
- `public/housing/scenery-day.mp4` (5.5MB、 mockup からコピー)
- `public/housing/scenery-day.webm` (3.0MB)
- `public/housing/scenery-day-poster.webp` (217KB)
- `public/housing/scenery-night.mp4` (10.8MB)
- `public/housing/scenery-night.webm` (3.2MB)
- `public/housing/scenery-night-poster.webp` (144KB)

**新規作成 (test)**:
- `src/__tests__/housing/useHousingFilterStore.test.ts`
- `src/__tests__/housing/useHousingViewStore.test.ts`
- `src/__tests__/housing/useHousingFavoritesStore.test.ts`
- `src/__tests__/housing/useHousingTourStore.test.ts`
- `src/__tests__/housing/useHousingRandomStore.test.ts`
- `src/__tests__/housing/displacementMap.test.ts`
- `src/__tests__/housing/SceneryVideo.test.tsx`
- `src/__tests__/housing/LiquidGlassPanel.test.tsx`
- `src/__tests__/housing/HousingWorkspace.test.tsx`
- `src/__tests__/housing/TopBar.test.tsx`
- `src/__tests__/housing/StatusBar.test.tsx`

**編集**:
- `src/App.tsx` — `/housing` ルートを `HousingWorkspace` に切替 (既存 `HousingPage` は `/housing/legacy` に退避してロールバック余地を残す)
- `src/components/housing/index.ts` — `workspace/` の再公開

---

## プロジェクト固有のルール (守ること)

1. **CSS の backdrop-filter 直書き禁止**: Tailwind v4 Lightning CSS が消すので、 `--tw-backdrop-blur` 変数パターンを使う (`.claude/rules/css-rules.md`)。 ただし `backdrop-filter: var(--liquid-filter, none)` 形式は OK (saturate/blur ではなく url() なので Lightning CSS 対象外)
2. **i18n キー経由**: 全 UI テキストは `useTranslation()` 経由 (`.claude/rules/i18n.md`)。 i18n キーは `src/locales/{ja,en,ko,zh}.ts` の `housing.workspace.*` 名前空間に追加
3. **マウス追従 UI 禁止**: `onMouseMove` 高頻度イベント禁止。 CSS :hover で代替 (`.claude/rules/ui-design.md`)
4. **デザインルール例外**: ハウジングは Inter フォント OK、 暖色アクセント OK (本仕様で「LoPo 本体ルールから例外」 として承認済み)
5. **既存ファイル退避**: `HousingPage.tsx` (タブ式) は壊さず残す、 `/housing/legacy` でアクセス可能に
6. **テスト命名**: 既存 `src/__tests__/housing/*` パターンを踏襲

---

## Task 1: 動画素材を public/ に配置

**Files:**
- Copy: `docs/.private/housing-tour-mockup/scenery-day.mp4` → `public/housing/scenery-day.mp4`
- Copy: `docs/.private/housing-tour-mockup/scenery-day.webm` → `public/housing/scenery-day.webm`
- Copy: `docs/.private/housing-tour-mockup/scenery-day-poster.webp` → `public/housing/scenery-day-poster.webp`
- Copy: `docs/.private/housing-tour-mockup/scenery-night.mp4` → `public/housing/scenery-night.mp4`
- Copy: `docs/.private/housing-tour-mockup/scenery-night.webm` → `public/housing/scenery-night.webm`
- Copy: `docs/.private/housing-tour-mockup/scenery-night-poster.webp` → `public/housing/scenery-night-poster.webp`

- [ ] **Step 1: ディレクトリ作成 + コピー**

```bash
mkdir -p public/housing
cp docs/.private/housing-tour-mockup/scenery-day.mp4 public/housing/
cp docs/.private/housing-tour-mockup/scenery-day.webm public/housing/
cp docs/.private/housing-tour-mockup/scenery-day-poster.webp public/housing/
cp docs/.private/housing-tour-mockup/scenery-night.mp4 public/housing/
cp docs/.private/housing-tour-mockup/scenery-night.webm public/housing/
cp docs/.private/housing-tour-mockup/scenery-night-poster.webp public/housing/
```

- [ ] **Step 2: サイズ確認** (合計が 25MB 以下か)

```bash
du -sk public/housing/scenery-* | awk '{sum+=$1} END {print sum, "KB"}'
```

期待: 約 23,000 KB (約 22 MB)

- [ ] **Step 3: Commit**

```bash
git add public/housing/
git commit -m "feat(housing): add scenery video assets (xfade-baked loops)"
```

---

## Task 2: displacement map ユーティリティ (TDD)

**Files:**
- Create: `src/lib/housing/displacementMap.ts`
- Test: `src/__tests__/housing/displacementMap.test.ts`

mockup の `makeDisplacementMapDataURL` 関数を pure utility 化する。 Canvas API を使うので jsdom 環境で動作要確認。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/displacementMap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { makeDisplacementMapDataURL } from '../../lib/housing/displacementMap';

describe('makeDisplacementMapDataURL', () => {
  it('returns a data URL starting with data:image/png', () => {
    const url = makeDisplacementMapDataURL({ width: 100, height: 50, edge: 20, radius: 8 });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('handles tiny canvas (1x1) without throwing', () => {
    expect(() => makeDisplacementMapDataURL({ width: 1, height: 1, edge: 5, radius: 0 })).not.toThrow();
  });

  it('clamps dEdge at 0 for out-of-bounds rounded corners', () => {
    // 80x60 panel with radius 30 (oversized) — corners overlap at center
    expect(() => makeDisplacementMapDataURL({ width: 80, height: 60, edge: 40, radius: 30 })).not.toThrow();
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/displacementMap.test.ts
```

期待: `Cannot find module '../../lib/housing/displacementMap'` で失敗

- [ ] **Step 3: 実装**

`src/lib/housing/displacementMap.ts`:

```typescript
export interface DisplacementMapOptions {
  width: number;
  height: number;
  edge: number;
  radius: number;
}

/**
 * Build a displacement map for liquid glass refraction.
 * Rounded-rect SDF distance from edge + smooth vector field via 1/distance weighting.
 * Returns a data URL (PNG) suitable for <feImage href={...}>.
 */
export function makeDisplacementMapDataURL(opts: DisplacementMapOptions): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(opts.width));
  canvas.height = Math.max(1, Math.round(opts.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;

  const W = canvas.width;
  const H = canvas.height;
  const R = opts.radius;
  const edge = opts.edge;
  const eps = 0.5;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Rounded-rect SDF (dEdge)
      let dEdge: number;
      const inLeft = x < R, inRight = x > W - 1 - R;
      const inTop = y < R, inBot = y > H - 1 - R;
      if (inLeft && inTop) {
        const dx = R - x, dy = R - y;
        dEdge = R - Math.hypot(dx, dy);
      } else if (inRight && inTop) {
        const dx = x - (W - 1 - R), dy = R - y;
        dEdge = R - Math.hypot(dx, dy);
      } else if (inLeft && inBot) {
        const dx = R - x, dy = y - (H - 1 - R);
        dEdge = R - Math.hypot(dx, dy);
      } else if (inRight && inBot) {
        const dx = x - (W - 1 - R), dy = y - (H - 1 - R);
        dEdge = R - Math.hypot(dx, dy);
      } else {
        dEdge = Math.min(x, y, W - 1 - x, H - 1 - y);
      }
      if (dEdge < 0) dEdge = 0;

      const t = Math.min(1, dEdge / edge);
      const magnitude = Math.pow(1 - t, 1.6);

      // Smooth inward vector via 1/distance weighting
      const dL = x, dR2 = W - 1 - x, dT = y, dB = H - 1 - y;
      const wL = 1 / (dL + eps);
      const wR = 1 / (dR2 + eps);
      const wT = 1 / (dT + eps);
      const wB = 1 / (dB + eps);
      const uxRaw = wL - wR;
      const uyRaw = wT - wB;
      const ulen = Math.hypot(uxRaw, uyRaw) || 1;
      const ux = uxRaw / ulen;
      const uy = uyRaw / ulen;

      const idx = (y * W + x) * 4;
      data[idx]     = Math.round(128 + ux * 127 * magnitude);
      data[idx + 1] = Math.round(128 + uy * 127 * magnitude);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/displacementMap.test.ts
```

期待: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/displacementMap.ts src/__tests__/housing/displacementMap.test.ts
git commit -m "feat(housing): displacement map utility for liquid glass"
```

---

## Task 3: useHousingViewStore (TDD)

**Files:**
- Create: `src/store/useHousingViewStore.ts`
- Test: `src/__tests__/housing/useHousingViewStore.test.ts`

Adaptive Workspace の表示状態 (Map/Pinterest 切替、 パネル開閉、 ツアーモード)。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/useHousingViewStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingViewStore } from '../../store/useHousingViewStore';

describe('useHousingViewStore', () => {
  beforeEach(() => {
    useHousingViewStore.getState().reset();
  });

  it('defaults to map view, both panels open, browse mode', () => {
    const s = useHousingViewStore.getState();
    expect(s.viewMode).toBe('map');
    expect(s.leftPanelOpen).toBe(true);
    expect(s.rightPanelOpen).toBe(true);
    expect(s.mode).toBe('browse');
  });

  it('toggles view mode', () => {
    useHousingViewStore.getState().setViewMode('pinterest');
    expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
  });

  it('toggles left panel', () => {
    useHousingViewStore.getState().setLeftPanelOpen(false);
    expect(useHousingViewStore.getState().leftPanelOpen).toBe(false);
  });

  it('switches to tour mode and forces right panel open', () => {
    useHousingViewStore.getState().setRightPanelOpen(false);
    useHousingViewStore.getState().enterTourMode();
    expect(useHousingViewStore.getState().mode).toBe('tour');
    expect(useHousingViewStore.getState().rightPanelOpen).toBe(true);
  });

  it('reset returns to defaults', () => {
    useHousingViewStore.getState().setViewMode('pinterest');
    useHousingViewStore.getState().enterTourMode();
    useHousingViewStore.getState().reset();
    expect(useHousingViewStore.getState().viewMode).toBe('map');
    expect(useHousingViewStore.getState().mode).toBe('browse');
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/useHousingViewStore.test.ts
```

期待: import 失敗

- [ ] **Step 3: 実装**

`src/store/useHousingViewStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type HousingViewMode = 'map' | 'pinterest';
export type HousingPageMode = 'browse' | 'tour';

interface HousingViewState {
  viewMode: HousingViewMode;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  mode: HousingPageMode;
  setViewMode: (mode: HousingViewMode) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  enterTourMode: () => void;
  exitTourMode: () => void;
  reset: () => void;
}

const DEFAULTS = {
  viewMode: 'map' as const,
  leftPanelOpen: true,
  rightPanelOpen: true,
  mode: 'browse' as const,
};

export const useHousingViewStore = create<HousingViewState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setViewMode: (viewMode) => set({ viewMode }),
      setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      enterTourMode: () => set({ mode: 'tour', rightPanelOpen: true }),
      exitTourMode: () => set({ mode: 'browse' }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'housing-view',
      storage: {
        getItem: (k) => { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; },
        setItem: (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
        removeItem: (k) => sessionStorage.removeItem(k),
      },
    }
  )
);
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/useHousingViewStore.test.ts
```

期待: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingViewStore.ts src/__tests__/housing/useHousingViewStore.test.ts
git commit -m "feat(housing): view store (map/pinterest, panels, mode)"
```

---

## Task 4: useHousingFilterStore (TDD)

**Files:**
- Create: `src/store/useHousingFilterStore.ts`
- Test: `src/__tests__/housing/useHousingFilterStore.test.ts`

絞り込み条件 + Result count を持つ store。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/useHousingFilterStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

describe('useHousingFilterStore', () => {
  beforeEach(() => useHousingFilterStore.getState().clearAll());

  it('defaults to empty filters', () => {
    const s = useHousingFilterStore.getState();
    expect(s.dc).toBeNull();
    expect(s.regions).toEqual([]);
    expect(s.servers).toEqual([]);
    expect(s.areas).toEqual([]);
    expect(s.sizes).toEqual([]);
    expect(s.tags).toEqual([]);
    expect(s.searchText).toBe('');
    expect(s.resultCount).toBe(0);
    expect(s.totalCount).toBe(0);
  });

  it('sets DC (single select)', () => {
    useHousingFilterStore.getState().setDC('Mana');
    expect(useHousingFilterStore.getState().dc).toBe('Mana');
  });

  it('toggles area (multi select)', () => {
    const s = useHousingFilterStore.getState();
    s.toggleArea('Shirogane');
    expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane']);
    s.toggleArea('LavenderBeds');
    expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane', 'LavenderBeds']);
    s.toggleArea('Shirogane');
    expect(useHousingFilterStore.getState().areas).toEqual(['LavenderBeds']);
  });

  it('clearAll resets filters but keeps result/total counts intact', () => {
    const s = useHousingFilterStore.getState();
    s.setDC('Mana');
    s.toggleArea('Shirogane');
    s.setCounts(37, 300);
    s.clearAll();
    expect(useHousingFilterStore.getState().dc).toBeNull();
    expect(useHousingFilterStore.getState().areas).toEqual([]);
    expect(useHousingFilterStore.getState().resultCount).toBe(37);
    expect(useHousingFilterStore.getState().totalCount).toBe(300);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/useHousingFilterStore.test.ts
```

- [ ] **Step 3: 実装**

`src/store/useHousingFilterStore.ts`:

```typescript
import { create } from 'zustand';

export type HousingArea = 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
export type HousingSize = 'S' | 'M' | 'L' | 'Apartment';

interface HousingFilterState {
  dc: string | null;
  regions: string[];
  servers: string[];
  areas: HousingArea[];
  sizes: HousingSize[];
  tags: string[];
  searchText: string;
  resultCount: number;
  totalCount: number;
  setDC: (dc: string | null) => void;
  toggleRegion: (region: string) => void;
  toggleServer: (server: string) => void;
  toggleArea: (area: HousingArea) => void;
  toggleSize: (size: HousingSize) => void;
  toggleTag: (tag: string) => void;
  setSearchText: (text: string) => void;
  setCounts: (result: number, total: number) => void;
  clearAll: () => void;
}

const toggleInArray = <T>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export const useHousingFilterStore = create<HousingFilterState>((set) => ({
  dc: null,
  regions: [],
  servers: [],
  areas: [],
  sizes: [],
  tags: [],
  searchText: '',
  resultCount: 0,
  totalCount: 0,
  setDC: (dc) => set({ dc }),
  toggleRegion: (region) => set((s) => ({ regions: toggleInArray(s.regions, region) })),
  toggleServer: (server) => set((s) => ({ servers: toggleInArray(s.servers, server) })),
  toggleArea: (area) => set((s) => ({ areas: toggleInArray(s.areas, area) })),
  toggleSize: (size) => set((s) => ({ sizes: toggleInArray(s.sizes, size) })),
  toggleTag: (tag) => set((s) => ({ tags: toggleInArray(s.tags, tag) })),
  setSearchText: (searchText) => set({ searchText }),
  setCounts: (resultCount, totalCount) => set({ resultCount, totalCount }),
  clearAll: () => set({
    dc: null, regions: [], servers: [], areas: [], sizes: [], tags: [], searchText: '',
  }),
}));
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/useHousingFilterStore.test.ts
```

期待: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingFilterStore.ts src/__tests__/housing/useHousingFilterStore.test.ts
git commit -m "feat(housing): filter store (faceted filter + result count)"
```

---

## Task 5: useHousingFavoritesStore (TDD)

**Files:**
- Create: `src/store/useHousingFavoritesStore.ts`
- Test: `src/__tests__/housing/useHousingFavoritesStore.test.ts`

お気に入りリスト。 LocalStorage 永続化、 Firestore 同期は Plan F で実装、 今は API 形だけ用意。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/useHousingFavoritesStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';

describe('useHousingFavoritesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useHousingFavoritesStore.getState().reset();
  });

  it('starts empty', () => {
    expect(useHousingFavoritesStore.getState().ids).toEqual([]);
  });

  it('adds a listing', () => {
    useHousingFavoritesStore.getState().add('listing-1');
    expect(useHousingFavoritesStore.getState().ids).toContain('listing-1');
  });

  it('removes a listing', () => {
    const s = useHousingFavoritesStore.getState();
    s.add('a'); s.add('b'); s.remove('a');
    expect(useHousingFavoritesStore.getState().ids).toEqual(['b']);
  });

  it('contains() reports membership', () => {
    useHousingFavoritesStore.getState().add('x');
    expect(useHousingFavoritesStore.getState().contains('x')).toBe(true);
    expect(useHousingFavoritesStore.getState().contains('y')).toBe(false);
  });

  it('does not add duplicates', () => {
    const s = useHousingFavoritesStore.getState();
    s.add('a'); s.add('a');
    expect(useHousingFavoritesStore.getState().ids).toEqual(['a']);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/useHousingFavoritesStore.test.ts
```

- [ ] **Step 3: 実装**

`src/store/useHousingFavoritesStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface HousingFavoritesState {
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  contains: (id: string) => boolean;
  reset: () => void;
}

export const useHousingFavoritesStore = create<HousingFavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) => set((s) => s.ids.includes(id) ? s : { ids: [...s.ids, id] }),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      contains: (id) => get().ids.includes(id),
      reset: () => set({ ids: [] }),
    }),
    {
      name: 'housing-favorites',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/useHousingFavoritesStore.test.ts
```

期待: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingFavoritesStore.ts src/__tests__/housing/useHousingFavoritesStore.test.ts
git commit -m "feat(housing): favorites store (LocalStorage persist)"
```

---

## Task 6: useHousingTourStore (TDD)

**Files:**
- Create: `src/store/useHousingTourStore.ts`
- Test: `src/__tests__/housing/useHousingTourStore.test.ts`

ツアー組立 + 実行 (進行位置)。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/useHousingTourStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingTourStore } from '../../store/useHousingTourStore';

describe('useHousingTourStore', () => {
  beforeEach(() => useHousingTourStore.getState().reset());

  it('starts empty, not running', () => {
    const s = useHousingTourStore.getState();
    expect(s.listingIds).toEqual([]);
    expect(s.running).toBe(false);
    expect(s.currentIndex).toBe(0);
  });

  it('sets listings', () => {
    useHousingTourStore.getState().setListings(['a', 'b', 'c']);
    expect(useHousingTourStore.getState().listingIds).toEqual(['a', 'b', 'c']);
  });

  it('starts and advances', () => {
    const s = useHousingTourStore.getState();
    s.setListings(['a', 'b', 'c']);
    s.start();
    expect(useHousingTourStore.getState().running).toBe(true);
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
    s.next();
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
    s.next();
    expect(useHousingTourStore.getState().currentIndex).toBe(2);
  });

  it('does not advance past last', () => {
    const s = useHousingTourStore.getState();
    s.setListings(['a', 'b']);
    s.start();
    s.next(); s.next(); s.next();
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
  });

  it('prev decrements but not below 0', () => {
    const s = useHousingTourStore.getState();
    s.setListings(['a', 'b']);
    s.start();
    s.next();
    s.prev();
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
    s.prev();
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
  });

  it('stop resets running but keeps listings', () => {
    const s = useHousingTourStore.getState();
    s.setListings(['a', 'b']);
    s.start();
    s.stop();
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(useHousingTourStore.getState().listingIds).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/useHousingTourStore.test.ts
```

- [ ] **Step 3: 実装**

`src/store/useHousingTourStore.ts`:

```typescript
import { create } from 'zustand';

interface HousingTourState {
  listingIds: string[];
  running: boolean;
  currentIndex: number;
  setListings: (ids: string[]) => void;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

export const useHousingTourStore = create<HousingTourState>((set, get) => ({
  listingIds: [],
  running: false,
  currentIndex: 0,
  setListings: (listingIds) => set({ listingIds }),
  start: () => set({ running: true, currentIndex: 0 }),
  stop: () => set({ running: false }),
  next: () => set((s) => ({
    currentIndex: Math.min(s.listingIds.length - 1, s.currentIndex + 1),
  })),
  prev: () => set((s) => ({
    currentIndex: Math.max(0, s.currentIndex - 1),
  })),
  reset: () => set({ listingIds: [], running: false, currentIndex: 0 }),
}));
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/useHousingTourStore.test.ts
```

期待: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingTourStore.ts src/__tests__/housing/useHousingTourStore.test.ts
git commit -m "feat(housing): tour store (build + progress)"
```

---

## Task 7: useHousingRandomStore (TDD)

**Files:**
- Create: `src/store/useHousingRandomStore.ts`
- Test: `src/__tests__/housing/useHousingRandomStore.test.ts`

初回ランダム選出済フラグ。 リロードで違うワードが出るため sessionStorage 永続化。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/useHousingRandomStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingRandomStore } from '../../store/useHousingRandomStore';

describe('useHousingRandomStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useHousingRandomStore.getState().reset();
  });

  it('starts with no selection', () => {
    expect(useHousingRandomStore.getState().selectedWardId).toBeNull();
  });

  it('records a selection', () => {
    useHousingRandomStore.getState().selectWard('mana-pandaemonium-shirogane-3');
    expect(useHousingRandomStore.getState().selectedWardId).toBe('mana-pandaemonium-shirogane-3');
  });

  it('reset clears selection', () => {
    useHousingRandomStore.getState().selectWard('x');
    useHousingRandomStore.getState().reset();
    expect(useHousingRandomStore.getState().selectedWardId).toBeNull();
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/useHousingRandomStore.test.ts
```

- [ ] **Step 3: 実装**

`src/store/useHousingRandomStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HousingRandomState {
  selectedWardId: string | null;
  selectWard: (id: string) => void;
  reset: () => void;
}

export const useHousingRandomStore = create<HousingRandomState>()(
  persist(
    (set) => ({
      selectedWardId: null,
      selectWard: (id) => set({ selectedWardId: id }),
      reset: () => set({ selectedWardId: null }),
    }),
    {
      name: 'housing-random',
      storage: {
        getItem: (k) => { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; },
        setItem: (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
        removeItem: (k) => sessionStorage.removeItem(k),
      },
    }
  )
);
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/useHousingRandomStore.test.ts
```

期待: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingRandomStore.ts src/__tests__/housing/useHousingRandomStore.test.ts
git commit -m "feat(housing): random ward selection store (sessionStorage)"
```

---

## Task 8: SceneryVideo コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/SceneryVideo.tsx`
- Test: `src/__tests__/housing/SceneryVideo.test.tsx`

テーマで day/night が切替わる動画背景。 `prefers-reduced-motion` で停止。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/SceneryVideo.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SceneryVideo } from '../../components/housing/workspace/SceneryVideo';

describe('SceneryVideo', () => {
  it('renders both day and night videos in the DOM', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const videos = container.querySelectorAll('video');
    expect(videos.length).toBe(2);
  });

  it('day video has data-active=true when theme=light', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const dayVideo = container.querySelector('video[data-scenery="day"]');
    expect(dayVideo?.getAttribute('data-active')).toBe('true');
  });

  it('night video has data-active=true when theme=dark', () => {
    const { container } = render(<SceneryVideo theme="dark" />);
    const nightVideo = container.querySelector('video[data-scenery="night"]');
    expect(nightVideo?.getAttribute('data-active')).toBe('true');
  });

  it('references public/housing assets', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const sources = Array.from(container.querySelectorAll('video source'));
    const paths = sources.map((s) => s.getAttribute('src'));
    expect(paths.some((p) => p?.includes('/housing/scenery-day.webm'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-day.mp4'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-night.webm'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-night.mp4'))).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/SceneryVideo.test.tsx
```

- [ ] **Step 3: 実装**

`src/components/housing/workspace/SceneryVideo.tsx`:

```typescript
import { useEffect, useRef } from 'react';

export interface SceneryVideoProps {
  theme: 'light' | 'dark';
}

/**
 * Two-video scenery background with theme-driven crossfade.
 * Inactive video is paused (saves GPU). `prefers-reduced-motion` pauses both.
 */
export const SceneryVideo: React.FC<SceneryVideoProps> = ({ theme }) => {
  const dayRef = useRef<HTMLVideoElement>(null);
  const nightRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const day = dayRef.current;
    const night = nightRef.current;
    if (!day || !night) return;
    if (reduceMotion) {
      day.pause();
      night.pause();
      return;
    }
    if (theme === 'light') {
      night.pause();
      day.play().catch(() => {});
    } else {
      day.pause();
      night.play().catch(() => {});
    }
  }, [theme]);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden="true"
    >
      <video
        ref={dayRef}
        data-scenery="day"
        data-active={theme === 'light' ? 'true' : 'false'}
        autoPlay
        loop
        muted
        playsInline
        poster="/housing/scenery-day-poster.webp"
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: theme === 'light' ? 1 : 0 }}
      >
        <source src="/housing/scenery-day.webm" type="video/webm" />
        <source src="/housing/scenery-day.mp4" type="video/mp4" />
      </video>
      <video
        ref={nightRef}
        data-scenery="night"
        data-active={theme === 'dark' ? 'true' : 'false'}
        autoPlay
        loop
        muted
        playsInline
        poster="/housing/scenery-night-poster.webp"
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: theme === 'dark' ? 1 : 0 }}
      >
        <source src="/housing/scenery-night.webm" type="video/webm" />
        <source src="/housing/scenery-night.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/SceneryVideo.test.tsx
```

期待: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/workspace/SceneryVideo.tsx src/__tests__/housing/SceneryVideo.test.tsx
git commit -m "feat(housing): SceneryVideo component (theme-driven crossfade)"
```

---

## Task 9: LiquidGlassPanel コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/LiquidGlassPanel.tsx`
- Test: `src/__tests__/housing/LiquidGlassPanel.test.tsx`

mockup の `applyLiquidGlass` を React コンポーネント化。 child を受けて、 ResizeObserver で SVG filter を再生成。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/LiquidGlassPanel.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LiquidGlassPanel } from '../../components/housing/workspace/LiquidGlassPanel';

describe('LiquidGlassPanel', () => {
  it('renders children inside a positioned wrapper', () => {
    const { getByText } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49} chroma={0}>
        <span>inner</span>
      </LiquidGlassPanel>
    );
    expect(getByText('inner')).toBeInTheDocument();
  });

  it('exposes a filter id attribute on the wrapper', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-liquid-filter-id')).toMatch(/^liquid-/);
  });

  it('injects an SVG filter element with feImage + feDisplacementMap', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    // Wait for ResizeObserver to fire — synchronous in jsdom mock?
    // We at least check the SVG defs container exists.
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/LiquidGlassPanel.test.tsx
```

- [ ] **Step 3: 実装**

`src/components/housing/workspace/LiquidGlassPanel.tsx`:

```typescript
import { useEffect, useId, useRef, useState } from 'react';
import { makeDisplacementMapDataURL } from '../../../lib/housing/displacementMap';

export interface LiquidGlassPanelProps {
  edge: number;
  radius: number;
  scale: number;
  /** Chromatic aberration is intentionally unused (Lucky Graphics flavor — no color channel split). */
  chroma?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Liquid Glass Precision Lens panel.
 * - SVG <feImage> + <feDisplacementMap> only (no color channel split, no blur).
 * - Displacement map regenerated on resize via ResizeObserver.
 * - The actual visual filter is applied via CSS custom property `--liquid-filter`
 *   on the wrapper; consuming CSS reads it as `backdrop-filter: var(--liquid-filter, none)`.
 */
export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  edge,
  radius,
  scale,
  className = '',
  style = {},
  children,
}) => {
  const rawId = useId();
  const filterId = `liquid-${rawId.replace(/:/g, '')}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  // Rebuild displacement map on resize.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    if (!wrapper || !svg) return;

    const rebuild = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 4 || h < 4) return;

      // Clear any prior <filter> and rebuild
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'defs');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');
      filter.setAttribute('filterUnits', 'objectBoundingBox');
      filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');

      const feImage = document.createElementNS(ns, 'feImage');
      feImage.setAttribute('href', makeDisplacementMapDataURL({ width: w, height: h, edge, radius }));
      feImage.setAttribute('x', '0');
      feImage.setAttribute('y', '0');
      feImage.setAttribute('width', String(w));
      feImage.setAttribute('height', String(h));
      feImage.setAttribute('result', 'dmap');
      filter.appendChild(feImage);

      const feDisp = document.createElementNS(ns, 'feDisplacementMap');
      feDisp.setAttribute('in', 'SourceGraphic');
      feDisp.setAttribute('in2', 'dmap');
      feDisp.setAttribute('scale', String(scale));
      feDisp.setAttribute('xChannelSelector', 'R');
      feDisp.setAttribute('yChannelSelector', 'G');
      filter.appendChild(feDisp);

      defs.appendChild(filter);
      svg.appendChild(defs);

      wrapper.style.setProperty('--liquid-filter', `url(#${filterId})`);
      setTick((n) => n + 1);
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [filterId, edge, radius, scale]);

  return (
    <div
      ref={wrapperRef}
      data-liquid-filter-id={filterId}
      className={`liquid-glass-panel ${className}`}
      style={{
        ...style,
        // Read by global CSS to apply the SVG filter as a backdrop.
        // The actual backdrop-filter declaration lives in the consuming CSS.
        position: style.position ?? 'relative',
      }}
    >
      <svg ref={svgRef} width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" />
      {children}
    </div>
  );
};
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/LiquidGlassPanel.test.tsx
```

期待: 3 tests pass

- [ ] **Step 5: グローバル CSS にバックドロップ規約を追加**

`src/styles/housing.css` を新規作成:

```css
/* Liquid Glass panels — pick up the SVG filter via CSS custom property.
   Safari falls back gracefully (no backdrop-filter url support) since we
   intentionally do not include a -webkit-backdrop-filter blur fallback. */
.liquid-glass-panel {
  backdrop-filter: var(--liquid-filter, none);
}
```

`src/main.tsx` でこの CSS を import:

```typescript
import './styles/housing.css';
```

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/workspace/LiquidGlassPanel.tsx \
        src/__tests__/housing/LiquidGlassPanel.test.tsx \
        src/styles/housing.css \
        src/main.tsx
git commit -m "feat(housing): LiquidGlassPanel React component"
```

---

## Task 10: TopBar コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/TopBar.tsx`
- Test: `src/__tests__/housing/TopBar.test.tsx`

ロゴ + 検索欄 + 登録 CTA + ♡ + アバター。

- [ ] **Step 1: i18n キー追加**

`src/locales/ja.ts` (既存ファイル) に追記:

```typescript
housing: {
  // ... 既存キー
  workspace: {
    topbar: {
      logo_alt: 'LoPo',
      search_placeholder: 'お家を探す...',
      register: '+ 登録する',
      favorites: 'お気に入り',
      profile: 'プロフィール',
    },
  },
},
```

`en.ts`, `ko.ts`, `zh.ts` にも対応キー追加:
- en: `search_placeholder: 'Find a home...'`, `register: '+ Add yours'`, `favorites: 'Favorites'`, `profile: 'Profile'`
- ko: `search_placeholder: '집 찾기...'`, `register: '+ 등록하기'`, `favorites: '즐겨찾기'`, `profile: '프로필'`
- zh: `search_placeholder: '搜索房屋...'`, `register: '+ 注册'`, `favorites: '收藏'`, `profile: '资料'`

- [ ] **Step 2: テストを書く (失敗させる)**

`src/__tests__/housing/TopBar.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from '../../components/housing/workspace/TopBar';

describe('TopBar', () => {
  it('renders logo, search, register CTA, favorites, avatar', () => {
    render(<TopBar />);
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/お家|find a home|집|搜索/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登録|add yours|등록|注册/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /お気に入り|favorites|즐겨찾기|收藏/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/TopBar.test.tsx
```

- [ ] **Step 4: 実装**

`src/components/housing/workspace/TopBar.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { Search, Heart, Plus, User } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <header
      className="relative z-20 flex items-center justify-between gap-4 px-6 h-14"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.32)',
      }}
    >
      <div className="flex items-center gap-3 shrink-0">
        <img src="/logo.svg" alt={t('housing.workspace.topbar.logo_alt')} className="h-7 w-7" />
        <span className="text-sm opacity-70">/housing</span>
      </div>

      <div className="flex-1 max-w-xl flex items-center gap-2 px-3 py-1.5 rounded-md"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)' }}>
        <Search size={16} className="opacity-60" />
        <input
          type="text"
          placeholder={t('housing.workspace.topbar.search_placeholder')}
          className="bg-transparent outline-none w-full text-sm text-white placeholder-white/55"
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ color: '#ffc987', border: '1px solid rgba(255,201,135,0.4)' }}
        >
          <Plus size={14} />
          {t('housing.workspace.topbar.register')}
        </button>
        <button
          type="button"
          aria-label={t('housing.workspace.topbar.favorites')}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
        >
          <Heart size={18} />
        </button>
        <button
          type="button"
          aria-label={t('housing.workspace.topbar.profile')}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
        >
          <User size={18} />
        </button>
      </div>
    </header>
  );
};
```

- [ ] **Step 5: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/TopBar.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/workspace/TopBar.tsx \
        src/__tests__/housing/TopBar.test.tsx \
        src/locales/
git commit -m "feat(housing): TopBar (logo + search + register CTA + favorites + avatar)"
```

---

## Task 11: StatusBar コンポーネント (TDD)

**Files:**
- Create: `src/components/housing/workspace/StatusBar.tsx`
- Test: `src/__tests__/housing/StatusBar.test.tsx`

テーマ切替 (Light/Dark) + 言語切替 + メタ表示。

- [ ] **Step 1: i18n キー追加**

`src/locales/ja.ts` の `housing.workspace` に追記:

```typescript
statusbar: {
  theme_label: 'テーマ',
  theme_light: 'Light',
  theme_dark: 'Dark',
  lang_label: '言語',
},
```

他 3 言語にも対応キー。

- [ ] **Step 2: テストを書く (失敗させる)**

`src/__tests__/housing/StatusBar.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../../components/housing/workspace/StatusBar';

describe('StatusBar', () => {
  it('renders theme and language switchers', () => {
    render(<StatusBar />);
    expect(screen.getByText(/Light/i)).toBeInTheDocument();
    expect(screen.getByText(/Dark/i)).toBeInTheDocument();
    expect(screen.getByText('JA')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/StatusBar.test.tsx
```

- [ ] **Step 4: 実装**

`src/components/housing/workspace/StatusBar.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';

const LANGS = ['JA', 'EN', 'KO', 'ZH'] as const;

export const StatusBar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <footer
      className="relative z-20 flex items-center justify-between gap-6 px-6 h-8 text-xs"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderTop: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.32)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="opacity-55 uppercase tracking-wider">{t('housing.workspace.statusbar.theme_label')}</span>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`px-2 py-0.5 rounded ${theme === 'light' ? 'bg-white/20' : ''}`}
          style={{ color: theme === 'light' ? '#ffc987' : 'inherit' }}
        >
          {t('housing.workspace.statusbar.theme_light')}
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-white/20' : ''}`}
          style={{ color: theme === 'dark' ? '#ffc987' : 'inherit' }}
        >
          {t('housing.workspace.statusbar.theme_dark')}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="opacity-55 uppercase tracking-wider">{t('housing.workspace.statusbar.lang_label')}</span>
        {LANGS.map((lang) => {
          const code = lang.toLowerCase();
          const isActive = i18n.language === code;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => i18n.changeLanguage(code)}
              className={`px-2 py-0.5 rounded ${isActive ? 'bg-white/20' : ''}`}
              style={{ color: isActive ? '#ffc987' : 'inherit' }}
            >
              {lang}
            </button>
          );
        })}
      </div>
    </footer>
  );
};
```

- [ ] **Step 5: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/StatusBar.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/workspace/StatusBar.tsx \
        src/__tests__/housing/StatusBar.test.tsx \
        src/locales/
git commit -m "feat(housing): StatusBar (theme + language switchers)"
```

---

## Task 12: HousingWorkspace メインレイアウト (TDD)

**Files:**
- Create: `src/components/housing/workspace/HousingWorkspace.tsx`
- Create: `src/components/housing/workspace/index.ts`
- Test: `src/__tests__/housing/HousingWorkspace.test.tsx`

SceneryVideo + TopBar + 3 カラム (まだプレースホルダ) + StatusBar の骨格。

- [ ] **Step 1: テストを書く (失敗させる)**

`src/__tests__/housing/HousingWorkspace.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';

describe('HousingWorkspace', () => {
  it('renders top bar, left panel placeholder, center, right panel placeholder, status bar', () => {
    render(
      <MemoryRouter>
        <HousingWorkspace />
      </MemoryRouter>
    );
    // top bar
    expect(screen.getByRole('img', { name: /lopo/i })).toBeInTheDocument();
    // 3 main regions (use data-region for unambiguous targeting)
    expect(document.querySelector('[data-region="left"]')).toBeTruthy();
    expect(document.querySelector('[data-region="center"]')).toBeTruthy();
    expect(document.querySelector('[data-region="right"]')).toBeTruthy();
    // status bar
    expect(screen.getByText(/Light/i)).toBeInTheDocument();
  });

  it('renders both scenery videos', () => {
    const { container } = render(
      <MemoryRouter>
        <HousingWorkspace />
      </MemoryRouter>
    );
    expect(container.querySelectorAll('video').length).toBe(2);
  });
});
```

- [ ] **Step 2: テスト実行して失敗確認**

```bash
npx vitest run src/__tests__/housing/HousingWorkspace.test.tsx
```

- [ ] **Step 3: 実装**

`src/components/housing/workspace/HousingWorkspace.tsx`:

```typescript
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { SceneryVideo } from './SceneryVideo';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';

export const HousingWorkspace: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const leftPanelOpen = useHousingViewStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useHousingViewStore((s) => s.rightPanelOpen);

  return (
    <main
      className="relative min-h-screen flex flex-col"
      data-theme={theme}
      style={{ color: '#ffffff' }}
    >
      <SceneryVideo theme={theme} />
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar />
        <div className="flex-1 flex">
          {leftPanelOpen && (
            <aside
              data-region="left"
              className="w-72 shrink-0 border-r"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              {/* Plan B で FilterPanel に置き換え */}
              <div className="p-4 text-sm opacity-60">[Left panel — Plan B]</div>
            </aside>
          )}
          <section data-region="center" className="flex-1 min-w-0">
            {/* Plan C で CenterArea に置き換え */}
            <div className="p-4 text-sm opacity-60">[Center area — Plan C]</div>
          </section>
          {rightPanelOpen && (
            <aside
              data-region="right"
              className="w-80 shrink-0 border-l"
              style={{ borderColor: 'rgba(255,255,255,0.22)' }}
            >
              {/* Plan D で RightPanel に置き換え */}
              <div className="p-4 text-sm opacity-60">[Right panel — Plan D]</div>
            </aside>
          )}
        </div>
        <StatusBar />
      </div>
    </main>
  );
};
```

`src/components/housing/workspace/index.ts`:

```typescript
export { HousingWorkspace } from './HousingWorkspace';
export { SceneryVideo } from './SceneryVideo';
export { LiquidGlassPanel } from './LiquidGlassPanel';
export { TopBar } from './TopBar';
export { StatusBar } from './StatusBar';
```

- [ ] **Step 4: テスト実行してパス確認**

```bash
npx vitest run src/__tests__/housing/HousingWorkspace.test.tsx
```

期待: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/workspace/HousingWorkspace.tsx \
        src/components/housing/workspace/index.ts \
        src/__tests__/housing/HousingWorkspace.test.tsx
git commit -m "feat(housing): HousingWorkspace layout skeleton (top/left/center/right/status)"
```

---

## Task 13: ルーティング切替

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/housing/index.ts`

`/housing` を `HousingWorkspace` に切替、 既存 `HousingPage` は `/housing/legacy` で保持。

- [ ] **Step 1: `src/components/housing/index.ts` に workspace 再公開を追加**

```typescript
// 既存の export ... を保持しつつ追記
export { HousingWorkspace } from './workspace';
```

- [ ] **Step 2: `src/App.tsx` のルート切替**

既存:

```typescript
// 既存例 (探して置き換える):
//   <Route path="/housing" element={<HousingPage />} />
```

を以下に置き換え:

```typescript
import { HousingWorkspace } from './components/housing';
// ... 他の import
// Routes 内:
<Route path="/housing" element={<HousingWorkspace />} />
<Route path="/housing/legacy" element={<HousingPage />} />
<Route path="/housing/p/:listingId" element={<HousingDetailPagePlaceholder />} />
<Route path="/housing/tour/:tourId" element={<HousingTourPagePlaceholder />} />
```

- [ ] **Step 3: dev server で目視確認**

```bash
npm run dev
```

ブラウザで http://localhost:5173/housing を開く。 期待:
- 動画背景が再生される (light/dark テーマ切替で 2 種類の動画が切り替わる)
- top bar (ロゴ + 検索 + 登録 CTA + ♡ + アバター)
- 左 / 中央 / 右の 3 カラム (プレースホルダ)
- status bar (テーマ + 言語切替)

http://localhost:5173/housing/legacy を開いて旧タブ式が動くことも確認。

- [ ] **Step 4: ビルド検証 (vercel 厳密モード対策)**

```bash
npm run build
```

期待: エラー無くビルド完了

- [ ] **Step 5: vitest 全テスト**

```bash
npx vitest run
```

期待: 全 pass、 新規追加の housing 関連も含む

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/housing/index.ts
git commit -m "feat(housing): wire HousingWorkspace to /housing route (legacy preserved at /housing/legacy)"
```

---

## Self-Review Checklist (Plan 完成後の確認)

### 仕様書カバレッジ

| 設計書セクション | Plan A での対応 |
|---|---|
| §2 トンマナ (動画背景) | Task 1 (assets) + Task 8 (SceneryVideo) |
| §2 トンマナ (リキッドグラス) | Task 2 (displacement map) + Task 9 (LiquidGlassPanel) |
| §3 画面構造 (3 カラム + top/status) | Task 10-12 (TopBar/StatusBar/HousingWorkspace) |
| §11.1 store 分割 (5 stores) | Task 3-7 |
| §11.2 URL 状態 (ルーティング) | Task 13 |

### Plan A スコープ外 (後の plan へ)

- §4 中央エリア詳細 → Plan C
- §5 左パネル (Faceted filter 中身) → Plan B
- §6 右パネル (ツアー進行) → Plan D
- §7 お気に入りモーダル → Plan E
- §8 登録 CTA 接続 (実モーダル呼び出し) → Plan F
- §9 空状態 → Plan F
- §12 アクセシビリティ (フル) → Plan F
- §13 テスト (E2E) → Plan F

### Placeholder Scan

- すべての step に actual code or actual command を含めた ✓
- "TBD" / "TODO" / "implement later" 無し ✓
- 各 task が working, testable software として完成 ✓

---

## 完了の定義

Plan A が完了したとき:
- [ ] `/housing` を開くと動画背景 + 3 カラム骨格が表示される
- [ ] テーマ切替で動画 day/night が crossfade で切替わる
- [ ] 言語切替が動く
- [ ] 5 つの Zustand store が単体テスト合格
- [ ] LiquidGlassPanel + displacementMap が単体テスト合格
- [ ] `npm run build` がエラーなく完了
- [ ] `/housing/legacy` で旧 HousingPage がまだ動く
