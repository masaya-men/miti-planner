// globals: true モード (vitest.config.ts) に従い、 describe/it/expect はグローバル使用。
import { resolveLocalized } from '../localizedText';
import type { LocalizedText } from '../../types/systemNotification';

describe('resolveLocalized', () => {
  const full: LocalizedText = { ja: 'こんにちは', en: 'Hello', ko: '안녕', zh: '你好' };
  const ja_en_only: LocalizedText = { ja: 'こんにちは', en: 'Hello' };

  it('全言語埋まっているとき、 指定 lang をそのまま返す', () => {
    expect(resolveLocalized(full, 'ja')).toBe('こんにちは');
    expect(resolveLocalized(full, 'en')).toBe('Hello');
    expect(resolveLocalized(full, 'ko')).toBe('안녕');
    expect(resolveLocalized(full, 'zh')).toBe('你好');
  });

  it('ko/zh が未定義のとき en にフォールバックする', () => {
    expect(resolveLocalized(ja_en_only, 'ko')).toBe('Hello');
    expect(resolveLocalized(ja_en_only, 'zh')).toBe('Hello');
  });

  it('en も空のとき ja にフォールバックする (en 必須なので通常起きないがガード)', () => {
    const ja_only = { ja: 'こんにちは', en: '' } as LocalizedText;
    expect(resolveLocalized(ja_only, 'ko')).toBe('こんにちは');
  });

  it('不明な言語コードでも en or ja にフォールバックする', () => {
    expect(resolveLocalized(full, 'fr' as 'ja')).toBe('Hello');
  });
});
