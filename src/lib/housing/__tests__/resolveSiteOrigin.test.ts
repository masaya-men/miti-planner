import { describe, it, expect } from 'vitest';
import { resolveSiteOrigin } from '../resolveSiteOrigin';

describe('resolveSiteOrigin', () => {
  it('本番ホストはそのまま https origin になる', () => {
    expect(resolveSiteOrigin('lopoly.app')).toBe('https://lopoly.app');
  });

  it('既知の Vercel ホストも許可される', () => {
    expect(resolveSiteOrigin('lopo-miti.vercel.app')).toBe('https://lopo-miti.vercel.app');
  });

  it('プレビュー用パターンに一致する Vercel ホストは許可される', () => {
    expect(resolveSiteOrigin('lopo-miti-abc123.vercel.app')).toBe('https://lopo-miti-abc123.vercel.app');
  });

  it('偽装・許可外ホストは lopoly.app に倒す', () => {
    expect(resolveSiteOrigin('evil.example.com')).toBe('https://lopoly.app');
    expect(resolveSiteOrigin('lopoly.app.attacker.com')).toBe('https://lopoly.app');
  });

  it('localhost は http になる', () => {
    expect(resolveSiteOrigin('localhost:5173')).toBe('http://localhost:5173');
    expect(resolveSiteOrigin('localhost:4173')).toBe('http://localhost:4173');
  });

  it('undefined / 空文字は lopoly.app にフォールバック', () => {
    expect(resolveSiteOrigin(undefined)).toBe('https://lopoly.app');
    expect(resolveSiteOrigin('')).toBe('https://lopoly.app');
  });
});
