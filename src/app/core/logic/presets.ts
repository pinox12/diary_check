/**
 * Reglas de reset predefinidas de juegos gacha populares.
 *
 * Son solo un punto de partida editable: cada servidor (EU/NA/Asia) tiene su
 * propia hora, así que al elegir un preset se puede ajustar la hora y el día.
 */
export interface GamePreset {
  name: string;
  aliases?: string[];
  accentColor: string;
  dailyResetTime: string;
  weeklyResetDay: number;
  weeklyResetTime: string;
  note?: string;
}

export const GAME_PRESETS: readonly GamePreset[] = [
  {
    name: 'Genshin Impact',
    accentColor: '#7c5cff',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
    note: '04:00 de la hora de tu servidor. Las semanales reinician los lunes.',
  },
  {
    name: 'Honkai: Star Rail',
    accentColor: '#38bdf8',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Zenless Zone Zero',
    accentColor: '#fbbf24',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Honkai Impact 3rd',
    accentColor: '#a78bfa',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Wuthering Waves',
    accentColor: '#22d3ee',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Punishing: Gray Raven',
    accentColor: '#f87171',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Blue Archive',
    accentColor: '#38bdf8',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Arknights',
    accentColor: '#a3e635',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Arknights: Endfield',
    accentColor: '#e5e7eb',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Azur Lane',
    accentColor: '#38bdf8',
    dailyResetTime: '00:00',
    weeklyResetDay: 1,
    weeklyResetTime: '00:00',
  },
  {
    name: 'Goddess of Victory: Nikke',
    aliases: ['Nikke'],
    accentColor: '#f472b6',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
    note: 'Ajusta la hora según tu servidor (JP/KR/NA/SEA).',
  },
  {
    name: 'Fate/Grand Order',
    aliases: ['FGO'],
    accentColor: '#fbbf24',
    dailyResetTime: '20:00',
    weeklyResetDay: 1,
    weeklyResetTime: '20:00',
    note: 'Servidor NA: reset a las 20:00 (PT). En JP es a las 04:00.',
  },
  {
    name: 'Epic Seven',
    accentColor: '#f87171',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Brown Dust 2',
    accentColor: '#fb923c',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Umamusume: Pretty Derby',
    aliases: ['Uma Musume'],
    accentColor: '#f472b6',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Reverse: 1999',
    accentColor: '#a78bfa',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: "Girls' Frontline 2: Exilium",
    aliases: ['GFL2'],
    accentColor: '#34d399',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Limbus Company',
    accentColor: '#f87171',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Snowbreak: Containment Zone',
    accentColor: '#22d3ee',
    dailyResetTime: '04:00',
    weeklyResetDay: 1,
    weeklyResetTime: '04:00',
  },
  {
    name: 'Tower of Fantasy',
    accentColor: '#7c5cff',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Aether Gazer',
    accentColor: '#38bdf8',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Path to Nowhere',
    accentColor: '#fb923c',
    dailyResetTime: '05:00',
    weeklyResetDay: 1,
    weeklyResetTime: '05:00',
  },
  {
    name: 'Fire Emblem Heroes',
    accentColor: '#fbbf24',
    dailyResetTime: '00:00',
    weeklyResetDay: 1,
    weeklyResetTime: '00:00',
    note: 'Servidor NA: reset a las 00:00 (PT).',
  },
  {
    name: 'Dragon Ball Legends',
    accentColor: '#fb923c',
    dailyResetTime: '00:00',
    weeklyResetDay: 1,
    weeklyResetTime: '00:00',
  },
  {
    name: 'Pokémon Masters EX',
    accentColor: '#fbbf24',
    dailyResetTime: '00:00',
    weeklyResetDay: 1,
    weeklyResetTime: '00:00',
  },
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Presets que encajan con lo que el usuario está escribiendo. */
export function findPresets(query: string, limit = 6): GamePreset[] {
  const needle = normalize(query);
  if (needle.length < 2) return [];
  const scored = GAME_PRESETS.map((preset) => {
    const haystacks = [preset.name, ...(preset.aliases ?? [])].map(normalize);
    let score = 0;
    for (const haystack of haystacks) {
      if (haystack === needle) score = Math.max(score, 100);
      else if (haystack.startsWith(needle)) score = Math.max(score, 80);
      else if (haystack.includes(needle)) score = Math.max(score, 60);
      else if (needle.includes(haystack)) score = Math.max(score, 40);
    }
    return { preset, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((entry) => entry.preset);
}
