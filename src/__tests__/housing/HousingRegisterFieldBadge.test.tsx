// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingRegisterFieldBadge } from '../../components/housing/register/HousingRegisterFieldBadge';

describe('HousingRegisterFieldBadge', () => {
    it('renders auto-filled badge when state is auto-filled', () => {
        render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={() => {}} />);
        expect(screen.getByTestId('housing-auto-badge')).toBeInTheDocument();
        expect(screen.getByTestId('housing-confirm-button')).toBeInTheDocument();
    });

    it('does NOT render badge when state is empty', () => {
        render(<HousingRegisterFieldBadge state="empty" onConfirm={() => {}} />);
        expect(screen.queryByTestId('housing-auto-badge')).not.toBeInTheDocument();
    });

    it('does NOT render badge when state is confirmed', () => {
        render(<HousingRegisterFieldBadge state="confirmed" onConfirm={() => {}} />);
        expect(screen.queryByTestId('housing-auto-badge')).not.toBeInTheDocument();
    });

    it('calls onConfirm when ✅ button clicked', () => {
        const onConfirm = vi.fn();
        render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('housing-confirm-button'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('sets data-animating=true when clicked', () => {
        render(<HousingRegisterFieldBadge state="auto-filled" onConfirm={() => {}} />);
        const button = screen.getByTestId('housing-confirm-button');
        fireEvent.click(button);
        expect(button.getAttribute('data-animating')).toBe('true');
    });
});
