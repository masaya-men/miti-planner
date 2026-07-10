import { describe, it, expect } from 'vitest';
import {
  buildPersonalTagId,
  normalizeDisplayNameForSearch,
  canCreatePersonalTag,
  evaluatePersonalTagAttach,
  computePersonalTagReportOutcome,
} from '../../data/personalTags';
import { isPersonalTagIdFormat } from '../../data/housingTags';
import { PERSONAL_TAG_LIMIT_PER_USER, PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH } from '../../constants/housing';
import { validatePersonalTagDisplayName } from '../../utils/housingValidation';
import type { PersonalTag } from '../../types/housing';

const baseTag = (overrides: Partial<PersonalTag> = {}): PersonalTag => ({
  id: 'personal_yuura_ab12cd',
  displayName: 'yuura',
  displayNameLower: 'yuura',
  ownerUid: 'owner-uid',
  createdAt: 0,
  reportCount: 0,
  isHidden: false,
  ...overrides,
});

describe('personalTags', () => {
  describe('buildPersonalTagId', () => {
    it('ASCII 名は slug + random suffix の形式になる (isPersonalTagIdFormat を満たす)', () => {
      const id = buildPersonalTagId('Yuura', () => 'ab12cd');
      expect(id).toBe('personal_yuura_ab12cd');
      expect(isPersonalTagIdFormat(id)).toBe(true);
    });

    it('非ラテン文字のみの名前 (例: 日本語) は random suffix のみになる', () => {
      const id = buildPersonalTagId('ゆうら', () => 'ab12cd');
      expect(id).toBe('personal_ab12cd');
      expect(isPersonalTagIdFormat(id)).toBe(true);
    });

    it('記号・空白混じりの名前も安全な slug になる', () => {
      const id = buildPersonalTagId('  @Yuura!! ', () => 'xy9900');
      expect(id).toBe('personal_yuura_xy9900');
      expect(isPersonalTagIdFormat(id)).toBe(true);
    });

    it('毎回 randomSuffix を呼んで一意性を確保する (同名でも id が変わりうる)', () => {
      let n = 0;
      const rnd = () => `s${n++}`;
      const id1 = buildPersonalTagId('yuura', rnd);
      const id2 = buildPersonalTagId('yuura', rnd);
      expect(id1).not.toBe(id2);
    });
  });

  describe('normalizeDisplayNameForSearch', () => {
    it('trim + 小文字化する', () => {
      expect(normalizeDisplayNameForSearch('  Yuura  ')).toBe('yuura');
    });
  });

  describe('canCreatePersonalTag (1 ユーザー 1 個の境界)', () => {
    it('既存 0 件なら作成可能', () => {
      expect(canCreatePersonalTag(0, PERSONAL_TAG_LIMIT_PER_USER)).toBe(true);
    });

    it('既存が上限に達していれば作成不可 (2 個目は拒否)', () => {
      expect(canCreatePersonalTag(PERSONAL_TAG_LIMIT_PER_USER, PERSONAL_TAG_LIMIT_PER_USER)).toBe(false);
    });

    it('既存が上限を超えていても不可 (念のため)', () => {
      expect(canCreatePersonalTag(PERSONAL_TAG_LIMIT_PER_USER + 1, PERSONAL_TAG_LIMIT_PER_USER)).toBe(false);
    });
  });

  describe('evaluatePersonalTagAttach', () => {
    it('タグが存在しなければ not_found', () => {
      const result = evaluatePersonalTagAttach(undefined, 'owner-uid');
      expect(result).toEqual({ ok: false, reason: 'not_found' });
    });

    it('isHidden なタグは付与拒否 (hidden)', () => {
      const result = evaluatePersonalTagAttach(baseTag({ isHidden: true }), 'owner-uid');
      expect(result).toEqual({ ok: false, reason: 'hidden' });
    });

    it('他人のタグは付与拒否 (not_owner)', () => {
      const result = evaluatePersonalTagAttach(baseTag(), 'someone-else-uid');
      expect(result).toEqual({ ok: false, reason: 'not_owner' });
    });

    it('自分の非表示でないタグは付与可能', () => {
      const result = evaluatePersonalTagAttach(baseTag(), 'owner-uid');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('computePersonalTagReportOutcome', () => {
    it('しきい値未満なら shouldHide=false', () => {
      expect(computePersonalTagReportOutcome(0, 3)).toEqual({ newCount: 1, shouldHide: false });
      expect(computePersonalTagReportOutcome(1, 3)).toEqual({ newCount: 2, shouldHide: false });
    });

    it('しきい値に達したら shouldHide=true', () => {
      expect(computePersonalTagReportOutcome(2, 3)).toEqual({ newCount: 3, shouldHide: true });
    });
  });

  describe('validatePersonalTagDisplayName', () => {
    it('通常の表示名は ok', () => {
      expect(validatePersonalTagDisplayName('yuura').ok).toBe(true);
    });

    it('空文字は required エラー', () => {
      const result = validatePersonalTagDisplayName('');
      expect(result.ok).toBe(false);
      expect(result.errors.displayName).toBe('required');
    });

    it('空白のみは required エラー (trim 後で判定)', () => {
      const result = validatePersonalTagDisplayName('   ');
      expect(result.ok).toBe(false);
      expect(result.errors.displayName).toBe('required');
    });

    it(`${PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH} 文字を超えると too_long エラー`, () => {
      const tooLong = 'a'.repeat(PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH + 1);
      const result = validatePersonalTagDisplayName(tooLong);
      expect(result.ok).toBe(false);
      expect(result.errors.displayName).toBe('too_long');
    });

    it(`${PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH} 文字ちょうどは ok`, () => {
      const exact = 'a'.repeat(PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH);
      expect(validatePersonalTagDisplayName(exact).ok).toBe(true);
    });

    it('文字列以外は invalid_type エラー', () => {
      const result = validatePersonalTagDisplayName(123 as unknown as string);
      expect(result.ok).toBe(false);
      expect(result.errors.displayName).toBe('invalid_type');
    });
  });
});
