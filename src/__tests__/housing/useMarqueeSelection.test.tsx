// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useMarqueeSelection } from '../../lib/housing/useMarqueeSelection';

function Probe({ onComplete }: { onComplete: (ids: string[]) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useMarqueeSelection({
        containerRef: ref,
        itemSelector: '[data-listing-id]',
        onComplete: (ids) => onComplete(ids),
    });
    return (
        <div ref={ref} data-testid="container" style={{ position: 'relative', width: 400, height: 300 }}>
            <div data-listing-id="a">a</div>
            <div data-listing-id="b">b</div>
        </div>
    );
}

describe('useMarqueeSelection', () => {
    it('fires onComplete after a background drag', () => {
        const onComplete = vi.fn();
        const { getByTestId } = render(<Probe onComplete={onComplete} />);
        const container = getByTestId('container');
        fireEvent.mouseDown(container, { button: 0, clientX: 0, clientY: 0 });
        fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
        fireEvent.mouseUp(window, { clientX: 50, clientY: 50 });
        expect(onComplete).toHaveBeenCalled();
    });

    it('does NOT start a marquee when mousedown lands on an item (not background)', () => {
        const onComplete = vi.fn();
        const { container } = render(<Probe onComplete={onComplete} />);
        const item = container.querySelector('[data-listing-id="a"]') as HTMLElement;
        fireEvent.mouseDown(item, { button: 0 });
        fireEvent.mouseUp(window);
        expect(onComplete).not.toHaveBeenCalled();
    });
});
