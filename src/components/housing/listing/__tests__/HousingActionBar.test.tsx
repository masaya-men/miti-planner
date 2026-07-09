// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HousingActionBar } from '../HousingActionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ja' } }),
}));

// Task 3.3a: 編集は kebab から navigate('/housing/listing/:id/edit') へ変更 (モーダルは撤去)。
// useNavigate だけ差し替え、他の react-router-dom export (MemoryRouter 等) は実物のまま使う。
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// useHousingDelete は API 呼び出しを抱えるので mock (UI 分岐テストには不要)
vi.mock('../../delete/useHousingDelete', () => ({
  useHousingDelete: () => ({ deleteListing: vi.fn(), loading: false }),
}));

function renderBar(props: Partial<React.ComponentProps<typeof HousingActionBar>>) {
  return render(
    <MemoryRouter>
      <HousingActionBar listing={baseListing} viewerUid={null} {...props} />
    </MemoryRouter>,
  );
}

const baseListing = {
  id: 'lid1',
  ownerUid: 'owner1',
  dc: 'Mana',
  server: 'Anima',
  area: 'Mist',
  ward: 5,
  buildingType: 'house',
  plot: 12,
  size: 'M',
  addressKey: 'k',
  imageMode: 'none',
  tags: [],
  description: 'sample',
  createdAt: 0,
  updatedAt: 0,
  isHidden: false,
  reportCount: 0,
  deletedAt: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('HousingActionBar', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('家主自身が見ると kebab メニューが表示され、 「ちがった」 は出ない', () => {
    renderBar({ viewerUid: 'owner1' });
    expect(
      screen.queryByRole('button', { name: 'housing.detail.report_button' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    ).toBeInTheDocument();
  });

  it('他人が見ると「ちがった」 ボタンが表示され、 kebab は出ない', () => {
    renderBar({ viewerUid: 'other-uid' });
    expect(
      screen.getByRole('button', { name: 'housing.detail.report_button' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    ).not.toBeInTheDocument();
  });

  it('未ログインでも「ちがった」 ボタンは表示される (押下時にログイン誘導 toast を出す想定)', () => {
    renderBar({ viewerUid: null });
    expect(
      screen.getByRole('button', { name: 'housing.detail.report_button' }),
    ).toBeInTheDocument();
  });

  it('お気に入りボタンは常に表示される', () => {
    renderBar({ viewerUid: null });
    expect(
      screen.getByRole('button', { name: 'housing.card.favorite' }),
    ).toBeInTheDocument();
  });

  it('シェアボタンが表示される', () => {
    renderBar({ viewerUid: null });
    expect(
      screen.getByRole('button', { name: 'housing.detail.share' }),
    ).toBeInTheDocument();
  });

  // Task 3.3a: kebab の編集はモーダルを開かず、編集ページへ navigate する。
  it('家主が kebab メニューの「編集」を押すと編集ページへ navigate する (モーダルは開かない)', () => {
    renderBar({ viewerUid: 'owner1' });
    fireEvent.click(screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'housing.detail.kebab.edit' }));
    expect(navigateMock).toHaveBeenCalledWith(`/housing/listing/${baseListing.id}/edit`);
  });
});
