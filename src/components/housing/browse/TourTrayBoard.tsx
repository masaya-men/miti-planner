import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, Route } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useTourTrayOrdering } from '../../../lib/housing/useTourTrayOrdering';
import { computeSnakeGridPositions, buildSnakePathD } from '../../../lib/housing/computeSnakeGridPositions';
import { isAtScrollBoundary, isSmoothScrollSupported, springStep } from '../../../lib/scroll/smoothScrollLogic';
import { TourTrayRow } from './TourTrayRow';

// 軽減表側の useSmoothWheelScroll (縦専用) と同じバネ定数。横方向へ転用するのでここに複製する。
const WHEEL_SPRING_STIFFNESS = 200;
const WHEEL_SPRING_DAMPING = 2 * Math.sqrt(WHEEL_SPRING_STIFFNESS);
const WHEEL_SPRING_MAX_DT = 0.05;

export interface TourTrayBoardProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// 2026-08-11: 縦に7件重ねて見せたいとのことで60pxに戻す(76pxへ広げる変更は撤回)。
const ROW_H = 60;
// 列幅: 行カードの固定幅要素 (グリップ/番号/サムネ/ピン/削除 + gap) を引くと 200px では
// タイトルの表示幅がほぼ 0 になっていたため、既存サイドバートレイ幅 (--housing-right-w: 300px)
// に揃える。300px はこの行カードがタイトル込みで収まることが判っている実績値。
const COL_W = 300;

/**
 * ツアー計画画面(PC)の右側: 番号カードを蛇行(上下交互)に並べたグリッド。
 * 列を上から下まで埋めたら隣の列は下から上へ、と接続線がつながったまま右へ続く。
 * 画面に入りきらない分は横スクロールで見る(50-100件規模を想定)。
 * ドラッグ/ピン/効率順のロジックは useTourTrayOrdering・TourTrayRow をそのまま再利用する。
 */
