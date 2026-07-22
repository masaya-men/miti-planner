// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { BrowseSortSelect } from '../BrowseSortSelect';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

describe('BrowseSortSelect', () => {
  it('orders 未指定なら新着順/古い順の2択のみ表示する (既存仕様のまま)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect value="newest" onChange={() => {}} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: /ランダム/ })).toBeNull();
  });

  it('orders=[random,newest,oldest] を渡すと3択表示する', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect
          value="random"
          onChange={() => {}}
          orders={['random', 'newest', 'oldest']}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /ランダム/ })).toBeInTheDocument();
  });

  it('option クリックで onChange が呼ばれる', () => {
    let picked: string | null = null;
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect
          value="random"
          onChange={(v) => { picked = v; }}
          orders={['random', 'newest', 'oldest']}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: /新着順/ }));
    expect(picked).toBe('newest');
  });
});
