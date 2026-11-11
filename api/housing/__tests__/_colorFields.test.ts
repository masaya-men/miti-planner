import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => '__DELETE__' } }));

import { colorInvalidation, validatedColorFields, registrationColorFields } from '../_colorFields.js';
import { PALETTE_RULE } from '../../../src/lib/housing/color/housingExtractPalette.js';

const good = { colorFamilies: ['blue'], colorRule: PALETTE_RULE };

describe('_colorFields', () => {
  it('colorInvalidation は2欄とも消す印', () => {
    expect(colorInvalidation()).toEqual({ colorFamilies: '__DELETE__', colorRule: '__DELETE__' });
  });
  it('validatedColorFields は正しい値だけ通す', () => {
    expect(validatedColorFields(good)).toEqual(good);
    expect(validatedColorFields({ colorFamilies: ['nope'], colorRule: PALETTE_RULE })).toBeNull();
    expect(validatedColorFields(undefined)).toBeNull();
  });
  it('registrationColorFields: sns の登録だけ同梱の色を保存(thumbnail は画像送信時に付く)', () => {
    expect(registrationColorFields(good, { imageMode: 'sns' })).toEqual(good);
    expect(registrationColorFields(good, { imageMode: 'thumbnail' })).toEqual({});
    expect(registrationColorFields(good, { imageMode: 'none' })).toEqual({});
    expect(registrationColorFields({ colorFamilies: ['x'], colorRule: PALETTE_RULE }, { imageMode: 'sns' })).toEqual({});
  });
});
