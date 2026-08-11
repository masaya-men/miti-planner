// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

vi.mock('../../../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      listings: [
        { id: 'a', title: 'A', area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
        { id: 'b', title: 'B', area: 'Mist', ward: 1, plot: 2, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
      ],
      myListings: [],
    }),
}));

import { TourTrayBoard } from '../TourTrayBoard';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

// useSmoothWheelScroll.test.tsx と同じ PC 判定モック (横スクロールのバネ補間は PC + 非 reduce-motion のみ)。
function setMatchMediaPc(): void {
  window.matchMedia = ((query: string) => {
    let matches = false;
    if (query === '(hover: hover) and (pointer: fine)') matches = true;
    return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  }) as Window['matchMedia'];
}

function getBoardScroll(): HTMLDivElement {
  const el = document.querySelector('.housing-tour-board-scroll');
  if (!el) throw new Error('.housing-tour-board-scroll が見つかりません');
  return el as HTMLDivElement;
}

describe('TourTrayBoard', () => {
  it('トレイが空なら空状態を表示する', () => {
    wrap(<TourTrayBoard listingIds={[]} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('カードの「ツアーに追加」で行き先を積みましょう')).toBeInTheDocument();
  });

  it('トレイの件数分カードを描画する', () => {
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('カードをクリックすると onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('A'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('削除ボタンで onChange が呼ばれる', () => {
    const onChange = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={onChange} selectedId={null} onSelect={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('案内文が表示される', () => {
    wrap(<TourTrayBoard listingIds={['a']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('カード左側のハンドルをつかんでドラッグで並べ替えできます')).toBeInTheDocument();
  });

  it('ホイールでバネ補間により scrollLeft が進む(横スクロール・PC環境)', async () => {
    setMatchMediaPc();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    const el = getBoardScroll();
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 500 });
    el.scrollLeft = 200;

    const event = new WheelEvent('wheel', { deltaY: 50, deltaX: 0, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(el.scrollLeft).toBeGreaterThan(200);
  });

  it('境界(scrollLeft=0 で左方向)では preventDefault を呼ばない(横スクロール)', () => {
    setMatchMediaPc();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    const el = getBoardScroll();
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 500 });
    el.scrollLeft = 0;

    const event = new WheelEvent('wheel', { deltaY: -50, deltaX: 0, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
