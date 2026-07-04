import { describe, it, expect } from 'vitest';
import { getMapAetherytes } from '../wardAetherytes';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';

describe('wardAetherytes.generated.json', () => {
  it('全 mapKey にシャードがあり x,y は 0..1・node は非空', () => {
    for (const mapKey of Object.keys(WARD_MAP_LOADERS)) {
      const shards = getMapAetherytes(mapKey);
      expect(shards.length, mapKey).toBeGreaterThan(0);
      for (const s of shards) {
        expect(s.x, `${mapKey} ${s.name} x`).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(1);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(s.node.length, `${mapKey} ${s.name} node`).toBeGreaterThan(0);
      }
    }
  });

  it('拡張街(-sub) の shard 名は [拡張街] 付き・本街は付かない (本街/拡張の分離)', () => {
    for (const mapKey of Object.keys(WARD_MAP_LOADERS)) {
      const isSub = mapKey.endsWith('-sub');
      for (const s of getMapAetherytes(mapKey)) {
        expect(s.name.startsWith('[拡張街]'), `${mapKey} ${s.name}`).toBe(isSub);
      }
    }
  });

  const REFS: Array<[string, string, number, number]> = [
    ['mist', 'ミスト・ヴィレッジ北東', 0.661, 0.216],
    ['mist', 'ミスト・ヴィレッジ南', 0.303, 0.705],
    ['lavender', 'ラベンダーベッド北西', 0.172, 0.323],
    ['goblet', 'ゴブレットビュート西', 0.177, 0.421],
    ['shirogane', 'シロガネ北西', 0.235, 0.115],
    ['empyreum', 'エンピレアム北西', 0.222, 0.234],
  ];
  it('基準シャードの座標が正しい(方角と象限が一致・パーサ回帰検知)', () => {
    for (const [mapKey, name, ex, ey] of REFS) {
      const s = getMapAetherytes(mapKey).find((z) => z.name === name);
      expect(s, `${mapKey} ${name}`).toBeTruthy();
      expect(Math.abs(s!.x - ex), `${mapKey} ${name} x`).toBeLessThan(0.02);
      expect(Math.abs(s!.y - ey), `${mapKey} ${name} y`).toBeLessThan(0.02);
    }
  });
});
