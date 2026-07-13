// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
// byline は react-router-dom の <Link> を張るため、 Router を用意しなくて済むよう空モック。
// タグの個人名解決は HousingDetailContent 自身が useHousingerProfile を呼ぶので、 byline を
// 潰してもタグ経路の検証には影響しない。
vi.mock('../../housinger/HousingerByline', () => ({
  HousingerByline: () => null,
}));

// タグの個人名解決に使うプロフィール hook をモックで制御する (getHousingerProfile へ実接続しない)。
const mockUseHousingerProfile = vi.fn();
vi.mock('../../housinger/useHousingerProfile', () => ({
  useHousingerProfile: (uid: string | null) => mockUseHousingerProfile(uid),
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
  // 静的タグ id (テーマ + 公式) を使用。 表示は i18nKey (housing.tag.<id>) 経由。
  tags: ['theme_wafu', 'official_cafe'],
  description: '隠れ家カフェ',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  isHidden: false,
  reportCount: 0,
  deletedAt: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

beforeEach(() => {
  // 既定はプロフィール非公開/未取得 (null)。 個人タグ chip は出ない状態。
  mockUseHousingerProfile.mockReset();
  mockUseHousingerProfile.mockReturnValue({ profile: null, loading: false });
});

describe('HousingDetailContent', () => {
  it('description と address (ward, plot) が表示される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    // description はタイトルと本文の 2 箇所に出るので getAllByText で複数許容
    expect(screen.getAllByText(/隠れ家カフェ/).length).toBeGreaterThanOrEqual(1);
    // 2026-05-26 多言語化 + formatHousingAddress 経由化: ja 表記は「ミスト・ヴィレッジ 5-12」
    expect(screen.getByText(/5-12/)).toBeInTheDocument();
    expect(screen.getByText(/ミスト・ヴィレッジ/)).toBeInTheDocument();
  });

  it('静的タグは i18nKey (housing.tag.<id>) 経由で表示される (生 id を出さない)', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    // t モックは key をそのまま返すので、 解決後キーが描画される (生 id 'theme_wafu' 単体は出ない)。
    expect(screen.getByText('housing.tag.theme_wafu')).toBeInTheDocument();
    expect(screen.getByText('housing.tag.official_cafe')).toBeInTheDocument();
  });

  it('個人タグはオーナーの公開プロフィールがあれば displayName で表示される', () => {
    mockUseHousingerProfile.mockReturnValue({
      profile: { displayName: 'ネコ好き太郎', isPublished: true },
      loading: false,
    });
    const withPersonal = { ...listing, tags: ['theme_wafu', 'personal_neko1'] };
    const { container } = render(<HousingDetailContent listing={withPersonal} viewerUid={null} />);

    // 生キー (housing.tag.personal_neko1) や生 id は出さず、 displayName で表示。
    expect(screen.getByText('ネコ好き太郎')).toBeInTheDocument();
    expect(screen.queryByText('housing.tag.personal_neko1')).not.toBeInTheDocument();
    expect(screen.queryByText('personal_neko1')).not.toBeInTheDocument();
    // 静的タグ + 個人タグの 2 chip。
    expect(container.querySelectorAll('.housing-detail-tags li')).toHaveLength(2);
  });

  it('個人タグはオーナー非公開 (profile=null) のとき chip を出さない', () => {
    mockUseHousingerProfile.mockReturnValue({ profile: null, loading: false });
    const withPersonal = { ...listing, tags: ['theme_wafu', 'personal_neko1'] };
    const { container } = render(<HousingDetailContent listing={withPersonal} viewerUid={null} />);

    // 個人タグ chip は非表示 (byline も非公開時は消えるので整合)。 生 id/生キーも露出しない。
    expect(screen.queryByText('personal_neko1')).not.toBeInTheDocument();
    expect(screen.queryByText('housing.tag.personal_neko1')).not.toBeInTheDocument();
    // 残るのは静的タグ 1 件のみ。
    const chips = container.querySelectorAll('.housing-detail-tags li');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe('housing.tag.theme_wafu');
  });

  it('未知の旧 id は描画せずクラッシュしない (生 id を出さない)', () => {
    const withLegacy = { ...listing, tags: ['和風', 'theme_wafu'] };
    const { container } = render(<HousingDetailContent listing={withLegacy} viewerUid={null} />);
    // 旧式生文字列 '和風' は解決できないので出さない。 静的タグ 1 件だけ残る。
    expect(screen.queryByText('和風')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.housing-detail-tags li')).toHaveLength(1);
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
