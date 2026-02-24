// ==========================================
// 1. 定数・初期設定 (DATA & CONSTANTS)
// ==========================================
const LV_CONST = { MAIN: 440, SUB: 420, DIV: 2780 };
const JOB_MODS = { Healer: 115, Tank: 100, DPS: 100 };
const TRAITS = { Healer: 130, Tank: 100, DPS: 100 };

// ★設定：最初から確保しておくスキルの列数（ここを変えると幅が変わります）
const MIN_LANES = 4; 

// 初期ステータス（計算エラー防止のため固定値を入れています）
let playerStats = { MAIN: 4500, WD: 135, DET: 2200, TNC: 1000 };

const ROLE_GROUPS = [
    { name: "Tank", jobs: ["Paladin", "Warrior", "DarkKnight", "Gunbreaker"] },
    { name: "Healer", jobs: ["WhiteMage", "Scholar", "Astrologian", "Sage"] },
    { name: "Melee", jobs: ["Monk", "Dragoon", "Ninja", "Samurai", "Reaper", "Viper"] },
    { name: "Range", jobs: ["Bard", "Machinist", "Dancer"] },
    { name: "Caster", jobs: ["BlackMage", "Summoner", "RedMage", "Pictomancer"] }
];

// Calc Modeでの表示順序
const JOB_ORDER = [
    "Paladin","Warrior","DarkKnight","Gunbreaker",
    "WhiteMage","Scholar","Astrologian","Sage",
    "Monk","Dragoon","Ninja","Samurai","Reaper","Viper",
    "Bard","Machinist","Dancer",
    "BlackMage","Summoner","RedMage","Pictomancer"
];

// 逆引き用マップ作成
const roleMap = {};
const jobTypes = {};
ROLE_GROUPS.forEach(g => g.jobs.forEach(j => {
    roleMap[j] = g.name;
    if(g.name==='Tank') jobTypes[j]='Tank';
    else if(g.name==='Healer') jobTypes[j]='Healer';
    else jobTypes[j]='DPS';
}));

