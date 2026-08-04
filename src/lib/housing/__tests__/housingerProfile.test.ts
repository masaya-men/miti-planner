import { describe, it, expect } from 'vitest';
import {
  validateHousingerSnsUrl,
  personalTagIdForUid,
  ownerUidFromPersonalFilterId,
  isValidHousingerReportReason,
  stripHashedPrefix,
  normalizeHousingerUid,
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

describe('stripHashedPrefix / normalizeHousingerUid (#3 共有 URL 短縮)', () => {
  it('stripHashedPrefix: hashed: prefix を剥がす (無ければそのまま)', () => {
    expect(stripHashedPrefix('hashed:d34d9c')).toBe('d34d9c');
    expect(stripHashedPrefix('d34d9c')).toBe('d34d9c');
  });
  it('normalizeHousingerUid: prefix 無しには付け、有れば no-op (後方互換)', () => {
    expect(normalizeHousingerUid('d34d9c')).toBe('hashed:d34d9c');
    expect(normalizeHousingerUid('hashed:d34d9c')).toBe('hashed:d34d9c');
  });
  it('strip → normalize は往復して内部 ID 形式に戻る (URL 短縮の可逆性)', () => {
    const internal = 'hashed:d34d9c';
    expect(normalizeHousingerUid(stripHashedPrefix(internal))).toBe(internal);
  });
});

describe('isValidHousingerReportReason', () => {
  it('定義済み4種のみ true', () => {
    expect(isValidHousingerReportReason('impersonation')).toBe(true);
    expect(isValidHousingerReportReason('nsfw')).toBe(false);
  });
});

describe('ownerUidFromPersonalFilterId', () => {
  it('personalTagIdForUid の逆変換 (personal_<hex> → hashed:<hex>)', () => {
    expect(ownerUidFromPersonalFilterId('personal_abc123')).toBe('hashed:abc123');
  });

  it('personalTagIdForUid と往復して元の uid に戻る', () => {
    const uid = 'hashed:abc123';
    expect(ownerUidFromPersonalFilterId(personalTagIdForUid(uid))).toBe(uid);
  });
});
