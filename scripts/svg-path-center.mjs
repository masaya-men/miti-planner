// SVG パス/矩形の幾何中心を正しく求める共有ヘルパ。
// 旧 parse-ward-svg.mjs の bboxCenter は「パスの全数値を単純に (x,y) ペアで拾う」実装で、
// H(水平)/V(垂直)/C(曲線) 等のコマンドを無視するため x/y がズレて中心が破損していた
// (角丸・縦横線を含む箱=アパート等で顕著)。ここではコマンドを正しく解釈し on-curve 点だけ集める。
// parse-ward-aetherytes.mjs の pathPoints と同一アルゴリズム。

const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** SVG path の d を正しくトークナイズし on-curve 点(端点)だけ返す。H/V=1引数, C=6引数の制御点は無視。絶対座標前提。 */
export function pathPoints(d) {
  const pts = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const toks = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = null;
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i].toUpperCase(); i++; if (cmd === 'Z') { cx = sx; cy = sy; continue; } }
    const n = ARGC[cmd] ?? 2;
    const a = [];
    for (let k = 0; k < n; k++) a.push(Number(toks[i++]));
    if (cmd === 'M') { cx = a[0]; cy = a[1]; sx = cx; sy = cy; pts.push([cx, cy]); }
    else if (cmd === 'L' || cmd === 'T') { cx = a[0]; cy = a[1]; pts.push([cx, cy]); }
    else if (cmd === 'H') { cx = a[0]; pts.push([cx, cy]); }
    else if (cmd === 'V') { cy = a[0]; pts.push([cx, cy]); }
    else if (cmd === 'C') { cx = a[4]; cy = a[5]; pts.push([cx, cy]); }
    else if (cmd === 'S' || cmd === 'Q') { cx = a[2]; cy = a[3]; pts.push([cx, cy]); }
    else if (cmd === 'A') { cx = a[5]; cy = a[6]; pts.push([cx, cy]); }
  }
  return pts;
}

/** path の d → bbox 中心 (px)。点が無ければ null。 */
export function bboxCenterPx(d) {
  let a = Infinity, b = Infinity, c = -Infinity, dd = -Infinity, any = false;
  for (const [x, y] of pathPoints(d)) { any = true; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > dd) dd = y; }
  if (!any) return null;
  return { x: (a + c) / 2, y: (b + dd) / 2 };
}

const attrNum = (open, name) => {
  const m = open.match(new RegExp(`\\s${name}="(-?[\\d.]+)"`));
  return m ? Number(m[1]) : null;
};

/** 要素の open タグに rotate(angle[, cx, cy]) があれば点(px)を回転して返す。無ければそのまま。
 * ward SVG の house transform は rect の rotate のみ(実測)。他 transform 種は現データに無い。 */
function applyTransform(cx, cy, open) {
  const rot = open.match(/rotate\(([^)]+)\)/);
  if (!rot) return { x: cx, y: cy };
  const [ang, ox = 0, oy = 0] = rot[1].split(/[\s,]+/).map(Number);
  const rad = (ang * Math.PI) / 180, dx = cx - ox, dy = cy - oy;
  return { x: ox + dx * Math.cos(rad) - dy * Math.sin(rad), y: oy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/**
 * 要素(open タグ全体 + tag 名)の「ブラウザが実際に描画する中心」(px)。
 * path=SVG コマンドを正しく解釈した bbox 中心 / rect=x+w/2,y+h/2 / circle=cx,cy。
 * いずれも要素自身の rotate transform を適用する(回転 rect の実位置に一致させる)。
 */
export function elementCenterPx(open, tag) {
  if (tag === 'rect') {
    const x = attrNum(open, 'x') ?? 0, y = attrNum(open, 'y') ?? 0;
    const w = attrNum(open, 'width') ?? 0, h = attrNum(open, 'height') ?? 0;
    return applyTransform(x + w / 2, y + h / 2, open);
  }
  if (tag === 'circle' || tag === 'ellipse') {
    return applyTransform(attrNum(open, 'cx') ?? 0, attrNum(open, 'cy') ?? 0, open);
  }
  const dm = open.match(/\sd="([^"]+)"/);
  const c = dm ? bboxCenterPx(dm[1]) : null;
  return c ? applyTransform(c.x, c.y, open) : null;
}

/** 要素の輪郭頂点(px)。rect=4隅 / path=on-curve点 / circle=bbox4隅。rotate transform 適用。 */
export function elementOutlinePx(open, tag) {
  let pts = [];
  if (tag === 'rect') {
    const x = attrNum(open, 'x') ?? 0, y = attrNum(open, 'y') ?? 0;
    const w = attrNum(open, 'width') ?? 0, h = attrNum(open, 'height') ?? 0;
    pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  } else if (tag === 'circle' || tag === 'ellipse') {
    const cx = attrNum(open, 'cx') ?? 0, cy = attrNum(open, 'cy') ?? 0;
    const rx = attrNum(open, 'rx') ?? attrNum(open, 'r') ?? 0;
    const ry = attrNum(open, 'ry') ?? attrNum(open, 'r') ?? 0;
    pts = [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]];
  } else {
    const dm = open.match(/\sd="([^"]+)"/);
    if (!dm) return null;
    pts = pathPoints(dm[1]);
  }
  if (pts.length < 3) return null;
  return pts.map(([x, y]) => { const p = applyTransform(x, y, open); return [p.x, p.y]; });
}
