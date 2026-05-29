import {
  PokemonEntry,
  PokemonType,
  POKEMON_TYPES,
  TeamMember,
  TypeChart,
} from '../types';
import { offensiveCoverageForMember, defensiveMultiplier } from '../utils/coverageEngine';
import { memberFromEntry } from './suggestionEngine';
import { resolveSpriteUrl } from '../utils/spriteUtils';

/**
 * Hardcoded list of final-evolution starters per generation (Grass/Fire/Water).
 * These are the base species names (lowercase) of final evolutions.
 */
export const STARTER_FINALS: Record<number, string[]> = {
  1: ['venusaur', 'charizard', 'blastoise'],
  2: ['meganium', 'typhlosion', 'feraligatr'],
  3: ['sceptile', 'blaziken', 'swampert'],
  4: ['torterra', 'infernape', 'empoleon'],
  5: ['serperior', 'emboar', 'samurott'],
  6: ['chesnaught', 'delphox', 'greninja'],
  7: ['decidueye', 'incineroar', 'primarina'],
  8: ['rillaboom', 'cinderace', 'inteleon'],
  9: ['meowscarada', 'skeledirge', 'quaquaval'],
};

const ALL_STARTER_SPECIES = new Set(Object.values(STARTER_FINALS).flat());

export interface GeneratorConstraints {
  starterSlots: number;
  legendarySlots: number;
  mythicalSlots: number;
  megaSlots: number;
  dynamaxSlots: number;
  customSlots: number;
}

export const DEFAULT_CONSTRAINTS: GeneratorConstraints = {
  starterSlots: 0,
  legendarySlots: 0,
  mythicalSlots: 0,
  megaSlots: 0,
  dynamaxSlots: 0,
  customSlots: 0,
};

export interface GeneratorResult {
  team: TeamMember[];
  warning?: string;
}

function isStarter(entry: PokemonEntry): boolean {
  return ALL_STARTER_SPECIES.has(entry.speciesName);
}

function isMegaOrDynamax(entry: PokemonEntry): boolean {
  const name = entry.name.toLowerCase();
  return name.includes('-mega') || name.includes('-gmax');
}

/**
 * Get types a Pokémon is weak to (>1x multiplier).
 */
function getWeaknesses(chart: TypeChart, types: [PokemonType, PokemonType | null]): PokemonType[] {
  const result: PokemonType[] = [];
  for (const atk of POKEMON_TYPES) {
    if (defensiveMultiplier(chart, atk, types) > 1) {
      result.push(atk);
    }
  }
  return result;
}

/**
 * Compute composite score for a candidate relative to the current team state.
 * Same formula as the suggestion engine:
 *   gain - 0.5×new_weaknesses - 1.0×aggravated_shared_weaknesses
 * Plus a small random factor for tie-breaking.
 */
function computeScore(
  chart: TypeChart,
  candidate: TeamMember,
  currentTeam: TeamMember[],
): number {
  // Compute current team coverage
  const currentCov = new Set<PokemonType>();
  for (const m of currentTeam) {
    offensiveCoverageForMember(chart, m, false).forEach((t) => currentCov.add(t));
  }

  // Candidate coverage
  const candCov = offensiveCoverageForMember(chart, candidate, false);
  const newUnion = new Set<PokemonType>(currentCov);
  candCov.forEach((t) => newUnion.add(t));
  const gain = newUnion.size - currentCov.size;

  // Defensive analysis
  const candWeaknesses = getWeaknesses(chart, candidate.types);
  const otherWeaknesses = new Map<PokemonType, number>();
  for (const m of currentTeam) {
    for (const w of getWeaknesses(chart, m.types)) {
      otherWeaknesses.set(w, (otherWeaknesses.get(w) ?? 0) + 1);
    }
  }

  let newWeaknesses = 0;
  let aggravated = 0;
  for (const w of candWeaknesses) {
    if ((otherWeaknesses.get(w) ?? 0) > 0) {
      aggravated++;
    } else {
      newWeaknesses++;
    }
  }

  const compositeScore = gain - 0.5 * newWeaknesses - 1.0 * aggravated;
  // Small random tie-breaking factor
  const noise = (Math.random() - 0.5) * 0.02;
  return compositeScore + noise;
}

/**
 * Build a filtered pool of eligible Pokémon from the full list.
 */
export function buildEligiblePool(
  allPokemon: PokemonEntry[],
  customs: TeamMember[],
  constraints: GeneratorConstraints,
): PokemonEntry[] {
  let pool = allPokemon.filter((p) => p.isFinalEvolution);

  // Filter Mega / Dynamax: include only if slots > 0
  if (constraints.megaSlots <= 0 && constraints.dynamaxSlots <= 0) {
    pool = pool.filter((p) => !isMegaOrDynamax(p));
  } else if (constraints.megaSlots <= 0) {
    pool = pool.filter((p) => !p.name.toLowerCase().includes('-mega'));
  } else if (constraints.dynamaxSlots <= 0) {
    pool = pool.filter((p) => !p.name.toLowerCase().includes('-gmax'));
  }

  // Filter legendaries: include only if slots > 0
  if (constraints.legendarySlots <= 0) {
    pool = pool.filter((p) => !p.isLegendary);
  }

  // Filter mythicals: include only if slots > 0
  if (constraints.mythicalSlots <= 0) {
    pool = pool.filter((p) => !p.isMythical);
  }

  return pool;
}

