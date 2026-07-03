import { describe, it, expect } from 'vitest';
import { normalizePublishUntil } from '../housingValidation';

/**
 * 公開終了日時 (publishUntil) の保存前正規化。
 *
 * 実機バグ (2026-07-03): 過去日時を「不正値」として null (=無期限公開) に倒すと、
 * 「6/30 までの公開」のつもりが誰でも見える恒久公開になる (fail-open)。
 * 正しくは過去日時もそのまま保存し、遅延評価 (isEffectivelyPublic / rules) で
 * 即・期限切れ扱いにする (fail-closed)。
 */
describe('normalizePublishUntil', () => {
  const NOW = 1_800_000_000_000;

  it('未来の日時はそのまま保存する', () => {
    expect(normalizePublishUntil(NOW + 60_000)).toBe(NOW + 60_000);
  });

  it('過去の日時も null に倒さずそのまま保存する (即・期限切れ=非公開扱い)', () => {
    expect(normalizePublishUntil(NOW - 60_000)).toBe(NOW - 60_000);
  });

  it('null / undefined は null (期限なし)', () => {
    expect(normalizePublishUntil(null)).toBeNull();
    expect(normalizePublishUntil(undefined)).toBeNull();
  });

  it('number 以外・非有限値は null に落とす (型ガード)', () => {
    expect(normalizePublishUntil('2026-06-30' as unknown)).toBeNull();
    expect(normalizePublishUntil(Number.NaN)).toBeNull();
    expect(normalizePublishUntil(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizePublishUntil({} as unknown)).toBeNull();
  });

  it('0 以下の epoch は null に落とす (1970 以前はデータ不正とみなす)', () => {
    expect(normalizePublishUntil(0)).toBeNull();
    expect(normalizePublishUntil(-1)).toBeNull();
  });
});
