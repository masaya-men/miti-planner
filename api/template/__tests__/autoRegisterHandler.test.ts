import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const state = { contents: { exists: true, data: () => ({ items: [{ id: 'm1s' }] }) } as any };
  const templateGet = vi.fn(async () => ({ exists: false }));
  const templateSet = vi.fn(async () => {});
  const fakeDb = {
    doc: vi.fn((path: string) => {
      if (path === 'master/contents') return { get: async () => state.contents };
      return { get: templateGet, set: templateSet, update: vi.fn(async () => {}) };
    }),
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ set: vi.fn(async () => {}) })) })),
  };
  return { state, templateGet, templateSet, fakeDb };
});

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  getAdminFirestore: vi.fn(() => h.fakeDb),
}));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/auditLog.js', () => ({ writeAuditLog: vi.fn(async () => {}) }));
vi.mock('../../../src/lib/discordWebhook.js', () => ({ sendDiscordNotification: vi.fn(async () => {}) }));
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn(async () => ({ uid: 'u1' })) })),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__TS__', increment: () => '__INC__' },
}));

import handler from '../_autoRegisterHandler.js';

function run(contentId: unknown, kill = false) {
  const req: any = {
    method: 'POST',
    headers: { authorization: 'Bearer t', origin: 'https://lopoly.app' },
    body: {
      contentId,
      category: 'savage',
      timelineEvents: [{ time: 1, name: 'a' }],
      phases: [],
      kill,
      deathCount: 0,
      sourceReport: 'r',
    },
  };
  const res: any = {
    statusCode: 0,
    body: undefined as any,
    setHeader() {},
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    end() { return this; },
  };
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.contents = { exists: true, data: () => ({ items: [{ id: 'm1s' }] }) };
});

describe('_autoRegisterHandler の contentId 検証', () => {
  it('不正な形式 (../x) は 400 invalid contentId', async () => {
    const res = await run('../x');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid contentId');
  });

  it('文字列でない contentId は 400', async () => {
    const res = await run(123);
    expect(res.statusCode).toBe(400);
  });

  it('master/contents に無い ID は 400 unknown contentId', async () => {
    const res = await run('zzz');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('unknown contentId');
    expect(h.templateGet).not.toHaveBeenCalled();
  });

  it('master/contents 自体が無くても 400', async () => {
    h.state.contents = { exists: false, data: () => undefined };
    const res = await run('m1s');
    expect(res.statusCode).toBe(400);
  });

  it('存在する ID は従来どおり先へ進む (kill=false なら not_a_kill)', async () => {
    const res = await run('m1s', false);
    expect(res.statusCode).toBe(200);
    expect(res.body.reason).toBe('not_a_kill');
  });
});
