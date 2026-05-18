// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';

// happy-dom が matchMedia を持たない場合に備えてポリフィル
beforeAll(() => {
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
});

function Probe() {
  const reduced = useReducedMotion();
  return <span data-testid="r">{reduced ? 'yes' : 'no'}</span>;
}

describe('useReducedMotion', () => {
  it('returns false by default in jsdom', () => {
    render(<Probe />);
    expect(screen.getByTestId('r').textContent).toBe('no');
  });
});
