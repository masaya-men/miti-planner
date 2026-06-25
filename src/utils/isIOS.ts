/** iOS(iPad/iPhone/iPod)判定。UA ベース(SSR/非ブラウザは false)。 */
export function isIOS(): boolean {
    return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}
