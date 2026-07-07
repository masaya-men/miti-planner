# 経路お絵かきツール + 経路セグメント化・ジャンプ弧描画 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザーが実マップ上で道をなぞって経路を描き `wardRouteOverrides.generated.json` に保存できる開発専用ツールを作り、経路データを「道/ジャンプの区間列」化してジャンプを弧で飛ばす。

**Architecture:** 経路 override を `{road, jump}` から `segments: {kind, points}[]` に変える。純関数 `routeToPaths` が segments を実線/弧破線の SVG d に変換し、`buildTourMapPlacements` がそれを使う(TourNavMap は無改造)。オーサリングは入口ツール(`EntranceAuthoringPage` + vite `/__save-entrances`)の姉妹実装。

**Tech Stack:** React + TypeScript + Vite(dev plugin) + Vitest。既存 housing 資産(`useWardMapAsset` / `mapGeometry` / `entranceAuthoring`)を流用。

## Global Constraints

- 保全データ(`nodes`/`edges`/`roadPath`/`outline`/座標/入口)は**一切変更しない**。override レイヤーのみ。
- 開発専用ページ/plugin は `import.meta.env.DEV` gate / vite `apply:'serve'`。本番 build 非含有。
- housing トークン経由(ハードコード色/寸法禁止)。開発ツールは装飾最小で可。
- `npm run build`(tsc -b 厳密) EXIT0。既知 legacy fail 以外の新規 vitest fail ゼロ。
- **push/merge しない**(ユーザー承認まで)。各 task で commit のみ。
- vitest は `pool='vmThreads'` 前提(既存設定に従う・触らない)。

## File Structure

- **Create** `src/lib/housing/routePaths.ts` — `RouteSegment`/`RouteOverride` 型、`routeToPaths`、`arcJumpPath`、`migrateLegacyOverride`
- **Create** `src/lib/housing/__tests__/routePaths.test.ts`
- **Modify** `src/lib/housing/wardRouteOverrides.ts` — 型を routePaths から re-export、`getRouteOverride` は segments 正規化して返す
- **Modify** `src/lib/housing/__tests__/wardRouteOverrides.test.ts` — segments mock に更新
- **Modify** `src/data/housing/wardRouteOverrides.generated.json` — 13 件を segments 形式へ
- **Modify** `src/lib/housing/buildTourMapPlacements.ts:86-102` — override→`routeToPaths`、verbal jump→弧
- **Create** vite `routeSaverPlugin`(vite.config.ts に追記)
- **Create** `src/components/housing/dev/RouteAuthoringPage.tsx`
- **Modify** `src/App.tsx:118-121 付近` — `/housing/dev/routes` ルート(DEV gate)
- **Modify** `src/styles/housing.css` — 必要ならオーサリング用トークン追加

---

## 段階1: データ層(回帰なしで既存挙動維持 + ジャンプ弧化)

### Task 1: routePaths.ts(型 + routeToPaths + arcJumpPath + migrate)

**Files:**
- Create: `src/lib/housing/routePaths.ts`
- Test: `src/lib/housing/__tests__/routePaths.test.ts`

**Interfaces:**
- Produces:
  - `type Pt = [number, number]`
  - `interface RouteSegment { kind: 'road' | 'jump'; points: Pt[] }`
  - `interface RouteOverride { segments: RouteSegment[] }`
  - `routeToPaths(segments: RouteSegment[], w: number, h: number): { routePath: string | null; routeJumpPath: string | null }` — points は 0..1、w/h で px 化
  - `arcJumpPath(pxPts: Pt[]): string` — px 点列を弧破線 d(1 サブパス)に
  - `migrateLegacyOverride(o: { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] }): RouteSegment[]`

