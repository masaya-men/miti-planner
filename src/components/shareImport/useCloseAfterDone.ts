import { useEffect } from 'react';

// done 状態に遷移してからシートを閉じるまでの遅延 (ms)。
// ユーザーが「完了表示」 を視認する時間を確保するための定数。
const CLOSE_DELAY_AFTER_DONE_MS = 1200;

export const useCloseAfterDone = (status: string, close: () => void) => {
    useEffect(() => {
        if (status !== 'done') return;
        const id = setTimeout(() => close(), CLOSE_DELAY_AFTER_DONE_MS);
        return () => clearTimeout(id);
    }, [status, close]);
};
