// @ts-check
/**
 * 差ありだけの報告ページと、Claude が仕分けに読む切り出し画像を作る。
 *   .out/<name>/report.html  人が開く(相対パスで PNG を参照・外部資源なし)
 *   .out/<name>/overlay/<key>.png  head に差のブロックを赤く重ねた画像
 *   .out/<name>/crops/<key>.png    差の外接矩形+余白 48px を base | head | overlay で横並び(長辺 1200px 以下)
 *   .out/<name>/verdicts.json      Claude が書く { key: { verdict: 'intended'|'broken'|'unsure', reason } }
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { diffPng, BLOCK } from './diff.mjs';

const CROP_MARGIN = 48; // 切り出しの余白(画素)
const CROP_MAX_SIDE = 1200; // 切り出しの長辺の上限(Claude が読むトークンを抑える)
const GAP = 8; // 3 枚の間の隙間

/**
 * 並び順 = 撮影失敗 → broken → unsure → 未仕分け → intended。同順位は ratio の大きい順。
 * @param {{ key: string, status: string, ratio: number }[]} rows
 * @param {Record<string, { verdict: string }>} verdicts
 */
export function sortForReport(rows, verdicts) {
  const rank = (/** @type {{ key: string, status: string }} */ r) => {
    if (r.status.startsWith('fail')) return 0;
    const v = verdicts[r.key]?.verdict;
    if (v === 'broken') return 1;
    if (v === 'unsure') return 2;
    if (v === 'intended') return 4;
    return 3;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.ratio - a.ratio);
}

/**
 * 1 のブロックをすべて含む最小矩形(画素単位)。無ければ null。
 * @param {Uint8Array} mask
 * @param {number} bw
 * @param {number} bh
 */
export function bboxOfMask(mask, bw, bh) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!mask[y * bw + x]) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { x: x0 * BLOCK, y: y0 * BLOCK, w: (x1 - x0 + 1) * BLOCK, h: (y1 - y0 + 1) * BLOCK };
}

const ESC_MAP = /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
/** @param {unknown} s */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c] ?? c);
/** 相対 URL(区切りの / は残し、@ などは符号化) */
const url = (/** @type {string} */ p) => p.split('/').map(encodeURIComponent).join('/');

const VERDICT_LABEL = /** @type {Record<string, string>} */ ({ intended: '意図した変更', broken: '壊れている', unsure: '要確認' });
const STATUS_LABEL = /** @type {Record<string, string>} */ ({ diff: '差あり', 'fail-base': '撮影失敗(base)', 'fail-head': '撮影失敗(head)' });

/**
 * 報告 HTML の文字列。同じ画面(same)の行は出さず、mask の一覧だけ全件から集める。
 * @param {{ name: string, rows: any[], verdicts: Record<string, { verdict: string, reason: string }> }} p
 */
