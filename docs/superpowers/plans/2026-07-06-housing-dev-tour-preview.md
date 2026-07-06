# 全住所ツアープレビュー(DEV専用) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run dev` で開く DEV専用ページ `/housing/dev/tour-preview` を作り、本番 `TourNavPage` を無改変で再利用して全住所(≈310)の仮ツアーを 1 件ずつ目視 QA できるようにする。

**Architecture:** DEVページが (1) 既存 `WARD_MAP_LOADERS` で 10 マップを遅延ロード → (2) 純関数 `buildAllAddressListings` で全住所の仮 `MockListing[]` を生成 → (3) `useHousingListingsStore` / `useHousingTourStore` に `setState` で流し込み → (4) 本番 `TourNavPage` をそのまま描画 + 上部に DEV 操作バー(件数/住所/入口補正バッジ/前後/ジャンプ)を重ねる。離脱時にストアを reset。本番 build には `import.meta.env.DEV` ガードで一切含めない。

**Tech Stack:** React 19 / TypeScript (tsc -b strict) / zustand / react-router-dom 7 / vitest + @testing-library/react / vite。新規依存なし。

## Global Constraints

- **本番非露出**: ルートは `import.meta.env.DEV &&` ガード。build 後 `dist` に dev シンボルが 0 件であることを検証する(入口ツール `/housing/dev/entrances` と同じ方式)。
- **ワード JSON を静的 import しない**: 10 個の `*.generated.json` は既存 `WARD_MAP_LOADERS`(動的 import)経由でのみ読む。静的 import すると本番 lazy chunk がメイン bundle に巻き込まれる恐れがあるため禁止。
- **本番コード無改変**: `TourNavPage` / 各ストアの既存アクションは変更しない。注入は zustand の `setState` / `getState` で DEVページ側から行う。
- **ハウジング配下ルール**(`.claude/rules/housing-design.md`): 色 literal 禁止=CSS の色は `--housing-*` トークン経由。font-size もトークン。border-radius の literal は housing.css の確立規約に従い許容。
- **型/ビルド**: `npm run build`(tsc -b 厳密)EXIT0。全体テストは既知 legacy 5 fail(TopBar4 + HousingWorkspace1)以外の新規 fail ゼロ。
- **仮データ**: `region`/`dc`/`server` は全件共通のダミー値。`imageMode: 'none'`(画像なし)、`visibility: 'public'`(閲覧に出す)、`title` はサンプルラベル。住所(`area`/`plot`/`apartmentBuilding`/`buildingType`)は本物。

---

### Task 1: `buildAllAddressListings` 純関数 + `PREVIEW_MAPS`

**Files:**
- Create: `src/lib/housing/devTourPreview.ts`
- Test: `src/lib/housing/__tests__/devTourPreview.test.ts`

**Interfaces:**
- Consumes: `MockListing`(`src/data/housing/mockListings.ts`)、`WardMapJson`(`src/data/housing/wardMapManifest.ts`)、`HousingArea`(`src/store/useHousingFilterStore.ts`)。
- Produces:
  - `PREVIEW_MAPS: ReadonlyArray<{ mapKey: string; area: HousingArea; isSub: boolean }>`(10 エントリ・`WARD_MAP_LOADERS` のキー順)
  - `buildAllAddressListings(loaded: Array<{ area: HousingArea; isSub: boolean; json: WardMapJson }>): MockListing[]`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/devTourPreview.test.ts
import { describe, it, expect } from 'vitest';
import { buildAllAddressListings, PREVIEW_MAPS } from '../devTourPreview';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import type { HousingArea } from '../../../store/useHousingFilterStore';
import { resolveWardMapRef } from '../resolveWardMapRef';
import mist from '../../../data/housing/mistWard.generated.json';
import mistSub from '../../../data/housing/mistSubWard.generated.json';
import goblet from '../../../data/housing/gobletWard.generated.json';
import gobletSub from '../../../data/housing/gobletSubWard.generated.json';
import lavender from '../../../data/housing/lavenderWard.generated.json';
import lavenderSub from '../../../data/housing/lavenderSubWard.generated.json';
import shirogane from '../../../data/housing/shiroganeWard.generated.json';
import shiroganeSub from '../../../data/housing/shiroganeSubWard.generated.json';
import empyreum from '../../../data/housing/empyreumWard.generated.json';
import empyreumSub from '../../../data/housing/empyreumSubWard.generated.json';

