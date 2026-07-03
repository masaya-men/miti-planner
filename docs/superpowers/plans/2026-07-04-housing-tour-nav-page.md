# ハウジングツアー ツアー中(Nav)ページ M1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新シェルの `/housing/tour` に「ツアー中(ナビゲーション)」ページを実装し、`useHousingTourStore` + 実データ + 既存地図machinery を配線して、お気に入り→開始→地図案内・進行連動を端から端まで通す(ミストのみ)。

**Architecture:** 純関数(`tourNav.ts` = 進捗/ステップ解決、`wardRoute.ts` = 地図経路/配置)を土台に、表示専用のUI部品(進捗パネル/地図/次の目的地パネル/空状態)を積み、`TourNavPage` がストアを購読して束ねる。地図は旧 `MapView` の BFS/polyline/演出を純化して再利用。報告は既存 `HousingReportModal` を再利用。

**Tech Stack:** React 18 + TypeScript(strict, erasableSyntaxOnly) / Zustand / react-i18next / Vitest(happy-dom) / vite。ハウジング独自トンマナ(質感A案・`--housing-*` トークン・honey/aether)。

## Global Constraints

- 対象は **ミストのみ**。他エリアはピン非表示+一覧注記(全エリアは M5)。所要時間(約N分)は**出さない**。永続化・一時停止再開・共有復元は M3(M1は「終了」のみ)。スマホ最適化は M6。
- **ハウジングはハードコード禁止**: 色/font-size/寸法/影の literal 直書き禁止。`src/styles/housing.css` にトークン集約し `--housing-*` 経由(`.claude/rules/housing-design.md`)。`aspect-*` 等の純ユーティリティclassは可。
- **i18n**: UI文字列は必ずキー経由。新規キーは ja/en/ko/zh の**4言語に実訳**(JAコピー禁止)。parity テストを緑に。
- **テスト方針**: 純関数はユニット必須。UI は軽い部品テスト(happy-dom)のみ、地図の視覚は**実機ゲート**(happy-dom で SVG 実寸/IObserver 不可)。`npm test` = `vitest run`(単一ファイルは `npm test -- <pattern>`。`-- run` は 0 件実行の罠)。push 前 `npm run build`(tsc厳密) + 全体 `npm test`。
- **既知 legacy fail 5件**(TopBar4 + HousingWorkspace1)は回帰ではない。これ以外の fail はゼロを維持。
- **legacy 非破壊**: 旧 `MapView`/`TourProgressList`/`useHousingTourStore` の `next()` クランプ(`len-1`)は**変更しない**。完了は store 拡張せずページ側で表現。
- ストア/ヘルパの正確なシグネチャ(消費するもの):
  - `useHousingTourStore`(`src/store/useHousingTourStore.ts`): `{ listingIds: string[]; running: boolean; currentIndex: number; setListings; start; stop; next; prev; reset }`
  - `useHousingViewStore`(`src/store/useHousingViewStore.ts`): `exitTourMode()`(`set({ mode: 'browse' })`)
  - `useHousingListingsStore`(`src/store/useHousingListingsStore.ts`): `{ listings, myListings, status }`
  - `useAuthStore`: `s.user?.uid ?? null`
  - `mergeListingsForViewer(publicListings, myListings, uid, nowMs)`(`src/lib/housing/listingPublish.ts`)
  - `formatHousingAddress(listing, lang)`(`src/lib/housing/formatHousingAddress.ts`)
  - `HousingReportModal`(`src/components/housing/report/HousingReportModal.tsx`) props `{ open: boolean; listingId: string; onClose: () => void }`
  - `MockListing` 型(`src/data/housing/mockListings.ts`): `id/ownerUid/area/ward/plot/size/buildingType?/apartmentBuilding?/imageMode/ogImageUrl?/thumbnailPath?/title?/tags/...`

---

## File Structure

**新規(純関数・`src/lib/housing/`)**
- `tourNav.ts` — `resolveTourSteps` / `stepStatus` / `computeTourProgress` / `isMistPlaceable`
- `wardRoute.ts` — `WARD_CENTER_NODE` / `buildRoutePath` / `plotToPlacement`(旧MapViewのBFS/polylineを純化・ミストデータ)
- `__tests__/tourNav.test.ts` / `__tests__/wardRoute.test.ts`

