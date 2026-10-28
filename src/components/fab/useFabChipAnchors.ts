import React from 'react';

interface FabChipAnchorFlags {
    langOpen: boolean;
    effectModeOpen: boolean;
    partyVisOpen: boolean;
}

export const useFabChipAnchors = ({ langOpen, effectModeOpen, partyVisOpen }: FabChipAnchorFlags) => {
    // 言語ボタンの位置を取得（言語チップを Portal で body に出すため）
    // overflow-y-auto のメニュー内では横方向に展開するチップが clip されるので Portal 化が必須。
    // ラベル幅も一緒に実測する(チップの開始位置計算に使う。固定50px決め打ちだと「スクロール演出」
    // のような長いラベルにチップが重なるバグだったため。2026-08-14実機FB)。
    const langButtonRef = React.useRef<HTMLButtonElement>(null);
    const langLabelRef = React.useRef<HTMLSpanElement>(null);
    const [langButtonRect, setLangButtonRect] = React.useState<DOMRect | null>(null);
    const [langLabelWidth, setLangLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!langOpen) {
            setLangButtonRect(null);
            return;
        }
        const update = () => {
            if (langButtonRef.current) {
                setLangButtonRect(langButtonRef.current.getBoundingClientRect());
            }
            if (langLabelRef.current) {
                setLangLabelWidth(langLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        // capture phase でメニュー内 scroll も拾う
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [langOpen]);

    // パーティ表示/非表示ボタンの位置取得(言語/エフェクトモードボタンと同じ仕組み)。
    // ラベル幅も実測する(2026-08-19実機FB: 固定オフセットだとグリッドがFABラベル文言
    // 「表示メンバー」に重なるバグだった。言語/エフェクトモードと同じ理由・同じ直し方)。
    const partyVisButtonRef = React.useRef<HTMLButtonElement>(null);
    const partyVisLabelRef = React.useRef<HTMLSpanElement>(null);
    const [partyVisButtonRect, setPartyVisButtonRect] = React.useState<DOMRect | null>(null);
    const [partyVisLabelWidth, setPartyVisLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!partyVisOpen) {
            setPartyVisButtonRect(null);
            return;
        }
        const update = () => {
            if (partyVisButtonRef.current) {
                setPartyVisButtonRect(partyVisButtonRef.current.getBoundingClientRect());
            }
            if (partyVisLabelRef.current) {
                setPartyVisLabelWidth(partyVisLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [partyVisOpen]);

    // エフェクトモードボタンの位置取得(言語ボタンと同じ仕組み)。
    const effectModeButtonRef = React.useRef<HTMLButtonElement>(null);
    const effectModeLabelRef = React.useRef<HTMLSpanElement>(null);
    const [effectModeButtonRect, setEffectModeButtonRect] = React.useState<DOMRect | null>(null);
    const [effectModeLabelWidth, setEffectModeLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!effectModeOpen) {
            setEffectModeButtonRect(null);
            return;
        }
        const update = () => {
            if (effectModeButtonRef.current) {
                setEffectModeButtonRect(effectModeButtonRef.current.getBoundingClientRect());
            }
            if (effectModeLabelRef.current) {
                setEffectModeLabelWidth(effectModeLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [effectModeOpen]);

    return {
        langButtonRef, langLabelRef, langButtonRect, langLabelWidth,
        partyVisButtonRef, partyVisLabelRef, partyVisButtonRect, partyVisLabelWidth,
        effectModeButtonRef, effectModeLabelRef, effectModeButtonRect, effectModeLabelWidth,
    };
};
