import React from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useProgressRecording } from '../progress/useProgressRecording';

// MYジョブハイライトの ON/OFF を「親コンテナの属性1個」に橋渡しするだけの小コンポーネント。
// これ自身だけが myJobHighlight を購読して再描画される（null を返すだけ＝軽い）。
// 各アイコン側は購読しないので、トグルしても一斉再描画されない（薄暗くは CSS が担当）。
export const MyJobHighlightAttrBridge: React.FC<{ targetRef: React.RefObject<HTMLDivElement | null> }> = ({ targetRef }) => {
    const on = useMitigationStore(s => s.myJobHighlight && s.myMemberId != null);
    React.useLayoutEffect(() => {
        const el = targetRef.current;
        if (el) el.setAttribute('data-myjob-highlight', on ? '1' : '0');
    }, [on, targetRef]);
    return null;
};

// 進捗記録モードの ON/OFF を親コンテナの属性1個に橋渡し（これ自身だけ購読・軽い）。
// 記録モード中は CSS で「行のどこをクリックしても打点できる」ことを示す（行ハイライト + 専用カーソル）。
export const RecordModeAttrBridge: React.FC<{ targetRef: React.RefObject<HTMLDivElement | null> }> = ({ targetRef }) => {
    const on = useProgressRecording(s => s.recordMode);
    React.useLayoutEffect(() => {
        const el = targetRef.current;
        if (el) el.setAttribute('data-record-mode', on ? '1' : '0');
    }, [on, targetRef]);
    return null;
};
