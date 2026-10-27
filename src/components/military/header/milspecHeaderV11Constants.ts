/**
 * v11 ヘッダー(見本 js:863-927)。装甲・光の経路・H1〜H5 を、ヘッダー区画の内箱に絶対座標で置く。
 * 区画の実幅 MW は mwFor(実幅 ÷ 縮小率、1189 未満にしない)で求める(縮小率はサイドバー開状態の幅で固定)。
 * LanguageSwitcher が useTransitionOverlay を使うため、TransitionOverlayProvider をここで持つ(ModeLever は電源スイッチで、標準へは powerOff → setThemeStyle で戻る)。
 */
/** 下の板の奥の基板(drw:1〜6)を走る粒。AMB(常時の抽選)には入れず、ここで独自に打つ */
export const DRW_PULSE = { minMs: 900, maxMs: 2200, len: 9, speed: 3.4 };
