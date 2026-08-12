import { describe, it, expect } from "vitest";
import { shouldSyncFirestore, FIRESTORE_SYNC_MIN_INTERVAL_MS } from "./saveThrottle";

describe("shouldSyncFirestore", () => {
  it("force=true は間隔に関わらず常に true", () => {
    expect(shouldSyncFirestore(true, Date.now(), Date.now())).toBe(true);
  });

  it("lastSyncAt=0(未実施)は初回として true", () => {
    expect(shouldSyncFirestore(false, 0, Date.now())).toBe(true);
  });

  it("前回反映から間隔未満なら false(間引く)", () => {
    const now = 1_000_000_000;
    const lastSyncAt = now - (FIRESTORE_SYNC_MIN_INTERVAL_MS - 1);
    expect(shouldSyncFirestore(false, lastSyncAt, now)).toBe(false);
  });

  it("前回反映からちょうど間隔経過していれば true", () => {
    const now = 1_000_000_000;
    const lastSyncAt = now - FIRESTORE_SYNC_MIN_INTERVAL_MS;
    expect(shouldSyncFirestore(false, lastSyncAt, now)).toBe(true);
  });

  it("前回反映から間隔を超えていれば true", () => {
    const now = 1_000_000_000;
    const lastSyncAt = now - FIRESTORE_SYNC_MIN_INTERVAL_MS - 1;
    expect(shouldSyncFirestore(false, lastSyncAt, now)).toBe(true);
  });
});
