// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecFxLayer } from '../MilspecFxLayer';

describe('MilspecFxLayer', () => {
  it('経路を data-trace 付きで置き、aria-hidden', () => {
    const { container } = render(<MilspecFxLayer traces={[{ name: 's1', d: 'M0 0 L10 0', pc: 'seam' }, { name: 'a', d: 'M0 0 L1 1', next: 'b' }]} />);
    const svg = container.querySelector('svg.milspec-fx')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const ps = svg.querySelectorAll('path.milspec-trc[data-trace]');
    expect(ps.length).toBe(2);
    expect(ps[0].getAttribute('data-trace-pc')).toBe('seam');
    expect(ps[1].getAttribute('data-trace-next')).toBe('b');
  });
});