const JSON_BY_KEY: Record<string, WardMapJson> = {
  mist: mist as unknown as WardMapJson, 'mist-sub': mistSub as unknown as WardMapJson,
  goblet: goblet as unknown as WardMapJson, 'goblet-sub': gobletSub as unknown as WardMapJson,
  lavender: lavender as unknown as WardMapJson, 'lavender-sub': lavenderSub as unknown as WardMapJson,
  shirogane: shirogane as unknown as WardMapJson, 'shirogane-sub': shiroganeSub as unknown as WardMapJson,
  empyreum: empyreum as unknown as WardMapJson, 'empyreum-sub': empyreumSub as unknown as WardMapJson,
};
const LOADED = PREVIEW_MAPS.map((m) => ({ area: m.area as HousingArea, isSub: m.isSub, json: JSON_BY_KEY[m.mapKey] }));

describe('buildAllAddressListings', () => {
  const all = buildAllAddressListings(LOADED);
  it('全住所を生成する(200件以上)', () => {
    expect(all.length).toBeGreaterThan(200);
  });
  it('全件 resolveWardMapRef が非nullを返す(=実在住所のみ)', () => {
    for (const l of all) {
      const ref = resolveWardMapRef(l.area, l.plot ?? null, l.apartmentBuilding ?? null, l.buildingType);
      expect(ref, l.id).not.toBeNull();
    }
  });
  it('拡張街は plot 31-60 に読み替わる', () => {
    const subPlots = all.filter((l) => l.buildingType === 'house' && (l.plot ?? 0) >= 31);
    expect(subPlots.length).toBeGreaterThan(0);
    expect(Math.min(...subPlots.map((l) => l.plot ?? 0))).toBe(31);
  });
  it('アパートは棟1(本街)と棟2(拡張)の両方がある', () => {
    expect(all.some((l) => l.buildingType === 'apartment' && l.apartmentBuilding === 1)).toBe(true);
    expect(all.some((l) => l.buildingType === 'apartment' && l.apartmentBuilding === 2)).toBe(true);
  });
  it('id は一意', () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/devTourPreview.test.ts`
Expected: FAIL(`buildAllAddressListings` / `PREVIEW_MAPS` が存在しない）

- [ ] **Step 3: 最小実装を書く**

```ts
// src/lib/housing/devTourPreview.ts
import type { MockListing } from '../../data/housing/mockListings';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { HousingArea } from '../../store/useHousingFilterStore';

/** DEV専用ツアープレビューの対象 10 マップ。WARD_MAP_LOADERS のキー順(エリアごとに 本街→拡張)。 */
export const PREVIEW_MAPS: ReadonlyArray<{ mapKey: string; area: HousingArea; isSub: boolean }> = [
  { mapKey: 'mist', area: 'Mist', isSub: false },
  { mapKey: 'mist-sub', area: 'Mist', isSub: true },
  { mapKey: 'goblet', area: 'Goblet', isSub: false },
  { mapKey: 'goblet-sub', area: 'Goblet', isSub: true },
  { mapKey: 'lavender', area: 'LavenderBeds', isSub: false },
  { mapKey: 'lavender-sub', area: 'LavenderBeds', isSub: true },
  { mapKey: 'shirogane', area: 'Shirogane', isSub: false },
  { mapKey: 'shirogane-sub', area: 'Shirogane', isSub: true },
  { mapKey: 'empyreum', area: 'Empyreum', isSub: false },
  { mapKey: 'empyreum-sub', area: 'Empyreum', isSub: true },
];

const AREA_LABEL: Record<HousingArea, string> = {
  Mist: 'ミスト', Goblet: 'ゴブレット', LavenderBeds: 'ラベンダーベッド', Shirogane: 'シロガネ', Empyreum: 'エンピレアム',
};

/**
 * 全ワード地図の実在住所を仮 MockListing 列にする(DEV専用ツアープレビュー用の純関数)。
 * 並び = loaded の順(エリアごとに 本街→拡張)、各地図内は plot 昇順 → アパート。
 * area/plot/apartmentBuilding/buildingType は本物、写真/メモ無し、title はサンプルラベル。
 */
export function buildAllAddressListings(
  loaded: Array<{ area: HousingArea; isSub: boolean; json: WardMapJson }>,
): MockListing[] {
  const out: MockListing[] = [];
  let i = 0;
  for (const m of loaded) {
    const plots = m.json.houses.filter((h) => h.kind === 'plot').sort((a, b) => a.plot - b.plot);
    const aparts = m.json.houses.filter((h) => h.kind === 'apart');
    for (const h of plots) {
      out.push(makeListing(i++, m.area, m.isSub, 'house', m.isSub ? h.plot + 30 : h.plot, null));
    }
    for (const _h of aparts) {
      out.push(makeListing(i++, m.area, m.isSub, 'apartment', null, m.isSub ? 2 : 1));
    }
  }
  return out;
}

function makeListing(
  i: number, area: HousingArea, isSub: boolean,
  buildingType: 'house' | 'apartment', plot: number | null, apartmentBuilding: 1 | 2 | null,
): MockListing {
  const createdAt = 1715000000000 - i * 1000;
  const label = buildingType === 'apartment'
    ? `${AREA_LABEL[area]} アパルトメント棟${apartmentBuilding}`
    : `${AREA_LABEL[area]}${isSub ? '拡張' : ''} ${plot}番地`;
  const listing: MockListing = {
    id: buildingType === 'apartment' ? `preview-${area}-apart-${apartmentBuilding}` : `preview-${area}-plot-${plot}`,
    ownerUid: 'preview',
    dc: 'PreviewDC', server: 'PreviewWorld', region: 'JP',
    area, ward: (i % 30) + 1,
    buildingType,
    imageMode: 'none',
    tags: [],
    title: label,
    visibility: 'public',
    createdAt, lastConfirmedAt: createdAt,
    addressKey: `preview|${area}|${buildingType}|${plot ?? `apart${apartmentBuilding}`}`,
  };
  if (buildingType === 'apartment') {
    listing.apartmentBuilding = apartmentBuilding ?? 1;
    listing.roomNumber = 1;
  } else {
    listing.plot = plot ?? 1;
    listing.size = 'M';
  }
  return listing;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/devTourPreview.test.ts`
Expected: PASS(5 件)

- [ ] **Step 5: build で型検証**

Run: `npm run build`
Expected: EXIT0(tsc -b strict 通過)

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/devTourPreview.ts src/lib/housing/__tests__/devTourPreview.test.ts
git commit -m "feat(housing/dev): 全住所を仮MockListing列にする純関数 buildAllAddressListings"
```

---

### Task 2: `TourPreviewPage` コンポーネント + 操作バー CSS

**Files:**
- Create: `src/components/housing/dev/TourPreviewPage.tsx`
- Modify: `src/styles/housing.css`(末尾に DEV操作バーのトークン経由スタイルを追記)
- Test: `src/components/housing/dev/__tests__/TourPreviewPage.test.tsx`

**Interfaces:**
- Consumes: `buildAllAddressListings` / `PREVIEW_MAPS`(Task 1)、`WARD_MAP_LOADERS`(`src/data/housing/wardMapManifest.ts`)、`useHousingListingsStore` / `useHousingTourStore`(zustand・`setState`/`getState`/`setListings`/`start`/`reset`)、`getPlotEntrance`(`src/lib/housing/plotEntrance.ts`)、`TourNavPage`(`src/components/housing/pages/TourNavPage.tsx`)。
- Produces: `TourPreviewPage: React.FC`(Task 3 で route に接続)。

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/housing/dev/__tests__/TourPreviewPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TourPreviewPage } from '../TourPreviewPage';

describe('TourPreviewPage (DEV)', () => {
  it('全住所を読み込み、件数カウンタと住所ジャンプを表示する', async () => {
    render(
      <MemoryRouter>
        <TourPreviewPage />
      </MemoryRouter>,
    );
    // 10 マップの遅延ロード完了後にバーが出る
    await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/dev/__tests__/TourPreviewPage.test.tsx`
Expected: FAIL(`TourPreviewPage` が存在しない)

- [ ] **Step 3: コンポーネントを実装**

```tsx
// src/components/housing/dev/TourPreviewPage.tsx
import { useEffect, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { PREVIEW_MAPS, buildAllAddressListings } from '../../../lib/housing/devTourPreview';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { getPlotEntrance } from '../../../lib/housing/plotEntrance';
import { TourNavPage } from '../pages/TourNavPage';

/**
 * DEV専用: 全住所ツアープレビュー。本番 TourNavPage を無改変で再利用し、
 * 全住所(≈310)の仮ツアーをストアに流して 1 件ずつ目視 QA する。本番 build 非露出。
 */
export const TourPreviewPage: React.FC = () => {
  const [listings, setListings] = useState<MockListing[] | null>(null);
  const currentIndex = useHousingTourStore((s) => s.currentIndex);

  // 10 マップを既存の遅延ローダで読み、全住所の仮 listing を生成。
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PREVIEW_MAPS.map((m) => WARD_MAP_LOADERS[m.mapKey]().then(({ json }) => ({ area: m.area, isSub: m.isSub, json }))),
    ).then((loaded) => {
      if (!cancelled) setListings(buildAllAddressListings(loaded));
    });
    return () => { cancelled = true; };
  }, []);

  // 生成できたらストアへ注入 (本番アクション無改変・setState 直書き)。離脱時に reset。
  useEffect(() => {
    if (!listings) return;
    useHousingListingsStore.setState({ status: 'ready', listings });
    const tour = useHousingTourStore.getState();
    tour.setListings(listings.map((l) => l.id));
    tour.start();
    return () => {
      useHousingTourStore.getState().reset();
      useHousingListingsStore.setState({ status: 'idle', listings: [] });
    };
  }, [listings]);

  if (!listings) {
    return (
      <div className="housing-dev-tourpreview">
        <div className="housing-dev-tourpreview-bar">全住所を読み込み中…</div>
      </div>
    );
  }

  const total = listings.length;
  const current = listings[currentIndex] ?? null;
  const hasEntrance = current
    ? getPlotEntrance(current.area, current.plot, current.buildingType, current.apartmentBuilding) != null
    : false;
  const goto = (i: number) =>
    useHousingTourStore.setState({ currentIndex: Math.max(0, Math.min(total - 1, i)) });

  return (
    <div className="housing-dev-tourpreview">
      <div className="housing-dev-tourpreview-bar">
        <span className="housing-dev-tourpreview-count">{currentIndex + 1} / {total}</span>
        <span className="housing-dev-tourpreview-label">{current?.title ?? '-'}</span>
        {current && (
          <span className={`housing-dev-tourpreview-badge ${hasEntrance ? 'housing-dev-tourpreview-badge--entrance' : 'housing-dev-tourpreview-badge--geo'}`}>
            {hasEntrance ? '入口補正あり' : '幾何'}
          </span>
        )}
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(currentIndex - 1)} disabled={currentIndex === 0}>前へ</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(currentIndex + 1)} disabled={currentIndex >= total - 1}>次へ</button>
        <select
          className="housing-dev-tourpreview-btn housing-dev-tourpreview-jump"
          value={currentIndex}
          onChange={(e) => goto(Number(e.target.value))}
          aria-label="住所ジャンプ"
        >
          {listings.map((l, idx) => (
            <option key={l.id} value={idx}>{l.title}</option>
          ))}
        </select>
      </div>
      {/* key で住所ごとに新規マウント = 完了画面等のローカル状態残りを防ぐ */}
      <TourNavPage key={currentIndex} />
    </div>
  );
};
```

- [ ] **Step 4: 操作バー CSS を housing.css 末尾に追記**

```css
/* ===== DEV専用: 全住所ツアープレビュー操作バー (本番非露出) ===== */
.housing-dev-tourpreview { display: flex; flex-direction: column; height: 100vh; }
.housing-dev-tourpreview .housing-tour-page { flex: 1; min-height: 0; }
.housing-dev-tourpreview-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
  padding: 8px var(--housing-main-padding);
  background: var(--housing-panel-bg-solid);
  color: var(--housing-text);
  border-bottom: 1px solid var(--housing-divider);
  font-size: var(--housing-text-sm);
}
.housing-dev-tourpreview-count { color: var(--housing-text-mute); }
.housing-dev-tourpreview-label { font-weight: 600; }
.housing-dev-tourpreview-badge {
  padding: 2px 8px; border-radius: 6px; border: 1px solid var(--housing-divider);
}
.housing-dev-tourpreview-badge--entrance { color: var(--housing-honey); }
.housing-dev-tourpreview-badge--geo { color: var(--housing-text-mute); }
.housing-dev-tourpreview-btn {
  padding: 4px 10px; border: 1px solid var(--housing-divider); border-radius: 6px;
  background: transparent; color: var(--housing-text); cursor: pointer;
}
.housing-dev-tourpreview-jump { margin-left: auto; max-width: 240px; }
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run src/components/housing/dev/__tests__/TourPreviewPage.test.tsx`
Expected: PASS

- [ ] **Step 6: build で型検証**

Run: `npm run build`
Expected: EXIT0

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/dev/TourPreviewPage.tsx src/components/housing/dev/__tests__/TourPreviewPage.test.tsx src/styles/housing.css
git commit -m "feat(housing/dev): 全住所ツアープレビューページ(本番TourNavPage再利用+操作バー)"
```

---

### Task 3: DEV ルート接続 + 本番非露出/バンドル健全性の検証

**Files:**
- Modify: `src/App.tsx`(import 追加 + `import.meta.env.DEV` ガード付き Route 追加)

**Interfaces:**
- Consumes: `TourPreviewPage`(Task 2)。
- Produces: なし(最終配線)。

- [ ] **Step 1: App.tsx に import を追加**

`src/App.tsx` の `import { EntranceAuthoringPage } ...`(24 行目付近)の直後に追記:

```tsx
import { TourPreviewPage } from './components/housing/dev/TourPreviewPage';
```

- [ ] **Step 2: DEV ガード付き Route を追加**

`src/App.tsx` の入口ツール Route ブロック(`/housing/dev/entrances`・114-116 行目付近)の直後に追記:

```tsx
{import.meta.env.DEV && (
  <Route path="/housing/dev/tour-preview" element={<TourPreviewPage />} />
)}
```

- [ ] **Step 3: build を実行(EXIT0 + バンドル健全性)**

Run: `npm run build`
Expected: EXIT0。さらに build 出力に **10 個の `*.generated-*.js`(ward JSON lazy chunk)が引き続き別チャンクとして残る**こと、`index-*.js` のサイズが変更前(≈3,083 kB)から大きく増えていないことを確認(静的 import 巻き込みが起きていない証跡)。

- [ ] **Step 4: 本番 dist に dev シンボルが無いことを検証**

Run: `grep -rEo "tour-preview|TourPreviewPage|buildAllAddressListings" dist/ | wc -l`
Expected: `0`(本番 tree-shake 除去)

- [ ] **Step 5: 全体テストで回帰ゼロを確認**

Run: `npx vitest run`
Expected: 5 fail(既知 legacy TopBar4 + HousingWorkspace1 のみ)/ 新規 fail ゼロ。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx
git commit -m "feat(housing/dev): /housing/dev/tour-preview を DEV専用ルートに接続(本番非露出)"
```

---

## 実機ゲート(ユーザー・merge 前)

`npm run dev` → `http://localhost:5173/housing/dev/tour-preview` → 「次へ」/「住所ジャンプ」で全住所を歩き、各住所でナビ地図(光る道/光る箱)+ステップ+進捗が本番同一に出るのを目視。違和感(道が家に刺さる/遠回り/入口で止まらない/はみ出す)をメモ → 手直しは別途(入口ドラッグ補正=既存入口ツール 等)。**merge/push はユーザー確認後**([[feedback_deploy]])。DEV専用なので本番機能への影響はなし。

---

## Self-Review

**1. Spec coverage:**
- §1 方式(本番ページ無改変・裏で仮ツアー) → Task 2(setState 注入 + `<TourNavPage/>` 再利用)✓
- §3 全住所列挙(逆写像) → Task 1(`buildAllAddressListings` + テストで逆写像検証)✓
- §4 ストア注入&クリーンアップ → Task 2(mount 注入 / unmount reset)✓
- §5 DEV操作バー(N/total・ラベル・入口バッジ・ジャンプ) → Task 2 ✓
- §6 ルーティング本番非露出 → Task 3(DEV ガード + dist grep)✓
- §7 テスト(件数/逆写像/見切れ… ※見切れは Phase2 で・本ツールは列挙と描画のみ) → Task 1/2/3 ✓
- ワード JSON 静的 import 回避(Global Constraints) → Task 2 が `WARD_MAP_LOADERS` 動的ロード ✓

**2. Placeholder scan:** なし(全 step に実コード)。

**3. Type consistency:**
- `buildAllAddressListings(loaded)` の `loaded` 要素 `{ area, isSub, json }` は Task 1 定義と Task 2 呼び出しで一致 ✓
- `PREVIEW_MAPS` の要素型 `{ mapKey, area, isSub }` は Task 1 定義と Task 2 の `WARD_MAP_LOADERS[m.mapKey]` 使用で一致 ✓
- `getPlotEntrance(area, plot, buildingType, apartmentBuilding)` の引数順は plotEntrance.ts の署名と一致 ✓
- ストア: `useHousingTourStore` の `setListings`/`start`/`reset`、`currentIndex` は store 定義と一致。`setState({ currentIndex })` は zustand 標準 ✓
