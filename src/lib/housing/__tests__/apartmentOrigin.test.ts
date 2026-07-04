import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { getApartmentOrigin } from '../apartmentOrigin';
import mistWardRaw from '../../../data/housing/mistWard.generated.json';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
import lavenderSubWardRaw from '../../../data/housing/lavenderSubWard.generated.json';
import gobletSubWardRaw from '../../../data/housing/gobletSubWard.generated.json';
import shiroganeSubWardRaw from '../../../data/housing/shiroganeSubWard.generated.json';
import empyreumSubWardRaw from '../../../data/housing/empyreumSubWard.generated.json';

const asJson = (j: unknown) => j as unknown as WardMapJson;
const SUBS: Array<[string, WardMapJson]> = [
  ['mist-sub', asJson(mistSubWardRaw)],
  ['lavender-sub', asJson(lavenderSubWardRaw)],
  ['goblet-sub', asJson(gobletSubWardRaw)],
  ['shirogane-sub', asJson(shiroganeSubWardRaw)],
  ['empyreum-sub', asJson(empyreumSubWardRaw)],
];

describe('getApartmentOrigin', () => {
  it('本街(mist)の apart 起点は解決でき node 非空・非[拡張街]', () => {
    const o = getApartmentOrigin(asJson(mistWardRaw), 'mist');
    expect(o).not.toBeNull();
    expect(o!.node.length).toBeGreaterThan(0);
    expect(o!.aetheryte.startsWith('[拡張街]')).toBe(false);
  });
  it('全拡張街マップの apart 起点は node 非空・必ず[拡張街]シャード (クロス0)', () => {
    for (const [mapKey, json] of SUBS) {
      const o = getApartmentOrigin(json, mapKey);
      expect(o, mapKey).not.toBeNull();
      expect(o!.node.length, mapKey).toBeGreaterThan(0);
      expect(o!.aetheryte.startsWith('[拡張街]'), `${mapKey} ${o!.aetheryte}`).toBe(true);
    }
  });
  it('未知 mapKey (シャード無し) は null', () => {
    expect(getApartmentOrigin(asJson(mistWardRaw), 'nowhere')).toBeNull();
  });
});
