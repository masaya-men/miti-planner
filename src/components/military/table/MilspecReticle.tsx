import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { useMitigationStore } from '../../../store/useMitigationStore';

// 表の照準(見本 v11 js:1027-1053 / css:518-539)。
// 表のどこでも、指した所(効果アイコン・攻撃の段・時刻セル・見出しボタン)に四隅の枠が吸い付き、横に小さく情報を出す。
// 重さの方針: pointerover は器に 1 個だけ(委譲)・位置の測定と書き込みは rAF にまとめる・
// React の state は触らない(classList / style / textContent を直接書く)ので、表全体は再描画されない。
// 座標は器(sheetContainer)基準 = 表をスクロールしても対象と一緒に動く。見出しは動かない側なので別の枠を見出しの中に置く。

/** 見出しの押せる 4 列の刻印(見本 button.th small・CSS の ::before と同じ固定の英字) */
const HEAD_STAMPS = ['PHS', 'LBL', 'T+', 'HOSTILE ACT'];
const MI_PAD = 4;
const CELL_PAD = 1.5;
/** タグの横幅の見積もり(見本 js:1046 の 110)。右端に収まらないときは左へ折り返す */
const TAG_ROOM = 110;

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

interface Hit {
  /** 同じ対象かどうかの判定用(効果アイコンは棒を指しても同じ) */
  key: Element;
  /** 枠を合わせる要素 */
  box: Element;
  pad: number;
  text: () => string;
}

/** 表の中身(スクロールする側)の対象を引く */
function resolveSheet(t: Element): Hit | null {
  const mi = t.closest('[data-mit-icon], [data-mit-bar]');
  if (mi) {
    const icon = mi.hasAttribute('data-mit-icon') ? mi : mi.parentElement?.querySelector('[data-mit-icon]') ?? null;
    if (!icon) return null;
    return {
      key: icon, box: icon, pad: MI_PAD,
      text: () => {
        const owner = icon.getAttribute('data-mit-owner') ?? '';
        const member = useMitigationStore.getState().partyMembers.find((m) => m.id === owner);
        const job = member?.jobId ? member.jobId.toUpperCase() : owner;
        return `T+${mmss(Number(icon.getAttribute('data-mit-t')))} · ${job} · ${icon.getAttribute('data-mit-dur')}s`;
      },
    };
  }
  const slot = t.closest('[data-event-slot]');
  if (slot) {
    return {
      key: slot, box: slot, pad: CELL_PAD,
      text: () => {
        const row = slot.closest('[data-time-row]');
        const slots = row ? Array.from(row.querySelectorAll('[data-event-slot]')) : [slot];
        return `T+${mmss(Number(row?.getAttribute('data-time-row')))} · ATK ${slots.indexOf(slot) + 1}/${slots.length}`;
      },
    };
  }
  // 時刻セル = 行の 3 つ目の子(行の直下の子まで遡って判定)
  const row = t.closest('[data-time-row]');
  let tm: Element | null = t;
  while (tm && tm.parentElement !== row) tm = tm.parentElement;
  if (row && tm && row.children[2] !== tm) tm = null;
  if (row && tm) {
    const cell = tm;
    return {
      key: cell, box: cell, pad: CELL_PAD,
      text: () => {
        return `T+${mmss(Number(row.getAttribute('data-time-row')))} · ${row.querySelectorAll('[data-event-slot]').length} EVT`;
      },
    };
  }
  return null;
}

/** 見出しの押せる列を引く */
function resolveHead(t: Element): Hit | null {
  const th = t.closest('#timeline-header-inner > :nth-child(-n+4)');
  if (!th) return null;
  return {
    key: th, box: th, pad: CELL_PAD,
    text: () => 'SORT · ' + (HEAD_STAMPS[Array.from(th.parentElement?.children ?? []).indexOf(th)] ?? ''),
  };
}

