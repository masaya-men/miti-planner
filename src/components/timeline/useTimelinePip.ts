import { useCallback, useRef, useState } from 'react';

/**
 * PiP カンペビュー(Document Picture-in-Picture)の状態・開閉ハンドラ・ホバーメニュー制御。
 * Timeline 本体から移したもの。effect・描画中の ref 書き込みは含まない。
 */
export function useTimelinePip() {
    const [pipWindow, setPipWindow] = useState<Window | null>(null);
    const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);
    const [, setPipMode] = useState<'cue' | 'recorder' | null>(null);
    const [pipMenuOpen, setPipMenuOpen] = useState(false);
    const [pipMenuPos, setPipMenuPos] = useState<{ top: number; left: number } | null>(null);
    const pipMenuRef = useRef<HTMLDivElement>(null);
    const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

    const handleOpenPip = useCallback(async (mode: 'cue' | 'recorder') => {
        if (!pipSupported) return;
        try {
            const dpip = (window as any).documentPictureInPicture;
            // 初回サイズ: カンペは横を Chrome の最小値にブラウザ補正させる（width: 1）+ 高さ 200px。
            // レコーダーはフォームが収まるよう少し大きめ。
            const size = mode === 'recorder' ? { width: 360, height: 480 } : { width: 1, height: 200 };
            const win: Window = await dpip.requestWindow(size);

            // スタイルをPiPウィンドウにコピー
            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(s => win.document.head.appendChild(s.cloneNode(true)));

            // ダークテーマclass をコピー + 透過背景
            win.document.documentElement.classList.add(...document.documentElement.classList);
            win.document.documentElement.style.background = 'transparent';
            win.document.documentElement.style.height = '100%';
            win.document.body.style.margin = '0';
            win.document.body.style.height = '100%';
            win.document.body.style.overflow = 'hidden';
            win.document.body.style.background = 'transparent';

            // Reactマウントポイント
            const container = win.document.createElement('div');
            container.id = 'pip-root';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
            win.document.body.appendChild(container);

            setPipMode(mode);
            setPipWindow(win);
            setPipContainer(container);

            // ウィンドウ閉じられた時のクリーンアップ
            win.addEventListener('pagehide', () => {
                setPipWindow(null);
                setPipContainer(null);
                setPipMode(null);
            });
        } catch (e) {
            console.warn('PiP open failed:', e);
        }
    }, [pipSupported]);

    const handleClosePip = useCallback(() => {
        pipWindow?.close();
        setPipWindow(null);
        setPipContainer(null);
        setPipMode(null);
    }, [pipWindow]);

    // PiP メニューの開閉（トリガーボタンの位置から固定配置を算出）。
    // メニューはツールバー(overflow-hidden)の外＝document.body に portal するため、ここで座標を確定する。
    // PiP メニューはホバーで開く。トリガー(ボタン)↔パネル間の移動でホバーが切れても
    // 閉じないよう、閉じる処理は遅延させ、パネルに入ったらキャンセルする。
    const pipMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openPipMenu = useCallback(() => {
        if (pipMenuCloseTimer.current) { clearTimeout(pipMenuCloseTimer.current); pipMenuCloseTimer.current = null; }
        if (pipWindow) return; // PiP 表示中はメニューを出さない
        const el = pipMenuRef.current;
        if (el) {
            const r = el.getBoundingClientRect();
            // 他メニューと同様、トリガーの左端そろえで右へ展開（真下）
            setPipMenuPos({ top: r.bottom, left: r.left });
        }
        setPipMenuOpen(true);
    }, [pipWindow]);

    const scheduleClosePipMenu = useCallback(() => {
        if (pipMenuCloseTimer.current) clearTimeout(pipMenuCloseTimer.current);
        pipMenuCloseTimer.current = setTimeout(() => setPipMenuOpen(false), 180);
    }, []);

    const cancelClosePipMenu = useCallback(() => {
        if (pipMenuCloseTimer.current) { clearTimeout(pipMenuCloseTimer.current); pipMenuCloseTimer.current = null; }
    }, []);

    return {
        pipWindow, pipContainer, pipMenuOpen, setPipMenuOpen, pipMenuPos, pipMenuRef, pipSupported,
        handleOpenPip, handleClosePip, openPipMenu, scheduleClosePipMenu, cancelClosePipMenu,
    };
}
