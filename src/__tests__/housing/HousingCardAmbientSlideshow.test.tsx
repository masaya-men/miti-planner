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

  it('フレーム4枚でも <img> は3枚だけマウントする', () => {
    const frames = [
      { src: 'https://lopoly.app/housing-media/L1/a.webp' },
      { src: 'https://lopoly.app/housing-media/L1/b.webp' },
      { src: 'https://lopoly.app/housing-media/L1/c.webp' },
      { src: 'https://lopoly.app/housing-media/L1/d.webp' },
    ];
    const { container } = render(<HousingCardAmbientSlideshow frames={frames} enabled={false} />);
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('housing-media フレームは派生 srcSet を持つ', () => {
    const frames = [{ src: 'https://lopoly.app/housing-media/L1/a.webp' }, { src: 'https://lopoly.app/housing-media/L1/b.webp' }];
    const { container } = render(<HousingCardAmbientSlideshow frames={frames} enabled={false} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('srcset')).toContain('a-480.webp 480w');
    expect(img.getAttribute('decoding')).toBe('async');
  });
});
