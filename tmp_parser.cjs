const fs = require('fs');

const md = fs.readFileSync('C:/Users/masay/.gemini/antigravity/brain/7101f173-8660-44de-8e66-e318e3b4a2aa/custom_content_mapping.md.resolved', 'utf8');

// Parse markdown tables
const lines = md.split('\n');
const parsed = [];

let currentLevel = 0;

for (const line of lines) {
    if (line.includes('Lv100')) currentLevel = 100;
    else if (line.includes('Lv90')) currentLevel = 90;
    else if (line.includes('Lv80')) currentLevel = 80;
    else if (line.includes('Lv70')) currentLevel = 70;
    
    if (line.startsWith('|') && !line.includes('Patch') && !line.includes(':---')) {
        const parts = line.split('|').map(s => s.trim()).filter(s => s !== '');
        if (parts.length === 4) {
            const patch = parts[0];
            const ja = parts[1];
            const en = parts[2];
            let shortRaw = parts[3];
            
            // Clean up shortRaw just in case
            shortRaw = shortRaw.replace(/<[^>]+>/g, '').trim(); 
            
            // Generate an ID from the short name
            let id = shortRaw.toLowerCase().replace(/\s+/g, '_');
            
            // Determine category
            let category = 'savage';
            if (en.includes('Ultimate') || ja.includes('絶')) category = 'ultimate';
            
            parsed.push({
                id,
                patch,
                ja,
                en,
                shortNameJa: shortRaw,
                category,
                level: currentLevel
            });
        }
    }
}

// 1. Rewrite contents.ts
let tsContent = `import type { ContentCategory, ContentLevel } from '../types';

export interface RawContentData {
  id: string;
  category: ContentCategory;
  level: ContentLevel;
  patch: string;
  ja: string;
  en: string;
  shortNameJa?: string;
}

export const RAID_CONTENTS: RawContentData[] = [\n`;

for (const item of parsed) {
    tsContent += `  { id: '${item.id}', category: '${item.category}', level: ${item.level}, patch: '${item.patch}', ja: '${item.ja}', en: '${item.en}', shortNameJa: '${item.shortNameJa}' },\n`;
}
tsContent += `];\n`;

fs.writeFileSync('C:/Users/masay/Desktop/FF14Sim/src/data/contents.ts', tsContent);

// 2. Update locales
const jaFile = 'C:/Users/masay/Desktop/FF14Sim/src/locales/ja.json';
const enFile = 'C:/Users/masay/Desktop/FF14Sim/src/locales/en.json';
let jaLocale = JSON.parse(fs.readFileSync(jaFile, 'utf8'));
let enLocale = JSON.parse(fs.readFileSync(enFile, 'utf8'));

// Only remove the raid content keys, leave other localized strings in `content` alone if any
jaLocale.content = jaLocale.content || {};
enLocale.content = enLocale.content || {};

for (const c of parsed) {
    jaLocale.content[c.id] = c.ja;
    enLocale.content[c.id] = c.en;
    jaLocale.content[c.id + '_short'] = c.shortNameJa;
    enLocale.content[c.id + '_short'] = c.shortNameJa; // English usually just uses the short name too for abbreviations
}

fs.writeFileSync(jaFile, JSON.stringify(jaLocale, null, 2));
fs.writeFileSync(enFile, JSON.stringify(enLocale, null, 2));

console.log('Successfully extracted ' + parsed.length + ' custom items and generated updated files!');
