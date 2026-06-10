// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CursorOverlay, type RemoteCursor } from '../CursorOverlay';

const tMap = new Map<number, number>([[0, 0], [100, 1000]]);

describe('CursorOverlay', () => {
  it('cursorEnabled かつ pos 非 null の peer だけ要素を描く', () => {
    const cursors: RemoteCursor[] = [
      { clientId: 2, color: '#222', jobId: null, pos: { timeSec: 50, xRatio: 0.5 } },
      { clientId: 3, color: '#333', jobId: null, pos: null }, // タイムライン外 → 非表示
    ];
    const { container } = render(
      <CursorOverlay cursors={cursors} timeToYMap={tMap} sheetWidth={800} />,
    );
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(1);
    expect(container.querySelector('[data-cursor-id="2"]')).not.toBeNull();
  });
  it('cursors 空なら何も描かない', () => {
    const { container } = render(<CursorOverlay cursors={[]} timeToYMap={tMap} sheetWidth={800} />);
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(0);
  });
});
