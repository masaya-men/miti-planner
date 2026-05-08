// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HousingTabBar } from '../../components/housing/HousingTabBar';

describe('HousingTabBar', () => {
  it('3 つのタブを表示する', () => {
    render(<HousingTabBar activeTab="register" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /housing\.tabs\.search/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.tour/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.register/i })).toBeInTheDocument();
  });

  it('activeTab に aria-selected=true が付く', () => {
    render(<HousingTabBar activeTab="register" onChange={() => {}} />);
    const reg = screen.getByRole('tab', { name: /housing\.tabs\.register/i });
    expect(reg).toHaveAttribute('aria-selected', 'true');
  });

  it('クリックで onChange が呼ばれる', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const onChange = vi.fn();
    render(<HousingTabBar activeTab="register" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: /housing\.tabs\.search/i }));
    expect(onChange).toHaveBeenCalledWith('search');
  });
});
