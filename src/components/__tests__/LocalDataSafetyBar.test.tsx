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

import { LocalDataSafetyBar } from '../LocalDataSafetyBar';

describe('LocalDataSafetyBar', () => {
  beforeEach(() => {
    localStorage.clear();
    authUser = null;
    planCount = 0;
  });

  it('ログイン中は表示しない', () => {
    authUser = { uid: 'x' };
    planCount = 3;
    const { container } = render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログインでも表0件なら表示しない', () => {
    authUser = null;
    planCount = 0;
    const { container } = render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログイン且つ表1件以上で表示する', () => {
    authUser = null;
    planCount = 1;
    render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(screen.getByText('local_safety.bar.label')).toBeTruthy();
  });

  it('未読なら赤ドット(testid)を出し、クリックで消える', () => {
    authUser = null;
    planCount = 1;
    render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(screen.getByTestId('local-safety-unread-dot')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /local_safety.bar.aria/i }));
    expect(screen.queryByTestId('local-safety-unread-dot')).toBeNull();
  });
});
