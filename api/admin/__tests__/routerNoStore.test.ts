import { describe, it, expect, vi } from 'vitest';

vi.mock('../_roleHandler.js', () => ({
  default: async (_req: any, res: any) => res.status(200).json({}),
}));

import handler from '../index.js';

describe('api/admin ルータの Cache-Control', () => {
  it('handler 先頭で private, no-store が付く', async () => {
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader(k: string, v: string) { headers[k] = v; },
      status() { return this; },
      json() { return this; },
    };
    await handler({ query: { resource: 'role' } } as any, res);
    expect(headers['Cache-Control']).toBe('private, no-store');
  });
});
