import { describe, it, expect, afterEach } from 'vitest';
import { isIOS } from '../isIOS';

const setUA = (ua: string) =>
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const original = navigator.userAgent;
afterEach(() => setUA(original));

describe('isIOS', () => {
    it('iPhone UA → true', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)');
        expect(isIOS()).toBe(true);
    });
    it('iPad UA → true', () => {
        setUA('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)');
        expect(isIOS()).toBe(true);
    });
    it('Windows UA → false', () => {
        setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
        expect(isIOS()).toBe(false);
    });
});
