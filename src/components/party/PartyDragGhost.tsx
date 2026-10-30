import React from 'react';
import { SCALE } from '../../tokens/motionTokens';
import type { Job } from '../../types';

interface PartyDragGhostProps {
    drag: { isDragging: boolean; item: Job | null; position: { x: number; y: number } };
}

/** ドラッグゴースト */
export const PartyDragGhost: React.FC<PartyDragGhostProps> = ({ drag }) => (
    <>
            {drag.isDragging && drag.item && (
                <div
                    className="fixed pointer-events-none z-[10001]"
                    style={{
                        left: drag.position.x - 20,
                        top: drag.position.y - 20,
                        transform: `scale(${SCALE.drag})`,
                    }}
                >
                    <div className="w-10 h-10 rounded-xl bg-app-surface2 border border-app-text/30 flex items-center justify-center shadow-lg shadow-black/40">
                        <img referrerPolicy="no-referrer" src={drag.item.icon} className="w-8 h-8 object-contain" />
                    </div>
                </div>
            )}
    </>
);
