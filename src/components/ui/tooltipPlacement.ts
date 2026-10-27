/** ポップアップをカーソル右横(below ならカーソルの下)に配置し、はみ出す場合だけ補正する。
 *  MIL-SPEC の title 置き換え(MilspecTitleTooltip)も同じ置き方を使う。 */
export function placeTooltipPopup(popup: HTMLElement, x: number, y: number, below = false): void {
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // カーソルの右横（縦はカーソル中心揃え）
    let left = x + CURSOR_OFFSET_X;
    let top = y - ph / 2;

    if (below) {
        // カーソルの真下(横は中心揃え)。下にはみ出すときだけ上へ
        left = x - pw / 2;
        top = y + BELOW_OFFSET_Y;
        if (top + ph > vh - VIEWPORT_PADDING) top = y - BELOW_OFFSET_Y - ph;
        // 右端のアイコンで画面外へはみ出さないよう右も画面内に収める(左は下の共通クランプ)
        left = Math.min(left, vw - pw - VIEWPORT_PADDING);
    } else if (left + pw > vw - VIEWPORT_PADDING) {
        // 右端はみ出し → 左側に配置
        left = x - CURSOR_OFFSET_X - pw;
    }

    // 上下・左のクランプ
    top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - ph - VIEWPORT_PADDING));
    left = Math.max(VIEWPORT_PADDING, left);

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

// カーソル右横からの距離
const CURSOR_OFFSET_X = 16;

// 画面端からの最小マージン
const VIEWPORT_PADDING = 8;

// below 指定時: カーソルの下に出すときの距離(照準のタグはアイコンの上側右にあるので重ならない)
const BELOW_OFFSET_Y = 26;
