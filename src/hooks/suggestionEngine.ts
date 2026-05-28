import {
  PokemonEntry,
  PokemonType,
  POKEMON_TYPES,
  TeamMember,
  TypeChart,
} from '../types';
import { analyseTeam, defensiveMultiplier, offensiveCoverageForMember } from '../utils/coverageEngine';
import { resolveSpriteUrl } from '../utils/spriteUtils';

export interface Suggestion {
  kind: 'add' | 'replace';
  candidate: PokemonEntry | TeamMember;
  candidateLabel: string;
  spriteUrl: string | null;
  types: [PokemonType, PokemonType | null];
  replacesMemberId?: string;
  replacesName?: string;
  newlyCovered: PokemonType[];
  reducedOverlap?: PokemonType[];
  gain: number;
  compositeScore: number;
  newWeaknesses: PokemonType[];
  aggravatedWeaknesses: PokemonType[];
  aggravatedMembers: Map<PokemonType, string[]>;
}

export interface SuggestionOptions {
  includeCustoms: boolean;
  excludeLegendaries?: boolean;
  generation?: string;
}

export function memberFromEntry(e: PokemonEntry): TeamMember {
  return {
    id: 'cand-' + e.id,
    speciesName: e.displayName,
    spriteUrl: resolveSpriteUrl(e, 'card'),
    types: e.types,
    moves: [null, null, null, null],
    isCustomSaved: false,
  };
}

const GEN_RANGES: Record<string, [number, number]> = {
  all: [0, Infinity],
  '1': [1, 151],
  '2': [152, 251],
  '3': [252, 386],
  '4': [387, 493],
  '5': [494, 649],
  '6': [650, 721],
  '7': [722, 809],
  '8': [810, 905],
  '9': [906, Infinity],
};

/**
 * Get types that a Pokémon is weak to (2x or 4x).
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
 * Compute composite score for a candidate replacing a member (or being added).
 */
function computeCompositeScore(
  chart: TypeChart,
  candidate: TeamMember,
  otherMembers: TeamMember[],
  currentTeamCoverage: Set<PokemonType>,
): {
  compositeScore: number;
  offensiveGain: number;
  newlyCovered: PokemonType[];
  newWeaknesses: PokemonType[];
  aggravatedWeaknesses: PokemonType[];
  aggravatedMembers: Map<PokemonType, string[]>;
} {
  const candCov = offensiveCoverageForMember(chart, candidate, false);
  const baseCov = new Set<PokemonType>();
  for (const m of otherMembers) {
    offensiveCoverageForMember(chart, m, false).forEach((t) => baseCov.add(t));
  }

  const newUnion = new Set<PokemonType>(baseCov);
  candCov.forEach((t) => newUnion.add(t));

  const offensiveGain = newUnion.size - currentTeamCoverage.size;
  const newlyCovered: PokemonType[] = [];
  newUnion.forEach((t) => {
    if (!currentTeamCoverage.has(t)) newlyCovered.push(t);
  });

  // Defensive analysis
  const candWeaknesses = getWeaknesses(chart, candidate.types);

  // Weaknesses of other team members
  const otherWeaknessMap = new Map<PokemonType, string[]>();
  for (const m of otherMembers) {
    const mWeaknesses = getWeaknesses(chart, m.types);
    for (const w of mWeaknesses) {
      if (!otherWeaknessMap.has(w)) otherWeaknessMap.set(w, []);
      otherWeaknessMap.get(w)!.push(m.speciesName);
    }
  }

  const newWeaknesses: PokemonType[] = [];
  const aggravatedWeaknesses: PokemonType[] = [];
  const aggravatedMembers = new Map<PokemonType, string[]>();

  for (const w of candWeaknesses) {
    const membersWithSameWeakness = otherWeaknessMap.get(w);
    if (membersWithSameWeakness && membersWithSameWeakness.length > 0) {
      aggravatedWeaknesses.push(w);
      aggravatedMembers.set(w, membersWithSameWeakness);
    } else {
      newWeaknesses.push(w);
    }
  }

  const compositeScore =
    offensiveGain -
    0.5 * newWeaknesses.length -
    1.0 * aggravatedWeaknesses.length;

  return {
    compositeScore,
    offensiveGain,
    newlyCovered,
    newWeaknesses,
    aggravatedWeaknesses,
    aggravatedMembers,
  };
}

/**
 * Pure suggestion ranking.
 */
