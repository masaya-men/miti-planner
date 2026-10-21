// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { useSortSlide } from '../useSortSlide';

function Probe(p: { left: number; sort: string; enabled?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useSortSlide(ref, { left: p.left, sortOrder: p.sort, enabled: p.enabled ?? true, delay: 40 });
  return <div ref={ref} />;
}
const mm = (matches: boolean) => (q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} });
let anim: ReturnType<typeof vi.fn>;
beforeEach(() => {
  anim = vi.fn();
  (HTMLElement.prototype as any).animate = anim;
  vi.stubGlobal('matchMedia', mm(false));
});
afterEach(() => vi.unstubAllGlobals());

describe('useSortSlide(効果アイコンの滑り)', () => {
  it('並び替えの直後に left が変わると 820ms で animate', () => {
    const { rerender } = render(<Probe left={100} sort="role" />);
    rerender(<Probe left={100} sort="light_party" />);
    rerender(<Probe left={220} sort="light_party" />);
    expect(anim).toHaveBeenCalledTimes(1);
    expect(anim.mock.calls[0][1]).toMatchObject({ duration: 820, delay: 40 });
    expect((anim.mock.calls[0][0] as Keyframe[])[0].transform).toBe('translate(-120px, 0px)');
  });
  it('並び替えなしで left が変わっても(幅の変化など)滑らない', () => {
    const { rerender } = render(<Probe left={100} sort="role" />);
    rerender(<Probe left={220} sort="role" />);
    expect(anim).not.toHaveBeenCalled();
  });
  it('enabled=false(標準テーマ)は何もしない', () => {
    const { rerender } = render(<Probe left={100} sort="role" enabled={false} />);
    rerender(<Probe left={100} sort="light_party" enabled={false} />);
    rerender(<Probe left={220} sort="light_party" enabled={false} />);
    expect(anim).not.toHaveBeenCalled();
  });
  it('動きを減らす設定では滑らない', () => {
    vi.stubGlobal('matchMedia', mm(true));
    const { rerender } = render(<Probe left={100} sort="role" />);
    rerender(<Probe left={100} sort="light_party" />);
    rerender(<Probe left={220} sort="light_party" />);
    expect(anim).not.toHaveBeenCalled();
  });
});
