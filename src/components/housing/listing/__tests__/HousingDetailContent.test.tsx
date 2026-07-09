// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDetailContent } from '../HousingDetailContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ja' } }),
}));

// 子コンポーネントの重い依存をモック
vi.mock('../HousingActionBar', () => ({
  HousingActionBar: () => <div data-testid="action-bar-mock" />,
}));
// Task 2.4: 地図は自身のテスト (HousingDetailMap.test.tsx) で担保済み。 useWardMapAsset の
// 非同期アセット読み込みに Content 単体テストを引きずられないよう薄くモックする。
vi.mock('../HousingDetailMap', () => ({
  HousingDetailMap: () => null,
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
    // 2026-05-26 多言語化 + formatHousingAddress 経由化: ja 表記は「ミスト・ヴィレッジ 5-12」
    expect(screen.getByText(/5-12/)).toBeInTheDocument();
    expect(screen.getByText(/ミスト・ヴィレッジ/)).toBeInTheDocument();
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

  // 2026-05-26: chamber (個室) 機能はα公開スコープ外。 formatHousingAddress も chamber を扱わない。
  // 将来対応時に再 enable。
  it.skip('roomNumber がある場合は Room も表示される (chamber 対応は将来実装)', () => {
    const withRoom = { ...listing, roomKind: 'private_chamber', roomNumber: 7 };
    render(<HousingDetailContent listing={withRoom} viewerUid={null} />);
    expect(screen.getByText(/Room 7/)).toBeInTheDocument();
  });
});
