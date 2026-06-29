import { describe, it, expect } from 'vitest';
import {
  splitStrategyCode,
  normalizeStrategyCode,
  DEFAULT_CHUNK_SIZE,
} from '../strategyCode';

describe('normalizeStrategyCode', () => {
  it('全空白文字を除去する', () => {
    expect(normalizeStrategyCode(' a\nb\tc ')).toBe('abc');
  });
});

describe('splitStrategyCode', () => {
  it('空入力は空配列', () => {
    expect(splitStrategyCode('', 170)).toEqual([]);
    expect(splitStrategyCode('  \n\t ', 170)).toEqual([]);
  });

  it('空白・改行を除去してから分割する', () => {
    expect(splitStrategyCode('abc\n def\tghi', 3)).toEqual(['abc', 'def', 'ghi']);
  });

  it('割り切れる長さ', () => {
    expect(splitStrategyCode('abcdef', 3)).toEqual(['abc', 'def']);
  });

  it('余りが出る長さ', () => {
    expect(splitStrategyCode('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('連結すると正規化後文字列に一致する（ラウンドトリップ不変条件）', () => {
    const raw = '[stgy:' + 'A'.repeat(600) + '+-_=]';
    const chunks = splitStrategyCode(raw, DEFAULT_CHUNK_SIZE);
    expect(chunks.join('')).toBe(normalizeStrategyCode(raw));
  });

  it('境界 80/170/180 で断片数が正しい', () => {
    const s = 'x'.repeat(360);
    expect(splitStrategyCode(s, 180).length).toBe(2); // 180,180
    expect(splitStrategyCode(s, 170).length).toBe(3); // 170,170,20
    expect(splitStrategyCode(s, 80).length).toBe(5);  // 80*4,40
  });
});
