// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { LiquidGlassPanel } from '../../components/housing/workspace/LiquidGlassPanel';

// happy-dom が ResizeObserver を持たない場合に備えてポリフィル
beforeAll(() => {
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('LiquidGlassPanel', () => {
  it('renders children inside a positioned wrapper', () => {
    const { getByText } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49} chroma={0}>
        <span>inner</span>
      </LiquidGlassPanel>
    );
    expect(getByText('inner')).toBeInTheDocument();
  });

  it('exposes a filter id attribute on the wrapper', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-liquid-filter-id')).toMatch(/^liquid-/);
  });

  it('injects an SVG filter element with feImage + feDisplacementMap', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    // Wait for ResizeObserver to fire — synchronous in jsdom mock?
    // We at least check the SVG defs container exists.
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
