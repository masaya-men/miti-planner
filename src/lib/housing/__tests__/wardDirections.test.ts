import { describe, it, expect } from 'vitest';
import { getPlotDirections } from '../wardDirections';

describe('getPlotDirections', () => {
  it('Mist plot 1 → 実エーテライト名+行き方', () => {
    expect(getPlotDirections('Mist', 1)).toEqual({
      aetheryte: 'ミストゲート・スクエア',
      directions: '西の階段をまっすぐ降りたとこ',
    });
  });

  it('拡張街 plot 60 も引ける', () => {
    const d = getPlotDirections('Mist', 60);
    expect(d?.aetheryte).toBe('[拡張街]ミスト・ヴィレッジ南西');
  });

  it('全5エリア×60が揃い、最寄りエーテライトは全件ある', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 60; p++) {
        const d = getPlotDirections(area, p);
        expect(d, `${area} ${p}`).not.toBeNull();
        // エーテライト名は全 300 件で必ず存在する。
        expect(d!.aetheryte.length, `${area} ${p} aetheryte`).toBeGreaterThan(0);
      }
    }
  });

  // 2026-07-10: Goblet 拡張街(31-60) の 30 件を追記し、全 300 区画に行き方本文が入った。
  // (それまではここだけ空文字列で、ツアーの「行き方」が空欄になっていた)
  it('行き方本文は全 300 区画にある', () => {
    const emptyDirections: string[] = [];
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 60; p++) {
        const d = getPlotDirections(area, p)!;
        if (d.directions.length === 0) emptyDirections.push(`${area}:${p}`);
      }
    }
    expect(emptyDirections).toEqual([]);
  });

  it('plot 無し/範囲外/未知エリアは null', () => {
    expect(getPlotDirections('Mist', null)).toBeNull();
    expect(getPlotDirections('Mist', undefined)).toBeNull();
    expect(getPlotDirections('Mist', 61)).toBeNull();
    expect(getPlotDirections('Mist', 0)).toBeNull();
    expect(getPlotDirections('Nowhere', 1)).toBeNull();
  });
});
