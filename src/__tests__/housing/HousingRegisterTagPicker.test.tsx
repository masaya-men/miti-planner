// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterTagPicker } from '../../components/housing/register/HousingRegisterTagPicker';

describe('HousingRegisterTagPicker', () => {
  it('全 6 カテゴリ見出しを表示する', () => {
    render(<HousingRegisterTagPicker selected={[]} onChange={() => {}} />);
    expect(screen.getByText(/housing\.register\.tag_category\.taste/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.scene/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.season/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.environment/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.structure/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.other/i)).toBeInTheDocument();
  });

  it('タグをクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getAllByRole('button', { name: /housing\.tag\.modern/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['modern']);
  });

  it('5 件選択済みなら未選択タグが disabled になる (検索経由で可視化)', async () => {
    const user = userEvent.setup();
    render(
      <HousingRegisterTagPicker
        selected={['modern', 'cafe', 'wafu', 'spring', 'summer']}
        onChange={() => {}}
      />,
    );
    // 新 UI ではカテゴリタブ式のため、 デフォルトでは season カテゴリ "winter" は隠れる。
    // 検索ボックスに入れてフィルタすれば全カテゴリ横断で出てくる。
    await user.type(screen.getByPlaceholderText(/housing\.register\.tag_search_placeholder/i), 'winter');
    const winterBtn = screen.getAllByRole('button', { name: /housing\.tag\.winter/i })[0];
    expect(winterBtn).toBeDisabled();
  });

  it('既選択タグは × で削除できる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={['modern']} onChange={onChange} />);
    const removeBtn = screen.getByRole('button', { name: /housing\.register\.remove_tag/i });
    await user.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
