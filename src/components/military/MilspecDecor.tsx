import type { CSSProperties } from 'react';
import { barcodeRects } from './milspecDecorGeometry';
import './MilspecDecor.css';

// MIL-SPEC v11 の小さな飾り部品(見本 milspec-v11.js の lampH / idH / barH / lgH と css の .scr .rv .mp)。
// 位置は親が style(left/top/width)で渡す。見た目は military.css の「v11 飾り」節。すべて装飾なので aria-hidden。

type LedState = 'off' | 'on' | 'warn' | 'dng';

/** ランプ(見本 lampH): 穴の縁 → レンズ → 奥の発光体の 3 層。flick = 点灯の瞬間のチラつき / blink = 1.3s ごとの点滅(見本 .lamp.blink) */
export function MilspecLed({ state = 'off', size, flick, blink, style }: { state?: LedState; size?: number; flick?: boolean; blink?: boolean; style?: CSSProperties }) {
  const cls = ['milspec-led', state !== 'off' && `is-${state}`, flick && 'is-flick', blink && 'is-blink'].filter(Boolean).join(' ');
  const st = size != null ? ({ ['--s' as string]: `${size}px`, ...style } as CSSProperties) : style;
  return (
    <span className={cls} style={st} aria-hidden="true">
      <i className="milspec-led-lens"><i className="milspec-led-src" /></i>
    </span>
  );
}

/** 刻印の文字(見本 lgH)。sub が空なら副題を出さない */
export function MilspecStencil({ en, sub, hi, style }: { en: string; sub?: string; hi?: boolean; style?: CSSProperties }) {
  return (
    <span className={hi ? 'milspec-stencil is-hi' : 'milspec-stencil'} style={style} aria-hidden="true">
      {en}
      {sub ? <span className="milspec-stencil-sub">{sub}</span> : null}
    </span>
  );
}

/** 識別コード(見本 idH。Doto の小さな ID 刻印) */
export function MilspecMark({ text, style }: { text: string; style?: CSSProperties }) {
  return <span className="milspec-mark" style={style} aria-hidden="true">{text}</span>;
}

/** ネジ(座金つき。すり割りの向きは rotate で変える。ホバーで少し回る) */
export function MilspecScrew({ rotate, style }: { rotate?: string; style?: CSSProperties }) {
  const st = rotate ? ({ ['--r' as string]: rotate, ...style } as CSSProperties) : style;
  return <span className="milspec-screw" style={st} aria-hidden="true" />;
}

/** リベット */
export function MilspecRivet({ style }: { style?: CSSProperties }) {
  return <span className="milspec-rivet" style={style} aria-hidden="true" />;
}

/** 点検記録の刻印板(見本 js:849)。bars は各線の幅(%) */
export function MilspecMaintPlate({ title, bars, width, style }: { title: string; bars: number[]; width: number; style?: CSSProperties }) {
  return (
    <div className="milspec-maint" style={{ width, ...style }} aria-hidden="true">
      <b>{title}</b>
      {bars.map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}
    </div>
  );
}

/** デカール(見本 .dc。Michroma の極小文字の刻印) */
export function MilspecDecal({ text, style }: { text: string; style?: CSSProperties }) {
  return <span className="milspec-decal" style={style} aria-hidden="true">{text}</span>;
}

/** ハザードの縞(見本 .hz。ダークは琥珀、ライトは赤の斜線) */
export function MilspecHazard({ w, h, style }: { w: number; h: number; style?: CSSProperties }) {
  return <span className="milspec-hz" style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

/** バーコード */
export function MilspecBarcode({ h = 6, bars, k, style }: { h?: number; bars?: number[]; k?: number; style?: CSSProperties }) {
  const { w, rects } = barcodeRects(h, bars, k);
  return (
    <svg className="milspec-barcode" width={w.toFixed(1)} height={h} viewBox={`0 0 ${w.toFixed(1)} ${h}`} style={style} aria-hidden="true">
      {rects.map((r, i) => <rect key={i} x={r.x.toFixed(1)} y={0} width={r.w.toFixed(1)} height={h} />)}
    </svg>
  );
}
