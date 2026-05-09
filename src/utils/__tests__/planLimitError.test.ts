import { describe, it, expect } from 'vitest';
import { parsePlanLimitError } from '../planLimitError';

describe('parsePlanLimitError', () => {
    it('max_total エラーメッセージから reason / current / max を抽出する', () => {
        const result = parsePlanLimitError('PLAN_LIMIT_max_total|current=50|max=50');
        expect(result).toEqual({ reason: 'max_total', current: 50, max: 50 });
    });

    it('max_per_content エラーメッセージから reason / current / max を抽出する', () => {
        const result = parsePlanLimitError('PLAN_LIMIT_max_per_content|current=5|max=5');
        expect(result).toEqual({ reason: 'max_per_content', current: 5, max: 5 });
    });

    it('current/max が両端で異なる値でも正しく抽出する', () => {
        const result = parsePlanLimitError('PLAN_LIMIT_max_total|current=49|max=50');
        expect(result).toEqual({ reason: 'max_total', current: 49, max: 50 });
    });

    it('PLAN_LIMIT 以外の文字列は null を返す', () => {
        expect(parsePlanLimitError('permission-denied')).toBeNull();
        expect(parsePlanLimitError('FirebaseError: Missing or insufficient permissions.')).toBeNull();
        expect(parsePlanLimitError('NO_DATA')).toBeNull();
        expect(parsePlanLimitError('unavailable')).toBeNull();
    });

    it('undefined / null / 空文字 は null を返す', () => {
        expect(parsePlanLimitError(undefined)).toBeNull();
        expect(parsePlanLimitError(null)).toBeNull();
        expect(parsePlanLimitError('')).toBeNull();
    });

    it('PLAN_LIMIT プレフィックスでも形式不正なら null を返す', () => {
        expect(parsePlanLimitError('PLAN_LIMIT_unknown|current=1|max=2')).toBeNull();
        expect(parsePlanLimitError('PLAN_LIMIT_max_total')).toBeNull();
        expect(parsePlanLimitError('PLAN_LIMIT_max_total|current=abc|max=10')).toBeNull();
    });

    it('後ろに余分な文字列があっても reason / current / max を抽出する', () => {
        // 将来的にエラーメッセージ末尾に追加情報が付く可能性に備える
        const result = parsePlanLimitError('PLAN_LIMIT_max_per_content|current=5|max=5|contentId=fru');
        expect(result).toEqual({ reason: 'max_per_content', current: 5, max: 5 });
    });
});
