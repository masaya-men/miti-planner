import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetAdminFirestore, mockVerifyIdToken } = vi.hoisted(() => ({
  mockGetAdminFirestore: vi.fn(),
  mockVerifyIdToken: vi.fn(),
}));

vi.mock('../../../src/lib/adminAuth.js', () => ({
  initAdmin: vi.fn(),
  getAdminFirestore: mockGetAdminFirestore,
}));
vi.mock('../../../src/lib/rateLimit.js', () => ({ applyRateLimit: vi.fn(async () => true) }));
vi.mock('../../../src/lib/appCheckVerify.js', () => ({ verifyAppCheck: vi.fn(async () => true) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mockVerifyIdToken }) }));
vi.mock('../_publicVersion.js', () => ({ bumpPublicVersionBatch: vi.fn() }));

import resolveHandler from '../_resolveReportHandler.js';
import { publicWindowHandler } from '../_publicWindow.js';

type Row = Record<string, any>;

function res(): any {
  const r: any = { statusCode: 200, body: undefined };
  r.setHeader = vi.fn();
  r.status = vi.fn((c: number) => { r.statusCode = c; return r; });
  r.json = vi.fn((p: any) => { r.body = p; return r; });
  r.end = vi.fn(() => r);
  return r;
}

describe('resolve-report: 運営非表示の家は家主が解除できない', () => {
  beforeEach(() => {
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'owner' });
  });

  it('adminHiddenScope があれば 403 admin_hidden で何も変更しない', async () => {
    const update = vi.fn();
    const batch = vi.fn();
    mockGetAdminFirestore.mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ ownerUid: 'owner', isHidden: true, adminHiddenScope: 'owner', restoreCount: 0 }),
          }),
          update,
          collection: () => ({ get: async () => ({ docs: [] }) }),
        }),
      }),
      batch,
    });
    const r = res();
    await resolveHandler(
      { method: 'POST', headers: { authorization: 'Bearer t' }, body: { listingId: 'x' } },
      r,
    );
    expect(r.statusCode).toBe(403);
    expect(r.body).toEqual({ error: 'admin_hidden' });
    expect(update).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});

describe('公開窓口 housinger: hiddenListings', () => {
  it('運営非表示の家だけを、画像系フィールドなしで返す', async () => {
    const normal = { ownerUid: 'u1', isHidden: false, visibility: 'public', title: '普通', createdAt: 1, deletedAt: null };
    const rows: Row[] = [
      { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'owner', visibility: 'public', title: '隠れ', createdAt: 5, deletedAt: null,
        dc: 'Elemental', plot: 3, size: 'M', imageMode: 'thumbnail', thumbnailPath: 'a.webp', thumbnailPaths: ['a'],
        ogImageUrl: 'o', sourceImageUrls: ['s'], videoPosterUrl: 'v', youtubeVideoId: 'y', postUrl: 'p', tweetId: 't', coverThumbHash: 'h' },
      { ownerUid: 'u1', isHidden: true, visibility: 'public', title: '通報3件の自動非表示', createdAt: 4, deletedAt: null },
      { ownerUid: 'u1', isHidden: true, adminHiddenScope: 'listing', visibility: 'public', title: '削除済', createdAt: 3, deletedAt: 9 },
    ];
    const wheres: Array<[string, unknown]> = [];
    const mk = (isHidden: boolean) => {
      const q: any = {
        where: (f: string, _o: string, v: unknown) => { if (f === 'isHidden') wheres.push([f, v]); return q; },
        orderBy: () => q,
        select: () => q,
        get: async () => ({
          docs: (isHidden ? rows : [normal]).map((d, i) => ({ id: `${isHidden ? 'h' : 'n'}${i}`, data: () => d })),
        }),
      };
      return q;
    };
    let call = 0;
    mockGetAdminFirestore.mockReturnValue({
      doc: () => ({ get: async () => ({ exists: false }) }),
      collection: () => {
        const q: any = {
          where: (f: string, _o: string, v: unknown) => {
            if (f === 'isHidden') {
              call++;
              return mk(v === true).where(f, _o, v);
            }
            return q;
          },
        };
        return q;
      },
    });
    const r = res();
    await publicWindowHandler({ method: 'GET', query: { action: 'housinger', uid: 'u1' } }, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.listings).toHaveLength(1);
    expect(r.body.hiddenListings.map((l: Row) => l.title)).toEqual(['隠れ']);
    const h = r.body.hiddenListings[0];
    for (const f of [
      'imageMode', 'thumbnailPath', 'thumbnailPaths', 'ogImageUrl', 'sourceImageUrls',
      'videoPosterUrl', 'youtubeVideoId', 'postUrl', 'tweetId', 'coverThumbHash',
    ]) {
      expect(h).not.toHaveProperty(f);
    }
    expect(h).toMatchObject({ id: 'h0', title: '隠れ', dc: 'Elemental', plot: 3, isHidden: true });
    expect(call).toBe(2);
  });
});
