// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { getLastOpenedMap, setLastOpened, getStalePlanIds, LAST_OPENED_KEY } from '../lastOpenedStore';

beforeEach(() => {
    localStorage.clear();
});

describe('lastOpenedStore', () => {
    it('初期状態は空オブジェクトを返す', () => {
        expect(getLastOpenedMap()).toEqual({});
    });

    it('setLastOpened で記録し getLastOpenedMap で取得できる', () => {
        const now = Date.now();
        setLastOpened('plan_1', now);
        const map = getLastOpenedMap();
        expect(map['plan_1']).toBe(now);
    });

    it('複数プランを記録できる', () => {
        setLastOpened('plan_1', 1000);
        setLastOpened('plan_2', 2000);
        const map = getLastOpenedMap();
        expect(map['plan_1']).toBe(1000);
        expect(map['plan_2']).toBe(2000);
    });

    it('同じプランを上書き更新できる', () => {
        setLastOpened('plan_1', 1000);
        setLastOpened('plan_1', 9999);
        expect(getLastOpenedMap()['plan_1']).toBe(9999);
    });

    it('getStalePlanIds: 期限超過のプランIDを返す', () => {
        const now = Date.now();
        const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
        const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
        setLastOpened('old_plan', eightDaysAgo);
        setLastOpened('recent_plan', threeDaysAgo);

        const allIds = ['old_plan', 'recent_plan'];
        const stale = getStalePlanIds(allIds, 7);
        expect(stale).toContain('old_plan');
        expect(stale).not.toContain('recent_plan');
    });

    it('getStalePlanIds: 記録がないプランは期限超過とみなす', () => {
        const stale = getStalePlanIds(['unknown_plan'], 7);
        expect(stale).toContain('unknown_plan');
    });

    it('localStorage破損時は空オブジェクトを返す', () => {
        localStorage.setItem(LAST_OPENED_KEY, 'invalid json');
        expect(getLastOpenedMap()).toEqual({});
    });
});
