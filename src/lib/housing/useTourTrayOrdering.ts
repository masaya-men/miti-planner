import { useMemo } from 'react';
import { useSensors, useSensor, PointerSensor, KeyboardSensor, type DragEndEvent } from '@dnd-kit/core';
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
  pinnedIds: string[];
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
  const togglePinStore = useTourTrayStore((s) => s.togglePin);
  const pinStore = useTourTrayStore((s) => s.pin);
  const clearPinsStore = useTourTrayStore((s) => s.clearPins);

  // 行解決プール: 公開一覧 → 自分の登録 → 一時 listing (TourTray と同じ合流)。
  // 50-100 件規模 + ドラッグ中の高頻度再描画を想定するため、配列 spread と並び解決 (Map 構築 + sort)
  // は毎レンダー再計算せず useMemo で固定する。参照が変わらない限り結果は同一。
  const pool = useMemo(
    () => [...listings, ...myListings, ...ephemeral],
    [listings, myListings, ephemeral],
  );
  const orderedIds = useMemo(
    () => resolveTourOrder(listingIds, pool, { pinnedIds }),
    [listingIds, pool, pinnedIds],
  );

  const items = useMemo(
    () =>
      orderedIds
        .map(
          (id) =>
            listings.find((l) => l.id === id) ??
            myListings.find((l) => l.id === id) ??
            ephemeral.find((l) => l.id === id),
        )
        .filter((l): l is MockListing => Boolean(l)),
    [orderedIds, listings, myListings, ephemeral],
  );

  const remove = (id: string) => {
    onChange(listingIds.filter((x) => x !== id));
    if (pinnedIds.includes(id)) togglePinStore(id);
  };

  // ピン留め: 表示中の並び (resolveTourOrder の結果) をまず実体化してからピンを立てる
  // = 見えている位置がそのまま固定位置になる。
  const togglePin = (id: string) => {
    onChange(orderedIds);
    togglePinStore(id);
  };

  // 効率順に並び替え = リセット動作。ピンをドラッグ由来分も含め全解除してから、
  // 何も固定しない状態で自動順を組み直す (2026-08-11: ピンが「1回ドラッグしただけで無反応になる」
  // 罠を解消するため、ドラッグ確定は下記の通りピン留めとして扱うことにした。その代わり
  // 「まっさらに戻したい」ときの手段としてこのボタンを全ピン解除も兼ねる形にした)。
  const onSortEfficient = () => {
    clearPinsStore();
    const next = resolveTourOrder(listingIds, pool, { pinnedIds: [] });
    onChange(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ドラッグで動かしたカードは、その場でピン留めする (2026-08-11)。こうすることで
  // 「ドラッグ=その位置に固定する意思表示」として統一し、他の既存ピンを巻き込んで
  // 無効化することもなくなる (resolveTourOrder は常にピンを尊重する1ルールのみ)。
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(orderedIds, oldIndex, newIndex));
    pinStore(String(active.id));
  };

  return { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd };
}
