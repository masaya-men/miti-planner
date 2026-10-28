/**
 * スキル追加/編集モーダル — よく使うオプション(折りたたみ)
 */
import type { Mitigation } from '../../../types';
import { inputClass, selectClass, labelClass, helpClass, sectionBtn, checkboxClass } from './skillFormClasses';

interface SkillFormCommonSectionProps {
    form: Mitigation;
    update: <K extends keyof Mitigation>(key: K, value: Mitigation[K]) => void;
    showCommon: boolean;
    setShowCommon: (v: boolean) => void;
}

export function SkillFormCommonSection({ form, update, showCommon, setShowCommon }: SkillFormCommonSectionProps) {
    return (
        <>
            {/* ══════════════════════════════════════════
                 よく使うオプション（折りたたみ）
               ══════════════════════════════════════════ */}
            <button className={sectionBtn} onClick={() => setShowCommon(!showCommon)}>
                <span>よく使うオプション</span>
                <span className="text-app-text-muted">{showCommon ? '▲' : '▼'}</span>
            </button>

            {showCommon && (
                <div className="space-y-4 pl-2">

                    {/* バースト（初動の追加軽減） */}
                    <div>
                        <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                            <input type="checkbox" checked={!!form.burstValue} className={checkboxClass}
                                onChange={e => {
                                    if (e.target.checked) { update('burstValue', 10); update('burstDuration', 4); }
                                    else { update('burstValue', undefined); update('burstDuration', undefined); }
                                }} />
                            初動バースト（最初だけ追加軽減）
                        </label>
                        <p className={helpClass}>例: ハート・オブ・コランダム — 最初4秒だけ追加15%</p>
                        {form.burstValue !== undefined && (
                            <div className="grid grid-cols-2 gap-3 mt-2 pl-4 border-l-2 border-app-text/10">
                                <div>
                                    <label className={labelClass}>追加軽減率 (%)</label>
                                    <input type="number" className={inputClass} value={form.burstValue ?? 0} min={0} max={100}
                                        onChange={e => update('burstValue', Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className={labelClass}>バースト時間 (秒)</label>
                                    <input type="number" className={inputClass} value={form.burstDuration ?? 4} min={0} step={0.1}
                                        onChange={e => update('burstDuration', Number(e.target.value))} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* シールド */}
                    <div>
                        <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                            <input type="checkbox" checked={!!form.isShield} className={checkboxClass}
                                onChange={e => {
                                    update('isShield', e.target.checked || undefined);
                                    if (!e.target.checked) { update('valueType', undefined); update('shieldPotency', undefined); }
                                }} />
                            バリア（シールド）スキル
                        </label>
                        <p className={helpClass}>ダメージを吸収するバリアを生成する</p>
                        {form.isShield && (
                            <div className="mt-2 pl-4 border-l-2 border-app-text/10 space-y-2">
                                <div>
                                    <label className={labelClass}>バリアの計算方式</label>
                                    <select className={selectClass} value={form.valueType ?? 'hp'}
                                        onChange={e => update('valueType', e.target.value as 'hp' | 'potency')}>
                                        <option value="hp">HP割合（例: 最大HPの10%）</option>
                                        <option value="potency">回復力ベース（ヒーラーのステ依存）</option>
                                    </select>
                                </div>
                                {form.valueType === 'potency' && (
                                    <div>
                                        <label className={labelClass}>回復力</label>
                                        <input type="number" className={inputClass} value={form.shieldPotency ?? 0} min={0}
                                            onChange={e => update('shieldPotency', Number(e.target.value))} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 無敵 */}
                    <div>
                        <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                            <input type="checkbox" checked={!!form.isInvincible} className={checkboxClass}
                                onChange={e => update('isInvincible', e.target.checked || undefined)} />
                            無敵スキル（ダメージ0）
                        </label>
                        <p className={helpClass}>例: ホルムギャング、リビングデッド、インビンシブル、ボーライド</p>
                    </div>

                    {/* レベル制限 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>習得レベル</label>
                            <input type="number" className={inputClass} value={form.minLevel ?? ''} min={1} max={100}
                                onChange={e => update('minLevel', e.target.value ? Number(e.target.value) : undefined)} />
                            <p className={helpClass}>このレベル未満のコンテンツでは使えない</p>
                        </div>
                        <div>
                            <label className={labelClass}>上限レベル</label>
                            <input type="number" className={inputClass} value={form.maxLevel ?? ''} min={1} max={100}
                                onChange={e => update('maxLevel', e.target.value ? Number(e.target.value) : undefined)} />
                            <p className={helpClass}>上位スキルに置換されるレベル</p>
                        </div>
                    </div>

                    {/* ヒーリング増加 */}
                    <div>
                        <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                            <input type="checkbox" checked={form.healingIncrease !== undefined && form.healingIncrease > 0} className={checkboxClass}
                                onChange={e => {
                                    if (e.target.checked) update('healingIncrease', 10);
                                    else { update('healingIncrease', undefined); update('healingIncreaseSelfOnly', undefined); }
                                }} />
                            回復量UP効果
                        </label>
                        {form.healingIncrease !== undefined && form.healingIncrease > 0 && (
                            <div className="mt-2 pl-4 border-l-2 border-app-text/10 space-y-2">
                                <div>
                                    <label className={labelClass}>回復量UP (%)</label>
                                    <input type="number" className={inputClass} value={form.healingIncrease} min={0} max={100}
                                        onChange={e => update('healingIncrease', Number(e.target.value))} />
                                </div>
                                <label className="flex items-center gap-2 text-app-lg cursor-pointer">
                                    <input type="checkbox" checked={!!form.healingIncreaseSelfOnly} className={checkboxClass}
                                        onChange={e => update('healingIncreaseSelfOnly', e.target.checked || undefined)} />
                                    自分のヒールのみに適用
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
