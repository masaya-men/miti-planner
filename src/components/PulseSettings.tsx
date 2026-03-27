import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { pulseConfig, gridConfig, pulseVisualConfig, PULSE_COLOR_PRESETS, GLOW_LEVELS } from './GridOverlay';

// デフォルト値
const DEFAULTS = {
    enabled: true,
    distance: 4,
    speed: 1,
    pulseWidth: 2,
    pulseOpacity: 10,
    colorId: 'auto',
    glow: 2,
    gridLineWidth: 1,
};

const PULSE_MIN = 1;
const PULSE_MAX = 5;
const GRID_MIN = 0;
const GRID_MAX = 7;
const PULSE_WIDTH_MIN = 1;
const PULSE_WIDTH_MAX = 10;

// 吸着スライダー
const SnapSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    leftLabel: string;
    rightLabel: string;
    disabled?: boolean;
    min?: number;
    max?: number;
}> = ({ value, onChange, leftLabel, rightLabel, disabled, min = PULSE_MIN, max = PULSE_MAX }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const getValueFromX = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (max - min) + min);
    }, [value, min, max]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || disabled) return;
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerUp = () => setDragging(false);

    const percent = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex items-center gap-2">
            <span className="text-[8px] text-app-text-muted w-4 text-right shrink-0">{leftLabel}</span>
            <div
                ref={trackRef}
                className="relative flex-1 h-5 flex items-center cursor-pointer"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="absolute left-0 right-0 h-[2px] bg-app-border rounded-full" />
                <div className="absolute left-0 h-[2px] bg-app-text/40 rounded-full" style={{ width: `${percent}%` }} />
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(step => (
                    <div
                        key={step}
                        className={`absolute w-1 h-1 rounded-full -translate-x-1/2 ${step <= value ? 'bg-app-text/60' : 'bg-app-border'}`}
                        style={{ left: `${((step - min) / (max - min)) * 100}%` }}
                    />
                ))}
                <div
                    className="absolute w-3 h-3 rounded-full bg-app-text border-2 border-app-bg -translate-x-1/2 transition-[left] duration-75 shadow-sm"
                    style={{ left: `${percent}%` }}
                />
            </div>
            <span className="text-[8px] text-app-text-muted w-4 shrink-0">{rightLabel}</span>
        </div>
    );
};

// ピル型選択ボタン
const PillSelect: React.FC<{
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}> = ({ options, value, onChange, disabled }) => (
    <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => (
            <button
                key={opt.id}
                onClick={() => !disabled && onChange(opt.id)}
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                    value === opt.id
                        ? 'bg-app-text text-app-bg'
                        : 'bg-app-surface2 text-app-text-muted border border-app-border hover:border-app-text-muted'
                } ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

// セクション区切り
const SectionHeader: React.FC<{ label: string; right?: React.ReactNode }> = ({ label, right }) => (
    <div className="flex items-center gap-2 mb-2 mt-1">
        <span className="text-[9px] font-bold text-app-text uppercase tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-app-border" />
        {right}
    </div>
);

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
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    // 更新関数
    const update = {
        enabled: (v: boolean) => { setEnabled(v); pulseConfig.enabled = v; },
        distance: (v: number) => { setDistance(v); pulseConfig.distance = v; },
        speed: (v: number) => { setSpeed(v); pulseConfig.speed = v; },
        pulseWidth: (v: number) => { setPulseWidth(v); pulseVisualConfig.width = v; },
        pulseOpacity: (v: number) => { setPulseOpacity(v); pulseVisualConfig.opacity = v; },
        colorId: (v: string) => { setColorId(v); pulseVisualConfig.colorId = v; },
        glow: (v: number) => { setGlow(v); pulseVisualConfig.glow = v; },
        gridLineWidth: (v: number) => { setGridLineWidth(v); gridConfig.lineWidth = v; },
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

    // 色プリセットのオプション
    const colorOptions = Object.keys(PULSE_COLOR_PRESETS).map(id => ({
        id,
        label: t(`footer.pulse_color_${id}`),
    }));

    // グローオプション
    const glowOptions = GLOW_LEVELS.map((_, i) => ({
        id: String(i),
        label: t(`footer.glow_${i}`),
    }));

    const pulseDisabledClass = !enabled ? 'opacity-30 pointer-events-none' : '';

    return (
        <span className="relative inline-block">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="underline hover:text-app-text transition-colors cursor-pointer"
            >
                {t('footer.pulse_settings')}
            </button>

            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-tier3 rounded-xl p-3 w-[240px] z-[99999]"
                >
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-app-text uppercase tracking-wider">
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
                                className={`px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider transition-all cursor-pointer ${
                                    enabled
                                        ? 'bg-app-text text-app-bg'
                                        : 'bg-app-surface2 text-app-text-muted border border-app-border'
                                }`}
                            >
                                {enabled ? t('footer.pulse_on') : t('footer.pulse_off')}
                            </button>
                        }
                    />

                    {/* 距離 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_distance')}
                        </div>
                        <SnapSlider value={distance} onChange={update.distance}
                            leftLabel={t('footer.pulse_short')} rightLabel={t('footer.pulse_long')} disabled={!enabled} />
                    </div>

                    {/* 速度 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_speed')}
                        </div>
                        <SnapSlider value={speed} onChange={update.speed}
                            leftLabel={t('footer.pulse_slow')} rightLabel={t('footer.pulse_fast')} disabled={!enabled} />
                    </div>

                    {/* 太さ */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_line_width')}
                        </div>
                        <SnapSlider value={pulseWidth} onChange={update.pulseWidth}
                            leftLabel={t('footer.pulse_thin')} rightLabel={t('footer.grid_thick')}
                            min={PULSE_WIDTH_MIN} max={PULSE_WIDTH_MAX} disabled={!enabled} />
                    </div>

                    {/* 光の強さ */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1">
                            {t('footer.pulse_opacity')}
                        </div>
                        <SnapSlider value={pulseOpacity} onChange={update.pulseOpacity}
                            leftLabel={t('footer.pulse_dim')} rightLabel={t('footer.pulse_bright')}
                            min={PULSE_WIDTH_MIN} max={PULSE_WIDTH_MAX} disabled={!enabled} />
                    </div>

                    {/* 色 */}
                    <div className={`mb-2.5 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_color')}
                        </div>
                        <PillSelect options={colorOptions} value={colorId} onChange={update.colorId} disabled={!enabled} />
                    </div>

                    {/* グロー */}
                    <div className={`mb-3 transition-opacity ${pulseDisabledClass}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_glow')}
                        </div>
                        <PillSelect options={glowOptions} value={String(glow)} onChange={v => update.glow(Number(v))} disabled={!enabled} />
                    </div>

                    {/* ━━ 格子 ━━ */}
                    <SectionHeader label={t('footer.section_grid')} />

                    <div className="mb-3">
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1">
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
                        className={`w-full py-1 rounded text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                            isDefault
                                ? 'text-app-text-muted/30 cursor-default'
                                : 'text-app-text-muted hover:text-app-text border border-app-border hover:border-app-text-muted'
                        }`}
                    >
                        {t('common.reset', 'Reset to Default')}
                    </button>
                </div>
            )}
        </span>
    );
};
