// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { MapControls, autoSelectMapKind } from '../../components/housing/browse/map/MapControls';

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

const baseProps: React.ComponentProps<typeof MapControls> = {
  area: 'Mist',
  ward: 3,
  mapKind: 'main',
  wardCounts: new Map<number, number>([[1, 2], [3, 5]]),
  kindCounts: { main: 4, sub: 1 },
  onAreaChange: () => {},
  onWardChange: () => {},
  onKindChange: () => {},
};

function renderControls(overrides: Partial<React.ComponentProps<typeof MapControls>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MapControls {...baseProps} {...overrides} />
    </I18nextProvider>,
  );
}

describe('MapControls — 住宅街切替', () => {
  it('5つの住宅街ボタンが描画され、クリックで onAreaChange(area) が呼ばれる', () => {
    const onAreaChange = vi.fn();
    renderControls({ onAreaChange });
    fireEvent.click(screen.getByTestId('housing-mapctl-area-Goblet'));
    expect(onAreaChange).toHaveBeenCalledWith('Goblet');
  });

  it('現在の area に data-selected="true" が付く', () => {
    renderControls({ area: 'Shirogane' });
    expect(screen.getByTestId('housing-mapctl-area-Shirogane')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('housing-mapctl-area-Mist')).toHaveAttribute('data-selected', 'false');
  });
});

describe('MapControls — 区ドロップダウン (件数表示)', () => {
  it('トリガーを開くと1〜30の選択肢が件数付きで表示される (0件の区も選べる)', () => {
    renderControls();
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-trigger'));
    expect(screen.getByText('1区 (2件)')).toBeTruthy();
    expect(screen.getByText('3区 (5件)')).toBeTruthy();
    expect(screen.getByText('2区 (0件)')).toBeTruthy();
    expect(screen.getByText('30区 (0件)')).toBeTruthy();
  });

  it('選択肢クリックで onWardChange(n) が呼ばれ、メニューが閉じる', () => {
    const onWardChange = vi.fn();
    renderControls({ onWardChange });
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-trigger'));
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-option-1'));
    expect(onWardChange).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('MapControls — 前後矢印 (端で止める)', () => {
  it('中間の区では前後で ±1 される', () => {
    const onWardChange = vi.fn();
    renderControls({ ward: 15, onWardChange });
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-prev'));
    expect(onWardChange).toHaveBeenCalledWith(14);
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-next'));
    expect(onWardChange).toHaveBeenCalledWith(16);
  });

  it('1区で前へを押しても onWardChange は呼ばれない (端で止まる)', () => {
    const onWardChange = vi.fn();
    renderControls({ ward: 1, onWardChange });
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-prev'));
    expect(onWardChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('housing-mapctl-ward-prev')).toBeDisabled();
  });

  it('30区で次へを押しても onWardChange は呼ばれない (端で止まる)', () => {
    const onWardChange = vi.fn();
    renderControls({ ward: 30, onWardChange });
    fireEvent.click(screen.getByTestId('housing-mapctl-ward-next'));
    expect(onWardChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('housing-mapctl-ward-next')).toBeDisabled();
  });
});

describe('MapControls — 本街/拡張街タブ (件数付き)', () => {
  it('件数付きラベルが表示され、クリックで onKindChange(kind) が呼ばれる', () => {
    const onKindChange = vi.fn();
    renderControls({ kindCounts: { main: 4, sub: 3 }, onKindChange });
    expect(screen.getByText('本街 (4)')).toBeTruthy();
    expect(screen.getByText('拡張街 (3)')).toBeTruthy();
    fireEvent.click(screen.getByTestId('housing-mapctl-kind-sub'));
    expect(onKindChange).toHaveBeenCalledWith('sub');
  });

  it('現在の mapKind に data-selected="true" / aria-selected が付く', () => {
    renderControls({ mapKind: 'sub' });
    expect(screen.getByTestId('housing-mapctl-kind-sub')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('housing-mapctl-kind-main')).toHaveAttribute('aria-selected', 'false');
  });
});

describe('autoSelectMapKind — kind 自動選択の純関数', () => {
  it('sub の方が多ければ sub を返す', () => {
    expect(autoSelectMapKind({ main: 1, sub: 5 })).toBe('sub');
  });
  it('main の方が多ければ main を返す', () => {
    expect(autoSelectMapKind({ main: 5, sub: 1 })).toBe('main');
  });
  it('両方0(同数)なら main を返す', () => {
    expect(autoSelectMapKind({ main: 0, sub: 0 })).toBe('main');
  });
  it('同数(非ゼロ)でも main を優先する', () => {
    expect(autoSelectMapKind({ main: 3, sub: 3 })).toBe('main');
  });
});
