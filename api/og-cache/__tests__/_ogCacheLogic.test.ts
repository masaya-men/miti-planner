import { describe, it, expect } from 'vitest';
import { isValidOgImageMeta, buildInternalOgUrl } from '../_ogCacheLogic.js';

describe('isValidOgImageMeta', () => {
  it('type無し(page型)はshareIdが必須', () => {
    expect(isValidOgImageMeta({ shareId: 'abc' })).toBe(true);
    expect(isValidOgImageMeta({})).toBe(false);
  });
  it('type=housingerはshareId不要', () => {
    expect(isValidOgImageMeta({ type: 'housinger', name: 'A' })).toBe(true);
  });
  it('null/undefinedは無効', () => {
    expect(isValidOgImageMeta(null)).toBe(false);
    expect(isValidOgImageMeta(undefined)).toBe(false);
  });
});

describe('buildInternalOgUrl', () => {
  it('type無し(page型)は従来どおり /api/og?id=... を組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { shareId: 'abc123', showLogo: false, lang: 'ja' }, undefined);
    expect(url).toBe('https://lopoly.app/api/og?id=abc123&lang=ja');
  });
  it('type=housingerはsecret必須で署名付きURLを組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { type: 'housinger', name: 'テスト', avatarUrl: null, imageUrls: [] }, 'test-secret');
    expect(url).toMatch(/^https:\/\/lopoly\.app\/api\/og\?type=housinger&ver=2&name=%E3%83%86%E3%82%B9%E3%83%88&sig=[a-f0-9]{24}$/);
  });
  it('type=housingerでsecret未設定なら例外', async () => {
    await expect(buildInternalOgUrl('https://lopoly.app', { type: 'housinger', name: 'A' }, undefined)).rejects.toThrow();
  });
  it('type=tourはsecret必須で署名付きURLを組み立てる', async () => {
    const url = await buildInternalOgUrl('https://lopoly.app', { type: 'tour', name: 'テスト' }, 'test-secret');
    expect(url).toMatch(/^https:\/\/lopoly\.app\/api\/og\?type=tour&ver=1&name=%E3%83%86%E3%82%B9%E3%83%88&sig=[a-f0-9]{24}$/);
  });
});
