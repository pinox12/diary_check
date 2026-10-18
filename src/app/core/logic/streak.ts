/**
 * Rachas: periodos consecutivos con la misión completada.
 *
 * El periodo en curso nunca rompe la racha: si hoy todavía no la has marcado,
 * se cuenta a partir de ayer (así la racha no "desaparece" durante el día).
 */
import type { MissionType } from '../models/models';
import { periodOrdinal, previousPeriodKey } from './period-keys';

export interface StreakSummary {
  current: number;
  longest: number;
  total: number;
}

export function currentStreak(keys: Set<string>, type: MissionType, currentKey: string): number {
  let cursor = keys.has(currentKey) ? currentKey : previousPeriodKey(type, currentKey);
  let count = 0;
  // Guarda contra datos corruptos que provocarían un bucle infinito.
  const limit = 5000;
  while (keys.has(cursor) && count < limit) {
    count += 1;
    cursor = previousPeriodKey(type, cursor);
  }
  return count;
}

export function longestStreak(keys: Set<string>, type: MissionType): number {
  if (keys.size === 0) return 0;
  const ordinals = [...keys].map((key) => periodOrdinal(type, key)).sort((a, b) => a - b);
  const step = type === 'daily' ? 1 : 7;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < ordinals.length; i += 1) {
    const diff = ordinals[i]! - ordinals[i - 1]!;
    if (diff === step) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (diff > step) {
      run = 1;
    }
  }
  return longest;
}

export function streakSummary(keys: Set<string>, type: MissionType, currentKey: string): StreakSummary {
  return {
    current: currentStreak(keys, type, currentKey),
    longest: longestStreak(keys, type),
    total: keys.size,
  };
}
