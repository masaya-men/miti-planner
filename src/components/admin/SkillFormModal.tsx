/**
 * スキル追加/編集モーダル
 * 全フィールドを1画面で表示し、重要度で3段階に分けて整理
 * - 必須: 名前、効果時間、リキャスト、軽減率、タイプ、範囲
 * - よく使う: バースト、シールド、無敵、レベル制限、アイコン
 * - 詳細: ファミリー、前提スキル、妖精、リソースコスト等
 */
import { useState, useEffect } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { showToast } from '../Toast';
import type { Job, Mitigation } from '../../types';

interface SkillFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (skill: Mitigation, isNew: boolean) => void;
    /** 編集対象（nullなら新規追加） */
    skill: Mitigation | null;
    /** 新規追加時のジョブID */
    jobId: string;
    /** 全ジョブ一覧（ジョブ選択用） */
    jobs: Job[];
    /** 全スキル一覧（前提スキル選択用） */
    allMitigations: Mitigation[];
}

/** デフォルト値で新規スキルを作成 */
function createDefaultSkill(jobId: string): Mitigation {
    return {
        id: '',
        jobId,
        name: { ja: '', en: '' },
        icon: '',
        duration: 15,
        recast: 60,
        type: 'all',
        value: 10,
        scope: 'party',
    };
}

/** IDスラッグ生成 */
function slugify(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function SkillFormModal({ isOpen, onClose, onSave, skill, jobId, jobs, allMitigations }: SkillFormModalProps) {
    const isNew = !skill;
    const [form, setForm] = useState<Mitigation>(createDefaultSkill(jobId));
    const [showCommon, setShowCommon] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [uploading, setUploading] = useState(false);

    // モーダルが開いたときにフォームを初期化
    useEffect(() => {
        if (isOpen) {
            if (skill) {
                setForm({ ...skill });
                // 編集時: 値があるセクションは開いておく
                setShowCommon(!!(skill.burstValue || skill.isShield || skill.isInvincible || skill.minLevel));
                setShowAdvanced(!!(skill.family || skill.requires || skill.requiresFairy || skill.resourceCost || skill.maxCharges));
            } else {
                setForm(createDefaultSkill(jobId));
                setShowCommon(false);
                setShowAdvanced(false);
            }
        }
    }, [isOpen, skill, jobId]);

    if (!isOpen) return null;

    const update = <K extends keyof Mitigation>(key: K, value: Mitigation[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const updateName = (lang: 'ja' | 'en' | 'zh' | 'ko', value: string) => {
        setForm(prev => ({ ...prev, name: { ...prev.name, [lang]: value } }));
    };

    const handleIconUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        try {
            setUploading(true);
            const ext = file.name.split('.').pop() || 'png';
            const id = form.id || `${form.jobId}_${slugify(form.name.en || form.name.ja || 'skill')}_${Date.now()}`;
            const filename = `${id}.${ext}`;
            const storageRef = ref(storage, `icons/${filename}`);
            await uploadBytes(storageRef, file, {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000, immutable',
            });
            update('icon', `/icons/${filename}`);
            showToast('アイコンをアップロードしました');
        } catch {
            showToast('アイコンのアップロードに失敗', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = () => {
        // バリデーション
        if (!form.name.ja.trim()) { showToast('日本語名を入力してください', 'error'); return; }
        if (!form.name.en.trim()) { showToast('英語名を入力してください', 'error'); return; }
        if (form.duration <= 0) { showToast('効果時間を入力してください', 'error'); return; }
        if (form.recast <= 0) { showToast('リキャストを入力してください', 'error'); return; }

        // 新規の場合はIDを自動生成
        let finalSkill = { ...form };
        if (isNew) {
            finalSkill.id = `${form.jobId}_${slugify(form.name.en)}_${Date.now().toString(36)}`;
        }

        onSave(finalSkill, isNew);
    };

    const selectedJob = jobs.find(j => j.id === form.jobId);

    // 同じジョブのスキル一覧（前提スキル選択用）
    const sameJobSkills = allMitigations.filter(m => m.jobId === form.jobId && m.id !== form.id);

    const inputClass = 'px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full';
    const selectClass = `${inputClass} bg-app-bg [&>option]:bg-app-bg [&>option]:text-app-text`;
    const labelClass = 'block text-app-base text-app-text-muted mb-0.5';
    const helpClass = 'text-[11px] text-app-text-muted/60 mt-0.5';
    const sectionBtn = 'w-full text-left px-3 py-2 text-app-lg font-bold border border-app-text/10 rounded hover:bg-app-text/5 transition-colors flex items-center justify-between';
    const checkboxClass = 'mr-2 accent-blue-500';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-app-bg border border-app-text/20 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="sticky top-0 z-10 bg-app-bg border-b border-app-text/10 px-5 py-3 flex items-center justify-between">
                    <h2 className="text-app-xl font-bold">
                        {isNew ? 'スキル追加' : `${form.name.ja} を編集`}
                    </h2>
                    <button onClick={onClose} className="text-app-text-muted hover:text-app-text text-app-2xl leading-none">&times;</button>
                </div>

                <div className="px-5 py-4 space-y-5">

                    {/* ── ジョブ表示（新規時は選択可、編集時は固定） ── */}
                    <div className="flex items-center gap-3 p-3 bg-app-text/5 rounded">
                        {selectedJob?.icon && <img src={selectedJob.icon} alt="" className="w-6 h-6" />}
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
                            <img src={form.icon} alt="" className="w-10 h-10 object-contain rounded border border-app-text/10" />
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

                    {/* 名前（4言語） */}
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
                </div>

                {/* フッター */}
                <div className="sticky bottom-0 bg-app-bg border-t border-app-text/10 px-5 py-3 flex items-center justify-between">
                    <button onClick={onClose}
                        className="px-4 py-1.5 text-app-lg border border-app-text/20 rounded hover:bg-app-text/10 transition-colors">
                        キャンセル
                    </button>
                    <button onClick={handleSubmit}
                        className="px-6 py-1.5 text-app-lg bg-app-toggle text-app-toggle-text rounded hover:opacity-90 transition-opacity font-bold">
                        {isNew ? 'スキルを追加' : '変更を保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
