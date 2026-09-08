import React from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecHarness } from './svg/MilspecHarness';
// 副作用 import: i18next の初期化(MilspecSidebar.tsx/MilspecToolbar.tsx と同じ理由 —
// useTranslation() は initReactI18next 済みインスタンスが無いとキー文字列をそのまま返す)。
import '../../i18n';

/**
 * カーソル座標計器。pointermove を window に登録し、rAF スロットル + 前回値と同じなら
 * setState をスキップする。静止中(pointermove が来ない間)は rAF すら積まれない
 * ため完全に更新が止まる(マウス追従 UI 禁止ルールへの対応・brief 指定の実装方式そのまま)。
 */
function useCursorCoords() {
  const [coords, setCoords] = React.useState({ x: 0, y: 0 });
  const latestRef = React.useRef({ x: 0, y: 0 });
  const appliedRef = React.useRef({ x: 0, y: 0 });
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      latestRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current !== null) return; // 既に次フレームぶん予約済み
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const next = latestRef.current;
        if (next.x !== appliedRef.current.x || next.y !== appliedRef.current.y) {
          appliedRef.current = next;
          setCoords(next);
        }
      });
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return coords;
}

/**
 * カーソル座標の読み取り表示のみを担う小さな子コンポーネント。
 * whole-branch レビュー Important#3: useCursorCoords はマウス移動中 最大60fps で setState する。
 * これを MilspecFooter 本体に置いたままだと、約35ノードの MilspecHarness SVG や
 * フッター全体が毎フレーム再レンダリングされ、Timeline のドラッグ操作と競合してフレーム予算を
 * 圧迫する。座標を読む状態をこの独立コンポーネントに閉じ込め、再レンダリング範囲をここだけに限定する。
 */
const MilspecCursorReadout: React.FC = () => {
  const coords = useCursorCoords();
  return (
    <div className="milspec-rollbank">
      <div className="milspec-rc">
        <span className="milspec-rc-k">X</span>
        <span className="milspec-rc-digits">{Math.round(coords.x).toString().padStart(4, '0')}</span>
      </div>
      <div className="milspec-rc">
        <span className="milspec-rc-k">Y</span>
        <span className="milspec-rc-digits">{Math.round(coords.y).toString().padStart(4, '0')}</span>
      </div>
    </div>
  );
};

/**
 * フッター — 情報プレート(fp-info) / PCB ハーネス / 計器プレート(fp-inst)。
 * 正典: docs/.private/theme-refs/milspec-mockup.html DOM 2216-2284+(<footer class="footer chan">) /
 *       CSS .footer 1417- 。
 * 標準の出典: AppFooter.tsx(著作権/免責/法的ドロップダウン/Discord/X を無変更で再利用。
 * PulseSettings は whole-branch レビュー Important#2 で撤去 — 対象の GridOverlay が
 * MilspecLayout にマウントされておらず、全操作が無効化された「トリガーだけの空パネル」だったため)。
 *
 * レイアウト上の判断: mockup は grid-template-columns: 2.05fr 1fr(gap 9px)+ ハーネス SVG を
 * 絶対座標(left:876px 等)でプレート間の隙間に重ねる固定 px 技法。SP1 は clamp() ベースの
 * 流動幅グリッドのため、ハーネス専用の固定 92px 中央列を追加した 3 列グリッド
 * (2.05fr / 92px / 1fr)に変更し、境界の隙間そのものにハーネスを常に正しく収める
 * (Task 1 が可変幅列に clamp() を採用したのと同じ考え方の延長)。
 *
 * 法的ドロップダウン: fp-info プレートは共通プリミティブ .milspec-hp の clip-path(--ms-sh)を
 * 使うため、その内側に絶対配置のパネルを置くと clip-path に切り取られて隠れる
 * (clip-path はサブツリー全体の描画を切り取る — overflow:hidden と同様の効果)。
 * パネル本体は clip-path を持たない outer(.milspec-ftr)の直接の子として置き、
 * トリガーボタンの getBoundingClientRect から算出した座標を outer 基準の position:absolute で
 * 反映する(PulseSettings.tsx の「ボタン位置を基準に fixed パネルを算出」と同じ考え方だが、
 * こちらは vitest の `container.querySelector` で見える必要があるため createPortal は使わない)。
 */
