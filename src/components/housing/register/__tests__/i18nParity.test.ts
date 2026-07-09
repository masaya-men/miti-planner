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

/** ネストを含めた全 leaf を「パス→値」でフラット化する。 */
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

/** ネストを含めた全キーパスを収集 (leaf のみ・ソート済)。 */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(flattenLeaves(obj, prefix)).sort();
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

/** ひらがな/カタカナ (中国語の正しい訳文には出現しない・日本語残存の目印)。 */
const HIRAGANA_KATAKANA = /[぀-ヿ]/;

/**
 * housing.edit.* の翻訳完了チェック (Task3.4-3)。
 * キー構造の一致だけでは「ja の日本語テキストがそのままコピーされている (未翻訳)」を検知できないため、
 * leaf 値が ja のコピーのまま残っていないかを見る。
 * zh は漢字を共有するため ja との完全一致だけでは誤検知する (例: 「保存」は zh でも正しい訳語)。
 * ja/zh 共有語のケースを弾くため、 zh のみ「ひらがな/カタカナの残存」で未翻訳を判定する
 * (en/ko は文字体系が異なり ja と偶然一致することが無いため完全一致判定のままでよい)。
 */
describe('housing.edit 翻訳完了 (ja のコピー残りゼロ)', () => {
  const jaEditValues = flattenLeaves(editOf(ja));

  for (const lang of Object.keys(others)) {
    it(`${lang} の housing.edit 値に ja からのコピー残り (未翻訳) が無い`, () => {
      const otherValues = flattenLeaves(editOf(others[lang]));
      const untranslated = Object.keys(jaEditValues).filter((path) => {
        const value = otherValues[path];
        if (typeof value !== 'string') return false;
        if (lang === 'zh') return HIRAGANA_KATAKANA.test(value);
        return value === jaEditValues[path];
      });
      expect(untranslated).toEqual([]);
    });
  }
});