// ==========================================
// 2. スキルデータベース (SKILL DB)
// ==========================================
const skillDB = {
    // --- タンク共通 ---
    "Rampart": {d:20, r:90, m:0.20, type:'all', scope:'self'}, 
    "Reprisal": {d:15, r:60, m:0.10, type:'all', scope:'party'},
    
    // --- ナイト ---
    "Holy_Sheltron": {d:8, r:5, m:0.15, m_bonus:0.15, d_bonus:4, type:'all', scope:'self'}, 
    "Guardian": {d:15, r:120, m:0.40, type:'all', scope:'self'}, 
    "Hallowed_Ground": {d:10, r:420, m:1.00, type:'all', scope:'self'}, 
    "Divine_Veil": {d:30, r:90, m:0, barrier:0.10, scaling:'hp', source:'caster', scope:'party'}, 
    "Passage_of_Arms": {d:5, r:120, m:0.15, type:'all', scope:'party'}, 
    "Bulwark": {d:10, r:90, m:0.20, type:'all', scope:'self'}, 
    "Intervention": {d:8, r:10, m:0.10, type:'all', scope:'target'},

    // --- 戦士 ---
    "Bloodwhetting": {d:8, r:25, m:0.10, m_bonus:0.10, d_bonus:4, type:'all', barrier:400, scaling:'potency', job:'Tank', scope:'self'},
    "Damnation": {d:15, r:120, m:0.40, type:'all', scope:'self'}, 
    "Holmgang": {d:10, r:240, m:0, scope:'self'}, 
    "Shake_It_Off": {d:30, r:90, m:0, barrier:0.15, scaling:'hp', source:'target', scope:'party'}, 
    "Nascent_Flash": {d:8, r:25, m:0.10, type:'all', barrier:400, scaling:'potency', job:'Tank', scope:'target'},
    "Thrill_of_Battle": {d:10, r:90, m:0, barrier:0.20, scaling:'hp', source:'target', scope:'self'},

    // --- 暗黒騎士 ---
    "The_Blackest_Night": {d:7, r:15, m:0, barrier:0.25, scaling:'hp', source:'target', scope:'target'}, 
    "Shadowed_Vigil": {d:15, r:120, m:0.40, type:'all', scope:'self'}, 
    "Living_Dead": {d:10, r:300, m:0, scope:'self'}, 
    "Dark_Missionary": {d:15, r:90, m:0.10, type:'magic', m_phys:0.05, scope:'party'}, 
    "Dark_Mind": {d:10, r:60, m:0.20, type:'magic', scope:'self'}, 
    "Oblation": {d:10, r:60, m:0.10, type:'all', scope:'target'},

    // --- ガンブレイカー ---
    "Heart_of_Corundum": {d:8, r:25, m:0.15, m_bonus:0.15, d_bonus:4, type:'all', scope:'target'}, 
    "Great_Nebula": {d:15, r:120, m:0.40, type:'all', scope:'self'}, 
    "Superbolide": {d:10, r:360, m:1.00, type:'all', scope:'self'}, 
    "Heart_of_Light": {d:15, r:90, m:0.10, type:'magic', m_phys:0.05, scope:'party'}, 
    "Camouflage": {d:20, r:90, m:0.10, type:'all', scope:'self'}, 
    "Aurora": {d:18, r:60, m:0, scope:'target'},

    // --- ヒーラー ---
    "Temperance": {d:20, r:120, m:0.10, type:'all', scope:'party'}, 
    "Divine_Caress": {d:10, r:1, m:0, barrier:400, scaling:'potency', job:'Healer', prerequisite:'Temperance', scope:'party'},
    "Plenary_Indulgence": {d:10, r:60, m:0.10, type:'all', scope:'party'},
    "Sacred_Soil": {d:17, r:30, m:0.10, type:'all', scope:'party'}, 
    "Expedient": {d:20, r:120, m:0.10, type:'all', scope:'party'}, 
    "Fey_Illumination": {d:20, r:120, m:0.05, type:'magic', scope:'party'}, 
    "Seraphism": {d:20, r:180, m:0, scope:'party'}, 
    "Concitation": {d:30, r:0, m:0, barrier:360, scaling:'potency', job:'Healer', scope:'party'}, 
    "Deployment_Tactics": {d:30, r:90, m:0, barrier:540, scaling:'potency', job:'Healer', scope:'party'},
    "Summon_Seraph": {d:22, r:120, m:0, scope:'party'}, 
    "Consolation": {d:30, r:30, m:0, barrier:250, scaling:'potency', job:'Healer', prerequisite:'Summon_Seraph', scope:'party'},
    "Accession": {d:30, r:0, m:0, barrier:432, scaling:'potency', job:'Healer', prerequisite:'Seraphism', scope:'party'},
    "Collective_Unconscious": {d:10, r:60, m:0.10, type:'all', scope:'party'}, 
    "Neutral_Sect": {d:30, r:120, m:0, scope:'party'}, 
    "Helios_Conjunction": {d:30, r:0, m:0, barrier:375, scaling:'potency', job:'Healer', prerequisite:'Neutral_Sect', scope:'party'},
    "Sun_Sign": {d:15, r:0, m:0.10, type:'all', prerequisite:'Neutral_Sect', scope:'party'},
    "Kerachole": {d:15, r:30, m:0.10, type:'all', scope:'party'}, 
    "Holos": {d:20, r:120, m:0.10, type:'all', barrier:300, scaling:'potency', job:'Healer', scope:'party'}, 
    "Panhaima": {d:15, r:120, m:0, barrier:200, scaling:'potency', job:'Healer', scope:'party'}, 
    "Philosophia": {d:20, r:180, m:0, scope:'party'}, 
    "Eukrasian_Prognosis_II": {d:30, r:0, m:0, barrier:360, scaling:'potency', job:'Healer', scope:'party'},
    
    // --- DPS ---
    "Feint": {d:15, r:90, m:0.10, type:'phys', m_magic:0.05, scope:'party'}, 
    "Mantra": {d:15, r:90, m:0, scope:'party'}, 
    "Troubadour": {d:15, r:120, m:0.15, type:'all', scope:'party'}, 
    "Tactician": {d:15, r:120, m:0.15, type:'all', scope:'party'}, 
    "Shield_Samba": {d:15, r:120, m:0.15, type:'all', scope:'party'}, 
    "Nature's_Minne": {d:15, r:90, m:0, scope:'party'}, 
    "Dismantle": {d:10, r:120, m:0.10, type:'all', scope:'party'}, 
    "Improvisation": {d:15, r:120, m:0, barrier:0.05, scaling:'hp', source:'target', scope:'party'}, 
    "Addle": {d:15, r:90, m:0.10, type:'magic', m_phys:0.05, scope:'party'}, 
    "Magick_Barrier": {d:10, r:120, m:0.10, type:'magic', scope:'party'}, 
    "Tempera_Grassa": {d:10, r:120, m:0, barrier:0.10, scaling:'hp', source:'target', scope:'party'} 
};