export const TourTrayBoard: React.FC<TourTrayBoardProps> = ({
  listingIds,
  onChange,
  selectedId,
  onSelect,
}) => {
  const { t, i18n } = useTranslation();
  const { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
    useTourTrayOrdering(listingIds, onChange);

  // 実機指摘(2026-08-11・2回目): 「仮の行数(DEFAULT_ROWS)でまず描画→実測値で描き直す」だと、
  // 線(transition:d)や光の玉(animateMotion)が誤った経路から正しい経路へ動くのが見えてしまう
  // (探すページ等から戻って再マウントするたびに再現)。そもそも未測定の間は SVG/カードを
  // 一切描画しない(null)ことで、実際に画面へ塗られる最初の内容が最初から正しい値になるようにする。
  const [rowsPerColumn, setRowsPerColumn] = useState<number | null>(null);

  // 実機指摘(2026-08-11・3回目): 「線」は直ったが、光の玉だけ初回に限って左上(=経路の起点である
  // 1番目のカード)で少し静止してから動き出すことがあった。動的に挿入された SVG の SMIL アニメーション
  // (animateMotion の暗黙 begin="0s") は、ブラウザによってはマウント直後に正しく開始しないことがある
  // 既知の癖で、.beginElement() を明示的に一度呼んで強制的に開始させるのが定石の対処法。
  // グリッドが初めて現れた(rowsPerColumn が null→数値になった)タイミングで1回だけ行う。
  const glow1Ref = useRef<SVGAnimateMotionElement>(null);
  const glow2Ref = useRef<SVGAnimateMotionElement>(null);
  const glowKickedRef = useRef(false);
  useEffect(() => {
    if (rowsPerColumn === null || glowKickedRef.current) return;
    // beginElement は SMIL API (テスト環境の happy-dom 等は未実装) なので存在確認してから呼ぶ。
    if (typeof glow1Ref.current?.beginElement === 'function') glow1Ref.current.beginElement();
    if (typeof glow2Ref.current?.beginElement === 'function') glow2Ref.current.beginElement();
    glowKickedRef.current = true;
  }, [rowsPerColumn]);

  // トレイが空 → 追加、で `.housing-tour-board-scroll` が初めて DOM に現れるケースがあるため、
  // useEffect([]) ではなく callback ref で「ノードが実際に付いた瞬間」に observe する。
  // ノードが差し替わる(空⇄件数あり往復)たびに前の observer/wheel リスナーは必ず片付ける。
  const cleanupRef = useRef<(() => void) | null>(null);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;

    // ref がアタッチされた瞬間 (コミット中・ブラウザが実際に描画する前) に同期的に採寸する。
    setRowsPerColumn(Math.max(1, Math.floor(el.getBoundingClientRect().height / ROW_H)));

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setRowsPerColumn(Math.max(1, Math.floor(height / ROW_H)));
    }) : null;
    observer?.observe(el);

    // 実機指摘(2026-08-11): トラックパッドの横スワイプ(deltaX)は元々効くが、普通のマウスホイール
    // (縦deltaYのみ)では横スクロールしなかったため、縦ホイールを横スクロールへ変換する。
    // React の onWheel は passive リスナーで preventDefault できないため、直接 addEventListener する。
    // 2026-08-12: PC + reduce-motion 無効の環境では、軽減表の useSmoothWheelScroll と同じバネ補間で
    // 減速させる(純粋関数 springStep/isAtScrollBoundary を横方向に転用)。非対応環境(タッチ/reduce-motion)
    // は従来どおり即時反映のまま。
    const smooth = isSmoothScrollSupported(window);
    const springState = { targetDy: 0, velY: 0 };
    let lastTime = 0;
    let rafId: number | null = null;

    const step = (now: number): void => {
      const dt = lastTime === 0 ? 1 / 60 : (now - lastTime) / 1000;
      lastTime = now;
      const result = springStep(springState, dt, WHEEL_SPRING_STIFFNESS, WHEEL_SPRING_DAMPING, WHEEL_SPRING_MAX_DT);
      springState.targetDy = result.state.targetDy;
      springState.velY = result.state.velY;
      if (result.atRest) {
        lastTime = 0;
        rafId = null;
        return;
      }
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + result.stepY));
      rafId = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || e.deltaX !== 0) return;
      if (!smooth) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
        return;
      }
      if (isAtScrollBoundary(el.scrollLeft, el.scrollWidth, el.clientWidth, e.deltaY) !== null) return;
      e.preventDefault();
      springState.targetDy += e.deltaY;
      if (rafId === null) rafId = requestAnimationFrame(step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    cleanupRef.current = () => {
      observer?.disconnect();
      el.removeEventListener('wheel', onWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  const cells = rowsPerColumn === null ? [] : computeSnakeGridPositions(orderedIds, rowsPerColumn);
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const colCount = cells.length === 0 ? 0 : Math.max(...cells.map((c) => c.col)) + 1;
  const pathD = rowsPerColumn === null ? '' : buildSnakePathD(cells, COL_W, ROW_H);
  // 実機要望(2026-08-11): 線の上を光が流れ、巡る順番をアニメーションで示す。
  // 停まる件数が多いほど道のりが長くなるため、体感速度が揃うよう件数に応じて周期を伸ばす。
  // 実機指摘(2回目): 速度を約1.8倍に。
  const glowDuration = Math.max(1.7, cells.length * 0.45);

  return (
    <div className="housing-tour-board">
      <div className="housing-tour-board-toolbar">
        <span className="housing-tour-board-hint">{t('housing.tray.board_hint')}</span>
        <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
          <ArrowDownUp size={14} aria-hidden="true" />
          {t('housing.tray.sort_efficient')}
        </button>
      </div>
      <div className="housing-tour-board-scroll" ref={scrollRef}>
        {/* rowsPerColumn が未測定(null)の間は何も描かない。ref アタッチ時に同期採寸→即座に
            正しい値で再コミットされるため、実際にブラウザへ塗られる最初の中身は最初から正しい
            (誤った経路→正しい経路、のように線や光の玉が動いて見えることがなくなる)。 */}
        {rowsPerColumn !== null && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div
                className="housing-tour-board-grid"
                style={{
                  gridTemplateRows: `repeat(${rowsPerColumn}, ${ROW_H}px)`,
                  width: colCount * COL_W,
                  '--housing-snake-row-h': `${ROW_H}px`,
                  '--housing-snake-col-w': `${COL_W}px`,
                } as React.CSSProperties}
              >
                <svg
                  className="housing-tour-board-path"
                  width={colCount * COL_W}
                  height={rowsPerColumn * ROW_H}
                  aria-hidden="true"
                >
                  <path d={pathD} />
                  <circle r="5" className="housing-tour-board-path-glow">
                    <animateMotion ref={glow1Ref} dur={`${glowDuration}s`} repeatCount="indefinite" path={pathD} />
                  </circle>
                  {/* 実機指摘(2026-08-11): ロング(横スクロール範囲の広い)ツアーだと1つ目の玉が
                      画面外にいる時間が長いため、半周ずらした2つ目を追加していつ見ても
                      どちらかが視界に入りやすくする。 */}
                  <circle r="5" className="housing-tour-board-path-glow">
                    <animateMotion
                      ref={glow2Ref}
                      dur={`${glowDuration}s`}
                      begin={`${glowDuration / 2}s`}
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                </svg>
                {items.map((l) => {
                  const cell = cellById.get(l.id);
                  if (!cell) return null;
                  return (
                    <div
                      key={l.id}
                      className="housing-tour-board-cell"
                      data-selected={l.id === selectedId}
                      style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        // グリップ/ピン/削除ボタンからのクリックは選択に波及させない
                        // (TourTrayRow 自体は Task2 の共用コンポーネントなので変更しない)。
                        if ((e.target as HTMLElement).closest('button')) return;
                        onSelect(l.id);
                      }}
                      onKeyDown={(e) => {
                        // キーボードでも選択できるようにする (ドラッグは KeyboardSensor 側で既に対応済み)。
                        // 内側ボタン由来のキー操作は onClick と同じガードで無視する。
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(l.id);
                        }
                      }}
                    >
                      <TourTrayRow
                        listing={l}
                        language={i18n.language}
                        isPinned={pinnedIds.includes(l.id)}
                        onRemove={remove}
                        onTogglePin={togglePin}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};
