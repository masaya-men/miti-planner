// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { FavoritesBulkBar } from '../FavoritesBulkBar';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderBar(overrides: Partial<React.ComponentProps<typeof FavoritesBulkBar>> = {}) {
  const props = {
    total: 5,
    selectedCount: 2,
    onSelectAll: vi.fn(),
    onClearSelect: vi.fn(),
    onAddAll: vi.fn(),
    onAddSelected: vi.fn(),
    onRemoveFromFav: vi.fn(),
    ...overrides,
  };
  const result = render(
    <I18nextProvider i18n={i18n}>
      <FavoritesBulkBar {...props} />
    </I18nextProvider>
  );
  return { ...result, props };
}

describe('FavoritesBulkBar', () => {
  it('「選択だけ追加」ボタンで onAddSelected が呼ばれる', () => {
    const { props } = renderBar({ selectedCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: /選択だけ/ }));
    expect(props.onAddSelected).toHaveBeenCalled();
  });

  it('selectedCount===0 のとき「選択だけ追加」は disabled', () => {
    renderBar({ selectedCount: 0 });
    expect(screen.getByRole('button', { name: /選択だけ/ })).toBeDisabled();
  });

  it('selectedCount===0 のとき「選択解除」は disabled', () => {
    renderBar({ selectedCount: 0 });
    expect(screen.getByRole('button', { name: /選択解除/ })).toBeDisabled();
  });

  it('selectedCount===0 のとき「お気に入りから外す」は disabled', () => {
    renderBar({ selectedCount: 0 });
    expect(screen.getByRole('button', { name: /お気に入りから外す/ })).toBeDisabled();
  });

  it('selectedCount > 0 のとき件数が表示される', () => {
    renderBar({ selectedCount: 3 });
    expect(screen.getByText(/3件選択中/)).toBeInTheDocument();
  });

  it('「すべてツアーに追加」ボタンで onAddAll が呼ばれる', () => {
    const { props } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /すべてツアーに追加/ }));
    expect(props.onAddAll).toHaveBeenCalled();
  });

  it('「すべて選択」ボタンで onSelectAll が呼ばれる', () => {
    const { props } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /すべて選択/ }));
    expect(props.onSelectAll).toHaveBeenCalled();
  });
});
