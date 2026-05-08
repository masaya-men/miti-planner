// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterDescriptionField } from '../../components/housing/register/HousingRegisterDescriptionField';

describe('HousingRegisterDescriptionField', () => {
  it('テキスト入力で onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterDescriptionField value="" onChange={onChange} error={undefined} />);
    await user.type(screen.getByRole('textbox'), 'h');
    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('残り文字数を表示 (200-入力長)', () => {
    render(<HousingRegisterDescriptionField value={'あ'.repeat(50)} onChange={() => {}} error={undefined} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('error があればエラー文を表示', () => {
    render(<HousingRegisterDescriptionField value="" onChange={() => {}} error="too_long" />);
    expect(screen.getByText(/housing\.register\.errors\.description\.too_long/i)).toBeInTheDocument();
  });
});
