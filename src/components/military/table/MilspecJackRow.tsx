import React from 'react';
import clsx from 'clsx';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { getColumnCssVar } from '../../../utils/calculator';
import { Tooltip } from '../../ui/Tooltip';
import { sheetMemberStyle } from '../../timeline/sheet/sheetStyle';
import { SheetHiddenChip } from '../../timeline/sheet/SheetHiddenChip';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { burst } from '../fx/engine';
import { circ, P } from '../armor/geom';
import { playJackSlide } from './slideMotion';
import type { JobPickerRowProps } from '../../jobPickerRowTypes';
import './MilspecJackRow.css';

// 軍事テーマのジョブ欄(見本 v11 js:451-466 の差込口 + css:379-392)。
// 外側の div(ref・data 属性・幅)とクリック/右クリックは標準の JobPickerRow と同じ。
// 中身だけを D-sub の差込口にする。

const NUT_L = P(circ(3.7, 12, 2.7, 6));
const NUT_R = P(circ(30.3, 12, 2.7, 6));

/** 差込口の脇の扇の配線へ光を流す。j = 表の列の並びでの番号 */
const flash = (j: number, stagger: number) => {
  burst(`bp:f${j}r`, { n: 6, stagger, len: 6 });
  burst(`bp:f${j}l`, { n: 6, stagger, len: 6, rev: true });
};

export const MilspecJackRow: React.FC<JobPickerRowProps> = ({
  partyMembers, partySortOrder, getJobIcon, getMemberRefCallback, handleJobIconClick, t, sheetCols, sheetHidden, onOpenSheetHidden,
}) => {
  const reduced = useReducedMotion();
  const cells = React.useRef<Map<string, HTMLDivElement>>(new Map());
  // 外側 div の ref は id ごとに安定させる(毎回新しい関数だと detach→attach で再描画ループになる)
  const refCache = React.useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const refFor = (id: string) => {
    let f = refCache.current.get(id);
    if (!f) {
      f = (el) => { if (el) cells.current.set(id, el); else cells.current.delete(id); getMemberRefCallback(id)(el); };
      refCache.current.set(id, f);
    }
    return f;
  };
  const prevCenters = React.useRef<Map<string, number>>(new Map());
  const prevSort = React.useRef(partySortOrder);
  const orderKey = partyMembers.map((m) => m.id).join(',');

  const measure = React.useCallback((): Map<string, number> => {
    const m = new Map<string, number>();
    cells.current.forEach((el, id) => m.set(id, el.offsetLeft + el.offsetWidth / 2));
    return m;
  }, []);

  // 並び替え(partySortOrder の変化)のときだけ、前の列中心から滑って差さる
  React.useLayoutEffect(() => {
    const now = measure();
    const sortChanged = prevSort.current !== partySortOrder;
    const before = prevCenters.current;
    prevSort.current = partySortOrder;
    prevCenters.current = now;
    if (!sortChanged || reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    orderKey.split(',').forEach((id, j) => {
      const ox = before.get(id), nx = now.get(id), sk = cells.current.get(id)?.querySelector('.milspec-jack-sk');
      if (ox == null || nx == null || !sk || Math.abs(ox - nx) < 1) return;
      const dl = 30 + Math.random() * 90;
      playJackSlide(sk, ox - nx, dl);
      timers.push(setTimeout(() => flash(j, 10), dl + 760));
    });
    return () => timers.forEach(clearTimeout);
  }, [partySortOrder, orderKey, reduced, measure]);

  // 列の実寸が変わったら(画面幅・文字サイズ・ジョブ変更など)、次の並び替えの「前の位置」も更新しておく
  React.useEffect(() => {
    const on = () => { prevCenters.current = measure(); };
    window.addEventListener('resize', on);
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', on);
    const ro = new ResizeObserver(on);
    cells.current.forEach((el) => ro.observe(el));
    return () => { window.removeEventListener('resize', on); ro.disconnect(); };
  }, [measure, orderKey]);

  return (
    <>
      {partyMembers.map((member, index) => {
        const icon = member.jobId ? getJobIcon(member.jobId) : null;
        return (
          <div
            key={member.id}
            ref={refFor(member.id)}
            data-member-id={member.id}
            data-member-role={member.role}
            data-sheet-cols={sheetCols ? (sheetCols.get(member.id) ?? 0) : undefined}
            style={sheetCols ? sheetMemberStyle(sheetCols.get(member.id) ?? 0) : {
              width: getColumnCssVar(member.role),
              minWidth: getColumnCssVar(member.role),
              maxWidth: getColumnCssVar(member.role),
              paddingLeft: 'var(--col-member-pad-x)',
              paddingRight: 'var(--col-member-pad-x)',
            }}
            className="hidden md:flex flex-none h-full relative milspec-jack-cell"
          >
            <Tooltip content={member.jobId ? `${member.id} — ${t('ui.change_job_tooltip')}` : `${member.id} (${t('ui.change_job')})`} position="bottom" wrapperClassName="w-full h-full">
              <div
                role="button"
                aria-label={member.jobId ? `${member.id} ${member.jobId}` : `${member.id} (${t('ui.change_job')})`}
                data-job={member.jobId ?? ''}
                className={clsx('milspec-jack', !member.jobId && 'milspec-jack-empty')}
                onClick={(e) => handleJobIconClick(member.id, e)}
                onPointerEnter={() => { if (!reduced) flash(index, 16); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!member.jobId) return;
                  useMitigationStore.getState().setMemberJob(member.id, null);
                }}
              >
                <span className="milspec-jack-sk">
                  <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true">
                    <rect className="fl" x="0.5" y="6" width="33" height="12" rx="1.2" />
                    <polygon className="nut" points={NUT_L} /><circle className="hole" cx="3.7" cy="12" r="1" />
                    <polygon className="nut" points={NUT_R} /><circle className="hole" cx="30.3" cy="12" r="1" />
                    <polygon className="shell" points="7,0.5 27,0.5 25.6,23.5 8.4,23.5" />
                    <polygon className="mouth" points="8.6,2.2 25.4,2.2 24.2,21.8 9.8,21.8" />
                    <polygon className="rimh" points="7,0.5 27,0.5 25.6,23.5 8.4,23.5" />
                  </svg>
                  {icon && <img referrerPolicy="no-referrer" src={icon} alt={member.jobId ?? ''} />}
                </span>
              </div>
            </Tooltip>
            {sheetCols && onOpenSheetHidden && (sheetHidden?.get(member.id)?.length ?? 0) > 0 && (
              <SheetHiddenChip
                count={sheetHidden!.get(member.id)!.length}
                narrow={(sheetCols.get(member.id) ?? 0) <= 1}
                onOpen={(e) => onOpenSheetHidden(member.id, e)}
              />
            )}
          </div>
        );
      })}
    </>
  );
};
MilspecJackRow.displayName = 'MilspecJackRow';
