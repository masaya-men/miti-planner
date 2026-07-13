import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../data/housing/mockListings';
import { pickRegionLocale } from '../../data/housing/regionMap';
import { buildListingSearchText, matchesKeyword } from './listingSearch';

/** listings を keyword で絞る。keyword 空なら listings をそのまま返す。 */
export function useKeywordFilteredListings(
  listings: MockListing[],
  keyword: string,
): MockListing[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    if (keyword.trim().length === 0) return listings;
    const lang = i18n.language;
    const locale = pickRegionLocale(lang);
    return listings.filter((l) =>
      matchesKeyword(buildListingSearchText(l, t, lang, locale), keyword),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, keyword, t, i18n.language]);
}
