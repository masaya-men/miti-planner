import { describe, expect, it } from 'vitest';
import { formatTimeKeepFraction } from '../timeFormat';
import { formatTime } from '../templateConversions';

describe('formatTimeKeepFraction', () => {
    it('整数秒と負数', () => {
        expect(formatTimeKeepFraction(65)).toBe('1:05');
        expect(formatTimeKeepFraction(-65)).toBe('-1:05');
        expect(formatTimeKeepFraction(0)).toBe('0:00');
    });
    it('小数は切り捨てない(templateConversions.formatTime は切り捨てる)', () => {
        expect(formatTimeKeepFraction(5.5)).toBe('0:5.5');
        expect(formatTime(5.5)).toBe('0:05');
    });
});
