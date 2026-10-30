/**
 * スキル追加/編集モーダル — 必須フィールド(ジョブ・アイコン・名前・数値・タイプ・軽減率)
 */
import type { Job, Mitigation } from '../../../types';
import { inputClass, selectClass, labelClass, helpClass, checkboxClass } from './skillFormClasses';

interface SkillFormRequiredSectionProps {
    form: Mitigation;
    update: <K extends keyof Mitigation>(key: K, value: Mitigation[K]) => void;
    updateName: (lang: 'ja' | 'en' | 'zh' | 'zh-Hant' | 'ko', value: string) => void;
    jobs: Job[];
    selectedJob: Job | undefined;
    isNew: boolean;
    uploading: boolean;
    handleIconUpload: (file: File) => void;
}

export function SkillFormRequiredSection({ form, update, updateName, jobs, selectedJob, isNew, uploading, handleIconUpload }: SkillFormRequiredSectionProps) {
    return (
        <>
            {/* ── ジョブ表示（新規時は選択可、編集時は固定） ── */}
            <div className="flex items-center gap-3 p-3 bg-app-text/5 rounded">
                {selectedJob?.icon && <img referrerPolicy="no-referrer" src={selectedJob.icon} alt="" className="w-6 h-6" />}
                <span className="font-bold">{selectedJob?.name.ja ?? form.jobId}</span>
                {isNew && (
                    <select
                        className={`${selectClass} ml-auto w-40`}
                        value={form.jobId}
                        onChange={e => update('jobId', e.target.value)}
                    >
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.name.ja} ({j.role})</option>)}
                    </select>
                )}
            </div>

            {/* ══════════════════════════════════════════
                 必須フィールド（常に表示）
               ══════════════════════════════════════════ */}

            {/* アイコン */}
            <div className="flex items-center gap-3">
                {form.icon ? (
                    <img referrerPolicy="no-referrer" src={form.icon} alt="" className="w-10 h-10 object-contain rounded border border-app-text/10" />
                ) : (
                    <div className="w-10 h-10 rounded border border-dashed border-app-text/20 flex items-center justify-center text-app-text-muted text-app-base">?</div>
                )}
                <label className="px-3 py-1.5 text-app-lg border border-app-text/20 rounded cursor-pointer hover:bg-app-text/10 transition-colors">
                    {uploading ? 'アップロード中...' : 'アイコン選択'}
                    <input type="file" accept="image/png,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.target.value = ''; }} />
                </label>
                {form.icon && <span className="text-app-base text-app-text-muted font-mono truncate">{form.icon}</span>}
            </div>

            {/* 名前（5言語） */}
            <div>
                <p className="text-app-lg font-bold mb-2">スキル名</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>日本語 <span className="text-red-400">*</span></label>
                        <input className={inputClass} value={form.name.ja} placeholder="例: リプライザル"
                            onChange={e => updateName('ja', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>English <span className="text-red-400">*</span></label>
                        <input className={inputClass} value={form.name.en} placeholder="e.g. Reprisal"
                            onChange={e => updateName('en', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>中文</label>
                        <input className={inputClass} value={form.name.zh ?? ''} placeholder="中国語名（任意）"
                            onChange={e => updateName('zh', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>繁體中文</label>
                        <input className={inputClass} value={form.name['zh-Hant'] ?? ''} placeholder="繁体字名（任意）"
                            onChange={e => updateName('zh-Hant', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>한국어</label>
                        <input className={inputClass} value={form.name.ko ?? ''} placeholder="韓国語名（任意）"
                            onChange={e => updateName('ko', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* 基本数値 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                    <label className={labelClass}>軽減率 (%) <span className="text-red-400">*</span></label>
                    <input type="number" className={inputClass} value={form.value} min={0} max={100}
                        onChange={e => update('value', Number(e.target.value))} />
                    <p className={helpClass}>ダメージを何%カットするか</p>
                </div>
                <div>
                    <label className={labelClass}>効果時間 (秒) <span className="text-red-400">*</span></label>
                    <input type="number" className={inputClass} value={form.duration} min={0} step={0.1}
                        onChange={e => update('duration', Number(e.target.value))} />
                </div>
                <div>
                    <label className={labelClass}>リキャスト (秒) <span className="text-red-400">*</span></label>
                    <input type="number" className={inputClass} value={form.recast} min={0} step={0.1}
                        onChange={e => update('recast', Number(e.target.value))} />
                </div>
                <div>
                    <label className={labelClass}>範囲 <span className="text-red-400">*</span></label>
                    <select className={selectClass} value={form.scope ?? 'party'}
                        onChange={e => update('scope', e.target.value as Mitigation['scope'])}>
                        <option value="self">自分のみ</option>
                        <option value="party">パーティ全体</option>
                        <option value="target">単体対象</option>
                    </select>
                    <p className={helpClass}>self=自分, party=全員, target=指定1人</p>
                </div>
            </div>

            {/* タイプ */}
            <div>
                <label className={labelClass}>ダメージタイプ <span className="text-red-400">*</span></label>
                <div className="flex gap-4 mt-1">
                    {([['all', '全体（物魔両方）'], ['magical', '魔法のみ'], ['physical', '物理のみ']] as const).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-1.5 text-app-lg cursor-pointer">
                            <input type="radio" name="dmgType" checked={form.type === val}
                                onChange={() => update('type', val)} className={checkboxClass} />
                            {label}
                        </label>
                    ))}
                </div>
                <p className={helpClass}>このスキルがどのタイプのダメージを軽減するか</p>
            </div>

            {/* 物魔別軽減率（タイプがallの場合のみ意味がある） */}
            {form.type === 'all' && (form.valuePhysical !== undefined || form.valueMagical !== undefined) && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-app-text/10">
                    <div>
                        <label className={labelClass}>物理軽減率 (%)</label>
                        <input type="number" className={inputClass} value={form.valuePhysical ?? ''} min={0} max={100}
                            onChange={e => update('valuePhysical', e.target.value ? Number(e.target.value) : undefined)} />
                    </div>
                    <div>
                        <label className={labelClass}>魔法軽減率 (%)</label>
                        <input type="number" className={inputClass} value={form.valueMagical ?? ''} min={0} max={100}
                            onChange={e => update('valueMagical', e.target.value ? Number(e.target.value) : undefined)} />
                    </div>
                </div>
            )}
            {form.type === 'all' && form.valuePhysical === undefined && form.valueMagical === undefined && (
                <button className="text-app-base text-blue-400 hover:underline"
                    onClick={() => { update('valuePhysical', form.value); update('valueMagical', form.value); }}>
                    + 物魔別の軽減率を設定する
                </button>
            )}
        </>
    );
}
