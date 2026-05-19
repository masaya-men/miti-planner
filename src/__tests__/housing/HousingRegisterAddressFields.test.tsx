// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterAddressFields } from '../../components/housing/register/HousingRegisterAddressFields';

const baseValue = {
  dc: '', server: '', area: '' as never,
  ward: 1, buildingType: 'house' as const,
  plot: 1, size: 'M' as const,
};

describe('HousingRegisterAddressFields', () => {
  it('全フィールドが描画される', () => {
    render(<HousingRegisterAddressFields value={baseValue} onChange={() => {}} errors={{}} />);
    expect(screen.getByLabelText(/housing\.register\.dc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.server/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.area/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.ward/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.plot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.size/i)).toBeInTheDocument();
  });

  // アパート個室 UI は Sub-spec 2B で実装予定のためスキップ
  it.skip('size=Apartment を選択すると apartmentRoom フィールドが表示される', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterAddressFields value={baseValue} onChange={onChange} errors={{}} />);
    expect(screen.queryByLabelText(/housing\.register\.apartment_room/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/housing\.register\.size/i), 'Apartment');
    expect(onChange).toHaveBeenCalled();
  });

  it('errors.ward があるとエラーメッセージが出る', () => {
    render(<HousingRegisterAddressFields value={baseValue} onChange={() => {}} errors={{ ward: 'out_of_range' }} />);
    expect(screen.getByText(/housing\.register\.errors\.ward\.out_of_range/i)).toBeInTheDocument();
  });

  it('DC を選ぶとサーバーリストが絞り込まれる', async () => {
    const onChange = vi.fn();
    render(<HousingRegisterAddressFields value={{ ...baseValue, dc: 'Mana' }} onChange={onChange} errors={{}} />);
    const serverSelect = screen.getByLabelText(/housing\.register\.server/i) as HTMLSelectElement;
    const options = Array.from(serverSelect.options).map((o) => o.value);
    expect(options).toContain('Pandaemonium');
    expect(options).not.toContain('Aegis');
  });
});
