# ツアー計画画面(蛇行グリッド) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングの「ツアー」タブを、開始前は「トレイの大きい版」として機能する計画画面(PC=蛇行グリッド、スマホ=縦一覧)にし、タブ文言も「ツアー」に統一する。

**Architecture:** 既存の `useTourTrayStore`(計画中のトレイ)と `useHousingTourStore`(実行中のツアー)は変更しない。`TourNavPage` の分岐を「実行中/計画中(トレイに1件以上)/空」の3系統に拡張し、計画中はPC=新規`TourTrayDetailPanel`(左の固定詳細)+新規`TourTrayBoard`(右の蛇行グリッド)、スマホ=既存`TourTrayList`をそのまま全画面表示、という新規コンポーネントで対応する。トレイの行カード(`TourTrayRow`)と並べ替えロジック(`useTourTrayOrdering`)は共有部品として抽出し、既存のサイドバートレイ(`TourTrayList`)と新規グリッドの両方から再利用する。

**Tech Stack:** React + TypeScript, Zustand(状態管理), `@dnd-kit/core`/`@dnd-kit/sortable`(既存依存・追加インストール不要), Vitest + Testing Library, i18next(5言語: ja/en/ko/zh/zh-Hant)。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-08-11-housing-tour-tray-page-design.md`(全決定事項の根拠はここ)。
- 新規ライブラリ追加なし。既存の `@dnd-kit/core` + `@dnd-kit/sortable` を再利用する。
- 色・寸法は必ず `--housing-*` トークン経由(`src/styles/housing.css` 冒頭の `.housing-workspace` ブロックに新規トークンを追加)。px直書き・rgba直書き禁止(`housing-design.md` 準拠)。
- UIテキストは必ず5言語(ja/en/ko/zh/zh-Hant)の i18n キー経由。ハードコード禁止。
- 新規アニメーション(接続線の再描画・カードのバウンス等)は `prefers-reduced-motion: reduce` で無効化する(既存 `.housing-card-fav` 等と同じ作法)。
- 既存の地域跨ぎブロック(`canAddToTour`/`tourAnchorRegion`/`tourRegionConflict`)・ドラッグ/ピン/効率順のアルゴリズム自体・ツアー実行中(3パネルUI)は変更しない。
- 各タスックはテスト実行(`npx vitest run <対象ファイル>` で対象を絞る。フルスイートは実行しない = [[reference_vitest_vmthreads_hang]])→コミット、の順で進める。

---

### Task 1: i18n更新 + 空状態に「探すへ」ボタン追加

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`, `src/locales/zh-Hant.json`
- Modify: `src/components/housing/tour/TourEmptyState.tsx`
- Modify: `src/components/housing/pages/TourNavPage.tsx`(空状態呼び出し箇所のみ)
- Test: `src/components/housing/tour/__tests__/TourEmptyState.test.tsx`

**Interfaces:**
- Produces: `TourEmptyStateProps.onGoBrowse: () => void`(新規必須prop)。i18nキー `housing.tabs.tour`(値変更)/`housing.tour.nav.empty.cta_browse`(新規)/`housing.tray.board_hint`(新規、Task5で使用)。

- [ ] **Step 1: i18nキーを5言語とも更新**

`housing.tabs.tour` の値を変更(各ファイルの `"tabs": { ... "favorites": "...", "tour": "...", "register": ... }` ブロック内、1箇所ずつ)。

`src/locales/ja.json`:
```diff
-            "tour": "ツアー中",
+            "tour": "ツアー",
```

`src/locales/en.json`:
```diff
-            "tour": "On Tour",
+            "tour": "Tour",
```

`src/locales/ko.json`:
```diff
-            "tour": "투어 중",
+            "tour": "투어",
```

`src/locales/zh.json`:
```diff
-            "tour": "导览中",
+            "tour": "导览",
```

`src/locales/zh-Hant.json`:
```diff
-            "tour": "導覽中",
+            "tour": "導覽",
```

次に、各ファイルの `housing.tour.nav.empty` ブロック(`"cta": "..."` の行)の直後に `cta_browse` を追加する。

`src/locales/ja.json`:
```diff
                     "lead": "お気に入りから行きたいハウジングを選んでツアーを始めましょう。",
-                    "cta": "お気に入りへ"
+                    "cta": "お気に入りへ",
+                    "cta_browse": "探すへ"
                 },
```

`src/locales/en.json`:
```diff
                     "lead": "Pick housing you'd like to visit from your favorites to start a tour.",
-                    "cta": "Go to Favorites"
+                    "cta": "Go to Favorites",
+                    "cta_browse": "Go to Browse"
                 },
```

`src/locales/ko.json`:
```diff
                     "lead": "즐겨찾기에서 방문하고 싶은 하우징을 선택해 투어를 시작해 보세요.",
-                    "cta": "즐겨찾기로 가기"
+                    "cta": "즐겨찾기로 가기",
+                    "cta_browse": "둘러보기로 가기"
                 },
```

`src/locales/zh.json`:
```diff
                     "lead": "从收藏中选择想去的房屋，开始一次导览吧。",
-                    "cta": "前往收藏"
+                    "cta": "前往收藏",
+                    "cta_browse": "前往浏览"
                 },
```

`src/locales/zh-Hant.json`:
```diff
                     "lead": "從收藏中選擇想去的房屋，開始一次導覽吧。",
-                    "cta": "前往收藏"
+                    "cta": "前往收藏",
+                    "cta_browse": "前往瀏覽"
                 },
```

最後に、`housing.tray` ブロック(`"drag_handle": "..."` の行、**`housing.tray.drag_handle` の方**。同名の `tour_builder.drag_handle` という別ブロックが同じファイル内に存在するので混同しないこと — `housing.tray.title`/`housing.tray.empty` 等が同じオブジェクトの兄弟キーとして存在する方を選ぶ)の直後に `board_hint` を追加する。

`src/locales/ja.json`:
```diff
             "drag_handle": "ドラッグして並べ替え"
+            ,"board_hint": "ドラッグで並べ替え、ピンでこの位置に固定できます"
```
(カンマの位置に注意: 元の行は末尾にカンマが無い最後のキーなので、まず元の行末に `,` を足してから新しい行を追記する。実際の編集は以下の1回のEdit操作で行う)

```diff
-            "drag_handle": "ドラッグして並べ替え"
+            "drag_handle": "ドラッグして並べ替え",
+            "board_hint": "ドラッグで並べ替え、ピンでこの位置に固定できます"
```

`src/locales/en.json`:
```diff
-            "drag_handle": "Drag to reorder"
+            "drag_handle": "Drag to reorder",
+            "board_hint": "Drag to reorder, or pin a card to keep it in place"
```

`src/locales/ko.json`:
```diff
-            "drag_handle": "ドラッグして並べ替え"
+            "drag_handle": "ドラッグして並べ替え",
+            "board_hint": "드래그로 순서를 바꾸거나, 핀으로 이 위치에 고정할 수 있습니다"
```

