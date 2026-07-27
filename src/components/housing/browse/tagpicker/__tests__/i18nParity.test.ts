import { describe, it, expect } from 'vitest';
import ja from '../../../../../locales/ja.json';
import en from '../../../../../locales/en.json';
import ko from '../../../../../locales/ko.json';
import zh from '../../../../../locales/zh.json';

/**
 * housing.tagpicker.* の i18n パリティ検証 (design 2026-07-27-housing-tag-and-search-design.md)。
 * キー構造が ja/en/ko/zh で一致し、 かつ ja のコピー残り (未翻訳) が無いことを保証する。
 */

type Tree = { housing: { tagpicker: Record<string, unknown> } };

function flattenLeaves(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenLeaves(value as Record<string, unknown>, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(flattenLeaves(obj, prefix)).sort();
}

const tagpickerOf = (data: unknown): Record<string, unknown> => (data as Tree).housing.tagpicker;

const jaKeys = collectKeyPaths(tagpickerOf(ja));
const others: Record<string, unknown> = { en, ko, zh };

describe('housing.tagpicker i18n parity', () => {
  it('ja に housing.tagpicker キーが存在する', () => {
    expect(jaKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tagpicker キーが ja と一致する`, () => {
      expect(collectKeyPaths(tagpickerOf(others[lang]))).toEqual(jaKeys);
    });
  }
});

const HIRAGANA_KATAKANA = /[぀-ヿ]/;

describe('housing.tagpicker 翻訳完了 (ja のコピー残りゼロ)', () => {
  const jaValues = flattenLeaves(tagpickerOf(ja));

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.tagpicker 値に ja からのコピー残り (未翻訳) が無い`, () => {
      const otherValues = flattenLeaves(tagpickerOf(others[lang]));
      const untranslated = Object.keys(jaValues).filter((path) => {
        const value = otherValues[path];
        if (typeof value !== 'string') return false;
        if (lang === 'zh') return HIRAGANA_KATAKANA.test(value);
        return value === jaValues[path];
      });
      expect(untranslated).toEqual([]);
    });
  }
});
