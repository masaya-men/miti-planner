// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

let mockFetch: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, 'fetch');
});

import { HousingRegisterForm } from '../../components/housing/register/HousingRegisterForm';

describe('HousingRegisterForm', () => {
    it('renders SNS URL field and type selector', () => {
        render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
        expect(screen.getByLabelText('housing.register.snsUrl.label')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'housing.register.type.S' })).toBeInTheDocument();
    });

    it('submit button is disabled when required fields are empty', () => {
        render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
        const submitBtn = screen.getByRole('button', { name: 'housing.register.submit' });
        expect(submitBtn).toBeDisabled();
    });

    it('fills size field when tweet is fetched (auto-filled state)', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    text: 'Mana\nAnima\nShirogane | 6-6 | Small',
                    author: { name: 'T', screen_name: 't' },
                    photos: [],
                    video: false,
                }),
                { status: 200 },
            ),
        );
        render(<HousingRegisterForm onSubmit={() => {}} onCancel={() => {}} />);
        const urlInput = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(urlInput, { target: { value: 'https://x.com/u/status/1842217368673759498' } });
        await waitFor(
            () => {
                expect(screen.getByRole('radio', { name: 'housing.register.type.S' })).toHaveAttribute('data-selected', 'true');
            },
            { timeout: 3000 },
        );
    });
});
