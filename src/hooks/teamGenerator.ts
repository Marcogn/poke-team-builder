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
  includeStarters: boolean;
  starterSlots: number;
  includeLegendaries: boolean;
  maxLegendaries: number;
  includeMythicals: boolean;
  maxMythicals: number;
  includeMega: boolean;
  includeDynamax: boolean;
  includeCustom: boolean;
}

export const DEFAULT_CONSTRAINTS: GeneratorConstraints = {
  includeStarters: false,
  starterSlots: 1,
  includeLegendaries: false,
  maxLegendaries: 1,
  includeMythicals: false,
  maxMythicals: 1,
  includeMega: false,
  includeDynamax: false,
  includeCustom: false,
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

  // Filter Mega / Dynamax
  if (!constraints.includeMega && !constraints.includeDynamax) {
    pool = pool.filter((p) => !isMegaOrDynamax(p));
  } else if (!constraints.includeMega) {
    pool = pool.filter((p) => !p.name.toLowerCase().includes('-mega'));
  } else if (!constraints.includeDynamax) {
    pool = pool.filter((p) => !p.name.toLowerCase().includes('-gmax'));
  }

  // Filter legendaries
  if (!constraints.includeLegendaries) {
    pool = pool.filter((p) => !p.isLegendary);
  }

  // Filter mythicals
  if (!constraints.includeMythicals) {
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

  // Track quotas
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

  // Determine how many starter slots to fill
  let starterSlotsRemaining = constraints.includeStarters
    ? Math.max(0, constraints.starterSlots - starterCount)
    : 0;

  for (let slot = 0; slot < slotsToFill; slot++) {
    let candidatePool: PokemonEntry[];

    // If we need to fill starter slots first
    if (starterSlotsRemaining > 0) {
      candidatePool = pool.filter((p) => isStarter(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      starterSlotsRemaining--;
    } else {
      candidatePool = pool.filter((p) => !usedSpecies.has(p.displayName.toLowerCase()));

      // Enforce legendary cap
      if (constraints.includeLegendaries && legendaryCount >= constraints.maxLegendaries) {
        candidatePool = candidatePool.filter((p) => !p.isLegendary);
      }
      // Enforce mythical cap
      if (constraints.includeMythicals && mythicalCount >= constraints.maxMythicals) {
        candidatePool = candidatePool.filter((p) => !p.isMythical);
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
  if (constraints.includeLegendaries) {
    const legendaryCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry?.isLegendary;
    }).length;
    if (legendaryCount >= constraints.maxLegendaries) {
      candidatePool = candidatePool.filter((p) => !p.isLegendary);
    }
  }
  if (constraints.includeMythicals) {
    const mythicalCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry?.isMythical;
    }).length;
    if (mythicalCount >= constraints.maxMythicals) {
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
