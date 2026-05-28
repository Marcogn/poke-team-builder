import {
  PokemonEntry,
  PokemonType,
  TeamMember,
  TypeChart,
} from '../types';
import { analyseTeam, offensiveCoverageForMember } from '../utils/coverageEngine';
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
}

export interface SuggestionOptions {
  includeCustoms: boolean;
  /**
   * When true, legendary/mythical Pokémon are excluded from the candidate
   * pool unless the team already contains one. Defaults to false to match
   * the current shipping behavior (Patch 5 — no exclusion).
   */
  excludeLegendaries?: boolean;
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

/**
 * Pure suggestion ranking. Extracted from useSuggestions so it can be
 * unit-tested without a React wrapper.
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

  // Remove any candidate that's already on the team (same species name).
  const teamSpeciesKeys = new Set(
    members.map((m) => m.speciesName.toLowerCase()),
  );
  const dedupCandidates = candidatePool.filter(
    (c) => !teamSpeciesKeys.has(c.speciesName.toLowerCase()),
  );

  const teamAnalysis = analyseTeam(chart, members);

  const candidateCoverage = (cand: TeamMember): Set<PokemonType> =>
    offensiveCoverageForMember(chart, cand, false);

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
        const cov = candidateCoverage(cand);
        const newly: PokemonType[] = [];
        cov.forEach((t) => {
          if (!teamAnalysis.unionCovered.has(t)) newly.push(t);
        });
        const entry = pool.find(
          (p) => p.displayName === cand.speciesName || p.name === cand.speciesName.toLowerCase(),
        );
        return { cand, newly, gain: newly.length, isFinal: entry?.isFinalEvolution ?? false, entryId: entry?.id ?? Infinity };
      })
      .sort((a, b) => {
        if (b.gain !== a.gain) return b.gain - a.gain;
        if (a.isFinal !== b.isFinal) return b.isFinal ? 1 : -1; // isFinal desc: true first
        return a.entryId - b.entryId; // id asc
      });

    return ranked.map(({ cand, newly, gain }) => ({
      kind: 'add' as const,
      candidate: cand,
      candidateLabel: cand.speciesName,
      spriteUrl: cand.spriteUrl,
      types: cand.types,
      newlyCovered: newly,
      gain,
    }));
  }

  // Team full → REPLACEMENTS
  const contributions = members.map((m) => {
    const myCov =
      teamAnalysis.perMemberCovered.get(m.id) ?? new Set<PokemonType>();
    const others = new Set<PokemonType>();
    members.forEach((other) => {
      if (other.id === m.id) return;
      teamAnalysis.perMemberCovered.get(other.id)?.forEach((t) => others.add(t));
    });
    const unique = new Set<PokemonType>();
    myCov.forEach((t) => {
      if (!others.has(t)) unique.add(t);
    });
    return { member: m, others, unique };
  });
  contributions.sort((a, b) => a.unique.size - b.unique.size);
  const weakest = contributions[0];

  const baseCoverage = weakest.others;
  const seenIds = new Set<string>();
  const ranked = dedupCandidates
    .filter((c) => {
      const key = c.speciesName.toLowerCase();
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    })
    .map((cand) => {
      const cov = candidateCoverage(cand);
      const newUnion = new Set<PokemonType>(baseCoverage);
      cov.forEach((t) => newUnion.add(t));
      const gain = newUnion.size - teamAnalysis.unionCovered.size;
      const newly: PokemonType[] = [];
      newUnion.forEach((t) => {
        if (!teamAnalysis.unionCovered.has(t)) newly.push(t);
      });
      const entry = pool.find(
        (p) => p.displayName === cand.speciesName || p.name === cand.speciesName.toLowerCase(),
      );
      return { cand, gain, newly, isFinal: entry?.isFinalEvolution ?? false, entryId: entry?.id ?? Infinity };
    })
    .sort((a, b) => {
      if (b.gain !== a.gain) return b.gain - a.gain;
      if (a.isFinal !== b.isFinal) return b.isFinal ? 1 : -1;
      return a.entryId - b.entryId;
    });

  return ranked.map(({ cand, gain, newly }) => ({
    kind: 'replace' as const,
    candidate: cand,
    candidateLabel: cand.speciesName,
    spriteUrl: cand.spriteUrl,
    types: cand.types,
    replacesMemberId: weakest.member.id,
    replacesName: weakest.member.speciesName,
    newlyCovered: newly,
    gain,
  }));
}
