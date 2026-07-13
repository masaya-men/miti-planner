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

  it('help 注記の下に免責文 (help_disclaimer) を別行で表示する (A)', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingRegisterSnsUrlField
          onTweetFetched={() => {}}
          onYoutubeFetched={() => {}}
          onOgpFetched={() => {}}
        />
      </I18nextProvider>,
    );
    // 免責文は i18n キー配線 (locale 値に依存せずクラスで存在検証する)。
    const disclaimer = container.querySelector('.housing-register-sns-url-help-disclaimer');
    expect(disclaimer).toBeInTheDocument();
    // help 本文とは別要素 (別行) であること。
    expect(disclaimer).not.toHaveTextContent(jaTranslations.housing.register.snsUrl.help);
  });
});
