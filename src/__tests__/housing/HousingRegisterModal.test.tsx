// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingRegisterModal } from '../../components/housing/workspace/HousingRegisterModal';

beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        addListener: vi.fn(), removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const authState: { user: { uid: string } | null } = { user: { uid: 'test-uid' } };
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

vi.mock('../../components/housing/register/HousingRegisterView', () => ({
  HousingRegisterView: () => <div data-testid="register-view" />,
}));
vi.mock('../../components/LoginModal', () => ({
  LoginModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal" /> : null,
}));

describe('HousingRegisterModal', () => {
  beforeEach(() => {
    authState.user = { uid: 'test-uid' };
  });

  it('renders nothing when closed', () => {
    const { container } = render(<HousingRegisterModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the HousingRegisterView when open and user is logged in', () => {
    render(<HousingRegisterModal open={true} onClose={() => {}} />);
    expect(screen.getByTestId('register-view')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('shows the login-required prompt when user is logged out, and opens LoginModal on click', () => {
    authState.user = null;
    render(<HousingRegisterModal open={true} onClose={() => {}} />);
    expect(screen.getByText('housing.workspace.register_modal.login_required')).toBeInTheDocument();
    fireEvent.click(screen.getByText('housing.workspace.register_modal.login_button'));
    expect(screen.getByTestId('login-modal')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<HousingRegisterModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('housing.workspace.register_modal.close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
