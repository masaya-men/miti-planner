// src/hooks/useHaptic.ts
import { INTERACTION } from '../tokens/interactionTokens';

type HapticLevel = 'light' | 'medium' | 'success';

export function useHaptic() {
  const vibrate = (level: HapticLevel) => {
    if (!navigator.vibrate) return;
    const pattern = level === 'success'
      ? Array.from(INTERACTION.haptic.success)
      : INTERACTION.haptic[level];
    navigator.vibrate(pattern);
  };

  return { vibrate };
}
