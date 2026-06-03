import { describe, it, expect, vi } from 'vitest';
import { fetchTokenWithFailover } from '../fflogsTokenFailover';
import type { FFLogsCredentialPair } from '../fflogsTokenFailover';

const PAIRS: FFLogsCredentialPair[] = [
    { clientId: 'A', clientSecret: 'sA' },
    { clientId: 'B', clientSecret: 'sB' },
    { clientId: 'C', clientSecret: 'sC' },
];

/** clientId が badIds に含まれるキーは 401、それ以外は 200 を返す擬似 fetch。 */
function makeFetch(badIds: Set<string>) {
    const tried: string[] = [];
    const fn = async (_url: string, init: any) => {
        const id = new URLSearchParams(String(init.body)).get('client_id') as string;
        tried.push(id);
        if (badIds.has(id)) {
            return { ok: false, status: 401, json: async () => ({}), text: async () => 'unauthorized' };
        }
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok-' + id, expires_in: 3600 }), text: async () => '' };
    };
    return { fn, tried };
}

describe('fetchTokenWithFailover', () => {
    it('先頭キーが正常ならそれを使う', async () => {
        const { fn, tried } = makeFetch(new Set());
        const r = await fetchTokenWithFailover(PAIRS, 0, fn as any);
        expect(r?.usedIndex).toBe(0);
        expect(r?.token.access_token).toBe('tok-A');
        expect(tried).toEqual(['A']);
    });

    it('先頭キーが失効していたら次の正常キーへフェイルオーバー', async () => {
        const onFail = vi.fn();
        const { fn, tried } = makeFetch(new Set(['A']));
        const r = await fetchTokenWithFailover(PAIRS, 0, fn as any, onFail);
        expect(r?.usedIndex).toBe(1);
        expect(r?.token.access_token).toBe('tok-B');
        expect(tried).toEqual(['A', 'B']);
        expect(onFail).toHaveBeenCalledTimes(1);
        expect(onFail).toHaveBeenCalledWith(0, 401, 'unauthorized');
    });

    it('全キー失効なら null を返し、各キーの失敗を通知', async () => {
        const onFail = vi.fn();
        const { fn, tried } = makeFetch(new Set(['A', 'B', 'C']));
        const r = await fetchTokenWithFailover(PAIRS, 0, fn as any, onFail);
        expect(r).toBeNull();
        expect(tried).toEqual(['A', 'B', 'C']);
        expect(onFail).toHaveBeenCalledTimes(3);
    });

    it('startIndex から開始する (負荷分散)', async () => {
        const { fn, tried } = makeFetch(new Set());
        const r = await fetchTokenWithFailover(PAIRS, 1, fn as any);
        expect(r?.usedIndex).toBe(1);
        expect(tried).toEqual(['B']);
    });

    it('fetch が例外を投げても次のキーへフェイルオーバー', async () => {
        const onFail = vi.fn();
        const tried: string[] = [];
        const fn = async (_url: string, init: any) => {
            const id = new URLSearchParams(String(init.body)).get('client_id') as string;
            tried.push(id);
            if (id === 'A') throw new Error('network down');
            return { ok: true, status: 200, json: async () => ({ access_token: 'tok-' + id, expires_in: 3600 }), text: async () => '' };
        };
        const r = await fetchTokenWithFailover(PAIRS, 0, fn as any, onFail);
        expect(r?.usedIndex).toBe(1);
        expect(tried).toEqual(['A', 'B']);
        expect(onFail).toHaveBeenCalledWith(0, null, 'network down');
    });
});
