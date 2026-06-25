/**
 * navigator.storage.persist() を冪等・例外安全に要求する。
 * Chrome/Firefox では「消去対象外」へ昇格できる（best-effort）。
 * Safari タブには付与されにくいため、これは保険の1枚に過ぎない。
 * @returns 永続化が有効か（非対応・失敗時は false）。呼び出し側は無視してよい。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist || !navigator.storage?.persisted) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('persist 要求に失敗:', err);
    return false;
  }
}
