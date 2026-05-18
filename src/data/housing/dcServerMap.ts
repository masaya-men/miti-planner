export type Region = 'JP' | 'NA' | 'EU' | 'OCE';

export interface DCServers {
    region: Region;
    servers: string[];
}

export const DC_SERVER_MAP: Record<string, DCServers> = {
    Elemental: { region: 'JP', servers: ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'] },
    Gaia: { region: 'JP', servers: ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'] },
    Mana: { region: 'JP', servers: ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'] },
    Meteor: { region: 'JP', servers: ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'] },
    Aether: { region: 'NA', servers: ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren'] },
    Primal: { region: 'NA', servers: ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros'] },
    Crystal: { region: 'NA', servers: ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera'] },
    Dynamis: { region: 'NA', servers: ['Halicarnassus', 'Maduin', 'Marilith', 'Seraph'] },
    Chaos: { region: 'EU', servers: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
    Light: { region: 'EU', servers: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
    Materia: { region: 'OCE', servers: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'] },
};

export const ALL_DCS: string[] = Object.keys(DC_SERVER_MAP);
export const ALL_REGIONS: Region[] = ['JP', 'NA', 'EU', 'OCE'];

export function dcsForRegion(region: Region): string[] {
    return ALL_DCS.filter((dc) => DC_SERVER_MAP[dc].region === region);
}

export function serversForDC(dc: string): string[] {
    return DC_SERVER_MAP[dc]?.servers ?? [];
}

export function regionForDC(dc: string): Region | null {
    return DC_SERVER_MAP[dc]?.region ?? null;
}
