const KEY = 'lopo_local_safety_seen';

/** ローカルデータ安全性の説明を一度開いたか */
export function isLocalSafetySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** 説明を開いたことを記録（赤ドットを消す） */
export function markLocalSafetySeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // localStorage 不可環境では無視
  }
}
