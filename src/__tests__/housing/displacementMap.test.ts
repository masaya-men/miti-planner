import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makeDisplacementMapDataURL } from '../../lib/housing/displacementMap';

// happy-dom / jsdom にも canvas 2D context は無いので、 関数のロジックが
// クラッシュしないこと + data URL を返すことを検証するための最小モックを用意する。
// 実描画品質はブラウザ実機で目視確認する前提。
type Globalish = typeof globalThis & {
  document?: { createElement: (tag: string) => unknown };
};

const g = globalThis as Globalish;
let originalDocument: Globalish['document'];

beforeAll(() => {
  originalDocument = g.document;
  const mockDocument = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected tag: ${tag}`);
      let width = 0;
      let height = 0;
      const canvas = {
        get width() {
          return width;
        },
        set width(v: number) {
          width = v;
        },
        get height() {
          return height;
        },
        set height(v: number) {
          height = v;
        },
        getContext: (kind: string) => {
          if (kind !== '2d') return null;
          return {
            createImageData: (w: number, h: number) => ({
              width: w,
              height: h,
              data: new Uint8ClampedArray(w * h * 4),
            }),
            putImageData: () => {},
          };
        },
        toDataURL: () => 'data:image/png;base64,AAAA',
      };
      return canvas;
    },
  };
  // TypeScript の document.createElement は HTMLElementTagNameMap オーバーロードで
  // 厳格に型付けされている。 テスト用の最小モックでは満たせないため、 unknown 経由で
  // キャストして強制代入する (happy-dom/jsdom にも canvas 2D context が無いため必要)。
  g.document = mockDocument as unknown as Globalish['document'];
});

afterAll(() => {
  g.document = originalDocument;
});

describe('makeDisplacementMapDataURL', () => {
  it('returns a data URL starting with data:image/png', () => {
    const url = makeDisplacementMapDataURL({ width: 100, height: 50, edge: 20, radius: 8 });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('handles tiny canvas (1x1) without throwing', () => {
    expect(() => makeDisplacementMapDataURL({ width: 1, height: 1, edge: 5, radius: 0 })).not.toThrow();
  });

  it('clamps dEdge at 0 for out-of-bounds rounded corners', () => {
    // 80x60 panel with radius 30 (oversized) — corners overlap at center
    expect(() => makeDisplacementMapDataURL({ width: 80, height: 60, edge: 40, radius: 30 })).not.toThrow();
  });
});
