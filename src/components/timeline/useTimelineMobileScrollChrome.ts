import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import { getPhaseName } from '../../types';
import type { AppliedMitigation, Phase, TimelineEvent } from '../../types';
import type { RowLayout } from './rowLayout';
import {
    MOBILE_EFFECT_BAR_SCROLL_IDLE_MS,
    MOBILE_EFFECT_BAR_MORPH_DISTANCE_PX,
    MOBILE_EFFECT_BAR_TRACK_MS,
    MOBILE_EFFECT_BAR_FAST_SCROLL_MAX_PX_MS,
    MOBILE_EFFECT_BAR_FAST_SCROLL_MIN_PX_MS,
    MOBILE_EFFECT_BAR_SLOWDOWN_MAX_MS,
} from '../../utils/mobileEffectBar';
import type { MobileEffectBarMode, ContentLanguage } from '../../store/useThemeStore';

interface UseTimelineMobileScrollChromeArgs {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    rowLayoutRef: RefObject<RowLayout>;
    phases: Phase[];
    contentLanguage: ContentLanguage;
    t: TFunction;
    isMobileTimeline: boolean;
    mobileEffectBarMode: MobileEffectBarMode;
    timelineMitigations: AppliedMitigation[];
    timelineEvents: TimelineEvent[];
}

/**
 * スマホのスクロール連動表示(現在フェーズ名のスクラブ表示・エフェクト棒/FAB/Undo-Redo の
 * スクロール中トグル)。Timeline 本体から移したもの。ref/state を経由せず DOM 直書きする方式は元のまま。
 * syncMobilePhaseLabel は本体に残る rowLayout 変化時の effect からも呼ばれるので返す。
 */