export const MilspecFooter: React.FC = () => {
  const { t } = useTranslation();
  const ftrRef = React.useRef<HTMLDivElement>(null);
  const legalBtnRef = React.useRef<HTMLButtonElement>(null);
  const [legalOpen, setLegalOpen] = React.useState(false);
  const [legalPos, setLegalPos] = React.useState({ left: 0, bottom: 0 });

  const toggleLegal = () => {
    if (!legalOpen && ftrRef.current && legalBtnRef.current) {
      const ftrRect = ftrRef.current.getBoundingClientRect();
      const btnRect = legalBtnRef.current.getBoundingClientRect();
      setLegalPos({
        left: btnRect.left - ftrRect.left,
        bottom: ftrRect.bottom - btnRect.top + 6,
      });
    }
    setLegalOpen((v) => !v);
  };

  return (
    <div ref={ftrRef} className="milspec-ftr milspec-chan">
      {/* 左: 情報プレート — mockup .fp.fp-info(DOM 2218-2228) */}
      <div className="milspec-hp milspec-fp milspec-fp-info" style={{ '--ms-sh': 'var(--ms-sh-slab)' } as React.CSSProperties}>
        <span className="milspec-bolt tl" />
        <span className="milspec-sc tr">NFO-01 · PLATE PROFILE</span>
        <span className="milspec-grime-mark" />
        <div className="milspec-fp-title">
          <b className="milspec-disp">MIL-SPEC</b>
          <span>Defensive Cooldown Scheduling System — Mitigation Fire-Plan Computer</span>
        </div>
        <div className="milspec-fp-rule" />
        <div className="milspec-finfo">
          <div>
            <span className="c">{t('footer.copyright')}</span>
            <span className="sep">/</span>
            {t('footer.disclaimer')}
          </div>
          <div>
            <button ref={legalBtnRef} type="button" onClick={toggleLegal}>
              {t('footer.legal')}
            </button>
            <span className="sep">·</span>
            <a href="https://discord.gg/z7uypbJSnN" target="_blank" rel="noopener noreferrer">
              {t('footer.discord')}
            </a>
            <span className="sep">·</span>
            <a href="https://x.com/lopoly_app" target="_blank" rel="noopener noreferrer">
              {t('footer.x_official')}
            </a>
          </div>
        </div>
      </div>

      {/* 中央: PCB 配線ハーネス — mockup .fp-harness SVG(DOM 2234-2274) */}
      <div className="milspec-fp-harness">
        <MilspecHarness />
      </div>

      {/* 右: 計器プレート — mockup .fp.fp-inst(DOM 2278-2303 相当)。タービン/ファン・
          トラッキングレティクル等の純装飾サブパーツは spec §5.7 が要求する要素
          (Telemetry 計器 + カーソル座標)の範囲外として今回は対象外(自己申告・punch-list 候補)。 */}
      <div className="milspec-hp milspec-fp milspec-fp-inst" style={{ '--ms-sh': 'var(--ms-sh-tl-tr)' } as React.CSSProperties}>
        <span className="milspec-bolt bl" />
        <span className="milspec-bolt br" />
        <span className="milspec-ilbl">Telemetry</span>
        <span className="milspec-ticks" />
        <span className="milspec-sc tr">TLM-04 · REV.C</span>
        <span className="milspec-hazard" style={{ position: 'absolute', left: 0, bottom: 0, width: 16, height: 5, opacity: 0.4 }} />
        <div className="milspec-fp-inst-body">
          <MilspecCursorReadout />
        </div>
      </div>

      {/* 法的ドロップダウン本体 — fp-info の clip-path から独立させるため .milspec-ftr 直下に置く(上記コメント参照) */}
      {legalOpen && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setLegalOpen(false)} />
          <div className="milspec-fp-legal" style={{ left: legalPos.left, bottom: legalPos.bottom }}>
            <a href="/privacy" onClick={() => setLegalOpen(false)}>{t('footer.privacy_policy')}</a>
            <a href="/terms" onClick={() => setLegalOpen(false)}>{t('footer.terms')}</a>
            <a href="/commercial" onClick={() => setLegalOpen(false)}>{t('footer.commercial')}</a>
          </div>
        </>
      )}
    </div>
  );
};
