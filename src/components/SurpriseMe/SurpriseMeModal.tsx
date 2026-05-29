import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PokemonEntry, TeamMember, TypeChart } from '../../types';
import { Modal } from '../Modal/Modal';
import { SearchableDropdown, DropdownOption } from '../SearchableDropdown/SearchableDropdown';
import { TypeBadge } from '../TypeBadge/TypeBadge';
import { resolveSpriteUrl } from '../../utils/spriteUtils';
import {
  generateTeam,
  regenerateSlot,
  GeneratorConstraints,
  DEFAULT_CONSTRAINTS,
} from '../../hooks/teamGenerator';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (members: TeamMember[]) => void;
  pokemon: PokemonEntry[];
  customs: TeamMember[];
  typeChart: TypeChart | null;
  includeMegaDynamax: boolean;
  excludeLegendaries: boolean;
}

type Step = 'seed' | 'constraints' | 'result';

export function SurpriseMeModal({
  open,
  onClose,
  onCreate,
  pokemon,
  customs,
  typeChart,
  includeMegaDynamax,
  excludeLegendaries,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('seed');
  const [lockedMembers, setLockedMembers] = useState<TeamMember[]>([]);
  const [constraints, setConstraints] = useState<GeneratorConstraints>({
    ...DEFAULT_CONSTRAINTS,
    includeMega: includeMegaDynamax,
    includeDynamax: includeMegaDynamax,
    includeLegendaries: !excludeLegendaries,
    includeMythicals: !excludeLegendaries,
  });
  const [result, setResult] = useState<TeamMember[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  // Track order of edits for clamping: most recent field name last
  const lastEditedRef = useRef<('starterSlots' | 'maxLegendaries' | 'maxMythicals')[]>([]);

  function handleClose() {
    setStep('seed');
    setLockedMembers([]);
    setResult([]);
    setWarning(undefined);
    onClose();
  }

  function handleGenerate() {
    if (!typeChart) return;
    const res = generateTeam(typeChart, pokemon, customs, lockedMembers, constraints);
    setResult(res.team);
    setWarning(res.warning);
    setStep('result');
  }

  function handleRegenerateAll() {
    if (!typeChart) return;
    const res = generateTeam(typeChart, pokemon, customs, lockedMembers, constraints);
    setResult(res.team);
    setWarning(res.warning);
  }

  function handleRegenerateSlot(idx: number) {
    if (!typeChart) return;
    const newMember = regenerateSlot(typeChart, pokemon, customs, result, idx, constraints);
    const newResult = [...result];
    newResult[idx] = newMember;
    setResult(newResult);
  }

  function handleCreate() {
    onCreate(result);
    handleClose();
  }

  function addLocked(_: unknown, opt: DropdownOption<PokemonEntry> | null) {
    if (!opt || lockedMembers.length >= 6) return;
    const entry = opt.value;
    const member: TeamMember = {
      id: 'locked-' + entry.id,
      speciesName: entry.displayName,
      spriteUrl: resolveSpriteUrl(entry, 'card'),
      types: entry.types,
      moves: [null, null, null, null],
      isCustomSaved: false,
      ability: entry.defaultAbility,
    };
    setLockedMembers([...lockedMembers, member]);
  }

  function removeLocked(idx: number) {
    setLockedMembers(lockedMembers.filter((_, i) => i !== idx));
  }

  const pokemonOptions: DropdownOption<PokemonEntry>[] = pokemon
    .map((p) => ({
      key: 'p-' + p.id,
      label: p.displayName,
      value: p,
      spriteUrl: resolveSpriteUrl(p, 'dropdown'),
    }));

  const remainingSlots = 6 - lockedMembers.length;

  /**
   * Compute the total of all checked numeric constraints.
   */
  function getConstraintTotal(c: GeneratorConstraints): number {
    let total = 0;
    if (c.includeStarters) total += c.starterSlots;
    if (c.includeLegendaries) total += c.maxLegendaries;
    if (c.includeMythicals) total += c.maxMythicals;
    return total;
  }

  /**
   * Clamp all numeric constraint fields so their sum ≤ remainingSlots.
   * The most recently edited field keeps its value; others are clamped
   * starting from the least recently edited.
   */
  function clampConstraints(
    c: GeneratorConstraints,
    editedField: 'starterSlots' | 'maxLegendaries' | 'maxMythicals',
  ): GeneratorConstraints {
    // Update edit order
    const order = lastEditedRef.current.filter((f) => f !== editedField);
    order.push(editedField);
    lastEditedRef.current = order;

    const budget = remainingSlots;
    const next = { ...c };

    // Collect active fields in priority order (most recent last = highest priority)
    type Field = 'starterSlots' | 'maxLegendaries' | 'maxMythicals';
    const activeFields: { field: Field; enabled: boolean }[] = [
      { field: 'starterSlots', enabled: next.includeStarters },
      { field: 'maxLegendaries', enabled: next.includeLegendaries },
      { field: 'maxMythicals', enabled: next.includeMythicals },
    ];

    // Sort by edit order: least recent first (will be clamped first)
    const sortedActive = activeFields
      .filter((f) => f.enabled)
      .sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field));

    let totalUsed = sortedActive.reduce((sum, f) => sum + next[f.field], 0);

    if (totalUsed > budget) {
      // Clamp from least recently edited
      for (const f of sortedActive) {
        if (totalUsed <= budget) break;
        const excess = totalUsed - budget;
        const currentVal = next[f.field];
        const reduction = Math.min(excess, currentVal - 1);
        if (reduction > 0) {
          next[f.field] = currentVal - reduction;
          totalUsed -= reduction;
        }
      }
    }

    return next;
  }

  function handleNumericChange(
    field: 'starterSlots' | 'maxLegendaries' | 'maxMythicals',
    rawValue: string,
  ) {
    let val = parseInt(rawValue, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > remainingSlots) val = remainingSlots;
    const updated = { ...constraints, [field]: val };
    setConstraints(clampConstraints(updated, field));
  }

  function handleNumericBlur(
    field: 'starterSlots' | 'maxLegendaries' | 'maxMythicals',
    rawValue: string,
  ) {
    const val = parseInt(rawValue, 10);
    if (isNaN(val) || val < 1) {
      const updated = { ...constraints, [field]: 1 };
      setConstraints(clampConstraints(updated, field));
    }
  }

  const usedSlots = getConstraintTotal(constraints);
  const budgetRemaining = remainingSlots - usedSlots;

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">{t('surpriseMe.title')}</h2>

        {step === 'seed' && (
          <>
            <p className="text-sm text-gray-600 dark:text-slate-400">{t('surpriseMe.seedDescription')}</p>
            {lockedMembers.length >= 6 && (
              <p className="text-sm text-amber-500">{t('surpriseMe.seedWarning')}</p>
            )}
            <SearchableDropdown
              options={pokemonOptions}
              value={null}
              placeholder="Choose Pokémon…"
              onChange={addLocked}
            />
            <div className="flex flex-wrap gap-2">
              {lockedMembers.map((m, i) => (
                <div key={m.id} className="flex items-center gap-1 bg-panel2 rounded px-2 py-1 text-sm">
                  {m.spriteUrl && <img src={m.spriteUrl} alt="" className="w-5 h-5 object-contain" />}
                  <span>{m.speciesName}</span>
                  <button
                    onClick={() => removeLocked(i)}
                    className="ml-1 text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
                onClick={handleClose}
              >
                {t('teams.cancel')}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-violet-500 font-semibold disabled:opacity-50"
                onClick={() => setStep('constraints')}
                disabled={lockedMembers.length >= 6}
              >
                {t('surpriseMe.constraintsStep')} →
              </button>
            </div>
          </>
        )}

        {step === 'constraints' && (
          <>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t('surpriseMe.remainingSlots', { count: budgetRemaining >= 0 ? budgetRemaining : 0 })}
            </p>
            <div className="flex flex-col gap-2">
              {/* Starters */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeStarters}
                  onChange={(e) => setConstraints({ ...constraints, includeStarters: e.target.checked })}
                />
                {t('surpriseMe.includeStarters')}
                {constraints.includeStarters && (
                  <input
                    type="number"
                    min={1}
                    max={remainingSlots}
                    value={constraints.starterSlots}
                    onChange={(e) => handleNumericChange('starterSlots', e.target.value)}
                    onBlur={(e) => handleNumericBlur('starterSlots', e.target.value)}
                    className="w-12 bg-panel2 rounded px-1.5 py-0.5 text-sm ml-auto"
                  />
                )}
              </label>

              {/* Legendaries */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeLegendaries}
                  onChange={(e) => setConstraints({ ...constraints, includeLegendaries: e.target.checked })}
                />
                {t('surpriseMe.includeLegendaries')}
                {constraints.includeLegendaries && (
                  <input
                    type="number"
                    min={1}
                    max={remainingSlots}
                    value={constraints.maxLegendaries}
                    onChange={(e) => handleNumericChange('maxLegendaries', e.target.value)}
                    onBlur={(e) => handleNumericBlur('maxLegendaries', e.target.value)}
                    className="w-12 bg-panel2 rounded px-1.5 py-0.5 text-sm ml-auto"
                  />
                )}
              </label>

              {/* Mythicals */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeMythicals}
                  onChange={(e) => setConstraints({ ...constraints, includeMythicals: e.target.checked })}
                />
                {t('surpriseMe.includeMythicals')}
                {constraints.includeMythicals && (
                  <input
                    type="number"
                    min={1}
                    max={remainingSlots}
                    value={constraints.maxMythicals}
                    onChange={(e) => handleNumericChange('maxMythicals', e.target.value)}
                    onBlur={(e) => handleNumericBlur('maxMythicals', e.target.value)}
                    className="w-12 bg-panel2 rounded px-1.5 py-0.5 text-sm ml-auto"
                  />
                )}
              </label>

              {/* Mega / Dynamax */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeMega}
                  onChange={(e) => setConstraints({ ...constraints, includeMega: e.target.checked })}
                />
                {t('surpriseMe.includeMega')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeDynamax}
                  onChange={(e) => setConstraints({ ...constraints, includeDynamax: e.target.checked })}
                />
                {t('surpriseMe.includeDynamax')}
              </label>

              {/* Custom */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={constraints.includeCustom}
                  onChange={(e) => setConstraints({ ...constraints, includeCustom: e.target.checked })}
                />
                {t('surpriseMe.includeCustom')}
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
                onClick={() => setStep('seed')}
              >
                ← {t('surpriseMe.back')}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-violet-500 font-semibold"
                onClick={handleGenerate}
              >
                {t('surpriseMe.generate')}
              </button>
            </div>
          </>
        )}

        {step === 'result' && (
          <>
            {warning && (
              <p className="text-sm text-amber-500">{t(`surpriseMe.${warning}`)}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result.map((m, i) => {
                const isLocked = i < lockedMembers.length;
                return (
                  <div
                    key={m.id + '-' + i}
                    className="bg-white dark:bg-panel border border-gray-200 dark:border-panel2 rounded-lg p-3 flex flex-col items-center gap-1"
                  >
                    {m.spriteUrl && <img src={m.spriteUrl} alt="" className="w-12 h-12 object-contain" />}
                    <span className="text-sm font-semibold text-center text-gray-900 dark:text-white">{m.speciesName}</span>
                    <div className="flex gap-1">
                      {m.types[0] && <TypeBadge type={m.types[0]} />}
                      {m.types[1] && <TypeBadge type={m.types[1]} />}
                    </div>
                    {m.ability && (
                      <span className="text-[10px] text-gray-500 dark:text-slate-400">{m.ability}</span>
                    )}
                    {!isLocked && (
                      <button
                        className="text-xs px-2 py-0.5 rounded bg-panel2 hover:bg-panel mt-1"
                        onClick={() => handleRegenerateSlot(i)}
                        title={t('surpriseMe.regenerateSlot')}
                      >
                        {t('surpriseMe.regenerateSlot')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel"
                onClick={() => setStep('constraints')}
              >
                ← {t('surpriseMe.back')}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-panel2 hover:bg-panel font-semibold"
                onClick={handleRegenerateAll}
              >
                {t('surpriseMe.regenerateAll')}
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-violet-500 font-semibold"
                onClick={handleCreate}
              >
                {t('surpriseMe.createTeam')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
