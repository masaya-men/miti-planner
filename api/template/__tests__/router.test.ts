import { describe, it, expect, vi } from 'vitest';

const calls: string[] = [];

vi.mock('../_autoRegisterHandler.js', () => ({
  default: async (_req: any, res: any) => { calls.push('auto-register'); res.status(200).json({}); },
}));
vi.mock('../_promoteHandler.js', () => ({
  default: async (_req: any, res: any) => { calls.push('promote'); res.status(200).json({}); },
}));
vi.mock('../_publicNotificationsHandler.js', () => ({
  default: async (_req: any, res: any) => { calls.push('public-notifications'); res.status(200).json({}); },
}));
vi.mock('../_publicTemplateHandler.js', () => ({
  default: async (_req: any, res: any) => { calls.push('public-template'); res.status(200).json({}); },
}));

import handler from '../index.js';

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  return res;
}

describe('api/template ルータ dispatch', () => {
  it('public-notifications action を _publicNotificationsHandler に委譲する', async () => {
    calls.length = 0;
    await handler({ query: { action: 'public-notifications' } } as any, createRes());
    expect(calls).toEqual(['public-notifications']);
  });

  it('public-template action を _publicTemplateHandler に委譲する', async () => {
    calls.length = 0;
    await handler({ query: { action: 'public-template' } } as any, createRes());
    expect(calls).toEqual(['public-template']);
  });

  it('既存の auto-register / promote は従来どおり委譲される (回帰防止)', async () => {
    calls.length = 0;
    await handler({ query: { action: 'auto-register' } } as any, createRes());
    await handler({ query: { action: 'promote' } } as any, createRes());
    expect(calls).toEqual(['auto-register', 'promote']);
  });

  it('未知の action は 400', async () => {
    const res = createRes();
    await handler({ query: { action: 'nope' } } as any, res);
    expect(res.statusCode).toBe(400);
  });
});
