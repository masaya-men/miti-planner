// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterTagPicker } from '../../components/housing/register/HousingRegisterTagPicker';

describe('HousingRegisterTagPicker', () => {
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
});
