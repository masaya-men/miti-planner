import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { pulseConfig, gridConfig, pulseVisualConfig, PULSE_COLOR_PRESETS, savePulseSettings, notifyGridConfigChange } from './gridOverlayConfig';

import { useDismissOnOutside } from '../hooks/useDismissOnOutside';
import { hslToRgb, rgbStringToHsl } from './pulseSettings/colorConversion';
import { GradientSlider } from './pulseSettings/GradientSlider';
import { SnapSlider } from './pulseSettings/SnapSlider';
import { PillSelect } from './pulseSettings/PillSelect';
import { SectionHeader } from './pulseSettings/SectionHeader';

// デフォルト値
const DEFAULTS = {
    enabled: true,
    distance: 3,
    speed: 3,
    pulseWidth: 3,
    pulseOpacity: 3,
    colorId: 'auto',
    glow: 0,
    gridLineWidth: 1,
};


const GRID_MIN = 0;
const GRID_MAX = 7;
const PULSE_WIDTH_MIN = 1;
const PULSE_WIDTH_MAX = 10;
const GLOW_MIN = 0;
const GLOW_MAX = 5;

export const PulseSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [enabled, setEnabled] = useState(pulseConfig.enabled);
    const [distance, setDistance] = useState(pulseConfig.distance);
    const [speed, setSpeed] = useState(pulseConfig.speed);
    const [pulseWidth, setPulseWidth] = useState(pulseVisualConfig.width);
    const [pulseOpacity, setPulseOpacity] = useState(pulseVisualConfig.opacity);
    const [colorId, setColorId] = useState(pulseVisualConfig.colorId);
    const [glow, setGlow] = useState(pulseVisualConfig.glow);
    const [gridLineWidth, setGridLineWidth] = useState(gridConfig.lineWidth);
    const [customHue, setCustomHue] = useState(() => {
        const [h] = rgbStringToHsl(pulseVisualConfig.customColor);
        return h;
    });
    const [customLightness, setCustomLightness] = useState(() => {
        const [,, l] = rgbStringToHsl(pulseVisualConfig.customColor);
        return l;
    });
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useDismissOnOutside(isOpen, () => setIsOpen(false), [panelRef]);

    // カスタム色のRGB文字列を計算
    const customRgb = (() => {
        const [r, g, b] = hslToRgb(customHue, 1, customLightness);
        return `${r}, ${g}, ${b}`;
    })();

    // カスタム色が変わったらpulseVisualConfigに反映
    const updateCustomColor = useCallback((hue: number, lightness: number) => {
        const [r, g, b] = hslToRgb(hue, 1, lightness);
        pulseVisualConfig.customColor = `${r}, ${g}, ${b}`;
    }, []);

    // 更新関数（変更のたびにlocalStorageに保存）
    const update = {
        enabled: (v: boolean) => { setEnabled(v); pulseConfig.enabled = v; savePulseSettings(); },
        distance: (v: number) => { setDistance(v); pulseConfig.distance = v; savePulseSettings(); },
        speed: (v: number) => { setSpeed(v); pulseConfig.speed = v; savePulseSettings(); },
        pulseWidth: (v: number) => { setPulseWidth(v); pulseVisualConfig.width = v; savePulseSettings(); },
        pulseOpacity: (v: number) => { setPulseOpacity(v); pulseVisualConfig.opacity = v; savePulseSettings(); },
        colorId: (v: string) => { setColorId(v); pulseVisualConfig.colorId = v; savePulseSettings(); },
        glow: (v: number) => { setGlow(v); pulseVisualConfig.glow = v; savePulseSettings(); },
        gridLineWidth: (v: number) => { setGridLineWidth(v); gridConfig.lineWidth = v; savePulseSettings(); notifyGridConfigChange(); },
        customHue: (v: number) => { setCustomHue(v); updateCustomColor(v, customLightness); savePulseSettings(); },
        customLightness: (v: number) => { setCustomLightness(v); updateCustomColor(customHue, v); savePulseSettings(); },
    };

    const resetToDefault = () => {
        update.enabled(DEFAULTS.enabled);
        update.distance(DEFAULTS.distance);
        update.speed(DEFAULTS.speed);
        update.pulseWidth(DEFAULTS.pulseWidth);
        update.pulseOpacity(DEFAULTS.pulseOpacity);
        update.colorId(DEFAULTS.colorId);
        update.glow(DEFAULTS.glow);
        update.gridLineWidth(DEFAULTS.gridLineWidth);
    };

    const isDefault = enabled === DEFAULTS.enabled && distance === DEFAULTS.distance && speed === DEFAULTS.speed
        && pulseWidth === DEFAULTS.pulseWidth && pulseOpacity === DEFAULTS.pulseOpacity
        && colorId === DEFAULTS.colorId && glow === DEFAULTS.glow && gridLineWidth === DEFAULTS.gridLineWidth;

    // 色プリセットのオプション（カスタムボタン付き）
    const colorOptions = Object.keys(PULSE_COLOR_PRESETS).map(id => ({
        id,
        label: t(`footer.pulse_color_${id}`),
    }));

    const pulseDisabledClass = !enabled ? 'opacity-30 pointer-events-none' : '';

    // 色相グラデーション（レインボー）
    const hueGradient = 'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';
    // 明度グラデーション（現在の色相で黒→色→白）
    const lightnessGradient = `linear-gradient(to right, hsl(${customHue},100%,0%), hsl(${customHue},100%,50%), hsl(${customHue},100%,100%))`;
    // 現在のカスタムカラー（サムネ用）
    const currentCustomCss = `rgb(${customRgb})`;

    // パネル位置をボタン基準で計算
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
    useEffect(() => {
        if (!isOpen || !buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelStyle({
            position: 'fixed',
            bottom: window.innerHeight - rect.top + 6,
            left: rect.left + rect.width / 2 - 120, // 240px / 2
        });
    }, [isOpen]);

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="underline hover:text-app-text transition-colors cursor-pointer"
            >
                {t('footer.pulse_settings')}
            </button>

            {isOpen && createPortal(
                <div
                    ref={panelRef}
                    className="float-surface rounded-xl p-3 w-[240px] z-[99999] max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain"
                    style={panelStyle}
                >
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-app-base font-bold text-app-text uppercase tracking-wider">
                            {t('footer.pulse_settings')}
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors cursor-pointer"
                        >
                            <X size={12} />
                        </button>
                    </div>

                    {/* ━━ パルス ━━ */}
                    <SectionHeader
                        label={t('footer.section_pulse')}
                        right={
                            <button
                                onClick={() => update.enabled(!enabled)}
                                className={`px-2 py-0.5 rounded-full text-app-xs font-bold tracking-wider transition-all cursor-pointer ${
                                    enabled
                                        ? 'bg-app-toggle text-app-toggle-text'
                                        : 'bg-app-surface2 text-app-text-muted border border-app-border'
                                }`}
                            >
                                {enabled ? t('footer.pulse_on') : t('footer.pulse_off')}
                            </button>
                        }
                    />

                    {/* 距離 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_distance')}
                        </div>
                        <SnapSlider value={distance} onChange={update.distance}
                            leftLabel={t('footer.pulse_short')} rightLabel={t('footer.pulse_long')} disabled={!enabled} />
                    </div>

                    {/* 速度 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_speed')}
                        </div>
                        <SnapSlider value={speed} onChange={update.speed}
                            leftLabel={t('footer.pulse_slow')} rightLabel={t('footer.pulse_fast')} disabled={!enabled} />
                    </div>

                    {/* 太さ */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_line_width')}
                        </div>
                        <SnapSlider value={pulseWidth} onChange={update.pulseWidth}
                            leftLabel={t('footer.pulse_thin')} rightLabel={t('footer.grid_thick')}
                            min={PULSE_WIDTH_MIN} max={PULSE_WIDTH_MAX} disabled={!enabled} />
                    </div>

                    {/* 光の強さ */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_opacity')}
                        </div>
                        <SnapSlider value={pulseOpacity} onChange={update.pulseOpacity}
                            leftLabel={t('footer.pulse_dim')} rightLabel={t('footer.pulse_bright')}
                            min={PULSE_WIDTH_MIN} max={PULSE_WIDTH_MAX} disabled={!enabled} />
                    </div>

                    {/* 色 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_color')}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <PillSelect options={colorOptions} value={colorId} onChange={update.colorId} disabled={!enabled} />
                            {/* 虹色カスタムボタン */}
                            <button
                                onClick={() => !enabled ? null : update.colorId(colorId === 'custom' ? 'auto' : 'custom')}
                                className={`w-[26px] h-[26px] rounded-full shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                                    colorId === 'custom'
                                        ? 'ring-2 ring-app-text ring-offset-1 ring-offset-app-bg'
                                        : 'hover:scale-110'
                                } ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}
                                style={{
                                    background: 'conic-gradient(hsl(0,80%,60%), hsl(60,80%,60%), hsl(120,80%,60%), hsl(180,80%,60%), hsl(240,80%,60%), hsl(300,80%,60%), hsl(360,80%,60%))',
                                }}
                                title={t('footer.pulse_color_custom')}
                            />
                        </div>

                        {/* カスタムカラーピッカー */}
                        {colorId === 'custom' && enabled && (
                            <div className="mt-2 space-y-1.5">
                                <div className="text-app-xs text-app-text-muted uppercase tracking-wider">
                                    {t('footer.pulse_color_hue')}
                                </div>
                                <GradientSlider
                                    value={customHue}
                                    onChange={update.customHue}
                                    min={0} max={360}
                                    gradient={hueGradient}
                                    thumbColor={`hsl(${customHue}, 100%, 50%)`}
                                />
                                <div className="text-app-xs text-app-text-muted uppercase tracking-wider">
                                    {t('footer.pulse_color_lightness')}
                                </div>
                                <GradientSlider
                                    value={customLightness}
                                    onChange={update.customLightness}
                                    min={0.05} max={0.95}
                                    gradient={lightnessGradient}
                                    thumbColor={currentCustomCss}
                                />
                            </div>
                        )}
                    </div>

                    {/* グロー */}
                    <div className={`mb-3 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_glow')}
                        </div>
                        <SnapSlider value={glow} onChange={update.glow}
                            leftLabel={t('footer.glow_0')} rightLabel={t('footer.glow_max', 'MAX')}
                            min={GLOW_MIN} max={GLOW_MAX} disabled={!enabled} />
                    </div>

                    {/* ━━ 格子 ━━ */}
                    <SectionHeader label={t('footer.section_grid')} />

                    <div className="mb-3">
                        <div className="text-app-sm text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.grid_line_width')}
                        </div>
                        <SnapSlider value={gridLineWidth} onChange={update.gridLineWidth}
                            leftLabel={t('footer.grid_none')} rightLabel={t('footer.grid_thick')}
                            min={GRID_MIN} max={GRID_MAX} />
                    </div>

                    {/* デフォルトに戻す */}
                    <button
                        onClick={resetToDefault}
                        disabled={isDefault}
                        className={`w-full py-1 rounded text-app-sm font-bold tracking-wider transition-all cursor-pointer ${
                            isDefault
                                ? 'text-app-text-muted/30 cursor-default'
                                : 'text-app-text-muted hover:text-app-text border border-app-border hover:border-app-text-muted'
                        }`}
                    >
                        {t('common.reset', 'Reset to Default')}
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};
