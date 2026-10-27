import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { type StepId, visibleStepIds } from './registerPageModel';

export function useRegisterScrollSpy(mode: 'create' | 'edit', user: User | null) {
  // mode で出すステップを絞る (Task3.4-1)。mode は生存中不変の prop なので依存は [mode] のみ。
  const effectiveStepIds = useMemo<StepId[]>(() => visibleStepIds(mode), [mode]);

  // ===== scroll-spy (ライブステッパー) =====
  // 中央スクロールコンテナと各セクション wrapper に ref を張り、IntersectionObserver で
  // 可視セクションを active にする (scroll ハンドラで layout 読みしない方針)。
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<StepId, HTMLDivElement | null>>({
    media: null,
    address: null,
    intro: null,
    visibility: null,
    confirm: null,
  });
  // 初期 active は「実際に表示される先頭ステップ」(create=media / edit=address)。
  const [activeStepId, setActiveStepId] = useState<StepId>(() => effectiveStepIds[0]);
  // 中央スクロールが最下部に達しているか (下の scroll ハンドラが更新)。最下部では最終
  // セクション (confirm) を強制 active にし、IO が手前のセクションへ戻すのを抑止する (#7)。
  const atBottomRef = useRef(false);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 最下部では scroll ハンドラが confirm を確定させるので IO の判定はスキップ (#7)。
        if (atBottomRef.current) return;
        // 交差中セクションのうち画面最上位 (boundingClientRect.top が最小) のものを active に。
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = (visible[0].target as HTMLElement).dataset.stepId as StepId | undefined;
        if (topId) setActiveStepId(topId);
      },
      { root, threshold: 0.2, rootMargin: '0px 0px -60% 0px' },
    );

    for (const id of effectiveStepIds) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // user が null→truthy でフォーム(scrollContainerRef/各セクション)が mount された後に observer を張り直す
  }, [user, effectiveStepIds]);

  // 最下部到達時に最終ステップ (confirm) を active にする (#7)。IO の active 帯 (top 40%) は
  // 最後のセクションが下端で止まると届かず、確認ステップまで highlight が降りてこないため、
  // scroll で最下部を検知して補う。スクロール不能な短い内容では発火させない (先頭を保つ)。
  //
  // 同じ scroll ハンドラで左パネルの接続線塗り進行度 (0..1・Task2) も更新する。progress の
  // 読み取り/計算だけ rAF スロットルし (連続 scroll イベントを 1 フレームに間引く)、
  // atBottom/activeStepId の既存ロジックは同期のまま (挙動不変)。
  const [stepperProgress, setStepperProgress] = useState(0);
  const progressRafRef = useRef<number | null>(null);
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const onScroll = () => {
      const scrollable = root.scrollHeight - root.clientHeight > 8;
      const atBottom = scrollable && root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      atBottomRef.current = atBottom;
      if (atBottom) {
        const last = effectiveStepIds[effectiveStepIds.length - 1];
        setActiveStepId((prev) => (prev === last ? prev : last));
      }
      if (progressRafRef.current != null) return;
      progressRafRef.current = window.requestAnimationFrame(() => {
        progressRafRef.current = null;
        const r = scrollContainerRef.current;
        if (!r) return;
        const max = r.scrollHeight - r.clientHeight;
        const ratio = max > 0 ? r.scrollTop / max : 0;
        setStepperProgress(Math.min(1, Math.max(0, ratio)));
      });
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (progressRafRef.current != null) {
        window.cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, [user, effectiveStepIds]);

  const handleJumpToStep = useCallback((id: number) => {
    const stepId = effectiveStepIds[id - 1];
    const el = stepId ? sectionRefs.current[stepId] : null;
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [effectiveStepIds]);

  return { effectiveStepIds, scrollContainerRef, sectionRefs, activeStepId, stepperProgress, handleJumpToStep };
}
