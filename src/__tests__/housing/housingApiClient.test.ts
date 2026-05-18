// src/__tests__/housing/housingApiClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('test-token') } },
  appCheck: Promise.resolve({}),
}));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

import { canRegister, registerListing, checkDuplicate } from '../../lib/housingApiClient';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

describe('canRegister', () => {
  it('GET /api/housing?action=can-register を叩く', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ allowed: true, registrationCount: 5, remaining: 5, lastReset: 0 }), { status: 200 }),
    );
    const result = await canRegister();
    expect(result.allowed).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/housing?action=can-register'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('registerListing', () => {
  it('POST register-listing で id を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'l1', addressKey: 'k' }), { status: 200 }),
    );
    const result = await registerListing({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, subdivision: 'main', buildingType: 'house', ownerType: 'personal',
      plot: 12, size: 'M', tags: ['modern'],
    });
    expect(result.id).toBe('l1');
  });
  it('429 quota_exhausted は QuotaExhaustedError を投げる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'quota_exhausted' }), { status: 429 }),
    );
    await expect(
      registerListing({
        dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
        ward: 3, subdivision: 'main', buildingType: 'house', ownerType: 'personal',
        plot: 12, size: 'M', tags: ['modern'],
      }),
    ).rejects.toThrow('quota_exhausted');
  });
});

describe('checkDuplicate', () => {
  it('POST check-duplicate で duplicates 配列を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ duplicates: [{ id: 'l1', ownerUid: 'u1', createdAt: 0, tags: ['modern'] }] }), { status: 200 }),
    );
    const result = await checkDuplicate({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, subdivision: 'main', buildingType: 'house', ownerType: 'personal',
      plot: 12, size: 'M',
    });
    expect(result.duplicates).toHaveLength(1);
  });
});
