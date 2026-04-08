// src/tokens/interactionTokens.ts
export const INTERACTION = {
  drag: {
    holdDelay: 150,    // D&D長押し開始 (ms)
    moveThreshold: 8,  // ドラッグ判定の移動量 (px)
  },
  swipe: {
    deleteThreshold: 80,  // スワイプ削除の発火閾値 (px)
  },
  contextMenu: {
    holdDelay: 300,  // コンテキストメニュー長押し (ms)
  },
  haptic: {
    light: 10,           // 軽いフィードバック (ms)
    medium: 15,          // 中程度 (ms)
    success: [10, 30, 10] as readonly number[],  // 成功パターン
  },
} as const;
