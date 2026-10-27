import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error mjs の共通部品(型定義なし)
import { shootCondition } from '../lib/shoot.mjs';

describe('shootCondition の失敗時', () => {
  it('撮影が失敗(例外)したら outFile を残さない(save-as で基準に混入させない)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-shoot-'));
    const out = path.join(dir, 'k.png');
    fs.writeFileSync(out, 'stale');
    // context が壊れていて installDeterminism が例外を投げる → catch 経路
    const browser = { newContext: async () => ({ close: async () => {} }) };
    const cond = { key: 'k', entry: { route: '/', ready: 'body', storage: () => ({}) }, vp: '1489', theme: 'dark', lang: 'ja' };
    const r = await shootCondition(browser, 'http://localhost:1', cond, out);
    expect(r.ok).toBe(false);
    expect(fs.existsSync(out)).toBe(false);
  });
});
