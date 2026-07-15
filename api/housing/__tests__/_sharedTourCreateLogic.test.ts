import { describe, it, expect } from 'vitest';
import {
  parseCreateSharedTourRequest,
  resolveHostQuota,
  SHARED_TOUR_MAX_BYTES,
  SHARED_TOUR_HOST_HARD_CAP,
} from '../_sharedTourCreateLogic.js';

describe('parseCreateSharedTourRequest', () => {
  it('空は reject', () => {
    expect(parseCreateSharedTourRequest({ snapshot: [] })).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('101件は reject', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}` }));
    expect(parseCreateSharedTourRequest({ snapshot: many })).toMatchObject({ ok: false, reason: 'too_many' });
  });

  it('正常は containsHiddenAddress を算出', () => {
    const r = parseCreateSharedTourRequest({ snapshot: [{ id: 'a', visibility: 'unlisted' }] });
    expect(r).toMatchObject({ ok: true, containsHiddenAddress: true });
  });

  it('公開のみなら containsHiddenAddress は false', () => {
    const r = parseCreateSharedTourRequest({ snapshot: [{ id: 'a', visibility: 'public' }] });
    expect(r).toMatchObject({ ok: true, containsHiddenAddress: false });
  });

  it('body が object でない、または snapshot が配列でなければ bad_shape', () => {
    expect(parseCreateSharedTourRequest(null)).toMatchObject({ ok: false, reason: 'bad_shape' });
    expect(parseCreateSharedTourRequest({ snapshot: 'not-an-array' })).toMatchObject({ ok: false, reason: 'bad_shape' });
  });

  it('要素に id (string) が無ければ bad_shape', () => {
    expect(parseCreateSharedTourRequest({ snapshot: [{ noId: true }] })).toMatchObject({ ok: false, reason: 'bad_shape' });
    expect(parseCreateSharedTourRequest({ snapshot: [{ id: 123 }] })).toMatchObject({ ok: false, reason: 'bad_shape' });
    expect(parseCreateSharedTourRequest({ snapshot: ['not-an-object'] })).toMatchObject({ ok: false, reason: 'bad_shape' });
  });

  it('巨大スナップショットは too_large', () => {
    const big = [{ id: 'a', description: 'x'.repeat(SHARED_TOUR_MAX_BYTES + 10) }];
    expect(parseCreateSharedTourRequest({ snapshot: big })).toMatchObject({ ok: false, reason: 'too_large' });
  });
});

describe('resolveHostQuota', () => {
  it('上限未満は ok', () => expect(resolveHostQuota(0, 1)).toBe('ok'));
  it('上限で evict', () => expect(resolveHostQuota(1, 1)).toBe('evict'));
  it('ハードキャップで reject', () => expect(resolveHostQuota(SHARED_TOUR_HOST_HARD_CAP, 1)).toBe('reject'));
});
