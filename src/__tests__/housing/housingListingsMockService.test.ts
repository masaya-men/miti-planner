import { describe, it, expect } from 'vitest';
import { fetchAllListings, fetchListingById } from '../../lib/housing/housingListingsMockService';

describe('housingListingsMockService', () => {
  it('fetchAllListings returns the mock 50 listings', async () => {
    const listings = await fetchAllListings();
    // Guard: the gallery is designed around 50 demo items. Update both the data and this number together.
    expect(listings.length).toBe(50);
  });

  it('fetchListingById returns one matching listing', async () => {
    const listing = await fetchListingById('mock-001');
    expect(listing?.id).toBe('mock-001');
  });

  it('fetchListingById returns null for unknown id', async () => {
    const listing = await fetchListingById('does-not-exist');
    expect(listing).toBeNull();
  });
});
