import { describe, it, expect } from 'vitest';
import {
  countUniqueReporters,
  computeListingReportOutcome,
} from '../../lib/housing/reportOutcome';

describe('countUniqueReporters', () => {
  it('同一ユーザーの複数 report (旧仕様の reason 違い) は 1 人と数える', () => {
    expect(countUniqueReporters(['u1', 'u1', 'u1', 'u1'], 'u1')).toBe(1);
  });
  it('今回の通報者を含めて distinct で数える', () => {
    expect(countUniqueReporters(['u1', 'u2'], 'u3')).toBe(3);
    expect(countUniqueReporters(['u1', 'u2'], 'u2')).toBe(2);
  });
  it('undefined / 空文字は無視する', () => {
    expect(countUniqueReporters([undefined, '', 'u1'], 'u2')).toBe(2);
  });
});

describe('computeListingReportOutcome', () => {
  it('1 ユーザーが何度通報しても hide しない (閾値 3)', () => {
    const r = computeListingReportOutcome(['u1', 'u1', 'u1', 'u1'], 'u1', 3, false);
    expect(r.newCount).toBe(1);
    expect(r.shouldHide).toBe(false);
  });
  it('相異なる 3 人目で hide (閾値 3)、2 人ではまだ', () => {
    expect(computeListingReportOutcome(['u1', 'u2'], 'u3', 3, false).shouldHide).toBe(true);
    expect(computeListingReportOutcome(['u1'], 'u2', 3, false).shouldHide).toBe(false);
  });
  it('閾値 1 (§3.8 同住所重複の wrong_info) は 1 人目で hide', () => {
    expect(computeListingReportOutcome([], 'u1', 1, false).shouldHide).toBe(true);
  });
  it('既に hidden なら shouldHide は false', () => {
    expect(computeListingReportOutcome(['u1', 'u2'], 'u3', 3, true).shouldHide).toBe(false);
  });
});
