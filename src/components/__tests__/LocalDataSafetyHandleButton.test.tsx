// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authUser: unknown = null;
let planCount = 0;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) => sel({ user: authUser }),
}));
vi.mock('../../store/usePlanStore', () => ({
  usePlanStore: (sel: (s: { plans: unknown[] }) => unknown) =>
    sel({ plans: Array.from({ length: planCount }, () => ({})) }),
}));

import { LocalDataSafetyHandleButton } from '../LocalDataSafetyHandleButton';
import { useLocalSafetySeenStore } from '../../store/useLocalSafetySeenStore';

describe('LocalDataSafetyHandleButton', () => {
  beforeEach(() => {
    localStorage.clear();
    useLocalSafetySeenStore.setState({ seen: false });
    authUser = null;
    planCount = 0;
  });

  it('ログイン中は表示しない', () => {
    authUser = { uid: 'x' };
    planCount = 3;
    const { container } = render(<LocalDataSafetyHandleButton onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログインでも表0件なら表示しない', () => {
    planCount = 0;
    const { container } = render(<LocalDataSafetyHandleButton onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('既読(seen)なら表示しない（赤バッジがある時のみ出す）', () => {
    planCount = 1;
    useLocalSafetySeenStore.setState({ seen: true });
    const { container } = render(<LocalDataSafetyHandleButton onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログイン且つ表あり且つ未読のとき表示し、クリックで既読化して消える', () => {
    planCount = 1;
    render(<LocalDataSafetyHandleButton onOpenBackup={() => {}} />);
    const btn = screen.getByRole('button', { name: /local_safety.bar.aria/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    // 既読化 → 条件を満たさなくなりボタンが消える
    expect(screen.queryByRole('button', { name: /local_safety.bar.aria/i })).toBeNull();
  });
});
