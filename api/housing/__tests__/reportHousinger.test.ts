import { describe, it, expect } from 'vitest';
import { validateReportHousingerBody } from '../_reportHousingerHandler.js';

describe('validateReportHousingerBody', () => {
  it('housingerUid が無ければ invalid_housingerUid', () => {
    expect(validateReportHousingerBody({ reason: 'other', comment: 'x' })).toEqual({
      ok: false,
      error: 'invalid_housingerUid',
    });
  });

  it('reason が定義済み4種以外なら invalid_reason', () => {
    expect(
      validateReportHousingerBody({ housingerUid: 'hashed:abc', reason: 'nsfw' }),
    ).toEqual({ ok: false, error: 'invalid_reason' });
  });

  it('reason=other でコメント無しなら comment_required', () => {
    expect(
      validateReportHousingerBody({ housingerUid: 'hashed:abc', reason: 'other' }),
    ).toEqual({ ok: false, error: 'comment_required' });
    expect(
      validateReportHousingerBody({ housingerUid: 'hashed:abc', reason: 'other', comment: '   ' }),
    ).toEqual({ ok: false, error: 'comment_required' });
  });

  it('reason=other でコメントありなら ok', () => {
    const r = validateReportHousingerBody({
      housingerUid: 'hashed:abc',
      reason: 'other',
      comment: '不適切です',
    });
    expect(r.ok).toBe(true);
  });

  it('reason が other 以外ならコメント無しでも ok', () => {
    expect(
      validateReportHousingerBody({ housingerUid: 'hashed:abc', reason: 'impersonation' }).ok,
    ).toBe(true);
  });
});
