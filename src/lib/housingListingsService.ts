/**
 * housing_listings コレクションの読み取り専用クライアント
 *
 * 書き込みは /api/housing 経由 (housingApiClient.ts 参照)。
 * Sub-spec 2A では同住所検索のみ使用、Sub-spec 2B のギャラリーで getRecentListings も使う。
 */
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { HousingListing } from '../types/housing';

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
