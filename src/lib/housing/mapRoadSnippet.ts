import type { WardMapJson } from '../../data/housing/wardMapManifest';

/**
 * Allmarksまとめてインポート中の演出「ワードマップの道路が一部だけ切り取られて描かれる」の
 * 純粋ロジック(ゲーム内ハウジングエリアのワードマップSVGは `道路(Stroke)` レイヤーとして
 * 実際に stroke 描画されており、その `d` 文字列は `WardMapJson.roadPath` にそのまま入っている
 * — 2026-08-19 実データ確認済み)。 DOM/タイマーから切り離してテスト可能にする。
 */

export interface Point {
  x: number;
  y: number;
}

export interface CropWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 切り取り範囲のサイズ(マップのネイティブ座標系での幅高さ)。 マップ全体(だいたい
 * 1000〜1900角)のうち意味のある広さを見せる「引き」の画にする(2026-08-19 ユーザーFB:
 * 最初の240x150は寄りすぎて地図に見えなかった)。 */
export const CROP_WIDTH = 700;
export const CROP_HEIGHT = 450;

/** 十分「意味のある」道が描けたと判断する最小文字数(短すぎる/ほぼ空の切り取りを避ける)。 */
const MIN_SNIPPET_LENGTH = 40;
const MAX_ANCHOR_ATTEMPTS = 6;

/** roadPath の d 文字列を M ごとの部分パスに分割する(道路網は M/L/H/V/C のみ使用、Z 無し
 * — 2026-08-19 全10マップの実データで確認済み)。 */
export function splitSubpaths(d: string): string[] {
  return d.match(/M[^M]*/g) ?? [];
}

/** 部分パス文字列から折れ線の頂点列を大まかに復元する(bbox計算用の近似)。
 * 曲線コマンド C は制御点を無視し終点だけ採用する(道はほぼ直線なので粗い近似で十分)。 */
export function extractPoints(subpathD: string): Point[] {
  const tokens = subpathD.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const points: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    i += 1;
    if (cmd === 'M' || cmd === 'L') {
      cur = { x: Number(tokens[i]), y: Number(tokens[i + 1]) };
      i += 2;
      points.push(cur);
    } else if (cmd === 'H') {
      cur = { x: Number(tokens[i]), y: cur.y };
      i += 1;
      points.push(cur);
    } else if (cmd === 'V') {
      cur = { x: cur.x, y: Number(tokens[i]) };
      i += 1;
      points.push(cur);
    } else if (cmd === 'C') {
      cur = { x: Number(tokens[i + 4]), y: Number(tokens[i + 5]) };
      i += 6;
      points.push(cur);
    } else {
      // 未知コマンド(現行データには出現しない想定)は安全側に倒して読み飛ばす。
      break;
    }
  }
  return points;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBox(points: Point[]): BoundingBox | null {
  if (points.length === 0) return null;
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function intersects(crop: CropWindow, box: BoundingBox): boolean {
  return crop.x <= box.maxX && crop.x + crop.w >= box.minX && crop.y <= box.maxY && crop.y + crop.h >= box.minY;
}

/** 道路網 (roadPath) から、切り取り範囲とかすっている部分パスだけを抜き出して連結する。
 * かすらない部分は描画対象から外すので、切り取った範囲内だけ意味のある線が描かれる。 */
export function selectRoadSnippet(roadPath: string, crop: CropWindow): string {
  const relevant = splitSubpaths(roadPath).filter((sp) => {
    const box = boundingBox(extractPoints(sp));
    return box !== null && intersects(crop, box);
  });
  return relevant.join(' ');
}

/** `WardMapJson.houses[].outline` (正規化0-1座標) をネイティブ座標系の頂点列に変換する。 */
export function outlineToNativePoints(outline: number[][], viewBox: { w: number; h: number }): Point[] {
  return outline.map(([x, y]) => ({ x: x * viewBox.w, y: y * viewBox.h }));
}

/** 家(区画)の輪郭のうち、切り取り範囲とかすっているものだけを抜き出す。 道路だけでなく
 * 実際の区画の形も見せることで「地図らしさ」を出す(2026-08-19 ユーザー指摘: 家の区画データも
 * outline としてJSONにそのまま入っている)。 */
export function selectHouseOutlines(
  houses: WardMapJson['houses'],
  viewBox: { w: number; h: number },
  crop: CropWindow,
): Point[][] {
  const result: Point[][] = [];
  for (const house of houses) {
    if (!house.outline) continue;
    const points = outlineToNativePoints(house.outline, viewBox);
    const box = boundingBox(points);
    if (box !== null && intersects(crop, box)) result.push(points);
  }
  return result;
}

/** ノード(道路グラフの頂点、正規化0-1座標)からランダムに1つ選び、ネイティブ座標系での
 * 切り取り範囲(マップ境界内にクランプ済み)を作る。 ノードは道路の頂点なので、
 * その周辺には高確率で道が通っている。 */
export function pickCropWindow(
  json: Pick<WardMapJson, 'nodes' | 'viewBox'>,
  rng: () => number = Math.random,
): CropWindow {
  const { viewBox, nodes } = json;
  const anchor = nodes.length > 0 ? nodes[Math.floor(rng() * nodes.length)] : { x: 0.5, y: 0.5 };
  const anchorX = anchor.x * viewBox.w;
  const anchorY = anchor.y * viewBox.h;
  const x = Math.min(Math.max(anchorX - CROP_WIDTH / 2, 0), Math.max(viewBox.w - CROP_WIDTH, 0));
  const y = Math.min(Math.max(anchorY - CROP_HEIGHT / 2, 0), Math.max(viewBox.h - CROP_HEIGHT, 0));
  return { x, y, w: CROP_WIDTH, h: CROP_HEIGHT };
}

export interface RoadSnippet {
  crop: CropWindow;
  d: string;
  houses: Point[][];
}

/** ランダムな切り取り範囲を選び、十分な長さの道が取れるまで(最大 {@link MAX_ANCHOR_ATTEMPTS} 回)
 * 候補を選び直す。 見つからなくても最も長かった候補(空文字含む)を返す(呼び出し側は
 * `d === ''` を「今回は何も描かない」として扱えばよい)。 同じ切り取り範囲で家の区画も
 * 一緒に抜き出す(道路と家、両方とも同じ「窓」の中身)。 */
export function pickRoadSnippet(json: WardMapJson, rng: () => number = Math.random): RoadSnippet {
  let best: { crop: CropWindow; d: string } | null = null;
  for (let attempt = 0; attempt < MAX_ANCHOR_ATTEMPTS; attempt++) {
    const crop = pickCropWindow(json, rng);
    const d = selectRoadSnippet(json.roadPath, crop);
    if (!best || d.length > best.d.length) best = { crop, d };
    if (d.length >= MIN_SNIPPET_LENGTH) break;
  }
  const picked = best ?? { crop: pickCropWindow(json, rng), d: '' };
  const houses = selectHouseOutlines(json.houses, json.viewBox, picked.crop);
  return { ...picked, houses };
}
