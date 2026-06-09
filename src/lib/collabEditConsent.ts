// ⑤-3c: 共同編集の「初回フル警告に同意したか」を部屋ごと（roomToken 単位）に記録する。
// 別の固定パーティ（別 roomToken）を開いたら未同意＝フル警告が再度出る（設計書 §3）。
// 編集はオーナーの本物の表を undo 無しで書き換えるため、文脈（部屋）が変わるたびに警告する。
const KEY = "lopo_collab_edit_consent";

function read(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** この roomToken の部屋に同意済みか。 */
export function hasCollabEditConsent(roomToken: string): boolean {
  return read()[roomToken] === true;
}

/** この roomToken の部屋への同意を記録する（以後この部屋ではフル警告を出さない）。 */
export function setCollabEditConsent(roomToken: string): void {
  const map = read();
  map[roomToken] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // プライベートモード等で書けない場合は無視（毎回警告が出るが安全側）。
  }
}
