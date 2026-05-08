import { describe, it, expect } from 'vitest';
import {
  validateAddress,
  validateTags,
  validateDescription,
  validateRegistrationDraft,
  type RegistrationDraft,
} from '../../utils/housingValidation';

describe('validateAddress', () => {
  const base = { dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane' as const, ward: 3, plot: 12, size: 'M' as const };

  it('全フィールド OK ならエラーなし', () => {
    expect(validateAddress(base).ok).toBe(true);
  });
  it('ward が範囲外 (31)', () => {
    const r = validateAddress({ ...base, ward: 31 });
    expect(r.ok).toBe(false);
    expect(r.errors.ward).toBeDefined();
  });
  it('plot が 0', () => {
    const r = validateAddress({ ...base, plot: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });
  it('Apartment で apartmentRoom 未指定はエラー', () => {
    const r = validateAddress({ ...base, size: 'Apartment' });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentRoom).toBeDefined();
  });
  it('Apartment で apartmentRoom 指定済みは OK', () => {
    expect(validateAddress({ ...base, size: 'Apartment', apartmentRoom: 45 }).ok).toBe(true);
  });
  it('size が M で apartmentRoom 指定はエラー', () => {
    const r = validateAddress({ ...base, apartmentRoom: 45 });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentRoom).toBeDefined();
  });
  it('未知のエリアはエラー', () => {
    const r = validateAddress({ ...base, area: 'Atlantis' as never });
    expect(r.ok).toBe(false);
    expect(r.errors.area).toBeDefined();
  });
  it('dc / server / area 空文字はエラー', () => {
    const r = validateAddress({ ...base, dc: '', server: '', area: '' as never });
    expect(r.ok).toBe(false);
    expect(r.errors.dc).toBeDefined();
    expect(r.errors.server).toBeDefined();
    expect(r.errors.area).toBeDefined();
  });
});

describe('validateTags', () => {
  it('1〜5 件の正規 id', () => {
    expect(validateTags(['modern', 'cafe']).ok).toBe(true);
  });
  it('0 件はエラー', () => {
    expect(validateTags([]).ok).toBe(false);
  });
  it('6 件はエラー', () => {
    expect(validateTags(['modern', 'cafe', 'wafu', 'spring', 'summer', 'winter']).ok).toBe(false);
  });
  it('未知 id を含むとエラー', () => {
    expect(validateTags(['modern', 'not-a-tag']).ok).toBe(false);
  });
  it('重複 id はエラー', () => {
    expect(validateTags(['modern', 'modern']).ok).toBe(false);
  });
});

describe('validateDescription', () => {
  it('undefined / 空文字は OK', () => {
    expect(validateDescription(undefined).ok).toBe(true);
    expect(validateDescription('').ok).toBe(true);
  });
  it('200 文字以下は OK', () => {
    expect(validateDescription('あ'.repeat(200)).ok).toBe(true);
  });
  it('201 文字はエラー', () => {
    expect(validateDescription('あ'.repeat(201)).ok).toBe(false);
  });
});

describe('validateRegistrationDraft', () => {
  it('全 OK', () => {
    const draft: RegistrationDraft = {
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
      tags: ['modern', 'cafe'], description: 'よろしく',
    };
    expect(validateRegistrationDraft(draft).ok).toBe(true);
  });
  it('複数フィールドエラーが集約', () => {
    const draft: RegistrationDraft = {
      dc: '', server: '', area: '' as never,
      ward: 0, plot: 0, size: 'M',
      tags: [], description: 'あ'.repeat(201),
    };
    const r = validateRegistrationDraft(draft);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(5);
  });
});