`src/locales/zh.json`:
```diff
-            "drag_handle": "ドラッグして並べ替え"
+            "drag_handle": "ドラッグして並べ替え",
+            "board_hint": "拖曳可调整顺序，点击图钉可固定卡片位置"
```

`src/locales/zh-Hant.json`:
```diff
-            "drag_handle": "拖曳以重新排序"
+            "drag_handle": "拖曳以重新排序",
+            "board_hint": "拖曳可調整順序，點擊圖釘可固定卡片位置"
```

> 注意: `ko.json`/`zh.json` の `housing.tray.drag_handle` は元々未翻訳(日本語のまま)で残っている既知の別問題([[project_housing_gameterms_admin_glossary]]等で追跡中の「housing.*の日本語取りこぼし」)。今回のタスクはこれを直さない(スコープ外)。`drag_handle` 自体の値は変更せず、新規キー追加のためのアンカーとして使うだけ。

- [ ] **Step 2: `TourEmptyState` に「探すへ」ボタンを追加**

`src/components/housing/tour/TourEmptyState.tsx` の `TourEmptyStateProps` に `onGoBrowse` を追加:

```diff
 export interface TourEmptyStateProps {
   onGoFavorites: () => void;
+  onGoBrowse: () => void;
   ephemeralIds?: string[];
```

コンポーネント引数の分割代入に追加:

```diff
 export const TourEmptyState: React.FC<TourEmptyStateProps> = ({
   onGoFavorites,
+  onGoBrowse,
   ephemeralIds,
```

「お気に入りへ」ボタンの直後に2つ目のボタンを追加:

```diff
       <button type="button" className="housing-tour-empty-cta" onClick={onGoFavorites}>
         {t('housing.tour.nav.empty.cta')}
       </button>
+      <button type="button" className="housing-tour-empty-cta" onClick={onGoBrowse}>
+        {t('housing.tour.nav.empty.cta_browse')}
+      </button>
```

- [ ] **Step 3: `TourNavPage` の呼び出し箇所に `onGoBrowse` を配線**

`src/components/housing/pages/TourNavPage.tsx` の `TourEmptyState` 呼び出し(空状態の `return` 内)に追加:

```diff
           <TourEmptyState
             onGoFavorites={onGoFavorites}
+            onGoBrowse={() => navigate('/housing')}
             ephemeralIds={emptyTrayIds}
```

(`navigate` は同ファイル47行目で既に `const navigate = useNavigate();` 済み。新規importは不要)

- [ ] **Step 4: `TourEmptyState.test.tsx` を更新**

既存の `renderEmptyState` ヘルパーが `onGoBrowse` 必須propを渡していないとTypeScriptエラーになるため更新し、新規ボタンのテストを追加する。

```typescript
function renderEmptyState(onGoFavorites: () => void = () => {}, onGoBrowse: () => void = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourEmptyState onGoFavorites={onGoFavorites} onGoBrowse={onGoBrowse} />
    </I18nextProvider>
  );
}
```

`describe` 内に追加:

```typescript
  it('「探すへ」クリックで onGoBrowse が呼ばれる', () => {
    const onGoBrowse = vi.fn();
    renderEmptyState(() => {}, onGoBrowse);
    fireEvent.click(screen.getByRole('button', { name: '探すへ' }));
    expect(onGoBrowse).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 5: テスト実行**

Run: `npx vitest run src/components/housing/tour/__tests__/TourEmptyState.test.tsx src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: 全PASS(TourNavPage側は空状態テストが既存のまま通ること = `onGoBrowse` を渡してもクラッシュしないこと)。

