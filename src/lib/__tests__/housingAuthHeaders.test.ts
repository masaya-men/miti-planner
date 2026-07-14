// src/lib/__tests__/housingAuthHeaders.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('id-token') } },
  // トークン付与を検証するテストのため、真値インスタンスを返す (peek/ensure どちらでも通す)
  ensureAppCheck: () => ({}),
  getActiveAppCheck: () => ({}),
}));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

import { buildHousingHeaders } from '../housingAuthHeaders';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildHousingHeaders', () => {
  it('App Check トークンを X-Firebase-AppCheck ヘッダに付ける', async () => {
    const headers = await buildHousingHeaders(false);
    expect(headers['X-Firebase-AppCheck']).toBe('app-check-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('requireAuth=true で Authorization Bearer を付ける', async () => {
    const headers = await buildHousingHeaders(true);
    expect(headers['Authorization']).toBe('Bearer id-token');
    expect(headers['X-Firebase-AppCheck']).toBe('app-check-token');
  });
});
