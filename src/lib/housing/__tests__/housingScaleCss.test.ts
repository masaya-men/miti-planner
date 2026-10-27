import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readCssBundle } from '../../../styles/__tests__/readCssBundle';

// PC 倍率方式 (CSS zoom 不使用) の取り決めを housing.css に対して固定するテスト
const css = readCssBundle(fileURLToPath(new URL('../../../styles/housing.css', import.meta.url)));

describe('housing.css の PC 倍率', () => {
  it('CSS zoom と ?typo 用の属性セレクタが残っていない', () => {
    expect(css).not.toMatch(/(^|[;{\s])zoom\s*:/);
    expect(css).not.toContain('data-housing-typo');
  });

  it('倍率トークン 2 つ (全体 / 中央パネル) が定義されている', () => {
    expect(css).toMatch(/--housing-scale-pc:\s*[\d.]+;/);
    expect(css).toMatch(/--housing-scale-center:\s*[\d.]+;/);
    expect(css).toMatch(/\.housing-browse-col-center\s*\{\s*--housing-scale:\s*var\(--housing-scale-center\)/);
  });

  it('スマホ (≤767px) では倍率が 1 のまま (PC 用上書きは min-width:768px の中だけ)', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--housing-scale:\s*1;/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{\s*:root \{ --housing-scale: var\(--housing-scale-pc\); \}/);
  });
});
