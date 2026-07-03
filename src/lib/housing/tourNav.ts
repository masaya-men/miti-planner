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
