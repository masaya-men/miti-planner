import React from 'react';

/** 構造シーム — サイドバー(可変パネル)と本体(固定筐体)は別ハルという原則を
 *  物理的な溝で明示する装飾コンポーネント(装飾のみ・状態を消費しない)。
 *  正典: docs/.private/theme-refs/milspec-mockup.html CSS .seam(254-263)/ .conduit(1710-1789)/
 *  DOM(1909 の <div class="conduit">)。
 *
 *  mockup の .conduit は `.app` グリッド全体基準の絶対 px 配置(left:296px)だが、SP1 は
 *  clamp() ベースの流動幅グリッドのためその px 値がそのまま意味を持たない。Task 7 が
 *  PCB ハーネスを `.app` 全体基準の絶対配置から専用列内配置(fp-harness)へ変更したのと
 *  同じ考え方で、導管も `.milspec-seam`(seam グリッド列そのもの)の内側に
 *  `position:relative` を基準にした `left:50%; transform:translateX(-50%)` の
 *  列内中央寄せに変更する(military.css 側で実装)。
 *
 *  溝の左右の壁のリベットは各ゾーン自身の `.milspec-chan::after` が担当済み
 *  (mockup 側コメント同旨)のため、ここでは溝の底(グラデーション)+ 導管本体のみを描画する。 */
export const MilspecSeam: React.FC = () => (
  <div className="milspec-seam" aria-hidden="true">
    <span className="milspec-seam-conduit" />
  </div>
);