// ジョブごとのスキル表示順定義
const jobSkills = {
    "Common_Tank": ["Rampart", "Reprisal"], 
    "Common_Melee": ["Feint"],
    "Common_Caster": ["Addle"],
    "Common_Range": [], "Common_Healer": [],
    
    "DarkKnight": ["Reprisal", "Dark_Missionary", "The_Blackest_Night", "Oblation", "Rampart", "Dark_Mind", "Shadowed_Vigil", "Living_Dead"],
    "Paladin": ["Reprisal", "Divine_Veil", "Passage_of_Arms", "Holy_Sheltron", "Intervention", "Rampart", "Bulwark", "Guardian", "Hallowed_Ground"],
    "Warrior": ["Reprisal", "Shake_It_Off", "Bloodwhetting", "Nascent_Flash", "Rampart", "Thrill_of_Battle", "Damnation", "Holmgang"],
    "Gunbreaker": ["Reprisal", "Heart_of_Light", "Heart_of_Corundum", "Aurora", "Rampart", "Camouflage", "Great_Nebula", "Superbolide"],
    
    "WhiteMage": ["Temperance", "Divine_Caress", "Plenary_Indulgence"],
    "Scholar": ["Sacred_Soil", "Expedient", "Concitation", "Deployment_Tactics", "Summon_Seraph", "Consolation", "Seraphism", "Accession", "Fey_Illumination"],
    "Astrologian": ["Collective_Unconscious", "Neutral_Sect", "Helios_Conjunction", "Sun_Sign"],
    "Sage": ["Kerachole", "Holos", "Panhaima", "Philosophia", "Eukrasian_Prognosis_II"],
    "Monk": ["Mantra"], 
    "Bard": ["Troubadour", "Nature's_Minne"], 
    "Machinist": ["Tactician", "Dismantle"], 
    "Dancer": ["Shield_Samba", "Improvisation"], 
    "RedMage": ["Magick_Barrier"], 
    "Pictomancer": ["Tempera_Grassa"],
    "Dragoon":[],"Samurai":[],"Reaper":[],"Viper":[],"Ninja":[],"BlackMage":[],"Summoner":[]
};

// ==========================================
// 3. アプリケーション状態 (STATE)
// ==========================================
let currentParty = [
    { role: "MT", job: "DarkKnight" }, { role: "H1", job: "WhiteMage" }, 
    { role: "D1", job: "Monk" }, { role: "D3", job: "Bard" },
    { role: "ST", job: "Gunbreaker" }, { role: "H2", job: "Scholar" }, 
    { role: "D2", job: "Viper" }, { role: "D4", job: "Pictomancer" }
];
let hpSettings = { tank: 300000, other: 190000 };
let timelineData = new Array(1201).fill(null).map((_, i) => ({
    seconds: i, name: "", type: "", target: "", udmg: 0, shieldOverride: 0, skills: [[],[],[],[],[],[],[],[]]
}));
let phases = [];
let colorMode = "GROUP";
let editing = { sec:-1, row:-1, mem:-1, slot:-1 };
let dragSrc = null;
let selectedCalcMitis = new Set();
let calculatedMitisList = [];

// ==========================================
// 4. 計算・ソートロジック (LOGIC)
// ==========================================
window.formatNum = n => n ? n.toLocaleString() : "0";
window.parseNum = s => parseInt(s.toString().replace(/,/g, '')) || 0;

window.f_HMP = s => Math.floor(100*(s-LV_CONST.MAIN)/268)+100;
window.f_DET = s => Math.floor(140*(s-LV_CONST.MAIN)/LV_CONST.DIV)+1000;
window.f_TNC = s => Math.floor(110*(s-LV_CONST.SUB)/LV_CONST.DIV)+1000;
window.f_WD = j => Math.floor((LV_CONST.MAIN*JOB_MODS[j])/1000)+playerStats.WD;

window.calcPotencyBarrier = (pot, job) => {
    const tnc = (job==='Tank')?f_TNC(playerStats.TNC):1000;
    const h1 = Math.floor(Math.floor(Math.floor(pot*f_HMP(playerStats.MAIN))*f_DET(playerStats.DET))/100)/1000;
    return Math.floor(Math.floor(Math.floor(h1*tnc)/1000*f_WD(job))/100*TRAITS[job]/100);
};

window.sortSkillsInCell = (skills) => {
    return skills.sort((a,b) => {
        const da=skillDB[a]||{r:999}, db=skillDB[b]||{r:999};
        if(da.prerequisite===b) return 1; if(db.prerequisite===a) return -1;
        const sa=(da.scope==='party')?0:1, sb=(db.scope==='party')?0:1;
        if(sa!==sb) return sa-sb;
        return da.r - db.r;
    });
};

window.getBarColor = (idx, job) => {
    if(colorMode==='GROUP') return idx<4?'#4a90e2':'#f1c40f';
    const r = roleMap[job];
    if(r==='Tank') return '#4a90e2'; if(r==='Healer') return '#2ecc71'; if(r==='Melee') return '#e74c3c'; if(r==='Range') return '#e67e22'; if(r==='Caster') return '#9b59b6';
    return '#aaa';
};

