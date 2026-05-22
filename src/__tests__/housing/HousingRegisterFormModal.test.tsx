// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../lib/housingApiClient', () => ({
    registerListing: vi.fn(() => Promise.resolve({ id: 'listing-1' })),
    canRegister: vi.fn(() => Promise.resolve(true)),
}));

beforeEach(() => {
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    }
});

afterEach(() => {
    document.body.style.overflow = '';
});

import {
    HousingRegisterFormModal,
    toRegistrationDraft,
} from '../../components/housing/register/HousingRegisterFormModal';

describe('toRegistrationDraft 画像詰め替え', () => {
    it('画像 3 フィールドが揃うと imageMode=sns で draft に乗る', () => {
        const draft = toRegistrationDraft({
            dc: 'Mana',
            server: 'Anima',
            area: 'Shirogane',
            ward: 3,
            plot: 12,
            size: 'M',
            tags: ['wafu'],
            postUrl: 'https://x.com/u/status/123',
            ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
            tweetId: '123',
        });
        expect(draft.imageMode).toBe('sns');
        expect(draft.postUrl).toBe('https://x.com/u/status/123');
        expect(draft.ogImageUrl).toBe('https://pbs.twimg.com/media/a.jpg');
        expect(draft.tweetId).toBe('123');
    });

    it('画像なしなら imageMode は undefined（=none 扱い）', () => {
        const draft = toRegistrationDraft({
            dc: 'Mana',
            server: 'Anima',
            area: 'Shirogane',
            ward: 3,
            plot: 12,
            size: 'M',
            tags: ['wafu'],
        });
        expect(draft.imageMode).toBeUndefined();
    });
});

describe('HousingRegisterFormModal', () => {
    it('renders dialog with title when open', () => {
        render(<HousingRegisterFormModal open onClose={() => {}} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('housing.register.title')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<HousingRegisterFormModal open={false} onClose={() => {}} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClose when cancel button clicked', () => {
        const onClose = vi.fn();
        render(<HousingRegisterFormModal open onClose={onClose} />);
        // There are 2 cancel-like elements: the × button in header and the form footer's Cancel button.
        // Both should call onClose. We click the first one.
        const closeBtns = screen.getAllByRole('button', { name: 'housing.register.cancel' });
        fireEvent.click(closeBtns[0]);
        expect(onClose).toHaveBeenCalled();
    });

    it('locks body scroll when open', () => {
        render(<HousingRegisterFormModal open onClose={() => {}} />);
        expect(document.body.style.overflow).toBe('hidden');
    });
});
