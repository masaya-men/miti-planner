import { MOCK_LISTINGS, type MockListing } from '../../data/housing/mockListings';

/**
 * housing listings の単一データアクセスポイント。
 * Phase 1: モックデータを返す。
 * Phase 2 / 本番: Firestore の housing_listings コレクション読み取りに差し替え。
 */

export async function fetchAllListings(): Promise<MockListing[]> {
  return Promise.resolve(MOCK_LISTINGS);
}

export async function fetchListingById(id: string): Promise<MockListing | null> {
  return Promise.resolve(MOCK_LISTINGS.find((l) => l.id === id) ?? null);
}
