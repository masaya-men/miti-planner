import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error mjs(型定義なし)
import { planBaseWorktree, staleBaseDirs } from '../lib/servers.mjs';
// @ts-expect-error mjs(型定義なし)
import { exitCodeOf, validateRunName, isInside } from '../run.mjs';

describe('planBaseWorktree', () => {
  it('短いハッシュ名で、.claude/worktrees を含まない', () => {
    const p = planBaseWorktree('abc1234567890', 'C:/tmp');
    expect(p.name).toBe('lopo-vr-base-abc1234');
    expect(p.dir.replace(/\\/g, '/')).toBe('C:/tmp/lopo-vr-base-abc1234');
    expect(p.dir).not.toContain('.claude');
  });
});

describe('staleBaseDirs', () => {
  it('lopo-vr-base- で始まるフォルダだけ返す', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-stale-'));
    try {
      fs.mkdirSync(path.join(root, 'lopo-vr-base-aaa1111'));
      fs.mkdirSync(path.join(root, 'other-dir'));
      fs.writeFileSync(path.join(root, 'lopo-vr-base-file'), '');
      const r = staleBaseDirs(root).map((d: string) => path.basename(d));
      expect(r).toEqual(['lopo-vr-base-aaa1111']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('exitCodeOf', () => {
  const r = (s: string) => ({ ratio: 0, tol: 0, status: s });
  it('全部 same は 0', () => expect(exitCodeOf({ a: r('same'), b: r('same') })).toBe(0));
  it('diff だけなら 1', () => expect(exitCodeOf({ a: r('same'), b: r('diff') })).toBe(1));
  it('diff と fail が混在すると 2', () => expect(exitCodeOf({ a: r('diff'), b: r('fail-head') })).toBe(2));
});

describe('validateRunName / isInside', () => {
  it('安全な名前は通し、危ない名前は拒否する', () => {
    expect(validateRunName('before-001')).toBeNull();
    for (const bad of ['', '.', '..', '../..', 'a/b', 'a\\b', '/abs', 'C:\\x', 'C:x']) expect(validateRunName(bad), bad).not.toBeNull();
  });
  it('isInside は root の外・root 自身を false にする', () => {
    expect(isInside('/o/.out', '/o/.out/x')).toBe(true);
    expect(isInside('/o/.out', '/o/.out')).toBe(false);
    expect(isInside('/o/.out', '/o/x')).toBe(false);
  });
});