**新規(UI・`src/components/housing/tour/`)**
- `ProgressRing.tsx` — %リングSVG(小)
- `TourProgressPanel.tsx` — 左カラム(リング+軒数+次に訪れる+最近訪れた+終了)
- `TourNavMap.tsx` — 中央(実データ駆動の地図)
- `TourRouteSteps.tsx` — ルートのステップ一覧
- `TourNextDestinationPanel.tsx` — 右カラム(詳細+ステップ+操作+報告ボタン)
- `TourEmptyState.tsx` — 未開始/完了の空状態
- `__tests__/` 各テスト

**新規(ページ・`src/components/housing/pages/`)**
- `TourNavPage.tsx` + `__tests__/TourNavPage.test.tsx`

**変更**
- `src/App.tsx` — `/housing/tour` の element を `<ComingSoonPage tab="tour" />` → `<TourNavPage />`
- `src/styles/housing.css` — `--housing-tour-*` トークン + `.housing-tour-*` スタイル
- `src/locales/{ja,en,ko,zh}.json` — `housing.tour.nav.*` キー
- i18n parity テスト(既存 parity 機構に追随)

---

## Task 1: 純関数 `tourNav.ts`(進捗・ステップ解決)

**Files:**
- Create: `src/lib/housing/tourNav.ts`
- Test: `src/lib/housing/__tests__/tourNav.test.ts`

**Interfaces:**
- Produces:
  - `interface TourStep { id: string; listing: MockListing | null }`
  - `resolveTourSteps(listingIds: string[], pool: MockListing[]): TourStep[]`
  - `type StepStatus = 'arrived' | 'current' | 'upcoming'`
  - `stepStatus(index: number, currentIndex: number): StepStatus`
  - `interface TourProgress { total; arrivedCount; remainingCount; percent; currentStep: TourStep | null; recent: TourStep[] }`
  - `computeTourProgress(steps: TourStep[], currentIndex: number, recentLimit?: number): TourProgress`
  - `isMistPlaceable(listing: MockListing | null): boolean`
- Consumes: `MockListing`(`../../data/housing/mockListings`)

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/tourNav.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTourSteps, stepStatus, computeTourProgress, isMistPlaceable } from '../tourNav';
import type { MockListing } from '../../../data/housing/mockListings';

const L = (id: string, area = 'Mist'): MockListing =>
  ({ id, ownerUid: 'u', area, ward: 5, plot: 1, size: 'M', imageMode: 'none', tags: [], createdAt: 0 } as MockListing);

describe('resolveTourSteps', () => {
  it('listingIds の順序を保ち、欠落は listing=null にする', () => {
    const pool = [L('b'), L('a')];
    const steps = resolveTourSteps(['a', 'x', 'b'], pool);
    expect(steps.map((s) => s.id)).toEqual(['a', 'x', 'b']);
    expect(steps[0].listing?.id).toBe('a');
    expect(steps[1].listing).toBeNull();
    expect(steps[2].listing?.id).toBe('b');
  });
});

describe('stepStatus', () => {
  it('index<current=arrived / =current / >current=upcoming', () => {
    expect(stepStatus(0, 2)).toBe('arrived');
    expect(stepStatus(2, 2)).toBe('current');
    expect(stepStatus(3, 2)).toBe('upcoming');
  });
});

describe('computeTourProgress', () => {
  it('到着数/残り/％/現在/最近 を算出', () => {
    const steps = resolveTourSteps(['a', 'b', 'c', 'd', 'e'], [L('a'), L('b'), L('c'), L('d'), L('e')]);
    const p = computeTourProgress(steps, 2);
    expect(p.total).toBe(5);
    expect(p.arrivedCount).toBe(2);
    expect(p.remainingCount).toBe(3);
    expect(p.percent).toBe(40);
    expect(p.currentStep?.id).toBe('c');
    expect(p.recent.map((s) => s.id)).toEqual(['b', 'a']); // 直近順
  });
  it('currentIndex===total で完了(currentStep=null・100%)', () => {
    const steps = resolveTourSteps(['a', 'b'], [L('a'), L('b')]);
    const p = computeTourProgress(steps, 2);
    expect(p.currentStep).toBeNull();
    expect(p.percent).toBe(100);
    expect(p.remainingCount).toBe(0);
  });
  it('空ツアーは0%・currentStep=null', () => {
    const p = computeTourProgress([], 0);
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.currentStep).toBeNull();
  });
});