- [ ] **Step 6: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json src/components/housing/tour/TourEmptyState.tsx src/components/housing/pages/TourNavPage.tsx src/components/housing/tour/__tests__/TourEmptyState.test.tsx
git commit -m "feat(housing): ツアータブ文言を「ツアー」に変更、空状態に「探すへ」ボタンを追加"
```

---

### Task 2: リファクタ — `TourTrayRow` と並べ替えロジックを共有ファイルへ抽出

**Files:**
- Create: `src/components/housing/browse/TourTrayRow.tsx`
- Create: `src/lib/housing/useTourTrayOrdering.ts`
- Modify: `src/components/housing/browse/TourTrayList.tsx`
- Test: `src/__tests__/housing/TourTray.test.tsx`(既存、無変更で通ることを確認するだけ)

**Interfaces:**
- Produces: `TourTrayRow` component (props: `{ listing: MockListing; index: number; language: string; isPinned: boolean; onRemove: (id: string) => void; onTogglePin: (id: string) => void; }`) — Task3/Task5で再利用。
- Produces: `useTourTrayOrdering(listingIds: string[], onChange: (ids: string[]) => void)` hook、返り値 `{ items: MockListing[]; orderedIds: string[]; remove: (id: string) => void; togglePin: (id: string) => void; onSortEfficient: () => void; sensors: ReturnType<typeof useSensors>; handleDragEnd: (e: DragEndEvent) => void; }` — Task5で再利用。

このタスクは**挙動を一切変えないリファクタ**。`TourTrayList.tsx` の中身を2ファイルへ分割するだけで、`TourTray.test.tsx` は無変更のまま全て通る想定。

- [ ] **Step 1: `TourTrayRow.tsx` を新規作成**

現在 `TourTrayList.tsx` 内にある非export関数 `TourTrayRow`(144-237行目)をそのまま切り出し、`export` を付けて独立ファイル化する。

```typescript
// src/components/housing/browse/TourTrayRow.tsx
import { useTranslation } from 'react-i18next';
import { GripVertical, Pin, Route, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { representativeImage, hasRepresentativeImage } from '../../../lib/housing/representativeImage';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourTrayRowProps {
  listing: MockListing;
  index: number;
  language: string;
  isPinned: boolean;
  onRemove: (id: string) => void;
  onTogglePin: (id: string) => void;
}

/**
 * トレイの行き先1行分 (sortable wrapper)。ドラッグは左端の GripVertical ハンドルだけで発動する。
 * PC サイドバー (TourTrayList) とスマホの計画画面、蛇行グリッド (TourTrayBoard) で共用する。
 */
export function TourTrayRow({
  listing,
  index,
  language,
  isPinned,
  onRemove,
  onTogglePin,
}: TourTrayRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listing.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // 住所は表示しないが、タイトル未入力時のフォールバック文言として内部計算だけは残す。
  const addr =
    listing.visibility === 'private'
      ? t('housing.card.privateListing')
      : canDisplayAddress(listing)
        ? formatHousingAddress(listing, language)
        : t('housing.card.addressPrivate');
  const title = listing.title?.trim() || addr;

  const showThumbImage = !isEphemeralListingId(listing.id) && hasRepresentativeImage(listing);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="housing-tour-tray-item"
      data-dragging={isDragging}
      title={title}
    >
      <button
        type="button"
        className="housing-tour-tray-drag"
        aria-label={t('housing.tray.drag_handle')}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className="housing-tour-tray-num">{index + 1}</span>
      {showThumbImage ? (
        <img className="housing-tour-tray-thumb" src={representativeImage(listing)} alt="" loading="lazy" />
      ) : (
        <span className="housing-tour-tray-thumb housing-tour-tray-thumb-placeholder" aria-hidden="true">
          <Route size={16} aria-hidden="true" />
        </span>
      )}
      <span className="housing-tour-tray-info">
        <span className="housing-tour-tray-title">{title}</span>
      </span>
      {isEphemeralListingId(listing.id) && (
        <span className="housing-ephemeral-badge">{t('housing.ephemeral.badge')}</span>
      )}
      <button
        type="button"
        className="housing-tour-tray-pin"
        data-active={isPinned}
        aria-pressed={isPinned}
        aria-label={isPinned ? t('housing.tray.unpin') : t('housing.tray.pin')}
        onClick={() => onTogglePin(listing.id)}
      >
        <Pin size={14} aria-hidden="true" fill={isPinned ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className="housing-tour-tray-remove"
        aria-label={t('housing.tray.remove')}
        onClick={() => onRemove(listing.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
```

> 備考: ここで既に「住所行を削除・タイトルは `<span className="housing-tour-tray-info">` 直下1個だけ」の形にしている(Task3で予定していた見た目変更をこの抽出と同時に行う)。`title` 属性(hoverツールチップ)は `${title}\n${addr}` から `title` 単体に変更し、住所はツールチップにも出さない(design docの「住所削除」方針を徹底)。CSSの `.housing-tour-tray-addr` ルール(`src/styles/housing.css:7281-7284`)は参照が無くなるため後続StepでCSSごと削除する。

- [ ] **Step 2: `useTourTrayOrdering.ts` を新規作成**

`TourTrayList.tsx` の47-106行目(pool解決・resolveTourOrder呼び出し・remove/togglePin/onSortEfficient・dnd-kitセンサー・handleDragEnd)をフックへ抽出する。

```typescript
// src/lib/housing/useTourTrayOrdering.ts
import { useSensors, useSensor, PointerSensor, KeyboardSensor, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../store/useEphemeralListingsStore';
import { useTourTrayStore } from '../../store/useTourTrayStore';
import { resolveTourOrder } from './resolveTourOrder';
import type { MockListing } from '../../data/housing/mockListings';

export interface UseTourTrayOrderingResult {
  /** 表示順で解決済みの listing 本体。未解決 id は含まない(行として描画しない)。 */
  items: MockListing[];
  /** 表示順の id 全件(未解決分の位置も温存)。 */
  orderedIds: string[];
  remove: (id: string) => void;
  togglePin: (id: string) => void;
  onSortEfficient: () => void;
  sensors: ReturnType<typeof useSensors>;
  handleDragEnd: (e: DragEndEvent) => void;
}

/**
 * ツアートレイの並べ替え共通ロジック(ドラッグ並び替え + ピン留め + 効率順ボタン)。
 * PC サイドバー一覧(TourTrayList)と計画画面の蛇行グリッド(TourTrayBoard)で共用する。
 * closestCenter を collision detection に使うため、呼び出し側は返り値の sensors を
 * そのまま DndContext に渡し、SortableContext の items には orderedIds を渡すこと。
 */
export function useTourTrayOrdering(
  listingIds: string[],
  onChange: (ids: string[]) => void,
): UseTourTrayOrderingResult {
  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  const manualOrder = useTourTrayStore((s) => s.manualOrder);
  const togglePinStore = useTourTrayStore((s) => s.togglePin);
  const setManualOrder = useTourTrayStore((s) => s.setManualOrder);

  const pool = [...listings, ...myListings, ...ephemeral];
  const orderedIds = resolveTourOrder(listingIds, pool, { pinnedIds, manualOrder });

  const items = orderedIds
    .map(
      (id) =>
        listings.find((l) => l.id === id) ??
        myListings.find((l) => l.id === id) ??
        ephemeral.find((l) => l.id === id),
    )
    .filter((l): l is MockListing => Boolean(l));

  const remove = (id: string) => {
    onChange(listingIds.filter((x) => x !== id));
    if (pinnedIds.includes(id)) togglePinStore(id);
  };

  const togglePin = (id: string) => {
    onChange(orderedIds);
    togglePinStore(id);
  };

  const onSortEfficient = () => {
    const next = resolveTourOrder(listingIds, pool, { pinnedIds, manualOrder: false });
    onChange(next);
    setManualOrder(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(orderedIds, oldIndex, newIndex));
    setManualOrder(true);
  };

  return { items, orderedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd };
}
```

`closestCenter` の import はこのファイルでは未使用になる点に注意(呼び出し側の `DndContext` に渡すのは呼び出し側の責務のまま残す = `collisionDetection` は各コンポーネント側で `closestCenter` を渡す)。よって上記コードから `closestCenter` importは削除しておくこと。

- [ ] **Step 3: `TourTrayList.tsx` をフック+行コンポーネント利用の薄い実装に書き換え**

```typescript
// src/components/housing/browse/TourTrayList.tsx
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, Route } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTourTrayOrdering } from '../../../lib/housing/useTourTrayOrdering';
import { TourTrayRow } from './TourTrayRow';

export interface TourTrayListProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * ツアートレイの行き先リスト本体 (縦一覧版)。PC サイドバー (TourTray) とスマホの計画画面で共有する。
 * 並べ替えロジックは useTourTrayOrdering、行の見た目は TourTrayRow に集約済み。
 */
export const TourTrayList: React.FC<TourTrayListProps> = ({ listingIds, onChange }) => {
  const { t, i18n } = useTranslation();
  const { items, orderedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
    useTourTrayOrdering(listingIds, onChange);
  const pinnedIds = items.map(() => false); // placeholder removed below

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  return (
    <div className="housing-tour-tray-body">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ol className="housing-tour-tray-list">
            {items.map((l, i) => (
              <TourTrayRow
                key={l.id}
                listing={l}
                index={i}
                language={i18n.language}
                isPinned={pinnedIds[i]}
                onRemove={remove}
                onTogglePin={togglePin}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
        <ArrowDownUp size={14} aria-hidden="true" />
        {t('housing.tray.sort_efficient')}
      </button>
    </div>
  );
};
```

上のドラフトで `isPinned` を `items.map(() => false)` にしてしまうと元の挙動(ピン留め表示)が壊れる。**これはバグなので以下の正しい実装に置き換える**: `useTourTrayOrdering` は `pinnedIds` 自体を返していないため、フックの返り値に `pinnedIds: string[]` を追加する。

`src/lib/housing/useTourTrayOrdering.ts` の `UseTourTrayOrderingResult` と return文を修正:

```diff
 export interface UseTourTrayOrderingResult {
   items: MockListing[];
   orderedIds: string[];
+  pinnedIds: string[];
   remove: (id: string) => void;
```

```diff
-  return { items, orderedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd };
+  return { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd };
```

`src/components/housing/browse/TourTrayList.tsx` を修正:

```diff
-  const { items, orderedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
+  const { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
     useTourTrayOrdering(listingIds, onChange);
-  const pinnedIds = items.map(() => false); // placeholder removed below
```

```diff
                 language={i18n.language}
-                isPinned={pinnedIds[i]}
+                isPinned={pinnedIds.includes(l.id)}
```

- [ ] **Step 4: テスト実行(既存テストが無変更で通ることを確認)**

Run: `npx vitest run src/__tests__/housing/TourTray.test.tsx`
Expected: 3件とも PASS(このタスクは挙動を変えていないため)。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/browse/TourTrayRow.tsx src/lib/housing/useTourTrayOrdering.ts src/components/housing/browse/TourTrayList.tsx
git commit -m "refactor(housing): トレイ行コンポーネントと並べ替えロジックを共有ファイルへ抽出(挙動不変)"
```

---

### Task 3: トレイ行から住所表示を削除、タイトルを拡大(CSS)

**Files:**
- Modify: `src/styles/housing.css`

Task2で `TourTrayRow.tsx` のJSXから既に住所 `<span>` を削除済み。このタスクはCSSだけを対応させる。

**Interfaces:**
- Consumes: `.housing-tour-tray-title` / `.housing-tour-tray-addr`(既存クラス、後者は削除)。

- [ ] **Step 1: `.housing-tour-tray-addr` ルールを削除し、タイトルのフォントサイズを拡大**

`src/styles/housing.css:7277-7284` を以下に置き換え:

```diff
 .housing-tour-tray-title {
-  font-size: var(--housing-text-sm); font-weight: 700; color: var(--housing-text);
+  font-size: var(--housing-text-md); font-weight: 700; color: var(--housing-text);
   overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
 }
-.housing-tour-tray-addr {
-  font-size: var(--housing-text-xs); color: var(--housing-text-mute);
-  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
-}
```

`.housing-tour-tray-info` は1行だけになるため `flex-direction: column; gap: 2px` は不要になるが、他の要素追加時の保険として残してよい(実害無し・削除は任意)。

- [ ] **Step 2: 実装確認**

Run: `npx vitest run src/__tests__/housing/TourTray.test.tsx`
Expected: PASS(CSS変更はJSテストに影響しない)。

ビルドも通ることを確認:
Run: `npx tsc -b`
Expected: エラー無し。

- [ ] **Step 3: Commit**

```bash
git add src/styles/housing.css
git commit -m "style(housing): トレイ行の住所表示を削除しタイトルを拡大"
```

---

### Task 4: 蛇行グリッドの位置計算(純粋関数・TDD)

**Files:**
- Create: `src/lib/housing/computeSnakeGridPositions.ts`
- Test: `src/lib/housing/__tests__/computeSnakeGridPositions.test.ts`

**Interfaces:**
- Produces: `computeSnakeGridPositions(ids: string[], rowsPerColumn: number): SnakeCell[]`、`buildSnakePathD(cells: SnakeCell[], colWidth: number, rowHeight: number): string`、`interface SnakeCell { id: string; row: number; col: number }` — Task5で使用。

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/lib/housing/__tests__/computeSnakeGridPositions.test.ts
import { describe, it, expect } from 'vitest';
import { computeSnakeGridPositions, buildSnakePathD } from '../computeSnakeGridPositions';

describe('computeSnakeGridPositions', () => {
  it('1列目は上から下へ順に並ぶ', () => {
    const result = computeSnakeGridPositions(['a', 'b', 'c'], 5);
    expect(result).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 2, col: 0 },
    ]);
  });

  it('2列目は下から上へ折り返す(ジグザグ)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = computeSnakeGridPositions(ids, 5);
    // 1列目: a=row0,b=row1,c=row2,d=row3,e=row4 (上から下)
    expect(result.slice(0, 5)).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 2, col: 0 },
      { id: 'd', row: 3, col: 0 },
      { id: 'e', row: 4, col: 0 },
    ]);
    // 2列目: f=row4(下端から), g=row3 (下から上)
    expect(result.slice(5)).toEqual([
      { id: 'f', row: 4, col: 1 },
      { id: 'g', row: 3, col: 1 },
    ]);
  });

  it('3列目は再び上から下へ(上下交互)', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `id${i}`);
    const result = computeSnakeGridPositions(ids, 5);
    // index10 = 3列目(col=2)の1件目 = row0
    expect(result[10]).toEqual({ id: 'id10', row: 0, col: 2 });
  });

  it('rowsPerColumnが0以下でも1として扱い、1列に1件ずつ配置する(防御)', () => {
    const result = computeSnakeGridPositions(['a', 'b'], 0);
    expect(result).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 0, col: 1 },
    ]);
  });

  it('空配列は空配列を返す', () => {
    expect(computeSnakeGridPositions([], 5)).toEqual([]);
  });
});

