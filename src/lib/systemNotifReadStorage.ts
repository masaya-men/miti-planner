import type { SystemNotifReadState } from '../types/systemNotification';

export const STORAGE_KEY = 'lopo:system_notifs:read';

const EMPTY: SystemNotifReadState = { readIds: [], updatedAt: 0 };

export function loadReadState(): SystemNotifReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<SystemNotifReadState>;
    if (!Array.isArray(parsed.readIds)) return { ...EMPTY };
    return {
      readIds: parsed.readIds.filter((x): x is string => typeof x === 'string'),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveReadState(state: SystemNotifReadState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可 (quota / private mode) は無視 — UI は引き続き機能、 ただし既読は session 限り
  }
}

export function markRead(id: string): void {
  const state = loadReadState();
  if (state.readIds.includes(id)) return;
  saveReadState({
    readIds: [...state.readIds, id],
    updatedAt: Date.now(),
  });
}

export function isRead(id: string): boolean {
  return loadReadState().readIds.includes(id);
}
