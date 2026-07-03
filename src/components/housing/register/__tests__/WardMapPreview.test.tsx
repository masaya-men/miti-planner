// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { WardMapPreview } from '../WardMapPreview';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPreview(props: React.ComponentProps<typeof WardMapPreview> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <WardMapPreview {...props} />
    </I18nextProvider>
  );
}

describe('WardMapPreview', () => {
  it('propsが空 (住所未確定) ならプレースホルダを出す (地図ロードしない)', () => {
    renderPreview();
    expect(screen.getByTestId('housing-ward-preview-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('housing-ward-preview-skeleton')).toBeNull();
    expect(screen.queryByTestId('housing-ward-preview-map')).toBeNull();
  });

  it('エリア不明な文字列ならプレースホルダを出す', () => {
    renderPreview({ area: 'NotAnArea', plot: 1, buildingType: 'house' });
    expect(screen.getByTestId('housing-ward-preview-placeholder')).toBeTruthy();
  });

  it('ハウスで plot 未確定ならプレースホルダを出す', () => {
    renderPreview({ area: 'Mist', buildingType: 'house' });
    expect(screen.getByTestId('housing-ward-preview-placeholder')).toBeTruthy();
  });

  it('住所が確定していれば地図読み込み中スケルトンを出す (プレースホルダは出ない)', () => {
    renderPreview({ area: 'Mist', plot: 5, buildingType: 'house' });
    expect(screen.getByTestId('housing-ward-preview-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('housing-ward-preview-placeholder')).toBeNull();
  });

  it('アパートの要約に部屋番号 (#N) を含める (B6 回帰)', () => {
    const { container } = renderPreview({
      area: 'Mist',
      buildingType: 'apartment',
      apartmentBuilding: 1,
      ward: 17,
      roomNumber: 13,
    });
    const summary = container.querySelector('.housing-ward-preview-summary');
    expect(summary?.textContent).toContain('1号棟 (本街)');
    expect(summary?.textContent).toContain('#13');
  });

  it('アパートで部屋番号が未入力なら # を出さない', () => {
    const { container } = renderPreview({
      area: 'Mist',
      buildingType: 'apartment',
      apartmentBuilding: 2,
      ward: 3,
    });
    const summary = container.querySelector('.housing-ward-preview-summary');
    expect(summary?.textContent).toContain('2号棟 (拡張街)');
    expect(summary?.textContent).not.toContain('#');
  });
});
