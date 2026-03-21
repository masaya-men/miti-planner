import { useRef, useEffect, useCallback } from 'react';

// グリッドセルのサイズ（px）
const CELL_SIZE = 100;
// 通常時のグリッド線の透明度
const BASE_OPACITY = 0.06;
// カーソル周辺のグロー半径（px）
const GLOW_RADIUS = 280;
// セル塗りの最大透明度
const CELL_FILL_MAX = 0.08;

export const GridOverlay: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -9999, y: -9999 });
    const rafRef = useRef<number>(0);
    const accentRef = useRef('34, 211, 238');

    const redraw = useCallback(() => {
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

        const cols = Math.ceil(w / CELL_SIZE) + 1;
        const rows = Math.ceil(h / CELL_SIZE) + 1;

        // セル単位でグロー計算 → 塗りとボーダーの両方に反映
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cx = col * CELL_SIZE + CELL_SIZE / 2;
                const cy = row * CELL_SIZE + CELL_SIZE / 2;
                const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2);
                const glow = Math.max(0, 1 - dist / GLOW_RADIUS);

                // セル塗り（カーソル付近のみ）
                if (glow > 0) {
                    const fillAlpha = glow * glow * CELL_FILL_MAX;
                    ctx.fillStyle = `rgba(${accent}, ${fillAlpha})`;
                    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        // 縦線
        for (let col = 0; col <= cols; col++) {
            const x = col * CELL_SIZE;
            // 線全体のうち最もカーソルに近い点でグロー計算
            const distX = Math.abs(x - mx);
            const glow = Math.max(0, 1 - distX / GLOW_RADIUS);
            const opacity = BASE_OPACITY + glow * 0.35;

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.strokeStyle = `rgba(${accent}, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 横線
        for (let row = 0; row <= rows; row++) {
            const y = row * CELL_SIZE;
            const distY = Math.abs(y - my);
            const glow = Math.max(0, 1 - distY / GLOW_RADIUS);
            const opacity = BASE_OPACITY + glow * 0.35;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.strokeStyle = `rgba(${accent}, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }, []);

    const scheduleRedraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(redraw);
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
            mouseRef.current = { x: e.clientX, y: e.clientY };
            scheduleRedraw();
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -9999, y: -9999 };
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

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(rafRef.current);
        };
    }, [handleResize, scheduleRedraw]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[1]"
        />
    );
};
