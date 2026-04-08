// src/tokens/motionTokens.ts

// framer-motion spring presets
export const SPRING = {
  default: { type: 'spring' as const, stiffness: 400, damping: 28 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 24 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
} as const;

// CSS transition durations (ms)
export const DURATION = {
  fast: 150,
  normal: 250,
  sheet: 350,
} as const;

// CSS easing curves
export const EASING = {
  sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

// Stagger delays (ms)
export const STAGGER = {
  fab: 40,
} as const;

// Scale values
export const SCALE = {
  press: 0.96,
  drag: 1.15,
  dropTarget: 1.08,
  ctxMenu: 0.8,
  tapActive: 0.95,
} as const;
