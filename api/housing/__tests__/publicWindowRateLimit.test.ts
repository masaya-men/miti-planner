import { describe, it, expect, vi } from 'vitest';

const initAdmin = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/adminAuth.js', () => ({ initAdmin, getAdminFirestore: vi.fn() }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => false) }));

import { publicWindowHandler } from '../_publicWindow.js';

describe('publicWindowHandler レート制限', () => {
  it('applyRateLimit が false なら処理に進まない', async () => {
    const res: any = { setHeader() {}, status() { return this; }, json() { return this; }, end() { return this; } };
    await publicWindowHandler({ method: 'GET', query: { action: 'version' }, headers: {} } as any, res);
    expect(initAdmin).not.toHaveBeenCalled();
  });
});
