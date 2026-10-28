import { vi } from 'vitest';
import type { AppliedMitigation } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

export const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

export const mockHandlers = (): CollabHandlers => ({
  add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
  upsertItems: vi.fn(), removeItems: vi.fn(), insertItemAt: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(), batch: vi.fn(),
  undo: vi.fn(), redo: vi.fn(),
});
