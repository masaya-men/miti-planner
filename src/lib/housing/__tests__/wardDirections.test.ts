import { describe, it, expect } from 'vitest';
import { getPlotDirections, getPlotDirectionsText } from '../wardDirections';
import wardAetherytes from '../../../data/housing/wardAetherytes.generated.json';

const AREAS = ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'] as const;

/** area → [本街マップ key, 拡張街マップ key] */
const MAP_KEYS: Record<(typeof AREAS)[number], [string, string]> = {
  Mist: ['mist', 'mist-sub'],
  LavenderBeds: ['lavender', 'lavender-sub'],
  Goblet: ['goblet', 'goblet-sub'],
  Shirogane: ['shirogane', 'shirogane-sub'],
  Empyreum: ['empyreum', 'empyreum-sub'],
};

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

  /**
   * 行き方 CSV (`src/data/housing/directions-src/*.csv`) が正典になった (2026-07-10、スプシは引退)。
   * 手書きなので、書いた最寄りエーテライト名が実際に**その地図上に存在する**ことを機械的に守る。
   * 名前が地図と食い違うと、ツアーの地図にエーテライト名ラベルが出なくなる (過去に実バグあり)。
   *
   * 注意 2 つ:
   * - 拡張街のエーテライト名は地図データ側も `[拡張街]` 接頭辞を**含む**。剥がして比較しないこと。
   * - CSV 側は人間向けに注記を足すことがある (「ゴブレット市場（居住区担当官）」「ミスト・ヴィレッジ南（船着場）」)。
   *   括弧注記を除いた本体名で突き合わせる。
   */
  it('最寄りエーテライト名が全 300 区画で実際の地図上に存在する', () => {
    const aetherytes = wardAetherytes as Record<string, Array<{ name: string }>>;
    const stripNote = (s: string) => s.replace(/（[^）]*）/g, '').trim();
    const missing: string[] = [];

    for (const area of AREAS) {
      const [mainKey, subKey] = MAP_KEYS[area];
      const mainNames = new Set(aetherytes[mainKey].map((a) => stripNote(a.name)));
      const subNames = new Set(aetherytes[subKey].map((a) => stripNote(a.name)));

      for (let p = 1; p <= 60; p++) {
        const name = stripNote(getPlotDirections(area, p)!.aetheryte);
        const names = p > 30 ? subNames : mainNames;
        if (!names.has(name)) missing.push(`${area} plot${p}: 「${name}」`);
      }
    }

    expect(missing).toEqual([]);
  });

  // Task8: 行き方本文の en/ko/zh 訳 (正典 CSV は translations/{lang}/*.csv)。
  it('全 300 区画に en/ko/zh の行き方がある', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let plot = 1; plot <= 60; plot++) {
        for (const l of ['en', 'ko', 'zh'] as const) {
          expect(getPlotDirectionsText(area, plot, l), `${area}#${plot} ${l}`).toBeTruthy();
        }
      }
    }
  });
  it('ja は従来値、未知 locale 系はフォールバック', () => {
    expect(getPlotDirectionsText('Mist', 1, 'ja')).toBe(getPlotDirections('Mist', 1)!.directions);
  });
});
