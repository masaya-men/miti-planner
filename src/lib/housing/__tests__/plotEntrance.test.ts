import { describe, it, expect, vi } from 'vitest';

// wardEntrances.generated.json をテスト用にモック(実データは空のため)
vi.mock('../../../data/housing/wardEntrances.generated.json', () => ({
  default: { mist: { '6': [0.42, 0.58], apart: [0.5, 0.6] }, 'goblet-sub': { '3': [0.31, 0.44] } },
}));

import { getPlotEntrance } from '../plotEntrance';

describe('getPlotEntrance', () => {
  it('収録済みの区画はその点(0..1)を返す', () => {
    expect(getPlotEntrance('Mist', 6, 'house', null)).toEqual([0.42, 0.58]);
  });

  it('拡張街(plot 33 = sub の SVG plot 3)は -30 読み替えで解決', () => {
    expect(getPlotEntrance('Goblet', 33, 'house', null)).toEqual([0.31, 0.44]);
  });

  it('アパートは apart キーを引く', () => {
    expect(getPlotEntrance('Mist', null, 'apartment', 1)).toEqual([0.5, 0.6]);
  });

  it('未収録の区画は null', () => {
    expect(getPlotEntrance('Mist', 12, 'house', null)).toBeNull();
  });

  it('未知エリアは null', () => {
    expect(getPlotEntrance('Unknown', 1, 'house', null)).toBeNull();
  });
});
