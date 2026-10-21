// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HeaderLogo } from '../HeaderLogo';

const Where = () => <span data-testid="loc">{useLocation().pathname}</span>;

describe('HeaderLogo', () => {
  it('ホームへ戻るボタン(aria-label)・走るハイライト・MIL-SPEC・H1 を出す', () => {
    const { container, getByRole } = render(<MemoryRouter><HeaderLogo /></MemoryRouter>);
    const b = getByRole('button', { name: 'app.return_home' });
    expect(b.className).toContain('milspec-logo');
    expect(b.querySelector('span.milspec-logo-sweep')).not.toBeNull();
    expect(container.textContent).toContain('MIL-SPEC');
    expect(container.textContent).toContain('H1');
  });

  it('押すと / へ移動する', () => {
    const { getByRole, getByTestId } = render(
      <MemoryRouter initialEntries={['/miti']}>
        <Routes><Route path="*" element={<><HeaderLogo /><Where /></>} /></Routes>
      </MemoryRouter>,
    );
    expect(getByTestId('loc').textContent).toBe('/miti');
    fireEvent.click(getByRole('button', { name: 'app.return_home' }));
    expect(getByTestId('loc').textContent).toBe('/');
  });
});
