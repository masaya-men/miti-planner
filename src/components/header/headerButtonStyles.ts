// ホバー: 反転（ライト→ソフトダーク / ダーク→ソフトライト）
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";

// アイコン丸ボタン共通スタイル（1px border で統一）
export const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
export const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

// テキスト付きピルボタン共通スタイル（1px border で統一）
export const pillBtnBase = "group flex items-center gap-2 px-3.5 h-9 rounded-full border whitespace-nowrap transition-all duration-300 cursor-pointer active:scale-95";
export const pillBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;
export const pillBtnActive = `bg-app-toggle text-app-toggle-text border-app-toggle ${hoverInvert}`;
