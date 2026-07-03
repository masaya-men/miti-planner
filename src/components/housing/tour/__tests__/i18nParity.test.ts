import { describe, it, expect } from 'vitest';
import ja from '../../../../locales/ja.json';
import en from '../../../../locales/en.json';
import ko from '../../../../locales/ko.json';
import zh from '../../../../locales/zh.json';

/**
 * housing.tour.nav.* の i18n パリティ検証。
 * 翻訳文の有無ではなく「キー構造」が ja/en/ko/zh で一致することを保証する。
 * (ツアー中(Nav)ページ M1 で追加した文言が言語によって欠落しない safety net)
 */

type Tree = { housing: { tour: { nav: Record<string, unknown> } } };

/** ネストを含めた全キーパスを収集 (leaf のみ・ソート済)。 */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectKeyPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

const navOf = (data: unknown): Record<string, unknown> => (data as Tree).housing.tour.nav;

const jaKeys = collectKeyPaths(navOf(ja));

const others: Record<string, unknown> = { en, ko, zh };

describe('housing.tour.nav i18n parity', () => {
  it('ja に housing.tour.nav キーが存在する', () => {
    expect(jaKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tour.nav キーが ja と一致する`, () => {
      expect(collectKeyPaths(navOf(others[lang]))).toEqual(jaKeys);
    });
  }
});
