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

// HousingShareButton は実際には title を DOM テキストに出さない (navigator.share / twitter intent
// URL に渡すだけ) ため、 titleForShare の配線 (addressKey 漏洩防止) を検証するには title を
// data 属性で観測できるスタブに差し替える必要がある (aria-label は既存アサーションを壊さないよう維持)。
vi.mock('../HousingShareButton', () => ({
  HousingShareButton: ({ title }: { title: string }) => (
    <button type="button" aria-label="housing.detail.share" data-share-title={title ?? ''}>
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
});
