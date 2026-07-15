import { describe, it, expect } from 'vitest';
import { buildAllAddressListings, PREVIEW_MAPS } from '../devTourPreview';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import type { HousingArea } from '../../../store/useHousingFilterStore';
import { resolveWardMapRef } from '../resolveWardMapRef';
import mist from '../../../data/housing/mistWard.generated.json';
import mistSub from '../../../data/housing/mistSubWard.generated.json';
import goblet from '../../../data/housing/gobletWard.generated.json';
import gobletSub from '../../../data/housing/gobletSubWard.generated.json';
import lavender from '../../../data/housing/lavenderWard.generated.json';
import lavenderSub from '../../../data/housing/lavenderSubWard.generated.json';
import shirogane from '../../../data/housing/shiroganeWard.generated.json';
import shiroganeSub from '../../../data/housing/shiroganeSubWard.generated.json';
import empyreum from '../../../data/housing/empyreumWard.generated.json';
import empyreumSub from '../../../data/housing/empyreumSubWard.generated.json';

const JSON_BY_KEY: Record<string, WardMapJson> = {
  mist: mist as unknown as WardMapJson, 'mist-sub': mistSub as unknown as WardMapJson,
  goblet: goblet as unknown as WardMapJson, 'goblet-sub': gobletSub as unknown as WardMapJson,
  lavender: lavender as unknown as WardMapJson, 'lavender-sub': lavenderSub as unknown as WardMapJson,
  shirogane: shirogane as unknown as WardMapJson, 'shirogane-sub': shiroganeSub as unknown as WardMapJson,
  empyreum: empyreum as unknown as WardMapJson, 'empyreum-sub': empyreumSub as unknown as WardMapJson,
};
const LOADED = PREVIEW_MAPS.map((m) => ({ area: m.area as HousingArea, isSub: m.isSub, json: JSON_BY_KEY[m.mapKey] }));

describe('buildAllAddressListings', () => {
  const all = buildAllAddressListings(LOADED);
  it('全住所を生成する(200件以上)', () => {
    expect(all.length).toBeGreaterThan(200);
  });
  it('全件 resolveWardMapRef が非nullを返す(=実在住所のみ)', () => {
    for (const l of all) {
      const ref = resolveWardMapRef(l.area ?? '', l.plot ?? null, l.apartmentBuilding ?? null, l.buildingType);
      expect(ref, l.id).not.toBeNull();
    }
  });
  it('拡張街は plot 31-60 に読み替わる', () => {
    const subPlots = all.filter((l) => l.buildingType === 'house' && (l.plot ?? 0) >= 31);
    expect(subPlots.length).toBeGreaterThan(0);
    expect(Math.min(...subPlots.map((l) => l.plot ?? 0))).toBe(31);
  });
  it('アパートは棟1(本街)と棟2(拡張)の両方がある', () => {
    expect(all.some((l) => l.buildingType === 'apartment' && l.apartmentBuilding === 1)).toBe(true);
    expect(all.some((l) => l.buildingType === 'apartment' && l.apartmentBuilding === 2)).toBe(true);
  });
  it('id は一意', () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });
});
