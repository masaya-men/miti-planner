import './MilspecDim.css';

// 区画の暗幕(見本 .zone .dim)。電源 off で 0.55 に暗くなり、電源投入で power.ts の animate(BOOT_TIMING)が順に退かせる。見た目は power/MilspecDim.css
export const MilspecDim = () => <span className="milspec-dim" aria-hidden="true" />;
