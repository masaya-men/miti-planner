// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDetailContent } from '../HousingDetailContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// 子コンポーネントの重い依存をモック
vi.mock('../HousingActionBar', () => ({
  HousingActionBar: () => <div data-testid="action-bar-mock" />,
}));

const listing = {
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
  tags: ['和風', 'カフェ'],
  description: '隠れ家カフェ',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  isHidden: false,
  reportCount: 0,
  deletedAt: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('HousingDetailContent', () => {
  it('description と address (ward, plot) が表示される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    // description はタイトルと本文の 2 箇所に出るので getAllByText で複数許容
    expect(screen.getAllByText(/隠れ家カフェ/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ward 5/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 12/)).toBeInTheDocument();
  });

  it('tags が表示される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    expect(screen.getByText('和風')).toBeInTheDocument();
    expect(screen.getByText('カフェ')).toBeInTheDocument();
  });

  it('ActionBar が描画される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    expect(screen.getByTestId('action-bar-mock')).toBeInTheDocument();
  });

  it('roomNumber がある場合は Room も表示される', () => {
    const withRoom = { ...listing, roomKind: 'private_chamber', roomNumber: 7 };
    render(<HousingDetailContent listing={withRoom} viewerUid={null} />);
    expect(screen.getByText(/Room 7/)).toBeInTheDocument();
  });
});
