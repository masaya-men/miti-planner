import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApplyRateLimit } = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(async (..._args: any[]) => true),
}));

vi.mock('../../../src/lib/rateLimit.js', () => ({
  applyRateLimit: mockApplyRateLimit,
}));

import handler from '../_fetchAllmarksShareHandler.js';

function makeReqRes(overrides: Partial<{ method: string; query: Record<string, string> }> = {}) {
  const req: any = { method: 'GET', query: {}, ...overrides };
  const res: any = {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  return { req, res };
}

describe('_fetchAllmarksShareHandler (2026-08-19 Allmarksまとめてインポート)', () => {
  beforeEach(() => {
    mockApplyRateLimit.mockClear();
    mockApplyRateLimit.mockResolvedValue(true);
    global.fetch = vi.fn();
  });

  it('GET以外は405', async () => {
    const { req, res } = makeReqRes({ method: 'POST' });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('applyRateLimit がfalseなら早期return (自身では応答しない)', async () => {
    mockApplyRateLimit.mockImplementationOnce(async (_req: any, res: any) => {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return false;
    });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shareIdが英数字6桁でなければ400・外部fetchはしない', async () => {
    const { req, res } = makeReqRes({ query: { shareId: 'short' } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_share_id', urls: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shareId未指定は400', async () => {
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('正常系: Allmarksのshare.cards[].uだけを抽出して返す (固定ドメイン+検証済みIDのみ)', async () => {
    // レスポンス形は { share: { cards: [...] }, thumb? } (Allmarks側 KVShareEntry と同一)。
    // トップレベルに直接 cards は無い — 2026-08-19実機バグ(1件も取り込めない)の回帰テスト。
    // 実際の本番レスポンスで検証済み(curl https://allmarks.app/api/share/<実ID>)。
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        share: {
          v: 2,
          cards: [
            { u: 'https://x.com/a/status/1', t: 'a' },
            { u: 'https://x.com/b/status/2', t: 'b' },
          ],
        },
      }),
    });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(global.fetch).toHaveBeenCalledWith('https://allmarks.app/api/share/Ab3xY9');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ urls: ['https://x.com/a/status/1', 'https://x.com/b/status/2'] });
  });

  it('トップレベルに直接cardsがある(share無し)、古い/誤った形は空配列扱い (share.cardsのみ正)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cards: [{ u: 'https://x.com/a/status/1' }] }),
    });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(res.body).toEqual({ urls: [] });
  });

  it('Allmarks側が404 (期限切れ/不存在) なら空配列で200', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 404 });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ urls: [] });
  });

  it('share.cards内のuが文字列以外/欠落なら除外する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ share: { cards: [{ u: 'https://x.com/a/status/1' }, { u: 123 }, {}, { u: '' }] } }),
    });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(res.body).toEqual({ urls: ['https://x.com/a/status/1'] });
  });

  it('share.cardsが100件を超えていても100件で打ち切る (信頼できない外部レスポンス対策)', async () => {
    const cards = Array.from({ length: 150 }, (_, i) => ({ u: `https://x.com/a/status/${i}` }));
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ share: { cards } }),
    });
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect((res.body as { urls: string[] }).urls).toHaveLength(100);
  });

  it('外部fetchの例外は空配列で200 (呼び出し側に例外を漏らさない)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    const { req, res } = makeReqRes({ query: { shareId: 'Ab3xY9' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ urls: [] });
  });
});
