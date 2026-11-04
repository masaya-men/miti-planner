import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { collectStaticImports } from './_staticImportGraph.js';

// 公開読みの窓口の起動(コールドスタート)で sharp(ネイティブ libvips)を読まないことを守る。
// sharp は使う処理の中で api/_lib/loadSharp.ts から遅延読み込みする。
// vi.mock('sharp') は vmThreads でモック汚染の恐れがあるため、静的 import のグラフを辿って確かめる。
const ROOT = resolve(__dirname, '..', '..');
const ENTRIES = [
  'api/housing/index.ts',
  'api/share/index.ts',
  'api/template/index.ts',
  'api/collab/index.ts',
  'api/og-cache/index.ts',
];

describe('sharp を静的に読まない', () => {
  for (const entry of ENTRIES) {
    it(`${entry} の起動で sharp を静的に読まない`, () => {
      const { bareSpecifiers } = collectStaticImports(resolve(ROOT, entry));
      expect(bareSpecifiers.has('sharp')).toBe(false);
    });
  }

  it('ヘルパーは静的 import の sharp を検出できる', () => {
    expect(collectStaticImports(resolve(ROOT, 'api/_lib/loadSharp.ts')).bareSpecifiers.has('sharp')).toBe(false);
    expect(
      collectStaticImports(resolve(ROOT, 'api/housing/__tests__/_coverThumbHash.test.ts')).bareSpecifiers.has('sharp'),
    ).toBe(true);
  });
});
