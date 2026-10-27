/** 開閉の動きの形(keyframe)と時間の定数・区画の取り出し */

/** 1 つの動き・ずらす間・台車の遅れ・台車の走行(ms。見本 v3 で masaya が選んだ値) */
export const PHASE_DUR = 420, PHASE_GAP = 80, CARRIAGE_LAG = 60, CARRIAGE_DUR = 480;

export type Kind = 'hdr' | 'sb';
const EASE = 'cubic-bezier(.2,0,.15,1)';
const CAR_EASE = 'cubic-bezier(.45,0,.3,1)';
/** 抜ける / 入る区画が画面の外へ出きる余白(見本の +4) */
export const OUT = 4;
/** 複製の切り口以外の辺は、影・突起を切らないよう外側へ広げて切る */
export const CLIP_PAD = 16;

export const zoneOf = (app: HTMLElement, name: string): HTMLElement | null =>
  app.querySelector<HTMLElement>(`[data-ms-zone="${name}"]`);

/** 区画の進み = 開始のずれから終わりへ。途中で 1.8px 行き過ぎて 0.5px 戻って止まる(重く抜けて少し行き過ぎる質感)。
 *  開始 → 行き過ぎ → 戻り → 終わり の 4 点は frames / edgeFrames で共通 */
export const steps = (s: number, e: number): number[] => { const o = -Math.sign(s - e) * 1.8; return [s, e + o, e - o * 0.28, e]; };
export const STEP_TIMING: Keyframe[] = [{ easing: EASE }, { offset: 0.72, easing: 'ease-in-out' }, { offset: 0.87 }, {}];
export const frames = (sx: number, sy: number, endX: number, endY: number): Keyframe[] => {
  const xs = steps(sx, endX), ys = steps(sy, endY);
  return STEP_TIMING.map((k, i) => ({ transform: `translate(${xs[i]}px, ${ys[i]}px)`, ...k }));
};
/** 台車: 一定の速さで走り、最後の 0.8px でカチッと止まる(見本 runCar) */
export const carFrames = (sx: number, endX: number): Keyframe[] => [
  { transform: `translateX(${sx}px)`, easing: CAR_EASE },
  { transform: `translateX(${Math.round((endX + Math.sign(sx - endX) * 0.8) * 100) / 100}px)`, offset: 0.9 },
  { transform: `translateX(${endX}px)` },
];
export const PAD = `-${CLIP_PAD}px`;
/** 右の複製の見える左端を、滑る板の左端(区画の左端からの位置 sx → ex)と同じ動きで動かす(見本 clipMv)。
 *  継ぎ目が板の移動量より左にあるとき(通気口)、板の左側に右の複製(溝)がはみ出さないようにするため */
export const edgeFrames = (sx: number, ex: number): Keyframe[] => {
  const xs = steps(sx, ex);
  return STEP_TIMING.map((k, i) => ({ clipPath: `inset(${PAD} ${PAD} ${PAD} ${xs[i]}px)`, ...k }));
};

/** 名前の区画を並び順で(無いものは除く) */
export const zonesOf = (app: HTMLElement, names: readonly string[]) =>
  names.map((n) => zoneOf(app, n)).filter((z): z is HTMLElement => !!z);
