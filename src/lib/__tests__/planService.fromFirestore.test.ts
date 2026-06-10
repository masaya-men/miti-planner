import { describe, it, expect } from 'vitest';
import { fromFirestore } from '../planService';

describe('fromFirestore: activeCollabRoomToken', () => {
  it('Firestore に token があれば SavedPlan に乗せる', () => {
    const p = fromFirestore('plan1', { ownerId: 'u', ownerDisplayName: 'n', title: 't', contentId: 'c', isPublic: false, copyCount: 0, useCount: 0, data: {}, version: 1, activeCollabRoomToken: 'tok123' } as any);
    expect(p.activeCollabRoomToken).toBe('tok123');
  });
  it('token が無ければ未設定', () => {
    const p = fromFirestore('plan1', { ownerId: 'u', ownerDisplayName: 'n', title: 't', contentId: 'c', isPublic: false, copyCount: 0, useCount: 0, data: {}, version: 1 } as any);
    expect(p.activeCollabRoomToken).toBeUndefined();
  });
});
