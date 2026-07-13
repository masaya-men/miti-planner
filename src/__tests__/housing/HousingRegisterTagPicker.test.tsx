// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterTagPicker } from '../../components/housing/register/HousingRegisterTagPicker';
import { useHousingModalStore } from '../../store/useHousingModalStore';

const getMyPersonalTagMock = vi.fn();
vi.mock('../../lib/personalTagApiClient', () => ({
  getMyPersonalTag: (...args: unknown[]) => getMyPersonalTagMock(...args),
}));

describe('HousingRegisterTagPicker', () => {
  beforeEach(() => {
    getMyPersonalTagMock.mockReset();
    getMyPersonalTagMock.mockResolvedValue(null);
    useHousingModalStore.setState({ account: { open: false } });
  });

  it('静的 kind (公式/季節/テーマ) の見出しを表示する', () => {
    render(<HousingRegisterTagPicker selected={[]} onChange={() => {}} />);
    expect(screen.getByText(/housing\.register\.tag_kind\.official/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_kind\.season/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_kind\.theme/i)).toBeInTheDocument();
  });

  it('タグをクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getAllByRole('button', { name: /housing\.tag\.official_emporium/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['official_emporium']);
  });

  it('5 件選択済みなら未選択タグが disabled になる (検索経由で可視化)', async () => {
    const user = userEvent.setup();
    render(
      <HousingRegisterTagPicker
        selected={[
          'official_emporium', 'official_boutique', 'official_cafe',
          'season_spring', 'season_summer',
        ]}
        onChange={() => {}}
      />,
    );
    // 新 UI では kind タブ式のため、 デフォルトでは official タブの "theme_modern" は隠れる。
    // 検索ボックスに入れてフィルタすれば全 kind 横断で出てくる。
    await user.type(screen.getByPlaceholderText(/housing\.register\.tag_search_placeholder/i), 'theme_modern');
    const modernBtn = screen.getAllByRole('button', { name: /housing\.tag\.theme_modern/i })[0];
    expect(modernBtn).toBeDisabled();
  });

  it('既選択タグは × で削除できる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={['official_emporium']} onChange={onChange} />);
    const removeBtn = screen.getByRole('button', { name: /housing\.register\.remove_tag/i });
    await user.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  describe('個人タブ', () => {
    it('未公開ユーザーには公開を促すヒント + 公開設定を開くボタンを表示する (作成フォームは出さない)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      getMyPersonalTagMock.mockResolvedValue(null);

      render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
      await user.click(screen.getByText(/housing\.register\.tag_kind\.personal/i));

      await waitFor(() => {
        expect(screen.getByText(/housing\.register\.personal_tag\.not_published_hint/i)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('housing-personal-tag-name-input')).not.toBeInTheDocument();

      expect(useHousingModalStore.getState().account.open).toBe(false);
      await user.click(screen.getByRole('button', { name: /housing\.register\.personal_tag\.open_account_settings/i }));
      expect(useHousingModalStore.getState().account.open).toBe(true);
    });

    it('取得済みタグが isHidden (未公開/運営非表示) なら未公開扱いのヒントを出す', async () => {
      const user = userEvent.setup();
      getMyPersonalTagMock.mockResolvedValue({
        id: 'personal_abc123', displayName: 'yuura', displayNameLower: 'yuura',
        ownerUid: 'u1', createdAt: 0, reportCount: 0, isHidden: true,
      });

      render(<HousingRegisterTagPicker selected={[]} onChange={() => {}} />);
      await user.click(screen.getByText(/housing\.register\.tag_kind\.personal/i));

      await waitFor(() => {
        expect(screen.getByText(/housing\.register\.personal_tag\.not_published_hint/i)).toBeInTheDocument();
      });
    });

    it('作成済みなら自分のタグをトグル可能なボタンとして表示する', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      getMyPersonalTagMock.mockResolvedValue({
        id: 'personal_yuura_ab12cd', displayName: 'yuura', displayNameLower: 'yuura',
        ownerUid: 'u1', createdAt: 0, reportCount: 0, isHidden: false,
      });

      render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
      await user.click(screen.getByText(/housing\.register\.tag_kind\.personal/i));

      const optionBtn = await screen.findByRole('button', { name: 'yuura' });
      await user.click(optionBtn);
      expect(onChange).toHaveBeenCalledWith(['personal_yuura_ab12cd']);
    });

    it('選択済みの自分のタグは選択チップとして表示され × で削除できる', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      getMyPersonalTagMock.mockResolvedValue({
        id: 'personal_yuura_ab12cd', displayName: 'yuura', displayNameLower: 'yuura',
        ownerUid: 'u1', createdAt: 0, reportCount: 0, isHidden: false,
      });

      render(<HousingRegisterTagPicker selected={['personal_yuura_ab12cd']} onChange={onChange} />);

      const removeBtn = await screen.findByRole('button', { name: /housing\.register\.remove_tag/i });
      await user.click(removeBtn);
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
