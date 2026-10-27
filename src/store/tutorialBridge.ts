/**
 * 軽減ストア → チュートリアルストアへの連絡口。
 *
 * useTutorialStore は退避・復元のため useMitigationStore を読む。逆向き(軽減の操作で
 * チュートリアルの手順を進める)を直接 import すると循環になるので、この連絡口を挟む。
 * useTutorialStore が読み込まれた時点で自分を登録する。未登録の間は「チュートリアル中でない」と
 * 同じ扱い(isActive は保存されず startTutorial でしか true にならないため、結果は直接呼ぶのと同じ)。
 */

interface TutorialBridge {
  completeEvent: (eventName: string) => void;
  isActive: () => boolean;
}

let bridge: TutorialBridge | null = null;

export function registerTutorialBridge(b: TutorialBridge): void {
  bridge = b;
}

export function completeTutorialEvent(eventName: string): void {
  bridge?.completeEvent(eventName);
}

export function isTutorialActive(): boolean {
  return bridge?.isActive() ?? false;
}
