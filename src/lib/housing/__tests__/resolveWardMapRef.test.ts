import { describe, it, expect } from 'vitest';
import { resolveWardMapRef } from '../resolveWardMapRef';

describe('resolveWardMapRef', () => {
  it('本街の家 (plot 1-30) は main マップ・そのままの plot', () => {
    expect(resolveWardMapRef('Mist', 15, null, 'house'))
      .toEqual({ mapKey: 'mist', highlightPlot: 15, highlightKind: 'plot' });
  });
  it('拡張街の家 (plot 31-60) は sub マップ・plot-30 に読み替え', () => {
    expect(resolveWardMapRef('Goblet', 45, null, 'house'))
      .toEqual({ mapKey: 'goblet-sub', highlightPlot: 15, highlightKind: 'plot' });
  });
  it('アパート本街 (building 1) は main の apart', () => {
    expect(resolveWardMapRef('Shirogane', null, 1, 'apartment'))
      .toEqual({ mapKey: 'shirogane', highlightPlot: 1, highlightKind: 'apart' });
  });
  it('アパート拡張街 (building 2) は sub の apart', () => {
    expect(resolveWardMapRef('Empyreum', null, 2, 'apartment'))
      .toEqual({ mapKey: 'empyreum-sub', highlightPlot: 1, highlightKind: 'apart' });
  });
  it('エリア不明は null', () => {
    expect(resolveWardMapRef('Unknown', 1, null, 'house')).toBeNull();
  });
  it('plot 未確定は null', () => {
    expect(resolveWardMapRef('Mist', null, null, 'house')).toBeNull();
  });
});
