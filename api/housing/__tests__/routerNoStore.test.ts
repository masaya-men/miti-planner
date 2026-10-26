import { describe, it, expect, vi } from 'vitest';

vi.mock('../_listNotificationsHandler.js', () => ({
  default: async (_req: any, res: any) => res.status(200).json({}),
}));
vi.mock('../_publicWindow.js', () => ({
  publicWindowHandler: async (_req: any, res: any) => res.status(200).json({}),
}));

import handler from '../index.js';

function createRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    headers,
    setHeader(k: string, v: string) { headers[k] = v; },
    status() { return this; },
    json() { return this; },
    end() { return this; },
  };
  return res;
}

describe('api/housing ルータの Cache-Control', () => {
  it('非公開 action (list-notifications) は private, no-store が付く', async () => {
    const res = createRes();
    await handler({ query: { action: 'list-notifications' } } as any, res);
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('公開窓口 action (version) には付かない', async () => {
    const res = createRes();
    await handler({ query: { action: 'version' } } as any, res);
    expect(res.headers['Cache-Control']).toBeUndefined();
  });
});
