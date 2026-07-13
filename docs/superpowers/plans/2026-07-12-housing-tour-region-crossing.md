# ツアーのリージョン/DC/ワールド跨ぎ処理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアーで別リージョンの家を混ぜられないようにし、DC/ワールドを跨ぐ地点では正しい移動指示(データセンタートラベル/ワールド訪問)を右パネルと中央マップに出す。

**Architecture:** 移動判定を副作用なしの純関数 `tourCrossing.ts` に集約。リージョン跨ぎは「追加時ブロック(主)+開始時セーフティネット(保険)」の二段。DC/ワールド跨ぎは前の家→次の家の比較結果を TourNavPage が算出し、右パネル(TourPhaseZone)の指示行と中央マップ(TourNavMap)のぼかし案内カードへ流す。一時追加のワールド必須化で「不明な地点」を構造的に消す。

**Tech Stack:** React + TypeScript + Zustand、vitest、react-i18next(ja/en/ko/zh 4言語)、housing.css の `--housing-*` トークン。

## Global Constraints

- **仕様書**: `docs/superpowers/specs/2026-07-12-housing-tour-region-crossing-design.md`
- **i18n**: 全 UI 文字列は i18n キー経由。**ja/en/ko/zh の4言語 parity** を毎回維持。ロケール JSON は該当ブロックだけ textual 編集(全体 parse→stringify 禁止)。DC/ワールド名は原語表記のまま補間。
- **housing トークン**: 色/寸法/影のハードコード禁止。`src/styles/housing.css` の `--housing-*` トークン経由。ぼかしは `--tw-backdrop-blur` 変数パターン(直書き `blur()` 禁止・`.claude/rules/css-rules.md`)。
- **純関数**: `tourCrossing.ts` は副作用禁止(store/DOM/Date 触らない)。
- **緑ゲート**: 各タスク末で対象テスト緑。全タスク後に `npm run build`(tsc -b 厳密・未使用変数/型不足が罠)+ `vitest run` 全緑を確認してから完了宣言。
- **トースト**: グローバル `showToast(message, 'error'|'info'|'success')`(`src/components/Toast.tsx`)を使用。
- **ブランチ**: `integration/housing-big3`(既存)。本番デプロイはユーザーのローカル確認ゲート後(このプランの範囲外)。

## テスト基盤メモ(全 page/component テスト共通・サブエージェント向け)

- **環境**: ファイル先頭に `// @vitest-environment happy-dom`。i18n は `beforeAll` で
  `i18n.use(initReactI18next).init({ lng:'ja', resources:{ ja:{ translation: jaTranslations } }, interpolation:{ escapeValue:false } })`、
  描画は `<I18nextProvider i18n={i18n}>…</I18nextProvider>`(既存テスト踏襲)。
- **listing の生成**: `MockListing` は最低 `id/ownerUid/dc/server/region/area/ward/buildingType/plot/size/imageMode/tags/title/createdAt/lastConfirmedAt/addressKey` を持つ。
  例(JP・Elemental/Aegis): `{ ...共通, dc:'Elemental', server:'Aegis', region:'JP', area:'Mist', ward:12, buildingType:'house', plot:1 }`。
  別リージョン例(NA・Aether/Gilgamesh): `region:'NA', dc:'Aether', server:'Gilgamesh'`。`serverMasterData`/`dcServerMap` の実在値を使う。
- **ストア注入**: `useHousingListingsStore.setState({ status:'ready', listings:[...], myListings:[] })` /
  `useHousingTourStore.setState({ listingIds, running:true, currentIndex:0, phase:'moving', viewStartAt:null })` /
  `useEphemeralListingsStore.getState().clear()`。`beforeEach` で各ストアをリセット。
- **navigate/showToast のスパイ**: `const navigate = vi.fn(); vi.mock('react-router-dom', async () => ({ ...await vi.importActual('react-router-dom'), useNavigate: () => navigate }))`。
  トーストは `vi.mock('<相対>/components/Toast', () => ({ showToast: vi.fn() }))` にして `expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error')` を検証。
- **DC/サーバーの有効値**: DC='Elemental'→サーバー='Aegis'(JP)、DC='Gaia'→'Ifrit'(JP・別DC)、DC='Aether'→'Gilgamesh'(NA・別リージョン)。

## File Structure

