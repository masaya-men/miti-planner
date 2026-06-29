import { describe, it, expect } from 'vitest';
import { matchesMobile, MOBILE_MEDIA_QUERY } from '../useIsMobile';

/** matchMedia(query).matches を固定値で返す擬似 window。 */
function fakeWin(matches: boolean): Pick<Window, 'matchMedia'> {
  return {
    matchMedia: ((q: string) => ({
      matches: q === MOBILE_MEDIA_QUERY ? matches : false,
    })) as Window['matchMedia'],
  };
}

describe('matchesMobile', () => {
  it('max-width:767px にマッチすれば true', () => {
    expect(matchesMobile(fakeWin(true))).toBe(true);
  });
  it('マッチしなければ false', () => {
    expect(matchesMobile(fakeWin(false))).toBe(false);
  });
  it('window が undefined なら false (SSR)', () => {
    expect(matchesMobile(undefined)).toBe(false);
  });
  it('matchMedia 非対応なら false', () => {
    expect(matchesMobile({} as Pick<Window, 'matchMedia'>)).toBe(false);
  });
});
