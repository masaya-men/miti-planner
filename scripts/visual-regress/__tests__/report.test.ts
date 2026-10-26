import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
// @ts-expect-error mjs の共通部品(型定義なし)
import { sortForReport, bboxOfMask, buildReportHtml, buildReport } from '../lib/report.mjs';

const row = (key: string, status: string, ratio: number, extra: object = {}) => ({ key, status, ratio, tol: 0.001, ...extra });

describe('sortForReport', () => {
  it('撮影失敗 → broken → unsure → 未仕分け → intended、同順位は ratio 降順', () => {
    const rows = [
      row('intended-a', 'diff', 0.5), row('plain-small', 'diff', 0.1), row('plain-big', 'diff', 0.3),
      row('unsure-a', 'diff', 0.2), row('broken-a', 'diff', 0.05), row('broken-b', 'diff', 0.4),
      row('fail-a', 'fail-head', 1), row('fail-b', 'fail-base', 1),
    ];
    const verdicts = {
      'intended-a': { verdict: 'intended', reason: '' }, 'unsure-a': { verdict: 'unsure', reason: '' },
      'broken-a': { verdict: 'broken', reason: '' }, 'broken-b': { verdict: 'broken', reason: '' },
    };
    const keys = sortForReport(rows, verdicts).map((r: { key: string }) => r.key);
    expect(keys.slice(0, 2).sort()).toEqual(['fail-a', 'fail-b']);
    expect(keys.slice(2)).toEqual(['broken-b', 'broken-a', 'unsure-a', 'plain-big', 'plain-small', 'intended-a']);
  });
});

describe('bboxOfMask', () => {
  it('離れた 2 ブロックを含む最小矩形(画素 = ブロック×8)', () => {
    const bw = 10, bh = 8, mask = new Uint8Array(bw * bh);
    mask[1 * bw + 2] = 1; mask[5 * bw + 7] = 1;
    expect(bboxOfMask(mask, bw, bh)).toEqual({ x: 16, y: 8, w: 48, h: 40 });
  });
  it('空なら null', () => {
    expect(bboxOfMask(new Uint8Array(12), 4, 3)).toBeNull();
  });
});

describe('buildReportHtml', () => {
  it('fail と sizeMismatch の行が必ず出る', () => {
    const html = buildReportHtml({
      name: 't',
      rows: [
        row('a/fail', 'fail-head', 1, { error: '撮影でタイムアウト' }),
        row('b/size', 'diff', 1, { sizeMismatch: 'base 100x200 / head 100x300' }),
        row('c/same', 'same', 0),
      ],
      verdicts: { 'b/size': { verdict: 'broken', reason: '高さが伸びた' } },
    });
    expect(html).toContain('a/fail');
    expect(html).toContain('撮影でタイムアウト');
    expect(html).toContain('b/size');
    expect(html).toContain('base 100x200 / head 100x300');
    expect(html).toContain('高さが伸びた');
    expect(html).not.toContain('c/same'); // 同じ画面は行に出さない
  });
  it('mask で隠した領域の一覧が出る', () => {
    const html = buildReportHtml({
      name: 't',
      rows: [row('m/one', 'same', 0, { masks: [{ selector: '.clock', reason: '時刻表示は毎回変わる' }] })],
      verdicts: {},
    });
    expect(html).toContain('.clock');
    expect(html).toContain('時刻表示は毎回変わる');
  });
  it('HTML を壊す文字はエスケープする', () => {
    const html = buildReportHtml({ name: 't', rows: [row('x', 'fail-head', 1, { error: '<script>x</script>' })], verdicts: {} });
    expect(html).not.toContain('<script>x');
  });
});

describe('buildReport(実画像)', () => {
  it('overlay・crop・report.html を作り、verdicts を反映する', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-report-'));
    const mk = async (gray: number, patch: boolean) => {
      const w = 200, h = 120, data = Buffer.alloc(w * h * 3, gray);
      if (patch) for (let y = 40; y < 56; y++) for (let x = 80; x < 96; x++) { const i = (y * w + x) * 3; data[i] = data[i + 1] = data[i + 2] = 0; }
      return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    };
    fs.mkdirSync(path.join(dir, 'base', 'a'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'head', 'a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'base', 'a', 'k.png'), await mk(200, false));
    fs.writeFileSync(path.join(dir, 'head', 'a', 'k.png'), await mk(200, true));
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ 'a/k': { status: 'diff', ratio: 0.02, tol: 0.001 } }));
    fs.writeFileSync(path.join(dir, 'verdicts.json'), JSON.stringify({ 'a/k': { verdict: 'intended', reason: '意図した変更' } }));
    // key に / を含むのでファイルは base/a/k.png
    await buildReport(dir);
    const html = fs.readFileSync(path.join(dir, 'report.html'), 'utf8');
    expect(html).toContain('意図した変更');
    expect(html).toContain('crops/a/k.png');
    const crop = await sharp(path.join(dir, 'crops', 'a', 'k.png')).metadata();
    expect(Math.max(crop.width!, crop.height!)).toBeLessThanOrEqual(1200);
    expect(fs.existsSync(path.join(dir, 'overlay', 'a', 'k.png'))).toBe(true);
  });

  it('大きさが違うとき、head が伸びた領域も切り出しに入る', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-report-'));
    const solid = (w: number, h: number, gray: number) => sharp(Buffer.alloc(w * h * 3, gray), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    fs.mkdirSync(path.join(dir, 'base'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'head'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'base', 'k.png'), await solid(100, 100, 200));
    fs.writeFileSync(path.join(dir, 'head', 'k.png'), await solid(100, 300, 200));
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ k: { status: 'diff', ratio: 1, tol: 0.001, sizeMismatch: 'base 100x100 / head 100x300' } }));
    await buildReport(dir);
    const crop = await sharp(path.join(dir, 'crops', 'k.png')).metadata();
    // base だけの大きさ(100x100)で切ると高さ/幅は約 0.3。伸びた領域(~300 高さ)を含めば 0.5 を超える
    expect(crop.height! / crop.width!).toBeGreaterThan(0.5);
  });
  it('fail 行に偽の差・許容の数字を出さない', () => {
    const html = buildReportHtml({ name: 't', rows: [row('f', 'fail-head', 1, { tol: 0, error: 'boom' })], verdicts: {} });
    expect(html).toContain('boom');
    expect(html).not.toContain('100.00%');
  });
});
