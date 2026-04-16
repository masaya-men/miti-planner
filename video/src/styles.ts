export const COLORS = {
  bg: "#0F0F10",
  text: "#F0F0F0",
  muted: "#a1a1aa",
} as const;

export const FONT = {
  main: "Rajdhani, M PLUS 1, system-ui, sans-serif",
  weight: 500,
  letterSpacing: "0.02em",
} as const;

export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

export const sec = (s: number) => s * VIDEO.fps;