| ファイル | 責務 | 変更種別 |
|----------|------|----------|
| `src/lib/housing/tourCrossing.ts` | 移動判定の純関数(crossingBetween / canAddToTour / tourRegionConflict) | 新規 |
| `src/lib/housing/__tests__/tourCrossing.test.ts` | 上のユニットテスト | 新規 |
| `src/lib/housing/ephemeralListing.ts` | validateEphemeralInput に dc/server 必須 | 変更 |
| `src/components/housing/browse/EphemeralAddPanel.tsx` | complete 条件に dc/server | 変更 |
| `src/components/housing/browse/TourTray.tsx` | 一時追加を親の guard 済みコールバックへ | 変更 |
| `src/components/housing/pages/BrowsePage.tsx` | addToTray に region guard / onStart に開始 net | 変更 |
| `src/components/housing/pages/FavoritesPage.tsx` | addToTray に region guard / commitStart に開始 net | 変更 |
| `src/components/housing/pages/HousingerPage.tsx` | onTourAll に開始 net | 変更 |
| `src/components/housing/pages/TourNavPage.tsx` | crossing 算出 + ack state / onStartEphemeral に開始 net | 変更 |
| `src/components/housing/tour/TourProgressPanel.tsx` | crossing を TourPhaseZone へ中継 | 変更 |
| `src/components/housing/tour/TourPhaseZone.tsx` | 跨ぎ指示行を描画 | 変更 |
| `src/components/housing/tour/TourNavMap.tsx` | ぼかし + 案内カードを描画 | 変更 |
| `src/styles/housing.css` | 跨ぎカード/ぼかしの token | 変更 |
| `src/locales/{ja,en,ko,zh}.json` | 新規 i18n キー | 変更 |

---

### Task 1: 移動判定の純関数 `tourCrossing.ts`

**Files:**
- Create: `src/lib/housing/tourCrossing.ts`
- Test: `src/lib/housing/__tests__/tourCrossing.test.ts`

**Interfaces:**
- Produces:
  - `type TourCrossing = { kind: 'none' } | { kind: 'world'; world: string } | { kind: 'dc'; dc: string; world: string } | { kind: 'region' }`
  - `crossingBetween(prev: Loc | null, current: Loc): TourCrossing`(`Loc = Pick<MockListing,'region'|'dc'|'server'>`)
  - `canAddToTour(trayRegion: string | null, candidateRegion: string): boolean`
  - `tourRegionConflict(stops: Loc[]): string[] | null`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/housing/__tests__/tourCrossing.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { crossingBetween, canAddToTour, tourRegionConflict } from '../tourCrossing';

const loc = (region: string, dc: string, server: string) => ({ region, dc, server });

describe('crossingBetween', () => {
  it('prev=null(1件目)は none', () => {
    expect(crossingBetween(null, loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('全一致は none', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('別ワールド・同DC は world(着地ワールド名)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Titan'))).toEqual({ kind: 'world', world: 'Titan' });
  });
  it('別DC・同リージョン は dc(DC名+着地ワールド)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit'))).toEqual({ kind: 'dc', dc: 'Gaia', world: 'Ifrit' });
  });
  it('別リージョン は region', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh'))).toEqual({ kind: 'region' });
  });
});

describe('canAddToTour', () => {
  it('空トレイ(null)は何でも可', () => {
    expect(canAddToTour(null, 'NA')).toBe(true);
  });
  it('同リージョンは可', () => {
    expect(canAddToTour('JP', 'JP')).toBe(true);
  });
  it('別リージョンは不可', () => {
    expect(canAddToTour('JP', 'NA')).toBe(false);
  });
});

