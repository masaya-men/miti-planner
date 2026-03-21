import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const zones = JSON.parse(readFileSync('./tmp_encounters.json', 'utf8'));
const contentsObj = JSON.parse(readFileSync('./src/data/contents.json', 'utf8'));

// Helper to find encounter ID by name substring
function findId(zoneName, encNameOrContains, returnSecond = false) {
    const zone = zones.find(z => z.name.includes(zoneName));
    if (!zone) return null;
    let matches = zone.encounters.filter(e => e.name.toLowerCase().includes(encNameOrContains.toLowerCase()));
    if (matches.length === 0) {
        // Fallback exact matching or index
        if (typeof encNameOrContains === 'number') {
            matches = [zone.encounters[encNameOrContains]];
        }
    }
    if (matches.length === 0) return null;
    return returnSecond && matches.length > 1 ? matches[1].id : matches[0].id;
}

const map = {
    // AAC Light-Heavyweight
    "m1s": findId("AAC Light-Heavyweight", "Black Cat"),
    "m2s": findId("AAC Light-Heavyweight", "Honey B"),
    "m3s": findId("AAC Light-Heavyweight", "Brute Bomber"),
    "m4s": findId("AAC Light-Heavyweight", "Wicked Thunder"),
    // Anabaseios
    "p9s": findId("Anabaseios", "Kokytos"),
    "p10s": findId("Anabaseios", "Pandaemonium"),
    "p11s": findId("Anabaseios", "Themis"),
    "p12s_p1": findId("Anabaseios", "Athena"),
    "p12s_p2": findId("Anabaseios", "Pallas Athena"),
    // Abyssos
    "p5s": findId("Abyssos", "Proto-Carbuncle"),
    "p6s": findId("Abyssos", "Hegemone"),
    "p7s": findId("Abyssos", "Agdistis"),
    "p8s_p1": findId("Abyssos", "Hephaistos"),
    "p8s_p2": findId("Abyssos", "Hephaistos II"),
    // Asphodelos
    "p1s": findId("Asphodelos", "Erichthonios"),
    "p2s": findId("Asphodelos", "Hippokampos"),
    "p3s": findId("Asphodelos", "Phoinix"),
    "p4s_p1": findId("Asphodelos", "Hesperos", false),
    "p4s_p2": findId("Asphodelos", "Hesperos II", false) || findId("Asphodelos", "Hesperos", true),
    
    // Ultimates
    "tea": findId("Ultimates (Legacy)", "Alexander") || findId("Ultimates", "Alexander"),
    "ucob": findId("Ultimates (Legacy)", "Bahamut") || findId("Ultimates", "Bahamut"),
    "uwu": findId("Ultimates (Legacy)", "Weapon") || findId("Ultimates", "Weapon"),
    "dsr": findId("Ultimates (Legacy)", "Dragonsong") || findId("Ultimates", "Dragonsong"),
    "top": findId("Ultimates (Legacy)", "Omega Protocol") || findId("Ultimates", "Omega"),
    "fru": findId("Ultimates", "Futures Rewritten") || findId("Futures Rewritten", "Futures Rewritten"),
};

// Add Eden and Omega by index
const edenPromise = zones.find(z => z.name.includes("Eden's Promise"));
if (edenPromise) {
    map["e9s"] = edenPromise.encounters[0].id;
    map["e10s"] = edenPromise.encounters[1].id;
    map["e11s"] = edenPromise.encounters[2].id;
    map["e12s_p1"] = edenPromise.encounters[3].id;
    map["e12s_p2"] = edenPromise.encounters[4].id;
}
const edenVerse = zones.find(z => z.name.includes("Eden's Verse"));
if (edenVerse) {
    map["e5s"] = edenVerse.encounters[0].id;
    map["e6s"] = edenVerse.encounters[1].id;
    map["e7s"] = edenVerse.encounters[2].id;
    map["e8s"] = edenVerse.encounters[3].id;
}
const edenGate = zones.find(z => z.name.includes("Eden's Gate"));
if (edenGate) {
    map["e1s"] = edenGate.encounters[0].id;
    map["e2s"] = edenGate.encounters[1].id;
    map["e3s"] = edenGate.encounters[2].id;
    map["e4s"] = edenGate.encounters[3].id;
}
const alphascape = zones.find(z => z.name.includes("Alphascape"));
if (alphascape) {
    map["o9s"] = alphascape.encounters[0].id;
    map["o10s"] = alphascape.encounters[1].id;
    map["o11s"] = alphascape.encounters[2].id;
    map["o12s_p1"] = alphascape.encounters[3].id;
    map["o12s_p2"] = alphascape.encounters[4].id;
}
const sigmascape = zones.find(z => z.name.includes("Sigmascape"));
if (sigmascape) {
    map["o5s"] = sigmascape.encounters[0].id;
    map["o6s"] = sigmascape.encounters[1].id;
    map["o7s"] = sigmascape.encounters[2].id;
    map["o8s_p1"] = sigmascape.encounters[3].id;
    map["o8s_p2"] = sigmascape.encounters[4].id;
}
const deltascape = zones.find(z => z.name.includes("Deltascape"));
if (deltascape) {
    map["o1s"] = deltascape.encounters[0].id;
    map["o2s"] = deltascape.encounters[1].id;
    map["o3s"] = deltascape.encounters[2].id;
    map["o4s_p1"] = deltascape.encounters[3].id;
    map["o4s_p2"] = deltascape.encounters[4].id;
}

let modified = 0;
for (const content of contentsObj) {
    if (map[content.id] !== undefined && map[content.id] !== null) {
        content.fflogsEncounterId = map[content.id];
        modified++;
    }
}

writeFileSync('./src/data/contents.json', JSON.stringify(contentsObj, null, 2) + '\n');
console.log('Modified', modified, 'entries in contents.json');
