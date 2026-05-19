// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockFetchTweet = vi.fn();
const mockCancel = vi.fn();
const mockReset = vi.fn();
vi.mock('../../lib/housing/useTweetFetch', () => ({
    useTweetFetch: () => ({
        status: 'idle',
        data: null,
        errorCode: null,
        fetchTweet: mockFetchTweet,
        cancel: mockCancel,
        reset: mockReset,
    }),
}));

import { HousingRegisterSnsUrlField } from '../../components/housing/register/HousingRegisterSnsUrlField';

describe('HousingRegisterSnsUrlField', () => {
    beforeEach(() => {
        mockFetchTweet.mockClear();
        mockCancel.mockClear();
        mockReset.mockClear();
    });

    it('renders input field with label', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
        expect(screen.getByLabelText('housing.register.snsUrl.label')).toBeInTheDocument();
    });

    it('triggers fetchTweet on valid X URL paste', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://x.com/user/status/1842217368673759498' } });
        expect(mockFetchTweet).toHaveBeenCalledWith('1842217368673759498');
    });

    it('shows error key for invalid URL', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://example.com/foo' } });
        expect(screen.getByText('housing.register.snsUrl.error.invalid')).toBeInTheDocument();
        expect(mockFetchTweet).not.toHaveBeenCalled();
    });
});
