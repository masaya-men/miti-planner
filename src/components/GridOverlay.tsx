import { useRef, useEffect, useCallback } from 'react';
import { pulseConfig } from './gridOverlayConfig';
import { CELL_SIZE, BASE_OPACITY, GLOW_RADIUS, OFFSET_X, OFFSET_Y, getGridLineWidth, getPulseLength, getPulseSegmentDuration, getPulseLineWidth, getPulseMaxOpacity, getPulseColor, getGlowLevel, PULSE_FADE_DURATION, PULSE_COUNT_MIN, PULSE_COUNT_MAX, PULSE_COOLDOWN, DIRECTIONS } from './gridOverlayParams';


interface PulseSegment {
    // グリッド交差点の座標（col, row）
    fromCol: number;
    fromRow: number;
    toCol: number;
    toRow: number;
}

interface Pulse {
    segments: PulseSegment[];
    startTime: number;
    // セグメントごとにアニメーション進行
    totalDuration: number;
}

export const GridOverlay: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -9999, y: -9999 });
    const rafRef = useRef<number>(0);
    const accentRef = useRef('34, 211, 238');
    const pulsesRef = useRef<Pulse[]>([]);
    const lastPulseTimeRef = useRef(0);
    // 前回のマウス位置（格子線との交差判定用）
    const prevMouseRef = useRef({ x: -9999, y: -9999 });
    // アニメーションループ用
    const isAnimatingRef = useRef(false);

    // マウスが格子線の近くにいるか判定（距離5px以内）
    const isNearGridLine = useCallback((x: number, y: number) => {
        const threshold = 5;
        const ox = ((x - OFFSET_X) % CELL_SIZE + CELL_SIZE) % CELL_SIZE;
        const oy = ((y - OFFSET_Y) % CELL_SIZE + CELL_SIZE) % CELL_SIZE;
        const nearVertical = ox < threshold || ox > CELL_SIZE - threshold;
        const nearHorizontal = oy < threshold || oy > CELL_SIZE - threshold;
        return nearVertical || nearHorizontal;
    }, []);

    // 発火点から遠ざかる方向にランダムパスを生成
    const generatePulse = useCallback((startX: number, startY: number): Pulse | null => {
        // 最寄りの交差点を求める（オフセット考慮）
        const startCol = Math.round((startX - OFFSET_X) / CELL_SIZE);
        const startRow = Math.round((startY - OFFSET_Y) / CELL_SIZE);

        const canvas = canvasRef.current;
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const maxCol = Math.ceil((canvas.width / dpr) / CELL_SIZE);
        const maxRow = Math.ceil((canvas.height / dpr) / CELL_SIZE);

        const [minLen, maxLen] = getPulseLength();
        const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
        const segments: PulseSegment[] = [];

        let col = startCol;
        let row = startRow;

        for (let i = 0; i < length; i++) {
            // 発火点から遠ざかる方向を優先的に選ぶ
            const candidates = DIRECTIONS.filter(d => {
                const nextCol = col + d.dx;
                const nextRow = row + d.dy;
                // 画面外に出ないか
                if (nextCol < 0 || nextCol > maxCol || nextRow < 0 || nextRow > maxRow) return false;
                // 直前のセグメントと逆方向（戻り）を除外
                if (segments.length > 0) {
                    const last = segments[segments.length - 1];
                    if (nextCol === last.fromCol && nextRow === last.fromRow) return false;
                }
                return true;
            });

            if (candidates.length === 0) break;

            // 発火点から遠ざかる方向に重み付け
            const weighted = candidates.map(d => {
                const nextCol = col + d.dx;
                const nextRow = row + d.dy;
                const distFromStart = Math.abs(nextCol - startCol) + Math.abs(nextRow - startRow);
                // 遠ざかる方向ほど重みが高い
                return { d, weight: distFromStart + 1 };
            });

            // 重み付きランダム選択
            const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
            let rand = Math.random() * totalWeight;
            let chosen = weighted[0].d;
            for (const w of weighted) {
                rand -= w.weight;
                if (rand <= 0) { chosen = w.d; break; }
            }

            const nextCol = col + chosen.dx;
            const nextRow = row + chosen.dy;
            segments.push({ fromCol: col, fromRow: row, toCol: nextCol, toRow: nextRow });
            col = nextCol;
            row = nextRow;
        }

        if (segments.length === 0) return null;

        return {
            segments,
            startTime: performance.now(),
            totalDuration: segments.length * getPulseSegmentDuration() + PULSE_FADE_DURATION,
        };
    }, []);

    const redraw = useCallback((now: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const { x: mx, y: my } = mouseRef.current;
        const accent = accentRef.current;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const cols = Math.ceil((w - OFFSET_X) / CELL_SIZE) + 1;
        const rows = Math.ceil((h - OFFSET_Y) / CELL_SIZE) + 1;
        const gridLw = getGridLineWidth();

        // 格子線の描画（lineWidth > 0 の場合のみ）
        if (gridLw > 0) {
            // 縦線（控えめグロー付き）
            for (let col = 0; col <= cols; col++) {
                const x = col * CELL_SIZE + OFFSET_X;
                const distX = Math.abs(x - mx);
                const glow = Math.max(0, 1 - distX / GLOW_RADIUS);
                const opacity = BASE_OPACITY + glow * 0.35;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.strokeStyle = `rgba(${accent}, ${opacity})`;
                ctx.lineWidth = gridLw;
                ctx.stroke();
            }

            // 横線（控えめグロー付き）
            for (let row = 0; row <= rows; row++) {
                const y = row * CELL_SIZE + OFFSET_Y;
                const distY = Math.abs(y - my);
                const glow = Math.max(0, 1 - distY / GLOW_RADIUS);
                const opacity = BASE_OPACITY + glow * 0.35;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.strokeStyle = `rgba(${accent}, ${opacity})`;
                ctx.lineWidth = gridLw;
                ctx.stroke();
            }
        }

        // --- 光パルスの描画 ---
        // カラー設定変更を即時反映するため、毎フレーム取得
        const isDark = document.documentElement.classList.contains('theme-dark') ||
                       (!document.documentElement.classList.contains('theme-light'));
        const pulseColor = getPulseColor(isDark);
        const glowLevel = getGlowLevel();
        const activePulses: Pulse[] = [];

        for (const pulse of pulsesRef.current) {
            const elapsed = now - pulse.startTime;
            if (elapsed > pulse.totalDuration) continue;
            activePulses.push(pulse);

            let tipX = -1, tipY = -1, tipFade = 0;

            for (let i = 0; i < pulse.segments.length; i++) {
                const seg = pulse.segments[i];
                const segDur = getPulseSegmentDuration();
                const segStart = i * segDur;
                const segEnd = segStart + segDur;

                if (elapsed < segStart) continue;

                const x1 = seg.fromCol * CELL_SIZE + OFFSET_X;
                const y1 = seg.fromRow * CELL_SIZE + OFFSET_Y;
                const x2 = seg.toCol * CELL_SIZE + OFFSET_X;
                const y2 = seg.toRow * CELL_SIZE + OFFSET_Y;

                let progress: number;
                if (elapsed < segEnd) {
                    progress = (elapsed - segStart) / segDur;
                } else {
                    progress = 1;
                }

                const fadeStart = pulse.segments.length * getPulseSegmentDuration();
                let fadeAlpha = 1;
                if (elapsed > fadeStart) {
                    fadeAlpha = 1 - (elapsed - fadeStart) / PULSE_FADE_DURATION;
                    fadeAlpha = Math.max(0, fadeAlpha);
                }
                const segFadeDelay = (pulse.segments.length - 1 - i) * 30;
                if (elapsed > fadeStart + segFadeDelay) {
                    const segFade = 1 - (elapsed - fadeStart - segFadeDelay) / PULSE_FADE_DURATION;
                    fadeAlpha = Math.min(fadeAlpha, Math.max(0, segFade));
                }

                const opacity = getPulseMaxOpacity() * fadeAlpha;
                if (opacity <= 0) continue;

                const currentX = x1 + (x2 - x1) * progress;
                const currentY = y1 + (y2 - y1) * progress;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(currentX, currentY);
                ctx.strokeStyle = `rgba(${pulseColor}, ${opacity})`;
                ctx.lineWidth = getPulseLineWidth();
                ctx.lineCap = 'round';
                ctx.stroke();

                // 先端を追跡（走行中の最前線のみ）
                if (progress < 1) { tipX = currentX; tipY = currentY; tipFade = fadeAlpha; }
            }

            // 先端グロー描画（filter: blurでGPU加速）
            if (glowLevel.blur > 0 && tipX >= 0 && tipFade > 0.2) {
                ctx.save();
                ctx.filter = `blur(${glowLevel.blur}px)`;
                ctx.beginPath();
                ctx.arc(tipX, tipY, glowLevel.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${pulseColor}, ${tipFade * glowLevel.opacity})`;
                ctx.fill();
                ctx.restore();
            }
        }

        pulsesRef.current = activePulses;

        // アクティブなパルスがあればアニメーションループ継続
        if (activePulses.length > 0) {
            rafRef.current = requestAnimationFrame((t) => redraw(t));
        } else {
            isAnimatingRef.current = false;
        }
    }, []);

    const scheduleRedraw = useCallback(() => {
        if (!isAnimatingRef.current) {
            rafRef.current = requestAnimationFrame((t) => redraw(t));
        } else {
            // アニメーション中はループが回っているのでスキップ
        }
    }, [redraw]);

    const startAnimationLoop = useCallback(() => {
        if (!isAnimatingRef.current) {
            isAnimatingRef.current = true;
            rafRef.current = requestAnimationFrame((t) => redraw(t));
        }
    }, [redraw]);

    // Canvas リサイズ
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        scheduleRedraw();
    }, [scheduleRedraw]);

    useEffect(() => {
        // アクセントカラーをCSS変数から取得
        const updateAccent = () => {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-accent-rgb').trim();
            if (raw) accentRef.current = raw;
        };


        const handleMouseMove = (e: MouseEvent) => {
            const prev = prevMouseRef.current;
            mouseRef.current = { x: e.clientX, y: e.clientY };
            prevMouseRef.current = { x: e.clientX, y: e.clientY };

            // パルス発火判定
            const now = performance.now();
            if (now - lastPulseTimeRef.current > PULSE_COOLDOWN) {
                if (isNearGridLine(e.clientX, e.clientY)) {
                    // 前回位置が格子線の近くでなかった場合（格子線に「触れた」瞬間）
                    const wasNear = prev.x > -9000 && isNearGridLine(prev.x, prev.y);
                    if (!wasNear && pulseConfig.enabled) {
                        const count = PULSE_COUNT_MIN + Math.floor(Math.random() * (PULSE_COUNT_MAX - PULSE_COUNT_MIN + 1));
                        let added = false;
                        for (let i = 0; i < count; i++) {
                            const pulse = generatePulse(e.clientX, e.clientY);
                            if (pulse) {
                                pulsesRef.current.push(pulse);
                                added = true;
                            }
                        }
                        if (added) {
                            lastPulseTimeRef.current = now;
                            startAnimationLoop();
                        }
                    }
                }
            }

            scheduleRedraw();
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -9999, y: -9999 };
            prevMouseRef.current = { x: -9999, y: -9999 };
            scheduleRedraw();
        };

        updateAccent();
        handleResize();

        // テーマ切り替え時にアクセントカラーを再取得
        const observer = new MutationObserver(() => {
            updateAccent();
            scheduleRedraw();
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('grid-config-change', scheduleRedraw);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('grid-config-change', scheduleRedraw);
            cancelAnimationFrame(rafRef.current);
        };
    }, [handleResize, scheduleRedraw, isNearGridLine, generatePulse, startAnimationLoop]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[1]"
        />
    );
};