- [ ] **Step 1: 失敗するテストを書く** (`routePaths.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { routeToPaths, arcJumpPath, migrateLegacyOverride } from '../routePaths';

describe('routeToPaths', () => {
  it('road セグは M/L 直線サブパスで px 化', () => {
    const { routePath, routeJumpPath } = routeToPaths([{ kind: 'road', points: [[0, 0], [0.5, 0.5]] }], 100, 200);
    expect(routePath).toBe('M0.0 0.0 L50.0 100.0');
    expect(routeJumpPath).toBeNull();
  });
  it('jump セグは Q 弧サブパス、routePath は null', () => {
    const { routePath, routeJumpPath } = routeToPaths([{ kind: 'jump', points: [[0, 0.5], [1, 0.5]] }], 100, 100);
    expect(routePath).toBeNull();
    expect(routeJumpPath).toMatch(/^M0\.0 50\.0 Q/);   // 始点 + 弧
    expect(routeJumpPath).toMatch(/100\.0 50\.0$/);    // 終点で終わる
  });
  it('road+jump 混在は両方返す(各 1 サブパス)', () => {
    const { routePath, routeJumpPath } = routeToPaths(
      [{ kind: 'road', points: [[0, 0], [0.5, 0]] }, { kind: 'jump', points: [[0.5, 0], [1, 0]] }], 100, 100);
    expect(routePath).toBe('M0.0 0.0 L50.0 0.0');
    expect(routeJumpPath).toMatch(/^M50\.0 0\.0 Q/);
  });
  it('点 1 個以下のセグは無視', () => {
    expect(routeToPaths([{ kind: 'road', points: [[0, 0]] }], 100, 100).routePath).toBeNull();
  });
});

describe('migrateLegacyOverride', () => {
  it('{road} を road セグへ', () => {
    expect(migrateLegacyOverride({ road: [[0, 0], [1, 1]], jump: null })).toEqual([{ kind: 'road', points: [[0, 0], [1, 1]] }]);
  });
  it('{road, jump} を road+jump セグへ', () => {
    expect(migrateLegacyOverride({ road: [[0, 0]], jump: [[0, 0], [1, 1]] })).toEqual([
      { kind: 'road', points: [[0, 0]] }, { kind: 'jump', points: [[0, 0], [1, 1]] },
    ]);
  });
  it('segments はそのまま', () => {
    const s = [{ kind: 'jump' as const, points: [[0, 0], [1, 1]] as Pt[] }];
    expect(migrateLegacyOverride({ segments: s })).toBe(s);
  });
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/housing/__tests__/routePaths.test.ts` / Expected: FAIL(module not found)

- [ ] **Step 3: 実装** (`routePaths.ts`)

```ts
export type Pt = [number, number];
export interface RouteSegment { kind: 'road' | 'jump'; points: Pt[] }
export interface RouteOverride { segments: RouteSegment[] }

const ARC_K = 0.22; // 弧の膨らみ = 区間長 × この割合
const f = (n: number) => n.toFixed(1);

function roadSubpath(pxPts: Pt[]): string {
  return pxPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`).join(' ');
}

/** px 点列を、各連続ペアを上向き 2 次ベジェ弧にした 1 サブパス d に。 */
export function arcJumpPath(pxPts: Pt[]): string {
  let d = `M${f(pxPts[0][0])} ${f(pxPts[0][1])}`;
  for (let i = 1; i < pxPts.length; i++) {
    const [ax, ay] = pxPts[i - 1], [bx, by] = pxPts[i];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    // 法線を上向き(y 減少)に固定して弧が上へ膨らむように。
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const cx = mx + nx * len * ARC_K, cy = my + ny * len * ARC_K;
    d += ` Q${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`;
  }
  return d;
}

export function routeToPaths(segments: RouteSegment[], w: number, h: number): { routePath: string | null; routeJumpPath: string | null } {
  const toPx = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x * w, y * h]);
  const road = segments.filter((s) => s.kind === 'road' && s.points.length >= 2).map((s) => roadSubpath(toPx(s.points)));
  const jump = segments.filter((s) => s.kind === 'jump' && s.points.length >= 2).map((s) => arcJumpPath(toPx(s.points)));
  return { routePath: road.length ? road.join(' ') : null, routeJumpPath: jump.length ? jump.join(' ') : null };
}

