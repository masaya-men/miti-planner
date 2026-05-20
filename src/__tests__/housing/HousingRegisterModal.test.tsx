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

  it('closes when clicking the backdrop itself (logged-in branch)', () => {
    const onClose = vi.fn();
    const { container } = render(<HousingRegisterModal open={true} onClose={onClose} />);
    const backdrop = container.querySelector('.housing-register-modal-backdrop')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT close when clicking inside the card (logged-in branch)', () => {
    const onClose = vi.fn();
    render(<HousingRegisterModal open={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('mode prop', () => {
    it("default (mode='create') では register_modal.title が表示される", () => {
      render(<HousingRegisterModal open={true} onClose={() => {}} />);
      expect(
        screen.getByText('housing.workspace.register_modal.title'),
      ).toBeInTheDocument();
    });

    it("mode='edit' では housing.edit.modal.title が表示される", () => {
      const initial = {
        id: 'lid1',
        dc: 'Mana',
        server: 'Anima',
        area: 'Mist' as const,
        ward: 5,
        buildingType: 'house' as const,
        plot: 12,
        size: 'M' as const,
        addressKey: 'mana-anima-mist-5-house-12',
        imageMode: 'none' as const,
        tags: ['和風'],
        ownerUid: 'test-uid',
        createdAt: 0,
        updatedAt: 0,
        isHidden: false,
        reportCount: 0,
        deletedAt: null,
      };
      render(
        <HousingRegisterModal
          open={true}
          onClose={() => {}}
          mode="edit"
          initialValues={initial}
        />,
      );
      expect(screen.getByText('housing.edit.modal.title')).toBeInTheDocument();
    });
  });
});
