import { describe, it, expect } from 'vitest';
import ja from '../../../../locales/ja.json';
import en from '../../../../locales/en.json';
import ko from '../../../../locales/ko.json';
import zh from '../../../../locales/zh.json';

/**
 * housing.tour.nav.* / housing.tour.join.* の i18n パリティ検証。
 * 翻訳文の有無ではなく「キー構造」が ja/en/ko/zh で一致することを保証する。
 * (ツアー中(Nav)ページ M1、共有ツアー参加者ページ Task 2.3 で追加した文言が
 *  言語によって欠落しない safety net)
 */

type Tree = { housing: { tour: { nav: Record<string, unknown>; join: Record<string, unknown> } } };

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
const joinOf = (data: unknown): Record<string, unknown> => (data as Tree).housing.tour.join;

const jaNavKeys = collectKeyPaths(navOf(ja));
const jaJoinKeys = collectKeyPaths(joinOf(ja));

const others: Record<string, unknown> = { en, ko, zh };

describe('housing.tour.nav i18n parity', () => {
  it('ja に housing.tour.nav キーが存在する', () => {
    expect(jaNavKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tour.nav キーが ja と一致する`, () => {
      expect(collectKeyPaths(navOf(others[lang]))).toEqual(jaNavKeys);
    });
  }
});

describe('housing.tour.join i18n parity', () => {
  it('ja に housing.tour.join キーが存在する', () => {
    expect(jaJoinKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tour.join キーが ja と一致する`, () => {
      expect(collectKeyPaths(joinOf(others[lang]))).toEqual(jaJoinKeys);
    });
  }
});
