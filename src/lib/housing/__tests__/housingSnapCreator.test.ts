import { describe, it, expect } from 'vitest';
import { parseHousingSnapCreator, isHousingSnapPostUrl, normalizeXStatusUrl } from '../housingSnapCreator';

// housingsnap.com/47818 (2026-10-12 取得) の該当部分を抜粋
const EXCERPT = `
<a href="http://twitter.com/intent/tweet?url=https://housingsnap.com/47818&amp;via=ff14housingsnap&amp;text=Lucine">share</a>
<a href="/?user=T56Ntct6">Ryndessa</a>
<a href="https://x.com/Ryndessa/status/2109303140176499156" target="_blank">X</a>
`;

describe('parseHousingSnapCreator', () => {
  it('作者名と本人の X ポストを拾う (共有ボタンの intent リンクは無視)', () => {
    expect(parseHousingSnapCreator(EXCERPT)).toEqual({
      postUrl: 'https://x.com/Ryndessa/status/2109303140176499156',
      name: 'Ryndessa',
    });
  });

  it('X ポストが無ければ postUrl は null、名前だけ返す', () => {
    expect(parseHousingSnapCreator('<a href="/?user=abc">Taro &amp; Hana</a>')).toEqual({ postUrl: null, name: 'Taro & Hana' });
  });

  it('何も無ければ両方 null', () => {
    expect(parseHousingSnapCreator('')).toEqual({ postUrl: null, name: null });
  });
});

describe('isHousingSnapPostUrl', () => {
  it('housingsnap.com/<数字> だけを対象にする', () => {
    expect(isHousingSnapPostUrl('https://housingsnap.com/47818')).toBe(true);
    expect(isHousingSnapPostUrl('https://www.housingsnap.com/47818')).toBe(true);
    expect(isHousingSnapPostUrl('https://housingsnap.com/?user=abc')).toBe(false);
    expect(isHousingSnapPostUrl('https://evil.example/housingsnap.com/1')).toBe(false);
    expect(isHousingSnapPostUrl('not a url')).toBe(false);
  });
});

describe('normalizeXStatusUrl', () => {
  it('x.com / twitter.com のポスト URL を https://x.com/<user>/status/<id> に揃える', () => {
    expect(normalizeXStatusUrl('https://x.com/a_b/status/123?s=20')).toBe('https://x.com/a_b/status/123');
    expect(normalizeXStatusUrl('http://twitter.com/a/status/9/photo/1')).toBe('https://x.com/a/status/9');
    expect(normalizeXStatusUrl('https://mobile.twitter.com/a/status/9')).toBe('https://x.com/a/status/9');
  });
  it('ポスト以外は null', () => {
    expect(normalizeXStatusUrl('https://x.com/a')).toBeNull();
    expect(normalizeXStatusUrl('https://twitter.com/intent/tweet?url=x')).toBeNull();
    expect(normalizeXStatusUrl('https://housingsnap.com/1')).toBeNull();
  });
});