// ==========================================
// 5. 初期化とイベントリスナー (INIT)
// ==========================================
window.onload = function() {
    // 入力欄のイベント設定
    document.getElementById('evtName').addEventListener('input', function(e) {
        if(e.target.value==='AA'||e.target.value==='オートアタック') setRadio('target','MT');
    });

    // 初期値のUI反映
    document.getElementById('hpTank').value = hpSettings.tank;
    document.getElementById('hpOther').value = hpSettings.other;
    document.getElementById('sMain').value = playerStats.MAIN;
    document.getElementById('sWD').value = playerStats.WD;
    document.getElementById('sDet').value = playerStats.DET;
    document.getElementById('sTnc').value = playerStats.TNC;

    // サンプルデータの投入
    updateTimelineEvent(15, "The Fixer", "type_magic", "Party", 400000, 0); 
    updateTimelineEvent(22, "Mortal Slayer", "type_phys", "MT", 650000, 0); 
    
    // 初回描画
    renderHeader();
    renderTimelineRange(0, 1200);
};

// ==========================================
// 6. 描画関数 (RENDER)
// ==========================================
window.renderHeader = () => {
    const tr = document.getElementById('tableHeader');
    while(tr.children.length > 5) tr.removeChild(tr.lastChild);
    currentParty.forEach((m, i) => {
        const th = document.createElement('th');
        th.className = 'c-job ' + (i<4?'th-mt':'th-st');
        th.id = `th-job-${i}`;
        th.innerHTML = `<img src="./icons/${m.job}.png" class="icon-sm" onclick="openJobSelect(${i})"><br>${m.role}`;
        tr.appendChild(th);
    });
};

window.renderTimelineRange = (start, end) => {
    const tbody = document.getElementById('timelineBody');
    if(start===0 && end===1200) tbody.innerHTML = '';
    
    // レーン計算用
    const visualMatrix = [];
    const memberLanes = Array.from({length:8}, ()=>[]);
    const maxLanes = new Array(8).fill(MIN_LANES); // ★初期幅確保

    // 1. スキルの配置計算
    for(let t=start; t<=end; t++) {
        const row = timelineData[t];
        const rowVis = [];
        currentParty.forEach((m, mIdx) => {
            const mVis = { icons:[], bars:[] };
            if(row.skills[mIdx].length>0) row.skills[mIdx] = sortSkillsInCell(row.skills[mIdx]);
            
            row.skills[mIdx].forEach(sk => {
                const db = skillDB[sk]||{d:15,r:60};
                let lane = 0;
                while(t < (memberLanes[mIdx][lane]||0)) lane++;
                if(lane >= maxLanes[mIdx]) maxLanes[mIdx] = lane + 1; // 必要なら拡張
                memberLanes[mIdx][lane] = t + db.r;
                mVis.icons.push({name:sk, lane:lane});
            });
            rowVis.push(mVis);
        });
        visualMatrix.push(rowVis);
    }
    
    // 2. 行の描画
    const activeBars = Array.from({length:8}, ()=>[]);
    const frag = document.createDocumentFragment();

    for(let i=start; i<=end; i++) {
        const row = timelineData[i];
        row._index = i;
        const tr = document.createElement('tr');
        
        // フェーズ
        const tdPhase = document.createElement('td'); 
        const phaseObj = phases.find(p => i<=p.endSeconds && i > (phases[phases.indexOf(p)-1]?.endSeconds??-1));
        if(phaseObj && (phases[phases.indexOf(phaseObj)-1]?.endSeconds??-1)+1===i) {
            tdPhase.rowSpan = phaseObj.endSeconds-i+1; tdPhase.className='c-phase'; tdPhase.innerText=phaseObj.name;
            tdPhase.onclick = () => openPhase(i);
        } else if(phaseObj) { tdPhase.style.display='none'; }
        else { tdPhase.className='c-phase'; tdPhase.innerHTML='<span style="font-size:16px">+</span>'; tdPhase.onclick = () => openPhase(i); }
        tr.appendChild(tdPhase);

        // 時間・イベント
        const tdTime = document.createElement('td'); tdTime.className='c-time'; tdTime.innerText=`${Math.floor(i/60)}:${(i%60).toString().padStart(2,'0')}`; tr.appendChild(tdTime);
        const tdEvent = document.createElement('td'); tdEvent.className='c-event cell-clickable'; tdEvent.id=`evt-${i}`; renderEventCell(tdEvent, row, i); tr.appendChild(tdEvent);
        
        // ダメージ・軽減後
        const tdDmg = document.createElement('td'); tdDmg.className='c-dmg'; tdDmg.innerText=row.udmg>0?formatNum(row.udmg):""; tr.appendChild(tdDmg);
        const tdTaken = document.createElement('td'); tdTaken.className='c-taken'; tdTaken.id=`taken-${i}`;
        if(row.udmg>0) updateTakenCell(tdTaken, row, i);
        tr.appendChild(tdTaken);

        // ジョブ列
        currentParty.forEach((m, mIdx) => {
            const td = document.createElement('td');
            td.className = 'c-job ' + (mIdx<4?'bg-mt':'bg-st');
            td.id = `cell-${i}-${mIdx}`;
            
            // ハイライト機能
            td.onmouseenter = () => document.getElementById(`th-job-${mIdx}`).classList.add('highlight');
            td.onmouseleave = () => document.getElementById(`th-job-${mIdx}`).classList.remove('highlight');
            
            // ドラッグ＆クリック
            td.ondragover = e => e.preventDefault();
            td.ondrop = e => handleDrop(e, i, mIdx);
            td.onclick = e => { if(e.target===td || e.target.classList.contains('miti-cell')) openSkill(i, mIdx, e); };

            // 描画データ処理
            const vRow = visualMatrix[i-start];
            if(vRow && vRow[mIdx]) {
                vRow[mIdx].icons.forEach(ic => {
                    const db = skillDB[ic.name]||{d:15,r:60};
                    activeBars[mIdx].push({ skill: ic.name, endDur: i+db.d, endRecast: i+db.r, lane: ic.lane, color: getBarColor(mIdx, m.job), startT: i });
                });
            }
            // 期限切れバー削除
            activeBars[mIdx] = activeBars[mIdx].filter(b => b.endRecast > i);

            let html = `<div class="miti-cell">`;
            // バー描画
            activeBars[mIdx].forEach(b => {
                const type = i<b.endDur ? 'bar-solid' : 'bar-dotted';
                const left = 2 + (b.lane * 24) + 9;
                const top = (b.startT===i) ? 26 : 0; const h = (b.startT===i) ? 14 : 44;
                html += `<div class="bar ${type}" style="left:${left}px; border-left-color:${b.color}; top:${top}px; height:${h}px;"></div>`;
            });
            // アイコン描画
            if(vRow && vRow[mIdx]) {
                vRow[mIdx].icons.forEach(ic => {
                    const left = 2 + (ic.lane * 24);
                    html += `<img src="./icons/${ic.name}.png" class="miti-icon" style="left:${left}px;" 
                        draggable="true" ondragstart="handleDrag(event,${i},${mIdx},'${ic.name}')" 
                        oncontextmenu="handleContext(event,${i},${mIdx},'${ic.name}')" onerror="this.style.display='none'">`;
                });
            }
            html += `</div>`;
            td.innerHTML = html;
            tr.appendChild(td);
        });
        frag.appendChild(tr);
    }
    tbody.appendChild(frag);

    // ヘッダー幅調整
    maxLanes.forEach((max, idx) => {
        const th = document.getElementById(`th-job-${idx}`);
        if(th) th.style.width = (60 + (max>1?(max-1)*24:0)) + 'px';
    });
};

