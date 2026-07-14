// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// LoginModal は useAuthStore → firebase/auth に到達するため、テスト用 stub を用意
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
  OAuthProvider: vi.fn(),
  TwitterAuthProvider: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  ensureAppCheck: () => null,
  getActiveAppCheck: () => null,
}));

import { HousingTabBar } from '../../components/housing/HousingTabBar';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('HousingTabBar', () => {
  it('3 つのタブを表示する', () => {
    renderWithRouter(<HousingTabBar activeTab="register" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /housing\.tabs\.search/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.tour/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.register/i })).toBeInTheDocument();
  });

  it('activeTab に aria-selected=true が付く', () => {
    renderWithRouter(<HousingTabBar activeTab="register" onChange={() => {}} />);
    const reg = screen.getByRole('tab', { name: /housing\.tabs\.register/i });
    expect(reg).toHaveAttribute('aria-selected', 'true');
  });

  it('クリックで onChange が呼ばれる', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const onChange = vi.fn();
    renderWithRouter(<HousingTabBar activeTab="register" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: /housing\.tabs\.search/i }));
    expect(onChange).toHaveBeenCalledWith('search');
  });
});
