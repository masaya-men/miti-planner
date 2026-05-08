// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/housingApiClient', () => ({
  canRegister: vi.fn(),
  registerListing: vi.fn(),
  checkDuplicate: vi.fn(),
  QuotaExhaustedError: class extends Error {},
}));

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  db: {},
  appCheck: Promise.resolve({}),
}));

// HousingLoginPrompt は LoginModal → useAuthStore を import する。
// 認証済みケースでは Prompt は描画されないが、import は走るので
// firebase/auth と firestore の最小スタブを用意して useAuthStore を読み込めるようにする。
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

import { HousingRegisterView } from '../../components/housing/register/HousingRegisterView';
import * as api from '../../lib/housingApiClient';

beforeEach(() => {
  vi.mocked(api.canRegister).mockReset();
  vi.mocked(api.registerListing).mockReset();
  vi.mocked(api.checkDuplicate).mockReset();
});

describe('HousingRegisterView', () => {
  it('マウント時に canRegister を呼ぶ', async () => {
    vi.mocked(api.canRegister).mockResolvedValueOnce({
      allowed: true, reason: null, registrationCount: 0, remaining: 5, lastReset: 0,
    });
    render(<HousingRegisterView />);
    await waitFor(() => expect(api.canRegister).toHaveBeenCalled());
  });

  it('正規入力 + 重複なしで registerListing が呼ばれる', async () => {
    const user = userEvent.setup();
    vi.mocked(api.canRegister).mockResolvedValue({
      allowed: true, reason: null, registrationCount: 0, remaining: 5, lastReset: 0,
    });
    vi.mocked(api.checkDuplicate).mockResolvedValue({ duplicates: [] });
    vi.mocked(api.registerListing).mockResolvedValue({ id: 'l1', addressKey: 'k' });

    render(<HousingRegisterView />);
    await waitFor(() => expect(api.canRegister).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/housing\.register\.dc/i), 'Mana');
    await waitFor(() => screen.getByLabelText(/housing\.register\.server/i));
    await user.selectOptions(screen.getByLabelText(/housing\.register\.server/i), 'Pandaemonium');
    await user.selectOptions(screen.getByLabelText(/housing\.register\.area/i), 'Shirogane');
    await user.clear(screen.getByLabelText(/housing\.register\.ward/i));
    await user.type(screen.getByLabelText(/housing\.register\.ward/i), '3');
    await user.clear(screen.getByLabelText(/housing\.register\.plot/i));
    await user.type(screen.getByLabelText(/housing\.register\.plot/i), '12');
    await user.click(screen.getAllByRole('button', { name: /housing\.tag\.modern/i })[0]);
    await user.click(screen.getByRole('button', { name: /housing\.register\.submit/i }));

    await waitFor(() => expect(api.registerListing).toHaveBeenCalled());
  });

  it('quota_exhausted のときフォーム送信ボタンが無効化される', async () => {
    vi.mocked(api.canRegister).mockResolvedValueOnce({
      allowed: false, reason: 'quota_exhausted', registrationCount: 31, remaining: 0, lastReset: 0,
    });
    render(<HousingRegisterView />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /housing\.register\.submit/i });
      expect(btn).toBeDisabled();
    });
  });
});
