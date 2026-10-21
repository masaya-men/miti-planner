import { hex, mix } from './color';
import type { ArmorPalette, ToneColors } from './types';

/** CSS 変数(--ma-*)から装甲の色を読む。ブラウザ専用(getComputedStyle) */
export function readPalette(el: Element): ArmorPalette {
  const cs = getComputedStyle(el);
  const g = (k: string) => hex(cs.getPropertyValue(k));
  const n = (k: string) => parseFloat(cs.getPropertyValue(k)) || 0;
  const s = (k: string) => cs.getPropertyValue(k).trim();
  const tone = (k: string): ToneColors => ({
    top: g(`--ma-${k}-top`), bot: g(`--ma-${k}-bot`), hi: g(`--ma-${k}-hi`), lo: g(`--ma-${k}-lo`),
    face: mix(g(`--ma-${k}-top`), g(`--ma-${k}-bot`), 0.45),
  });
  return {
    pri: tone('pri'), sec: tone('sec'), chs: tone('chs'), key: tone('key'),
    edge: g('--ma-a-edge'), keyEdge: g('--ma-key-edge'),
    pkTop: g('--ma-a-pk-top'), pkBot: g('--ma-a-pk-bot'),
    scribe: s('--ma-a-scribe'), scribeHi: s('--ma-a-scribe-hi'), seam: s('--ma-seam'), seamCore: s('--ma-seam-core'),
    dish: n('--ma-key-dish'), keySh: n('--ma-key-sh'), grain: n('--ma-grain'), spec: n('--ma-spec'),
  };
}
