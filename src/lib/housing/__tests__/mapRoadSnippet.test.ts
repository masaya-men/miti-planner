import { describe, it, expect } from 'vitest';
import {
  splitSubpaths,
  extractPoints,
  boundingBox,
  selectRoadSnippet,
  pickCropWindow,
  pickRoadSnippet,
  outlineToNativePoints,
  selectHouseOutlines,
  CROP_WIDTH,
  CROP_HEIGHT,
} from '../mapRoadSnippet';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import mistWard from '../../../data/housing/mistWard.generated.json';

describe('mapRoadSnippet (2026-08-19 Allmarksまとめてインポート演出)', () => {
  it('splitSubpaths: Mごとに部分パスへ分割する', () => {
    const parts = splitSubpaths('M0 0L10 10M20 20L30 30');
    expect(parts).toEqual(['M0 0L10 10', 'M20 20L30 30']);
  });

  it('splitSubpaths: 空文字は空配列', () => {
    expect(splitSubpaths('')).toEqual([]);
  });

  it('extractPoints: M/L/H/V の頂点列を復元する', () => {
    const points = extractPoints('M10 20L30 40H50V60');
    expect(points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it('extractPoints: C は制御点を無視し終点だけ採用する', () => {
    const points = extractPoints('M0 0C1 1 2 2 3 3');
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 3 },
    ]);
  });

  it('boundingBox: 頂点群の範囲を返す、空配列はnull', () => {
    expect(boundingBox([{ x: 1, y: 5 }, { x: -2, y: 3 }, { x: 4, y: 0 }])).toEqual({
      minX: -2, minY: 0, maxX: 4, maxY: 5,
    });
    expect(boundingBox([])).toBeNull();
  });

  it('selectRoadSnippet: 切り取り範囲とかすらない部分パスは除外する', () => {
    const roadPath = 'M10 10L20 20M1000 1000L1010 1010';
    const crop = { x: 0, y: 0, w: 100, h: 100 };
    const result = selectRoadSnippet(roadPath, crop);
    expect(result).toContain('M10 10L20 20');
    expect(result).not.toContain('M1000 1000L1010 1010');
  });

  it('selectRoadSnippet: 何もかすらなければ空文字', () => {
    const roadPath = 'M1000 1000L1010 1010';
    const crop = { x: 0, y: 0, w: 100, h: 100 };
    expect(selectRoadSnippet(roadPath, crop)).toBe('');
  });

  it('pickCropWindow: マップ境界内にクランプされる(左上端のノード)', () => {
    const json = { viewBox: { w: 1000, h: 800 }, nodes: [{ id: 'n', x: 0, y: 0 }] };
    const crop = pickCropWindow(json, () => 0);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.w).toBe(CROP_WIDTH);
    expect(crop.h).toBe(CROP_HEIGHT);
  });

  it('pickCropWindow: マップ境界内にクランプされる(右下端のノード)', () => {
    const json = { viewBox: { w: 1000, h: 800 }, nodes: [{ id: 'n', x: 1, y: 1 }] };
    const crop = pickCropWindow(json, () => 0.999);
    expect(crop.x + crop.w).toBeLessThanOrEqual(1000);
    expect(crop.y + crop.h).toBeLessThanOrEqual(800);
  });

  it('outlineToNativePoints: 正規化座標をviewBoxの実寸に変換する', () => {
    const points = outlineToNativePoints([[0.1, 0.2], [0.5, 0.5]], { w: 1000, h: 800 });
    expect(points).toEqual([{ x: 100, y: 160 }, { x: 500, y: 400 }]);
  });

  it('selectHouseOutlines: 切り取り範囲とかすっている家だけを抜き出す(outline無しはスキップ)', () => {
    const houses: WardMapJson['houses'] = [
      { kind: 'plot', plot: 1, x: 0.05, y: 0.05, node: null, outline: [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]] }, // crop内
      { kind: 'plot', plot: 2, x: 0.9, y: 0.9, node: null, outline: [[0.9, 0.9], [1, 0.9], [1, 1], [0.9, 1]] }, // crop外
      { kind: 'plot', plot: 3, x: 0.02, y: 0.02, node: null, outline: null }, // outline無し
    ];
    const viewBox = { w: 1000, h: 800 };
    const crop = { x: 0, y: 0, w: 200, h: 200 };
    const result = selectHouseOutlines(houses, viewBox, crop);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual({ x: 0, y: 0 });
  });

  it('pickRoadSnippet: 実データ(Mistワード)で十分な長さの道と家の区画が取れる', () => {
    const json = mistWard as unknown as WardMapJson;
    // 複数回試して安定して非空を返すことを確認(実データでの結合テスト)。
    for (let i = 0; i < 10; i++) {
      const result = pickRoadSnippet(json, Math.random);
      expect(result.d.length).toBeGreaterThan(0);
      expect(Array.isArray(result.houses)).toBe(true);
    }
  });

  it('pickRoadSnippet: 何も見つからない場合でも無限ループせず空文字を返す', () => {
    const json: WardMapJson = {
      area: 'Test',
      viewBox: { w: 1000, h: 800 },
      nodes: [{ id: 'n', x: 0.5, y: 0.5 }],
      edges: [],
      houses: [],
      roadPath: 'M1000000 1000000L1000010 1000010', // どこにもかすらない道
      visibleRoadPath: null,
    };
    const result = pickRoadSnippet(json, () => 0.5);
    expect(result.d).toBe('');
  });
});
