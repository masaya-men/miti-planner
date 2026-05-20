// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
import { hashUid } from '../../api/_lib/hashUid';

describe('hashUid', () => {
    const TEST_SECRET = 'a'.repeat(64); // 64 文字の固定 secret (テスト用)
    const TEST_DISCORD_ID = '000000000000000000';

    it('returns hashed: prefix + 64-char lowercase hex', () => {
        const result = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        expect(result).toMatch(/^hashed:[0-9a-f]{64}$/);
    });

    it('is deterministic (same input → same output)', () => {
        const r1 = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        const r2 = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        expect(r1).toBe(r2);
    });

    it('produces different output for different discord IDs', () => {
        const r1 = hashUid('111111111111111111', TEST_SECRET);
        const r2 = hashUid('222222222222222222', TEST_SECRET);
        expect(r1).not.toBe(r2);
    });

    it('produces different output for different secrets', () => {
        const r1 = hashUid(TEST_DISCORD_ID, 'a'.repeat(64));
        const r2 = hashUid(TEST_DISCORD_ID, 'b'.repeat(64));
        expect(r1).not.toBe(r2);
    });

    it('throws when secret is empty', () => {
        expect(() => hashUid(TEST_DISCORD_ID, '')).toThrow(/LOPO_PSEUDONYM_SECRET/);
    });

    it('throws when secret is too short (< 32 chars)', () => {
        expect(() => hashUid(TEST_DISCORD_ID, 'a'.repeat(31))).toThrow(/32/);
    });

    it('accepts minimum 32-char secret', () => {
        const result = hashUid(TEST_DISCORD_ID, 'a'.repeat(32));
        expect(result).toMatch(/^hashed:[0-9a-f]{64}$/);
    });

    it('produces expected HMAC-SHA256 value (golden value test, locks algorithm)', () => {
        // 既知の固定期待値で HMAC-SHA256 アルゴリズム自体が変わっていないことを検証する。
        // 期待値は事前計算済:
        //   node -e "const c=require('crypto'); console.log('hashed:'+c.createHmac('sha256','a'.repeat(64)).update('000000000000000000').digest('hex'))"
        const expected = 'hashed:d0c345b7234aff6e58741d6c703d3cb413d665c55ae535fb99c08efaeb4ec5ed';
        expect(hashUid('000000000000000000', 'a'.repeat(64))).toBe(expected);
    });
});
