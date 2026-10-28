import { useEffect, useState } from 'react';

export const useLoadingBreathing = (isLoadingPhase: boolean) => {
    // Rev 4: 2 段階アニメ。
    //   Phase A: slide-in (y 100% → 0) with bouncy spring → ~700ms 後に hasSettled=true
    //   Phase B: hasSettled=true → 呼吸ループ (y: 0 ↔ -12px) を framer-motion で発火
    //   loading → preview 遷移時は、 呼吸の現在値から y=0 へ smooth tween で戻し、
    //   layout (height growth) も smooth tween で同時進行 → 「同じシートが伸びる」 演出。
    const [hasSettled, setHasSettled] = useState(false);
    useEffect(() => {
        if (isLoadingPhase) {
            // 初期 slide-in (~700ms) が終わってから呼吸モードに切替
            const tid = window.setTimeout(() => setHasSettled(true), 700);
            return () => {
                window.clearTimeout(tid);
            };
        }
        // loading を抜けたら次回開示用にリセット
        setHasSettled(false);
    }, [isLoadingPhase]);
    return hasSettled;
};
