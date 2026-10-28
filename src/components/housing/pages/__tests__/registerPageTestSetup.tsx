// RegisterPage.*.test.tsx 共通の準備 (vi.mock は hoist されるため各テストファイルに直接書く)
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { HousingListing } from '../../../../types/housing';
import { RegisterPage } from '../RegisterPage';

export const EDITABLE_LISTING = {
  id: 'l1',
  dc: 'Meteor',
  server: 'Ramuh',
  area: 'LavenderBeds',
  ward: 29,
  plot: 3,
  buildingType: 'house',
  size: 'L',
  title: 'テスト物件',
  description: 'テスト紹介文',
  tags: ['official_cafe'],
  visibility: 'public',
  sourceImageUrls: ['https://x/a.jpg'],
} as unknown as HousingListing;

export function initTestI18n() {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
}

export function renderPage(props?: {
  mode?: 'create' | 'edit';
  initialValues?: HousingListing;
  onSaved?: (listingId: string) => void | Promise<unknown>;
}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RegisterPage
          mode={props?.mode}
          initialValues={props?.initialValues}
          onSaved={props?.onSaved}
        />
      </MemoryRouter>
    </I18nextProvider>
  );
}

// Batch2 (Task7): 直接アップロード欄は既定で折りたたまれている。
// 「画像をアップロードして登録する」トグルがまだ展開されていなければ先に押して入力欄を出す。
export function ensureUploadExpanded(container: HTMLElement) {
  const toggle = container.querySelector(
    '[data-testid="housing-register-toggle-upload"]',
  ) as HTMLButtonElement | null;
  if (toggle) {
    fireEvent.click(toggle);
  }
}

// 画像必須 (mode=create) のテスト用: ローカル画像を 1 枚追加して canSubmit を満たす。
// 圧縮は vi.mock で同期スタブ化済み。タイルが出るまで待って反映を保証する。
export async function attachImage(container: HTMLElement) {
  ensureUploadExpanded(container);
  const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(container.querySelector('.housing-register-image-tile')).not.toBeNull(),
  );
}

// 複数枚まとめて添付するヘルパー
export async function attachImages(container: HTMLElement, count: number) {
  ensureUploadExpanded(container);
  const input = container.querySelector('.housing-register-image-input') as HTMLInputElement;
  const files = Array.from({ length: count }, (_, i) => new File(['x'], `photo${i}.png`, { type: 'image/png' }));
  fireEvent.change(input, { target: { files } });
  await waitFor(() =>
    expect(container.querySelectorAll('.housing-register-image-tile').length).toBeGreaterThan(0),
  );
}
