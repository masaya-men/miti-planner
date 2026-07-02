import { describe, it, expect } from 'vitest';
import ja from '../../../../locales/ja.json';
import en from '../../../../locales/en.json';
import ko from '../../../../locales/ko.json';
import zh from '../../../../locales/zh.json';

/**
 * housing.register.* / housing.edit.* の i18n パリティ検証。
 * 翻訳文の有無ではなく「キー構造」が ja/en/ko/zh で一致することを保証する。
 * (登録ページのステッパー/公開設定/ガイド/入力チェック/重複パネル/確認/オートセーブ/
 * 編集フィールド等、 Task12〜16 で追加した文言が言語によって欠落しない safety net)
 */

type Tree = {
  housing: { register: Record<string, unknown>; edit: Record<string, unknown> };
};

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

const registerOf = (data: unknown): Record<string, unknown> =>
  (data as Tree).housing.register;

const editOf = (data: unknown): Record<string, unknown> => (data as Tree).housing.edit;

const jaKeys = collectKeyPaths(registerOf(ja));
const jaEditKeys = collectKeyPaths(editOf(ja));

const others: Record<string, unknown> = { en, ko, zh };

describe('housing.register i18n parity', () => {
  it('ja に housing.register キーが存在する', () => {
    expect(jaKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.register キーが ja と一致する`, () => {
      expect(collectKeyPaths(registerOf(others[lang]))).toEqual(jaKeys);
    });
  }
});

describe('housing.edit i18n parity', () => {
  it('ja に housing.edit キーが存在する', () => {
    expect(jaEditKeys.length).toBeGreaterThan(0);
  });

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.edit キーが ja と一致する`, () => {
      expect(collectKeyPaths(editOf(others[lang]))).toEqual(jaEditKeys);
    });
  }
});