export function migrateLegacyOverride(o: { road?: Pt[]; jump?: Pt[] | null; segments?: RouteSegment[] }): RouteSegment[] {
  if (o.segments) return o.segments;
  const segs: RouteSegment[] = [];
  if (o.road && o.road.length) segs.push({ kind: 'road', points: o.road });
  if (o.jump && o.jump.length) segs.push({ kind: 'jump', points: o.jump });
  return segs;
}
```

- [ ] **Step 4: パス確認** — Run: `npx vitest run src/lib/housing/__tests__/routePaths.test.ts` / Expected: PASS
- [ ] **Step 5: commit** — `feat(housing): 経路 segments→SVGパス化(routeToPaths/弧/migrate)`

### Task 2: wardRouteOverrides.ts を segments 対応に

**Files:**
- Modify: `src/lib/housing/wardRouteOverrides.ts`
- Modify: `src/lib/housing/__tests__/wardRouteOverrides.test.ts`

**Interfaces:**
- Consumes: `migrateLegacyOverride`, `RouteSegment`, `RouteOverride`(Task 1)
- Produces: `getRouteOverride(mapKey, plotKey): RouteSegment[] | null`(旧/新どちらの JSON でも segments 配列で返す)

- [ ] **Step 1: テストを segments に更新**

```ts
vi.mock('../../../data/housing/wardRouteOverrides.generated.json', () => ({
  default: { mist: { '8': { segments: [{ kind: 'road', points: [[0.44, 0.18], [0.36, 0.22]] }, { kind: 'jump', points: [[0.36, 0.22], [0.385, 0.27]] }] } } },
}));
import { getRouteOverride } from '../wardRouteOverrides';
describe('getRouteOverride', () => {
  it('収録済みは segments を返す', () => {
    const segs = getRouteOverride('mist', '8')!;
    expect(segs[0]).toEqual({ kind: 'road', points: [[0.44, 0.18], [0.36, 0.22]] });
    expect(segs[1].kind).toBe('jump');
  });
  it('未収録は null', () => {
    expect(getRouteOverride('mist', '9')).toBeNull();
    expect(getRouteOverride('goblet', '8')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/wardRouteOverrides.test.ts`

- [ ] **Step 3: 実装**

```ts
import overridesRaw from '../../data/housing/wardRouteOverrides.generated.json';
import { migrateLegacyOverride, type RouteSegment } from './routePaths';

type RawEntry = { road?: [number, number][]; jump?: [number, number][] | null; segments?: RouteSegment[] };
const TABLE = overridesRaw as unknown as Record<string, Record<string, RawEntry>>;

/** (mapKey, plotKey) の手動上書き経路を segments で返す。旧 {road,jump} も segments に正規化。無ければ null。 */
export function getRouteOverride(mapKey: string, plotKey: string): RouteSegment[] | null {
  const raw = TABLE[mapKey]?.[plotKey];
  if (!raw) return null;
  return migrateLegacyOverride(raw);
}
```

- [ ] **Step 4: パス確認** — Expected: PASS
- [ ] **Step 5: commit** — `refactor(housing): getRouteOverride を segments 正規化で返す`

### Task 3: 既存 override 13 件を segments 形式へ変換

**Files:**
- Modify: `src/data/housing/wardRouteOverrides.generated.json`

各エントリを `{ road, jump }` → `{ segments: [{kind:'road', points: <road>}] }` に(全 13 件 jump は null なので road のみ)。例(mist/13):

```json
"13": { "segments": [{ "kind": "road", "points": [[0.64214, 0.49829], [0.64208, 0.52571], [0.61099, 0.52559], [0.61103, 0.50818]] }] }
```

- [ ] **Step 1:** mist(6件: 13/23/25/26/27/28)・mist-sub(8件: 13/22/23/24/25/26/27/28/29)を全て segments 形式に手変換(road 配列はそのまま points に移すだけ)。
- [ ] **Step 2:** Run: `npx vitest run src/lib/housing/__tests__/` / Expected: PASS(Task 2 のテストが実データでも通る)
- [ ] **Step 3: commit** — `data(housing): 経路override 13件を segments 形式へ変換`

### Task 4: buildTourMapPlacements を routeToPaths + 弧に配線

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts:86-102`
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`(既存に追記 or 新規)

**Interfaces:**
- Consumes: `getRouteOverride`(segments), `routeToPaths`, `arcJumpPath`

- [ ] **Step 1: テスト** — segments override(road+jump)の区画で `routePath` が road サブパス、`routeJumpPath` が `Q` を含む弧になること。override 無しは従来経路が維持されること。

- [ ] **Step 2: 実装差し替え**(86-102 行付近)

```ts
    const plotKey = ref.highlightKind === 'apart' ? 'apart' : String(ref.highlightPlot);
    const segs = getRouteOverride(mapKey, plotKey);
    if (segs) {
      const paths = routeToPaths(segs, w, h);
      routePath = paths.routePath;
      routeJumpPath = paths.routeJumpPath;
    } else {
      const verbal = buildVerbalRoute(json, { x: oxPx, y: oyPx }, { x: doorX, y: doorY }, dirVec);
      if (verbal) {
        if (verbal.road.length) {
          routePath = verbal.road.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
        }
        // 破線ジャンプも弧で飛ばす(reroute 由来も統一)。verbal.jump は既に px。
        if (verbal.jump && verbal.jump.length >= 2) routeJumpPath = arcJumpPath(verbal.jump);
      }
    }
```

(import に `routeToPaths, arcJumpPath` を追加。`getRouteOverride` の戻り型変更に追従。)

- [ ] **Step 3: パス確認** — Run: `npx vitest run src/lib/housing/__tests__/` / Expected: PASS
- [ ] **Step 4: build 確認** — Run: `npm run build` / Expected: tsc EXIT0
- [ ] **Step 5: commit** — `feat(housing): 経路描画を segments/弧に配線(reroute jump も弧化)`

### 🔴 段階1 実機ゲート(ユーザー)

`/housing/dev/tour-preview` で既存 override 区画(mist 27/28 等)が**変換前と同じ道**をたどり、ジャンプがある区画で**破線が弧**になることを目視。回帰ゼロ確認後に段階2へ。

---

## 段階2: オーサリング UI + 保存 plugin

### Task 5: vite routeSaverPlugin(/__save-routes)

**Files:**
- Modify: `vite.config.ts`(`entranceSaverPlugin` の直後に追加、plugins 配列にも登録)

- [ ] **Step 1: 実装**(`entranceSaverPlugin` を複製し TARGET/エンドポイント差し替え)

```ts
function routeSaverPlugin(): Plugin {
  const TARGET = resolve(process.cwd(), 'src/data/housing/wardRouteOverrides.generated.json')
  return {
    name: 'route-saver-dev', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-routes', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('JSON object が必要です')
            writeFileSync(TARGET, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
            res.statusCode = 200; res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, maps: Object.keys(parsed).length }))
          } catch (e) {
            res.statusCode = 400; res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}
```

plugins 配列: `entranceSaverPlugin(), routeSaverPlugin(), react(), …`

- [ ] **Step 2: 手動確認** — `curl -X POST localhost:5173/__save-routes -d '{"_probe":{}}'` が `{ok:true}`(直後にファイルを git 復元)
- [ ] **Step 3: commit** — `feat(dev): 経路保存 vite plugin /__save-routes`

### Task 6: RouteAuthoringPage(/housing/dev/routes)

**Files:**
- Create: `src/components/housing/dev/RouteAuthoringPage.tsx`
- Modify: `src/App.tsx`(DEV gate ルート追加、`TourPreviewPage` import の並びに)
- Modify: `src/styles/housing.css`(マーカー/道スナップ表示のトークン、必要分のみ)

**構成**(EntranceAuthoringPage + TourPreviewPage を土台に):
- 巡回: `useHousingTourStore` の listings を `buildAllAddressListings` で流し、前へ/次へ・番地 select(TourPreviewPage 流用)。
- 地図: `useWardMapAsset(mapKey)` の svg を `.housing-map-svg-host`、上に overlay svg(viewBox=json.viewBox)。家ハイライト・起点・入口は buildTourMapPlacements と同じ解決(getPlotOriginNode/getPlotEntrance)。
- 状態: `points: {x,y,kind}[]`(0..1) を現在区画ごとに保持。`mode: 'road'|'jump'`、`snap: boolean`。
- 操作:
  - overlay クリック → `clientToViewBox`(EntranceAuthoringPage と同じ getScreenCTM 方式)→ 0..1 → snap ON なら `nearestPointOnPolylines(px,py, edgesPx)` で最寄り道へ吸着 → points 末尾に `{...pt, kind: mode}`。
  - マーカー drag で移動、クリックで選択→Delete で削除。
  - 起点/入口は「固定端点」として別描画(初期は points が空なら [起点(road), 入口(road)] を種に)。
- プレビュー: points を kind ごとに `RouteSegment[]` にまとめ `routeToPaths` で実線/弧を描画(保存前に見える)。
- 保存: 現在の全区画 override table(`{ [mapKey]: { [plotKey]: { segments } } }`)を組み、`buildFullExport` 相当で空を除き、`POST /__save-routes`。保存後 `saveMsg` に「Claude に伝えて」。

- [ ] **Step 1:** points→segments 変換の純関数 `pointsToSegments(points: {x,y,kind}[]): RouteSegment[]`(連続同 kind をまとめる)を routePaths.ts に追加 + テスト(TDD)。
- [ ] **Step 2:** RouteAuthoringPage 実装(上記構成)。
- [ ] **Step 3:** App.tsx に `{import.meta.env.DEV && <Route path="/housing/dev/routes" element={<RouteAuthoringPage />} />}`。
- [ ] **Step 4:** `npm run build` EXIT0。
- [ ] **Step 5: commit** — `feat(dev): 経路お絵かきページ /housing/dev/routes`

### 🔴 段階2 実機ゲート(ユーザー)

`/housing/dev/routes` で mist-sub 13 を開き、道をなぞって描く→ジャンプ登録→保存→`/housing/dev/tour-preview` で弧と道追従を確認。

---

## 段階3: 全310 実機点検

### Task 7: 全マップ巡回(ユーザー主導)

- [ ] ユーザーが `/housing/dev/routes` で全310を巡回、おかしい区画を自分で描き直して保存。
- [ ] 完了後 `npm run build` + `npx vitest run` 緑を確認 → commit 群を整理 → finishing-a-development-branch。

---

## Self-Review

- **Spec coverage:** segments 化(Task1-3)/routeToPaths 弧(Task1)/buildTourMapPlacements 配線+verbal jump 弧(Task4)/vite plugin(Task5)/オーサリングページ(Task6)/実機点検(Task7)。spec 全項目に対応 task あり。
- **Placeholder scan:** 主要純関数は実コード。UI(Task6)は spec 方針通り「純関数のみ TDD、UI 自体は手動確認」。
- **Type consistency:** `RouteSegment {kind, points}` / `routeToPaths(segments,w,h)` / `getRouteOverride→RouteSegment[]|null` / `arcJumpPath(pxPts)` を全 task で一貫使用。
