import React, { useState, useEffect, useRef } from 'react';
import { getContentById } from '../../data/contentRegistry';
import { getFilteredBosses } from '../../lib/contentSelection';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../../types';
import { useTutorialStore } from '../../store/useTutorialStore';

/** 新規作成モーダルの選択状態(レベル・カテゴリ・ボス・タイトル)と、その連動 effect。 */
export function useNewPlanSelection(isOpen: boolean, initialContentId: string | null | undefined) {
    // Selection State — レベル・カテゴリは未選択スタート
    const [level, setLevel] = useState<ContentLevel | null>(null);
    const [category, setCategory] = useState<ContentCategory | null>(null);
    const [boss, setBoss] = useState<ContentDefinition | null>(null);
    const [title, setTitle] = useState('');
    const skipCategoryResetRef = useRef(false);

    // モーダルが開くたびにリセット。initialContentId があればそのコンテンツを選択済みにする。
    useEffect(() => {
        if (isOpen) {
            useTutorialStore.getState().completeEvent('create:modal-opened');
            const seed = initialContentId ? getContentById(initialContentId) : null;
            if (seed && (seed.category === 'savage' || seed.category === 'ultimate')) {
                skipCategoryResetRef.current = true; // 直後の [category] リセットを 1 回だけ無視
                setLevel(seed.level);
                setCategory(seed.category);
                setBoss(seed);
                setTitle(seed.shortName.en || seed.shortName.ja || '');
            } else {
                setLevel(null);
                setCategory(null);
                setBoss(null);
                setTitle('');
            }
        }
    }, [isOpen, initialContentId]);

    const titleInputRef = useRef<HTMLInputElement>(null);

    // 零式・絶の場合のみドロップダウン用のコンテンツリストを生成
    // シリーズ単位で patch 降順 (新パッチ上)、 シリーズ内は order 昇順 (P1 → 本体、 1 層 → 4 層)。
    const filteredBosses = React.useMemo(
        () => getFilteredBosses(level, category),
        [level, category],
    );

    // フィルタ変更時にbossをリセット
    useEffect(() => {
        if (boss && !filteredBosses.some(b => b.id === boss.id)) {
            setBoss(null);
        }
    }, [filteredBosses, boss]);

    // カテゴリ変更時にbossとタイトルをリセット。
    // ただし initialContentId でシード中(open 直後の1回)はスキップ — シードした boss/title を消さない。
    useEffect(() => {
        if (skipCategoryResetRef.current) {
            skipCategoryResetRef.current = false;
            return;
        }
        setBoss(null);
        setTitle('');
        ;
    }, [category]);

    // ドロップダウンからボスを選択
    const handleBossSelect = (selectedBoss: ContentDefinition) => {
        setBoss(selectedBoss);
        const defaultName = selectedBoss.shortName.en || selectedBoss.shortName.ja;
        setTitle(defaultName);
        ;

        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 50);
    };

    return { level, setLevel, category, setCategory, boss, title, setTitle, titleInputRef, filteredBosses, handleBossSelect };
}
