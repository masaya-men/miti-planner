// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightPanelListItem } from '../../components/housing/workspace/RightPanelListItem';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('RightPanelListItem', () => {
    const listing = MOCK_LISTINGS[0];

    it('renders thumbnail image and area / ward / plot label', () => {
        const { container } = render(
            <RightPanelListItem listing={listing} active={false} onClick={() => {}} />,
        );
        // alt="" intentionally makes the <img> decorative (presentation role).
        // Query directly instead of by role.
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toContain('mock-thumbs');
        // 2026-05-27 多言語化: formatHousingAddress が i18n.language に応じて area 名を訳す。
        // test 環境では i18n 未初期化 → ja フォールバックで「シロガネ 3-12」 表示。
        expect(screen.getByText(/シロガネ/)).toBeInTheDocument();
        expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('reflects active state via data-active', () => {
        const { container } = render(
            <RightPanelListItem listing={listing} active={true} onClick={() => {}} />,
        );
        expect(container.firstChild).toHaveAttribute('data-active', 'true');
    });

    it('fires onClick when pressed', () => {
        const onClick = vi.fn();
        render(<RightPanelListItem listing={listing} active={false} onClick={onClick} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledOnce();
    });
});