describe('buildSnakePathD', () => {
  it('セル中心を結ぶSVGパス文字列を作る', () => {
    const cells = [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
    ];
    const d = buildSnakePathD(cells, 200, 60);
    expect(d).toBe('M 100 30 L 100 90');
  });

  it('空配列は空文字列を返す', () => {
    expect(buildSnakePathD([], 200, 60)).toBe('');
  });

  it('1件だけなら移動コマンドのみ(線は引かない)', () => {
    const d = buildSnakePathD([{ id: 'a', row: 0, col: 0 }], 200, 60);
    expect(d).toBe('M 100 30');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/computeSnakeGridPositions.test.ts`
Expected: FAIL(`computeSnakeGridPositions` が存在しない)

- [ ] **Step 3: 実装**

```typescript
// src/lib/housing/computeSnakeGridPositions.ts

export interface SnakeCell {
  id: string;
  row: number;
  col: number;
}

/**
 * ツアー計画画面の蛇行グリッド(PC)の位置計算。
 * 列を上から下まで埋めたら、隣の列は下から上へ、その隣はまた上から下へ…と
 * ジャンプせず連続してつながる形(ボウストロフェドン/畑を耕す牛の折返し)で配置する。
 * この順序どおりに接続線を引けば、途切れず蛇行する一本道になる。
 */
export function computeSnakeGridPositions(ids: string[], rowsPerColumn: number): SnakeCell[] {
  const safeRows = Math.max(1, Math.floor(rowsPerColumn) || 1);
  return ids.map((id, i) => {
    const col = Math.floor(i / safeRows);
    const posInCol = i % safeRows;
    const goingDown = col % 2 === 0;
    const row = goingDown ? posInCol : safeRows - 1 - posInCol;
    return { id, row, col };
  });
}

/** セル中心を順につないだ SVG <path> の d 属性文字列を組み立てる。 */
export function buildSnakePathD(cells: SnakeCell[], colWidth: number, rowHeight: number): string {
  if (cells.length === 0) return '';
  return cells
    .map((c, i) => {
      const x = c.col * colWidth + colWidth / 2;
      const y = c.row * rowHeight + rowHeight / 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/computeSnakeGridPositions.test.ts`
Expected: 全PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/computeSnakeGridPositions.ts src/lib/housing/__tests__/computeSnakeGridPositions.test.ts
git commit -m "feat(housing): 蛇行グリッドの位置計算とSVGパス生成の純粋関数を追加"
```

---

### Task 5: 新規コンポーネント `TourTrayBoard`(右側の蛇行グリッド)

**Files:**
- Create: `src/components/housing/browse/TourTrayBoard.tsx`
- Test: `src/components/housing/browse/__tests__/TourTrayBoard.test.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `useTourTrayOrdering`(Task2)、`computeSnakeGridPositions`/`buildSnakePathD`(Task4)、`TourTrayRow`(Task2)。
- Produces: `TourTrayBoard` component, props `{ listingIds: string[]; onChange: (ids: string[]) => void; selectedId: string | null; onSelect: (id: string) => void; }` — Task7で使用。

- [ ] **Step 1: CSS トークン・クラスを追加**

`src/styles/housing.css` の `.housing-workspace` トークンブロック(208-209行目付近、`--housing-right-w` の近く)に追加:

```diff
   --housing-left-w: 240px;
   --housing-right-w: 300px;
+  --housing-snake-row-h: 60px;
+  --housing-snake-col-w: 200px;
```

`.housing-tour-tray-body` ルール(7295行目付近)の後ろに新規ブロックを追加:

```css
/* ===== ツアー計画画面: 蛇行グリッド (TourTrayBoard・2026-08-11) =====
   列を上下交互に埋めながら右へ続く一本道。画面に入りきらない分は横スクロール。 */
.housing-tour-board {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1 1 auto;
}
.housing-tour-board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
}
.housing-tour-board-hint {
  font-size: var(--housing-text-xs);
  color: var(--housing-text-mute);
}
.housing-tour-board-scroll {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.housing-tour-board-grid {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--housing-snake-col-w);
  height: 100%;
}
.housing-tour-board-path {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
.housing-tour-board-path path {
  fill: none;
  stroke: var(--housing-aether-border);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: d 0.2s ease;
}
.housing-tour-board-cell {
  display: flex;
  align-items: center;
  padding: 4px 8px;
}
.housing-tour-board-cell .housing-tour-tray-item {
  width: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .housing-tour-board-path path {
    transition: none;
  }
}
```

> `--housing-aether-border` は既存トークン(選択・進行の青系、`TourTrayList` 等で既に使用実績あり)を流用する。新規カラートークンは作らない。

- [ ] **Step 2: `TourTrayBoard.tsx` を実装**

```typescript
// src/components/housing/browse/TourTrayBoard.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, Route } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useTourTrayOrdering } from '../../../lib/housing/useTourTrayOrdering';
import { computeSnakeGridPositions, buildSnakePathD } from '../../../lib/housing/computeSnakeGridPositions';
import { TourTrayRow } from './TourTrayRow';

export interface TourTrayBoardProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ROW_H = 60;
const COL_W = 200;
const DEFAULT_ROWS = 5;

/**
 * ツアー計画画面(PC)の右側: 番号カードを蛇行(上下交互)に並べたグリッド。
 * 列を上から下まで埋めたら隣の列は下から上へ、と接続線がつながったまま右へ続く。
 * 画面に入りきらない分は横スクロールで見る(50-100件規模を想定)。
 * ドラッグ/ピン/効率順のロジックは useTourTrayOrdering・TourTrayRow をそのまま再利用する。
 */
export const TourTrayBoard: React.FC<TourTrayBoardProps> = ({
  listingIds,
  onChange,
  selectedId,
  onSelect,
}) => {
  const { t, i18n } = useTranslation();
  const { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
    useTourTrayOrdering(listingIds, onChange);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [rowsPerColumn, setRowsPerColumn] = useState(DEFAULT_ROWS);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setRowsPerColumn(Math.max(1, Math.floor(height / ROW_H)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  const cells = computeSnakeGridPositions(orderedIds, rowsPerColumn);
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const colCount = Math.max(...cells.map((c) => c.col)) + 1;
  const pathD = buildSnakePathD(cells, COL_W, ROW_H);

  return (
    <div className="housing-tour-board">
      <div className="housing-tour-board-toolbar">
        <span className="housing-tour-board-hint">{t('housing.tray.board_hint')}</span>
        <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
          <ArrowDownUp size={14} aria-hidden="true" />
          {t('housing.tray.sort_efficient')}
        </button>
      </div>
      <div className="housing-tour-board-scroll" ref={scrollRef}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div
              className="housing-tour-board-grid"
              style={{
                gridTemplateRows: `repeat(${rowsPerColumn}, ${ROW_H}px)`,
                width: colCount * COL_W,
              }}
            >
              <svg
                className="housing-tour-board-path"
                width={colCount * COL_W}
                height={rowsPerColumn * ROW_H}
                aria-hidden="true"
              >
                <path d={pathD} />
              </svg>
              {items.map((l, i) => {
                const cell = cellById.get(l.id);
                if (!cell) return null;
                return (
                  <div
                    key={l.id}
                    className="housing-tour-board-cell"
                    data-selected={l.id === selectedId}
                    style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                    onClick={() => onSelect(l.id)}
                  >
                    <TourTrayRow
                      listing={l}
                      index={i}
                      language={i18n.language}
                      isPinned={pinnedIds.includes(l.id)}
                      onRemove={remove}
                      onTogglePin={togglePin}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
```

> `happy-dom`(テスト環境)には `ResizeObserver` が無いため、`typeof ResizeObserver === 'undefined'` の分岐で初期値 `DEFAULT_ROWS=5` のまま動く。テストはこの前提で書く。

- [ ] **Step 3: テストを書く**

```typescript
// src/components/housing/browse/__tests__/TourTrayBoard.test.tsx
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

vi.mock('../../../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      listings: [
        { id: 'a', title: 'A', area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
        { id: 'b', title: 'B', area: 'Mist', ward: 1, plot: 2, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
      ],
      myListings: [],
    }),
}));

import { TourTrayBoard } from '../TourTrayBoard';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('TourTrayBoard', () => {
  it('トレイが空なら空状態を表示する', () => {
    wrap(<TourTrayBoard listingIds={[]} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('カードの「ツアーに追加」で行き先を積みましょう')).toBeInTheDocument();
  });

  it('トレイの件数分カードを描画する', () => {
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('カードをクリックすると onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('A'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('削除ボタンで onChange が呼ばれる', () => {
    const onChange = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={onChange} selectedId={null} onSelect={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('案内文が表示される', () => {
    wrap(<TourTrayBoard listingIds={['a']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('ドラッグで並べ替え、ピンでこの位置に固定できます')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/components/housing/browse/__tests__/TourTrayBoard.test.tsx`
Expected: 全PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/browse/TourTrayBoard.tsx src/components/housing/browse/__tests__/TourTrayBoard.test.tsx src/styles/housing.css
git commit -m "feat(housing): ツアー計画画面の蛇行グリッド(TourTrayBoard)を追加"
```

---

### Task 6: 新規コンポーネント `TourTrayDetailPanel`(左の固定詳細パネル)

**Files:**
- Create: `src/components/housing/tour/TourTrayDetailPanel.tsx`
- Test: `src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `TourLivingMedia`(既存, `src/components/housing/tour/TourLivingMedia.tsx`)、`HousingerByline`(既存, `src/components/housing/housinger/HousingerByline.tsx`)。
- Produces: `TourTrayDetailPanel` component, props `{ listing: MockListing | null; onStartClick: () => void; startDisabled: boolean; }` — Task7で使用。

- [ ] **Step 1: CSSを追加**

`.housing-tour-board` ブロックの前に追加(`src/styles/housing.css`、Task5で追加した位置の直前):

```css
/* ===== ツアー計画画面: 左の固定詳細パネル (TourTrayDetailPanel・2026-08-11) ===== */
.housing-tour-plan-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}
.housing-tour-plan-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  color: var(--housing-text-mute);
  font-size: var(--housing-text-sm);
}
.housing-tour-plan-detail-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
```

> 開始ボタンは新規クラスを作らず、既存 `.housing-tour-tray-start`(`src/styles/housing.css:7312-7325`、honeyグラデーション+影の「ツアー開始」CTA。`TourTray.tsx`/`TourEmptyState.tsx` の一時ツアー開始ボタンと同じ見た目)をそのまま使い回す。

- [ ] **Step 2: `TourTrayDetailPanel.tsx` を実装**

```typescript
// src/components/housing/tour/TourTrayDetailPanel.tsx
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { canDisplayAddress } from '../../../lib/housing/listingPublish';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { isEphemeralListingId } from '../../../lib/housing/ephemeralListing';
import { TourLivingMedia } from './TourLivingMedia';
import { HousingerByline } from '../housinger/HousingerByline';

export interface TourTrayDetailPanelProps {
  /** グリッドで選択中の家。トレイが空の一瞬だけ null。 */
  listing: MockListing | null;
  onStartClick: () => void;
  startDisabled: boolean;
}

/**
 * ツアー計画画面(PC)の左側: 選択中の家の詳細を固定表示する。
 * 見た目はツアー実行中の現在地カード(TourShowcasePanel)に準拠するが、
 * 「次の目的地」「報告」等の実行中専用要素は持たない(表示専用の簡易版)。
 */
export const TourTrayDetailPanel: React.FC<TourTrayDetailPanelProps> = ({
  listing,
  onStartClick,
  startDisabled,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="housing-tour-plan-detail">
      {listing ? (
        <div className="housing-tour-plan-detail-body">
          <TourLivingMedia listing={listing} showFavorite={!isEphemeralListingId(listing.id)} />
          {!isEphemeralListingId(listing.id) && <HousingerByline ownerUid={listing.ownerUid} />}
          <h2 className="housing-tour-dest-title">
            {listing.title?.trim()
              || (canDisplayAddress(listing)
                ? formatHousingAddress(listing, i18n.language)
                : t('housing.card.addressPrivate'))}
          </h2>
          <div className="housing-tour-dest-intro">
            <span className="housing-tour-dest-intro-label">{t('housing.tour.nav.dest.memo')}</span>
            <div className="housing-tour-dest-intro-body">
              {listing.description?.trim() ? listing.description : '──'}
            </div>
          </div>
        </div>
      ) : (
        <div className="housing-tour-plan-detail-empty">{t('housing.tray.empty')}</div>
      )}
      <button
        type="button"
        className="housing-tour-tray-start"
        disabled={startDisabled}
        onClick={onStartClick}
      >
        <Play size={14} aria-hidden="true" />
        {t('housing.tray.start')}
      </button>
    </div>
  );
};
```

> `.housing-tour-dest-title` / `.housing-tour-dest-intro*` は既存クラス(`TourShowcasePanel` が使用中、`src/styles/housing.css` に定義済み)をそのまま流用し、見た目を実行中の現在地カードと揃える。新規CSSは追加しない。

- [ ] **Step 3: テストを書く**

```typescript
// src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { MockListing } from '../../../../data/housing/mockListings';

vi.mock('../../housinger/HousingerByline', () => ({
  HousingerByline: () => null,
}));

import { TourTrayDetailPanel } from '../TourTrayDetailPanel';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const listing: MockListing = {
  id: 'a', ownerUid: 'owner-1', title: 'テストの家', description: 'いい家です',
  area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [],
};

describe('TourTrayDetailPanel', () => {
  it('listingがnullなら空メッセージを出す', () => {
    wrap(<TourTrayDetailPanel listing={null} onStartClick={() => {}} startDisabled />);
    expect(screen.getByText('カードの「ツアーに追加」で行き先を積みましょう')).toBeInTheDocument();
  });

  it('選択中の家のタイトルとコメントを表示する', () => {
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled={false} />);
    expect(screen.getByText('テストの家')).toBeInTheDocument();
    expect(screen.getByText('いい家です')).toBeInTheDocument();
  });

  it('開始ボタンクリックで onStartClick が呼ばれる', () => {
    const onStartClick = vi.fn();
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={onStartClick} startDisabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /開始/ }));
    expect(onStartClick).toHaveBeenCalledTimes(1);
  });

  it('startDisabledがtrueなら開始ボタンが無効', () => {
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled />);
    expect((screen.getByRole('button', { name: /開始/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx`
Expected: 全PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/tour/TourTrayDetailPanel.tsx src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx src/styles/housing.css
git commit -m "feat(housing): ツアー計画画面の左詳細パネル(TourTrayDetailPanel)を追加"
```

---

### Task 7: `TourNavPage` へ統合(計画画面の分岐 + 開始処理配線)

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/components/housing/pages/__tests__/TourNavPage.test.tsx`

**Interfaces:**
- Consumes: `TourTrayDetailPanel`(Task6)、`TourTrayBoard`(Task5)、`TourTrayList`(既存/Task2)、`useTourTrayStore`、`MannerNoticeDialog`(既存 `src/components/housing/workspace/MannerNoticeDialog.tsx`)、`buildTourPool`(既存 `src/lib/housing/buildTourPool.ts`)、`resolveTourOrder`(既存)、`tourRegionConflict`(既存 `src/lib/housing/tourCrossing.ts`)。

- [ ] **Step 1: CSSを追加**

`src/styles/housing.css` に新規ブロック(Task6のCSSブロックの前に追加):

```css
/* ===== ツアー計画画面: PC全体レイアウト (2026-08-11) ===== */
.housing-tour-plan {
  display: grid;
  grid-template-columns: var(--housing-tour-plan-detail-w) 1fr;
  gap: var(--housing-main-gap);
  padding: var(--housing-main-padding);
  height: 100%;
  min-height: 0;
}
.housing-tour-plan-mobile {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: var(--housing-main-padding);
}
```

`--housing-tour-plan-detail-w` トークンを `.housing-workspace` ブロックへ追加(Task5で追加した `--housing-snake-col-w` の近く):

```diff
   --housing-snake-row-h: 60px;
   --housing-snake-col-w: 200px;
+  --housing-tour-plan-detail-w: 320px;
```

- [ ] **Step 2: `TourNavPage.tsx` の import を追加**

```diff
 import { useTourTrayStore } from '../../../store/useTourTrayStore';
 import { useAuthStore } from '../../../store/useAuthStore';
 import { useHousingModalStore } from '../../../store/useHousingModalStore';
 import { buildTourPool } from '../../../lib/housing/buildTourPool';
 import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
 import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
+import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
 import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
```

```diff
 import { TourEmptyState } from '../tour/TourEmptyState';
 import { TourInvitePanel } from '../tour/TourInvitePanel';
+import { TourTrayDetailPanel } from '../tour/TourTrayDetailPanel';
+import { TourTrayBoard } from '../browse/TourTrayBoard';
+import { TourTrayList } from '../browse/TourTrayList';
+import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
 import { HousingLoginPrompt } from '../HousingLoginPrompt';
```

- [ ] **Step 3: 計画中の状態(trayIds・選択中id・マナー確認)を追加**

`TourNavPage` コンポーネント内、`const [emptyTrayIds, setEmptyTrayIds] = useState<string[]>([]);` の直後に追加:

```typescript
  // 計画画面(Task8・蛇行グリッド): トレイに1件以上あれば「ツアー未開始だが計画中」として
  // TourEmptyState の代わりに TourTrayDetailPanel + TourTrayBoard(PC)/TourTrayList(スマホ)を出す。
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  const manualOrder = useTourTrayStore((s) => s.manualOrder);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planMannerOpen, setPlanMannerOpen] = useState(false);

  // 選択中idがトレイから外れたら(削除/開始等)、先頭の家へ選択を戻す。
  useEffect(() => {
    if (trayIds.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !trayIds.includes(selectedPlanId)) {
      setSelectedPlanId(trayIds[0]);
    }
  }, [trayIds, selectedPlanId]);

  const selectedPlanListing = selectedPlanId
    ? (pool.find((l) => l.id === selectedPlanId) ?? null)
    : null;

  // 計画画面の「ツアーを開始する」。BrowsePage.commitStart / FavoritesPage.commitStart と同型
  // (resolveTourOrder → 跨ぎ検査 → マナー確認 → setListings/start/enterTourMode/clear)。
  // 既にこのページ(/housing/tour)にいるため、開始後の navigate は不要
  // (useHousingTourStore.listingIds が非0になり、このページ自身が実行中の3パネルへ再描画される)。
  const commitPlanStart = useCallback(() => {
    if (trayIds.length === 0) return;
    const orderedIds = resolveTourOrder(trayIds, pool, { pinnedIds, manualOrder });
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
    useTourTrayStore.getState().clear();
    setPlanMannerOpen(false);
  }, [trayIds, pool, pinnedIds, manualOrder, t]);
```

> `useEffect` は既に `react` から `useEffect` としてimport済み(ファイル冒頭 `import { useCallback, useEffect, useMemo, useState } from 'react';`)。追加importは不要。

- [ ] **Step 4: 空状態の分岐を「実行中でも計画中でもない」場合だけに絞る**

現在の分岐:

```typescript
  if (listingIds.length === 0) {
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <TourEmptyState
            onGoFavorites={onGoFavorites}
            onGoBrowse={() => navigate('/housing')}
            ephemeralIds={emptyTrayIds}
            onAddEphemeral={onAddEphemeral}
            onRemoveEphemeral={onRemoveEphemeral}
            onStartEphemeral={onStartEphemeral}
          />
        </section>
      </div>
    );
  }
```

これを以下に置き換える:

```typescript
  if (listingIds.length === 0 && trayIds.length === 0) {
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <TourEmptyState
            onGoFavorites={onGoFavorites}
            onGoBrowse={() => navigate('/housing')}
            ephemeralIds={emptyTrayIds}
            onAddEphemeral={onAddEphemeral}
            onRemoveEphemeral={onRemoveEphemeral}
            onStartEphemeral={onStartEphemeral}
          />
        </section>
      </div>
    );
  }

  if (listingIds.length === 0 && trayIds.length > 0) {
    return isMobile ? (
      <div className="housing-tour-plan-mobile">
        <TourTrayList listingIds={trayIds} onChange={setTrayIds} />
        <button
          type="button"
          className="housing-tour-tray-start"
          disabled={trayIds.length === 0}
          onClick={() => setPlanMannerOpen(true)}
        >
          {t('housing.tray.start')}
        </button>
        <MannerNoticeDialog
          open={planMannerOpen}
          onCancel={() => setPlanMannerOpen(false)}
          onStart={commitPlanStart}
        />
      </div>
    ) : (
      <div className="housing-tour-plan">
        <section className="housing-tour-page-panel" data-region="left">
          <div className="housing-tour-page-col">
            <TourTrayDetailPanel
              listing={selectedPlanListing}
              onStartClick={() => setPlanMannerOpen(true)}
              startDisabled={trayIds.length === 0}
            />
          </div>
        </section>
        <section className="housing-tour-page-panel" data-region="right">
          <div className="housing-tour-page-col">
            <TourTrayBoard
              listingIds={trayIds}
              onChange={setTrayIds}
              selectedId={selectedPlanId}
              onSelect={setSelectedPlanId}
            />
          </div>
        </section>
        <MannerNoticeDialog
          open={planMannerOpen}
          onCancel={() => setPlanMannerOpen(false)}
          onStart={commitPlanStart}
        />
      </div>
    );
  }
```

- [ ] **Step 5: `TourNavPage.test.tsx` を更新**

`beforeEach` に `useTourTrayStore` のリセットを追加(既存の他 store リセットの並びに合わせる):

```diff
 import { useAuthStore } from '../../../../store/useAuthStore';
+import { useTourTrayStore } from '../../../../store/useTourTrayStore';
```

```diff
     useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null });
     useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] });
     useHousingViewStore.getState().reset();
     useEphemeralListingsStore.getState().clear();
     useAuthStore.setState({ user: null });
+    useTourTrayStore.getState().clear();
     showToastMock.mockClear();
```

`HousingerByline` は既にファイル41-43行目でモック済み(`() => null`)なので `TourTrayDetailPanel` 内部の呼び出しも安全。`MannerNoticeDialog` は実物のまま(重いFirestore依存は無い、静的な確認ダイアログのため問題ない)。

`describe('TourNavPage', ...)` 内に新規テストを追加(既存の空状態テストの直後):

```typescript
  it('listingIdsは空だがtrayIdsに1件以上あれば計画画面(PC・蛇行グリッド)を表示する', () => {
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id]);
    renderPage();
    expect(screen.queryByText('ツアーがまだ始まっていません')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /開始/ })).toBeInTheDocument();
    // 蛇行グリッド(TourTrayBoard)だけが出す案内文で、PC版であることを確定させる。
    expect(screen.getByText('ドラッグで並べ替え、ピンでこの位置に固定できます')).toBeInTheDocument();
  });

  it('計画画面: 開始ボタンでマナー確認が開き、開始するとトレイが空になりlistingIdsが積まれる', () => {
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id, listing2.id]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /開始/ }));
    fireEvent.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(useTourTrayStore.getState().trayIds).toHaveLength(0);
    expect(useHousingTourStore.getState().listingIds.length).toBeGreaterThan(0);
  });

  it('計画画面(スマホ): 蛇行グリッドではなく縦一覧が出る', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id]);
    renderPage();
    expect(screen.getByRole('button', { name: /開始/ })).toBeInTheDocument();
    // 蛇行グリッド(TourTrayBoard)の案内文が出ていないこと = PC版でなく縦一覧版であることの確認。
    expect(screen.queryByText('ドラッグで並べ替え、ピンでこの位置に固定できます')).not.toBeInTheDocument();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });
```

> `MannerNoticeDialog` の開始ボタンは `t('housing.workspace.manner.start')`(ja値=「はじめる」、`src/locales/ja.json`)。テストはja i18nリソースで動くため文字列 `'はじめる'` で確定。

- [ ] **Step 6: テスト実行**

Run: `npx vitest run src/components/housing/pages/__tests__/TourNavPage.test.tsx`
Expected: 全PASS(既存テストも新規テストも)

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/pages/TourNavPage.tsx src/components/housing/pages/__tests__/TourNavPage.test.tsx src/styles/housing.css
git commit -m "feat(housing): TourNavPageにツアー計画画面(PC=詳細+蛇行グリッド/スマホ=縦一覧)を統合"
```

---

### Task 8: `MobileTourTrayBar` の「並べ替え」ボタンをタブ遷移に変更、`TourReorderSheet` を撤去

**Files:**
- Modify: `src/components/housing/shell/MobileTourTrayBar.tsx`
- Delete: `src/components/housing/shell/TourReorderSheet.tsx`
- Test: `src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx`

**Interfaces:**
- Consumes: Task7で完成した `/housing/tour` の計画画面(スマホ縦一覧)。

- [ ] **Step 1: `MobileTourTrayBar.tsx` を修正**

```diff
 import { List, Play, Route, X } from 'lucide-react';
 import { useTourTrayStore } from '../../../store/useTourTrayStore';
 import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
 import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
 import { useHousingTourStore } from '../../../store/useHousingTourStore';
 import { useHousingViewStore } from '../../../store/useHousingViewStore';
 import { useAuthStore } from '../../../store/useAuthStore';
 import { mergeListingsForViewer } from '../../../lib/housing/listingPublish';
 import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
 import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
 import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
 import { showToast } from '../../Toast';
 import type { MockListing } from '../../../data/housing/mockListings';
-import { TourReorderSheet } from './TourReorderSheet';
```

```diff
   const trayIds = useTourTrayStore((s) => s.trayIds);
-  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
   const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
```

```diff
   const [mannerOpen, setMannerOpen] = useState(false);
-  const [reorderOpen, setReorderOpen] = useState(false);
```

```diff
         <button
           type="button"
           className="housing-tour-traybar-reorder"
           aria-label={t('housing.mobile.reorder')}
-          onClick={() => setReorderOpen(true)}
+          onClick={() => navigate('/housing/tour')}
         >
           <List size={14} aria-hidden="true" />
         </button>
```

```diff
       </div>
-      <TourReorderSheet
-        isOpen={reorderOpen}
-        onClose={() => setReorderOpen(false)}
-        listingIds={trayIds}
-        onChange={setTrayIds}
-      />
       <MannerNoticeDialog
```

`setTrayIds` はもう使われないため import 経由の分割代入から削除済み(上記diff参照)。`useState` importは `mannerOpen` でまだ使うため残す。

- [ ] **Step 2: `TourReorderSheet.tsx` を削除**

```bash
git rm src/components/housing/shell/TourReorderSheet.tsx
```

- [ ] **Step 3: `HousingMobileChrome.test.tsx` に新規テストを追加**

`describe('MobileTourTrayBar (実機FB#10)', ...)` 内、既存3件の `it` の後に追加:

```typescript
  it('「並べ替え」タップで /housing/tour へ遷移する', () => {
    useTourTrayStore.getState().setTrayIds(['a']);
    renderBar();
    fireEvent.click(screen.getByLabelText('housing.mobile.reorder'));
    expect(navigate).toHaveBeenCalledWith('/housing/tour');
  });
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx`
Expected: 全PASS(既存3件+新規1件)

Run: `npx tsc -b`
Expected: エラー無し(`TourReorderSheet` を参照するファイルが残っていないこと)

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/shell/MobileTourTrayBar.tsx src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx
git commit -m "refactor(housing): スマホの「並べ替え」ボタンをツアータブへの遷移に変更し、専用シートを撤去"
```

---

### Task 9: 最終全体差分レビュー

**Files:** なし(レビューのみ、既存タスクの成果物全体が対象)

- [ ] **Step 1: 全体差分を確認**

Run: `git log --oneline -9` で Task1〜8 のコミットが揃っていることを確認。
Run: `git diff main --stat`(またはブランチ運用に応じたベース比較)で変更ファイル一覧を確認。

- [ ] **Step 2: 影響範囲のテストをまとめて実行**

Run:
```bash
npx vitest run \
  src/components/housing/tour/__tests__/TourEmptyState.test.tsx \
  src/__tests__/housing/TourTray.test.tsx \
  src/lib/housing/__tests__/computeSnakeGridPositions.test.ts \
  src/components/housing/browse/__tests__/TourTrayBoard.test.tsx \
  src/components/housing/tour/__tests__/TourTrayDetailPanel.test.tsx \
  src/components/housing/pages/__tests__/TourNavPage.test.tsx \
  src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx
```
Expected: 全PASS

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 3: レビュー観点でセルフチェック**

- 設計書(`docs/superpowers/specs/2026-08-11-housing-tour-tray-page-design.md`)の「確定済みの決定」表の各行に対応する実装があるか1行ずつ確認する。
- housing.css に `rgba(`/`#[0-9a-f]{3,8}`/px直書きの新規混入が無いか grep で確認(`housing-design.md` のセルフレビュー手順)。
- 5言語(ja/en/ko/zh/zh-Hant)全てに新規i18nキー(`cta_browse`/`board_hint`)が入っているか確認。
- `TourReorderSheet` への参照が完全に消えているか確認: `grep -rn "TourReorderSheet" src/`(結果0件が期待値)。

- [ ] **Step 4: 実機確認をユーザーに依頼**

このタスクはコードでは検証できない([[feedback_no_screenshots_local_verify]])。ユーザーに以下を依頼する:
- PC(1489px/DPR2.58 or 1920px): 探すページでいくつかツアーに追加 → 「ツアー」タブを開く → 左に詳細・右に蛇行グリッドが出るか、ドラッグ/ピン/効率順/クリック選択/開始が動くか。
- スマホ幅: 下部ナビの「ツアー」タブで縦一覧の計画画面が出るか、フロートバーの「並べ替え」タップで同じ画面に飛ぶか。
- トレイが完全に空の状態で「ツアー」タブを開くと、今まで通り空状態(「お気に入りへ」+「探すへ」)が出るか。

- [ ] **Step 5: 最終コミット(必要なら)**

セルフチェック・実機確認で修正が出た場合のみ、修正内容ごとに個別コミットする(このタスク自体はレビューのみでコード変更は無い想定)。
