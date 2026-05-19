/**
 * housing_listings コレクションの読み取り専用クライアント
 *
 * 書き込みは /api/housing 経由 (housingApiClient.ts 参照)。
 * Sub-spec 2A では同住所検索のみ使用、Sub-spec 2B のギャラリーで getRecentListings も使う。
 */
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { HousingListing, HousingArea } from '../types/housing';

const COLLECTION_NAME = 'housing_listings';

export async function findListingsByAddressKey(addressKey: string): Promise<HousingListing[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('addressKey', '==', addressKey),
    where('isHidden', '==', false),
    limit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<HousingListing, 'id'>),
  }));
}

interface ChamberQuery {
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  plot: number;
}

interface ApartmentQuery {
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  currentRoomNumber: number;
}

/** spec §4.2: 指定 plot の FC 個室一覧 (家全体ページで使う) */
export async function findChambersInPlot(q: ChamberQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('dc', '==', q.dc),
    where('server', '==', q.server),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('plot', '==', q.plot),
    where('roomKind', '==', 'private_chamber'),
    where('isHidden', '==', false),
    limit(50),
  );
  const snap = await getDocs(qref);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<HousingListing, 'id'>),
  }));
}

/**
 * spec §4.2: 指定 plot の家全体登録 (個室ページで使う、 親家)。 未登録なら null
 * 1 plot に 1 家全体登録のみ想定 (FF14 仕様で plot ごとに家主 1 名)。 複数登録は通報で吸収する。
 */
export async function findHouseForChamber(q: ChamberQuery): Promise<HousingListing | null> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('dc', '==', q.dc),
    where('server', '==', q.server),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('plot', '==', q.plot),
    where('buildingType', '==', 'house'),
    where('isHidden', '==', false),
    limit(5),  // 通常 1 件、 重複登録考慮で 5
  );
  const snap = await getDocs(qref);
  // roomKind=undefined (= 家全体) のみフィルタ。 Firestore は undefined where 不可のため client filter
  const houseDocs = snap.docs.filter((d) => d.data().roomKind === undefined);
  if (houseDocs.length === 0) return null;
  const doc = houseDocs[0];
  return { id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) };
}

/** spec §4.2: 同 ward のアパート他部屋一覧 (アパ部屋ページで使う、 現在の部屋を除く) */
export async function findApartmentRoomsInWard(q: ApartmentQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('dc', '==', q.dc),
    where('server', '==', q.server),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('buildingType', '==', 'apartment'),
    where('roomKind', '==', 'apartment_room'),  // schema integrity: apartment は必ず apartment_room
    where('isHidden', '==', false),
    limit(20),  // 1 ward あたり最大 20 件表示 (UI 可読性のため切り捨て)
  );
  const snap = await getDocs(qref);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) }))
    .filter((l) => l.roomNumber !== q.currentRoomNumber);  // 現在の部屋を除外 (Firestore != が limit と併用しづらいため client filter)
}
