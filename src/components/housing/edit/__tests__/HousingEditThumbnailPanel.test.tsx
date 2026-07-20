// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ToastContainer } from '../../../Toast';

const mockUpload = vi.fn();
const mockDelete = vi.fn();
const mockReorder = vi.fn();
vi.mock('../../../../lib/housingApiClient', () => ({
  uploadListingThumbnail: (...args: unknown[]) => mockUpload(...args),
  deleteListingThumbnail: (...args: unknown[]) => mockDelete(...args),
  reorderListingThumbnails: (...args: unknown[]) => mockReorder(...args),
}));

const mockCompress = vi.fn();
vi.mock('../../../../lib/housing/imageCompression', () => ({
  compressHousingImage: (...args: unknown[]) => mockCompress(...args),
}));

import { HousingEditThumbnailPanel } from '../HousingEditThumbnailPanel';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(images: string[], onImagesChange = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditThumbnailPanel listingId="listing1" images={images} onImagesChange={onImagesChange} />
      <ToastContainer />
    </I18nextProvider>,
  );
  return { onImagesChange };
}

describe('HousingEditThumbnailPanel', () => {
  it('既存画像をグリッドに表示する', () => {
    renderPanel(['a', 'b']);
    // HousingEditImageGrid (Task2実装) は img に alt="" を設定しており、
    // 空alt画像は暗黙的に role="presentation" となり getByRole('img') では拾えないため DOM 直接検証する。
    expect(document.querySelectorAll('img')).toHaveLength(2);
  });

  it('上限未満なら追加ドロップゾーンを表示する', () => {
    renderPanel(['a']);
    expect(screen.getByRole('button', { name: /画像を選ぶ|ファイルを選択|クリックして選択/ })).toBeTruthy();
  });

  it('ファイル選択→圧縮→アップロード成功で onImagesChange が返り値で呼ばれる', async () => {
    mockCompress.mockResolvedValue({ base64: 'ZmFrZQ==', mimeType: 'image/webp', file: new File([], 'a.webp'), originalBytes: 100, compressedBytes: 50 });
    mockUpload.mockResolvedValue({ success: true, thumbnailPath: 'https://x/new.webp', thumbnailPaths: ['a', 'https://x/new.webp'] });
    const { onImagesChange } = renderPanel(['a']);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith({
      listingId: 'listing1',
      base64: 'ZmFrZQ==',
      mimeType: 'image/webp',
      index: 1,
    }));
    await waitFor(() => expect(onImagesChange).toHaveBeenCalledWith(['a', 'https://x/new.webp']));
  });

  it('アップロード失敗時はトーストを表示し onImagesChange を呼ばない', async () => {
    mockCompress.mockResolvedValue({ base64: 'ZmFrZQ==', mimeType: 'image/webp', file: new File([], 'a.webp'), originalBytes: 100, compressedBytes: 50 });
    mockUpload.mockRejectedValue(new Error('boom'));
    const { onImagesChange } = renderPanel(['a']);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('失敗しました。もう一度お試しください')).toBeInTheDocument());
    expect(onImagesChange).not.toHaveBeenCalled();
  });

  it('上限枚数に達したら追加ドロップゾーンを描画しない', () => {
    renderPanel(['a', 'b', 'c', 'd']);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
