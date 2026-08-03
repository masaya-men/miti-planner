// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { MockListing } from '../../data/housing/mockListings';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { ListingGrid } from '../../components/housing/browse/ListingGrid';

function makeListing(id: string): MockListing {
  return {
    id, area: 'Mist', ward: 5, plot: 10, buildingType: 'house',
    size: 'M', imageMode: 'none', tags: [], ownerUid: 'owner-1', createdAt: 0, visibility: 'public',
  } as unknown as MockListing;
}

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderGrid(props: Partial<React.ComponentProps<typeof ListingGrid>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingGrid
        listings={[makeListing('a'), makeListing('b')]}
        sort="newest"
        onSortChange={() => {}}
        listKey="housinger"
        showOwnerControls
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('ListingGrid selectable', () => {
  it('selectable=trueのとき各カードに選択トグルが出て、クリックでonToggleSelectが呼ばれる', () => {
    const onToggleSelect = vi.fn();
    renderGrid({ selectable: true, selectedIds: new Set(['a']), onToggleSelect });

    const buttons = screen.getAllByTestId('housing-card-select');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toContain('is-selected');
    expect(buttons[1].className).not.toContain('is-selected');
    fireEvent.click(buttons[1]);
    expect(onToggleSelect).toHaveBeenCalledWith('b');
  });

  it('selectable未指定なら選択トグルは出ない', () => {
    renderGrid();
    expect(screen.queryByTestId('housing-card-select')).toBeNull();
  });
});

describe('ListingGrid backgroundId', () => {
  it('backgroundIdに一致するカードだけ背景トグルがis-selectedになる', () => {
    const onToggleBackground = vi.fn();
    renderGrid({
      selectable: true,
      selectedIds: new Set(['a', 'b']),
      onToggleSelect: vi.fn(),
      backgroundId: 'b',
      onToggleBackground,
    });

    const bgButtons = screen.getAllByTestId('housing-card-background-select');
    expect(bgButtons).toHaveLength(2);
    expect(bgButtons[0].className).not.toContain('is-selected');
    expect(bgButtons[1].className).toContain('is-selected');
    fireEvent.click(bgButtons[0]);
    expect(onToggleBackground).toHaveBeenCalledWith('a');
  });
});
