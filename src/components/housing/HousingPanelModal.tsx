import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LiquidGlassPanel } from './workspace/LiquidGlassPanel';

export interface HousingPanelModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional element rendered between the title and the close button. */
  headerActions?: React.ReactNode;
  /** Optional small metadata shown in the panel head (e.g. "12 / 50"). */
  headerMeta?: React.ReactNode;
  /** aria-label for the close button. */
  closeLabel: string;
  /** Max width of the panel (px). Default 720. */
  maxWidth?: number;
  /** Max height of the panel as viewport ratio (0-1). Default 0.86. */
  maxHeightRatio?: number;
  children: React.ReactNode;
}

/**
 * 中央浮遊型のガラスモーダル。 workspace 中央パネル (CenterArea を包む
 * LiquidGlassPanel) と同じ panel chrome (4 corner highlights + SVG
 * displacement filter + housing-panel-head) を使い、 ハウジング配下
 * モーダル全体のトンマナを統一する。
 */
export const HousingPanelModal: React.FC<HousingPanelModalProps> = ({
  open,
  onClose,
  title,
  headerActions,
  headerMeta,
  closeLabel,
  maxWidth = 720,
  maxHeightRatio = 0.86,
  children,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const content = (
    <div
      className="housing-panel-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdropClick}
    >
      <div
        className="housing-panel-modal-shell"
        style={{
          maxWidth: `${maxWidth}px`,
          maxHeight: `calc(${maxHeightRatio} * 100vh)`,
        }}
      >
        <LiquidGlassPanel edge={140} radius={18} scale={42}>
          <div className="housing-panel-head housing-panel-modal-head">
            <div className="housing-panel-title">{title}</div>
            {headerActions && (
              <div className="housing-panel-modal-actions">{headerActions}</div>
            )}
            {headerMeta && <div className="housing-panel-meta">{headerMeta}</div>}
            <button
              type="button"
              className="housing-panel-close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="housing-panel-modal-body">{children}</div>
        </LiquidGlassPanel>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
