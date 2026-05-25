import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadReadState,
  saveReadState,
  markRead,
  isRead,
  STORAGE_KEY,
} from '../systemNotifReadStorage';

describe('systemNotifReadStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('初回 loadReadState は空の readIds を返す', () => {
    const state = loadReadState();
    expect(state.readIds).toEqual([]);
    expect(state.updatedAt).toBe(0);
  });

  it('saveReadState で永続化、 loadReadState で復元できる', () => {
    saveReadState({ readIds: ['a', 'b'], updatedAt: 123 });
    const state = loadReadState();
    expect(state.readIds).toEqual(['a', 'b']);
    expect(state.updatedAt).toBe(123);
  });

  it('markRead は id を追加して updatedAt を更新する', () => {
    const before = Date.now();
    markRead('notif-1');
    const state = loadReadState();
    expect(state.readIds).toContain('notif-1');
    expect(state.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('markRead は重複 id を追加しない', () => {
    markRead('notif-1');
    markRead('notif-1');
    const state = loadReadState();
    expect(state.readIds.filter((x) => x === 'notif-1')).toHaveLength(1);
  });

  it('isRead は readIds にあれば true、 無ければ false', () => {
    markRead('notif-1');
    expect(isRead('notif-1')).toBe(true);
    expect(isRead('notif-2')).toBe(false);
  });

  it('壊れた JSON が保存されていても loadReadState は空を返す', () => {
    localStorage.setItem(STORAGE_KEY, 'this is not json');
    const state = loadReadState();
    expect(state.readIds).toEqual([]);
  });
});
