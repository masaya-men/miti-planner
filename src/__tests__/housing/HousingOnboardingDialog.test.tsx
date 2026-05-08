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

describe('HousingOnboardingDialog (mode=anonymous)', () => {
  it('open=true で表示される', () => {
    render(
      <HousingOnboardingDialog open={true} onClose={() => {}} mode="anonymous" />
    );
    expect(screen.getByText(/housing\.onboarding\.title/i)).toBeInTheDocument();
  });

  it('open=false で表示されない', () => {
    render(
      <HousingOnboardingDialog open={false} onClose={() => {}} mode="anonymous" />
    );
    expect(screen.queryByText(/housing\.onboarding\.title/i)).not.toBeInTheDocument();
  });

  it('「はじめる」ボタンで onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <HousingOnboardingDialog open={true} onClose={onClose} mode="anonymous" />
    );
    await user.click(screen.getByRole('button', { name: /housing\.onboarding\.start/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('HousingOnboardingDialog (mode=authenticated)', () => {
  it('2 ボタンが表示される', () => {
    render(
      <HousingOnboardingDialog
        open={true}
        onClose={() => {}}
        mode="authenticated"
        onAcceptCurrentAccount={() => {}}
        onSwitchAccount={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: /housing\.onboarding\.accept_current_account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /housing\.onboarding\.switch_account/i })
    ).toBeInTheDocument();
  });

  it('「このアカウントで始める」で onAcceptCurrentAccount が呼ばれる', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <HousingOnboardingDialog
        open={true}
        onClose={() => {}}
        mode="authenticated"
        onAcceptCurrentAccount={onAccept}
        onSwitchAccount={() => {}}
      />
    );
    await user.click(
      screen.getByRole('button', { name: /housing\.onboarding\.accept_current_account/i })
    );
    expect(onAccept).toHaveBeenCalled();
  });

  it('「別のアカウントでログインし直す」で onSwitchAccount が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <HousingOnboardingDialog
        open={true}
        onClose={() => {}}
        mode="authenticated"
        onAcceptCurrentAccount={() => {}}
        onSwitchAccount={onSwitch}
      />
    );
    await user.click(
      screen.getByRole('button', { name: /housing\.onboarding\.switch_account/i })
    );
    expect(onSwitch).toHaveBeenCalled();
  });
});
