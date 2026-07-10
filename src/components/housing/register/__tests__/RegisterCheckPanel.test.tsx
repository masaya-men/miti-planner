// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { RegisterCheckPanel } from '../RegisterCheckPanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function wrap(items: Parameters<typeof RegisterCheckPanel>[0]['items']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RegisterCheckPanel items={items} />
    </I18nextProvider>,
  );
}

describe('RegisterCheckPanel', () => {
  it('done 行は ✓ 印・not done 行は ⚠ 印を出す', () => {
    wrap([
      {
        key: 'address',
        done: true,
        labelKey: 'housing.register.check.row_address',
        missingLabelKey: 'housing.register.check.missing_address',
        required: true,
      },
      {
        key: 'image',
        done: false,
        labelKey: 'housing.register.check.row_image',
        missingLabelKey: 'housing.register.check.missing_image',
        required: false,
      },
    ]);
    expect(screen.getByTestId('housing-register-check-address').className).toContain('is-done');
    expect(screen.getByTestId('housing-register-check-image').className).toContain('is-todo');
  });

  // 2026-07-10 バグ回帰防止: 行ラベルにパネル見出し (「登録前に確認」) が出てはいけない。
  // 以前は registerChecklist の title 行が見出しと同じ check.title を参照していた。
  it('行ラベルに見出し文言「登録前に確認」が混入しない (キー衝突バグの回帰防止)', () => {
    wrap([
      {
        key: 'title',
        done: false,
        labelKey: 'housing.register.check.row_title',
        missingLabelKey: 'housing.register.check.missing_title',
        required: false,
      },
    ]);
    const row = screen.getByTestId('housing-register-check-title');
    expect(row.textContent).not.toContain('登録前に確認');
    expect(row.textContent).toContain('タイトル');
  });
});
