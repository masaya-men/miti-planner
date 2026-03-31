// src/components/tutorial/TutorialOverlay.tsx
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TutorialPill } from './TutorialPill';
import { TutorialCard } from './TutorialCard';
import { TutorialBlocker } from './TutorialBlocker';
import { PartyAutoFill } from './animations/PartyAutoFill';
import { PillFly } from './animations/PillFly';
import { CompletionCard } from './animations/CompletionCard';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * ターゲット要素のDOM座標をrequestAnimationFrameで追跡する
 */
function useTargetRect(selector: string | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let frameId: number;
    let lastStr = '';

    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const str = `${r.x},${r.y},${r.width},${r.height}`;
        if (str !== lastStr) {
          lastStr = str;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else {
        if (lastStr !== '') {
          lastStr = '';
          setRect(null);
        }
      }
      frameId = requestAnimationFrame(measure);
    };

    frameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frameId);
  }, [selector]);

  return rect;
}

/**
 * ピルの表示位置を計算（ターゲットの上・中央）
 */
function calcPillPos(rect: TargetRect | null): { top: number; left: number } {
  if (!rect) return { top: -100, left: -100 };
  return {
    top: rect.top - 32,
    left: rect.left + rect.width / 2 - 28,
  };
}

/**
 * カードの表示位置を計算（ターゲットの下、または空きスペース）
 */
function calcCardPos(rect: TargetRect | null): { top: number; left: number } {
  if (!rect) return { top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 150 };

  const cardWidth = 300;
  const cardHeight = 120;
  const gap = 12;

  // デフォルト: 下に表示
  let top = rect.top + rect.height + gap;
  let left = rect.left + rect.width / 2 - cardWidth / 2;

  // 画面外にはみ出る場合は上に
  if (top + cardHeight > window.innerHeight - 20) {
    top = rect.top - cardHeight - gap;
  }

  // 左右のクランプ
  left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
  top = Math.max(16, top);

  return { top, left };
}

export function TutorialOverlay() {
  const isActive = useTutorialStore(s => s.isActive);
  const pendingExit = useTutorialStore(s => s.pendingExit);

  const step = useTutorialStore(s => s.getCurrentStep());
  const targetRect = useTargetRect(step?.target ?? null);

  const pillPos = calcPillPos(targetRect);
  const cardPos = calcCardPos(targetRect);

  const handleSkip = useCallback(() => {
    useTutorialStore.getState().requestExit();
  }, []);

  if (!isActive || !step) return null;

  // 特殊演出のレンダリング
  const renderAnimation = () => {
    switch (step.animation) {
      case 'party-auto-fill':
        return <PartyAutoFill onComplete={() => {
          useTutorialStore.getState().completeEvent('party:auto-filled');
        }} />;
      case 'pill-fly':
        return step.pillTransition ? (
          <PillFly
            fromRect={targetRect}
            toSelector={step.pillTransition.toTarget}
            fromLabel={step.pill}
            toLabel={step.pillTransition.toLabel}
          />
        ) : null;
      case 'completion-card':
        return <CompletionCard onDismiss={() => {
          useTutorialStore.getState().completeEvent('tutorial:dismissed');
        }} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* クリックブロック */}
      <TutorialBlocker
        targetRect={targetRect}
        active={!step.animation || step.animation === 'pill-fly'}
      />

      <AnimatePresence mode="wait">
        {/* 特殊演出 */}
        {step.animation && renderAnimation()}

        {/* 通常ピル（演出中は非表示） */}
        {!step.animation && (
          <TutorialPill
            key={`pill-${step.id}`}
            label={step.pill}
            top={pillPos.top}
            left={pillPos.left}
            visible={!!targetRect}
          />
        )}

        {/* 吹き出しカード（完了画面は専用コンポーネント） */}
        {step.animation !== 'completion-card' && (
          <TutorialCard
            key={`card-${step.id}`}
            messageKey={step.messageKey}
            descriptionKey={step.descriptionKey}
            image={step.image}
            top={cardPos.top}
            left={cardPos.left}
            visible={true}
            onSkip={handleSkip}
          />
        )}
      </AnimatePresence>

      {/* 終了確認ダイアログ */}
      {pendingExit && (
        <ExitDialog />
      )}
    </>
  );
}

function ExitDialog() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
      <div className="bg-app-bg border border-app-text/15 rounded-xl p-6 max-w-xs text-center shadow-xl">
        <p className="text-sm text-app-text font-semibold mb-4">
          {t('tutorial.exit_confirm')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => useTutorialStore.getState().cancelExit()}
            className="px-4 py-2 text-xs rounded-lg border border-app-text/15 text-app-text hover:bg-app-text/5 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => useTutorialStore.getState().confirmExit()}
            className="px-4 py-2 text-xs rounded-lg bg-app-text text-app-bg font-semibold hover:opacity-80 transition-opacity"
          >
            {t('tutorial.exit_yes')}
          </button>
        </div>
      </div>
    </div>
  );
}
