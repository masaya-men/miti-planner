// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { HousingCardAmbientSlideshow } from '../../components/housing/workspace/HousingCardAmbientSlideshow';

describe('HousingCardAmbientSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when frames is empty', () => {
    const { container } = render(
      <HousingCardAmbientSlideshow frames={[]} enabled />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders one img per frame', () => {
    const { container } = render(
      <HousingCardAmbientSlideshow
        frames={[{ src: '/a.jpg' }, { src: '/b.jpg' }, { src: '/c.jpg' }]}
        enabled
      />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('applies onError fallback when provided', () => {
    const { container } = render(
      <HousingCardAmbientSlideshow
        frames={[{ src: '/a.jpg', fallback: '/a-fallback.jpg' }]}
        enabled
      />,
    );
    const img = container.querySelector('img');
    expect(img?.src).toContain('/a.jpg');
    img?.dispatchEvent(new Event('error'));
    expect(img?.src).toContain('/a-fallback.jpg');
  });
});
