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
});
