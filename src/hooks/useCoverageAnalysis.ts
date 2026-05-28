import { useMemo } from 'react';
import { TeamMember, TypeChart } from '../types';
import { analyseTeam, defensiveProfile, sharedWeaknesses } from '../utils/coverageEngine';

export function useCoverageAnalysis(chart: TypeChart | null, members: TeamMember[]) {
  return useMemo(() => {
    if (!chart || members.length === 0) return null;
    const team = analyseTeam(chart, members);
    const defense = members.map((m) => ({ member: m, profile: defensiveProfile(chart, m.types) }));
    const shared = sharedWeaknesses(chart, members);
    return { team, defense, shared };
  }, [chart, members]);
}
