/**
 * 匿名コピー集計ID（localStorage保存）
 * 未ログインユーザーのコピー重複排除にのみ使用。
 * サーバはこのIDから個人を特定する手段を持たない。
 * ブラウザのデータクリアでリセットされる。
 */
const STORAGE_KEY = 'lopo_anon_copy_id';

export function getAnonCopyId(): string | null {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
