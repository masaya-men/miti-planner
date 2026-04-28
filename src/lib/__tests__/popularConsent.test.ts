import { describe, it, expect, beforeEach } from 'vitest';
import { hasPopularConsent, setPopularConsent, CONSENT_KEY } from '../popularConsent';

describe('popularConsent', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('初期状態は同意なし', () => {
        expect(hasPopularConsent()).toBe(false);
    });

    it('setPopularConsent() 呼び出しで true を返すようになる', () => {
        setPopularConsent();
        expect(hasPopularConsent()).toBe(true);
    });

    it('CONSENT_KEY に 1 が永続化される', () => {
        setPopularConsent();
        expect(localStorage.getItem(CONSENT_KEY)).toBe('1');
    });

    it('localStorage が利用不可でも例外を投げない', () => {
        // jsdom 環境なら Storage.prototype.setItem、node + ポリフィル環境なら
        // localStorage.setItem を直接差し替える。どちらでも setItem が
        // throw する状況を再現できる。
        const usePrototype = typeof Storage !== 'undefined';
        const target: any = usePrototype ? Storage.prototype : localStorage;
        const orig = target.setItem;
        target.setItem = () => { throw new Error('quota'); };
        try {
            expect(() => setPopularConsent()).not.toThrow();
        } finally {
            target.setItem = orig;
        }
    });
});