export function useTimelineMobileScrollChrome({
    scrollContainerRef, rowLayoutRef, phases, contentLanguage, t, isMobileTimeline,
    mobileEffectBarMode, timelineMitigations, timelineEvents,
}: UseTimelineMobileScrollChromeArgs) {
    // モバイル: スクロール位置(ピクセル)そのものから「今どのフェーズを見ているか」を求める。
    // 縦フェーズ列は「スクロールに連動して自然に流れ替わる」感覚だった(位置がスクロールに
    // 物理的に紐づいていただけで、時間固定のアニメではない)。横のヘッダーでも同じ感覚にする
    // ため、固定時間トランジションではなくスクロール量そのものを進捗 p として transform に
    // 直接反映する「スクラブ」方式にする。
    // ⚠ 時刻(秒)ベースで進捗を出すと、hideEmptyRows(行の間引き表示)時に現在時刻が実在行の
    // 時刻へ飛び飛びにスナップし、2秒の遷移窓を一またぎで通過して「ぱっと切り替わる」ように
    // 見える不具合があった。timeToYMap は間引き時も全時刻ぶんYを持つ(隠れた時刻は直前のYに
    // 圧縮される)ため、scrollTopとYの差分(ピクセル)で比較すれば hideEmptyRows でも滑らかになる。
    // RecastRow と同じく毎スクロールで React state を経由せず ref 直書き(GPU描画・再レンダーなし)。
    const mobilePhaseCurRef = useRef<HTMLSpanElement>(null);
    const mobilePhaseNextRef = useRef<HTMLSpanElement>(null);
    const MOBILE_PHASE_TRANSITION_SECONDS = 2;
    const syncMobilePhaseLabel = useCallback(() => {
        const curEl = mobilePhaseCurRef.current;
        const nextEl = mobilePhaseNextRef.current;
        if (!curEl || !nextEl) return;
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollTop = container.scrollTop;
        const layout = rowLayoutRef.current;
        const yOfTime = (time: number) => layout.topOf(time);

        const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
        const labelFor = (i: number) => {
            const phase = sorted[i];
            const prefix = t('timeline.phase_prefix', { index: i + 1 });
            const customName = getPhaseName(phase.name, contentLanguage);
            return customName && customName !== prefix ? `${prefix}\u3000${customName}` : prefix;
        };

        if (sorted.length === 0 || scrollTop < yOfTime(sorted[0].startTime)) {
            curEl.textContent = '';
            curEl.style.transform = 'translateX(0%)';
            nextEl.textContent = '';
            nextEl.style.transform = 'translateX(100%)';
            return;
        }

        let idx = 0;
        for (let i = 0; i < sorted.length; i++) {
            if (scrollTop >= yOfTime(sorted[i].startTime)) idx = i;
        }

        curEl.textContent = labelFor(idx);

        const next = sorted[idx + 1];
        let p = 0;
        if (next) {
            nextEl.textContent = labelFor(idx + 1);
            const transitionPx = MOBILE_PHASE_TRANSITION_SECONDS * layout.unitPx;
            const distancePx = Math.max(0, yOfTime(next.startTime) - scrollTop);
            p = distancePx <= transitionPx ? 1 - distancePx / transitionPx : 0;
        } else {
            nextEl.textContent = '';
        }

        curEl.style.transform = `translateX(${-p * 100}%)`;
        nextEl.style.transform = `translateX(${(1 - p) * 100}%)`;
    }, [scrollContainerRef, rowLayoutRef, phases, t, contentLanguage]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !isMobileTimeline) return;
        syncMobilePhaseLabel();
        container.addEventListener('scroll', syncMobilePhaseLabel, { passive: true });
        return () => container.removeEventListener('scroll', syncMobilePhaseLabel);
    }, [syncMobilePhaseLabel, isMobileTimeline, scrollContainerRef]);

    // エフェクト棒トグル: スクロール中だけ data-mobile-scrolling="1" を立て、
    // 専用行アイコン⇄エフェクト棒の表示切り替えをCSS側に任せる(React再レンダーなし)。
    // 指が画面に触れている間はアイドルタイマーでクリアしない(指を置いたまま止まっている
    // 一瞬でアイコン表示に戻ってガタつくのを防ぐ、実機FB 2026-08-12)。指を離した瞬間か、
    // 最後の scroll イベントから MOBILE_EFFECT_BAR_SCROLL_IDLE_MS 経過後にクリアする。
    const mobileEffectBarIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mobileEffectBarTouchDownRef = useRef(false);
    // スマホの左端Undo/Redoも、右端FABと同じくスクロール中は隠す(2026-08-13ユーザー要望=
    // 両側で揃えたい)。MobileFAB.tsxとは別コンポーネント間通信だがこちらは同一コンポーネント内の
    // 別要素なのでrefへの直接attribute設定+CSSで済ませる(Reactの再レンダー不要)。
    const undoRedoWrapRef = useRef<HTMLDivElement>(null);
    // 直近の scroll イベント時点の scrollTop/時刻(差分・速度計算の起点)。
    const mobileEffectBarLastScrollRef = useRef<{ top: number; time: number } | null>(null);
    // 現在の連続スクロールで実際に動いた距離の累計(px、向きは問わない)。
    // 位置の差分(戻れば戻る)ではなく移動量の積算にしているのは、指が多少ブレて逆方向に
    // 動いても、スクロールし続けている間は変身が巻き戻らないようにするため
    // (2026-08-13実機FB=下にスクロール後そのまま上に戻すと変身も戻って不自然、との指摘を反映)。
    const mobileEffectBarSessionDistanceRef = useRef(0);
    // このセッションで固定する「進む」アニメの長さ(ms)。セッション最初の速度計測1回だけで決め、
    // 以降は指の速さが変わってもセッション中は変えない(値が動くとtransition-duration自体が
    // 途中で変わってガクつくため)。null=未計測。
    const mobileEffectBarSessionTransitionMsRef = useRef<number | null>(null);
    // scheduleMobileEffectBarHide(依存配列を空に保つためのref経由読み取り)が
    // 最新の表示モードを参照するためのミラー。
    const mobileEffectBarModeRef = useRef(mobileEffectBarMode);
    mobileEffectBarModeRef.current = mobileEffectBarMode;
    // 実際に「今スクロール中か」を data-mobile-scrolling 属性とは別に持つ専用ref。
    // 'bar'モードはこの属性を常時'1'に固定するため、属性値だけで「新規スクロール開始」を
    // 判定するとFAB/Undo-Redoの非表示トリガーが二度と発火しなくなるバグになる
    // (2026-08-14実機FB=常時モードだとFAB/Undo-Redoがスクロールしても隠れない)。
    const mobileScrollSessionActiveRef = useRef(false);

    const scheduleMobileEffectBarHide = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (mobileEffectBarIdleTimerRef.current) clearTimeout(mobileEffectBarIdleTimerRef.current);
        // 「進む」アニメを勢いよくスクロール中に延ばした(最大 SLOWDOWN_MAX_MS)場合、
        // 待ち時間も同じだけ延ばす。そうしないと、育ちきる前に戻り始めてしまう
        // (2026-08-13実機FB=速いスクロールでアニメを伸ばしたのに待ち時間が短いままで、
        // 結局育ちきる前に戻ってしまっていた不具合の修正)。
        const idleMs = Math.max(MOBILE_EFFECT_BAR_SCROLL_IDLE_MS, mobileEffectBarSessionTransitionMsRef.current ?? 0);
        mobileEffectBarIdleTimerRef.current = setTimeout(() => {
            if (mobileEffectBarTouchDownRef.current) return; // 指がまだ触れていればクリアしない
            mobileScrollSessionActiveRef.current = false;
            // 'bar'モード(常時エフェクト棒)は指を離してもアイコンに戻さない。
            if (mobileEffectBarModeRef.current !== 'bar') {
                container.removeAttribute('data-mobile-scrolling');
                // 進み具合を0に戻す → CSSのtransitionで逆再生(エフェクト棒が縮み、アイコンが戻る)。
                container.style.setProperty('--mobile-effect-bar-progress', '0');
            }
            mobileEffectBarSessionDistanceRef.current = 0;
            mobileEffectBarLastScrollRef.current = null;
            mobileEffectBarSessionTransitionMsRef.current = null;
            // FAB(別コンポーネント)へスクロール終了を通知 → 再表示させる(エフェクト棒モードとは
            // 独立: 親指の邪魔にならないよう隠す機能は常にスクロール実態に追従させる)。
            window.dispatchEvent(new CustomEvent('mobile:timeline-scroll-state', { detail: { scrolling: false } }));
            undoRedoWrapRef.current?.removeAttribute('data-hidden');
        }, idleMs);
    }, [scrollContainerRef]);

    const syncMobileEffectBarVisibility = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        // data-mobile-scrolling 属性ではなく専用refで判定する('bar'モードは属性を常時'1'に
        // 固定しているため、属性だけ見ると常に「既にスクロール中」と誤判定してしまう)。
        const wasScrolling = mobileScrollSessionActiveRef.current;
        mobileScrollSessionActiveRef.current = true;
        container.setAttribute('data-mobile-scrolling', '1');
        if (!wasScrolling) {
            // FAB(別コンポーネント)へスクロール開始を通知 → 親指の邪魔にならないよう隠させる
            // (2026-08-13ユーザー要望)。連続スクロール中に毎フレーム発火しないよう、セッション
            // 開始時の1回だけに絞る。
            window.dispatchEvent(new CustomEvent('mobile:timeline-scroll-state', { detail: { scrolling: true } }));
            undoRedoWrapRef.current?.setAttribute('data-hidden', '1');
        }

        const scrollTop = container.scrollTop;
        const now = performance.now();
        const last = mobileEffectBarLastScrollRef.current;
        if (!wasScrolling || last === null) {
            // 新しい連続スクロールの開始(直前まで停止していた)場合だけ累計をリセットする。
            mobileEffectBarSessionDistanceRef.current = 0;
        } else {
            mobileEffectBarSessionDistanceRef.current += Math.abs(scrollTop - last.top);
            // セッション最初の実測(2回目以降のイベント)で「進む」アニメの長さを1回だけ決める。
            // 初速が速いほど長くする(2026-08-13ユーザー要望=勢いよくスクロールした瞬間ほど
            // アニメが一瞬で終わって見えなくなるため、わざとゆっくり見せる)。
            if (mobileEffectBarSessionTransitionMsRef.current === null) {
                const dt = now - last.time;
                if (dt > 0) {
                    const speed = Math.abs(scrollTop - last.top) / dt; // px/ms
                    const ratio = Math.min(1, Math.max(0,
                        (speed - MOBILE_EFFECT_BAR_FAST_SCROLL_MIN_PX_MS) /
                        (MOBILE_EFFECT_BAR_FAST_SCROLL_MAX_PX_MS - MOBILE_EFFECT_BAR_FAST_SCROLL_MIN_PX_MS),
                    ));
                    const transitionMs = MOBILE_EFFECT_BAR_TRACK_MS + ratio * (MOBILE_EFFECT_BAR_SLOWDOWN_MAX_MS - MOBILE_EFFECT_BAR_TRACK_MS);
                    mobileEffectBarSessionTransitionMsRef.current = transitionMs;
                    container.style.setProperty('--mobile-effect-bar-transition-ms', transitionMs.toFixed(0));
                }
            }
        }
        mobileEffectBarLastScrollRef.current = { top: scrollTop, time: now };

        // モード別の進み具合: 'icon'=常に0(変身しない) / 'scroll'=スクロール量に連動 /
        // 'bar'=常に1(常時エフェクト棒)。data-mobile-scrolling属性やFAB非表示通知は
        // モードに関わらずそのまま維持する(文字の濃さ強調・FAB隠しはこの演出とは独立した別機能)。
        const progress = mobileEffectBarMode === 'scroll'
            ? Math.min(1, mobileEffectBarSessionDistanceRef.current / MOBILE_EFFECT_BAR_MORPH_DISTANCE_PX)
            : mobileEffectBarMode === 'bar' ? 1 : 0;
        container.style.setProperty('--mobile-effect-bar-progress', progress.toFixed(3));

        scheduleMobileEffectBarHide();
    }, [scrollContainerRef, mobileEffectBarMode, scheduleMobileEffectBarHide]);

    const handleMobileEffectBarTouchStart = useCallback(() => {
        // ここでは data-mobile-scrolling を新規に立てない(スクロールを伴わない
        // ただのタップ・長押しでもエフェクト棒に切り替わってしまうバグになるため)。
        // 既にスクロール中で表示済みの場合だけ、指を置いている間は隠れないようにする。
        mobileEffectBarTouchDownRef.current = true;
        if (mobileEffectBarIdleTimerRef.current) clearTimeout(mobileEffectBarIdleTimerRef.current);
    }, []);

    const handleMobileEffectBarTouchEnd = useCallback(() => {
        mobileEffectBarTouchDownRef.current = false;
        scheduleMobileEffectBarHide();
    }, [scheduleMobileEffectBarHide]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !isMobileTimeline) return;
        container.addEventListener('scroll', syncMobileEffectBarVisibility, { passive: true });
        container.addEventListener('touchstart', handleMobileEffectBarTouchStart, { passive: true });
        container.addEventListener('touchend', handleMobileEffectBarTouchEnd, { passive: true });
        container.addEventListener('touchcancel', handleMobileEffectBarTouchEnd, { passive: true });
        return () => {
            container.removeEventListener('scroll', syncMobileEffectBarVisibility);
            container.removeEventListener('touchstart', handleMobileEffectBarTouchStart);
            container.removeEventListener('touchend', handleMobileEffectBarTouchEnd);
            container.removeEventListener('touchcancel', handleMobileEffectBarTouchEnd);
            if (mobileEffectBarIdleTimerRef.current) clearTimeout(mobileEffectBarIdleTimerRef.current);
        };
    }, [syncMobileEffectBarVisibility, handleMobileEffectBarTouchStart, handleMobileEffectBarTouchEnd, isMobileTimeline, scrollContainerRef]);

    // 'bar'(常時エフェクト棒)モードはスクロールなしで最初から表示、'icon'/'scroll'へ切替時は
    // 静止状態(アイコン)に戻す。実際のスクロール中はsyncMobileEffectBarVisibility側が
    // 都度上書きするため、ここはモード切替の瞬間(マウント含む)だけのケア。
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !isMobileTimeline) return;
        if (mobileEffectBarMode === 'bar') {
            container.setAttribute('data-mobile-scrolling', '1');
            container.style.setProperty('--mobile-effect-bar-progress', '1');
        } else if (!mobileEffectBarTouchDownRef.current && mobileEffectBarLastScrollRef.current === null) {
            // スクロール中(セッション進行中)でなければ静止状態へ。
            container.removeAttribute('data-mobile-scrolling');
            container.style.setProperty('--mobile-effect-bar-progress', '0');
        }
    }, [mobileEffectBarMode, isMobileTimeline, scrollContainerRef]);

    useEffect(() => {
        syncMobilePhaseLabel();
    }, [syncMobilePhaseLabel, timelineMitigations, timelineEvents]);

    return { mobilePhaseCurRef, mobilePhaseNextRef, undoRedoWrapRef, syncMobilePhaseLabel };
}
