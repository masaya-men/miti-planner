/**
 * ListingCard.*.test.tsx 共通の準備 (テストデータ・描画関数・環境と IntersectionObserver のモック)。
 * vi.mock は hoist されるため各テストファイルに直接書く。
 */
import { act, render } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { ListingCard } from '../ListingCard';

export const mockListing = MOCK_LISTINGS[0];

// NEWビーム演出 (ListingCard.tsx) の IntersectionObserver をモック。happy-dom は実際の
// 交差判定をしないため、テスト側で「画面内に入った」を疑似的に発火できるようにする。
let ioCallback: IntersectionObserverCallback | null = null;
class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) { ioCallback = cb; }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
export function fireIntersection(isIntersecting: boolean): void {
  act(() => {
    ioCallback?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}


export function setupListingCardEnv() {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }

  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

export function resetIntersection(): void {
  ioCallback = null;
}

export function renderCard(props: Partial<Parameters<typeof ListingCard>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingCard listing={mockListing} onAddToTour={() => {}} {...props} />
    </I18nextProvider>
  );
}
