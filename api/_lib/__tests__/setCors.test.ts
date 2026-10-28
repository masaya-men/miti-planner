import { describe, it, expect } from 'vitest';
import { setCors } from '../setCors.js';

function run(origin: string | undefined, opts?: Parameters<typeof setCors>[2]) {
  const h: Record<string, string> = {};
  setCors({ headers: origin === undefined ? {} : { origin } }, { setHeader: (k, v) => { h[k] = v; } }, opts);
  return h;
}

const STD_HEADERS = 'Content-Type, Authorization, X-Firebase-AppCheck';

describe('setCors', () => {
  it('既定: POST, OPTIONS と標準ヘッダー', () => {
    const h = run('https://lopoly.app');
    expect(h).toEqual({
      'Access-Control-Allow-Origin': 'https://lopoly.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': STD_HEADERS,
    });
  });
  it('許可リスト外・origin なしは lopoly.app を返す', () => {
    expect(run('https://evil.example')['Access-Control-Allow-Origin']).toBe('https://lopoly.app');
    expect(run(undefined)['Access-Control-Allow-Origin']).toBe('https://lopoly.app');
  });
  it('localhost は許可', () => {
    expect(run('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });
  it('既定: 任意の *.vercel.app を許可', () => {
    expect(run('https://foo.vercel.app')['Access-Control-Allow-Origin']).toBe('https://foo.vercel.app');
  });
  it("preview 'lopo-miti': lopo-miti 系だけ許可(管理系)", () => {
    const o = { preview: 'lopo-miti' } as const;
    expect(run('https://foo.vercel.app', o)['Access-Control-Allow-Origin']).toBe('https://lopoly.app');
    expect(run('https://lopo-miti-abc123.vercel.app', o)['Access-Control-Allow-Origin']).toBe('https://lopo-miti-abc123.vercel.app');
  });
  it('methods / headers を上書きできる', () => {
    const h = run('https://lopoly.app', { methods: 'GET, OPTIONS', headers: 'Content-Type, X-Firebase-AppCheck' });
    expect(h['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toBe('Content-Type, X-Firebase-AppCheck');
  });
});
