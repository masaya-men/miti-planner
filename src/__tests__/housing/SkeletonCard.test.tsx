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
  it('renders the pinterest variant by default with shimmer enabled in non-reduced env', () => {
    const { container } = render(<SkeletonCard />);
    const root = container.querySelector('.housing-skeleton-card');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.getAttribute('data-shimmer')).toBe('true'); // happy-dom polyfill returns matches:false
    expect(root?.querySelector('.housing-skeleton-card-thumb')).not.toBeNull();
    expect(root?.querySelector('.housing-skeleton-card-body')).not.toBeNull();
    expect(root?.querySelectorAll('.housing-skeleton-row, .housing-skeleton-row-sub').length).toBe(2);
  });

  it('renders the right-panel variant with the horizontal mini-row structure', () => {
    const { container } = render(<SkeletonCard variant="right-panel" />);
    const root = container.querySelector('.housing-skeleton-row-item');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.getAttribute('data-shimmer')).toBe('true');
    expect(root?.querySelector('.housing-skeleton-row-item-thumb')).not.toBeNull();
    expect(root?.querySelector('.housing-skeleton-row-item-body')).not.toBeNull();
  });
});
