// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  HousingOnboardingDialog,
  hasSeenHousingOnboarding,
  markHousingOnboardingSeen,
} from '../../components/housing/HousingOnboardingDialog';

beforeEach(() => {
  localStorage.clear();
});

describe('hasSeenHousingOnboarding', () => {
  it('未閲覧なら false', () => {
    expect(hasSeenHousingOnboarding()).toBe(false);
  });
  it('mark 後は true', () => {
    markHousingOnboardingSeen();
    expect(hasSeenHousingOnboarding()).toBe(true);
  });
});

describe('HousingOnboardingDialog', () => {
  it('open=true で表示される', () => {
    render(<HousingOnboardingDialog open={true} onClose={() => {}} />);
    expect(screen.getByText(/housing\.onboarding\.title/i)).toBeInTheDocument();
  });
  it('open=false で表示されない', () => {
    render(<HousingOnboardingDialog open={false} onClose={() => {}} />);
    expect(screen.queryByText(/housing\.onboarding\.title/i)).not.toBeInTheDocument();
  });
  it('「はじめる」で onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HousingOnboardingDialog open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /housing\.onboarding\.start/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
