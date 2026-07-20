// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingEditImageGrid } from '../HousingEditImageGrid';
import { ToastContainer } from '../../../Toast';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderGrid(overrides: Partial<React.ComponentProps<typeof HousingEditImageGrid>> = {}) {
  const onImagesChange = overrides.onImagesChange ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn().mockResolvedValue(['a', 'b']);
  const onReorder = overrides.onReorder ?? vi.fn().mockResolvedValue(['a', 'b']);
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditImageGrid
        images={overrides.images ?? ['a', 'b', 'c']}
        onImagesChange={onImagesChange}
        onDelete={onDelete}
        onReorder={onReorder}
        minImages={overrides.minImages ?? 1}
      />
      <ToastContainer />
    </I18nextProvider>,
  );
  return { onImagesChange, onDelete, onReorder };
}

describe('HousingEditImageGrid', () => {
  it('画像0枚では何も描画しない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingEditImageGrid
          images={[]}
          onImagesChange={vi.fn()}
          onDelete={vi.fn()}
          onReorder={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-register-image-grid')).toBeNull();
  });

  it('画像枚数分のタイルを描画し、1枚目にカバーバッジを出す', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingEditImageGrid
          images={['a', 'b', 'c']}
          onImagesChange={vi.fn()}
          onDelete={vi.fn()}
          onReorder={vi.fn()}
        />
        <ToastContainer />
      </I18nextProvider>,
    );
    const imgs = container.querySelectorAll('.housing-register-image-tile-img');
    expect(imgs).toHaveLength(3);
    expect(screen.getByText('カバー')).toBeInTheDocument();
  });

  it('削除ボタン押下で onDelete を呼び、成功したら onImagesChange に結果を渡す', async () => {
    const { onImagesChange, onDelete } = renderGrid({
      images: ['a', 'b'],
      onDelete: vi.fn().mockResolvedValue(['b']),
    });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(0);
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith(['b']));
  });

  it('削除失敗時は onImagesChange を呼ばず、元のまま留まる', async () => {
    const { onImagesChange } = renderGrid({
      images: ['a', 'b'],
      onDelete: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(removeButtons[0]);
    await waitFor(() => expect(screen.queryByText('失敗しました。もう一度お試しください')).toBeInTheDocument());
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it('minImages と同数のときは削除ボタンが disabled', () => {
    renderGrid({ images: ['a'], minImages: 1 });
    const removeButtons = screen.getAllByRole('button', { name: '削除' });
    expect(removeButtons[0]).toBeDisabled();
  });
});
