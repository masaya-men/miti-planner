// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingEditMediaModeTabs } from '../HousingEditMediaModeTabs';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('HousingEditMediaModeTabs', () => {
  it('2つのタブを描画し、現在のモードに aria-selected を立てる', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <HousingEditMediaModeTabs mode="thumbnail" onChange={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('tab', { name: 'アップロード' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'false');
  });

  it('タブ押下で onChange が呼ばれる (押しただけではサーバー通信しない)', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <HousingEditMediaModeTabs mode="thumbnail" onChange={onChange} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'URL' }));
    expect(onChange).toHaveBeenCalledWith('sns');
  });
});
