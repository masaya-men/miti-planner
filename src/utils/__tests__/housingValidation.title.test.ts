import { describe, it, expect } from 'vitest';
import { validateTitle } from '../housingValidation';

describe('validateTitle', () => {
  it('undefined は ok (サーバー寛容・旧経路が title を送らないため)', () => {
    expect(validateTitle(undefined)).toEqual({ ok: true, errors: {} });
  });
  it('空文字/空白のみは required エラー', () => {
    expect(validateTitle('').ok).toBe(false);
    expect(validateTitle('   ').errors.title).toBe('required');
  });
  it('50字ちょうどは ok', () => {
    expect(validateTitle('あ'.repeat(50)).ok).toBe(true);
  });
  it('51字は too_long エラー', () => {
    expect(validateTitle('あ'.repeat(51)).errors.title).toBe('too_long');
  });
});
