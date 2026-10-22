import type { MockListing } from '../../data/housing/mockListings';

/**
 * ハウジンガーページの「他人視点」一覧のメモリキャッシュ (uid ごと)。
 * 同じ人を再訪したとき前回の一覧を即表示し、裏で最新を取り直して差し替えるために使う。
 * モジュール内の Map のみ = ページ再読み込みで消える。localStorage 等には保存しない。
 */
export interface HousingerListingsCacheEntry {
  listings: MockListing[];
  hiddenListings: MockListing[];
}

const cache = new Map<string, HousingerListingsCacheEntry>();

export const getCachedHousingerListings = (uid: string): HousingerListingsCacheEntry | undefined =>
  cache.get(uid);

export const setCachedHousingerListings = (uid: string, entry: HousingerListingsCacheEntry): void => {
  cache.set(uid, entry);
};

/** テスト間でキャッシュが漏れないようにするためのリセット。 */
export const __resetHousingerListingsCacheForTest = (): void => {
  cache.clear();
};
