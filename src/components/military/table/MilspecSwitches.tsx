import React from 'react';
import type { Ref } from 'react';
import { MilspecLed } from '../MilspecDecor';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import './MilspecSwitches.css';

// 表の操作列のスイッチ(見本 v11 css:182-214 の横ロッカー / css:245-258 の横スライド)。
// どちらも「押された状態」は呼び出し側(ストア)が持つ。ここは見た目・動き・ARIA だけ。

const GI = <svg viewBox="0 0 6 6"><path d="M3 0.8V5.2" /></svg>;
const GO = <svg viewBox="0 0 6 6"><circle cx="3" cy="3" r="2" /></svg>;

export interface MilspecHRockerProps {
  label: string;
  ariaLabel: string;
  checked: boolean;
  onToggle: () => void;
  /** smoke・テストが探すための印 */
  deckId: string;
  /** 全体の枠(PiP のメニューがこの位置を基準に開く) */
  wrapRef?: Ref<HTMLDivElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * 横ロッカー(O | I)。重く倒れ、倒れ切ってから表示灯 → 信号がジョブの基板へ(js:1071-1075)。
 * 灯は ON にして 200ms 後に点く(チラつきつき)。OFF は即消える。
 */
export function MilspecHRocker({ label, ariaLabel, checked, onToggle, deckId, wrapRef, onMouseEnter, onMouseLeave }: MilspecHRockerProps) {
  const [lamp, setLamp] = React.useState(checked);
  const [flick, setFlick] = React.useState(false);
  React.useEffect(() => {
    if (!checked) { setLamp(false); setFlick(false); return; }
    // すでに点いているなら何もしない(初回表示・再描画)
    if (lamp) return;
    const id = window.setTimeout(() => { setLamp(true); setFlick(true); }, 200);
    return () => window.clearTimeout(id);
    // lamp は意図的に依存に入れない(checked の変化だけで動かす)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  return (
    <div className="milspec-hr-u" ref={wrapRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <span className="milspec-lbl">{label}</span>
      <div className="milspec-hr-row">
        <button type="button" className="milspec-hr" role="switch" aria-checked={checked} aria-label={ariaLabel} data-deck={deckId} onClick={onToggle}>
          <span className="milspec-hr-bz" />
          <span className="milspec-hr-well">
            <span className="milspec-hr-k is-l"><i className="milspec-hr-top" /><i className="milspec-hr-end" /><i className="milspec-hr-face">{GO}</i></span>
            <span className="milspec-hr-k is-r"><i className="milspec-hr-top" /><i className="milspec-hr-end" /><i className="milspec-hr-face">{GI}</i></span>
          </span>
        </button>
        <MilspecLed state={lamp ? 'on' : 'off'} flick={flick} size={7} />
      </div>
    </div>
  );
}

/** つまみの動き(見本 js:722-731 slideKnob の値そのまま) */
function slideKnobFrames(on: boolean): Keyframe[] {
  const from = on ? 0 : 17, to = on ? 17 : 0, d = Math.sign(to - from);
  return [
    { transform: `translateX(${from}px)`, easing: 'cubic-bezier(.5,0,1,.6)' },
    { transform: `translateX(${from - d * 0.9}px)`, offset: 0.16, easing: 'cubic-bezier(.8,0,.2,1)' },
    { transform: `translateX(${to + d * 1.6}px)`, offset: 0.74, easing: 'cubic-bezier(.2,.8,.3,1)' },
    { transform: `translateX(${to - d * 0.45}px)`, offset: 0.88 },
    { transform: `translateX(${to}px)` },
  ];
}

export interface MilspecHSlideProps {
  label: string;
  ariaLabel: string;
  checked: boolean;
  onToggle: () => void;
  deckId: string;
}

/** 横スライド(表を展開)。溝は光らない。光るのはつまみのランプ穴だけ(js:1077-1081) */
export function MilspecHSlide({ label, ariaLabel, checked, onToggle, deckId }: MilspecHSlideProps) {
  const reduced = useReducedMotion();
  const knRef = React.useRef<HTMLSpanElement>(null);
  const animate = (frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    const kn = knRef.current;
    if (reduced || !kn || typeof kn.animate !== 'function') return;
    kn.animate(frames, opts);
  };
  const onClick = () => {
    animate(slideKnobFrames(!checked), { duration: 620 });
    onToggle();
  };
  // ホバー: つまみが反対側へ少しだけ寄って戻る(指が近づいた気配)
  const onEnter = () => {
    const x = checked ? 17 : 0, d = x ? -1 : 1;
    animate(
      [{ transform: `translateX(${x}px)` }, { transform: `translateX(${x + d * 1.3}px)`, offset: 0.45, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: `translateX(${x}px)` }],
      { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
  };
  return (
    <div className="milspec-hr-u">
      <span className="milspec-lbl">{label}</span>
      <button type="button" className="milspec-hs" role="switch" aria-checked={checked} aria-label={ariaLabel} data-deck={deckId} onClick={onClick} onPointerEnter={onEnter}>
        <span className="milspec-hs-ch">
          <span className="milspec-hs-kn" ref={knRef}>
            <MilspecLed size={5} />
            <span className="milspec-hs-ribs"><i /><i /><i /></span>
            <MilspecLed size={5} />
          </span>
        </span>
      </button>
    </div>
  );
}
