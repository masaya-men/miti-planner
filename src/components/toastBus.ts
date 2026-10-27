type ToastType = 'success' | 'error' | 'info';

let addToastFn: ((message: string, type: ToastType) => void) | null = null;
const pendingQueue: { message: string; type: ToastType }[] = [];

/** ToastContainer が表示用の関数を登録/解除する。登録時にマウント前に溜まったトーストを流す */
export function registerToastHandler(fn: ((message: string, type: ToastType) => void) | null): void {
    addToastFn = fn;
    if (fn) {
        // マウント前にキューに溜まったトーストを処理
        while (pendingQueue.length > 0) {
            const item = pendingQueue.shift()!;
            fn(item.message, item.type);
        }
    }
}

/** グローバルにトーストを表示する（Reactマウント前でもキューに溜まる） */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (addToastFn) {
        addToastFn(message, type);
    } else {
        pendingQueue.push({ message, type });
    }
}
