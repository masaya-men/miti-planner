import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../data/housing/mistWard.generated.json';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
import { resolveWardMapRef } from '../resolveWardMapRef';
import type { TourStep } from '../tourNav';
import { buildTourMapPlacements } from '../buildTourMapPlacements';
const mistWard = mistWardRaw as unknown as WardMapJson;
const mistSubWard = mistSubWardRaw as unknown as WardMapJson;
const L = (over: Partial<MockListing>): MockListing => ({ id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'Mist', ward: 1, buildingType: 'house', plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over });
const step = (l: MockListing | null): TourStep => ({ id: l?.id ?? 'none', listing: l });
const mistRef = (plot: number) => resolveWardMapRef('Mist', plot, null, 'house')!;

describe('buildTourMapPlacements', () => {
  it('現在の目的地 plot の target 座標を返す', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull(); expect(m.target!.x).toBeGreaterThan(0);
  });
  it('実エーテライト起点から家までの経路を毎回返す (起点マーカーも)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.routePath).toMatch(/^M/);   // 直前の家に依存せず常に経路がある
    expect(m.origin).not.toBeNull();     // エーテライトシャード座標マーカー
  });
  it('同一ワード地図の他ステップだけ placed に含める (拡張街は別 mapKey で除外)', () => {
    const steps = [ step(L({ id: 'a', plot: 6 })), step(L({ id: 'b', plot: 40 })), step(L({ id: 'c', plot: 12 })) ];
    const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, steps[0].listing, steps, 0);
    expect(m.placed.map((p) => p.index).sort()).toEqual([0, 2]);
  });
  it('target が解決できたら targetElId に ref.elementId を載せる (家)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.targetElId).toBe('plot_6');
  });
  it('アパート本街(棟1)は target/経路/起点/targetElId が揃う', () => {
    const cur = L({ id: 'ap1', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 1, roomNumber: 5 });
    const ref = resolveWardMapRef('Mist', null, 1, 'apartment')!;
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull();
    expect(m.routePath).toMatch(/^M/);
    expect(m.origin).not.toBeNull();
    expect(m.targetElId).toBe('apart_1');
  });
  it('アパート拡張街(棟2)も target/経路/起点/targetElId が揃う (棟2バグ解消)', () => {
    const cur = L({ id: 'ap2', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 2, roomNumber: 5 });
    const ref = resolveWardMapRef('Mist', null, 2, 'apartment')!;
    const m = buildTourMapPlacements(mistSubWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull();
    expect(m.routePath).toMatch(/^M/);
    expect(m.origin).not.toBeNull();
    expect(m.targetElId).toBe('apart_2');
    expect(m.placed.map((p) => p.index)).toEqual([0]); // アパートステップも placed に載る
  });
});
