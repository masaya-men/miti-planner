import { afterEach, describe, expect, it, vi } from 'vitest';
import { genId } from '../genId';

describe('genId', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('randomUUID があれば UUID を返す(接頭辞は付かない)', () => {
        vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
        expect(genId('ast_')).toBe('uuid-1');
    });

    it('無ければ既定は id_ + 7 桁以内の乱数', () => {
        vi.stubGlobal('crypto', undefined);
        expect(genId()).toMatch(/^id_[0-9a-z]{1,7}$/);
    });

    it('接頭辞を指定できる', () => {
        vi.stubGlobal('crypto', undefined);
        expect(genId('evt_')).toMatch(/^evt_[0-9a-z]{1,7}$/);
        expect(genId('ast_')).toMatch(/^ast_[0-9a-z]{1,7}$/);
    });

    it('withTimestamp は ffl_ 形式(乱数 9 桁以内 + 時刻)', () => {
        vi.stubGlobal('crypto', undefined);
        expect(genId('ffl_', true)).toMatch(/^ffl_[0-9a-z]+$/);
    });
});
