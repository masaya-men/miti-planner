// メモ本文を描画。通常表示(readonly)でのみ使う。URL は新タブで開くリンク、文字はそのまま。
// 危険対策: parseMemoLinks が http(s) のみを url にする + rel=noopener noreferrer。
import React from 'react';
import { parseMemoLinks } from './parseMemoLinks';

export const MemoText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {parseMemoLinks(text).map((seg, i) =>
      seg.type === 'url' ? (
        <a
          key={i}
          href={seg.value}
          target="_blank"
          rel="noopener noreferrer"
          className="plan-memo__link"
          // メモ枠への伝播を止める(readonly では枠側は no-op だが安全策)。
          onClick={(e) => e.stopPropagation()}
        >
          {seg.value}
        </a>
      ) : (
        <React.Fragment key={i}>{seg.value}</React.Fragment>
      ),
    )}
  </>
);
