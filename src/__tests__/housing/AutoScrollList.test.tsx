// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoScrollList } from '../../components/housing/workspace/AutoScrollList';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('AutoScrollList', () => {
    it('renders one button per listing', () => {
        render(<AutoScrollList listings={MOCK_LISTINGS.slice(0, 5)} />);
        expect(screen.getAllByRole('button').length).toBe(5);
    });

    it('toggles paused state on hover enter / leave', () => {
        const { container } = render(<AutoScrollList listings={MOCK_LISTINGS.slice(0, 3)} />);
        const root = container.firstChild as HTMLElement;
        expect(root.getAttribute('data-paused')).toBe('false');
        fireEvent.mouseEnter(root);
        expect(root.getAttribute('data-paused')).toBe('true');
        fireEvent.mouseLeave(root);
        expect(root.getAttribute('data-paused')).toBe('false');
    });
});
