import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiPromise: Promise<void> | null = null;

/** YouTube IFrame Player API スクリプトを一度だけロードする。 */
function loadYouTubeApi(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise<void>((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
    return apiPromise;
}

export interface YouTubePlayerApi {
    ready: boolean;
    isPlaying: boolean;
    play: () => void;
    pause: () => void;
    getCurrentTime: () => number;
}

/** hostRef の中に youtube-nocookie プレイヤーを生成し、制御メソッドを返す。 */
export function useYouTubePlayer(
    hostRef: React.RefObject<HTMLDivElement | null>,
    videoId: string | null,
): YouTubePlayerApi {
    const playerRef = useRef<any>(null);
    const [ready, setReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!videoId || !hostRef.current) return;
        let cancelled = false;
        let player: any = null;
        loadYouTubeApi().then(() => {
            if (cancelled || !hostRef.current || !window.YT) return;
            const el = document.createElement('div');
            hostRef.current.innerHTML = '';
            hostRef.current.appendChild(el);
            player = new window.YT.Player(el, {
                videoId,
                host: 'https://www.youtube-nocookie.com',
                width: '100%',
                height: '100%',
                playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
                events: {
                    onReady: () => { if (!cancelled) { playerRef.current = player; setReady(true); } },
                    onStateChange: (e: any) => {
                        if (cancelled || !window.YT) return;
                        setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
                    },
                },
            });
        });
        return () => {
            cancelled = true;
            setReady(false);
            setIsPlaying(false);
            try { if (player && player.destroy) player.destroy(); } catch { /* noop */ }
            playerRef.current = null;
        };
    }, [videoId, hostRef]);

    const play = useCallback(() => { try { playerRef.current?.playVideo?.(); } catch { /* noop */ } }, []);
    const pause = useCallback(() => { try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ } }, []);
    const getCurrentTime = useCallback(() => {
        try { return playerRef.current?.getCurrentTime?.() ?? 0; } catch { return 0; }
    }, []);

    return { ready, isPlaying, play, pause, getCurrentTime };
}
