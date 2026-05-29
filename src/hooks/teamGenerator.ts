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
  legendaryMythicalSlots: number;
  megaSlots: number;
  dynamaxSlots: number;
  customSlots: number;
}

export const DEFAULT_CONSTRAINTS: GeneratorConstraints = {
  starterSlots: 0,
  legendaryMythicalSlots: 0,
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

function isLegendaryOrMythical(entry: PokemonEntry): boolean {
  return entry.isLegendary === true || entry.isMythical === true;
}

function isMegaOrDynamax(entry: PokemonEntry): boolean {
  const name = entry.name.toLowerCase();
  return name.includes('-mega') || name.includes('-gmax');
}

function isMega(entry: PokemonEntry): boolean {
  return entry.name.toLowerCase().includes('-mega');
}

function isDynamax(entry: PokemonEntry): boolean {
  return entry.name.toLowerCase().includes('-gmax');
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
 * When a category has slots > 0, those Pokémon are included in the pool.
 * When slots = 0, those Pokémon are excluded from the pool.
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
    pool = pool.filter((p) => !isMega(p));
  } else if (constraints.dynamaxSlots <= 0) {
    pool = pool.filter((p) => !isDynamax(p));
  }

  // Filter legendaries/mythicals: include only if slots > 0
  if (constraints.legendaryMythicalSlots <= 0) {
    pool = pool.filter((p) => !isLegendaryOrMythical(p));
  }

  return pool;
}

/**
 * Generate a team using the greedy coverage-maximizing algorithm.
 * Enforces "exactly N" semantics for each constrained category:
 * reserved slots are filled first from the category sub-pool,
 * then free slots are filled from the unconstrained pool.
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

  // Count how many constrained slots are already satisfied by locked members
  let legendaryMythicalCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? isLegendaryOrMythical(entry) : false;
  }).length;
  let starterCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? isStarter(entry) : false;
  }).length;
  let megaCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? isMega(entry) : false;
  }).length;
  let dynamaxCount = team.filter((m) => {
    const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
    return entry ? isDynamax(entry) : false;
  }).length;

  // Determine how many constrained slots remain to fill for each category
  let starterSlotsRemaining = Math.max(0, constraints.starterSlots - starterCount);
  let legendaryMythicalSlotsRemaining = Math.max(0, constraints.legendaryMythicalSlots - legendaryMythicalCount);
  let megaSlotsRemaining = Math.max(0, constraints.megaSlots - megaCount);
  let dynamaxSlotsRemaining = Math.max(0, constraints.dynamaxSlots - dynamaxCount);

  // Fill constrained slots first, then free slots
  for (let slot = 0; slot < slotsToFill; slot++) {
    let candidatePool: PokemonEntry[];

    if (legendaryMythicalSlotsRemaining > 0) {
      // Fill legendary/mythical reserved slots
      candidatePool = pool.filter((p) => isLegendaryOrMythical(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      legendaryMythicalSlotsRemaining--;
    } else if (starterSlotsRemaining > 0) {
      // Fill starter reserved slots
      candidatePool = pool.filter((p) => isStarter(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      starterSlotsRemaining--;
    } else if (megaSlotsRemaining > 0) {
      // Fill mega reserved slots
      candidatePool = pool.filter((p) => isMega(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      megaSlotsRemaining--;
    } else if (dynamaxSlotsRemaining > 0) {
      // Fill dynamax reserved slots
      candidatePool = pool.filter((p) => isDynamax(p) && !usedSpecies.has(p.displayName.toLowerCase()));
      dynamaxSlotsRemaining--;
    } else {
      // Free slot: no category constraint, but enforce caps
      candidatePool = pool.filter((p) => !usedSpecies.has(p.displayName.toLowerCase()));

      // Exclude legendary/mythical if their quota is already met
      if (constraints.legendaryMythicalSlots > 0 && legendaryMythicalCount >= constraints.legendaryMythicalSlots) {
        candidatePool = candidatePool.filter((p) => !isLegendaryOrMythical(p));
      }
      // Exclude starters if their quota is already met
      if (constraints.starterSlots > 0 && starterCount >= constraints.starterSlots) {
        candidatePool = candidatePool.filter((p) => !isStarter(p));
      }
      // Enforce mega cap
      if (constraints.megaSlots > 0 && megaCount >= constraints.megaSlots) {
        candidatePool = candidatePool.filter((p) => !isMega(p));
      }
      // Enforce dynamax cap
      if (constraints.dynamaxSlots > 0 && dynamaxCount >= constraints.dynamaxSlots) {
        candidatePool = candidatePool.filter((p) => !isDynamax(p));
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
    if (isLegendaryOrMythical(best.entry)) legendaryMythicalCount++;
    if (isStarter(best.entry)) starterCount++;
    if (isMega(best.entry)) megaCount++;
    if (isDynamax(best.entry)) dynamaxCount++;
  }

  return { team };
}

/**
 * Regenerate a single slot in an existing proposed team.
 * Picks randomly among the top 5 scoring candidates.
 * The pool excludes only Pokémon occupying the other 5 slots.
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

  // Enforce quotas based on the other members
  if (constraints.legendaryMythicalSlots > 0) {
    const legendaryMythicalCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry ? isLegendaryOrMythical(entry) : false;
    }).length;
    if (legendaryMythicalCount >= constraints.legendaryMythicalSlots) {
      candidatePool = candidatePool.filter((p) => !isLegendaryOrMythical(p));
    }
  }
  if (constraints.starterSlots > 0) {
    const starterCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry ? isStarter(entry) : false;
    }).length;
    if (starterCount >= constraints.starterSlots) {
      candidatePool = candidatePool.filter((p) => !isStarter(p));
    }
  }
  if (constraints.megaSlots > 0) {
    const megaCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry ? isMega(entry) : false;
    }).length;
    if (megaCount >= constraints.megaSlots) {
      candidatePool = candidatePool.filter((p) => !isMega(p));
    }
  }
  if (constraints.dynamaxSlots > 0) {
    const dynamaxCount = otherMembers.filter((m) => {
      const entry = allPokemon.find((p) => p.displayName === m.speciesName || p.name === m.speciesName.toLowerCase());
      return entry ? isDynamax(entry) : false;
    }).length;
    if (dynamaxCount >= constraints.dynamaxSlots) {
      candidatePool = candidatePool.filter((p) => !isDynamax(p));
    }
  }

  if (candidatePool.length === 0) {
    console.error(`regenerateSlot: empty candidate pool for slot ${slotIndex}. No alternatives found.`);
    return currentTeam[slotIndex];
  }

  const scored = candidatePool.map((entry) => {
    const member = memberFromEntry(entry);
    const score = computeScore(chart, member, otherMembers);
    return { entry, member, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick randomly among top 5 (or fewer if pool is small)
  const topN = Math.min(5, scored.length);
  const picked = scored[Math.floor(Math.random() * topN)];

  return {
    ...picked.member,
    ability: picked.entry.defaultAbility,
  };
}
