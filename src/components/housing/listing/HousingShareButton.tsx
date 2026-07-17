/**
 * Phase 3: 物件詳細のシェアボタン
 *
 * - スマホ/対応ブラウザ: Web Share API (`navigator.share`) を直接呼ぶ
 * - 非対応環境: リンクコピー / X (Twitter intent) を含むドロップダウンを開く
 * - スタイルは housing.css の token 経由
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface HousingShareButtonProps {
  url: string;
  title: string;
  /**
   * FB第6弾#4#5: 投稿元 SNS ポストの URL (imageMode==='sns' のときのみ値あり)。
   * X へ流す URL はこれがあれば優先する (他人の投稿の手柄を取らない趣旨)。
   * リンクコピー / navigator.share は従来どおり LoPo ページ URL (`url`) を使う。
   */
  sourceUrl?: string | null;
}

export const HousingShareButton: React.FC<HousingShareButtonProps> = ({ url, title, sourceUrl }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // X (Twitter) へ渡す URL: 投稿元があればそちらを優先、なければ LoPo ページ URL。
  const xTargetUrl = sourceUrl ?? url;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const onTriggerClick = async () => {
    // Web Share API がある環境ではネイティブシートを優先
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const shareFn = nav && (nav as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }).share;
    if (typeof shareFn === 'function') {
      try {
        await shareFn.call(nav, { title, url });
        return;
      } catch {
        // ユーザーキャンセル等 — ドロップダウン表示にフォールバックしない (UX 上ノイズになる)
        return;
      }
    }
    setOpen((v) => !v);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable - silently no-op
    }
  };

  const tweet = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(xTargetUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div className="housing-share" ref={ref}>
      <button
        type="button"
        className="housing-action-btn"
        onClick={onTriggerClick}
        aria-label={t('housing.detail.share')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('housing.detail.share')}
      </button>
      {/* FB第6弾#4: 常時見えるXシェアボタン。ドロップダウンを開かず直接 intent へ飛ぶ。 */}
      <button
        type="button"
        className="housing-action-btn"
        onClick={tweet}
        aria-label={t('housing.detail.share_x')}
      >
        {t('housing.detail.share_x')}
      </button>
      {open && (
        <div role="menu" className="housing-share-menu">
          <button type="button" role="menuitem" onClick={copyLink}>
            {copied ? t('housing.detail.share_copied') : t('housing.detail.share_copy_link')}
          </button>
          <button type="button" role="menuitem" onClick={tweet}>
            {t('housing.detail.share_twitter')}
          </button>
        </div>
      )}
    </div>
  );
};
