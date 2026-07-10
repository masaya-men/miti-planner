import { describe, it, expect } from 'vitest';
import { getPlotSize, PLOT_SIZE_TABLE } from '../../data/housing/wardPlotSizes';
import { HOUSING_AREAS, type HousingArea } from '../../types/housing';
import wardDirections from '../../data/housing/wardDirections.generated.json';

import mistWard from '../../data/housing/mistWard.generated.json';
import mistSubWard from '../../data/housing/mistSubWard.generated.json';
import lavenderWard from '../../data/housing/lavenderWard.generated.json';
import lavenderSubWard from '../../data/housing/lavenderSubWard.generated.json';
import gobletWard from '../../data/housing/gobletWard.generated.json';
import gobletSubWard from '../../data/housing/gobletSubWard.generated.json';
import shiroganeWard from '../../data/housing/shiroganeWard.generated.json';
import shiroganeSubWard from '../../data/housing/shiroganeSubWard.generated.json';
import empyreumWard from '../../data/housing/empyreumWard.generated.json';
import empyreumSubWard from '../../data/housing/empyreumSubWard.generated.json';

/** `*Ward.generated.json` の最小構造 (面積計算に必要な分だけ)。 */
type WardJson = {
    viewBox: { w: number; h: number };
    houses: Array<{ kind: string; plot?: number; outline?: number[][] }>;
};

/** [本街 (plot 1-30), 拡張街 (plot 31-60)] */
const WARD_JSON: Record<HousingArea, [WardJson, WardJson]> = {
    Mist: [mistWard as WardJson, mistSubWard as WardJson],
    LavenderBeds: [lavenderWard as WardJson, lavenderSubWard as WardJson],
    Goblet: [gobletWard as WardJson, gobletSubWard as WardJson],
    Shirogane: [shiroganeWard as WardJson, shiroganeSubWard as WardJson],
    Empyreum: [empyreumWard as WardJson, empyreumSubWard as WardJson],
};

describe('wardPlotSizes: 表の構造不変条件', () => {
    it.each(HOUSING_AREAS)('%s は 60 文字で S/M/L のみ', (area) => {
        const table = PLOT_SIZE_TABLE[area];
        expect(table).toHaveLength(60);
        expect(table).toMatch(/^[SML]{60}$/);
    });

    it.each(HOUSING_AREAS)('%s の構成比は 40 S / 14 M / 6 L', (area) => {
        const table = PLOT_SIZE_TABLE[area];
        const count = (c: string) => [...table].filter((x) => x === c).length;
        expect({ S: count('S'), M: count('M'), L: count('L') }).toEqual({ S: 40, M: 14, L: 6 });
    });

    it.each(HOUSING_AREAS)('%s の拡張街 (31-60) は本街 (1-30) のコピー', (area) => {
        const table = PLOT_SIZE_TABLE[area];
        expect(table.slice(30, 60)).toBe(table.slice(0, 30));
    });

    it('エリアごとに並びが異なる (5 本の独立した表)', () => {
        const tables = HOUSING_AREAS.map((a) => PLOT_SIZE_TABLE[a]);
        expect(new Set(tables).size).toBe(HOUSING_AREAS.length);
    });
});

describe('getPlotSize', () => {
    it('既知の区画を引ける (housingsnap / 幾何実測と突き合わせ済み)', () => {
        expect(getPlotSize('Shirogane', 7)).toBe('L');
        expect(getPlotSize('Shirogane', 8)).toBe('M');
        // housingsnap.com/47205 = Shirogane w21 p58、 og:title が "rainforest [M]"
        expect(getPlotSize('Shirogane', 58)).toBe('M');
        expect(getPlotSize('Mist', 30)).toBe('M');
        expect(getPlotSize('Mist', 32)).toBe('L');
    });

    it('FC 個室は親 plot のサイズをそのまま引ける (専用分岐は不要)', () => {
        // roomKind='private_chamber' でも参照する plot 番号は同じ。
        expect(getPlotSize('Empyreum', 22)).toBe('L');
    });

    it('範囲外 / 不正なエリアは null', () => {
        expect(getPlotSize('Mist', 0)).toBeNull();
        expect(getPlotSize('Mist', 61)).toBeNull();
        expect(getPlotSize('Mist', 1.5)).toBeNull();
        expect(getPlotSize('Mist', Number.NaN)).toBeNull();
        expect(getPlotSize('NotAnArea', 1)).toBeNull();
    });
});

