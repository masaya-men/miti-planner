import { describe, it, expect } from 'vitest';
import { resolveImportEvents } from '../importModes';
import type { TimelineEvent } from '../../types';

const ev = (id: string, time: number): TimelineEvent => ({
  id, time, name: { ja: id, en: id }, damageType: 'magical',
});

describe('resolveImportEvents', () => {
  const current = [ev('a', 10), ev('b', 60)];
  const incoming = [ev('x', 5), ev('y', 70), ev('z', 60)];

  it('replace_all: 取り込み列で全置換・軽減クリア', () => {
    const r = resolveImportEvents(current, incoming, 'replace_all');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']); // time 昇順
    expect(r.clearMitigations).toBe(true);
    expect(r.appendFromTime).toBeNull();
  });

  it('replace_keep: 全置換だが軽減は残す', () => {
    const r = resolveImportEvents(current, incoming, 'replace_keep');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']);
    expect(r.clearMitigations).toBe(false);
    expect(r.appendFromTime).toBeNull();
  });

  it('append: 既存の最終時刻(60)より後だけ追加・既存は保持・軽減残す', () => {
    const r = resolveImportEvents(current, incoming, 'append');
    expect(r.events.map(e => e.id)).toEqual(['a', 'b', 'y']); // 既存a,b + 70のyのみ
    expect(r.clearMitigations).toBe(false);
    expect(r.appendFromTime).toBe(60);
  });

  it('append: 同時刻ちょうど(60)は取り込まない(既存優先)', () => {
    const r = resolveImportEvents(current, [ev('z', 60)], 'append');
    expect(r.events.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('append: 既存が空なら全件追加・appendFromTime は null', () => {
    const r = resolveImportEvents([], incoming, 'append');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']);
    expect(r.appendFromTime).toBeNull();
  });
});
