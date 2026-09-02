// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HousingActionBar } from '../HousingActionBar';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';

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

// HousingShareButton は実際には title を DOM テキストに出さない (navigator.share / twitter intent
// URL に渡すだけ) ため、 titleForShare の配線 (addressKey 漏洩防止) を検証するには title を
// data 属性で観測できるスタブに差し替える必要がある (aria-label は既存アサーションを壊さないよう維持)。
vi.mock('../HousingShareButton', () => ({
  HousingShareButton: ({
    title,
    sourceUrl,
    tweetText,
  }: {
    title: string;
    sourceUrl?: string | null;
    tweetText?: string | null;
  }) => (
    <button
      type="button"
      aria-label="housing.detail.share"
      data-share-title={title ?? ''}
      data-share-source-url={sourceUrl ?? ''}
      data-share-tweet-text={tweetText === null ? '__null__' : (tweetText ?? '__undefined__')}
    >
      housing.detail.share
    </button>
  ),
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
    useTourTrayStore.setState({ trayIds: [], pinnedIds: [] });
    useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  });

  // 実機FB②: 探すページのカードはスペース不足でボタンを置けないため、詳細ページにも
  // ツアー追加ボタンを追加した (BrowsePage.addToTray と同じロジック)。
  it('「＋ツアー」ボタンを押すと listing.id がトレイに積まれる', () => {
    renderBar({ viewerUid: null });
    fireEvent.click(screen.getByRole('button', { name: 'housing.card.add_to_tour' }));
    expect(useTourTrayStore.getState().trayIds).toEqual([baseListing.id]);
  });

  // 実機FB②訂正: 操作バーの他ボタンは短い表記のため、カードと同じ「ツアーに追加」だと
  // 列がずれる。表示文言は短縮した「ツアー」にし、アクセシブルネームだけ完全な文言にする。
  it('追加成功で「追加済み」表示になりaria-pressedがtrueになる', () => {
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('housing.card.added_to_tour');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('追加済みの状態でもう一度押すとトレイから外れる', () => {
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn); // 追加
    fireEvent.click(btn); // 外す
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('別リージョンのためブロックされたときはトレイに積まれず吹き出しが出る(下中央トーストは出ない想定)', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [] });
    // baseListing.dc === 'Mana' → region 'JP'。'NA' とはブロックされる組み合わせ。
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn);
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
    expect(screen.getByTestId('housing-tour-error-bubble')).toBeInTheDocument();
  });

  it('見た目の文言は短縮した「ツアー」で、アクセシブルネームは完全な文言になる', () => {
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    expect(btn.textContent).toContain('housing.detail.add_to_tour');
    expect(btn.textContent).not.toContain('housing.card.add_to_tour');
  });

  it('unlisted の物件では「＋ツアーに追加」ボタンが disabled になる (住所非公開でツアーに使えない)', () => {
    const unlisted = {
      ...baseListing,
      visibility: 'unlisted',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: null, listing: unlisted });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
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

  // P3 §3.5/Task6 (防御多重化): unlisted は addressKey (住所) をシェアタイトルに絶対出さない。
  it('unlisted かつ description 未設定のとき、シェアタイトルは addressKey ではなく既定文言 (LoPo Housing) になる', () => {
    const unlistedNoDescription = {
      ...baseListing,
      visibility: 'unlisted',
      description: undefined,
      addressKey: 'Mist Ward 5 Plot 12',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: unlistedNoDescription });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareTitle).toBe('LoPo Housing');
    expect(shareButton.dataset.shareTitle).not.toContain('Mist Ward 5 Plot 12');
  });

  // 対照実験: public/private (住所非公開でない) では従来どおり addressKey が使われる
  // (description 未設定時のフォールバック挙動は不変であることの証明)。
  it('public かつ description 未設定のとき、シェアタイトルは addressKey になる (回帰確認)', () => {
    const publicNoDescription = {
      ...baseListing,
      visibility: 'public',
      description: undefined,
      addressKey: 'Mist Ward 5 Plot 12',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: publicNoDescription });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareTitle).toBe('Mist Ward 5 Plot 12');
  });

  // FB第6弾#4#5: HousingShareButton へ listing.postUrl を sourceUrl として配線する。
  it('imageMode===sns で postUrl があるとき、 HousingShareButton に sourceUrl として渡す', () => {
    const snsListing = {
      ...baseListing,
      imageMode: 'sns',
      postUrl: 'https://twitter.com/someone/status/123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: snsListing });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareSourceUrl).toBe('https://twitter.com/someone/status/123');
  });

  it('postUrl が無いとき、 HousingShareButton の sourceUrl は空になる', () => {
    renderBar({ viewerUid: 'owner1' });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareSourceUrl).toBe('');
  });

  // follow-up改良2(ユーザーFB): 物件詳細のXシェアは本文テキストなし。
  // tweetText=null を明示的に HousingShareButton へ配線していることを検証する。
  it('HousingShareButton へ tweetText=null を渡す (本文テキストなし)', () => {
    renderBar({ viewerUid: 'owner1' });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareTweetText).toBe('__null__');
  });

  // Task 5: Batch2 複数投稿URL。sourcePostUrls[0] を優先して sourceUrl に配線する。
  it('sourcePostUrls があり postUrl が無いとき、 HousingShareButton に sourcePostUrls[0] を sourceUrl として渡す', () => {
    const multiUrlListing = {
      ...baseListing,
      sourcePostUrls: ['https://youtu.be/abc123', 'https://youtube.com/watch?v=def456'],
      postUrl: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: multiUrlListing });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareSourceUrl).toBe('https://youtu.be/abc123');
  });

  it('sourcePostUrls が空配列でも postUrl があるとき、 postUrl を sourceUrl として使う (フォールバック)', () => {
    const fallbackListing = {
      ...baseListing,
      sourcePostUrls: [],
      postUrl: 'https://twitter.com/user/status/999',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: fallbackListing });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareSourceUrl).toBe('https://twitter.com/user/status/999');
  });

  it('sourcePostUrls と postUrl 両方が無いとき、 sourceUrl は空になる', () => {
    const noUrlListing = {
      ...baseListing,
      sourcePostUrls: undefined,
      postUrl: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    renderBar({ viewerUid: 'owner1', listing: noUrlListing });
    const shareButton = screen.getByRole('button', { name: 'housing.detail.share' });
    expect(shareButton.dataset.shareSourceUrl).toBe('');
  });
});
