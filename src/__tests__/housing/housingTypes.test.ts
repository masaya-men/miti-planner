import { describe, it, expect } from 'vitest';
import {
  isValidHousingArea,
  isValidHousingSize,
  isValidImageMode,
  isValidReportReason,
  isValidFeatureTool,
  type HousingListing,
  type HousingReport,
  type HousingTour,
  type HousingFavorite,
  type HousingUserMeta,
  type FeatureSession,
} from '../../types/housing';

describe('housingTypes', () => {
  describe('isValidHousingArea', () => {
    it('returns true for known areas', () => {
      expect(isValidHousingArea('Mist')).toBe(true);
      expect(isValidHousingArea('LavenderBeds')).toBe(true);
      expect(isValidHousingArea('Goblet')).toBe(true);
      expect(isValidHousingArea('Shirogane')).toBe(true);
      expect(isValidHousingArea('Empyreum')).toBe(true);
    });
    it('returns false for unknown areas', () => {
      expect(isValidHousingArea('Atlantis')).toBe(false);
      expect(isValidHousingArea('')).toBe(false);
    });
  });

  describe('isValidHousingSize', () => {
    it('returns true for known sizes (S/M/L のみ)', () => {
      expect(isValidHousingSize('S')).toBe(true);
      expect(isValidHousingSize('M')).toBe(true);
      expect(isValidHousingSize('L')).toBe(true);
    });
    it('returns false for removed/unknown sizes', () => {
      // Apartment / PrivateRoom は新 schema で HousingSize から除外済み (Sub-spec 2B 対応予定)
      expect(isValidHousingSize('Apartment')).toBe(false);
      expect(isValidHousingSize('PrivateRoom')).toBe(false);
      expect(isValidHousingSize('XL')).toBe(false);
    });
  });

  describe('isValidImageMode', () => {
    it('returns true for sns / thumbnail / none', () => {
      expect(isValidImageMode('sns')).toBe(true);
      expect(isValidImageMode('thumbnail')).toBe(true);
      expect(isValidImageMode('none')).toBe(true);
    });
    it('returns false for others', () => {
      expect(isValidImageMode('image')).toBe(false);
    });
  });

  describe('isValidReportReason', () => {
    it('returns true for known reasons', () => {
      expect(isValidReportReason('wrong_info')).toBe(true);
      expect(isValidReportReason('griefing')).toBe(true);
      expect(isValidReportReason('nsfw')).toBe(true);
      expect(isValidReportReason('sold')).toBe(true);
      expect(isValidReportReason('other')).toBe(true);
    });
    it('returns false for unknown reasons', () => {
      expect(isValidReportReason('spam')).toBe(false);
    });
  });

  describe('isValidFeatureTool', () => {
    it('returns true for miti and housing', () => {
      expect(isValidFeatureTool('miti')).toBe(true);
      expect(isValidFeatureTool('housing')).toBe(true);
    });
    it('returns false for unknown tools', () => {
      expect(isValidFeatureTool('admin')).toBe(false);
    });
  });

  it('HousingListing type can be constructed (compile-time check)', () => {
    const listing: HousingListing = {
      id: 'abc',
      ownerUid: 'uid1',
      dc: 'Mana',
      server: 'Pandaemonium',
      area: 'Shirogane',
      ward: 3,
      buildingType: 'house',
      plot: 12,
      size: 'M',
      addressKey: 'Mana|Pandaemonium|Shirogane|W3|H12',
      imageMode: 'none',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isHidden: false,
      reportCount: 0,
      deletedAt: null,
    };
    expect(listing.area).toBe('Shirogane');
  });

  describe('HousingListing.addressKey', () => {
    it('listing 型は addressKey フィールドを持つ', () => {
      const listing: HousingListing = {
        id: 'abc', ownerUid: 'u1',
        dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
        ward: 3, buildingType: 'house',
        plot: 12, size: 'M',
        addressKey: 'Mana|Pandaemonium|Shirogane|W3|H12',
        imageMode: 'none',
        tags: ['modern'],
        createdAt: 0, updatedAt: 0,
        isHidden: false, reportCount: 0,
        deletedAt: null,
      };
      expect(listing.addressKey).toBeDefined();
    });
  });

  it('HousingReport type can be constructed (compile-time check)', () => {
    const report: HousingReport = {
      reporterUid: 'uid2',
      reason: 'wrong_info',
      comment: '情報が古い',
      createdAt: Date.now(),
    };
    expect(report.reason).toBe('wrong_info');
  });

  it('HousingTour type can be constructed (compile-time check)', () => {
    const tour: HousingTour = {
      id: 'tour1',
      ownerUid: 'uid3',
      title: 'おすすめツアー',
      listingIds: ['a', 'b'],
      isPublic: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(tour.listingIds).toEqual(['a', 'b']);
  });

  it('HousingFavorite type can be constructed (compile-time check)', () => {
    const favorite: HousingFavorite = {
      listingId: 'listing1',
      addedAt: Date.now(),
    };
    expect(favorite.listingId).toBe('listing1');
  });

  it('HousingUserMeta type can be constructed (compile-time check)', () => {
    const meta: HousingUserMeta = {
      registrationCount: 3,
      dailyQuota: {
        remaining: 5,
        lastReset: Date.now(),
      },
    };
    expect(meta.dailyQuota.remaining).toBe(5);
  });

  it('FeatureSession type can be constructed (compile-time check)', () => {
    const session: FeatureSession = {
      activated: true,
      activatedAt: Date.now(),
    };
    expect(session.activated).toBe(true);
  });

  describe('HousingListing.deletedAt', () => {
    it('null と number の両方を許容する', () => {
      const alive: HousingListing['deletedAt'] = null;
      const deleted: HousingListing['deletedAt'] = Date.now();
      expect(alive).toBeNull();
      expect(typeof deleted).toBe('number');
    });
  });
});
