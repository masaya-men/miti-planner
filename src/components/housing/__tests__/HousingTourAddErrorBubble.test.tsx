// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
