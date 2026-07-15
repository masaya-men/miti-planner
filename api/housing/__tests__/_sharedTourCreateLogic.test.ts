import { describe, it, expect } from 'vitest';
import { parseCreateSharedTourRequest } from '../_sharedTourCreateLogic.js';

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
});
