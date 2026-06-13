// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppFooter } from '../AppFooter';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../PulseSettings', () => ({ PulseSettings: () => null }));

describe('AppFooter', () => {
  it('著作権/免責と法的情報トグルを表示する', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>);
    // copyright はテキストノードとして <p> 内に存在。フッター全体のテキストに含まれることを確認
    expect(screen.getByRole('contentinfo').textContent).toContain('footer.copyright');
    // legal はボタン要素として独立して存在
    expect(screen.getByText('footer.legal')).toBeInTheDocument();
  });
  it('法的情報を押すとプライバシー/利用規約リンクが出る', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>);
    fireEvent.click(screen.getByText('footer.legal'));
    expect(screen.getByText('footer.privacy_policy')).toBeInTheDocument();
    expect(screen.getByText('footer.terms')).toBeInTheDocument();
  });
});
