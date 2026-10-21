import { armorDefsSVG } from './svg';

const DEFS_ID = 'milspec-armor-defs';

/** 粒子ノイズ(見本 js:1204-1207 と同じ)。canvas が使えない環境では '' を返す */
function makeNoiseUrl(): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    if (!x) return '';
    const im = x.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = Math.random() * 30;
    }
    x.putImageData(im, 0, 0);
    return c.toDataURL();
  } catch {
    return '';
  }
}

/** 共通 defs は画面に 1 つだけ。無ければ body 直下に作る(消さない = 他の区画も使う) */
export function ensureDefs(): void {
  if (document.getElementById(DEFS_ID)) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="${DEFS_ID}" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${armorDefsSVG(makeNoiseUrl())}</defs></svg>`;
  const svg = wrap.firstElementChild;
  if (svg) document.body.appendChild(svg);
}
