// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
import { parseFlags, assertPrefixSafe } from '../../scripts/hash-migrate-users';

describe('parseFlags', () => {
    it('returns defaults when no args', () => {
        expect(parseFlags([])).toEqual({
            mode: 'dry-run',
            backup: false,
            execute: false,
            confirm: false,
            rollback: false,
            only: undefined,
            uid: undefined,
        });
    });

    it('detects --backup', () => {
        expect(parseFlags(['--backup']).backup).toBe(true);
    });

    it('detects --execute --confirm', () => {
        const r = parseFlags(['--execute', '--confirm']);
        expect(r.execute).toBe(true);
        expect(r.confirm).toBe(true);
    });

    it('detects --only=<uid>', () => {
        expect(parseFlags(['--only=discord:123']).only).toBe('discord:123');
    });

    it('detects --rollback --uid=<uid>', () => {
        const r = parseFlags(['--rollback', '--uid=discord:123', '--confirm']);
        expect(r.rollback).toBe(true);
        expect(r.uid).toBe('discord:123');
    });
});

describe('assertPrefixSafe', () => {
    it('passes for all-discord uids', () => {
        expect(() => assertPrefixSafe(['discord:1', 'discord:2'])).not.toThrow();
    });

    it('throws if hashed: prefix found (already migrated)', () => {
        expect(() => assertPrefixSafe(['discord:1', 'hashed:abc'])).toThrow(/hashed:/);
    });

    it('throws if twitter: prefix found', () => {
        expect(() => assertPrefixSafe(['twitter:1'])).toThrow(/twitter:/);
    });

    it('throws if google: prefix found', () => {
        expect(() => assertPrefixSafe(['google:1'])).toThrow(/google:/);
    });

    it('throws if list is empty', () => {
        expect(() => assertPrefixSafe([])).toThrow(/empty/i);
    });
});
