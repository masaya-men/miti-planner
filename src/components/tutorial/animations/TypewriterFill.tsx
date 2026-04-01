// src/components/tutorial/animations/TypewriterFill.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypewriterConfig } from '../../../data/tutorialDefinitions';

interface TypewriterFillProps {
  config: TypewriterConfig;
  onComplete: () => void;
}

/**
 * チュートリアル用タイプライター入力演出。
 * 指定された input 要素に1文字ずつテキストを入力し、React の state を更新する。
 * prefers-reduced-motion 時は即座に全文表示。
 */
export function TypewriterFill({ config, onComplete }: TypewriterFillProps) {
  const { t } = useTranslation();
  const [fieldIndex, setFieldIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  // onComplete を ref に保持することで、参照が変わっても useEffect が再実行されないようにする
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // prefers-reduced-motion チェック
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (completedRef.current) return;
    const fields = config.fields;
    if (!fields || fields.length === 0) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }

    const currentField = fields[fieldIndex];
    if (!currentField) {
      // 全フィールド完了
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }

    const fullText = currentField.raw ? currentField.text : t(currentField.text);
    const el = document.querySelector(currentField.target) as HTMLInputElement | null;
    if (!el) return;

    // reduced-motion: 即座に全文入力
    if (prefersReduced) {
      setNativeInputValue(el, fullText);
      if (fieldIndex < fields.length - 1) {
        setFieldIndex(prev => prev + 1);
        setCharIndex(0);
      } else {
        completedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }

    // 1文字ずつ入力
    if (charIndex <= fullText.length) {
      const partial = fullText.slice(0, charIndex);
      setNativeInputValue(el, partial);

      if (charIndex < fullText.length) {
        const delay = currentField.charDelay ?? 80;
        timerRef.current = setTimeout(() => {
          setCharIndex(prev => prev + 1);
        }, delay);
      } else {
        // 現フィールド完了 → 次フィールドへ
        timerRef.current = setTimeout(() => {
          if (fieldIndex < fields.length - 1) {
            setFieldIndex(prev => prev + 1);
            setCharIndex(0);
          } else {
            completedRef.current = true;
            onCompleteRef.current();
          }
        }, 400); // フィールド間の間
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fieldIndex, charIndex, config, t, prefersReduced]);

  // レンダリングなし（DOM操作のみ）
  return null;
}

/**
 * React 管理の input に外部から値をセットする。
 * nativeInputValueSetter + input イベント発火で React の onChange を起動。
 */
function setNativeInputValue(el: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