export function computeSuggestions(
  chart: TypeChart,
  members: TeamMember[],
  pool: PokemonEntry[],
  customs: TeamMember[],
  options: SuggestionOptions,
): Suggestion[] {
  if (pool.length === 0 && (!options.includeCustoms || customs.length === 0)) {
    return [];
  }

  let filtered = pool.filter((p) => p.isFinalEvolution);

  // Generation filter
  if (options.generation && options.generation !== 'all') {
    const range = GEN_RANGES[options.generation];
    if (range) {
      const [min, max] = range;
      filtered = filtered.filter((p) => p.id >= min && p.id <= max);
    }
  }

  if (options.excludeLegendaries) {
    const teamHasLegendary = members.some((m) => {
      const entry = pool.find(
        (p) => p.displayName === m.speciesName || p.name === m.speciesName,
      );
      return entry ? entry.isLegendary || entry.isMythical : false;
    });
    if (!teamHasLegendary) {
      filtered = filtered.filter((p) => !p.isLegendary && !p.isMythical);
    }
  }

  const candidatePool: TeamMember[] = filtered.map(memberFromEntry);
  if (options.includeCustoms) {
    for (const c of customs) candidatePool.push(c);
  }

  // Remove candidates already on team
  const teamSpeciesKeys = new Set(
    members.map((m) => m.speciesName.toLowerCase()),
  );
  const dedupCandidates = candidatePool.filter(
    (c) => !teamSpeciesKeys.has(c.speciesName.toLowerCase()),
  );

  const teamAnalysis = analyseTeam(chart, members);

  // Team < 6 → ADDITIONS
  if (members.length < 6) {
    const seen = new Set<string>();
    const ranked = dedupCandidates
      .filter((c) => {
        const key = c.speciesName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((cand) => {
        const { compositeScore, newlyCovered, newWeaknesses, aggravatedWeaknesses, aggravatedMembers: aggMembers } =
          computeCompositeScore(chart, cand, members, teamAnalysis.unionCovered);

        const entry = pool.find(
          (p) => p.displayName === cand.speciesName || p.name === cand.speciesName.toLowerCase(),
        );
        return {
          cand,
          newlyCovered,
          gain: newlyCovered.length,
          compositeScore,
          newWeaknesses,
          aggravatedWeaknesses,
          aggravatedMembers: aggMembers,
          isFinal: entry?.isFinalEvolution ?? false,
          entryId: entry?.id ?? Infinity,
        };
      })
      .sort((a, b) => {
        if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
        if (a.isFinal !== b.isFinal) return b.isFinal ? 1 : -1;
        return a.entryId - b.entryId;
      });

    return ranked.map(({ cand, newlyCovered, gain, compositeScore, newWeaknesses, aggravatedWeaknesses, aggravatedMembers: aggMembers }) => ({
      kind: 'add' as const,
      candidate: cand,
      candidateLabel: cand.speciesName,
      spriteUrl: cand.spriteUrl,
      types: cand.types,
      newlyCovered,
      gain,
      compositeScore,
      newWeaknesses,
      aggravatedWeaknesses,
      aggravatedMembers: aggMembers,
    }));
  }

  // Team full → REPLACEMENTS
  // For each candidate, find the best member to replace
  const seen = new Set<string>();
  const ranked = dedupCandidates
    .filter((c) => {
      const key = c.speciesName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((cand) => {
      let bestScore = -Infinity;
      let bestMember: TeamMember = members[0];
      let bestData = computeCompositeScore(chart, cand, members.filter((m) => m.id !== members[0].id), teamAnalysis.unionCovered);

      for (const m of members) {
        const otherMembers = members.filter((other) => other.id !== m.id);
        const data = computeCompositeScore(chart, cand, otherMembers, teamAnalysis.unionCovered);
        if (data.compositeScore > bestScore) {
          bestScore = data.compositeScore;
          bestMember = m;
          bestData = data;
        }
      }

      const entry = pool.find(
        (p) => p.displayName === cand.speciesName || p.name === cand.speciesName.toLowerCase(),
      );
      return {
        cand,
        gain: bestData.offensiveGain,
        compositeScore: bestScore,
        newlyCovered: bestData.newlyCovered,
        newWeaknesses: bestData.newWeaknesses,
        aggravatedWeaknesses: bestData.aggravatedWeaknesses,
        aggravatedMembers: bestData.aggravatedMembers,
        replaceMember: bestMember,
        isFinal: entry?.isFinalEvolution ?? false,
        entryId: entry?.id ?? Infinity,
      };
    })
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      if (a.isFinal !== b.isFinal) return b.isFinal ? 1 : -1;
      return a.entryId - b.entryId;
    });

  return ranked.map(({ cand, gain, compositeScore, newlyCovered, newWeaknesses, aggravatedWeaknesses, aggravatedMembers: aggMembers, replaceMember }) => ({
    kind: 'replace' as const,
    candidate: cand,
    candidateLabel: cand.speciesName,
    spriteUrl: cand.spriteUrl,
    types: cand.types,
    replacesMemberId: replaceMember.id,
    replacesName: replaceMember.speciesName,
    newlyCovered,
    gain,
    compositeScore,
    newWeaknesses,
    aggravatedWeaknesses,
    aggravatedMembers: aggMembers,
  }));
}
