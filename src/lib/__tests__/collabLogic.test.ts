import { describe, it, expect } from 'vitest';
import {
  isCollabAuthorized,
  decideLoad,
  decideSave,
  decideLoadFull,
  COLLAB_SECRET_HEADER,
  type MitigationRecord,
} from '../../../api/collab/_logic';

const m = (id: string): MitigationRecord => ({
  id, mitigationId: 'rampart', time: 10, duration: 20, ownerId: 'MT',
});

describe('isCollabAuthorized', () => {
  it('ヘッダがシークレットと一致すれば true', () => {
    const req = new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 's3cr3t' } });
    expect(isCollabAuthorized(req, 's3cr3t')).toBe(true);
  });
  it('不一致・欠落・空シークレットは false', () => {
    expect(isCollabAuthorized(new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 'bad' } }), 's3cr3t')).toBe(false);
    expect(isCollabAuthorized(new Request('https://x'), 's3cr3t')).toBe(false);
    expect(isCollabAuthorized(new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 'x' } }), '')).toBe(false);
  });
  it('注入した compare が使われる(タイミング安全比較の差し込み口)', () => {
    const calls: Array<[string, string]> = [];
    const compare = (a: string, b: string) => { calls.push([a, b]); return true; };
    const req = new Request('https://x', { headers: { [COLLAB_SECRET_HEADER]: 'provided' } });
    expect(isCollabAuthorized(req, 'expected', compare)).toBe(true);
    expect(calls).toEqual([['provided', 'expected']]);
  });
});

describe('decideLoad', () => {
  it('存在しない → deleted 扱い', () => {
    expect(decideLoad(null)).toEqual({ deleted: true });
  });
  it('墓標 → deleted', () => {
    expect(decideLoad({ deleted: true, data: { timelineMitigations: [m('a')] } })).toEqual({ deleted: true });
  });
  it('live → mitigations を返す(欠落は空配列)', () => {
    expect(decideLoad({ data: { timelineMitigations: [m('a')] } })).toEqual({ mitigations: [m('a')] });
    expect(decideLoad({ data: {} })).toEqual({ mitigations: [] });
  });
});

describe('decideSave', () => {
  it('存在しない → not-found でスキップ', () => {
    expect(decideSave(null)).toEqual({ skip: 'not-found' });
  });
  it('墓標 → deleted でスキップ(削除が勝つ)', () => {
    expect(decideSave({ deleted: true, version: 3 })).toEqual({ skip: 'deleted' });
  });
  it('live → ok + 次 version', () => {
    expect(decideSave({ version: 3 })).toEqual({ ok: true, nextVersion: 4 });
    expect(decideSave({})).toEqual({ ok: true, nextVersion: 1 }); // version 欠落は 0 扱い
  });
});

describe('decideLoadFull (全PlanData seed)', () => {
  const data = {
    timelineMitigations: [m('a')],
    timelineEvents: [{ id: 'e1', time: 30, name: { ja: '技' }, damageType: 'magical' }],
    phases: [{ id: 'p1', name: { ja: 'P1' }, startTime: 0, endTime: 60 }],
    labels: [],
    memos: [],
    currentLevel: 90,
    aaSettings: { damage: 0, type: 'magical', target: 'MT' },
    schAetherflowPatterns: { H2: 2 },
  };
  it('存在しない/墓標 → deleted', () => {
    expect(decideLoadFull(null)).toEqual({ deleted: true });
    expect(decideLoadFull({ deleted: true, data })).toEqual({ deleted: true });
  });
  it('live → 全要素を返す(欠落配列は[]・スカラーはundefined)', () => {
    expect(decideLoadFull({ data })).toEqual({
      mitigations: data.timelineMitigations,
      timelineEvents: data.timelineEvents,
      phases: data.phases,
      labels: [],
      memos: [],
      currentLevel: 90,
      aaSettings: data.aaSettings,
      schAetherflowPatterns: data.schAetherflowPatterns,
    });
    expect(decideLoadFull({ data: {} })).toEqual({
      mitigations: [], timelineEvents: [], phases: [], labels: [], memos: [],
      currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined,
    });
  });
});
