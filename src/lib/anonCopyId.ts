/**
 * 匿名コピー集計ID（localStorage保存）
 * 未ログインユーザーのコピー重複排除にのみ使用。
 * サーバはこのIDから個人を特定する手段を持たない。
 * ブラウザのデータクリアでリセットされる。
 */
const STORAGE_KEY = 'lopo_anon_copy_id';

export function getAnonCopyId(): string | null {
  try {
    // Storage.prototype 経由で呼び出すことでテスト時のスパイが確実に反映される
    let id = Storage.prototype.getItem.call(localStorage, STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      Storage.prototype.setItem.call(localStorage, STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage 無効環境（プライベートブラウジング等）
    return null;
  }
}
