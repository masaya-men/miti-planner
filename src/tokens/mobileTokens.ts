// src/tokens/mobileTokens.ts
export const MOBILE_TOKENS = {
  header: {
    height: 72,
    compactHeight: 52,
    titleSize: 26,
    logoSize: 11,
    subtitleSize: 12,
    logoLetterSpacing: '0.15em',
    phaseBarHeight: 26,
  },
  bottomNav: {
    height: 52,
    iconSize: 24,
    labelSize: 10,
  },
  fab: {
    size: 52,
    itemSize: 44,
    radius: 16,
  },
  sheet: {
    radius: 14,
    handleWidth: 36,
    handleHeight: 5,
    handleRadius: 3,
  },
  touchTarget: {
    min: 44,
  },
  party: {
    slotColumns: 4,
    iconSize: 32,
    jobChipColumns: 6,
    slotRadius: 14,
    jobChipRadius: 12,
  },
} as const;

/**
 * ボトムナビの上に重なるモバイルシート類(メニュー/インポート/軽減追加/イベント編集 等)の
 * bottom オフセット。以前は各シートが独立に `3.5rem`(56px)をハードコードしており、
 * 実際の nav 高さ(MOBILE_TOKENS.bottomNav.height=52 + nav 自身の paddingBottom 2px = 54px)
 * とズレて隙間が見える不具合があった。nav の実測値に追従するようここから算出する。
 */
export const MOBILE_SHEET_BOTTOM_OFFSET_CSS =
  `calc(${MOBILE_TOKENS.bottomNav.height + 2}px + env(safe-area-inset-bottom, 0px))`;
