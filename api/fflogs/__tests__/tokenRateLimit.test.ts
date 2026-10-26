import { describe, it, expect, vi } from 'vitest';

const failover = vi.hoisted(() => vi.fn());
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => false) }));
vi.mock('../../../src/lib/fflogsTokenFailover.js', () => ({ fetchTokenWithFailover: failover }));

import handler from '../token/index.js';

describe('api/fflogs/token レート制限', () => {
  it('applyRateLimit が false なら処理に進まない', async () => {
    const res: any = { setHeader() {}, status() { return this; }, json() { return this; }, end() { return this; } };
    await handler({ method: 'POST', headers: {} } as any, res);
    expect(failover).not.toHaveBeenCalled();
  });
});
