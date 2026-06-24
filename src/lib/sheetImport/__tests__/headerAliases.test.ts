import { describe, it, expect } from 'vitest';
import { detectField } from '../headerAliases';
import type { Job } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
];

describe('detectField', () => {
  it('正典フィールドを見出しから判定', () => {
    expect(detectField('フェーズ', JOBS).field).toBe('phase');
    expect(detectField('ラベル', JOBS).field).toBe('label');
    expect(detectField('時間', JOBS).field).toBe('time');
    expect(detectField('Time', JOBS).field).toBe('time');
    expect(detectField('敵の攻撃', JOBS).field).toBe('action');
    expect(detectField('Action', JOBS).field).toBe('action');
    expect(detectField('ダメージ', JOBS).field).toBe('damage');
    expect(detectField('Damage', JOBS).field).toBe('damage');
    expect(detectField('攻撃の対象', JOBS).field).toBe('target');
    expect(detectField('ダメージ種別', JOBS).field).toBe('damageType');
    expect(detectField('Type', JOBS).field).toBe('damageType');
  });
  it('ジョブ名見出しは member 列(jobId 付き)', () => {
    const r = detectField('ナイト', JOBS);
    expect(r.field).toBe('member');
    expect(r.jobId).toBe('pld');
  });
  it('判定不能は unknown', () => {
    expect(detectField('最大HP', JOBS).field).toBe('unknown');
    expect(detectField('', JOBS).field).toBe('unknown');
  });
});
