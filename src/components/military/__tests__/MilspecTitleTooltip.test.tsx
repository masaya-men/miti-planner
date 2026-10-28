// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { MilspecTitleTooltip } from '../MilspecTitleTooltip';

// ボードの中の title 属性(ブラウザの灰色の箱)を、標準と同じアプリのツールチップで出す(masaya 2026-10-22)
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="milspec-app">
      <button type="button" title="元に戻す">U</button>
      <span>no title</span>
      <MilspecTitleTooltip rootRef={ref} />
    </div>
  );
}

const bubble = () => document.body.querySelector('[data-ms-title-tip]');

describe('MilspecTitleTooltip', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('title のある要素に乗るとアプリのツールチップを出し、ブラウザの箱は出さない(title を一時的に外す)', () => {
    const { getByText } = render(<Harness />);
    const btn = getByText('U');
    fireEvent.pointerOver(btn, { clientX: 10, clientY: 10 });
    expect(btn.hasAttribute('title')).toBe(false);
    act(() => { vi.advanceTimersByTime(150); });
    expect(bubble()?.textContent).toBe('元に戻す');
    expect(bubble()?.className).toContain('float-surface');
  });

  it('離れるとツールチップを消して title を元に戻す', () => {
    const { getByText } = render(<Harness />);
    const btn = getByText('U');
    fireEvent.pointerOver(btn, { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(150); });
    fireEvent.pointerOut(btn, { relatedTarget: document.body });
    act(() => { vi.advanceTimersByTime(300); });
    expect(btn.getAttribute('title')).toBe('元に戻す');
    expect(bubble()).toBeNull();
  });

  it('押したら(pointerdown)すぐ消す', () => {
    const { getByText } = render(<Harness />);
    const btn = getByText('U');
    fireEvent.pointerOver(btn, { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(150); });
    fireEvent.pointerDown(btn);
    act(() => { vi.advanceTimersByTime(300); });
    expect(bubble()).toBeNull();
  });

  it('title の無い要素では何も出さない', () => {
    const { getByText } = render(<Harness />);
    fireEvent.pointerOver(getByText('no title'), { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(150); });
    expect(bubble()).toBeNull();
  });
});
