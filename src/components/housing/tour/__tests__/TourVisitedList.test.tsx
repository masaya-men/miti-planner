// @vitest-environment happy-dom
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { MockListing } from '../../../../data/housing/mockListings';
import { TourVisitedList } from '../TourVisitedList';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const youtubeListing: MockListing = {
  id: 'yt', ownerUid: 'owner-1', title: 'LoPoの家',
  area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', tags: [],
  imageMode: 'sns', ogImageUrl: 'https://i.ytimg.com/vi/9Lg45cM9mpA/maxresdefault.jpg',
  createdAt: 0, lastConfirmedAt: 0,
};

describe('TourVisitedList', () => {
  // 2026-10-22: maxresdefault が無い YouTube 動画でツアー行のサムネが出なかった (一覧カードだけ段階フォールバックがあった)
  it('YouTube サムネの高画質版が無いとき (404) は次の画質へ切り替える', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}><TourVisitedList listings={[youtubeListing]} /></I18nextProvider>,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('/vi/9Lg45cM9mpA/hqdefault.jpg');
  });
});
