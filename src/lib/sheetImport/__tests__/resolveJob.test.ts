import { describe, it, expect } from 'vitest';
import { resolveJobId } from '../resolveJob';
import type { Job } from '../../../types';

const J = (id: string, ja: string, en: string): Job =>
  ({ id, name: { ja, en }, role: 'tank', icon: '' } as Job);

const JOBS: Job[] = [
  J('pld', 'ナイト', 'Paladin'),
  { id: 'whm', name: { ja: '白魔道士', en: 'White Mage', ko: '백마도사', zh: '白魔法师' }, role: 'healer', icon: '' } as Job,
];

describe('resolveJobId', () => {
  it('日英中韓のジョブ名で解決', () => {
    expect(resolveJobId('ナイト', JOBS)).toBe('pld');
    expect(resolveJobId('Paladin', JOBS)).toBe('pld');
    expect(resolveJobId('白魔道士', JOBS)).toBe('whm');
    expect(resolveJobId('White Mage', JOBS)).toBe('whm');
    expect(resolveJobId('백마도사', JOBS)).toBe('whm');
    expect(resolveJobId('白魔法师', JOBS)).toBe('whm');
  });
  it('前後空白を許容', () => {
    expect(resolveJobId('  ナイト ', JOBS)).toBe('pld');
  });
  it('未知ジョブは null', () => {
    expect(resolveJobId('未知', JOBS)).toBeNull();
    expect(resolveJobId('', JOBS)).toBeNull();
  });
});
