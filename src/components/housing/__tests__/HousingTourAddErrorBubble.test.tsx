// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';

function Harness({ message }: { message: string | null }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={ref} type="button">
        トリガー
      </button>
      <HousingTourAddErrorBubble anchorRef={ref} message={message} />
    </div>
  );
}

describe('HousingTourAddErrorBubble', () => {
  it('messageがnullなら何も描画しない', () => {
    render(<Harness message={null} />);
    expect(screen.queryByTestId('housing-tour-error-bubble')).not.toBeInTheDocument();
  });

  it('messageがあれば吹き出しにその文言を表示する', () => {
    render(<Harness message="別リージョンのハウジングは同じツアーに入れられません" />);
    const bubble = screen.getByTestId('housing-tour-error-bubble');
    expect(bubble).toHaveTextContent('別リージョンのハウジングは同じツアーに入れられません');
  });

  it('document.bodyへportalされる(祖先のoverflow:hiddenにクリップされない)', () => {
    const { container } = render(<Harness message="test" />);
    const bubble = screen.getByTestId('housing-tour-error-bubble');
    expect(container.contains(bubble)).toBe(false);
    expect(document.body.contains(bubble)).toBe(true);
  });

  it('狭いビューポートで左端近くのアンカーでもleftが画面内にクランプされる(はみ出さない)', () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    const rectSpy = vi
      .spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        left: 5,
        width: 30,
        top: 100,
        right: 35,
        bottom: 120,
        height: 20,
        x: 5,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect);

    try {
      render(<Harness message="別リージョンのハウジングは同じツアーに入れられません" />);
      const bubble = screen.getByTestId('housing-tour-error-bubble');
      // 素朴な計算 (5 + 30/2 = 20) だと max-width:220px の吹き出しが画面外へはみ出す。
      // クランプ後は BUBBLE_HALF_WIDTH_MARGIN(118) 未満にならない。
      expect(bubble.style.left).not.toBe('20px');
      expect(parseFloat(bubble.style.left)).toBeGreaterThanOrEqual(118);
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
    }
  });
});
