// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EntranceAuthoringPage } from '../EntranceAuthoringPage';

// useWardMapAsset を ready(mist の houses 2件)でモック
vi.mock('../../../../lib/housing/useWardMapAsset', () => ({
  useWardMapAsset: () => ({
    status: 'ready',
    svg: '<svg viewBox="0 0 100 100"></svg>',
    json: {
      viewBox: { w: 100, h: 100 },
      nodes: [{ id: 'n1', x: 0.5, y: 0.5 }],
      edges: [],
      houses: [
        { kind: 'plot', plot: 6, x: 0.4, y: 0.4, node: 'n1', outline: [[0.35, 0.35], [0.45, 0.35], [0.45, 0.45], [0.35, 0.45]] },
        { kind: 'plot', plot: 7, x: 0.6, y: 0.6, node: 'n1', outline: [[0.55, 0.55], [0.65, 0.55], [0.65, 0.65], [0.55, 0.65]] },
      ],
    },
  }),
}));
vi.mock('../../../../data/housing/wardEntrances.generated.json', () => ({ default: {} }));

describe('EntranceAuthoringPage', () => {
  it('選択マップの全区画分の入口マーカーを描画する', () => {
    const { container } = render(<EntranceAuthoringPage />);
    const markers = container.querySelectorAll('[data-testid="entrance-marker"]');
    expect(markers.length).toBe(2);
  });

  it('初期は全マーカーが未補正(uncorrected)クラス', () => {
    const { container } = render(<EntranceAuthoringPage />);
    const corrected = container.querySelectorAll('.housing-entrance-marker--corrected');
    expect(corrected.length).toBe(0);
  });
});
