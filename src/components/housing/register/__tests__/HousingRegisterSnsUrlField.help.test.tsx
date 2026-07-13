// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingRegisterSnsUrlField } from '../HousingRegisterSnsUrlField';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('HousingRegisterSnsUrlField help 注記', () => {
  it('URL 欄の下に snsUrl.help の注記を表示し、新プレースホルダーを使う', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <HousingRegisterSnsUrlField
          onTweetFetched={() => {}}
          onYoutubeFetched={() => {}}
          onOgpFetched={() => {}}
        />
      </I18nextProvider>,
    );
    // 新プレースホルダー
    expect(screen.getByPlaceholderText(jaTranslations.housing.register.snsUrl.placeholder)).toBeInTheDocument();
    // help 注記
    expect(screen.getByText(jaTranslations.housing.register.snsUrl.help)).toBeInTheDocument();
  });
});
