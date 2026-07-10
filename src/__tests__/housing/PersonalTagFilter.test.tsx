// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonalTagFilter } from '../../components/housing/workspace/PersonalTagFilter';

const searchPersonalTagsMock = vi.fn();
const reportPersonalTagMock = vi.fn();
vi.mock('../../lib/personalTagApiClient', () => ({
  searchPersonalTags: (...args: unknown[]) => searchPersonalTagsMock(...args),
  reportPersonalTag: (...args: unknown[]) => reportPersonalTagMock(...args),
}));

const TAG = {
  id: 'personal_yuura_ab12cd',
  displayName: 'yuura',
  displayNameLower: 'yuura',
  ownerUid: 'u1',
  createdAt: 0,
  reportCount: 0,
  isHidden: false,
};

describe('PersonalTagFilter', () => {
  beforeEach(() => {
    searchPersonalTagsMock.mockReset();
    reportPersonalTagMock.mockReset();
    searchPersonalTagsMock.mockResolvedValue([TAG]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('検索クエリを入力すると結果が表示され、 クリックで onToggle が呼ばれる', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PersonalTagFilter selected={[]} onToggle={onToggle} />);

    await user.type(
      screen.getByPlaceholderText(/housing\.workspace\.filter\.personal_tag_placeholder/i),
      'yuu',
    );

    await waitFor(() => {
      expect(searchPersonalTagsMock).toHaveBeenCalledWith('yuu');
    });

    const resultBtn = await screen.findByRole('button', { name: 'yuura' });
    await user.click(resultBtn);
    expect(onToggle).toHaveBeenCalledWith('personal_yuura_ab12cd');
  });

  it('選択済みタグは選択チップとして表示され × で削除できる (onToggle 経由)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PersonalTagFilter selected={['personal_yuura_ab12cd']} onToggle={onToggle} />);

    // 検索していないので label キャッシュが無く、 id がそのまま表示される (フォールバック)。
    const chip = screen.getByText('personal_yuura_ab12cd');
    expect(chip).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: /housing\.register\.remove_tag/i });
    await user.click(removeBtn);
    expect(onToggle).toHaveBeenCalledWith('personal_yuura_ab12cd');
  });

  it('通報ボタンをクリックすると confirm 後に reportPersonalTag が呼ばれる', async () => {
    const user = userEvent.setup();
    render(<PersonalTagFilter selected={[]} onToggle={() => {}} />);

    await user.type(
      screen.getByPlaceholderText(/housing\.workspace\.filter\.personal_tag_placeholder/i),
      'yuu',
    );
    const reportBtn = await screen.findByText(/housing\.workspace\.filter\.personal_tag_report$/i);
    await user.click(reportBtn);

    await waitFor(() => {
      expect(reportPersonalTagMock).toHaveBeenCalledWith('personal_yuura_ab12cd');
    });
  });

  it('該当なしのときは no_results メッセージを出す', async () => {
    searchPersonalTagsMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<PersonalTagFilter selected={[]} onToggle={() => {}} />);

    await user.type(
      screen.getByPlaceholderText(/housing\.workspace\.filter\.personal_tag_placeholder/i),
      'nobody',
    );

    await waitFor(() => {
      expect(screen.getByText(/housing\.workspace\.filter\.personal_tag_no_results/i)).toBeInTheDocument();
    });
  });
});
