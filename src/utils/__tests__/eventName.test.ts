import { describe, it, expect } from 'vitest';
import { formatEventName } from '../eventName';

describe('formatEventName', () => {
  it('altName 無し → name のみ', () => {
    expect(
      formatEventName({ name: { ja: 'ホリゾンタル', en: 'Horizontal' } }, 'ja', 'or'),
    ).toBe('ホリゾンタル');
  });

  it('altName 有り（ja表示）→ "name or altName"', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: 'ヴァーティカル', en: 'Vertical' } },
        'ja',
        'or',
      ),
    ).toBe('ホリゾンタル or ヴァーティカル');
  });

  it('altName 有り（en表示）→ 現言語で連結', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: 'ヴァーティカル', en: 'Vertical' } },
        'en',
        'or',
      ),
    ).toBe('Horizontal or Vertical');
  });

  it('altName の現言語(zh)が無い → en→ja フォールバック（name と同じ挙動）', () => {
    expect(
      formatEventName(
        { name: { ja: '主', en: 'Main' }, altName: { ja: '副', en: 'Alt' } },
        'zh',
        'or',
      ),
    ).toBe('Main or Alt');
  });

  it('altName が空 LocalizedString → name のみ（空は連結しない）', () => {
    expect(
      formatEventName(
        { name: { ja: 'ホリゾンタル', en: 'Horizontal' }, altName: { ja: '', en: '' } },
        'ja',
        'or',
      ),
    ).toBe('ホリゾンタル');
  });

  it('連結語は引数で差し替え可（i18n 非ハードコード）', () => {
    expect(
      formatEventName(
        { name: { ja: 'A', en: 'A' }, altName: { ja: 'B', en: 'B' } },
        'ja',
        '/',
      ),
    ).toBe('A / B');
  });
});
