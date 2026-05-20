import { describe, it, expect } from 'vitest';
import {
  isValidNotificationType,
  isValidSeverity,
  type HousingNotification,
} from '../../types/notification';

describe('notification types', () => {
  describe('isValidNotificationType', () => {
    it("'housing_report' を許容する", () => {
      expect(isValidNotificationType('housing_report')).toBe(true);
    });
    it('未知の値を拒否する', () => {
      expect(isValidNotificationType('unknown')).toBe(false);
    });
  });

  describe('isValidSeverity', () => {
    it("'normal' と 'high' を許容する", () => {
      expect(isValidSeverity('normal')).toBe(true);
      expect(isValidSeverity('high')).toBe(true);
    });
    it('未知の値を拒否する', () => {
      expect(isValidSeverity('critical')).toBe(false);
    });
  });

  describe('HousingNotification 型', () => {
    it('必須フィールドを持つオブジェクトを構築できる', () => {
      const n: HousingNotification = {
        id: 'nid1',
        type: 'housing_report',
        listingId: 'lid1',
        reason: 'wrong_info',
        severity: 'normal',
        createdAt: Date.now(),
        read: false,
      };
      expect(n.type).toBe('housing_report');
    });
  });
});
