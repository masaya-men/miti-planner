// src/tokens/mobileTokens.ts
export const MOBILE_TOKENS = {
  header: {
    height: 72,
    titleSize: 26,
    logoSize: 11,
    subtitleSize: 12,
    logoLetterSpacing: '0.15em',
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
