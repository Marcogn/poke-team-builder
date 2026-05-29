import { useState } from 'react';
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
}

type Step = 'seed' | 'constraints' | 'result';

export function SurpriseMeModal({
  open,
  onClose,
  onCreate,
  pokemon,
  customs,
  typeChart,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('seed');
  const [lockedMembers, setLockedMembers] = useState<TeamMember[]>([]);
  const [constraints, setConstraints] = useState<GeneratorConstraints>({
    ...DEFAULT_CONSTRAINTS,
  });
  const [result, setResult] = useState<TeamMember[]>([]);
  const [warning, setWarning] = useState<string | undefined>();

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

  const anchorCount = lockedMembers.length;
  const constraintTotal = constraints.starterSlots + constraints.legendarySlots +
    constraints.mythicalSlots + constraints.megaSlots + constraints.dynamaxSlots +
    constraints.customSlots;
  const remainingSlots = 6 - anchorCount - constraintTotal;
  const budgetFull = anchorCount + constraintTotal >= 6;

  type CounterField = keyof GeneratorConstraints;

  function handleIncrement(field: CounterField) {
    if (budgetFull) return;
    setConstraints((prev) => ({ ...prev, [field]: prev[field] + 1 }));
  }

  function handleDecrement(field: CounterField) {
    setConstraints((prev) => ({
      ...prev,
      [field]: Math.max(0, prev[field] - 1),
    }));
  }

  return (
    <Modal open={open} onClose={handleClose} allowOverflow>
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
              dropdownClassName="absolute z-[110] mt-1 w-full max-h-[min(24rem,80vh)] overflow-y-auto bg-panel border border-panel2 rounded shadow-xl scrollbar-thin"
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
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {t('surpriseMe.remainingSlots', { count: remainingSlots >= 0 ? remainingSlots : 0 })}
            </p>
            <div className="flex flex-col gap-2">
              {([
                { field: 'starterSlots' as CounterField, label: t('surpriseMe.starters') },
                { field: 'legendarySlots' as CounterField, label: t('surpriseMe.legendaries') },
                { field: 'mythicalSlots' as CounterField, label: t('surpriseMe.mythicals') },
                { field: 'megaSlots' as CounterField, label: t('surpriseMe.megaEvolutions') },
                { field: 'dynamaxSlots' as CounterField, label: t('surpriseMe.dynamaxGmax') },
                ...(customs.length > 0
                  ? [{ field: 'customSlots' as CounterField, label: t('surpriseMe.customPokemon') }]
                  : []),
              ]).map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="w-9 h-9 flex items-center justify-center rounded bg-panel2 hover:bg-panel text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={constraints[field] <= 0}
                      onClick={() => handleDecrement(field)}
                      aria-label={`Decrease ${label}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums font-semibold">{constraints[field]}</span>
                    <button
                      type="button"
                      className="w-9 h-9 flex items-center justify-center rounded bg-panel2 hover:bg-panel text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={budgetFull}
                      onClick={() => handleIncrement(field)}
                      aria-label={`Increase ${label}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
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
