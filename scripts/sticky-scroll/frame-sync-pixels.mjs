// @ts-check
import sharp from 'sharp';

// ───────────────────────────── コマの画素から目印の x を読む ─────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** 洋紅(#f0f)の被覆率。背景が何色でも、被覆 c なら c になる(min(r,b)-g = 255c) */
const scoreMag = (r, g, b) => clamp01((Math.min(r, b) - g) / 255);
/** 水色(#0ff)の被覆率 */
const scoreCyan = (r, g, b) => clamp01((Math.min(g, b) - r) / 255);

/** 画素の列 [from, ...) から、最初の帯(被覆率 > 0.5)を探して { 重心 x, 終わり } を返す。太すぎる帯・見つからない時は null */
function findBand(buf, width, ch, row, score, from, maxRun) {
  const at = (x) => { const o = row + x * ch; return score(buf[o], buf[o + 1], buf[o + 2]); };
  let x = from;
  while (x < width && at(x) <= 0.5) x++;
  if (x >= width) return null;
  let s0 = x; while (s0 > from && at(s0 - 1) > 0.08) s0--; // 帯の始まりを弱い画素まで広げる
  let e = x; while (e < width - 1 && at(e + 1) > 0.08) e++;
  if (e - s0 + 1 > maxRun) return null;
  let sw = 0, sx = 0;
  for (let i = s0; i <= e; i++) { const w = at(i); sw += w; sx += w * (i + 0.5); }
  return sw > 0 ? { c: sx / sw, end: e } : null;
}
/** 1 行から、要素の縁の左の帯と右の帯を探す。{ l, r }(画素)。片方でも見つからなければ null(縁が切れている) */
function bandPair(buf, width, ch, y, score, maxRun) {
  const row = y * width * ch;
  const l = findBand(buf, width, ch, row, score, 0, maxRun);
  if (!l) return null;
  const r = findBand(buf, width, ch, row, score, l.end + 2, maxRun);
  return r ? { l: l.c, r: r.c } : null;
}
export const median = (a) => { const b = [...a].sort((p, q) => p - q); return b.length ? (b.length % 2 ? b[(b.length - 1) >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };

/**
 * 1 コマ(PNG の base64)から { xhs, xb }(CSS px・左の縁の重心)を読む。
 * 読めたことの条件(I4): 左と右の縁の帯が両方見え、その間隔が DOM の実測(幅 - 3px)と 1.5px 以内で一致すること。
 * 左端が入れ物の外へ切れると、別の縁(右の縁など)を左と取り違えて列の幅ぶんの嘘のずれが出る。間隔が合わないコマは null(=読めなかったコマ)にする。
 */
export async function readFrame(b64, rows, vpW) {
  const { data, info } = await sharp(Buffer.from(b64, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sx = info.width / vpW; // 画素 → CSS px
  const maxRun = Math.round(sx * 12);
  const xs = (ys, w0, score) => {
    const v = [];
    for (const yCss of ys) {
      const p = bandPair(data, info.width, 3, Math.min(info.height - 1, Math.max(0, Math.round(yCss * sx))), score, maxRun);
      if (p && Math.abs((p.r - p.l) / sx - (w0 - 3)) <= 1.5) v.push(p.l);
    }
    return v.length >= 2 ? median(v) / sx : null;
  };
  return { xhs: rows.headers.map((h) => xs(h.ys, h.w, scoreMag)), xb: xs(rows.body.ys, rows.body.w, scoreCyan), w: info.width, h: info.height };
}
