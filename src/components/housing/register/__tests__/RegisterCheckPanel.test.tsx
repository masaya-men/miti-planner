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
      { key: 'address', done: true, labelKey: 'housing.register.check.address', required: true },
      { key: 'image', done: false, labelKey: 'housing.register.check.image', required: false },
    ]);
    expect(screen.getByTestId('housing-register-check-address').className).toContain('is-done');
    expect(screen.getByTestId('housing-register-check-image').className).toContain('is-todo');
  });
});
