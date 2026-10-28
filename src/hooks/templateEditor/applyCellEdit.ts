/**
 * テンプレートエディター — セル 1 つの編集を state に反映する計算(翻訳・スプシ表記の自動伝播つき)
 */
import type { TimelineEvent, LocalizedString } from '../../types';
import type { EditState } from './templateEditorTypes';

export function applyCellEdit(
  prev: EditState,
  eventId: string,
  field: string,
  value: unknown,
  autoPropagate: boolean,
): EditState {
    const newCurrent = structuredClone(prev.current);
    const ev = newCurrent.find((e) => e.id === eventId);
    if (!ev) return prev;

    const oldJa = ev.name.ja;
    const oldEn = ev.name.en;
    const oldAliases = ev.sheetAliases ? [...ev.sheetAliases] : undefined;

    switch (field) {
      case 'time':
        ev.time = value as number;
        break;
      case 'name.ja':
        ev.name.ja = value as string;
        break;
      case 'name.en':
        ev.name.en = value as string;
        break;
      case 'name.zh':
        ev.name.zh = value as string;
        break;
      case 'name.zh-Hant':
        ev.name['zh-Hant'] = value as string;
        break;
      case 'name.ko':
        ev.name.ko = value as string;
        break;
      case 'altName.ja':
      case 'altName.en':
      case 'altName.zh':
      case 'altName.zh-Hant':
      case 'altName.ko': {
        const altLang = field.split('.')[1] as 'ja' | 'en' | 'zh' | 'zh-Hant' | 'ko';
        const next: LocalizedString = ev.altName
          ? { ...ev.altName }
          : { ja: '', en: '' };
        next[altLang] = value as string;
        const isEmpty = !next.ja.trim() && !next.en.trim() && !(next.zh ?? '').trim() && !(next['zh-Hant'] ?? '').trim() && !(next.ko ?? '').trim();
        if (isEmpty) {
          delete ev.altName;
        } else {
          ev.altName = next;
        }
        break;
      }
      case 'damageAmount':
        ev.damageAmount = value as number | undefined;
        break;
      case 'damageType':
        ev.damageType = value as TimelineEvent['damageType'];
        break;
      case 'target':
        ev.target = value as TimelineEvent['target'];
        break;
      case 'sheetAliases': {
        const arr = value as string[];
        if (arr.length === 0) delete ev.sheetAliases;
        else ev.sheetAliases = arr;
        break;
      }
      case 'ignoresDebuffMitigation':
        ev.ignoresDebuffMitigation = value as boolean;
        break;
      default:
        return prev;
    }

    const key = `${eventId}:${field}`;
    const newModified = new Set(prev.modified);
    newModified.add(key);

    const newAutoFilled = new Set(prev.autoFilled);
    newAutoFilled.delete(key);

    // 翻訳自動伝播
    const translationFields = ['name.en', 'name.ja', 'name.zh', 'name.zh-Hant', 'name.ko'] as const;
    if (autoPropagate && translationFields.includes(field as typeof translationFields[number])) {
      const oldZh = ev.name.zh ?? '';
      const oldZhHant = ev.name['zh-Hant'] ?? '';
      const oldKo = ev.name.ko ?? '';

      for (const other of newCurrent) {
        if (other.id === eventId || prev.deleted.has(other.id)) continue;

        if (field === 'name.en') {
          if (other.name.ja === oldJa && (other.name.en === '' || other.name.en === oldEn)) {
            other.name.en = value as string;
            newAutoFilled.add(`${other.id}:name.en`);
          }
        } else if (field === 'name.ja') {
          if (other.name.en === oldEn && oldEn !== '' && (other.name.ja === '' || other.name.ja === oldJa)) {
            other.name.ja = value as string;
            newAutoFilled.add(`${other.id}:name.ja`);
          }
        } else if (field === 'name.zh') {
          if (other.name.ja === oldJa && ((other.name.zh ?? '') === '' || (other.name.zh ?? '') === oldZh)) {
            other.name.zh = value as string;
            newAutoFilled.add(`${other.id}:name.zh`);
          }
        } else if (field === 'name.zh-Hant') {
          if (other.name.ja === oldJa && ((other.name['zh-Hant'] ?? '') === '' || (other.name['zh-Hant'] ?? '') === oldZhHant)) {
            other.name['zh-Hant'] = value as string;
            newAutoFilled.add(`${other.id}:name.zh-Hant`);
          }
        } else if (field === 'name.ko') {
          if (other.name.ja === oldJa && ((other.name.ko ?? '') === '' || (other.name.ko ?? '') === oldKo)) {
            other.name.ko = value as string;
            newAutoFilled.add(`${other.id}:name.ko`);
          }
        }
      }
    }

    // スプシ表記の自動伝播: 同じ JA 名(非空)の行で、空 or 旧値一致だったものへ伝播。
    // 安全側: 空入力(クリア)は編集行のみ・同名行へは伝播しない(一括クリア事故防止)。
    if (autoPropagate && field === 'sheetAliases') {
      const newAliases = value as string[];
      const groupJa = ev.name.ja;
      if (newAliases.length > 0 && groupJa.trim() !== '') {
        const norm = (a?: string[]) => (a ?? []).join('');
        const oldKey = norm(oldAliases);
        for (const other of newCurrent) {
          if (other.id === eventId || prev.deleted.has(other.id)) continue;
          if (other.name.ja !== groupJa) continue;
          const otherKey = norm(other.sheetAliases);
          if (otherKey === '' || otherKey === oldKey) {
            other.sheetAliases = [...newAliases];
            newAutoFilled.add(`${other.id}:sheetAliases`);
          }
        }
      }
    }

    return {
      ...prev,
      current: newCurrent,
      modified: newModified,
      autoFilled: newAutoFilled,
    };
}
