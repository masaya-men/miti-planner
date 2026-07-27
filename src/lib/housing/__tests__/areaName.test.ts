import { describe, it, expect } from 'vitest';
import { toMasterLang } from '../areaName';

describe('toMasterLang', () => {
  it('zh-Hant を zh(簡体字)と区別する', () => {
    expect(toMasterLang('zh-Hant')).toBe('zh-Hant');
    expect(toMasterLang('zh-CN')).toBe('zh'); // 既存挙動: 変えない
  });
});
