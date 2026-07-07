import { describe, it, expect, vi } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../data/housing/mistWard.generated.json';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
import lavenderWardRaw from '../../../data/housing/lavenderWard.generated.json';
import { resolveWardMapRef } from '../resolveWardMapRef';
import type { TourStep } from '../tourNav';

// 改善2 用: 入口データ収録済みケースを模擬 (実データは空 {} のため plot 21 のみ収録扱いにする)。
// 既存テストが使う plot(6/40/12) やアパート棟(apart)は未収録のまま = 実データと同じ挙動(computePlotDoor フォールバック)を維持。
vi.mock('../../../data/housing/wardEntrances.generated.json', () => ({
  default: { mist: { '21': [0.2, 0.3] } },
}));

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
  it('経路の終点(道 or ジャンプ)は箱の中心ちょうどではない (改善2: 箱の縁で止まる)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const endPath = m.routeJumpPath ?? m.routePath!;
    // 数値ペアを全て拾い最後を終点に(ジャンプは Q 弧 = "M.. Q Cx Cy Ex Ey" なので M/L 縛りだと終点を拾えない)。
    const coords = [...endPath.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    const last = coords.at(-1)!;
    const [lx, ly] = [Number(last[1]), Number(last[2])];
    const house = mistWard.houses.find((h) => h.plot === 6 && h.kind === 'plot')!;
    const cx = house.x * mistWard.viewBox.w, cy = house.y * mistWard.viewBox.h;
    expect(Math.hypot(lx - cx, ly - cy)).toBeGreaterThan(1);
  });
  it('経路の始点(M)はエーテライト実座標 (改善1: 投影起点)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const start = m.routePath!.match(/^M(-?[\d.]+) (-?[\d.]+)/)!;
    expect(Number(start[1])).toBeCloseTo(m.origin!.x, 0);
    expect(Number(start[2])).toBeCloseTo(m.origin!.y, 0);
  });
  it('入口データが収録済みの区画は経路の終点が入口(0..1×viewBox)になる (改善2: 入口優先)', () => {
    const cur = L({ id: 'a', plot: 21 }); const ref = mistRef(21);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const endPath = m.routeJumpPath ?? m.routePath!;
    // 数値ペアを全て拾い最後を終点に(ジャンプは Q 弧 = "M.. Q Cx Cy Ex Ey" なので M/L 縛りだと終点を拾えない)。
    const coords = [...endPath.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    const last = coords.at(-1)!;
    expect(Number(last[1])).toBeCloseTo(0.2 * mistWard.viewBox.w, 1);
    expect(Number(last[2])).toBeCloseTo(0.3 * mistWard.viewBox.h, 1);
  });
  it('override の road 区間は道なりに追従して展開される(生の点数より増える)', () => {
    // lavender plot 26 は override 済み(road 1区間・9点)で別 edge をまたぐカーブを含む(実データ)。
    const lavenderWard = lavenderWardRaw as unknown as WardMapJson;
    const cur = L({ id: 'lv26', area: 'LavenderBeds', plot: 26 });
    const ref = resolveWardMapRef('LavenderBeds', 26, null, 'house')!;
    const m = buildTourMapPlacements(lavenderWard, ref.mapKey, ref, cur, [step(cur)], 0);
    const coords = [...(m.routePath ?? '').matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    expect(coords.length).toBeGreaterThan(9); // 追従で中間のカーブ頂点が増える(生 road 点=9)
  });
});