window.renderEventCell = (td, row, t) => {
    if(row.name) {
        let icon = row.type ? `<img src="./icons/${row.type}.png" class="dmg-type-icon">` : "";
        let target = "";
        if(row.target==='MT'||row.target==='ST') {
            const idx = row.target==='MT'?0:4;
            target = `<div class="evt-target-wrap">› <img src="./icons/${currentParty[idx].job}.png" class="evt-target-icon"></div>`;
        }
        td.innerHTML = `<div class="evt-inner" onclick="openEvent(${t})"><div class="evt-name" title="${row.name}">${row.name}</div><div class="evt-meta">${icon}${target}</div></div>`;
    } else { td.innerHTML = `<button class="btn-add" onclick="openEvent(${t})">+</button>`; }
};

window.updateTakenCell = (td, row, t) => {
    const active = [];
    const startLook = Math.max(0, t - 30);
    for(let i=startLook; i<=t; i++) {
        const r = timelineData[i];
        currentParty.forEach((m, mIdx) => {
            r.skills[mIdx].forEach(sk => {
                const db = skillDB[sk];
                if(db && (i + db.d > t)) active.push({ skill: sk, jobName: m.job, startTime: i });
            });
        });
    }
    const res = calculateMitigation(row, active);
    const isDanger = res.taken > (row.target==='MT'||row.target==='ST' ? hpSettings.tank : hpSettings.other);
    td.innerHTML = `<span class="taken-val" style="color:${isDanger?'#ff6b6b':'#51cf66'}">${formatNum(res.taken)}</span>
                    <span class="taken-sub">(M:${Math.round(res.mitiPercent)}% B:${formatNum(res.shieldUsed)})</span>`;
};

