/**
 * ハウジンガー OGP カード(_housingerCard.ts)の色・寸法・ヘッダーなど共通の定数。
 */

// ハウジングのトンマナ(正典 docs/.private/housing-tour-mockup/index.html 系統の色)。
// 枠線色 #ffeb99 はユーザー提供SVGの実測値(stroke="#ffeb99")。
export const BG_COLOR = '#111725';
export const ACCENT_HONEY = '#ffeb99';
export const TEXT_MUTED = 'rgba(255,255,255,0.6)';
/** ファンサイトポリシー対応の著作権表記。既存フッター (ja.json footer.copyright) と同一文言。 */
export const COPYRIGHT_TEXT = '© SQUARE ENIX CO., LTD. All Rights Reserved.';
export const GLOW_TEXT_SHADOW = '0 0 20px rgba(255,220,140,0.9), 0 0 40px rgba(255,180,80,0.6)';
/** ブランド文字(名前/Shared via/LoPo)専用の色・フォント(2026-08-04 Artifact確定値)。
 * ハウジング標準のInter・太さ800で統一(縮小はせず、名前が長い場合はmaxWidthで自然に折り返す)。 */
export const BRAND_TEXT_COLOR = '#fff3c3';
export const BRAND_FONT_FAMILY = '"Inter"';
export const BRAND_FONT_WEIGHT = 800;

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const BORDER_MARGIN = 16;
/** カード1枚あたり常に埋める写真スロット数(採用2案とも共通)。 */
export const GRID_PHOTO_SLOTS = 10;
export const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};
