import { describe, it, expect } from 'vitest';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../multiSourceGuards';

describe('isDuplicatePostUrl', () => {
  it('既存リストに同じURLがあれば true', () => {
    expect(isDuplicatePostUrl(['https://x.com/a/status/1'], 'https://x.com/a/status/1')).toBe(true);
  });
  it('既存リストに無ければ false', () => {
    expect(isDuplicatePostUrl(['https://x.com/a/status/1'], 'https://x.com/a/status/2')).toBe(false);
  });
  it('空リストなら常に false', () => {
    expect(isDuplicatePostUrl([], 'https://x.com/a/status/1')).toBe(false);
  });
});

describe('shouldRejectIncomingVideo', () => {
  it('既存動画が無ければ拒否しない', () => {
    expect(shouldRejectIncomingVideo(false, true)).toBe(false);
  });
  it('既存動画があり今回も動画付きなら拒否する', () => {
    expect(shouldRejectIncomingVideo(true, true)).toBe(true);
  });
  it('既存動画があっても今回動画が無ければ拒否しない', () => {
    expect(shouldRejectIncomingVideo(true, false)).toBe(false);
  });
});