/** 器に照準を取り付ける。戻り値は取り外し */
function attachReticle(
  root: HTMLElement, ret: HTMLElement, resolve: (t: Element) => Hit | null, reduced: boolean,
): () => void {
  const tag = ret.querySelector('.milspec-ret-tag') as HTMLElement;
  let cur: Element | null = null;
  let want: Hit | null = null;
  let raf = 0;

  const hide = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    want = null; cur = null;
    ret.classList.remove('on');
  };

  const flush = () => {
    raf = 0;
    const hit = want;
    if (!hit || !hit.box.isConnected) { hide(); return; }
    const rr = root.getBoundingClientRect();
    const r = hit.box.getBoundingClientRect();
    const x = r.left - rr.left - hit.pad, y = r.top - rr.top - hit.pad;
    const w = r.width + hit.pad * 2, h = r.height + hit.pad * 2;
    // 右端(表の見えている範囲)に収まらないときはタグを左へ
    const scroller = root.closest('.timeline-scroll-container') as HTMLElement | null;
    const clipRight = scroller ? scroller.getBoundingClientRect().left + scroller.clientWidth : rr.right;
    const first = !ret.classList.contains('on');
    // 出始めは吸い付く動きなしで直接置く(遠くから滑ってこない)。動きを減らす設定のときは常に動きなし
    if (first || reduced) ret.style.transition = 'none';
    ret.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    ret.style.width = w + 'px';
    ret.style.height = h + 'px';
    ret.classList.toggle('flip', r.left + r.width + hit.pad + TAG_ROOM > clipRight);
    tag.textContent = hit.text();
    if (first && !reduced) { void ret.offsetWidth; ret.style.transition = ''; }
    ret.classList.add('on');
    ret.classList.remove('lock');
    if (!reduced) { void ret.offsetWidth; ret.classList.add('lock'); }
  };

  const onOver = (e: Event) => {
    const t = e.target as Element | null;
    // ボタンを押している間(アイコンのドラッグ中など)は出さない
    const hit = t && !(e as PointerEvent).buttons ? resolve(t) : null;
    if (!hit) { if (cur) hide(); return; }
    if (hit.key === cur) return;
    cur = hit.key; want = hit;
    if (!raf) raf = requestAnimationFrame(flush);
  };

  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerleave', hide);
  return () => {
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerleave', hide);
    if (raf) cancelAnimationFrame(raf);
  };
}

const RetBody = () => (
  <>
    <i /><i /><i /><i /><u /><u /><u /><u />
    <span className="milspec-ret-tag" />
  </>
);

export interface MilspecReticleProps {
  /** 表の中身(sheetContainer)。照準はこの中に置き、この器に pointerover を 1 個付ける */
  rootRef: React.RefObject<HTMLElement | null>;
}

function MilspecReticleImpl({ rootRef }: MilspecReticleProps) {
  const reduced = useReducedMotion();
  const sheetRet = useRef<HTMLDivElement>(null);
  const headRet = useRef<HTMLDivElement>(null);
  const [head, setHead] = useState<HTMLElement | null>(null);

  // 見出し(動かない側)の器を探す
  useEffect(() => {
    const root = rootRef.current;
    setHead((root?.closest('[data-timeline-root]')?.querySelector('#timeline-header-inner') as HTMLElement | null) ?? null);
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    return root && sheetRet.current ? attachReticle(root, sheetRet.current, resolveSheet, reduced) : undefined;
  }, [rootRef, reduced]);

  useEffect(() => {
    return head && headRet.current ? attachReticle(head, headRet.current, resolveHead, reduced) : undefined;
  }, [head, reduced]);

  return (
    <>
      <div ref={sheetRet} className="milspec-ret" data-reduced={reduced || undefined} aria-hidden="true"><RetBody /></div>
      {head && createPortal(
        <div ref={headRet} className="milspec-ret" data-reduced={reduced || undefined} aria-hidden="true"><RetBody /></div>,
        head,
      )}
    </>
  );
}

export const MilspecReticle = React.memo(MilspecReticleImpl);
