// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingActionBar } from '../HousingActionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// EditModal は HousingRegisterModal 経由で重い依存を持つので mock
vi.mock('../../edit/HousingEditModal', () => ({
  HousingEditModal: () => null,
}));

// useHousingDelete は API 呼び出しを抱えるので mock (UI 分岐テストには不要)
vi.mock('../../delete/useHousingDelete', () => ({
  useHousingDelete: () => ({ deleteListing: vi.fn(), loading: false }),
}));

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
  it('家主自身が見ると kebab メニューが表示され、 「ちがった」 は出ない', () => {
    render(<HousingActionBar listing={baseListing} viewerUid="owner1" />);
    expect(
      screen.queryByRole('button', { name: 'housing.detail.report_button' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    ).toBeInTheDocument();
  });

  it('他人が見ると「ちがった」 ボタンが表示され、 kebab は出ない', () => {
    render(<HousingActionBar listing={baseListing} viewerUid="other-uid" />);
    expect(
      screen.getByRole('button', { name: 'housing.detail.report_button' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'housing.detail.kebab.aria_label' }),
    ).not.toBeInTheDocument();
  });

  it('未ログインでも「ちがった」 ボタンは表示される (押下時にログイン誘導 toast を出す想定)', () => {
    render(<HousingActionBar listing={baseListing} viewerUid={null} />);
    expect(
      screen.getByRole('button', { name: 'housing.detail.report_button' }),
    ).toBeInTheDocument();
  });

  it('お気に入りボタンは常に表示される', () => {
    render(<HousingActionBar listing={baseListing} viewerUid={null} />);
    expect(
      screen.getByRole('button', { name: 'housing.detail.favorite_aria' }),
    ).toBeInTheDocument();
  });

  it('シェアボタンが表示される', () => {
    render(<HousingActionBar listing={baseListing} viewerUid={null} />);
    expect(
      screen.getByRole('button', { name: 'housing.detail.share' }),
    ).toBeInTheDocument();
  });
});
