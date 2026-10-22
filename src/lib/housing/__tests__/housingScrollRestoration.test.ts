import { describe, it, expect } from 'vitest';
import { installHousingScrollRestoration, isHousingPath } from '../housingScrollRestoration';

const fakeHistory = () => ({ scrollRestoration: 'auto' }) as unknown as History;

describe('installHousingScrollRestoration', () => {
  it('ハウジングの画面では再読み込み時のスクロール復元を止める', () => {
    for (const path of ['/housing', '/housing/favorites', '/h/masaya-abc']) {
      const h = fakeHistory();
      installHousingScrollRestoration(path, h);
      expect(h.scrollRestoration).toBe('manual');
    }
  });

  it('ハウジング以外の画面 (軽減表・LP) は触らない', () => {
    for (const path of ['/', '/miti', '/housingx']) {
      const h = fakeHistory();
      installHousingScrollRestoration(path, h);
      expect(h.scrollRestoration).toBe('auto');
    }
    expect(isHousingPath('/housingx')).toBe(false);
  });
});
