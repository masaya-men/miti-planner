import { gridConfig, pulseConfig, pulseVisualConfig, PULSE_COLOR_PRESETS } from './gridOverlayConfig';

// グリッドセルのサイズ（px）
export const CELL_SIZE = 50;
// 通常時のグリッド線の透明度
export const BASE_OPACITY = 0.06;
// カーソル周辺のグロー半径（px）
export const GLOW_RADIUS = 280;
// 格子のオフセット（左下方向にずらす）
export const OFFSET_X = -10;
export const OFFSET_Y = 10;

// 段階→実際の線幅（px）: 0.25px刻み
const LINE_WIDTH_MAP: number[] = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];

export function getGridLineWidth(): number {
    return LINE_WIDTH_MAP[gridConfig.lineWidth] ?? LINE_WIDTH_MAP[4];
}

// 距離: 段階→[min, max]セル数
const DISTANCE_MAP: [number, number][] = [
    [2, 3],    // 1（短い）
    [3, 5],    // 2
    [4, 6],    // 3（デフォルト、約5セル）
    [7, 12],   // 4
    [10, 18],  // 5（長い）
];

// 速度: 段階→セグメント時間(ms)、小さいほど速い
const SPEED_MAP: number[] = [
    400,  // 1（遅）
    300,  // 2
    200,  // 3（デフォルト）
    100,  // 4
    50,   // 5（速）
];

export function getPulseLength(): [number, number] {
    return DISTANCE_MAP[pulseConfig.distance - 1] ?? DISTANCE_MAP[2];
}
export function getPulseSegmentDuration(): number {
    return SPEED_MAP[pulseConfig.speed - 1] ?? SPEED_MAP[2];
}

// グローレベル定義（0-5の6段階スライダー、微少な段階差）
const GLOW_LEVELS = [
    { blur: 0,  radius: 0, opacity: 0 },      // 0: なし（デフォルト）
    { blur: 3,  radius: 2, opacity: 0.2 },    // 1: ほんのり
    { blur: 6,  radius: 3, opacity: 0.25 },   // 2: 控えめ
    { blur: 10, radius: 4, opacity: 0.3 },    // 3
    { blur: 16, radius: 6, opacity: 0.35 },   // 4
    { blur: 24, radius: 8, opacity: 0.3 },    // 5: 強め
];

// パルス太さ: 段階→実際の線幅(px)
const WIDTH_MAP: number[] = [
    0.10, // 1
    0.15, // 2
    0.25, // 3（デフォルト）
    0.35, // 4
    0.50, // 5
    0.65, // 6
    0.80, // 7
    1.0,  // 8
    1.2,  // 9
    1.5,  // 10
];

export function getPulseLineWidth(): number {
    return WIDTH_MAP[pulseVisualConfig.width - 1] ?? WIDTH_MAP[2];
}

// 光の強さ: 段階→実際のopacity
const OPACITY_MAP: number[] = [
    0.1,  // 1
    0.3,  // 2
    0.5,  // 3（デフォルト）
    0.6,  // 4
    0.7,  // 5
    0.8,  // 6
    0.85, // 7
    0.9,  // 8
    0.95, // 9
    1.0,  // 10
];

export function getPulseMaxOpacity(): number {
    return OPACITY_MAP[pulseVisualConfig.opacity - 1] ?? OPACITY_MAP[2];
}

export function getPulseColor(isDark: boolean): string {
    if (pulseVisualConfig.colorId === 'custom') {
        return pulseVisualConfig.customColor;
    }
    const preset = PULSE_COLOR_PRESETS[pulseVisualConfig.colorId] ?? PULSE_COLOR_PRESETS.auto;
    return isDark ? preset.dark : preset.light;
}

export function getGlowLevel() {
    return GLOW_LEVELS[pulseVisualConfig.glow] ?? GLOW_LEVELS[2];
}
export const PULSE_FADE_DURATION = 300;
export const PULSE_COUNT_MIN = 3;
export const PULSE_COUNT_MAX = 5;
export const PULSE_COOLDOWN = 300;

// 方向ベクトル: 上下左右
export const DIRECTIONS = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 },  // 右
];
