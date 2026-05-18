// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useAutoScroll } from '../../hooks/useAutoScroll';

function Probe({ paused }: { paused: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    useAutoScroll(ref, { pxPerSecond: 60, paused });
    useEffect(() => {
        if (ref.current) {
            Object.defineProperty(ref.current, 'scrollHeight', { configurable: true, value: 1000 });
            Object.defineProperty(ref.current, 'clientHeight', { configurable: true, value: 200 });
        }
    }, []);
    return <div ref={ref} data-testid="scroll" style={{ height: 200, overflow: 'auto' }} />;
}

describe('useAutoScroll', () => {
    it('mounts without throwing while running', () => {
        expect(() => render(<Probe paused={false} />)).not.toThrow();
    });
    it('mounts without throwing while paused', () => {
        expect(() => render(<Probe paused={true} />)).not.toThrow();
    });
});
