import { describe, it, expect, vi } from 'vitest';

const updateDoc = vi.fn(async () => undefined);
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  updateDoc: (...a: unknown[]) => (updateDoc as (...x: unknown[]) => unknown)(...a),
}));
vi.mock('../../firebase', () => ({ db: {} }));

import { pushHostState } from '../hostSync';

describe('pushHostState', () => {
  it('order と currentIndex を同じ 1 回の書き込みで送る', async () => {
    await pushHostState('tok', {
      currentIndex: 1,
      phase: 'moving',
      viewStartAt: null,
      crossingAckedIndex: null,
      order: ['a', 'd', 'b'],
    });
    expect(updateDoc).toHaveBeenCalledTimes(1);
    const payload = (updateDoc.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(payload.order).toEqual(['a', 'd', 'b']);
    expect(payload.currentIndex).toBe(1);
  });
});
