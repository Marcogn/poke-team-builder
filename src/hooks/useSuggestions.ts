import { useMemo } from 'react';
import {
  PokemonEntry,
  PokemonType,
  TeamMember,
  TypeChart,
} from '../types';
import { analyseTeam, offensiveCoverageForMember } from '../utils/coverageEngine';

export interface Suggestion {
  kind: 'add' | 'replace';
  candidate: PokemonEntry | TeamMember; // PokemonEntry for DB picks, TeamMember for custom
  candidateLabel: string;
  spriteUrl: string | null;
  types: [PokemonType, PokemonType | null];
  replacesMemberId?: string;
  replacesName?: string;
  newlyCovered: PokemonType[];
  reducedOverlap?: PokemonType[];
  gain: number;
}

function memberFromEntry(e: PokemonEntry): TeamMember {
  return {
    id: 'cand-' + e.id,
    speciesName: e.displayName,
    spriteUrl: e.spriteUrl,
    types: e.types,
    moves: [null, null, null, null],
    isCustomSaved: false,
  };
}

export function useSuggestions(
  chart: TypeChart | null,
  members: TeamMember[],
  pool: PokemonEntry[],
  customs: TeamMember[],
  options: { includeCustoms: boolean },
) {
  return useMemo<Suggestion[]>(() => {
    if (!chart || pool.length === 0) return [];

    // Patch 5: no legendary/mythical exclusion — include every Pokémon form.
    // Patch 2/3: each entry is already a distinct form, and every final-evolution
    // branch is independently flagged, so we only filter on `isFinalEvolution`.
    const filtered = pool.filter((p) => p.isFinalEvolution);

    const candidatePool: TeamMember[] = filtered.map(memberFromEntry);
    if (options.includeCustoms) {
      for (const c of customs) candidatePool.push(c);
    }

    const teamAnalysis = analyseTeam(chart, members);

    // Patch 7: custom Pokémon as candidates are always evaluated by their
    // stored types only (never their saved moves). DB candidates are also
    // evaluated by types — we don't try to infer movepools.
    const candidateCoverage = (cand: TeamMember): Set<PokemonType> => {
      return offensiveCoverageForMember(chart, cand, false);
    };

    // Case: team < 6 → recommend ADDITIONS
    if (members.length < 6) {
      const ranked = candidatePool
        .map((cand) => {
          const cov = candidateCoverage(cand);
          const newly: PokemonType[] = [];
          cov.forEach((t) => {
            if (!teamAnalysis.unionCovered.has(t)) newly.push(t);
          });
          return { cand, newly, gain: newly.length };
        })
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 5);

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

    // Team is full → find weakest link by unique contribution
    const contributions = members.map((m) => {
      const myCov = teamAnalysis.perMemberCovered.get(m.id) ?? new Set<PokemonType>();
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

    const baseCoverage = weakest.others; // coverage without weakest
    const seenIds = new Set<string>();
    const ranked = candidatePool
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
        // overlap reduction = types previously covered by weakest that we still cover via cand minus duplicates
        const reduced: PokemonType[] = [];
        return { cand, gain, newly, reduced };
      })
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 5);

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
  }, [chart, members, pool, customs, options.includeCustoms]);
}
