import { describe, it, expect } from 'vitest';
import {
  validateHousingerSnsUrl,
  personalTagIdForUid,
  isValidHousingerReportReason,
} from '../housingerProfile';

describe('validateHousingerSnsUrl', () => {
  it('許可ホスト (x.com) は ok', () => {
    expect(validateHousingerSnsUrl('https://x.com/lopo_ff14')).toEqual({ ok: true });
  });
  it('twitter.com / youtube.com / youtu.be / Lodestone (jp/na/eu) も ok', () => {
    for (const u of [
      'https://twitter.com/a',
      'https://www.youtube.com/@a',
      'https://youtu.be/abc',
      'https://jp.finalfantasyxiv.com/lodestone/character/12345/',
      'https://na.finalfantasyxiv.com/lodestone/character/12345/',
      'https://eu.finalfantasyxiv.com/lodestone/character/12345/',
    ]) expect(validateHousingerSnsUrl(u).ok, u).toBe(true);
  });
  it('http は not_https', () => {
    expect(validateHousingerSnsUrl('http://x.com/a')).toEqual({ ok: false, error: 'not_https' });
  });
  it('リスト外ホストは host_not_allowed (サブドメイン偽装 evil-x.com も拒否)', () => {
    expect(validateHousingerSnsUrl('https://evil.example.com/a').ok).toBe(false);
    expect(validateHousingerSnsUrl('https://evil-x.com/a').ok).toBe(false);
    expect(validateHousingerSnsUrl('https://x.com.evil.com/a').ok).toBe(false);
  });
  it('URL として不正なら invalid_url', () => {
    expect(validateHousingerSnsUrl('not a url')).toEqual({ ok: false, error: 'invalid_url' });
  });
});

describe('personalTagIdForUid', () => {
  it('hashed: prefix を剥がして personal_ を付ける (改名しても不変な決定的 ID)', () => {
    expect(personalTagIdForUid('hashed:abc123')).toBe('personal_abc123');
  });
  it('prefix なし uid はそのまま', () => {
    expect(personalTagIdForUid('abc123')).toBe('personal_abc123');
  });
});

describe('isValidHousingerReportReason', () => {
  it('定義済み4種のみ true', () => {
    expect(isValidHousingerReportReason('impersonation')).toBe(true);
    expect(isValidHousingerReportReason('nsfw')).toBe(false);
  });
});
