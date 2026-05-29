import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { POKEMON_TYPES, PokemonType, TeamMember, TypeChart } from '../../types';
import { defensiveMultiplier, memberHasMoves } from '../../utils/coverageEngine';
import { TypeBadge } from '../TypeBadge/TypeBadge';
import { getAbilityEffects, normalizeAbilityName } from '../../data/abilityEffects';

interface Props {
  chart: TypeChart;
  members: TeamMember[];
}

function cellClass(mult: number): string {
  if (mult === 0) return 'bg-red-700/70 text-white';
  if (mult >= 2) return 'bg-emerald-600/70 text-white';
  if (mult > 0 && mult < 1) return 'bg-orange-600/70 text-white';
  return 'bg-gray-100 dark:bg-panel2 text-gray-700 dark:text-slate-300';
}

function multLabel(mult: number): string {
  if (mult === 0) return '0×';
  if (mult === 0.25) return '¼×';
  if (mult === 0.5) return '½×';
  if (mult === 1) return '1×';
  if (mult === 2) return '2×';
  if (mult === 4) return '4×';
  return `${mult}×`;
}

function PerPokemonCard({ member, chart }: { member: TeamMember; chart: TypeChart }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const weak4x: PokemonType[] = [];
  const weak2x: PokemonType[] = [];
  const resist05x: PokemonType[] = [];
  const resist025x: PokemonType[] = [];
  const immune: PokemonType[] = [];

  for (const atk of POKEMON_TYPES) {
    const mult = defensiveMultiplier(chart, atk, member.types, member.ability);
    if (mult === 0) immune.push(atk);
    else if (mult >= 4) weak4x.push(atk);
    else if (mult >= 2) weak2x.push(atk);
    else if (mult <= 0.25) resist025x.push(atk);
    else if (mult < 1) resist05x.push(atk);
  }

  const hasMoves = memberHasMoves(member);
  const moveTypes: PokemonType[] = hasMoves
    ? member.moves
        .filter((mv) => mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0)
        .map((mv) => (mv as { type: PokemonType }).type)
    : [];

  return (
    <div className="bg-white dark:bg-panel border border-gray-200 dark:border-panel2 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 dark:hover:bg-panel2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {member.spriteUrl && <img src={member.spriteUrl} alt="" className="w-8 h-8 object-contain" />}
        <span className="font-semibold text-gray-900 dark:text-white">{member.speciesName}</span>
        <div className="flex gap-1 ml-1">
          {member.types[0] && <TypeBadge type={member.types[0]} />}
          {member.types[1] && <TypeBadge type={member.types[1]} />}
        </div>
        <span className="ml-auto text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2 max-w-full overflow-hidden">
          {member.ability && (() => {
            const effects = getAbilityEffects(member.ability);
            const isWonderGuard = normalizeAbilityName(member.ability) === 'wonder-guard';
            const effectSummary = effects
              ?.filter((e) => e.kind !== 'badge-only')
              .map((e) => {
                if (e.kind === 'immunity') return `${t('analysis.immuneTo')} ${e.type}`;
                return `×${e.factor} ${e.type}`;
              })
              .join(', ');
            return (
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-400 dark:text-slate-400 w-32 shrink-0">{t('slot.ability')}</span>
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  {member.ability}
                  {effectSummary && <span className="text-emerald-500 ml-1">— {effectSummary}</span>}
                  {isWonderGuard && <span className="text-purple-400 ml-1">— {t('analysis.wonderGuardNote')}</span>}
                </span>
              </div>
            );
          })()}
          {weak4x.length > 0 && (
            <DefRow label={t('defensive.weaknesses4x')} types={weak4x} />
          )}
          {weak2x.length > 0 && (
            <DefRow label={t('defensive.weaknesses2x')} types={weak2x} />
          )}
          {resist05x.length > 0 && (
            <DefRow label={t('defensive.resistances05x')} types={resist05x} />
          )}
          {resist025x.length > 0 && (
            <DefRow label={t('defensive.resistances025x')} types={resist025x} />
          )}
          {immune.length > 0 && (
            <DefRow label={t('defensive.immune0x')} types={immune} />
          )}
          {hasMoves && moveTypes.length > 0 && (
            <div className="flex items-start gap-2 mt-1">
              <span className="text-sm text-gray-400 dark:text-slate-400 w-32 shrink-0">{t('defensive.moveCoverage')}</span>
              <div className="flex flex-wrap gap-1">
                {moveTypes.map((tp, i) => <TypeBadge key={`${tp}-${i}`} type={tp} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DefRow({ label, types }: { label: string; types: PokemonType[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm text-gray-400 dark:text-slate-400 w-32 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1">
        {types.map((tp) => <TypeBadge key={tp} type={tp} />)}
      </div>
    </div>
  );
}

export function CoverageGrid({ chart, members }: Props) {
  const { t } = useTranslation();

  // Coverage basis notice
  const allHaveMoves = members.length > 0 && members.every(memberHasMoves);
  const noneHaveMoves = members.every((m) => !memberHasMoves(m));
  const mixed = !allHaveMoves && !noneHaveMoves;

  let basisNotice = t('analysis.basisTypesOnly');
  if (allHaveMoves) {
    basisNotice = t('analysis.basisMovesOnly');
  } else if (mixed) {
    const moveNames = members.filter(memberHasMoves).map((m) => m.speciesName).join(', ');
    const typeNames = members.filter((m) => !memberHasMoves(m)).map((m) => m.speciesName).join(', ');
    basisNotice = t('analysis.basisMixed', { moveNames, typeNames });
  }

  // Shared weaknesses with counts
  const weaknessCounts = new Map<PokemonType, number>();
  for (const atk of POKEMON_TYPES) {
    let count = 0;
    for (const m of members) {
      if (defensiveMultiplier(chart, atk, m.types, m.ability) > 1) count++;
    }
    if (count >= 2) weaknessCounts.set(atk, count);
  }
  const sortedWeaknesses = [...weaknessCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      {/* Section A — Coverage basis notice */}
      <div className="text-sm text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-panel2/50 rounded px-3 py-2">
        {basisNotice}
      </div>

      {/* Section B — Per-Pokémon breakdown */}
      <section>
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.perPokemon')}</h3>
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <PerPokemonCard key={m.id} member={m} chart={chart} />
          ))}
        </div>
      </section>

      {/* Section C — Offensive coverage grid */}
      <section>
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.offensiveCoverage')}</h3>
        <div className="overflow-auto scrollbar-thin">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white">Pokémon</th>
                {POKEMON_TYPES.map((tp) => (
                  <th key={tp} className="px-1 py-1 text-center">
                    <TypeBadge type={tp} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const attackingTypes = collectAttackingTypes(m);
                return (
                  <tr key={m.id}>
                    <td className="px-2 py-1 sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white max-w-[96px]">
                      <div className="flex items-center gap-1">
                        {m.spriteUrl && <img src={m.spriteUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={m.speciesName}>{m.speciesName}</span>
                      </div>
                    </td>
                    {POKEMON_TYPES.map((def) => {
                      let best = 0;
                      for (const atk of attackingTypes) {
                        const v = chart[atk]?.[def] ?? 1;
                        if (v > best) best = v;
                      }
                      return (
                        <td key={def} className={`px-1 py-1 text-center ${cellClass(best)}`}>
                          {multLabel(best)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="px-2 py-1 sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white max-w-[96px] overflow-hidden text-ellipsis whitespace-nowrap" title={t('analysis.teamBest')}>{t('analysis.teamBest')}</td>
                {POKEMON_TYPES.map((def) => {
                  let best = 0;
                  for (const m of members) {
                    for (const atk of collectAttackingTypes(m)) {
                      const v = chart[atk]?.[def] ?? 1;
                      if (v > best) best = v;
                    }
                  }
                  return (
                    <td key={def} className={`px-1 py-1 text-center ${cellClass(best)}`}>
                      {multLabel(best)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section D — Defensive coverage grid */}
      <section>
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.defensiveCoverage')}</h3>
        <div className="overflow-auto scrollbar-thin">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white">Pokémon</th>
                {POKEMON_TYPES.map((tp) => (
                  <th key={tp} className="px-1 py-1 text-center">
                    <TypeBadge type={tp} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-2 py-1 sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white max-w-[96px]">
                    <div className="flex items-center gap-1">
                      {m.spriteUrl && <img src={m.spriteUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={m.speciesName}>{m.speciesName}</span>
                    </div>
                  </td>
                  {POKEMON_TYPES.map((atk) => {
                    const mult = defensiveMultiplier(chart, atk, m.types, m.ability);
                    return (
                      <td key={atk} className={`px-1 py-1 text-center ${cellClass(mult)}`}>
                        {multLabel(mult)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="px-2 py-1 sticky left-0 bg-white dark:bg-bg z-10 text-gray-900 dark:text-white max-w-[96px] overflow-hidden text-ellipsis whitespace-nowrap" title={t('analysis.mostVulnerable')}>{t('analysis.mostVulnerable')}</td>
                {POKEMON_TYPES.map((atk) => {
                  let worst = 0;
                  for (const m of members) {
                    const mult = defensiveMultiplier(chart, atk, m.types, m.ability);
                    if (mult > worst) worst = mult;
                  }
                  return (
                    <td key={atk} className={`px-1 py-1 text-center ${cellClass(worst)}`}>
                      {multLabel(worst)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section E — Shared weaknesses */}
      <section>
        <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t('analysis.sharedWeaknesses')}</h3>
        <div className="flex flex-wrap gap-1">
          {sortedWeaknesses.map(([tp, count]) => (
            <span key={tp} className="inline-flex items-center gap-0.5">
              <TypeBadge type={tp} />
              <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">×{count}</span>
            </span>
          ))}
          {sortedWeaknesses.length === 0 && (
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('analysis.noSharedWeaknesses')}</span>
          )}
        </div>
      </section>
    </div>
  );
}

function collectAttackingTypes(m: TeamMember): PokemonType[] {
  const damaging = m.moves.filter(
    (mv) => mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0,
  );
  if (damaging.length > 0) return damaging.map((mv) => (mv as { type: PokemonType }).type);
  return [m.types[0], ...(m.types[1] ? [m.types[1]] : [])];
}
