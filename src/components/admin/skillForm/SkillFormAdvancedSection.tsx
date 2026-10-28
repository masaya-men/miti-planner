/**
 * スキル追加/編集モーダル — 詳細設定(折りたたみ)
 */
import type { Mitigation } from '../../../types';
import { inputClass, selectClass, labelClass, helpClass, sectionBtn, checkboxClass } from './skillFormClasses';

interface SkillFormAdvancedSectionProps {
    form: Mitigation;
    update: <K extends keyof Mitigation>(key: K, value: Mitigation[K]) => void;
    sameJobSkills: Mitigation[];
    showAdvanced: boolean;
    setShowAdvanced: (v: boolean) => void;
}

export function SkillFormAdvancedSection({ form, update, sameJobSkills, showAdvanced, setShowAdvanced }: SkillFormAdvancedSectionProps) {
    return (
        <>
            {/* ══════════════════════════════════════════
                 詳細設定（折りたたみ）
               ══════════════════════════════════════════ */}
            <button className={sectionBtn} onClick={() => setShowAdvanced(!showAdvanced)}>
                <span>詳細設定</span>
                <span className="text-app-text-muted">{showAdvanced ? '▲' : '▼'}</span>
            </button>

            {showAdvanced && (
                <div className="space-y-4 pl-2">

                    {/* チャージ */}
                    <div>
                        <label className={labelClass}>チャージ数</label>
                        <input type="number" className={inputClass} value={form.maxCharges ?? ''} min={0} max={10}
                            placeholder="通常は空欄（チャージなし）"
                            onChange={e => update('maxCharges', e.target.value ? Number(e.target.value) : undefined)} />
                        <p className={helpClass}>例: オブレーション=2, コンソレイション=2</p>
                    </div>

                    {/* ファミリー */}
                    <div>
                        <label className={labelClass}>ファミリー（オートプラン用）</label>
                        <input className={inputClass} value={form.family ?? ''} placeholder="例: tank_40, healer_bubble"
                            onChange={e => update('family', e.target.value || undefined)} />
                        <p className={helpClass}>ジョブ変更時に同等スキルを自動マッピングする識別子</p>
                    </div>

                    {/* 前提スキル */}
                    <div>
                        <label className={labelClass}>前提スキル</label>
                        <select className={selectClass} value={form.requires ?? ''}
                            onChange={e => update('requires', e.target.value || undefined)}>
                            <option value="">なし</option>
                            {sameJobSkills.map(m => (
                                <option key={m.id} value={m.id}>{m.name.ja}</option>
                            ))}
                        </select>
                        <p className={helpClass}>このスキルの前にアクティブでなければ使えない親スキル</p>
                    </div>

                    {/* 自分に使えない */}
                    <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                        <input type="checkbox" checked={!!form.targetCannotBeSelf} className={checkboxClass}
                            onChange={e => update('targetCannotBeSelf', e.target.checked || undefined)} />
                        自分自身には使えない（例: インターベンション）
                    </label>

                    {/* 妖精必要 */}
                    <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                        <input type="checkbox" checked={!!form.requiresFairy} className={checkboxClass}
                            onChange={e => update('requiresFairy', e.target.checked || undefined)} />
                        妖精が必要（学者限定）
                    </label>

                    {/* リソースコスト */}
                    <div>
                        <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                            <input type="checkbox" checked={!!form.resourceCost} className={checkboxClass}
                                onChange={e => {
                                    if (e.target.checked) update('resourceCost', { type: 'aetherflow', amount: 1 });
                                    else update('resourceCost', undefined);
                                }} />
                            リソースコスト（エーテルフロー/アダーガル）
                        </label>
                        {form.resourceCost && (
                            <div className="grid grid-cols-2 gap-3 mt-2 pl-4 border-l-2 border-app-text/10">
                                <div>
                                    <label className={labelClass}>タイプ</label>
                                    <select className={selectClass} value={form.resourceCost.type}
                                        onChange={e => update('resourceCost', { ...form.resourceCost!, type: e.target.value as 'aetherflow' | 'addersgall' })}>
                                        <option value="aetherflow">エーテルフロー</option>
                                        <option value="addersgall">アダーガル</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>消費量</label>
                                    <input type="number" className={inputClass} value={form.resourceCost.amount} min={1} max={3}
                                        onChange={e => update('resourceCost', { ...form.resourceCost!, amount: Number(e.target.value) })} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 非表示 */}
                    <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                        <input type="checkbox" checked={!!form.hidden} className={checkboxClass}
                            onChange={e => update('hidden', e.target.checked || undefined)} />
                        軽減選択モーダルで非表示にする
                    </label>

                    {/* スタック（Haima系） */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>スタック数</label>
                            <input type="number" className={inputClass} value={form.stacks ?? ''} min={0}
                                placeholder="空欄"
                                onChange={e => update('stacks', e.target.value ? Number(e.target.value) : undefined)} />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-app-lg cursor-pointer pb-1.5">
                                <input type="checkbox" checked={!!form.reapplyOnAbsorption} className={checkboxClass}
                                    onChange={e => update('reapplyOnAbsorption', e.target.checked || undefined)} />
                                吸収時再付与
                            </label>
                        </div>
                        <div>
                            <label className={labelClass}>終了時回復力/スタック</label>
                            <input type="number" className={inputClass} value={form.onExpiryHealingPotency ?? ''} min={0}
                                placeholder="空欄"
                                onChange={e => update('onExpiryHealingPotency', e.target.value ? Number(e.target.value) : undefined)} />
                        </div>
                    </div>

                </div>
            )}
        </>
    );
}
