// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HousingDetailContent } from '../HousingDetailContent';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ja' } }),
}));

// useNavigate だけ差し替え、他の react-router-dom export (MemoryRouter 等) は実物のまま使う。
// (HousingActionBar.test.tsx と同一パターン)
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

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

const renderContent = (props: Partial<React.ComponentProps<typeof HousingDetailContent>> = {}) =>
  render(
    <MemoryRouter>
      <HousingDetailContent listing={listing} viewerUid={null} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  // 既定はプロフィール非公開/未取得 (null)。 個人タグ chip は出ない状態。
  mockUseHousingerProfile.mockReset();
  mockUseHousingerProfile.mockReturnValue({ profile: null, loading: false });
  navigateMock.mockReset();
  useHousingFilterStore.getState().clearAll();
});

describe('HousingDetailContent', () => {
  it('description と address (ward, plot) が表示される', () => {
    renderContent();
    // description はタイトルと本文の 2 箇所に出るので getAllByText で複数許容
    expect(screen.getAllByText(/隠れ家カフェ/).length).toBeGreaterThanOrEqual(1);
    // 2026-05-26 多言語化 + formatHousingAddress 経由化: ja 表記は「ミスト・ヴィレッジ 5-12」
    // 2026-07-13 round2 b: title 未設定なので見出し(h2) + 住所行の両方に街区住所が出る (2回・合意済み)。
    expect(screen.getAllByText(/5-12/).length).toBe(2);
    expect(screen.getAllByText(/ミスト・ヴィレッジ/).length).toBe(2);
  });

  it('静的タグは i18nKey (housing.tag.<id>) 経由で表示される (生 id を出さない)', () => {
    renderContent();
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
    const { container } = renderContent({ listing: withPersonal });

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
    const { container } = renderContent({ listing: withPersonal });

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
    const { container } = renderContent({ listing: withLegacy });
    // 旧式生文字列 '和風' は解決できないので出さない。 静的タグ 1 件だけ残る。
    expect(screen.queryByText('和風')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.housing-detail-tags li')).toHaveLength(1);
  });

  it('ActionBar が描画される', () => {
    renderContent();
    expect(screen.getByTestId('action-bar-mock')).toBeInTheDocument();
  });

  // 2026-05-26: chamber (個室) 機能はα公開スコープ外。 formatHousingAddress も chamber を扱わない。
  // 将来対応時に再 enable。
  it.skip('roomNumber がある場合は Room も表示される (chamber 対応は将来実装)', () => {
    const withRoom = { ...listing, roomKind: 'private_chamber', roomNumber: 7 };
    renderContent({ listing: withRoom });
    expect(screen.getByText(/Room 7/)).toBeInTheDocument();
  });
});

// 2026-07-13 round2 b: タイトルを最上部に (街区住所は必ず残す)
describe('HousingDetailContent: b タイトル最上部', () => {
  it('title 設定時は見出しに title、住所行に街区住所とDC/ワールドが残る', () => {
    const withTitle = { ...listing, title: 'かわいい和風の家' };
    const { container } = renderContent({ listing: withTitle });

    const heading = container.querySelector('.housing-detail-title');
    expect(heading?.textContent).toBe('かわいい和風の家');

    const addressLine = container.querySelector('.housing-detail-address');
    expect(addressLine?.textContent).toContain('5-12');
    expect(addressLine?.textContent).toContain('ミスト・ヴィレッジ');
    expect(addressLine?.textContent).toContain('Mana');
    expect(addressLine?.textContent).toContain('Anima');
  });

  it('title 未設定時は見出し=住所、住所行にも住所が出る (2回・合意済み)', () => {
    const { container } = renderContent();

    const heading = container.querySelector('.housing-detail-title');
    expect(heading?.textContent).toContain('5-12');
    expect(heading?.textContent).toContain('ミスト・ヴィレッジ');

    const addressLine = container.querySelector('.housing-detail-address');
    expect(addressLine?.textContent).toContain('5-12');
  });

  it('title が空白のみの場合は住所にフォールバックする (trim 後 falsy)', () => {
    const blankTitle = { ...listing, title: '   ' };
    const { container } = renderContent({ listing: blankTitle });

    const heading = container.querySelector('.housing-detail-title');
    expect(heading?.textContent).toContain('5-12');
  });
});

// 2026-07-13 round2 a: 詳細タグをクリックで探すへ絞り込み遷移
describe('HousingDetailContent: a タグクリックで絞り込み', () => {
  it('静的タグをクリックすると toggleTag(id) が呼ばれ /housing へ navigate する', () => {
    renderContent();
    const btn = screen.getByRole('button', { name: 'housing.tag.theme_wafu' });
    fireEvent.click(btn);

    expect(useHousingFilterStore.getState().tags).toContain('theme_wafu');
    expect(navigateMock).toHaveBeenCalledWith('/housing');
  });

  it('個人タグをクリックしても toggleTag(id) (生 personal_ 形式) が呼ばれる', () => {
    mockUseHousingerProfile.mockReturnValue({
      profile: { displayName: 'ネコ好き太郎', isPublished: true },
      loading: false,
    });
    const withPersonal = { ...listing, tags: ['theme_wafu', 'personal_neko1'] };
    renderContent({ listing: withPersonal });

    const btn = screen.getByRole('button', { name: 'ネコ好き太郎' });
    fireEvent.click(btn);

    expect(useHousingFilterStore.getState().tags).toContain('personal_neko1');
    expect(navigateMock).toHaveBeenCalledWith('/housing');
  });

  it('タグは <li><button type="button" class="housing-detail-tag-btn"> 構造でレンダリングされる', () => {
    const { container } = renderContent();
    const btn = container.querySelector('.housing-detail-tags li button.housing-detail-tag-btn');
    expect(btn).toBeInTheDocument();
    expect(btn?.getAttribute('type')).toBe('button');
  });
});
