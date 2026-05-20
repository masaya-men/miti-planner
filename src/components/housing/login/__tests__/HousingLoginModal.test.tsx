// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingLoginModal } from '../HousingLoginModal';

const mockSignInWith = vi.fn();

vi.mock('../../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn((sel: any) => sel({ signInWith: mockSignInWith })),
        { setState: vi.fn(), getState: vi.fn(() => ({ signInWith: mockSignInWith })) },
    ),
}));

vi.mock('../../../../store/useHousingModalStore', () => ({
    useHousingModalStore: Object.assign(
        vi.fn((sel: any) => sel({
            login: { open: true, fromRegister: false },
            closeLogin: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

describe('HousingLoginModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title and Discord button when open', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.login.title')).toBeInTheDocument();
        expect(screen.getByText('housing.login.discordButton')).toBeInTheDocument();
    });

    it('renders 3 notice items', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.login.notice.item1')).toBeInTheDocument();
        expect(screen.getByText('housing.login.notice.item2')).toBeInTheDocument();
        expect(screen.getByText('housing.login.notice.item3')).toBeInTheDocument();
    });

    it('clicking Discord button calls signInWith with withRegisterFlag based on fromRegister', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByText('housing.login.discordButton'));
        expect(mockSignInWith).toHaveBeenCalledWith('discord', { withRegisterFlag: false });
    });
});
