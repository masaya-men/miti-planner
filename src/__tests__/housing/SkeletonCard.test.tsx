// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonCard } from '../../components/housing/workspace/SkeletonCard';

// happy-dom が matchMedia をサポートしないため、ポリフィル提供
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

describe('SkeletonCard', () => {
  it('renders the pinterest variant by default', () => {
    const { container } = render(<SkeletonCard />);
    const root = container.querySelector('.housing-skeleton-card');
    expect(root).not.toBeNull();
  });

  it('renders the right-panel variant', () => {
    const { container } = render(<SkeletonCard variant="right-panel" />);
    const root = container.querySelector('.housing-skeleton-row-item');
    expect(root).not.toBeNull();
  });
});