describe('isMistPlaceable', () => {
  it('area==="Mist" のみ true、null/他エリアは false', () => {
    expect(isMistPlaceable(L('a', 'Mist'))).toBe(true);
    expect(isMistPlaceable(L('a', 'LavenderBeds'))).toBe(false);
    expect(isMistPlaceable(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- tourNav`
Expected: FAIL(モジュール未実装)

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/tourNav.ts
import type { MockListing } from '../../data/housing/mockListings';

export interface TourStep {
  id: string;
  listing: MockListing | null;
}

/** listingIds の順序を保ったまま id→listing に写像。プールに無い id は listing=null。 */
export function resolveTourSteps(listingIds: string[], pool: MockListing[]): TourStep[] {
  const byId = new Map(pool.map((l) => [l.id, l]));
  return listingIds.map((id) => ({ id, listing: byId.get(id) ?? null }));
}

export type StepStatus = 'arrived' | 'current' | 'upcoming';

export function stepStatus(index: number, currentIndex: number): StepStatus {
  if (index < currentIndex) return 'arrived';
  if (index === currentIndex) return 'current';
  return 'upcoming';
}

export interface TourProgress {
  total: number;
  arrivedCount: number;
  remainingCount: number;
  percent: number;
  currentStep: TourStep | null;
  recent: TourStep[];
}

/** currentIndex は [0, total] を許容(total=完了)。percent は到着数/総数の整数%。 */
export function computeTourProgress(
  steps: TourStep[],
  currentIndex: number,
  recentLimit = 3,
): TourProgress {
  const total = steps.length;
  const idx = Math.max(0, Math.min(currentIndex, total));
  const arrivedCount = idx;
  const remainingCount = Math.max(0, total - arrivedCount);
  const percent = total === 0 ? 0 : Math.round((arrivedCount / total) * 100);
  const currentStep = idx < total ? steps[idx] : null;
  const recent = steps.slice(Math.max(0, idx - recentLimit), idx).reverse();
  return { total, arrivedCount, remainingCount, percent, currentStep, recent };
}

/** M1: ミストのみ地図配置対象。 */
export function isMistPlaceable(listing: MockListing | null): boolean {
  return !!listing && listing.area === 'Mist';
}
```

- [ ] **Step 4: パス確認**

Run: `npm test -- tourNav`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/tourNav.ts src/lib/housing/__tests__/tourNav.test.ts
rtk git commit -m "feat(housing): ツアー進捗/ステップ解決の純関数 tourNav"
```

> ⚠ 実装時確認: `MockListing.area` の実リテラル(`'Mist'` / `'LavenderBeds'` 等)を `src/data/housing/mockListings.ts`・`src/types/housing.ts` で確認し、テスト/`isMistPlaceable` の文字列を実値に合わせる。

---

## Task 2: 純関数 `wardRoute.ts`(地図経路・配置)

**Files:**
- Create: `src/lib/housing/wardRoute.ts`
- Test: `src/lib/housing/__tests__/wardRoute.test.ts`
- Reference(読むだけ・改変しない): `src/components/housing/workspace/MapView.tsx:15-106`(W/H・NODES/HOUSES・EDGES・ADJ・routeNodes・polyline連結)

**Interfaces:**
- Produces:
  - `WARD_CENTER_NODE: string`(区中央エーテライト相当・現行 `'node_1'`)
  - `interface Placement { x: number; y: number; nodeId: string | null }`
  - `plotToPlacement(plot: number, kind?: 'plot'): Placement | null`(0-1 正規化座標を viewBox px に変換して返す)
  - `buildRoutePath(originNodeId: string, goalNodeId: string): string | null`(SVG path。到達不能で null)
  - `MAP_VIEWBOX: { w: number; h: number }`
- Consumes: `mistWard.generated.json`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/wardRoute.test.ts
import { describe, it, expect } from 'vitest';
import { WARD_CENTER_NODE, plotToPlacement, buildRoutePath, MAP_VIEWBOX } from '../wardRoute';
import mistWard from '../../../data/housing/mistWard.generated.json';

describe('plotToPlacement', () => {
  it('存在する plot は viewBox 内の座標を返す', () => {
    const known = (mistWard.houses as Array<{ kind: string; plot: number }>).find((h) => h.kind === 'plot')!;
    const p = plotToPlacement(known.plot);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThanOrEqual(0);
    expect(p!.x).toBeLessThanOrEqual(MAP_VIEWBOX.w);
    expect(p!.y).toBeGreaterThanOrEqual(0);
    expect(p!.y).toBeLessThanOrEqual(MAP_VIEWBOX.h);
  });
  it('存在しない plot は null', () => {
    expect(plotToPlacement(9999)).toBeNull();
  });
});

describe('buildRoutePath', () => {
  it('中心ノード→既知プロットのノード で path(M...L...) を返す', () => {
    const house = (mistWard.houses as Array<{ kind: string; plot: number; node: string | null }>)
      .find((h) => h.kind === 'plot' && h.node)!;
    const path = buildRoutePath(WARD_CENTER_NODE, house.node!);
    expect(path).toBeTruthy();
    expect(path!.startsWith('M')).toBe(true);
  });
  it('未知ノードは null', () => {
    expect(buildRoutePath(WARD_CENTER_NODE, 'node_zzz')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- wardRoute`
Expected: FAIL(未実装)

- [ ] **Step 3: 実装**(MapView の該当ロジックを純化して移植)

```ts
// src/lib/housing/wardRoute.ts
import mistWard from '../../data/housing/mistWard.generated.json';

export const MAP_VIEWBOX = { w: mistWard.viewBox.w, h: mistWard.viewBox.h };
const W = MAP_VIEWBOX.w;
const H = MAP_VIEWBOX.h;

/** 区中央エーテライト相当(仮置き・M1)。実データでの妥当性は実機で確認(spec §9)。 */
export const WARD_CENTER_NODE = 'node_1';

type Node = { id: string; x: number; y: number };
type House = { kind: string; plot: number; x: number; y: number; node: string | null };
type EdgeData = { a: string; b: string; polyline: [number, number][] };

const NODES = mistWard.nodes as Node[];
const HOUSES = mistWard.houses as House[];
const EDGES = mistWard.edges as unknown as EdgeData[];
const nodeById = new Map(NODES.map((n) => [n.id, n]));

const ADJ = (() => {
  const m = new Map<string, string[]>();
  for (const e of EDGES) {
    (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(e.b);
    (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(e.a);
  }
  return m;
})();

function routeNodes(startId: string, goalId: string): string[] {
  const prev: Record<string, string | null> = { [startId]: null };
  const q = [startId];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goalId) break;
    for (const nx of ADJ.get(cur) ?? []) if (!(nx in prev)) { prev[nx] = cur; q.push(nx); }
  }
  if (!(goalId in prev)) return [];
  const path: string[] = [];
  let c: string | null = goalId;
  while (c) { path.unshift(c); c = prev[c]; }
  return path;
}

export interface Placement { x: number; y: number; nodeId: string | null }

/** plot 番号 → viewBox px 座標。存在しなければ null。 */
export function plotToPlacement(plot: number, kind: 'plot' = 'plot'): Placement | null {
  const h = HOUSES.find((x) => x.plot === plot && x.kind === kind);
  if (!h) return null;
  return { x: h.x * W, y: h.y * H, nodeId: h.node };
}

/** origin ノード → goal ノード の道なり SVG path。未知ノード/到達不能で null。 */
export function buildRoutePath(originNodeId: string, goalNodeId: string): string | null {
  if (!nodeById.has(originNodeId) || !nodeById.has(goalNodeId)) return null;
  const ids = routeNodes(originNodeId, goalNodeId);
  if (ids.length === 0) return null;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ids.length; i++) {
    const a = ids[i];
    const b = ids[i + 1];
    const e = EDGES.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!e) {
      if (i === 0) { const aN = nodeById.get(a)!; pts.push([aN.x * W, aN.y * H]); }
      const bN = nodeById.get(b)!; pts.push([bN.x * W, bN.y * H]);
      continue;
    }
    const seg = e.a === a ? e.polyline : e.polyline.slice().reverse();
    const segPx = seg.map(([px, py]) => [px * W, py * H] as [number, number]);
    if (i === 0) pts.push(...segPx);
    else pts.push(...segPx.slice(1));
  }
  if (pts.length === 0) { // origin===goal 等
    const n = nodeById.get(goalNodeId)!; pts.push([n.x * W, n.y * H]);
  }
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}
```

- [ ] **Step 4: パス確認**

Run: `npm test -- wardRoute`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/wardRoute.ts src/lib/housing/__tests__/wardRoute.test.ts
rtk git commit -m "feat(housing): 地図経路/配置の純関数 wardRoute (MapViewから純化)"
```

---

## Task 3: i18n キー(4言語) + parity

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`(`housing.tour.nav` ブロックを textual に追加)
- Test: 既存 parity 機構に追随(register/edit の parity テストと同型で `housing.tour.nav` の4言語一致を検証)

**Interfaces:**
- Produces: 下記キー(コンポーネントが参照)。

- [ ] **Step 1: ja に追加**(該当ブロックのみ textual 編集・既存 `housing` 配下に `tour.nav` を追加)

```jsonc
// housing.tour.nav (ja)
{
  "title": "ツアー中（ナビゲーション）",
  "live": "情報は自動で更新されます",
  "progress": { "label": "ツアー進行状況", "done_of_total": "{{done}} / {{total}} 軒", "percent_done": "{{percent}}% 完了", "arrived": "到着済み", "remaining": "残り" },
  "next_place": "次に訪れる場所",
  "recent": "最近訪れた場所",
  "finish": "ツアーを終了",
  "complete": { "title": "すべて回りました", "lead": "お疲れさまでした。ツアーを終えて一覧に戻れます。", "back_browse": "探すに戻る", "back_favorites": "お気に入りに戻る" },
  "steps": { "heading": "ルートのステップ", "status": { "arrived": "到着済み", "current": "次に訪問", "upcoming": "未到着" }, "map_pending": "地図は準備中（全エリアは近日）", "missing": "この物件は見つかりません" },
  "actions": { "prev": "前へ", "arrive_next": "到着した → 次へ", "complete": "ツアーを完了" },
  "dest": { "address": "住所", "size": "サイズ", "world": "ワールド", "aetheryte": "最寄りエーテライト", "memo": "ひとことメモ", "no_memo": "メモはありません" },
  "report_button": "情報が違う・報告する",
  "empty": { "title": "ツアーがまだ始まっていません", "lead": "お気に入りから行きたいハウジングを選んでツアーを始めましょう。", "cta": "お気に入りへ" },
  "legend": { "here": "現在地", "next": "次の目的地", "arrived": "到着済み", "upcoming": "未到着", "route": "移動ルート（目安）" }
}
```

- [ ] **Step 2: en / ko / zh に実訳を追加**(JAコピー禁止・各言語の自然な訳。ワールド/エーテライト等のFF14用語は既存 `housing.*` の訳語に合わせる)

en 例(要全キー): `"title": "On Tour (Navigation)"`, `"live": "Updates automatically"`, `"finish": "End tour"`, `"empty.title": "Your tour hasn't started yet"` … 全キーを埋める。
ko/zh も同様に全キーを実訳。

- [ ] **Step 3: parity テストを緑に**

Run: `npm test -- i18n`（または既存の locale parity テスト名）
Expected: `housing.tour.nav` の ja/en/ko/zh キー集合が一致・PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(housing): ツアー中ページのキーを4言語追加"
```

> ⚠ `feedback_locale_json_textual_edit`: 全体 parse→stringify で書き直さない。該当ブロックだけ textual 編集して4言語 parity を保つ。

---

## Task 4: 左カラム `ProgressRing` + `TourProgressPanel`

**Files:**
- Create: `src/components/housing/tour/ProgressRing.tsx`
- Create: `src/components/housing/tour/TourProgressPanel.tsx`
- Modify: `src/styles/housing.css`(`--housing-tour-*` トークン + `.housing-tour-progress*` スタイル。`.housing-workspace` ブロック上部にトークン集約)
- Test: `src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`

**Interfaces:**
- Consumes: `TourProgress`(Task1)、`TourStep`、`formatHousingAddress`
- Produces:
  - `ProgressRing({ percent }: { percent: number })`
  - `TourProgressPanel({ progress, onFinish }: { progress: TourProgress; onFinish: () => void })`

- [ ] **Step 1: 失敗するテストを書く**(表示専用の軽い検証)

```tsx
// __tests__/TourProgressPanel.test.tsx  (先頭に // @vitest-environment happy-dom)
// i18n を initReactI18next で ja init(既存 ListingCard.test.tsx と同型)後:
// - percent 表示("40% 完了")が出る
// - 到着済み/残りの数字が出る
// - 「ツアーを終了」クリックで onFinish が呼ばれる
```

- [ ] **Step 2: 失敗を確認** — Run: `npm test -- TourProgressPanel` / Expected: FAIL
- [ ] **Step 3: 実装**
  - `ProgressRing`: SVG 2円(背景トラック + `stroke-dasharray`/`stroke-dashoffset` で percent 弧)。色は `--housing-aether`(進捗)/`--housing-divider`(トラック)。中央に `{percent}% 完了`。
  - `TourProgressPanel`: リング + 到着済み/残り(`progress.arrivedCount`/`remainingCount`) + 次に訪れる場所カード(`progress.currentStep?.listing` のサムネ + `formatHousingAddress`) + 最近訪れた場所(`progress.recent`) + 「ツアーを終了」ボタン(`onFinish`)。全文言 `housing.tour.nav.*`。色/寸法はトークン。
- [ ] **Step 4: パス確認** — Run: `npm test -- TourProgressPanel` / Expected: PASS
- [ ] **Step 5: コミット** — `feat(housing): ツアー進捗パネル(左カラム)`

---

## Task 5: 中央 `TourNavMap`(実データ駆動の地図)

**Files:**
- Create: `src/components/housing/tour/TourNavMap.tsx`
- Modify: `src/styles/housing.css`(`.housing-tour-map*` + 既存 `.housing-map-*` の再利用可否を確認して流用)
- Test: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`(構造レベルのみ)

**Interfaces:**
- Consumes: `buildRoutePath` / `plotToPlacement` / `WARD_CENTER_NODE` / `MAP_VIEWBOX`(Task2)、`mist.generated.svg?raw`
- Produces:
  - `interface PlacedStep { index: number; plot: number; status: StepStatus }`
  - `TourNavMap({ placed, currentPlot, originNodeId }: { placed: PlacedStep[]; currentPlot: number | null; originNodeId: string })`

- [ ] **Step 1: 失敗するテストを書く**
  - placed を渡すと番号ノードが placed.length 個描画される(data-testid で数える)
  - currentPlot が null なら光経路 path を描画しない
- [ ] **Step 2: 失敗確認** — `npm test -- TourNavMap` / FAIL
- [ ] **Step 3: 実装**(MapView の描画を実データ化。DEMO_PLOTS 撤去)
  - ミスト SVG を `dangerouslySetInnerHTML`(既存 MapView と同じ host class で赤丸隠蔽CSSを効かせる)。
  - overlay `<svg viewBox="0 0 W H">` に: 道アンビエント(既存)、光経路(`currentPlot` の placement.nodeId を goal に `buildRoutePath(originNodeId, goal)`)、目的地の波紋/脈打ち(`plotToPlacement(currentPlot)`)、**現在地マーカー**(origin ノード座標に青丸)。
  - `placed.map` で番号ノード(状態色: arrived=honey✓ / current=aether / upcoming=グレー)を `plotToPlacement(p.plot)` に配置。`data-testid="tour-map-node"`。
  - 凡例(`housing.tour.nav.legend.*`)。LIVE ラベル(`housing.tour.nav.live`)。
  - ※ズーム/再センタリング/ルート再計算は M1 スコープ外(置くなら見た目のみ)。
- [ ] **Step 4: パス確認** — `npm test -- TourNavMap` / PASS
- [ ] **Step 5: コミット** — `feat(housing): ツアー中LIVE地図(実データ駆動)`

> 実機ゲート項目(自動不可): 番号ノード配置・光経路・波紋・現在地マーカー・凡例の視覚を DPR2.58/CSS1489 で目視。

---

## Task 6: 右カラム `TourRouteSteps` + `TourNextDestinationPanel`

**Files:**
- Create: `src/components/housing/tour/TourRouteSteps.tsx`
- Create: `src/components/housing/tour/TourNextDestinationPanel.tsx`
- Modify: `src/styles/housing.css`(`.housing-tour-dest*` / `.housing-tour-steps*`)
- Test: `src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx`

**Interfaces:**
- Consumes: `TourStep` / `stepStatus` / `isMistPlaceable` / `formatHousingAddress`
- Produces:
  - `TourRouteSteps({ steps, currentIndex }: { steps: TourStep[]; currentIndex: number })`
  - `TourNextDestinationPanel({ currentStep, steps, currentIndex, isLast, onPrev, onNext, onComplete, onOpenReport }: {...})`

- [ ] **Step 1: 失敗するテストを書く**
  - `currentStep.listing` の住所/サイズ/ワールド/メモが出る
  - 「前へ」で onPrev、「到着した→次へ」で onNext が呼ばれる
  - `isLast===true` のとき主ボタンが `housing.tour.nav.actions.complete` になり onComplete が呼ばれる
  - `report_button` クリックで onOpenReport が呼ばれる
  - `TourRouteSteps`: 各ステップの状態(arrived/current/upcoming)が `stepStatus` 通りに class/aria に反映、Mist外は `map_pending` 注記、listing=null は `missing` 注記
- [ ] **Step 2: 失敗確認** — `npm test -- TourNextDestinationPanel` / FAIL
- [ ] **Step 3: 実装**
  - `TourNextDestinationPanel`: サムネ + タイトル/ワールド、住所(`formatHousingAddress`)/サイズ/ワールド/最寄りエーテライト(区中央固定表示 or 省略)/ひとことメモ。下に `TourRouteSteps`。操作: 前へ(onPrev・currentIndex===0 で disabled)/主ボタン(isLast? onComplete : onNext)。`report_button`(onOpenReport)。
  - `TourRouteSteps`: `steps.map` で番号+住所+状態バッジ。Mist外/欠落の注記。
- [ ] **Step 4: パス確認** — `npm test -- TourNextDestinationPanel` / PASS
- [ ] **Step 5: コミット** — `feat(housing): 次の目的地パネル+ルートステップ(右カラム)`

---

## Task 7: `TourEmptyState`

**Files:**
- Create: `src/components/housing/tour/TourEmptyState.tsx`
- Modify: `src/styles/housing.css`(`.housing-tour-empty*`)
- Test: `src/components/housing/tour/__tests__/TourEmptyState.test.tsx`

**Interfaces:**
- Produces: `TourEmptyState({ onGoFavorites }: { onGoFavorites: () => void })`

- [ ] **Step 1: 失敗テスト** — 空状態の title/lead が出る、CTA クリックで onGoFavorites 呼び出し
- [ ] **Step 2: 失敗確認** — `npm test -- TourEmptyState` / FAIL
- [ ] **Step 3: 実装** — `housing.tour.nav.empty.*` のヘアライン注記的な静かな空状態 + CTA(お気に入りへ)。AI感箱を避ける。
- [ ] **Step 4: パス確認** — PASS
- [ ] **Step 5: コミット** — `feat(housing): ツアー未開始の空状態`

---

## Task 8: `TourNavPage`(オーケストレーター) + ルート配線

**Files:**
- Create: `src/components/housing/pages/TourNavPage.tsx`
- Modify: `src/App.tsx`(`/housing/tour` の element を `<TourNavPage />` に。`ComingSoonPage tab="tour"` の import が他で不要になれば整理)
- Modify: `src/styles/housing.css`(`.housing-tour-page` 3カラムグリッド)
- Test: `src/components/housing/pages/__tests__/TourNavPage.test.tsx`

**Interfaces:**
- Consumes: 全ストア + `mergeListingsForViewer` + Task1/2 純関数 + Task4-7 部品 + `HousingReportModal`

- [ ] **Step 1: 失敗するテストを書く**
  - `listingIds` 空(store)で `TourEmptyState` が出る(3カラムは出ない)
  - `listingIds` あり + listings 注入で 3カラム(進捗/地図/次の目的地)が出る
  - 「到着した→次へ」で `useHousingTourStore.next` が呼ばれ、進捗が進む
  - `report_button` で `HousingReportModal` が open(現在の listingId)
  - 最終で「完了」→ 完了状態(complete.title)に切替
  - ※ ストア注入は `useHousingTourStore.setState(...)` / `useHousingListingsStore.setState(...)`、`react-router-dom` の `useNavigate` は mock(既存 ListingCard.test 同型)
- [ ] **Step 2: 失敗確認** — `npm test -- TourNavPage` / FAIL
- [ ] **Step 3: 実装**
  - stores 購読(`listingIds/currentIndex/running` + `next/prev/stop/reset` + `exitTourMode`)。
  - `pool = mergeListingsForViewer(listings, myListings, uid, Date.now())` → `steps = resolveTourSteps(listingIds, pool)` → `progress = computeTourProgress(steps, currentIndex)`。
  - 分岐: `listingIds.length===0` → `TourEmptyState`(onGoFavorites=navigate('/housing/favorites'))。`currentIndex>=listingIds.length`(完了) → 完了カード(complete.*・探す/お気に入りへ = `stop();exitTourMode();reset();navigate(...)`)。それ以外 → 3カラム。
  - 地図配線: `placed = steps.map((s,i)=>({index:i, listing:s.listing})).filter(x=>isMistPlaceable(x.listing) && plotToPlacement(x.listing!.plot)).map(...→ {index, plot, status: stepStatus(i,currentIndex)})`。`currentPlot = isMistPlaceable(progress.currentStep?.listing ?? null) ? progress.currentStep!.listing!.plot : null`。`originNodeId = ` 直前到着(steps[currentIndex-1])が Mist ならその plot の nodeId、無ければ `WARD_CENTER_NODE`。
  - 完了はページ側のローカル `completed`(useState)で表現する(**store非破壊**=`next()` の `len-1` クランプは触らない)。`isLast = currentIndex === listingIds.length - 1`。
  - 操作: 前へ=`prev()`(currentIndex===0 で disabled)、到着→次へ=`isLast ? setCompleted(true) : next()`、終了=`() => { stop(); exitTourMode(); reset(); navigate('/housing') }`。
  - 完了分岐は **`completed` state で判定**(currentIndex ではない)。完了カードの「探すに戻る/お気に入りに戻る」= `() => { stop(); exitTourMode(); reset(); setCompleted(false); navigate('/housing' | '/housing/favorites') }`。
  - 報告: `const [reportId, setReportId] = useState<string|null>(null)`。`onOpenReport = () => currentStep?.listing && setReportId(currentStep.listing.id)`。`<HousingReportModal open={!!reportId} listingId={reportId ?? ''} onClose={()=>setReportId(null)} />`。
- [ ] **Step 4: パス確認** — `npm test -- TourNavPage` / PASS
- [ ] **Step 5: コミット** — `feat(housing): ツアー中ページ本体+ルート配線(/housing/tour)`

> 実機ゲート項目: お気に入り→開始→本ページ表示、前へ/次へで地図・進捗連動、報告モーダル、完了、空状態、混在エリア注記。

---

## Task 9: 統合検証 + セルフレビュー

**Files:** なし(検証のみ) / 必要なら微修正

- [ ] **Step 1: build** — Run: `npm run build` / Expected: EXIT 0(tsc厳密含む)
- [ ] **Step 2: 全体テスト** — Run: `npm test` / Expected: 既知 legacy 5 fail のみ・新規fail ゼロ・parity 緑
- [ ] **Step 3: セルフレビュー** — spec §10 受け入れ基準1-9 を各タスクで満たしたか照合。ハードコード grep(`rgb(`/`rgba(`/`#[0-9a-f]{3,8}`/`px;` が新規 tsx に無いか)。i18n 4言語 parity。legacy 非破壊(MapView/TourProgressList/store next 未変更)。
- [ ] **Step 4: コミット(あれば)** — `chore(housing): M1 Nav ページ 統合検証`

---

## 実行メモ(subagent-driven 用)
- モデル目安: Task1/2/3(純関数/i18n)=haiku〜sonnet、Task4-8(UI/統合)=sonnet、Task9/最終ブランチレビュー=最上位。
- **merge/push/deploy はユーザーの実画面ゲート通過まで保留**(新機能・`feedback_deploy`)。実装完了後、`npm run dev`→`/housing/favorites`→開始→`/housing/tour` を DPR2.58/CSS1489 で目視 → OK で本番。
- 地図の視覚は happy-dom で測れない=実機ゲート必須(spec §7)。
- 作業ブランチで進める(履歴クリーンさ・巻き戻し容易さ)。ローカルOK→main。
