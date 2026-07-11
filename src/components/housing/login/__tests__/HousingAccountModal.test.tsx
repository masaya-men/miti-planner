// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingAccountModal } from '../HousingAccountModal';

vi.mock('../../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn((sel: any) => sel({
            user: { uid: 'test-uid' },
            isAdmin: false,
            profileDisplayName: 'Test User',
            profileAvatarUrl: null,
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../../store/useHousingModalStore', () => ({
    useHousingModalStore: Object.assign(
        vi.fn((sel: any) => sel({
            account: { open: true },
            closeAccount: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../../hooks/auth/useAccountActions', () => ({
    useAccountActions: () => ({
        uploadAvatar: vi.fn(),
        removeAvatar: vi.fn(),
        updateDisplayName: vi.fn(),
        signOut: vi.fn(),
        deleteAccount: vi.fn(),
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

// HousingerProfileSection (Task 6) は本人プロフィールを firebase/firestore から直読みするため、
// このモーダル配線テストでは実 Firebase を呼ばないようスタブ化する (内部挙動は
// HousingerProfileSection.test.tsx で個別に検証済み)。
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((...args: unknown[]) => args),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
}));

vi.mock('../../../../lib/firebase', () => ({
    db: {},
    auth: { currentUser: null },
}));

vi.mock('../../../../lib/housing/housingerProfileService', () => ({
    upsertHousingerProfile: vi.fn(async () => ({ ok: true })),
}));

describe('HousingAccountModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title and 5 sections', () => {
        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.account.title')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('housing.account.signOut')).toBeInTheDocument();
        expect(screen.getByText('housing.account.deleteAccount')).toBeInTheDocument();
    });

    it('does not render admin link when isAdmin is false', () => {
        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.queryByText('housing.account.adminLink')).not.toBeInTheDocument();
    });

    it('renders admin link when isAdmin is true', async () => {
        const { useAuthStore } = await import('../../../../store/useAuthStore');
        (useAuthStore as any).mockImplementation((sel: any) =>
            sel({
                user: { uid: 'test-uid' },
                isAdmin: true,
                profileDisplayName: 'Admin User',
                profileAvatarUrl: null,
            }),
        );

        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.account.adminLink')).toBeInTheDocument();
    });
});