window.calculateMitigation = (row, activeList) => {
    let mult = 1.0; let shield = 0;
    const type = row.type; const isParty = row.target==='Party';
    const isMT = row.target==='MT'; const isST = row.target==='ST';

    activeList.forEach(item => {
        const sk = skillDB[item.skill];
        if(!sk) return;
        
        let apply = false;
        const casterIdx = currentParty.findIndex(p=>p.job===item.jobName);
        const targetIdx = isMT ? 0 : (isST ? 4 : -1);

        if(isParty) { if(sk.scope==='party') apply=true; } 
        else {
            if(sk.scope==='party') apply=true;
            else if(sk.scope==='target') apply=true;
            else if(sk.scope==='self' && casterIdx===targetIdx) apply=true;
        }

        if(apply) {
            let mVal = 0;
            if(item.skill==='Feint') mVal = (type==='type_phys'?sk.m:sk.m_magic);
            else if(item.skill==='Addle'||item.skill.includes('Missionary')||item.skill.includes('Heart_of_Light')) mVal = (type==='type_magic'?sk.m:sk.m_phys||0);
            else {
                if(sk.type==='all') mVal = sk.m;
                else if(sk.type==='phys' && type==='type_phys') mVal = sk.m;
                else if(sk.type==='magic' && type==='type_magic') mVal = sk.m;
            }
            if(sk.m_bonus && (row._index - item.startTime) < sk.d_bonus && mVal>0) {
                mVal = 1.0 - (1.0 - mVal) * (1.0 - sk.m_bonus);
            }
            if(mVal>0) mult *= (1.0 - mVal);

            if(sk.barrier) {
                let sVal = 0;
                if(sk.scaling==='potency') {
                    const jT = jobTypes[item.jobName]||'Healer';
                    sVal = calcPotencyBarrier(sk.barrier, jT);
                } else if(sk.scaling==='hp') {
                    let refHP = hpSettings.other;
                    if(sk.source==='caster') { const cR = roleMap[item.jobName]; refHP = (cR==='Tank')?hpSettings.tank:hpSettings.other; } 
                    else { refHP = (isMT||isST)?hpSettings.tank:hpSettings.other; }
                    sVal = Math.floor(refHP * sk.barrier);
                }
                shield += sVal;
            }
        }
    });

    if(mult<0.05) mult=0.05;
    const totalShield = shield + row.shieldOverride;
    const taken = Math.floor(row.udmg * mult) - totalShield;
    return { taken: taken<0?0:taken, mitiPercent: (1.0-mult)*100, shieldUsed: totalShield };
};

// --- 操作ハンドラ ---
window.handleDrag = (e, t, m, skill) => { dragSrc = { t, m, skill }; e.dataTransfer.effectAllowed = 'move'; };
window.handleDrop = (e, t, m) => {
    e.preventDefault();
    if(!dragSrc) return;
    const src = timelineData[dragSrc.t].skills[dragSrc.m];
    const dst = timelineData[t].skills[m];
    // Job check
    const role = roleMap[currentParty[m].job];
    const allowed = (jobSkills[currentParty[m].job]||[]).concat(jobSkills[`Common_${role}`]||[]);
    if(!allowed.includes(dragSrc.skill)) return;

    const idx = src.indexOf(dragSrc.skill);
    if(idx > -1) src.splice(idx, 1);
    if(!dst.includes(dragSrc.skill)) dst.push(dragSrc.skill);
    dragSrc = null; renderTimelineRange(0, 1200);
};
window.handleContext = (e, t, m, skill) => {
    e.preventDefault();
    const arr = timelineData[t].skills[m];
    const idx = arr.indexOf(skill);
    if(idx > -1) { arr.splice(idx, 1); renderTimelineRange(0, 1200); }
};

window.updateTimelineEvent = (sec, name, type, target, udmg, shieldOverride) => { 
    if (!timelineData[sec]) return; const r = timelineData[sec]; 
    r.name = name; r.type = type; r.target = target; r.udmg = udmg; 
    if(shieldOverride !== undefined) r.shieldOverride = shieldOverride; 
};

// --- Modals ---
window.openModal = (id) => { document.getElementById(id).classList.add('open'); };
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };
window.toggleColorMode = () => { colorMode = colorMode==='GROUP'?'ROLE':'GROUP'; document.getElementById('btnColorMode').innerText = `Color: ${colorMode}`; renderTimelineRange(0, 1200); };

