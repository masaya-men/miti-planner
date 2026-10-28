import React from 'react';
import { XCircle } from 'lucide-react';

// showToast に寄せない理由: 位置(bottom-8)・大きさ・表示時間(呼び出し側が制御)・押せない(pointer-events-none)が共通 Toast と違い、寄せると見た目が変わる
/** 「ここには置けない」等の下部トースト(通常表示・スプシ共通)。message が null なら何も描かない */
export const PlacementToast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[5000] float-surface px-5 py-2.5 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-none">
      <XCircle size={16} className="text-app-red shrink-0" />
      <span className="text-app-2xl font-bold">{message}</span>
    </div>
  );
};
