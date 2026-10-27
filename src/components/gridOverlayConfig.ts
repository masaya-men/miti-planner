// --- localStorage永続化ヘルパー ---
const STORAGE_KEY = 'lopo-pulse-settings';

type SavedSettings = {
    grid?: { lineWidth?: number };
    pulse?: { enabled?: boolean; distance?: number; speed?: number };
    visual?: { width?: number; opacity?: number; colorId?: string; customColor?: string; glow?: number };
};

function loadSavedSettings(): SavedSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

export function savePulseSettings(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            grid: { lineWidth: gridConfig.lineWidth },
            pulse: { enabled: pulseConfig.enabled, distance: pulseConfig.distance, speed: pulseConfig.speed },
            visual: { width: pulseVisualConfig.width, opacity: pulseVisualConfig.opacity, colorId: pulseVisualConfig.colorId, customColor: pulseVisualConfig.customColor, glow: pulseVisualConfig.glow },
        }));
    } catch { /* サイレント */ }
}

const _saved = loadSavedSettings();

// --- 格子設定（外部から変更可能） ---
export const gridConfig = {
    lineWidth: _saved.grid?.lineWidth ?? 1,  // 0-7、デフォルト1（0.25px）。0=非表示
};

/** gridConfig変更時にCanvas再描画を要求する */
export function notifyGridConfigChange(): void {
    window.dispatchEvent(new CustomEvent('grid-config-change'));
}

// --- 光パルス設定（外部から変更可能、1-5の5段階） ---
export const pulseConfig = {
    enabled: _saved.pulse?.enabled ?? true,
    distance: _saved.pulse?.distance ?? 3,  // 1-5、デフォルト3
    speed: _saved.pulse?.speed ?? 3,     // 1-5、デフォルト3
};

// パルス表示設定
export const pulseVisualConfig = {
    width: _saved.visual?.width ?? 3,      // 1-10、デフォルト3（0.15px）
    opacity: _saved.visual?.opacity ?? 3,    // 1-10、デフォルト3（0.2）
    colorId: (_saved.visual?.colorId ?? 'auto') as string,  // 'auto' | 'amber' | 'lavender' | 'custom'
    customColor: _saved.visual?.customColor ?? '255, 255, 255',  // カスタム色のRGB文字列（ダーク/ライト共通）
    glow: _saved.visual?.glow ?? 0,       // 0-5、デフォルト0（なし）
};

// カラープリセット: id → { dark, light } のRGB文字列
// 将来カラーホイールで自由色を追加する場合は 'custom' id + rgb値を直接設定
export const PULSE_COLOR_PRESETS: Record<string, { dark: string; light: string }> = {
    auto:     { dark: '255, 255, 255', light: '0, 0, 0' },
    amber:    { dark: '255, 180, 80',  light: '180, 110, 20' },
    lavender: { dark: '175, 140, 255', light: '110, 70, 200' },
};