// Event Edit
window.openEvent = (t) => {
    editing.sec = t;
    const r = timelineData[t];
    document.getElementById('evtName').value = r.name;
    document.getElementById('inpUDmg').value = r.udmg||"";
    document.getElementById('modeSwitch').checked = false; toggleCalcMode();
    setRadio('type', r.type||''); setRadio('target', r.target||'Party');
    document.getElementById('imgMT').src = `./icons/${currentParty[0].job}.png`;
    document.getElementById('imgST').src = `./icons/${currentParty[4].job}.png`;
    document.getElementById('inpCalcTaken').value=""; document.getElementById('inpCalcBarrier').value="";
    selectedCalcMitis.clear(); generateCalcList(); updateCalcGrid();
    openModal('modalEvent');
};
window.saveEvent = () => {
    const t = editing.sec;
    const name = document.getElementById('evtName').value;
    const type = document.getElementById('valType').value;
    const target = document.getElementById('valTarget').value;
    let udmg = 0;
    if(document.getElementById('modeSwitch').checked) {
        const taken = parseNum(document.getElementById('inpCalcTaken').value);
        const bar = parseNum(document.getElementById('inpCalcBarrier').value);
        let mult = 1.0;
        selectedCalcMitis.forEach(k => {
            const sk = skillDB[k.split('|')[1]];
            if(sk) {
                let v = (sk.type==='all' || (sk.type==='phys'&&type==='type_phys') || (sk.type==='magic'&&type==='type_magic')) ? sk.m : 0;
                if(k.includes('Feint')) v = (type==='type_phys'?sk.m:sk.m_magic);
                else if(k.includes('Addle')) v = (type==='type_magic'?sk.m:sk.m_phys);
                if(v>0) mult *= (1.0-v);
            }
        });
        if(mult<0.05) mult=0.05;
        udmg = Math.floor((taken+bar)/mult);
    } else {
        udmg = parseNum(document.getElementById('inpUDmg').value);
    }
    updateTimelineEvent(t, name, type, target, udmg, 0);
    renderTimelineRange(t, t);
    closeModal('modalEvent');
};
window.deleteEvent = () => { updateTimelineEvent(editing.sec, "", "", "", 0, 0); renderTimelineRange(editing.sec, editing.sec); closeModal('modalEvent'); };

window.setRadio = (grp, val) => {
    document.getElementById('val'+grp.charAt(0).toUpperCase()+grp.slice(1)).value = val;
    const p = document.getElementById('grp'+grp.charAt(0).toUpperCase()+grp.slice(1));
    Array.from(p.children).forEach(c => { if(c.dataset.val===val) c.classList.add('selected'); else c.classList.remove('selected'); });
};
window.toggleCalcMode = () => {
    const on = document.getElementById('modeSwitch').checked;
    document.getElementById('secDirect').style.display = on ? 'none' : 'block';
    document.getElementById('secCalc').style.display = on ? 'block' : 'none';
};

window.generateCalcList = () => {
    const con = document.getElementById('calcMitiGrid'); con.innerHTML = '';
    const list = [];
    JOB_ORDER.forEach(j => {
        if(!currentParty.some(p=>p.job===j)) return;
        const role = roleMap[j];
        const skills = (jobSkills[j]||[]).concat(jobSkills[`Common_${role}`]||[]);
        skills.forEach(sk => {
            const db = skillDB[sk];
            if(db && (db.m>0 || db.m_phys>0)) {
                if(role==='Tank' && db.scope==='self') list.push({role:'TankSelf', name:sk});
                else list.push({role:role, name:sk});
            }
        });
    });
    const rOrder = {Tank:1, Healer:2, Melee:3, Range:4, Caster:5, TankSelf:6};
    list.sort((a,b)=>rOrder[a.role]-rOrder[b.role]);
    const unique = []; const seen = new Set();
    list.forEach(i=>{ if(!seen.has(i.name)) { seen.add(i.name); unique.push(i); }});
    unique.forEach(o => {
        const div = document.createElement('div'); div.className='miti-icon-btn';
        if(selectedCalcMitis.has(o.role+'|'+o.name)) div.classList.add('active');
        div.innerHTML = `<img src="./icons/${o.name}.png" style="width:100%;height:100%">`;
        div.onclick = () => {
            const k = o.role+'|'+o.name;
            if(selectedCalcMitis.has(k)) { selectedCalcMitis.delete(k); div.classList.remove('active'); }
            else { selectedCalcMitis.add(k); div.classList.add('active'); }
        };
        con.appendChild(div);
    });
};
window.updateCalcGrid = () => { /* Inline update */ };

