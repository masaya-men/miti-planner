import { describe, it, expect } from 'vitest';
import {
  isValidHousingArea,
  isValidHousingSize,
  isValidImageMode,
  isValidReportReason,
  type HousingListing,
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
    it('returns true for known sizes', () => {
      expect(isValidHousingSize('S')).toBe(true);
      expect(isValidHousingSize('M')).toBe(true);
      expect(isValidHousingSize('L')).toBe(true);
      expect(isValidHousingSize('Apartment')).toBe(true);
      expect(isValidHousingSize('PrivateRoom')).toBe(true);
    });
    it('returns false for unknown sizes', () => {
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
  });

  it('HousingListing type can be constructed (compile-time check)', () => {
    const listing: HousingListing = {
      id: 'abc',
      ownerUid: 'uid1',
      dc: 'Mana',
      server: 'Pandaemonium',
      area: 'Shirogane',
      ward: 3,
      plot: 12,
      size: 'M',
      imageMode: 'none',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isHidden: false,
      reportCount: 0,
    };
    expect(listing.area).toBe('Shirogane');
  });
});