describe('tourRegionConflict', () => {
  it('単一リージョンは null', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit')])).toBeNull();
  });
  it('空配列は null', () => {
    expect(tourRegionConflict([])).toBeNull();
  });
  it('混在は相異なるリージョン配列', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh')])).toEqual(['JP', 'NA']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/tourCrossing.test.ts`
Expected: FAIL（`tourCrossing` モジュールが存在しない）

- [ ] **Step 3: 最小実装** — `src/lib/housing/tourCrossing.ts`

```ts
import type { MockListing } from '../../data/housing/mockListings';

/** 隣接2地点(前の家→次の家)の移動種別。 */
export type TourCrossing =
  | { kind: 'none' }
  | { kind: 'world'; world: string }            // ワールド訪問(同DC・別ワールド)
  | { kind: 'dc'; dc: string; world: string }   // DCトラベル(別DC・同リージョン)。着地ワールドも持つ
  | { kind: 'region' };                          // 別リージョン(通常はブロックで来ない・防御表示)

type Loc = Pick<MockListing, 'region' | 'dc' | 'server'>;

/** prev=null(1件目)は 'none'。判定順: region → dc → server。 */
export function crossingBetween(prev: Loc | null, current: Loc): TourCrossing {
  if (!prev) return { kind: 'none' };
  if (prev.region !== current.region) return { kind: 'region' };
  if (prev.dc !== current.dc) return { kind: 'dc', dc: current.dc, world: current.server };
  if (prev.server !== current.server) return { kind: 'world', world: current.server };
  return { kind: 'none' };
}

/** トレイに追加してよいか。空トレイ(trayRegion=null)は何でも可、以降は同リージョンのみ。 */
export function canAddToTour(trayRegion: string | null, candidateRegion: string): boolean {
  return trayRegion === null || trayRegion === candidateRegion;
}

/** 地点集合に含まれる相異なるリージョン。1種以下なら null(=問題なし)。 */
export function tourRegionConflict(stops: Loc[]): string[] | null {
  const regions = [...new Set(stops.map((s) => s.region))];
  return regions.length > 1 ? regions : null;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/tourCrossing.test.ts`
Expected: PASS（11 tests）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/tourCrossing.ts src/lib/housing/__tests__/tourCrossing.test.ts
rtk git commit -m "feat(housing): ツアー移動判定の純関数 tourCrossing (crossing/canAdd/conflict)"
```

---

### Task 2: 一時追加のワールド必須化

**Files:**
- Modify: `src/lib/housing/ephemeralListing.ts`(`EphemeralValidation` 型 + `validateEphemeralInput`)
- Modify: `src/components/housing/browse/EphemeralAddPanel.tsx`(`complete` 条件・185-195 行付近)
- Test: `src/lib/housing/__tests__/ephemeralListing.test.ts`(既存に追記)/ 既存 `src/__tests__/housing/EphemeralAddPanel.test.tsx` の更新

**Interfaces:**
- Consumes: なし
- Produces: `validateEphemeralInput` が dc/server 未充足で `{ ok:false, error:'missing_dc'|'missing_server' }` を返す

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/housing/__tests__/ephemeralListing.test.ts` に追記

```ts
import { validateEphemeralInput } from '../ephemeralListing';

describe('validateEphemeralInput: ワールド必須', () => {
  const base = { area: 'Mist' as const, ward: 3, buildingType: 'house' as const, plot: 15 };
  it('dc 未指定は missing_dc', () => {
    expect(validateEphemeralInput({ ...base, server: 'Anima' })).toEqual({ ok: false, error: 'missing_dc' });
  });
  it('server 未指定は missing_server', () => {
    expect(validateEphemeralInput({ ...base, dc: 'Mana' })).toEqual({ ok: false, error: 'missing_server' });
  });
  it('dc+server 揃えば ok', () => {
    expect(validateEphemeralInput({ ...base, dc: 'Mana', server: 'Anima' })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/ephemeralListing.test.ts`
Expected: FAIL（現状 dc/server を検証しないため missing_dc を返さない）

- [ ] **Step 3: 実装** — `ephemeralListing.ts`

`EphemeralValidation` の error union に `'missing_dc' | 'missing_server'` を追加:

```ts
export type EphemeralValidation =
  | { ok: true }
  | { ok: false; error: 'missing_dc' | 'missing_server' | 'invalid_area' | 'invalid_ward' | 'invalid_plot' | 'invalid_room' };
```

`validateEphemeralInput` の先頭(area チェックの前)に追加:

```ts
export function validateEphemeralInput(input: EphemeralInput): EphemeralValidation {
  if (!input.dc || input.dc.trim() === '') {
    return { ok: false, error: 'missing_dc' };
  }
  if (!input.server || input.server.trim() === '') {
    return { ok: false, error: 'missing_server' };
  }
  if (!isValidHousingArea(input.area)) {
    return { ok: false, error: 'invalid_area' };
  }
  // …以降は既存のまま…
```

- [ ] **Step 4: EphemeralAddPanel の complete 条件に dc/server を追加** — `EphemeralAddPanel.tsx:191-195`

```ts
  const isApartment = address.buildingType === 'apartment';
  const complete =
    address.dc !== undefined &&
    address.dc !== '' &&
    address.server !== undefined &&
    address.server !== '' &&
    address.area !== undefined &&
    address.area !== '' &&
    address.ward !== undefined &&
    (isApartment ? address.roomNumber !== undefined : address.plot !== undefined);
```

- [ ] **Step 5: 既存テストを更新** — `src/__tests__/housing/EphemeralAddPanel.test.tsx`

`fillHouse` ヘルパ(28-32 行)に **DC='Elemental' → サーバー='Aegis'**(`serverMasterData` の実在値・JP)の選択を先頭に足す。サーバーセレクトは `disabled={!dc}` なので **DC を先に** 選ぶこと:

```ts
const fillHouse = (area: string, ward: string, plot: string) => {
  fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Elemental' } });
  fireEvent.change(screen.getByLabelText('サーバー'), { target: { value: 'Aegis' } });
  fireEvent.change(screen.getByLabelText('エリア'), { target: { value: area } });
  fireEvent.change(screen.getByLabelText('区'), { target: { value: ward } });
  fireEvent.change(screen.getByLabelText('番地'), { target: { value: plot } });
};
```

これで ①④⑤(fillHouse で活性/追加を検証)は回帰しない。② はもともと area 欠落で非活性なので変更不要。
さらに **DC/サーバー未選択なら非活性** のテストを1件追加:

```ts
it('⑧ DC/サーバー未選択だと「ツアーに追加」は非活性 (エリア/区/番地だけでは不可)', () => {
  wrap(<EphemeralAddPanel open onClose={() => {}} onAdd={() => {}} />);
  fireEvent.change(screen.getByLabelText('エリア'), { target: { value: 'Mist' } });
  fireEvent.change(screen.getByLabelText('区'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('番地'), { target: { value: '15' } });
  expect(addButton().disabled).toBe(true);
});
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/ephemeralListing.test.ts src/__tests__/housing/EphemeralAddPanel.test.tsx`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/housing/ephemeralListing.ts src/components/housing/browse/EphemeralAddPanel.tsx src/lib/housing/__tests__/ephemeralListing.test.ts src/__tests__/housing/EphemeralAddPanel.test.tsx
rtk git commit -m "feat(housing): 一時追加のDC・サーバー必須化 (ワールド不明地点を構造的に排除)"
```

---

### Task 3: リージョン跨ぎの追加時ブロック

**Files:**
- Modify: `src/components/housing/browse/TourTray.tsx`(一時追加を親の guard へ)
- Modify: `src/components/housing/pages/BrowsePage.tsx`(`addToTray` に guard)
- Modify: `src/components/housing/pages/FavoritesPage.tsx`(`addToTray` に guard)
- Modify: `src/locales/{ja,en,ko,zh}.json`(`housing.tour.region_block`)
- Test: `src/components/housing/pages/__tests__/BrowsePage.test.tsx`(無ければ新規・最小)

**Interfaces:**
- Consumes: `canAddToTour`(Task 1)
- Produces: TourTray に prop `onAdd: (id: string) => void`

- [ ] **Step 1: i18n キー追加(4言語)** — 各ロケール `housing.tour` 直下(`nav` の兄弟)に `region_block` を追加

ja: `"region_block": "別リージョンの家は同じツアーに入れられません"`
en: `"region_block": "Houses in a different region can't be added to the same tour"`
ko: `"region_block": "다른 리전의 집은 같은 투어에 담을 수 없습니다"`
zh: `"region_block": "不同大区的房屋无法加入同一导览"`

- [ ] **Step 2: TourTray に guard 済み追加 prop を通す** — `TourTray.tsx`

`TourTrayProps` に `onAdd: (id: string) => void;` を追加。`EphemeralAddPanel` の `onAdd` を親のものに差し替える(生 onChange 連結をやめる):

```tsx
export interface TourTrayProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  onStart: () => void;
  onAdd: (id: string) => void;
}
// …
export const TourTray: React.FC<TourTrayProps> = ({ listingIds, onChange, onStart, onAdd }) => {
  // …
      <EphemeralAddPanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAdd}
      />
```

- [ ] **Step 3: BrowsePage.addToTray に guard + TourTray へ onAdd 配線** — `BrowsePage.tsx`

import 追加:

```ts
import { showToast } from '../../Toast';
import { canAddToTour } from '../../../lib/housing/tourCrossing';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
```

`addToTray`(現 80-81 行)を差し替え。一時 listing はストアから **fresh** に解決する(追加直後の stale closure 回避):

```ts
  const addToTray = (id: string) => {
    const eph = useEphemeralListingsStore.getState().ephemeralListings;
    const candidate = merged.find((l) => l.id === id) ?? eph.find((l) => l.id === id);
    if (!candidate) return;
    const pool = [...merged, ...eph];
    const trayRegion =
      trayIds.length > 0 ? (pool.find((l) => l.id === trayIds[0])?.region ?? null) : null;
    if (!canAddToTour(trayRegion, candidate.region)) {
      showToast(t('housing.tour.region_block'), 'error');
      return;
    }
    setTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
```

`<TourTray>` に `onAdd={addToTray}` を追加(`t` は既存の useTranslation から。無ければ `const { t } = useTranslation();` を確認)。

- [ ] **Step 4: FavoritesPage.addToTray に guard + TourTray へ onAdd 配線** — `FavoritesPage.tsx`

import 追加: `import { canAddToTour } from '../../../lib/housing/tourCrossing';`、`import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';`(showToast は既存)。

`addToTray`(72-86 行)を差し替え。ephemeral id は expand を通さず直接追加、registered は既存 expand を維持。別リージョンは弾いて最後にトースト:

```ts
  const addToTray = useCallback((idsToAdd: string[]) => {
    const eph = useEphemeralListingsStore.getState().ephemeralListings;
    const pool = [...allListings, ...eph];
    const regionOf = (id: string) => pool.find((l) => l.id === id)?.region ?? null;
    let nextIds = trayIds;
    let totalAutoAdded = 0;
    let blocked = false;
    for (const addId of idsToAdd) {
      const trayRegion = nextIds.length > 0 ? regionOf(nextIds[0]) : null;
      const candRegion = regionOf(addId);
      if (candRegion !== null && !canAddToTour(trayRegion, candRegion)) { blocked = true; continue; }
      if (isEphemeralListingId(addId)) {
        if (!nextIds.includes(addId)) nextIds = [...nextIds, addId];
        continue;
      }
      const r = expandTourWithDuplicates(nextIds, addId, allListings);
      if (r.nextIds.length === nextIds.length) continue;
      nextIds = r.nextIds;
      totalAutoAdded += r.autoAddedCount;
    }
    if (nextIds.length !== trayIds.length) {
      setTrayIds(nextIds);
      if (totalAutoAdded > 0) {
        showToast(t('housing.workspace.tour.auto_added_toast', { count: totalAutoAdded }), 'info');
      }
    }
    if (blocked) showToast(t('housing.tour.region_block'), 'error');
  }, [trayIds, allListings, t]);
```

`<TourTray>` に `onAdd={(id) => addToTray([id])}` を追加。

- [ ] **Step 5: テスト(BrowsePage の追加ブロック)**

`BrowsePage.test.tsx` に、trayIds に JP の listing がある状態で NA の listing を addToTray 相当で追加 → trayIds が増えず `showToast` が 'error' で呼ばれることを検証(showToast を `vi.mock('../../Toast')` でスパイ)。ストア/listings のセットアップは既存 housing テストのパターンに合わせる。

- [ ] **Step 6: 対象テスト緑を確認**

Run: `npx vitest run src/components/housing/pages/__tests__/BrowsePage.test.tsx src/components/housing/pages/__tests__/FavoritesPage.test.tsx`
Expected: PASS(既存回帰なし)

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/browse/TourTray.tsx src/components/housing/pages/BrowsePage.tsx src/components/housing/pages/FavoritesPage.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/pages/__tests__/BrowsePage.test.tsx
rtk git commit -m "feat(housing): リージョン跨ぎツアーの追加時ブロック (探す/お気に入り/一時追加)"
```

---

### Task 4: リージョン跨ぎの開始時セーフティネット

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx`(`onStart`)
- Modify: `src/components/housing/pages/FavoritesPage.tsx`(`commitStart`)
- Modify: `src/components/housing/pages/HousingerPage.tsx`(`onTourAll`)
- Modify: `src/components/housing/pages/TourNavPage.tsx`(`onStartEphemeral`)
- Modify: `src/locales/{ja,en,ko,zh}.json`(`housing.tour.region_block_start`)
- Test: 既存 page テストに追記

**Interfaces:**
- Consumes: `tourRegionConflict`(Task 1)、`orderTourStopIds`(既存)

- [ ] **Step 1: i18n キー追加(4言語)** — `housing.tour.region_block_start`

ja: `"region_block_start": "このツアーは複数リージョン({{regions}})の家を含むため開始できません。1つのリージョンに絞ってください"`
en: `"region_block_start": "This tour spans multiple regions ({{regions}}) and can't start. Keep houses from a single region."`
ko: `"region_block_start": "이 투어는 여러 리전({{regions}})의 집을 포함하고 있어 시작할 수 없습니다. 한 리전으로 좁혀 주세요"`
zh: `"region_block_start": "该导览包含多个大区（{{regions}}）的房屋，无法开始。请仅保留同一大区的房屋"`

- [ ] **Step 2: BrowsePage.onStart に net** — `BrowsePage.tsx`

import: `import { orderTourStopIds } from '../../../lib/housing/orderTourStops';`(既存)、`import { tourRegionConflict } from '../../../lib/housing/tourCrossing';`、`import type { MockListing } from '../../../data/housing/mockListings';`(既存確認)。

```ts
  const onStart = () => {
    if (trayIds.length === 0) return;
    const pool = [...merged, ...ephemeral];
    const orderedIds = orderTourStopIds(trayIds, pool);
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    navigate('/housing/tour');
  };
```

- [ ] **Step 3: FavoritesPage.commitStart に net** — `FavoritesPage.tsx`(114-123 行)

`tourRegionConflict` を import。`orderedIds` の直後に:

```ts
    const orderedIds = orderTourStopIds(trayIds, [...allListings, ...ephemeral]);
    const pool = [...allListings, ...ephemeral];
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
```

(`t` は commitStart の依存配列に追加。`MockListing` 型 import 確認。)

- [ ] **Step 4: HousingerPage.onTourAll に net** — `HousingerPage.tsx:137-144`

`tourRegionConflict` import(`showToast`/`t` は既存)。

```ts
  const onTourAll = () => {
    const ids = listings.map((l) => l.id);
    const orderedIds = orderTourStopIds(ids, listings);
    const stops = orderedIds
      .map((id) => listings.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    navigate('/housing/tour');
  };
```

- [ ] **Step 5: TourNavPage.onStartEphemeral に net** — `TourNavPage.tsx:122-132`

`tourRegionConflict` + `showToast` import。

```ts
  const onStartEphemeral = useCallback(() => {
    if (emptyTrayIds.length === 0) return;
    const pool = useEphemeralListingsStore.getState().ephemeralListings;
    const orderedIds = orderTourStopIds(emptyTrayIds, pool);
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    setEmptyTrayIds([]);
  }, [emptyTrayIds, t]);
```

(`MockListing` 型 import 確認。)

- [ ] **Step 6: テスト**

`HousingerPage` テスト(または新規)に、別リージョン混在の gallery で `onTourAll` 相当 → start されず showToast('error') を検証。純関数 `tourRegionConflict` は Task 1 で担保済みなので、ここは配線1件で足りる。

Run: `npx vitest run src/components/housing/pages/__tests__/`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/pages/BrowsePage.tsx src/components/housing/pages/FavoritesPage.tsx src/components/housing/pages/HousingerPage.tsx src/components/housing/pages/TourNavPage.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/pages/__tests__/HousingerPage.test.tsx
rtk git commit -m "feat(housing): リージョン跨ぎツアーの開始時セーフティネット (全開始経路)"
```

---

### Task 5: DC/ワールド指示(右パネル 行き方枠)

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`(crossing 算出 + 中継)
- Modify: `src/components/housing/tour/TourProgressPanel.tsx`(crossing 中継)
- Modify: `src/components/housing/tour/TourPhaseZone.tsx`(跨ぎ行描画)
- Modify: `src/locales/{ja,en,ko,zh}.json`(`housing.tour.nav.cross.{dc,world,region}`)
- Test: `src/components/housing/tour/__tests__/TourPhaseZone.test.tsx`(追記)

**Interfaces:**
- Consumes: `crossingBetween`, `TourCrossing`(Task 1)
- Produces: `TourPhaseZone` に prop `crossing?: TourCrossing`(**省略可・default `{ kind: 'none' }`**)、`TourProgressPanel` に prop `crossing?: TourCrossing`(同上)。
  → **省略可にすることで既存テスト(crossing を渡さない TourPhaseZone/TourProgressPanel テスト)は無改修**。新規テストだけが crossing を渡す。

- [ ] **Step 1: i18n キー追加(4言語)** — `housing.tour.nav.cross`

ja:
```json
"cross": {
  "dc": "まずデータセンタートラベルで {{dc}} の {{world}} へ",
  "world": "まずワールド訪問で {{world}} へ",
  "region": "この家は別リージョンにあり移動できません",
  "ack": "移動しました（地図を見る）"
}
```
en:
```json
"cross": {
  "dc": "First, use Data Center Travel to reach {{world}} in {{dc}}",
  "world": "First, use World Visit to reach {{world}}",
  "region": "This house is in another region and can't be reached",
  "ack": "I've traveled (show the map)"
}
```
ko:
```json
"cross": {
  "dc": "먼저 데이터 센터 이동으로 {{dc}}의 {{world}}(으)로 이동하세요",
  "world": "먼저 월드 방문으로 {{world}}(으)로 이동하세요",
  "region": "이 집은 다른 리전에 있어 이동할 수 없습니다",
  "ack": "이동했습니다 (지도 보기)"
}
```
zh:
```json
"cross": {
  "dc": "请先使用数据中心旅行前往 {{dc}} 的 {{world}}",
  "world": "请先使用跨服访问前往 {{world}}",
  "region": "该房屋位于其他大区，无法前往",
  "ack": "我已移动（查看地图）"
}
```

- [ ] **Step 2: TourPhaseZone に crossing prop + 跨ぎ行(失敗するテスト)** — `TourPhaseZone.test.tsx` に追記

```tsx
import type { TourCrossing } from '../../../../lib/housing/tourCrossing';

const renderZone = (crossing: TourCrossing, directions = null) =>
  render(<I18nextProvider i18n={i18n}><TourPhaseZone phase="moving" directions={directions} viewStartAt={null} crossing={crossing} /></I18nextProvider>);

it('dc 跨ぎで DCトラベル行が出る', () => {
  renderZone({ kind: 'dc', dc: 'Gaia', world: 'Ifrit' });
  expect(screen.getByTestId('tour-phase-cross')).toHaveTextContent('Gaia');
  expect(screen.getByTestId('tour-phase-cross')).toHaveTextContent('Ifrit');
});
it('none 跨ぎでは行が出ない', () => {
  renderZone({ kind: 'none' });
  expect(screen.queryByTestId('tour-phase-cross')).toBeNull();
});
```

(既存3テストは crossing を渡さない → default `{ kind: 'none' }` で従来挙動のまま。無改修。)

- [ ] **Step 3: TourPhaseZone 実装** — `TourPhaseZone.tsx`

props に `crossing?: TourCrossing`(省略可・default none)を追加(import `type { TourCrossing } from '../../../lib/housing/tourCrossing'`)。移動フェーズで directions が無くても跨ぎ行は出す:

```tsx
export interface TourPhaseZoneProps {
  phase: 'moving' | 'viewing';
  directions: PlotDirections | null;
  viewStartAt: number | null;
  /** 前の家→この家の移動種別。省略時は跨ぎ無し扱い。 */
  crossing?: TourCrossing;
}

export const TourPhaseZone: React.FC<TourPhaseZoneProps> = ({ phase, directions, viewStartAt, crossing = { kind: 'none' } }) => {
  const { t } = useTranslation();
  const elapsed = useElapsed(phase === 'viewing' ? viewStartAt : null);

  if (phase === 'viewing' && viewStartAt != null) {
    return ( /* …既存タイマー… */ );
  }

  const crossLine =
    crossing.kind === 'dc' ? t('housing.tour.nav.cross.dc', { dc: crossing.dc, world: crossing.world })
    : crossing.kind === 'world' ? t('housing.tour.nav.cross.world', { world: crossing.world })
    : crossing.kind === 'region' ? t('housing.tour.nav.cross.region')
    : null;

  if (!directions && !crossLine) {
    return <div className="housing-tour-phasezone housing-tour-phasezone-empty" aria-hidden="true" />;
  }

  return (
    <div className="housing-tour-phasezone housing-tour-phasezone-route">
      {crossLine && (
        <p className="housing-tour-phasezone-cross" data-testid="tour-phase-cross">{crossLine}</p>
      )}
      {directions && (
        <>
          <span className="housing-tour-phasezone-route-label">{t('housing.tour.nav.dest.directions')}</span>
          <p className="housing-tour-phasezone-route-teleport">
            {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
          </p>
          {directions.directions && (
            <p className="housing-tour-phasezone-route-walk">{directions.directions}</p>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 4: TourProgressPanel に crossing 中継** — `TourProgressPanel.tsx`

props に `crossing?: TourCrossing`(省略可・default `{ kind: 'none' }`)を追加(import 型)。分割代入で `crossing = { kind: 'none' }` を既定にし、`<TourPhaseZone ... crossing={crossing} />` を渡す。既存 TourProgressPanel テストは crossing 未指定でも通る。

- [ ] **Step 5: TourNavPage で crossing 算出 + 中継** — `TourNavPage.tsx`

import: `import { crossingBetween, type TourCrossing } from '../../../lib/housing/tourCrossing';`

`currentListing`/`directions` の近く(74-78 行付近)に追加:

```ts
  const prevStep = useMemo(
    () => (currentIndex - 1 >= 0 ? steps[currentIndex - 1] : null),
    [steps, currentIndex],
  );
  const crossing: TourCrossing = useMemo(
    () => (currentListing ? crossingBetween(prevStep?.listing ?? null, currentListing) : { kind: 'none' }),
    [prevStep, currentListing],
  );
```

`<TourProgressPanel ... />` に `crossing={crossing}` を追加。

- [ ] **Step 6: テスト緑を確認(TourPhaseZone/TourProgressPanel/TourNavPage)**

Run: `npx vitest run src/components/housing/tour/__tests__/TourPhaseZone.test.tsx src/components/housing/tour/__tests__/TourProgressPanel.test.tsx src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: PASS(既存は crossing={{kind:'none'}} 追加で回帰なし)

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/pages/TourNavPage.tsx src/components/housing/tour/TourProgressPanel.tsx src/components/housing/tour/TourPhaseZone.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/tour/__tests__/TourPhaseZone.test.tsx
rtk git commit -m "feat(housing): DC/ワールド跨ぎの移動指示を行き方枠に表示"
```

---

### Task 6: DC/ワールド案内(中央マップ ぼかし + カード)

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`(ack state + TourNavMap へ配線)
- Modify: `src/components/housing/tour/TourNavMap.tsx`(ぼかし + カード描画)
- Modify: `src/styles/housing.css`(跨ぎオーバーレイ/カードの token)
- Test: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`(追記)

**Interfaces:**
- Consumes: `TourCrossing`(Task 1)、`crossing`(Task 5 の TourNavPage 算出)
- Produces: `TourNavMap` に props `crossing?: TourCrossing`(default none)、`showCrossing?: boolean`(default false)、`onAckCrossing?: () => void`(default noop)。
  → **全て省略可**にすることで、既存 TourNavMap テスト(多数)は無改修のまま通る。新規テストだけが指定する。

- [ ] **Step 1: TourNavMap に crossing オーバーレイ(失敗するテスト)** — `TourNavMap.test.tsx` に追記

```tsx
it('showCrossing=true + dc で案内カードが出る', () => {
  render(<TourNavMap status="ready" svg="<svg/>" viewBox={{w:100,h:100}} model={null} stepKey={1}
    crossing={{ kind: 'dc', dc: 'Gaia', world: 'Ifrit' }} showCrossing={true} onAckCrossing={() => {}} />);
  expect(screen.getByTestId('tour-map-cross')).toBeInTheDocument();
});
it('showCrossing=false では出ない', () => {
  render(<TourNavMap status="ready" svg="<svg/>" viewBox={{w:100,h:100}} model={null} stepKey={1}
    crossing={{ kind: 'dc', dc: 'Gaia', world: 'Ifrit' }} showCrossing={false} onAckCrossing={() => {}} />);
  expect(screen.queryByTestId('tour-map-cross')).toBeNull();
});
```

(新規 props は省略可のため既存 TourNavMap テストは無改修。)

- [ ] **Step 2: TourNavMap 実装** — `TourNavMap.tsx`

`TourNavMapProps` に追加(全て省略可): `crossing?: TourCrossing; showCrossing?: boolean; onAckCrossing?: () => void;`(import 型)。
分割代入で既定を与える: `crossing = { kind: 'none' }, showCrossing = false, onAckCrossing = () => {}`。
`.housing-tour-map-stage`(308 行の div)の子として、他 HUD と並べて跨ぎオーバーレイを描画(map-none 等の下地に関わらず出す):

```tsx
        {showCrossing && crossing.kind !== 'none' && (
          <div className="housing-tour-map-cross" data-testid="tour-map-cross">
            <div className="housing-tour-map-cross-card">
              <p className="housing-tour-map-cross-text">
                {crossing.kind === 'dc'
                  ? t('housing.tour.nav.cross.dc', { dc: crossing.dc, world: crossing.world })
                  : crossing.kind === 'world'
                    ? t('housing.tour.nav.cross.world', { world: crossing.world })
                    : t('housing.tour.nav.cross.region')}
              </p>
              <button type="button" className="housing-tour-map-cross-ack" onClick={onAckCrossing}>
                {t('housing.tour.nav.cross.ack')}
              </button>
            </div>
          </div>
        )}
```

- [ ] **Step 3: housing.css にトークン + スタイル** — `src/styles/housing.css`

`.housing-tour-map-stage` は `position: relative` 前提(既存 HUD が absolute のはず・要確認)。跨ぎオーバーレイはステージ全面をぼかし、中央にカード。ぼかしは変数パターン:

```css
.housing-tour-map-cross {
  position: absolute;
  inset: 0;
  z-index: var(--housing-z-map-cross, 5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--housing-space-4, 16px);
  --tw-backdrop-blur: blur(6px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  background: var(--housing-scrim, rgba(8, 12, 20, 0.42));
}
.housing-tour-map-cross-card {
  max-width: 320px;
  padding: var(--housing-space-4, 16px) var(--housing-space-5, 20px);
  border-radius: var(--housing-radius-panel, 14px);
  background: var(--housing-panel-bg-solid);
  border: 1px solid var(--housing-divider);
  box-shadow: var(--housing-shadow-panel, 0 10px 30px rgba(0,0,0,0.4));
  text-align: center;
}
.housing-tour-map-cross-text { color: var(--housing-text); margin-bottom: var(--housing-space-3, 12px); }
.housing-tour-map-cross-ack {
  color: var(--housing-honey);
  border: 1px solid var(--housing-honey-border, var(--housing-divider));
  border-radius: var(--housing-radius-btn, 10px);
  padding: var(--housing-space-2, 8px) var(--housing-space-4, 16px);
  cursor: pointer;
}
```

(実際の token 名は housing.css の既存定義に合わせる。無いものは既存の近い token を使うか、`.housing-workspace` 上部に新規追加。フォールバック値は暫定で、token 確定後に外す。)

- [ ] **Step 4: TourNavPage で ack state + 配線** — `TourNavPage.tsx`

```ts
  const [crossingAckIndex, setCrossingAckIndex] = useState<number | null>(null);
  const showCrossingOverlay = crossing.kind !== 'none' && crossingAckIndex !== currentIndex;
  const onAckCrossing = useCallback(() => setCrossingAckIndex(currentIndex), [currentIndex]);
```

`<TourNavMap ... />` に `crossing={crossing}` `showCrossing={showCrossingOverlay}` `onAckCrossing={onAckCrossing}` を追加。

- [ ] **Step 5: テスト緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/pages/TourNavPage.tsx src/components/housing/tour/TourNavMap.tsx src/styles/housing.css src/components/housing/tour/__tests__/TourNavMap.test.tsx
rtk git commit -m "feat(housing): DC/ワールド跨ぎ地点で中央マップをぼかし案内カードを表示"
```

---

### Task 7: 全体緑ゲート + 目視チェックリスト引き継ぎ

**Files:** なし(検証のみ)

- [ ] **Step 1: 型 + ビルド**

Run: `npm run build`
Expected: tsc -b 厳密で型エラー 0、build 成功(未使用 import/変数に注意)。

- [ ] **Step 2: 全テスト**

Run: `npx vitest run`
Expected: 全緑(既存 + 新規)。落ちたら systematic-debugging。

- [ ] **Step 3: 目視チェックリスト作成(ユーザー dev 確認用)**

`docs/.private/2026-07-12-big3-release-verification-checklist.md` の「実機フィードバック対応」節に、④の dev 目視項目を追記:
- 別リージョン(例 JP の家がある状態で NA の家)を「ツアーに追加」→ トースト + 追加されない
- 同DC・別ワールド のツアーで、2件目の行き方枠に「ワールド訪問で ○○ へ」+ 中央マップがぼかし+カード → ボタンで解除
- 別DC・同リージョン で「データセンタートラベルで ○○ の ○○ へ」
- 一時追加で DC/サーバー未選択だと「ツアーに追加」が押せない
- 1件目には指示・ぼかしが出ない

- [ ] **Step 4: TODO.md 更新**

`docs/TODO.md` の「現在の状態」の残タスクから ②(タブ削除・完了)と ④(本タスク・実装完了→ユーザー dev 確認待ち)を更新。

## Self-Review(記入済み)

**1. Spec coverage**: 設計1→Task1 / 設計2(一時必須)→Task2 / 設計3(追加ブロック)→Task3 / 開始 net→Task4 / 右パネル指示→Task5 / 中央マップぼかし→Task6。全項目にタスク対応あり。
**2. Placeholder scan**: TBD/TODO なし。CSS の token フォールバック値は「実 token 確定後に外す」明記済み(暫定と分かる形)。
**3. Type consistency**: `TourCrossing`(kind: none/world/dc/region)を Task1 で定義し Task5/6 で同一使用。`crossingBetween`/`canAddToTour`/`tourRegionConflict` の名前・引数は全タスク一致。`showCrossing`/`onAckCrossing`/`crossing` の prop 名は Task6 内で一貫。