/**
 * Generate a team using the greedy coverage-maximizing algorithm.
 */
export function generateTeam(
  chart: TypeChart,
  allPokemon: PokemonEntry[],
  customs: TeamMember[],
  lockedMembers: TeamMember[],
  constraints: GeneratorConstraints,
): GeneratorResult {
  const pool = buildEligiblePool(allPokemon, customs, constraints);
  const slotsToFill = 6 - lockedMembers.length;
  if (slotsToFill <= 0) {
    return { team: lockedMembers.slice(0, 6) };
  }

  const team = [...lockedMembers];
  const usedSpecies = new Set(team.map((m) => m.speciesName.toLowerCase()));

  // Track quotas already used by locked members
  let legendaryCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry?.isLegendary;
  }).length;
  let mythicalCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry?.isMythical;
  }).length;
  let starterCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? isStarter(entry) : false;
  }).length;
  let megaCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? entry.name.toLowerCase().includes('-mega') : false;
  }).length;
  let dynamaxCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? entry.name.toLowerCase().includes('-gmax') : false;
  }).length;

  // Determine how many constrained slots to fill for each category
  let starterSlotsRemaining = Math.max(0, constraints.starterSlots - starterCount);

  for (let slot = 0; slot < slotsToFill; slot++) {
    let candidatePool: PokemonEntry[];

    // If we need to fill starter slots first
    if (starterSlotsRemaining > 0) {
      candidatePool = pool.filter((p) => isStarter(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      starterSlotsRemaining--;
    } else {
      candidatePool = pool.filter((p) => !usedSpecies.has(p.displayName.toLowerCase()));

      // Enforce legendary cap
      if (constraints.legendarySlots > 0 && legendaryCount >= constraints.legendarySlots) {
        candidatePool = candidatePool.filter((p) => !p.isLegendary);
      }
      // Enforce mythical cap
      if (constraints.mythicalSlots > 0 && mythicalCount >= constraints.mythicalSlots) {
        candidatePool = candidatePool.filter((p) => !p.isMythical);
      }
      // Enforce mega cap
      if (constraints.megaSlots > 0 && megaCount >= constraints.megaSlots) {
        candidatePool = candidatePool.filter((p) => !p.name.toLowerCase().includes('-mega'));
      }
      // Enforce dynamax cap
      if (constraints.dynamaxSlots > 0 && dynamaxCount >= constraints.dynamaxSlots) {
        candidatePool = candidatePool.filter((p) => !p.name.toLowerCase().includes('-gmax'));
      }
    }

    if (candidatePool.length === 0) {
      return {
        team,
        warning: 'tooFewPokemon',
      };
    }

    // Score each candidate
    const scored = candidatePool.map((entry) => {
      const member = memberFromEntry(entry);
      const score = computeScore(chart, member, team);
      return { entry, member, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const newMember: TeamMember = {
      ...best.member,
      ability: best.entry.defaultAbility,
    };
    team.push(newMember);
    usedSpecies.add(best.entry.displayName.toLowerCase());

    // Update quotas
    if (best.entry.isLegendary) legendaryCount++;
    if (best.entry.isMythical) mythicalCount++;
    if (best.entry.name.toLowerCase().includes('-mega')) megaCount++;
    if (best.entry.name.toLowerCase().includes('-gmax')) dynamaxCount++;
  }

  return { team };
}

/**
 * Regenerate a single slot in an existing proposed team.
 */
export function regenerateSlot(
  chart: TypeChart,
  allPokemon: PokemonEntry[],
  customs: TeamMember[],
  currentTeam: TeamMember[],
  slotIndex: number,
  constraints: GeneratorConstraints,
): TeamMember {
  const otherMembers = currentTeam.filter((_, i) => i !== slotIndex);
  const pool = buildEligiblePool(allPokemon, customs, constraints);
  const usedSpecies = new Set(otherMembers.map((m) => m.speciesName.toLowerCase()));

  let candidatePool = pool.filter((p) => !usedSpecies.has(p.displayName.toLowerCase()));

  // Enforce quotas on the other members
  if (constraints.legendarySlots > 0) {
    const legendaryCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry?.isLegendary;
    }).length;
    if (legendaryCount >= constraints.legendarySlots) {
      candidatePool = candidatePool.filter((p) => !p.isLegendary);
    }
  }
  if (constraints.mythicalSlots > 0) {
    const mythicalCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry?.isMythical;
    }).length;
    if (mythicalCount >= constraints.mythicalSlots) {
      candidatePool = candidatePool.filter((p) => !p.isMythical);
    }
  }

  if (candidatePool.length === 0) {
    // Fallback: return the existing member
    return currentTeam[slotIndex];
  }

  const scored = candidatePool.map((entry) => {
    const member = memberFromEntry(entry);
    const score = computeScore(chart, member, otherMembers);
    return { entry, member, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    ...best.member,
    ability: best.entry.defaultAbility,
  };
}
