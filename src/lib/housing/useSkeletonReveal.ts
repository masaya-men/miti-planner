import { useEffect, useState } from 'react';

/**
 * ダミー表示から本物へ入れ替わるときの「ふわっと表示」の状態。
 * - false: 動きなし (読み込み中 / ダミーが見える前に読み込みが終わった=速いときはもったいぶらない)
 * - 'hold': 本物は描いたが、まだ画面に映っていない。動きは最初のコマで一時停止 (見えない状態) にしておく
 * - 'run': 本物が一度画面に映った後。ここで動きを始める
 *
 * hold を挟む理由: 探すページのように数百枚のカードを一度に作ると、描画の重い処理で画面が止まり、
 * その間にもアニメーションの時計が進んでしまう。最初に映った時点で動きがほぼ終わっていて
 * 「ふわっと」が見えなかった (2026-10-22 本番で実測)。映ったのを 2 コマ待ってから動かせば、
 * 処理の重さに関係なく毎回最初から見える。
 * 呼び出し側は className を付ける判定に真偽値として使い、data-reveal 属性に値をそのまま渡す。
 * delayMs は SkeletonShell の useDelayedFlag の既定 (200ms) と揃える。
 */
export type SkeletonRevealState = false | 'hold' | 'run';

export function useSkeletonReveal(loading: boolean, delayMs = 200): SkeletonRevealState {
  const [seen, setSeen] = useState(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!loading) return;
    setSeen(false);
    setRunning(false);
    const id = setTimeout(() => setSeen(true), delayMs);
    return () => clearTimeout(id);
  }, [loading, delayMs]);
  const reveal = !loading && seen;
  useEffect(() => {
    if (!reveal) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setRunning(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [reveal]);
  if (!reveal) return false;
  return running ? 'run' : 'hold';
}