/**
 * 靴紐公式。 罠が 2 つある:
 * 1. `outline` は 0-1 正規化。 viewBox が非正方形 (例 Mist 1882x1394) なので実 px に戻してから計算する。
 * 2. **閉じ方がエリアで違う**。 Mist/Shirogane/LavenderBeds/Empyreum は 9 点で終点=始点 (閉multiple)、
 *    Goblet だけ 4 点で閉じていない (元 SVG が `<rect transform=rotate()>` のため)。
 *    添字を wrap させて最終辺を必ず足す (閉じている場合その辺は長さ 0 で寄与 0)。
 */
function outlineAreaPx(json: WardJson, outline: number[][]): number {
    const pts = outline.map(([x, y]) => [x * json.viewBox.w, y * json.viewBox.h] as const);
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        acc += x1 * y2 - x2 * y1;
    }
    return Math.abs(acc) / 2;
}

describe('wardPlotSizes: 地図の実測面積と 300/300 一致する (独立系統での検証)', () => {
    // S≈11.1k / M≈20.0k / L≈35.5k の 3 クラスタに完全分離し中間値が無いので、
    // 十分マージンのある境界で分類できる。
    const classify = (px: number): 'S' | 'M' | 'L' => (px > 28_000 ? 'L' : px > 15_000 ? 'M' : 'S');

    it.each(HOUSING_AREAS)('%s の 60 区画すべて', (area) => {
        const mismatches: string[] = [];
        WARD_JSON[area].forEach((json, half) => {
            for (const house of json.houses) {
                if (house.kind !== 'plot' || !house.outline || house.plot === undefined) continue;
                const plot = house.plot + half * 30; // sub ward は 1-30 のローカル番号
                const measured = classify(outlineAreaPx(json, house.outline));
                const expected = getPlotSize(area, plot);
                if (measured !== expected) {
                    mismatches.push(`plot${plot}: 実測=${measured} / 表=${expected}`);
                }
            }
        });
        expect(mismatches).toEqual([]);
    });
});

describe('wardDirections の行き方本文に書かれたサイズが表と一致する', () => {
    const SIZE_MENTION = /([ＳＭＬSML])\s*ハウス/gu;
    const toAscii = (c: string): string => ({ Ｓ: 'S', Ｍ: 'M', Ｌ: 'L' })[c] ?? c;

    it.each(HOUSING_AREAS)('%s', (area) => {
        const byPlot = (wardDirections as Record<string, Record<string, { directions?: string }>>)[area];
        const mismatches: string[] = [];

        for (const [plotStr, entry] of Object.entries(byPlot ?? {})) {
            const plot = Number(plotStr);
            const text = entry.directions ?? '';
            const mentioned = [...text.matchAll(SIZE_MENTION)].map((m) => toAscii(m[1]));
            // 「〜のＬハウスの隣」のようなランドマーク参照が入ると 2 個以上になる。
            // 現状データは全行 0 or 1 個なので、 1 個のときだけ「目的地そのもの」とみなす。
            if (mentioned.length !== 1) continue;
            const expected = getPlotSize(area, plot);
            if (mentioned[0] !== expected) {
                mismatches.push(`plot${plot}: 本文「${text}」= ${mentioned[0]} / 実際は ${expected}`);
            }
        }

        expect(mismatches).toEqual([]);
    });

    it('サイズ表記が 2 個以上ある行は無い (あればランドマーク参照として上のテストを見直すこと)', () => {
        const multi: string[] = [];
        for (const [area, byPlot] of Object.entries(
            wardDirections as Record<string, Record<string, { directions?: string }>>,
        )) {
            for (const [plot, entry] of Object.entries(byPlot)) {
                const n = [...(entry.directions ?? '').matchAll(SIZE_MENTION)].length;
                if (n > 1) multi.push(`${area} plot${plot}`);
            }
        }
        expect(multi).toEqual([]);
    });
});
