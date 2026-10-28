import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { listHousingCss } from '../listHousingCss.mjs';

describe('listHousingCss', () => {
  const list: string[] = listHousingCss();
  it('入口の共有が先頭(トークンが 1 番目)', () => {
    expect(list[0]).toBe('src/styles/housing/tokens.css');
  });
  it('部品の隣の CSS も含む', () => {
    expect(list).toContain('src/components/housing/tour/TourNavMap.css');
  });
  it('重複しない', () => {
    expect(new Set(list).size).toBe(list.length);
  });
});
