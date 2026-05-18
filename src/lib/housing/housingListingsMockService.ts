import { MOCK_LISTINGS, type MockListing } from '../../data/housing/mockListings';

/**
 * Phase 1 mock data layer for the Sub-spec 2B Gallery & Tour workspace.
 *
 * IMPORTANT: NOT to be confused with `src/lib/housingListingsService.ts`,
 * which is the production Firestore client for `housing_listings`
 * (Sub-spec 2A address-key lookup + Sub-spec 2B getRecentListings later).
 *
 * Phase 2 plan: delete this file. Callers move to the Firestore service
 * once real data is wired through.
 */

export async function fetchAllListings(): Promise<MockListing[]> {
  return Promise.resolve(MOCK_LISTINGS);
}

export async function fetchListingById(id: string): Promise<MockListing | null> {
  return Promise.resolve(MOCK_LISTINGS.find((l) => l.id === id) ?? null);
}
