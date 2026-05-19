// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { HousingRegisterTweetPreview } from '../../components/housing/register/HousingRegisterTweetPreview';

const sample = {
    text: 'Mana\nAnima\nShirogane | 6-6 | Small',
    author: { name: 'Test User', screen_name: 'testuser' },
    photos: [],
    video: false,
};

describe('HousingRegisterTweetPreview', () => {
    it('renders tweet text', () => {
        render(<HousingRegisterTweetPreview data={sample} />);
        expect(screen.getByText(/Shirogane \| 6-6 \| Small/)).toBeInTheDocument();
    });

    it('renders author name', () => {
        render(<HousingRegisterTweetPreview data={sample} />);
        expect(screen.getByText(/Test User/)).toBeInTheDocument();
        expect(screen.getByText(/@testuser/)).toBeInTheDocument();
    });

    it('renders photos when present', () => {
        const withPhotos = { ...sample, photos: ['https://pbs.twimg.com/a.jpg'] };
        const { container } = render(<HousingRegisterTweetPreview data={withPhotos} />);
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('src', 'https://pbs.twimg.com/a.jpg');
    });
});