export function buildReportHtml({ name, rows, verdicts }) {
  const count = { same: 0, diff: 0, fail: 0, masked: 0 };
  for (const r of rows) {
    if (r.status === 'same') count.same++;
    else if (r.status === 'diff') count.diff++;
    else count.fail++;
    if (r.masks?.length) count.masked++;
  }
  const shown = sortForReport(rows.filter((r) => r.status !== 'same'), verdicts);
  const img = (/** @type {string|undefined} */ p, /** @type {string} */ label) => p
    ? `<figure><a href="${esc(url(p))}"><img loading="lazy" src="${esc(url(p))}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`
    : `<figure class="none"><div>画像なし</div><figcaption>${label}</figcaption></figure>`;
  const rowHtml = shown.map((r) => {
    const v = verdicts[r.key];
    const vcls = v ? `v-${esc(v.verdict)}` : 'v-none';
    const vtxt = v ? `${esc(VERDICT_LABEL[v.verdict] ?? v.verdict)}: ${esc(v.reason)}` : '未仕分け';
    const im = r.images ?? {};
    return `<section class="row ${r.status.startsWith('fail') ? 'is-fail' : ''}">
<h2>${esc(r.key)}</h2>
<p class="meta"><span class="st">${esc(STATUS_LABEL[r.status] ?? r.status)}</span> 差 ${(r.ratio * 100).toFixed(2)}% / 許容 ${(r.tol * 100).toFixed(2)}% <span class="verdict ${vcls}">${vtxt}</span></p>
${r.sizeMismatch ? `<p class="warn">画像の大きさが違います: ${esc(r.sizeMismatch)}</p>` : ''}
${r.error ? `<pre class="err">${esc(r.error)}</pre>` : ''}
<div class="imgs">${img(im.base, 'base')}${img(im.head, 'head')}${img(im.overlay, '差(赤)')}</div>
${im.crop ? `<p><a href="${esc(url(im.crop))}">切り出し画像を開く</a></p>` : ''}
</section>`;
  }).join('\n');
  const maskItems = rows.filter((r) => r.masks?.length).map((r) =>
    `<li><b>${esc(r.key)}</b><ul>${r.masks.map((/** @type {{selector:string,reason:string}} */ m) => `<li><code>${esc(m.selector)}</code> ${esc(m.reason)}</li>`).join('')}</ul></li>`).join('');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>見た目の回帰 報告 ${esc(name)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--sub:#666;--line:#ccc;--card:#f6f6f6;--bad:#c62828;--ok:#2e7d32;--warn:#b26a00}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#e8e8e8;--sub:#9a9a9a;--line:#3a3a3a;--card:#202020;--bad:#ef5350;--ok:#66bb6a;--warn:#ffb74d}}
body{margin:0;padding:16px 24px;background:var(--bg);color:var(--fg);font:14px/1.6 system-ui,"Yu Gothic",sans-serif;max-width:1489px}
h1{font-size:20px}h2{font-size:15px;margin:0 0 4px;word-break:break-all}
.sum span{display:inline-block;margin-right:16px;padding:2px 10px;border:1px solid var(--line);border-radius:4px}
.row{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 16px;margin:12px 0}
.row.is-fail{border-color:var(--bad)}
.meta{margin:0 0 6px;color:var(--sub)}.verdict{margin-left:12px;font-weight:bold}
.v-broken{color:var(--bad)}.v-intended{color:var(--ok)}.v-unsure{color:var(--warn)}.v-none{color:var(--sub)}
.warn{color:var(--warn);margin:4px 0}.err{color:var(--bad);white-space:pre-wrap;margin:4px 0}
.imgs{display:flex;gap:12px;flex-wrap:wrap}.imgs figure{margin:0;flex:1 1 30%;min-width:260px}
.imgs img{max-width:100%;max-height:360px;border:1px solid var(--line);display:block}
.none div{padding:40px 0;text-align:center;color:var(--sub);border:1px dashed var(--line)}
figcaption{color:var(--sub);font-size:12px}a{color:inherit}code{background:var(--card);padding:0 4px}
</style></head><body>
<h1>見た目の回帰 報告(${esc(name)})</h1>
<p class="sum"><span>同じ ${count.same}</span><span>差あり ${count.diff}</span><span>撮影失敗 ${count.fail}</span><span>mask あり ${count.masked}</span></p>
${shown.length ? rowHtml : '<p>差のある画面・撮影に失敗した画面はありません。</p>'}
<h2>隠した領域(mask)</h2>
${maskItems ? `<ul>${maskItems}</ul>` : '<p>なし</p>'}
</body></html>
`;
}

/** 範囲 (x,y,w,h) を画像から切り出し、足りない部分は灰色で埋めて w×h にする */
async function region(/** @type {Buffer} */ png, /** @type {{x:number,y:number,w:number,h:number}} */ r) {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const w = Math.max(0, Math.min(r.w, W - r.x)), h = Math.max(0, Math.min(r.h, H - r.y));
  const bg = { create: { width: r.w, height: r.h, channels: /** @type {4} */ (4), background: { r: 128, g: 128, b: 128, alpha: 1 } } };
  if (w <= 0 || h <= 0) return sharp(bg).png().toBuffer();
  const part = await sharp(png).extract({ left: r.x, top: r.y, width: w, height: h }).png().toBuffer();
  return sharp(bg).composite([{ input: part, left: 0, top: 0 }]).png().toBuffer();
}

/** head に差のブロックを半透明の赤で重ねる */
async function overlayOf(/** @type {Buffer} */ head, /** @type {Uint8Array} */ mask, /** @type {number} */ bw, /** @type {number} */ bh) {
  const meta = await sharp(head).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const layer = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    if (bx < bw && by < bh && mask[by * bw + bx]) {
      const i = (y * W + x) * 4;
      layer[i] = 255; layer[i + 1] = 0; layer[i + 2] = 0; layer[i + 3] = 110;
    }
  }
  return sharp(head).ensureAlpha().composite([{ input: layer, raw: { width: W, height: H, channels: 4 }, left: 0, top: 0 }]).png().toBuffer();
}

/** base | head | overlay を横に並べ、長辺 CROP_MAX_SIDE 以下に縮小 */
async function cropOf(/** @type {Buffer} */ base, /** @type {Buffer} */ head, /** @type {Buffer} */ overlay, /** @type {{x:number,y:number,w:number,h:number}} */ bbox) {
  const x = Math.max(0, bbox.x - CROP_MARGIN), y = Math.max(0, bbox.y - CROP_MARGIN);
  const r = { x, y, w: bbox.x + bbox.w + CROP_MARGIN - x, h: bbox.y + bbox.h + CROP_MARGIN - y };
  const parts = await Promise.all([base, head, overlay].map((p) => region(p, r)));
  const totalW = r.w * 3 + GAP * 2;
  const sheet = await sharp({ create: { width: totalW, height: r.h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(parts.map((input, i) => ({ input, left: i * (r.w + GAP), top: 0 })))
    .png().toBuffer();
  return sharp(sheet).resize({ width: CROP_MAX_SIDE, height: CROP_MAX_SIDE, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}

/** @param {string} p */
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } }
/** @param {string} p @param {Buffer} buf */
function writePng(p, buf) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); }

/**
 * runDir の PNG・result.json・verdicts.json から overlay / crops / report.html を作り直す(撮影はしない)。
 * @param {string} runDir
 */
export async function buildReport(runDir) {
  /** @type {Record<string, any>} */
  const result = readJson(path.join(runDir, 'result.json'));
  const verdicts = readJson(path.join(runDir, 'verdicts.json'));
  const rows = [];
  for (const [key, r] of Object.entries(result)) {
    const rel = (/** @type {string} */ d) => `${d}/${key}.png`;
    const has = (/** @type {string} */ d) => fs.existsSync(path.join(runDir, rel(d)));
    /** @type {Record<string, string>} */
    const images = {};
    if (has('base')) images.base = rel('base');
    if (has('head')) images.head = rel('head');
    if (r.status === 'diff' && images.base && images.head) {
      const base = fs.readFileSync(path.join(runDir, images.base));
      const head = fs.readFileSync(path.join(runDir, images.head));
      const d = await diffPng(base, head);
      const bbox = bboxOfMask(d.mask, d.bw, d.bh);
      if (bbox) {
        const overlay = await overlayOf(head, d.mask, d.bw, d.bh);
        writePng(path.join(runDir, rel('overlay')), overlay);
        images.overlay = rel('overlay');
        writePng(path.join(runDir, rel('crops')), await cropOf(base, head, overlay, bbox));
        images.crop = rel('crops');
      }
    }
    rows.push({ key, ...r, images });
  }
  const name = path.basename(runDir);
  fs.writeFileSync(path.join(runDir, 'report.html'), buildReportHtml({ name, rows, verdicts }));
  return path.join(runDir, 'report.html');
}