// Skill Modal
window.openSkill = (t, m, e) => {
    editing.sec = t; editing.mem = m;
    const job = currentParty[m].job;
    const role = roleMap[job];
    const win = document.getElementById('skillWin');
    if(e) {
        let top = e.clientY - 20; let left = e.clientX + 20;
        if(top+300 > window.innerHeight) top = window.innerHeight - 300;
        if(left+250 > window.innerWidth) left = e.clientX - 250;
        win.style.top = top+'px'; win.style.left = left+'px'; win.style.margin = '0';
    }
    document.getElementById('skillTitle').innerText = job;
    const con = document.getElementById('skillContainer'); con.innerHTML = '';
    
    let list = (jobSkills[job]||[]).concat(jobSkills[`Common_${role}`]||[]);
    
    if(role==='Tank') {
        const p=[], s=[];
        list.forEach(sk=>{ const db=skillDB[sk]; if(db && db.scope==='party') p.push(sk); else s.push(sk); });
        
        const d1 = document.createElement('div'); d1.className='skill-section'; d1.innerHTML='<div class="skill-section-title">Party</div><div class="skill-list"></div>';
        p.forEach(sk=>appendSkillBtn(d1.lastChild, sk)); con.appendChild(d1);
        
        const d2 = document.createElement('div'); d2.className='skill-section'; d2.innerHTML='<div class="skill-section-title">Self / Target</div><div class="skill-list"></div>';
        s.forEach(sk=>appendSkillBtn(d2.lastChild, sk)); con.appendChild(d2);
    } else {
        const d = document.createElement('div'); d.className='skill-list';
        list.forEach(sk => appendSkillBtn(d, sk)); con.appendChild(d);
    }
    openModal('modalSkill');
};
window.appendSkillBtn = (parent, sk) => {
    const div = document.createElement('div'); div.className='skill-btn';
    if(timelineData[editing.sec].skills[editing.mem].includes(sk)) div.classList.add('selected');
    div.innerHTML = `<img src="./icons/${sk}.png">`;
    div.onclick = () => {
        const arr = timelineData[editing.sec].skills[editing.mem];
        const idx = arr.indexOf(sk);
        if(idx > -1) arr.splice(idx, 1); else arr.push(sk);
        renderTimelineRange(0, 1200); closeModal('modalSkill');
    };
    parent.appendChild(div);
};
window.clearCell = () => { timelineData[editing.sec].skills[editing.mem] = []; renderTimelineRange(0, 1200); closeModal('modalSkill'); };

// Party Config
window.openPartySettings = () => {
    renderPartyConfigUI();
    openModal('modalParty');
};
window.renderPartyConfigUI = () => {
    const mt = document.getElementById('mtSlots'); const st = document.getElementById('stSlots');
    mt.innerHTML=''; st.innerHTML='';
    for(let i=0; i<4; i++) {
        const d = document.createElement('div'); d.className='p-slot';
        d.innerHTML = `<img src="./icons/${currentParty[i].job}.png"><div class="p-role">${currentParty[i].role}</div>`;
        d.onclick = () => openJobSelect(i);
        mt.appendChild(d);
    }
    for(let i=4; i<8; i++) {
        const d = document.createElement('div'); d.className='p-slot';
        d.innerHTML = `<img src="./icons/${currentParty[i].job}.png"><div class="p-role">${currentParty[i].role}</div>`;
        d.onclick = () => openJobSelect(i);
        st.appendChild(d);
    }
};
window.openJobSelect = (idx) => {
    editing.slot = idx;
    const con = document.getElementById('jobGrid'); con.innerHTML = '';
    ROLE_GROUPS.forEach(g => {
        const row = document.createElement('div'); row.className='job-select-row';
        row.innerHTML = `<div class="job-role-label">${g.name}</div>`;
        g.jobs.forEach(j => {
            const btn = document.createElement('div'); btn.className='job-sel-btn';
            btn.innerHTML = `<img src="./icons/${j}.png">`;
            btn.onclick = () => {
                currentParty[editing.slot].job = j;
                currentParty[editing.slot].role = g.name;
                closeModal('modalJob');
                openPartySettings(); renderHeader(); renderTimelineRange(0, 1200);
            };
            row.appendChild(btn);
        });
        con.appendChild(row);
    });
    openModal('modalJob');
};
window.savePartyConfig = () => { 
    hpSettings.tank = parseNum(document.getElementById('hpTank').value); 
    hpSettings.other = parseNum(document.getElementById('hpOther').value); 
    closeModal('modalParty'); renderTimelineRange(0, 1200); 
};

// Stats & Phase
window.openStatsModal = () => { openModal('modalStats'); };
window.saveStats = () => {
    playerStats.MAIN = parseNum(document.getElementById('sMain').value);
    playerStats.WD = parseNum(document.getElementById('sWD').value);
    playerStats.DET = parseNum(document.getElementById('sDet').value);
    playerStats.TNC = parseNum(document.getElementById('sTnc').value);
    closeModal('modalStats'); renderTimelineRange(0, 1200);
};
window.openPhase = (t) => { editing.sec = t; document.getElementById('inpPhase').value=""; openModal('modalPhase'); document.getElementById('inpPhase').focus(); };
window.savePhase = () => {
    const n = document.getElementById('inpPhase').value;
    if(n) { 
        phases = phases.filter(p=>p.endSeconds!==editing.sec);
        phases.push({name:n, endSeconds:editing.sec});
        phases.sort((a,b)=>a.endSeconds-b.endSeconds);
    }
    closeModal('modalPhase'); renderTimelineRange(0, 1200);
};